// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — Act II · Wonder
// The burst becomes a mandala gate. Beyond it, arches rise out of mist,
// Ganesha is invoked in light, a dome assembles itself overhead, and the
// sky turns out to be a temple too.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import {
  GU, C, NOISE_GLSL, goldMaterial, marbleMaterial, skyMaterial,
  glowMaterial, rayMaterial, carvingMaterial, fabricMaterial,
} from './materials.js';
import { mandalaDisc, ganeshaMedallion, omMedallion, divineMural, textPlate } from './art.js';
import { canvasTexture, seg, bell, lerp, clamp, easeOutCubic, easeOutBack, mulberry32 } from './utils.js';
import { PALETTE } from './config.js';

const SHAFT = new THREE.Vector3(0, 0, -75);   // ascent axis
const COURT_Y = 108;                          // dome centre height

export class ActTwo {
  constructor() {
    this.group = new THREE.Group();
    this._buildSky();
    this._buildClouds();
    this._buildBirds();
    this._buildGate();
    this._buildShaft();
    this._buildCourt();
  }

  // ── sky ────────────────────────────────────────────────────────────────────
  _buildSky() {
    this.skyMat = skyMaterial();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 32), this.skyMat);
    sky.position.set(0, 0, -75);
    sky.frustumCulled = false;
    this.group.add(sky);
    // fixed moon direction, as seen from the pavilion
    this.skyMat.uniforms.uMoonDirV.value.set(0, 0.42, -0.72).normalize();
  }

  // ── clouds: instanced fbm billboards on three decks ────────────────────────
  _buildClouds() {
    const N = 34;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.attributes = quad.attributes;
    const aPos = new Float32Array(N * 3);
    const aSeed = new Float32Array(N * 4);
    const rnd = mulberry32(2211);
    for (let i = 0; i < N; i++) {
      const deck = i < 14 ? 0 : i < 26 ? 1 : 2;
      const th = rnd() * Math.PI * 2;
      const R = deck === 0 ? 46 + rnd() * 40 : deck === 1 ? 30 + rnd() * 55 : 60 + rnd() * 80;
      aPos[i * 3 + 0] = Math.cos(th) * R;
      aPos[i * 3 + 1] = deck === 0 ? 92 + rnd() * 30 : deck === 1 ? 34 + rnd() * 14 : -102 + rnd() * 16;
      aPos[i * 3 + 2] = -75 + Math.sin(th) * R;
      aSeed[i * 4 + 0] = rnd(); aSeed[i * 4 + 1] = rnd();
      aSeed[i * 4 + 2] = rnd(); aSeed[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 4));
    geo.instanceCount = N;
    this.cloudU = {
      uTime: GU.uTime, uWarm: GU.uWarmth,
      uAlpha: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: this.cloudU,
      vertexShader: /* glsl */`
        uniform float uTime;
        attribute vec3 aPos; attribute vec4 aSeed;
        varying vec2 vUv; varying vec4 vSeed;
        void main(){
          vUv = uv; vSeed = aSeed;
          float s = 16.0 + aSeed.y * 26.0;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = aPos;
          p.x += sin(uTime * 0.016 + aSeed.x * 6.28) * 6.0 + uTime * 0.14 * (aSeed.z - 0.5);
          p += right * position.x * s * 1.9 + up * position.y * s * 0.62;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uAlpha, uWarm;
        varying vec2 vUv; varying vec4 vSeed;
        ${NOISE_GLSL}
        void main(){
          vec2 q = vUv - 0.5;
          float r = length(q * vec2(2.0, 3.4));
          float puff = fbm(vec3(vUv * vec2(3.0, 5.0) + vSeed.xy * 19.0, uTime * 0.03 + vSeed.z * 4.0));
          float a = smoothstep(1.0, 0.25, r + puff * 0.55) * 0.5;
          vec3 cold = vec3(0.10, 0.09, 0.19);
          vec3 warm = vec3(0.42, 0.16, 0.15);
          vec3 col = mix(cold, warm, uWarm) * (0.9 + puff * 0.6);
          col += vec3(1.0, 0.72, 0.42) * pow(max(0.0, 1.0 - vUv.y), 2.0) * 0.22 * (0.4 + uWarm);
          gl_FragColor = vec4(col, a * uAlpha);
        }`,
    });
    this.clouds = new THREE.Mesh(geo, mat);
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
  }

  // ── distant birds crossing the sky ─────────────────────────────────────────
  _buildBirds() {
    const N = 16;
    const quad = new THREE.PlaneGeometry(1.7, 0.5, 2, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.attributes = quad.attributes;
    const aSeed = new Float32Array(N * 4);
    const rnd = mulberry32(919);
    for (let i = 0; i < N; i++) {
      aSeed[i * 4 + 0] = rnd(); aSeed[i * 4 + 1] = rnd();
      aSeed[i * 4 + 2] = rnd(); aSeed[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 4));
    geo.instanceCount = N;
    this.birdU = { uTime: GU.uTime, uAlpha: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: this.birdU,
      vertexShader: /* glsl */`
        uniform float uTime;
        attribute vec4 aSeed;
        varying float vA;
        void main(){
          float ang = aSeed.x * 6.283 + uTime * 0.026 * (0.6 + aSeed.y * 0.8);
          float R = 44.0 + aSeed.z * 34.0;
          vec3 center = vec3(cos(ang) * R, 88.0 + aSeed.w * 26.0 + sin(uTime * 0.2 + aSeed.x * 9.0) * 2.0, -75.0 + sin(ang) * R);
          // flap
          vec3 v = position;
          v.y += pow(abs(position.x), 1.4) * sin(uTime * (5.0 + aSeed.y * 3.0) + aSeed.x * 40.0) * 0.55;
          // face flight direction (tangent)
          float hd = ang + 1.5708;
          mat3 Ry = mat3(cos(hd), 0.0, sin(hd),  0.0, 1.0, 0.0,  -sin(hd), 0.0, cos(hd));
          v = Ry * v;
          vA = 0.5 + aSeed.w * 0.5;
          gl_Position = projectionMatrix * viewMatrix * vec4(center + v, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uAlpha;
        varying float vA;
        void main(){
          gl_FragColor = vec4(vec3(0.02, 0.015, 0.03), uAlpha * vA * 0.85);
        }`,
    });
    this.birds = new THREE.Mesh(geo, mat);
    this.birds.frustumCulled = false;
    this.group.add(this.birds);
  }

  // ── the mandala gate ───────────────────────────────────────────────────────
  _buildGate() {
    this.gate = new THREE.Group();
    this.gate.position.set(0, 0, -38);
    this.gateRings = [];
    const specs = [
      { r: 4.6, tube: 0.30 }, { r: 8.2, tube: 0.36 }, { r: 11.8, tube: 0.42 },
    ];
    specs.forEach((s, i) => {
      const m = goldMaterial({ engrave: 3, emissive: 0.9 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, s.tube, 20, 160), m);
      this.gate.add(ring);
      this.gateRings.push(ring);
    });
    // hand-painted filigree between the metal rings
    this.gateDisc = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 13.4, 128, 4),
      carvingMaterial(canvasTexture(mandalaDisc()), { color: 0xffce7a, pulse: 0.18 }),
    );
    this.gate.add(this.gateDisc);
    // 24 outer spokes
    this.gateSpokes = [];
    const spokeGeo = new THREE.BoxGeometry(0.14, 3.6, 0.14);
    const spokeMat = goldMaterial({ engrave: 0 });
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Mesh(spokeGeo, spokeMat);
      const a = (i / 24) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 14.6, Math.sin(a) * 14.6, 0);
      sp.rotation.z = a - Math.PI / 2;
      this.gate.add(sp);
      this.gateSpokes.push(sp);
    }
    this.gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), glowMaterial(0xd88a2a, 3.2));
    this.gateGlow.position.z = -4;
    this.gate.add(this.gateGlow);
    this.group.add(this.gate);
  }

  // ── the ascent: a helix of arches around the rising camera ────────────────
  _buildShaft() {
    this.shaft = new THREE.Group();
    this.shaft.position.copy(SHAFT);
    // cusped arch profile, extruded
    const shape = new THREE.Shape();
    shape.moveTo(-2.5, 0); shape.lineTo(-2.5, 7.4); shape.lineTo(2.5, 7.4); shape.lineTo(2.5, 0);
    const hole = new THREE.Path();
    hole.moveTo(1.7, 0);
    hole.lineTo(1.7, 3.4);
    // five-lobed cusped arch
    hole.absarc(1.06, 3.6, 0.66, -0.35, Math.PI * 0.62, false);
    hole.absarc(0.0, 4.75, 0.9, -Math.PI * 0.42, Math.PI + Math.PI * 0.42, false);
    hole.absarc(-1.06, 3.6, 0.66, Math.PI - Math.PI * 0.62, Math.PI + 0.35, false);
    hole.lineTo(-1.7, 0);
    hole.closePath();
    shape.holes.push(hole);
    const archGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 24 });
    archGeo.translate(0, 0, -0.35);
    const archMat = marbleMaterial({ warm: 0.12 });
    this.arches = [];
    for (let i = 0; i < 14; i++) {
      const arch = new THREE.Mesh(archGeo, archMat);
      const a = i * 0.62;
      const R = 15;
      arch.position.set(Math.cos(a) * R, -4 + i * 6.6, Math.sin(a) * R);
      arch.rotation.y = -a + Math.PI / 2;
      arch.userData.baseY = arch.position.y;
      this.shaft.add(arch);
      this.arches.push(arch);
    }
    // drifting gold halos in the shaft
    this.shaftRings = [];
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2 + i * 0.7, 0.06, 10, 80),
        goldMaterial({ engrave: 1, emissive: 0.7 }),
      );
      ring.position.set((i % 2 ? 6 : -7) + i, 8 + i * 15, (i % 3) * 4 - 4);
      ring.rotation.x = Math.PI / 2;
      ring.userData.spin = 0.1 + i * 0.04;
      this.shaft.add(ring);
      this.shaftRings.push(ring);
    }

    // ── श्री गणेशाय नमः — the invocation ──
    this.ganesha = new THREE.Group();
    this.ganesha.position.set(0, 34, -13.5);
    this.ganeshaMat = carvingMaterial(canvasTexture(ganeshaMedallion()), { color: 0xffce7a, pulse: 0.12 });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 9.4), this.ganeshaMat);
    this.ganesha.add(disc);
    this.ganeshaHalo = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), glowMaterial(0xc07a2a, 3.0));
    this.ganeshaHalo.position.z = -0.5;
    this.ganesha.add(this.ganeshaHalo);
    this.ganeshaCaption = carvingMaterial(
      canvasTexture(textPlate('श्री गणेशाय नमः', { sub: 'FIRST, THE REMOVER OF OBSTACLES' })),
      { color: 0xffd9a0, pulse: 0.06 },
    );
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), this.ganeshaCaption);
    cap.position.y = -6.1;
    this.ganesha.add(cap);
    this.shaft.add(this.ganesha);

    // light from above
    this.shaftRays = [];
    for (let i = 0; i < 3; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(7, 46), rayMaterial(0xffd9a0));
      ray.position.set(Math.sin(i * 2.1) * 3, 44, Math.cos(i * 2.1) * 3);
      ray.rotation.y = i * 1.05;
      this.shaft.add(ray);
      this.shaftRays.push(ray);
    }
    this.group.add(this.shaft);
  }

  // ── the celestial court ────────────────────────────────────────────────────
  _buildCourt() {
    this.court = new THREE.Group();
    this.court.position.set(0, COURT_Y, -75);

    // dome interior — marble, revealed rim → apex
    this.domeMat = marbleMaterial({ warm: 0.08 });
    this.domeMat.side = THREE.BackSide;
    this.domeMat.transparent = true;
    this.domeMat.uniforms.uReveal = { value: 0 };
    this.domeMat.fragmentShader = this.domeMat.fragmentShader.replace(
      'gl_FragColor = vec4(col, 1.0);',
      /* glsl */`
        float rev = smoothstep(uRevealV - 0.14, uRevealV, 1.0 - (vP.y / 26.0));
        gl_FragColor = vec4(col, rev);`,
    ).replace(
      'uniform float uInlay, uWarm;',
      'uniform float uInlay, uWarm; uniform float uReveal; #define uRevealV uReveal',
    );
    const dome = new THREE.Mesh(new THREE.SphereGeometry(26, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    this.court.add(dome);

    // eight gold ribs that fly in and lock
    this.ribs = [];
    for (let i = 0; i < 8; i++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(26.1, 0.24, 12, 72, Math.PI),
        goldMaterial({ engrave: 1, emissive: 0.8 }),
      );
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 8) * Math.PI;
      pivot.add(rib);
      this.court.add(pivot);
      this.ribs.push({ pivot, rib, i });
    }
    // oculus ring at the apex
    this.oculus = new THREE.Mesh(
      new THREE.TorusGeometry(6.2, 0.34, 14, 80),
      goldMaterial({ engrave: 3, emissive: 1 }),
    );
    this.oculus.position.y = 25.2;
    this.oculus.rotation.x = Math.PI / 2;
    this.court.add(this.oculus);

    // ॐ — suspended beneath the oculus, read from below
    this.om = new THREE.Group();
    this.om.position.y = 18.5;
    this.omMat = carvingMaterial(canvasTexture(omMedallion()), { color: 0xffd98a, pulse: 0.2 });
    const omDisc = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 10.5), this.omMat);
    omDisc.rotation.x = Math.PI / 2;
    this.om.add(omDisc);
    this.omGlow = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), glowMaterial(0xffb84d, 2.6));
    this.omGlow.rotation.x = Math.PI / 2;
    this.omGlow.position.y = 1.2;
    this.om.add(this.omGlow);
    this.court.add(this.om);

    // four divine murals on floating shards
    this.murals = [];
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      holder.position.set(Math.cos(a) * 22.5, -3.5, Math.sin(a) * 22.5);
      holder.rotation.y = -a - Math.PI / 2;
      // stone shard backing
      const stone = new THREE.Mesh(new THREE.BoxGeometry(9.4, 15.6, 0.5), marbleMaterial({ warm: 0.1 }));
      holder.add(stone);
      const art = carvingMaterial(canvasTexture(divineMural(i + 1)), { color: 0xffce7a, pulse: 0.1 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 14.6), art);
      plane.position.z = 0.28;
      holder.add(plane);
      this.court.add(holder);
      this.murals.push({ holder, art, phase: i * 1.7, baseY: -3.5 });
    }

    // the wedding shloka, floating where the ascent opens out
    this.shlokaMat = carvingMaterial(
      canvasTexture(textPlate('मङ्गलं भगवान् विष्णुः मङ्गलं गरुडध्वजः', {
        w: 1600, h: 240, font: '600 72px "Noto Serif Devanagari", serif',
        sub: 'MAY ALL BE AUSPICIOUS FOR THIS UNION',
      })),
      { color: 0xffe0a8, pulse: 0.08 },
    );
    this.shloka = new THREE.Mesh(new THREE.PlaneGeometry(21, 3.15), this.shlokaMat);
    this.shloka.position.set(0, -9, 13);
    this.court.add(this.shloka);

    // three drifting lotus islands
    this.islands = [];
    for (let i = 0; i < 3; i++) {
      const isle = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 1.2, 24), marbleMaterial({ warm: 0.1 }));
      isle.add(plinth);
      const lotus = new THREE.Group();
      lotus.position.y = 0.8;
      const petalGeo = new THREE.PlaneGeometry(0.9, 1.7, 4, 6);
      const pp = petalGeo.attributes.position;
      for (let v = 0; v < pp.count; v++) {
        const y = pp.getY(v), x = pp.getX(v);
        pp.setZ(v, Math.sin((y + 0.85) / 1.7 * Math.PI) * 0.34 - x * x * 0.35);
      }
      petalGeo.computeVertexNormals();
      const petalMat = fabricMaterial(0xe86a8a, 0xffd98a);
      petalMat.uniforms.uWave.value = 0.12;
      for (let ring = 0; ring < 2; ring++) {
        for (let k = 0; k < 8; k++) {
          const petal = new THREE.Mesh(petalGeo, petalMat);
          const a = (k / 8) * Math.PI * 2 + ring * 0.39;
          petal.position.set(Math.cos(a) * (0.34 + ring * 0.22), 0.55 + ring * 0.12, Math.sin(a) * (0.34 + ring * 0.22));
          petal.rotation.order = 'YXZ';
          petal.rotation.y = -a + Math.PI;
          petal.userData = { ring, a };
          lotus.add(petal);
        }
      }
      const heart = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMaterial(0xffb84d, 2.2));
      heart.position.y = 1.0;
      lotus.add(heart);
      isle.userData = { angle: (i / 3) * Math.PI * 2, r: 29 + i * 2, y: -6 + i * 3, heart, lotus };
      isle.add(lotus);
      this.court.add(isle);
      this.islands.push(isle);
    }

    // a great shaft of light falling through the oculus
    this.courtRay = new THREE.Mesh(new THREE.PlaneGeometry(11, 42), rayMaterial(0xffd9a0));
    this.courtRay.position.y = 2;
    const ray2 = this.courtRay.clone();
    ray2.rotation.y = Math.PI / 2;
    this.court.add(this.courtRay, ray2);
    this._courtRay2 = ray2;

    this.group.add(this.court);
  }

  // ── the whole act, driven by p ─────────────────────────────────────────────
  update(ctx) {
    const { p, t, camera } = ctx;

    // sky grading
    const u = this.skyMat.uniforms;
    u.uStars.value = lerp(0.12, 0.85, seg(p, 0.06, 0.3)) * lerp(1, 0.45, seg(p, 0.58, 0.72));
    u.uNebula.value = bell(p, 0.2, 0.42, 0.62);
    u.uMoon.value = seg(p, 0.6, 0.75);
    u.uTop.value.setHex(0x050208).lerp(C(0x1a0b2e), bell(p, 0.2, 0.4, 0.65));
    u.uMid.value.setHex(0x0b0a1e).lerp(C(0x3a1230), seg(p, 0.5, 0.72));
    u.uBot.value.setHex(0x120818).lerp(C(0x59203a), seg(p, 0.52, 0.75));

    // clouds & birds
    this.cloudU.uAlpha.value = bell(p, 0.24, 0.5, 0.8);
    this.clouds.visible = this.cloudU.uAlpha.value > 0.01;
    this.birdU.uAlpha.value = bell(p, 0.26, 0.4, 0.6);
    this.birds.visible = this.birdU.uAlpha.value > 0.01;

    // ── gate ──
    const gateIn = seg(p, 0.045, 0.125);
    const gateLife = p > 0.01 && p < 0.32;
    this.gate.visible = gateLife;
    if (gateLife) {
      this.gateRings.forEach((ring, i) => {
        const k = easeOutBack(seg(gateIn, i * 0.18, 0.62 + i * 0.18));
        ring.scale.setScalar(Math.max(0.001, k));
        ring.rotation.z = (1 - k) * (i % 2 ? 2.4 : -2.4) + t * (i % 2 ? 0.05 : -0.035);
        ring.material.uniforms.uReveal.value = k;
      });
      this.gateDisc.material.uniforms.uReveal.value = seg(gateIn, 0.35, 1);
      this.gateDisc.rotation.z = -t * 0.02;
      this.gateSpokes.forEach((sp, i) => {
        const k = easeOutCubic(seg(gateIn, 0.3 + (i % 8) * 0.05, 0.75 + (i % 8) * 0.05));
        sp.scale.setScalar(Math.max(0.001, k));
      });
      this.gateGlow.material.uniforms.uAlpha.value = 0.5 * gateIn * (1 - seg(p, 0.2, 0.3));
    }

    // ── shaft ──
    const shaftLife = p > 0.1 && p < 0.5;
    this.shaft.visible = shaftLife;
    if (shaftLife) {
      this.arches.forEach((arch, i) => {
        const k = easeOutCubic(seg(p, 0.125 + i * 0.011, 0.185 + i * 0.011));
        arch.position.y = arch.userData.baseY - (1 - k) * 13;
        arch.scale.y = 0.25 + 0.75 * k;
        const wobble = Math.sin(t * 0.4 + i * 1.3) * 0.02;
        arch.rotation.z = (1 - k) * 0.35 + wobble;
      });
      this.shaftRings.forEach((r) => {
        r.rotation.z += r.userData.spin * ctx.dt;
        r.position.y += Math.sin(t * 0.3 + r.userData.spin * 40) * 0.004;
      });
      const gRev = seg(p, 0.165, 0.225);
      this.ganeshaMat.uniforms.uReveal.value = gRev;
      this.ganeshaCaption.uniforms.uReveal.value = seg(p, 0.19, 0.24);
      this.ganeshaHalo.material.uniforms.uAlpha.value = gRev * 0.55 * bell(p, 0.16, 0.24, 0.34);
      this.ganesha.position.y = 34 + Math.sin(t * 0.5) * 0.35;
      const rayA = bell(p, 0.15, 0.26, 0.42) * 0.5;
      this.shaftRays.forEach((ray, i) => {
        ray.material.uniforms.uAlpha.value = rayA;
        ray.rotation.y += ctx.dt * 0.03 * (i + 1);
      });
      // the whole shaft slowly revolves — the world turns around the climber
      this.shaft.rotation.y = seg(p, 0.14, 0.34) * 0.9;
    }

    // ── court ──
    const courtLife = p > 0.22 && p < 0.68;
    this.court.visible = courtLife;
    if (courtLife) {
      const domeRev = seg(p, 0.27, 0.4);
      this.domeMat.uniforms.uReveal.value = domeRev;
      this.ribs.forEach(({ pivot, rib, i }) => {
        const k = easeOutBack(seg(p, 0.265 + i * 0.012, 0.345 + i * 0.012));
        rib.scale.setScalar(Math.max(0.001, k));
        rib.rotation.x = (1 - k) * 1.8;
        rib.material.uniforms.uReveal.value = k;
      });
      const ocK = easeOutBack(seg(p, 0.36, 0.42));
      this.oculus.scale.setScalar(Math.max(0.001, ocK));
      this.oculus.rotation.z = t * 0.05;

      const omRev = seg(p, 0.375, 0.44);
      this.omMat.uniforms.uReveal.value = omRev;
      this.om.rotation.y = t * 0.1;
      this.om.position.y = 18.5 + Math.sin(t * 0.7) * 0.5;
      this.omGlow.material.uniforms.uAlpha.value = omRev * 0.75;

      this.murals.forEach((m, i) => {
        m.art.uniforms.uReveal.value = seg(p, 0.3 + i * 0.022, 0.375 + i * 0.022);
        m.holder.position.y = m.baseY + Math.sin(t * 0.4 + m.phase) * 0.6;
      });

      this.shlokaMat.uniforms.uReveal.value = bell(p, 0.315, 0.37, 0.47);
      this.shloka.lookAt(camera.position);

      this.islands.forEach((isle, i) => {
        const ud = isle.userData;
        const a = ud.angle + t * 0.02 * (i % 2 ? 1 : -1);
        isle.position.set(Math.cos(a) * ud.r, ud.y + Math.sin(t * 0.35 + i * 2) * 0.9, Math.sin(a) * ud.r);
        // mechanical lotus bloom
        const open = seg(p, 0.3, 0.42);
        ud.lotus.children.forEach((petal) => {
          if (petal.userData.ring === undefined) return;
          const lean = lerp(0.12, petal.userData.ring ? 0.95 : 0.62, open)
            + Math.sin(t * 0.8 + petal.userData.a * 3) * 0.03;
          petal.rotation.x = -lean;
        });
        ud.heart.material.uniforms.uAlpha.value = open * 0.7;
        ud.heart.lookAt(camera.position);
      });

      const rayA = bell(p, 0.3, 0.45, 0.58) * 0.55;
      this.courtRay.material.uniforms.uAlpha.value = rayA;
      this.courtRay.rotation.y = t * 0.04;
      this._courtRay2.rotation.y = Math.PI / 2 + t * 0.04;

      // "wait — the room itself is turning": the court counter-rotates gently
      this.court.rotation.y = seg(p, 0.4, 0.52) * -0.7 + Math.sin(t * 0.05) * 0.02;
    }
  }
}
