// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — particle systems
// HeroParticles: one 100k-point river morphing between formations on the GPU.
// Plus: dust motes around the camera, swirling petals, rising embers,
// wandering fireflies. All additive, all procedural.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { GU, NOISE_GLSL, C } from './materials.js';
import { FORMATION_BUILDERS } from './formations.js';
import { mulberry32 } from './utils.js';

// two-tone palette per formation (indices match FORMATION_BUILDERS)
const FORM_COLORS = [
  [0xd88a2a, 0x7a3f10], // orb shell — quiet amber
  [0xffd98a, 0xff7a2f], // burst — hot gold & ember
  [0xf2b23c, 0xe0234f], // gate — gold & ruby
  [0x9a6cf0, 0xf2b23c], // nebula — violet & gold
  [0xffe9b8, 0xffffff], // shubh — near-white gold
  [0xffa04a, 0xe86a8a], // halo — lamplight & rose
];

export class HeroParticles {
  constructor(count) {
    this.count = count;
    const S = Math.ceil(Math.sqrt(count));
    this.texSize = S;

    // formation position textures
    this.formTex = FORMATION_BUILDERS.map((build) => {
      const data = new Float32Array(S * S * 4);
      data.set(build(count));
      const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.FloatType);
      tex.needsUpdate = true;
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      return tex;
    });

    const geo = new THREE.BufferGeometry();
    const refs = new Float32Array(count * 2);
    const seeds = new Float32Array(count * 4);
    const rnd = mulberry32(9090);
    for (let i = 0; i < count; i++) {
      refs[i * 2 + 0] = ((i % S) + 0.5) / S;
      refs[i * 2 + 1] = (Math.floor(i / S) + 0.5) / S;
      seeds[i * 4 + 0] = rnd();          // stagger
      seeds[i * 4 + 1] = 0.4 + rnd();    // size variance
      seeds[i * 4 + 2] = rnd() * TAU_F;  // twinkle phase
      seeds[i * 4 + 3] = rnd();          // hue mix
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // unused, required
    geo.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -75), 400);

    this.uniforms = {
      uTime: GU.uTime,
      uFormA: { value: this.formTex[0] },
      uFormB: { value: this.formTex[1] },
      uMix: { value: 0 },
      uTurb: { value: 0.3 },
      uSize: { value: 1.0 },
      uPR: { value: 1 },
      uColA1: { value: C(FORM_COLORS[0][0]) }, uColA2: { value: C(FORM_COLORS[0][1]) },
      uColB1: { value: C(FORM_COLORS[1][0]) }, uColB2: { value: C(FORM_COLORS[1][1]) },
      uAlpha: { value: 1 },
      uSwirl: { value: new THREE.Vector4(0, 0, 0, 0) }, // cursor point + strength
    };

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform sampler2D uFormA, uFormB;
        uniform float uMix, uTurb, uTime, uSize, uPR;
        uniform vec4 uSwirl;
        attribute vec2 aRef;
        attribute vec4 aSeed;
        varying float vBright; varying float vHue; varying float vTw;
        ${NOISE_GLSL}
        void main(){
          vec4 A = texture2D(uFormA, aRef);
          vec4 B = texture2D(uFormB, aRef);
          // staggered, eased per-particle transit
          float stag = aSeed.x * 0.4;
          float m = smoothstep(stag, stag + 0.6, uMix);
          m = m * m * (3.0 - 2.0 * m);
          vec3 pos = mix(A.xyz, B.xyz, m);
          // mid-flight particles arc outward — they travel, not teleport
          float flight = m * (1.0 - m) * 4.0;
          pos += curl(pos * 0.05 + aSeed.x * 7.0) * flight * (2.0 + aSeed.y * 3.0);
          // breathing turbulence
          pos += curl(pos * 0.085 + vec3(0.0, uTime * 0.045, 0.0)) * uTurb * (0.5 + aSeed.y * 0.8);
          // the guest's presence stirs the river
          vec3 toC = pos - uSwirl.xyz;
          float d = length(toC);
          if (uSwirl.w > 0.001 && d < 7.0) {
            float f = (1.0 - d / 7.0) * uSwirl.w;
            vec3 tang = normalize(cross(toC + 1e-4, vec3(0.0, 1.0, 0.0)));
            pos += tang * f * 1.6 + normalize(toC + 1e-4) * f * 0.7;
          }
          vBright = mix(A.w, B.w, m);
          vHue = aSeed.w;
          vTw = aSeed.z;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float size = uSize * aSeed.y * (1.0 + flight * 0.7);
          gl_PointSize = size * uPR * 320.0 / max(1.0, -mv.z);
          gl_PointSize = min(gl_PointSize, 22.0 * uPR);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColA1, uColA2, uColB1, uColB2;
        uniform float uMix, uAlpha, uTime;
        varying float vBright; varying float vHue; varying float vTw;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p) * 2.0;
          float disc = pow(max(0.0, 1.0 - d), 2.2);
          float core = pow(max(0.0, 1.0 - d * 1.8), 5.0);
          vec3 colA = mix(uColA2, uColA1, vHue);
          vec3 colB = mix(uColB2, uColB1, vHue);
          vec3 col = mix(colA, colB, smoothstep(0.15, 0.85, uMix));
          float tw = 0.62 + 0.38 * sin(uTime * (0.9 + vHue * 2.4) + vTw);
          float a = disc * vBright * tw * uAlpha;
          gl_FragColor = vec4((col + core * 0.9) * a, a);
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this._pair = [0, 1];
  }

  // choose the active formation pair + transit position
  set(a, b, mix) {
    if (this._pair[0] !== a) {
      this.uniforms.uFormA.value = this.formTex[a];
      this.uniforms.uColA1.value.setHex(FORM_COLORS[a][0]);
      this.uniforms.uColA2.value.setHex(FORM_COLORS[a][1]);
      this._pair[0] = a;
    }
    if (this._pair[1] !== b) {
      this.uniforms.uFormB.value = this.formTex[b];
      this.uniforms.uColB1.value.setHex(FORM_COLORS[b][0]);
      this.uniforms.uColB2.value.setHex(FORM_COLORS[b][1]);
      this._pair[1] = b;
    }
    this.uniforms.uMix.value = mix;
  }

  setDrawCount(n) {
    this.points.geometry.setDrawRange(0, Math.min(n, this.count));
  }
}

const TAU_F = Math.PI * 2;

// ── dust motes: always with you, wrapped around the camera ─────────────────
export class Dust {
  constructor(n = 2400) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3);
    const rnd = mulberry32(77);
    const BOX = 26;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 0] = (rnd() - 0.5) * BOX;
      pos[i * 3 + 1] = (rnd() - 0.5) * BOX;
      pos[i * 3 + 2] = (rnd() - 0.5) * BOX;
      seed[i * 3 + 0] = rnd(); seed[i * 3 + 1] = rnd(); seed[i * 3 + 2] = rnd();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    this.uniforms = {
      uTime: GU.uTime,
      uCam: { value: new THREE.Vector3() },
      uAlpha: { value: 0.55 },
      uPR: { value: 1 },
      uWarm: GU.uWarmth,
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime, uPR; uniform vec3 uCam;
        attribute vec3 aSeed;
        varying float vA;
        void main(){
          const float BOX = 26.0;
          vec3 drift = vec3(
            sin(uTime * 0.05 + aSeed.x * 6.28) * 2.0 + uTime * 0.12,
            sin(uTime * 0.04 + aSeed.y * 6.28) * 1.5 + uTime * 0.05,
            cos(uTime * 0.045 + aSeed.z * 6.28) * 2.0);
          vec3 p = mod(position + drift - uCam + BOX * 0.5, BOX) - BOX * 0.5 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          vA = smoothstep(1.2, 4.0, dist) * smoothstep(24.0, 12.0, dist);
          gl_PointSize = (aSeed.x * 2.2 + 0.8) * uPR * 26.0 / max(1.0, dist);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha, uWarm;
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 3.0) * vA * uAlpha;
          vec3 col = mix(vec3(0.85, 0.7, 0.45), vec3(1.0, 0.62, 0.4), uWarm);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
  update(camPos) { this.uniforms.uCam.value.copy(camPos); }
}

// ── petals: instanced curved quads, two modes (swirl-dive / gentle fall) ───
export class Petals {
  constructor(n = 700) {
    const quad = new THREE.PlaneGeometry(0.42, 0.58, 1, 3);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.attributes = quad.attributes;
    const seed = new Float32Array(n * 4);
    const rnd = mulberry32(555);
    for (let i = 0; i < n; i++) {
      seed[i * 4 + 0] = rnd(); seed[i * 4 + 1] = rnd();
      seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    geo.instanceCount = n;
    this.uniforms = {
      uTime: GU.uTime,
      uCenter: { value: new THREE.Vector3(0, -114, -150) },
      uSpan: { value: new THREE.Vector3(34, 26, 34) },
      uMode: { value: 0 },   // 0 fall · 1 swirl around center
      uAlpha: { value: 0 },
      uFogColor: GU.uFogColor, uFogDensity: GU.uFogDensity,
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime, uMode;
        uniform vec3 uCenter, uSpan;
        attribute vec4 aSeed;
        varying vec2 vUv; varying float vShade; varying float vHue; varying vec3 vW;
        void main(){
          vUv = uv; vHue = aSeed.w;
          float t = uTime * (0.5 + aSeed.y * 0.6);
          vec3 p;
          if (uMode < 0.5) {
            // slow fall with sideways sway
            p.x = (aSeed.x - 0.5) * uSpan.x + sin(t * 0.9 + aSeed.z * 20.0) * 1.8;
            p.y = uSpan.y * 0.5 - mod(aSeed.z * uSpan.y + t * 1.1, uSpan.y);
            p.z = (aSeed.y - 0.5) * uSpan.z + cos(t * 0.7 + aSeed.x * 17.0) * 1.6;
          } else {
            // helix swirl around the diving camera
            float th = aSeed.x * 6.283 + t * (0.6 + aSeed.z);
            float R = 2.5 + aSeed.y * 7.0;
            p.x = cos(th) * R;
            p.y = uSpan.y * 0.5 - mod(aSeed.z * uSpan.y + t * 2.6, uSpan.y);
            p.z = sin(th) * R;
          }
          p += uCenter;
          // tumble
          float rx = t * (1.2 + aSeed.x) + aSeed.z * 6.283;
          float rz = t * (0.9 + aSeed.y) + aSeed.x * 6.283;
          vec3 v = position;
          v.z += sin(uv.y * 3.1416) * 0.09; // petal cup
          mat3 Rx = mat3(1,0,0, 0,cos(rx),-sin(rx), 0,sin(rx),cos(rx));
          mat3 Rz = mat3(cos(rz),-sin(rz),0, sin(rz),cos(rz),0, 0,0,1);
          v = Rz * Rx * v;
          vShade = 0.6 + 0.4 * sin(rx);
          vW = p + v;
          gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying vec2 vUv; varying float vShade; varying float vHue; varying vec3 vW;
        uniform vec3 uFogColor; uniform float uFogDensity;
        void main(){
          // petal silhouette from uv
          vec2 p = vUv - vec2(0.5, 0.45);
          float petal = 1.0 - smoothstep(0.32, 0.42, length(p * vec2(2.1, 1.35 - vUv.y * 0.35)));
          if (petal < 0.02) discard;
          vec3 rose = mix(vec3(0.95, 0.35, 0.3), vec3(1.0, 0.62, 0.25), vHue);
          if (vHue > 0.72) rose = vec3(0.98, 0.9, 0.78); // some cream petals
          vec3 col = rose * (0.55 + 0.45 * vShade);
          col += vec3(1.0, 0.8, 0.5) * (1.0 - vUv.y) * 0.2;
          float f = 1.0 - exp(-uFogDensity * uFogDensity * dot(cameraPosition - vW, cameraPosition - vW));
          col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, petal * uAlpha);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }
}

// ── embers rising from lamps ────────────────────────────────────────────────
export class Embers {
  constructor(n = 800) {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(n * 4);
    const rnd = mulberry32(888);
    for (let i = 0; i < n; i++) {
      seed[i * 4 + 0] = rnd(); seed[i * 4 + 1] = rnd();
      seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: GU.uTime,
      uCenter: { value: new THREE.Vector3(0, -119, -150) },
      uAlpha: { value: 0 },
      uPR: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime, uPR; uniform vec3 uCenter;
        attribute vec4 aSeed;
        varying float vA;
        void main(){
          float life = fract(aSeed.z + uTime * (0.05 + aSeed.y * 0.06));
          float th = aSeed.x * 6.283;
          float R = (2.0 + aSeed.w * 26.0);
          vec3 p = uCenter + vec3(
            cos(th) * R + sin(uTime * 0.8 + aSeed.x * 40.0) * (0.4 + life * 1.6),
            life * 17.0,
            sin(th) * R * 0.8 + cos(uTime * 0.7 + aSeed.y * 40.0) * (0.4 + life * 1.6));
          vA = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.55, life);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.7 + aSeed.y * 1.6) * uPR * 62.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.6) * vA * uAlpha;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.18) * a * 1.7, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
}

// ── fireflies: wandering warm sparks near the shore ─────────────────────────
export class Fireflies {
  constructor(n = 260) {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(n * 4);
    const rnd = mulberry32(444);
    for (let i = 0; i < n; i++) {
      seed[i * 4 + 0] = rnd(); seed[i * 4 + 1] = rnd();
      seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: GU.uTime,
      uCenter: { value: new THREE.Vector3(0, -116, -146) },
      uAlpha: { value: 0 },
      uPR: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime, uPR; uniform vec3 uCenter;
        attribute vec4 aSeed;
        varying float vG;
        ${NOISE_GLSL}
        void main(){
          float t = uTime * 0.14 * (0.6 + aSeed.w);
          vec3 base = vec3((aSeed.x - 0.5) * 52.0, aSeed.y * 9.0 + 0.5, (aSeed.z - 0.5) * 42.0);
          vec3 p = uCenter + base
            + vec3(noise3(vec3(t, aSeed.x * 9.0, 0.0)), noise3(vec3(0.0, t, aSeed.y * 9.0)), noise3(vec3(aSeed.z * 9.0, 0.0, t))) * 3.2;
          vG = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.4 + aSeed.w * 2.0) + aSeed.x * 40.0), 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.9 + aSeed.y) * uPR * 60.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying float vG;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 3.0) * vG * uAlpha;
          gl_FragColor = vec4(vec3(1.0, 0.85, 0.4) * a * 1.5, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
}
