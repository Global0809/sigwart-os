// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — cinema pass
// Hand-rolled composer: HDR scene → soft-knee bright pass → two-level blur
// pyramid → composite with volumetric god-rays, ACES tonemap, chapter grade,
// vignette, breathing grain and edge chromatic aberration.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function rt(w, h, opts = {}) {
  const t = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
    type: THREE.HalfFloatType,
    depthBuffer: opts.depth ?? false,
    samples: opts.samples ?? 0,
  });
  t.texture.minFilter = THREE.LinearFilter;
  t.texture.magFilter = THREE.LinearFilter;
  return t;
}

export class Post {
  constructor(renderer, { msaa = 4, rays = true } = {}) {
    this.renderer = renderer;
    this.raysEnabled = rays;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quadScene.add(this.quad);

    this.sceneRT = rt(4, 4, { depth: true, samples: msaa });
    this.brightRT = rt(4, 4);
    this.blurA = rt(4, 4); this.blurB = rt(4, 4);
    this.blur2A = rt(4, 4); this.blur2B = rt(4, 4);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThresh: { value: 0.72 }, uKnee: { value: 0.55 } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform float uThresh, uKnee;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tSrc, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float w = smoothstep(uThresh, uThresh + uKnee, l);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
    });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform vec2 uDir, uTexel;
        varying vec2 vUv;
        void main(){
          vec2 o = uDir * uTexel;
          vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
          s += (texture2D(tSrc, vUv + o * 1.3846).rgb + texture2D(tSrc, vUv - o * 1.3846).rgb) * 0.3162162;
          s += (texture2D(tSrc, vUv + o * 3.2308).rgb + texture2D(tSrc, vUv - o * 3.2308).rgb) * 0.0702703;
          gl_FragColor = vec4(s, 1.0);
        }`,
    });

    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
        uTime: { value: 0 },
        uBloom: { value: 1.0 },
        uSun: { value: new THREE.Vector2(0.5, 0.6) },   // sun in screen space
        uRays: { value: 0 },
        uVig: { value: 0.62 },
        uGrain: { value: 0.05 },
        uCA: { value: 0.55 },
        uWarm: { value: 0 },                            // dusk grade
        uFade: { value: 1 },                            // 1 = black veil
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene, tBloom1, tBloom2;
        uniform vec2 uSun, uRes;
        uniform float uTime, uBloom, uRays, uVig, uGrain, uCA, uWarm, uFade;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec3 aces(vec3 x){
          return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        }
        void main(){
          vec2 uv = vUv;
          vec2 fromC = uv - 0.5;
          float r2 = dot(fromC, fromC);
          // chromatic aberration, edges only
          vec2 caOff = fromC * r2 * uCA * 0.03;
          vec3 scene;
          scene.r = texture2D(tScene, uv - caOff).r;
          scene.g = texture2D(tScene, uv).g;
          scene.b = texture2D(tScene, uv + caOff).b;
          vec3 bloom = texture2D(tBloom1, uv).rgb * 0.65 + texture2D(tBloom2, uv).rgb * 0.85;
          vec3 col = scene + bloom * uBloom;
          // god rays — march the small bloom buffer toward the sun
          if (uRays > 0.001) {
            vec2 d = (uSun - uv) / 22.0;
            float illum = 1.0; vec3 ray = vec3(0.0);
            vec2 p = uv;
            for (int i = 0; i < 22; i++) {
              p += d;
              ray += texture2D(tBloom2, p).rgb * illum;
              illum *= 0.937;
            }
            float sunFall = smoothstep(0.9, 0.15, distance(uv, uSun));
            col += ray / 22.0 * uRays * 1.35 * sunFall * vec3(1.0, 0.86, 0.62);
          }
          // dusk grade: lift shadows rose, gild highlights
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          vec3 graded = col;
          graded += vec3(0.05, 0.012, 0.03) * (1.0 - smoothstep(0.0, 0.4, l)) * uWarm;
          graded *= mix(vec3(1.0), vec3(1.06, 0.97, 0.88), uWarm * smoothstep(0.3, 1.0, l));
          col = graded;
          col = aces(col);
          // vignette
          col *= 1.0 - uVig * smoothstep(0.18, 0.85, r2 * 1.9);
          // grain
          float g = hash(uv * uRes + fract(uTime) * 917.0);
          col += (g - 0.5) * uGrain * (0.4 + 0.6 * (1.0 - l));
          // gamma
          col = pow(max(col, 0.0), vec3(0.4545));
          col *= 1.0 - uFade;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }

  setSize(w, h, dpr) {
    const W = (w * dpr) | 0, H = (h * dpr) | 0;
    this.sceneRT.setSize(W, H);
    this.brightRT.setSize(W >> 1, H >> 1);
    this.blurA.setSize(W >> 1, H >> 1); this.blurB.setSize(W >> 1, H >> 1);
    this.blur2A.setSize(W >> 2, H >> 2); this.blur2B.setSize(W >> 2, H >> 2);
    this.compMat.uniforms.uRes.value.set(W, H);
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, t) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

    this.brightMat.uniforms.tSrc.value = this.sceneRT.texture;
    this._pass(this.brightMat, this.brightRT);

    const bu = this.blurMat.uniforms;
    bu.uTexel.value.set(1 / this.brightRT.width, 1 / this.brightRT.height);
    bu.tSrc.value = this.brightRT.texture; bu.uDir.value.set(1, 0);
    this._pass(this.blurMat, this.blurA);
    bu.tSrc.value = this.blurA.texture; bu.uDir.value.set(0, 1);
    this._pass(this.blurMat, this.blurB);

    bu.uTexel.value.set(1 / this.blur2A.width, 1 / this.blur2A.height);
    bu.tSrc.value = this.blurB.texture; bu.uDir.value.set(1, 0);
    this._pass(this.blurMat, this.blur2A);
    bu.tSrc.value = this.blur2A.texture; bu.uDir.value.set(0, 1);
    this._pass(this.blurMat, this.blur2B);

    const cu = this.compMat.uniforms;
    cu.tScene.value = this.sceneRT.texture;
    cu.tBloom1.value = this.blurB.texture;
    cu.tBloom2.value = this.blur2B.texture;
    cu.uTime.value = t;
    if (!this.raysEnabled) cu.uRays.value = 0;
    this._pass(this.compMat, null);
  }
}
