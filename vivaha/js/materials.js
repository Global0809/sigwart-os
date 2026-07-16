// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — material library
// Every surface in the experience is shaded procedurally. No image textures
// exist anywhere except canvases we paint ourselves at boot.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { PALETTE } from './config.js';

// ── global uniforms — one object, referenced by every material ──────────────
export const GU = {
  uTime:       { value: 0 },
  uCursor:     { value: new THREE.Vector2(0, 0) },      // -1..1 smoothed
  uFogColor:   { value: new THREE.Color(PALETTE.void) },
  uFogDensity: { value: 0.016 },
  uSunDir:     { value: new THREE.Vector3(0.2, 0.85, -0.5).normalize() },
  uMoonPos:    { value: new THREE.Vector3(0, -100, -190) },
  uWarmth:     { value: 0 },                            // 0 = cold void → 1 = dusk rose
};

export const C = (hex) => new THREE.Color(hex);

// ── shared GLSL chunks ──────────────────────────────────────────────────────
export const NOISE_GLSL = /* glsl */`
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(hash3(i+vec3(0,0,0)), f-vec3(0,0,0)), dot(hash3(i+vec3(1,0,0)), f-vec3(1,0,0)), u.x),
        mix(dot(hash3(i+vec3(0,1,0)), f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)), f-vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(hash3(i+vec3(0,0,1)), f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)), f-vec3(1,0,1)), u.x),
        mix(dot(hash3(i+vec3(0,1,1)), f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)), f-vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += a * noise3(p); p = p * 2.03 + vec3(7.3); a *= 0.5; }
  return v;
}
vec3 curl(vec3 p){
  const float e = 0.12;
  float nx1 = noise3(p + vec3(0, e, 0)), nx2 = noise3(p - vec3(0, e, 0));
  float ny1 = noise3(p + vec3(0, 0, e)), ny2 = noise3(p - vec3(0, 0, e));
  float nz1 = noise3(p + vec3(e, 0, 0)), nz2 = noise3(p - vec3(e, 0, 0));
  return normalize(vec3(nx1 - nx2, ny1 - ny2, nz1 - nz2) + 1e-5);
}
`;

export const FOG_GLSL = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 col, float dist){
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

// stylised gold: 2 art-directed keys + procedural environment bands + fresnel
export const GOLD_GLSL = /* glsl */`
vec3 goldShade(vec3 N, vec3 V, vec3 deep, vec3 base, vec3 hot, float t){
  vec3 L1 = normalize(vec3( 0.55, 0.75,  0.45));
  vec3 L2 = normalize(vec3(-0.65, 0.15, -0.35));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  vec3 col = deep + base * (d1 * 0.85 + d2 * 0.35);
  vec3 H1 = normalize(L1 + V);
  col += hot * pow(max(dot(N, H1), 0.0), 42.0) * 1.6;
  col += hot * pow(max(dot(N, normalize(L2 + V)), 0.0), 24.0) * 0.5;
  vec3 R = reflect(-V, N);
  float band = sin(R.y * 5.0 + t * 0.25) * 0.5 + sin(atan(R.z, R.x) * 3.0 - t * 0.17) * 0.5;
  float env = smoothstep(-0.35, 1.25, R.y * 0.85 + band * 0.22);
  col += mix(deep * 0.4, hot, env) * 0.5;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += hot * fres * 0.55;
  return col;
}
`;

const baseUniforms = () => ({
  uTime: GU.uTime, uCursor: GU.uCursor,
  uFogColor: GU.uFogColor, uFogDensity: GU.uFogDensity,
});

// ── carved / plain gold ─────────────────────────────────────────────────────
// engrave: 0 none · 1 ring grooves · 2 column flutes · 3 filigree noise
export function goldMaterial({ engrave = 0, emissive = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uDeep: { value: C(PALETTE.goldDeep) },
      uBase: { value: C(PALETTE.gold) },
      uHot:  { value: C(PALETTE.goldHot) },
      uEngrave: { value: engrave },
      uEmissive: { value: emissive },
      uReveal: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec2 vUv;
      void main(){
        vUv = uv;
        vP = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uDeep, uBase, uHot;
      uniform float uEngrave, uEmissive, uReveal;
      varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec2 vUv;
      ${NOISE_GLSL} ${FOG_GLSL} ${GOLD_GLSL}
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float groove = 0.0;
        if (uEngrave > 0.5 && uEngrave < 1.5) {
          groove = smoothstep(0.35, 0.5, abs(fract(vUv.x * 42.0) - 0.5)) * 0.5
                 + smoothstep(0.2, 0.5, abs(fract(vUv.y * 3.0) - 0.5)) * 0.25;
        } else if (uEngrave < 2.5 && uEngrave > 1.5) {
          groove = smoothstep(0.3, 0.5, abs(fract(vUv.x * 24.0) - 0.5)) * 0.6;
        } else if (uEngrave > 2.5) {
          groove = smoothstep(0.02, 0.14, abs(fbm(vP * 6.0))) * 0.55;
        }
        vec3 col = goldShade(N, V, uDeep, uBase, uHot, uTime) * (1.0 - groove * 0.75);
        // engraving glows faintly as it is revealed
        col += uHot * groove * uEmissive * (0.6 + 0.4 * sin(uTime * 1.7)) * uReveal;
        col = applyFog(col, length(cameraPosition - vW));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ── living marble with fake subsurface + gold inlay channel ────────────────
export function marbleMaterial({ warm = 0.35 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uTone:  { value: C(PALETTE.marble) },
      uVein:  { value: C(0xb9a98c) },
      uGoldHot: { value: C(PALETTE.goldHot) },
      uInlay: { value: 0 },     // 0..1 gold flows into the veins
      uWarm:  { value: warm },
      uGlow:  { value: new THREE.Vector3(0, -117, -151) }, // warm light source
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){
        vP = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uTone, uVein, uGoldHot, uGlow;
      uniform float uInlay, uWarm;
      varying vec3 vN; varying vec3 vW; varying vec3 vP;
      ${NOISE_GLSL} ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = normalize(vec3(0.4, 0.8, 0.45));
        // wrap diffuse ≈ subsurface softness
        float wrap = clamp((dot(N, L) + 0.6) / 1.6, 0.0, 1.0);
        float veins = abs(fbm(vP * vec3(0.9, 1.7, 0.9) + 3.7));
        float veinLine = smoothstep(0.11, 0.015, veins);
        vec3 col = uTone * (0.42 + 0.58 * wrap);
        col = mix(col, uVein, veinLine * 0.5);
        // warm interior glow — light bleeding through stone near the source
        float bleed = exp(-length(vW - uGlow) * 0.055) * uWarm;
        col += vec3(1.0, 0.55, 0.3) * bleed * (0.55 + 0.15 * sin(uTime * 1.3));
        // molten gold creeping through the veins
        col += uGoldHot * veinLine * uInlay * (1.4 + 0.5 * sin(uTime * 2.1 + vP.y * 3.0));
        col += uGoldHot * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.12;
        col = applyFog(col, length(cameraPosition - vW));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ── the sky: one huge inverted sphere, graded per chapter ───────────────────
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: GU.uTime,
      uWarmth: GU.uWarmth,
      uSunDir: GU.uSunDir,
      uTop:    { value: C(PALETTE.void) },
      uMid:    { value: C(PALETTE.nightBlue) },
      uBot:    { value: C(0x120818) },
      uStars:  { value: 0 },
      uNebula: { value: 0 },
      uMoon:   { value: 0 },
      uMoonDirV: { value: new THREE.Vector3(0, 0.12, -1).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 w = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
        gl_Position.z = gl_Position.w; // pin to far plane
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uStars, uNebula, uMoon, uWarmth;
      uniform vec3 uTop, uMid, uBot, uSunDir, uMoonDirV;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y * 0.5 + 0.5;
        vec3 col = mix(uBot, uMid, smoothstep(0.0, 0.45, h));
        col = mix(col, uTop, smoothstep(0.42, 1.0, h));
        // nebula — slow sacred smoke across the celestial court
        if (uNebula > 0.001) {
          float n = fbm(d * 3.1 + vec3(0.0, uTime * 0.008, uTime * 0.012));
          float n2 = fbm(d * 7.0 - vec3(uTime * 0.01, 0.0, 0.0));
          vec3 neb = mix(vec3(0.10, 0.03, 0.16), vec3(0.35, 0.12, 0.10), smoothstep(-0.2, 0.5, n2));
          col += neb * smoothstep(0.05, 0.6, n) * uNebula;
        }
        // stars
        if (uStars > 0.001) {
          vec3 sp = d * 300.0;
          vec3 cell = floor(sp);
          float star = smoothstep(0.985, 1.0, 1.0 - length(fract(sp) - 0.5 - hash3(cell).xy * 0.35 * vec3(1,1,0).xy).x);
          float tw = hash1(cell.xy + cell.z);
          star = smoothstep(0.75, 1.0, tw) * pow(max(0.0, 1.0 - length(fract(sp) - 0.5) * 2.2), 6.0);
          col += vec3(0.9, 0.95, 1.0) * star * uStars * (0.55 + 0.45 * sin(uTime * (1.0 + tw * 3.0) + tw * 40.0));
        }
        // sun — the flame grown cosmic
        float sunD = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.72, 0.38) * pow(sunD, 260.0) * 3.2;
        col += vec3(1.0, 0.55, 0.25) * pow(sunD, 24.0) * 0.5;
        // dusk warmth rises from the horizon in the final act
        col = mix(col, mix(vec3(0.23, 0.05, 0.14), vec3(0.75, 0.26, 0.16), pow(1.0 - abs(d.y), 3.0)), uWarmth * smoothstep(0.6, -0.25, d.y) * 0.9);
        col += vec3(0.9, 0.4, 0.2) * pow(max(0.0, 1.0 - abs(d.y + 0.04) * 4.0), 3.0) * uWarmth * 0.35;
        // moon
        if (uMoon > 0.001) {
          float m = max(dot(d, normalize(uMoonDirV)), 0.0);
          col += vec3(1.0, 0.93, 0.78) * pow(m, 3200.0) * 2.6 * uMoon;
          col += vec3(1.0, 0.85, 0.6) * pow(m, 90.0) * 0.55 * uMoon;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ── lake water — ripples, moon-road, diya glows ─────────────────────────────
export function waterMaterial() {
  const glows = [];
  for (let i = 0; i < 10; i++) glows.push(new THREE.Vector4(0, 0, 0, 0)); // xz, radius, intensity
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      ...baseUniforms(),
      uWarmth: GU.uWarmth,
      uMoonPos: GU.uMoonPos,
      uDeep:  { value: C(0x07030d) },
      uShal:  { value: C(0x1a0f2a) },
      uGlows: { value: glows },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha, uWarmth;
      uniform vec3 uDeep, uShal, uMoonPos;
      uniform vec4 uGlows[10];
      varying vec3 vW; varying vec2 vUv;
      ${NOISE_GLSL} ${FOG_GLSL}
      void main(){
        vec2 p = vW.xz * 0.12;
        // two drifting ripple fields → perturbed normal
        float r1 = fbm(vec3(p * 1.6, uTime * 0.11));
        float r2 = fbm(vec3(p * 3.4 + 13.7, uTime * 0.17));
        vec3 N = normalize(vec3(r1 * 0.7 + r2 * 0.4, 1.0, r1 * 0.5 - r2 * 0.55));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uDeep, uShal, fres * 0.8);
        // moon-road: long glint stretching toward the camera
        vec3 mDir = normalize(uMoonPos - vW);
        vec3 R = reflect(-V, N);
        float glint = pow(max(dot(R, mDir), 0.0), 140.0);
        float road = exp(-abs(vW.x - uMoonPos.x * 0.2) * 0.05);
        col += vec3(1.0, 0.87, 0.62) * glint * (1.2 + road) * (0.7 + uWarmth);
        // sparkle
        float sp = smoothstep(0.965, 1.0, noise3(vec3(vW.xz * 2.1, uTime * 0.55)));
        col += vec3(1.0, 0.8, 0.5) * sp * 0.6 * (0.4 + uWarmth);
        // floating diya glows
        for (int i = 0; i < 10; i++) {
          vec4 g = uGlows[i];
          if (g.w > 0.001) {
            float d = length(vW.xz - g.xy);
            col += vec3(1.0, 0.52, 0.2) * exp(-d * d / (g.z * g.z)) * g.w
                   * (0.8 + 0.2 * sin(uTime * 3.0 + g.x));
          }
        }
        col = applyFog(col, length(cameraPosition - vW));
        gl_FragColor = vec4(col, uAlpha);
      }`,
  });
}

// ── silk — waving, sheened, translucent ─────────────────────────────────────
export function fabricMaterial(colA = 0xb01e3c, colB = 0xf2b23c) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      ...baseUniforms(),
      uColA: { value: C(colA) }, uColB: { value: C(colB) },
      uWave: { value: 1 }, uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uWave;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${NOISE_GLSL}
      void main(){
        vUv = uv;
        vec3 pos = position;
        float sway = noise3(vec3(uv * 2.4, uTime * 0.32));
        float hem = smoothstep(0.15, 1.0, uv.y); // free edge moves most
        pos.z += (sin(uv.x * 6.3 + uTime * 0.9) * 0.16 + sway * 0.55) * hem * uWave;
        pos.x += sway * 0.22 * hem * uWave;
        vec4 w = modelMatrix * vec4(pos, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha;
      uniform vec3 uColA, uColB;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float ndv = abs(dot(N, V));
        vec3 col = mix(uColA * 0.55, uColA, ndv);
        // anisotropic silk sheen band
        float sheen = pow(abs(sin(vUv.y * 3.1416 * 2.0 + uTime * 0.4)), 24.0);
        col += uColB * sheen * 0.7;
        col += uColB * pow(1.0 - ndv, 2.5) * 0.45; // backlit rim
        // zari border
        float border = smoothstep(0.045, 0.02, min(vUv.x, 1.0 - vUv.x)) + smoothstep(0.06, 0.03, vUv.y);
        col = mix(col, uColB * 1.2, clamp(border, 0.0, 1.0) * 0.8);
        col = applyFog(col, length(cameraPosition - vW));
        gl_FragColor = vec4(col, uAlpha);
      }`,
  });
}

// ── additive glow quad (halos, moons, light pools) ──────────────────────────
export function glowMaterial(color = PALETTE.goldHot, power = 2.4) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: GU.uTime,
      uColor: { value: C(color) },
      uPower: { value: power },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uPower, uAlpha, uTime;
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float g = pow(max(0.0, 1.0 - d), uPower);
        gl_FragColor = vec4(uColor * g * uAlpha, g * uAlpha);
      }`,
  });
}

// ── volumetric shaft — additive cone/plane with drifting dust ───────────────
export function rayMaterial(color = 0xffd9a0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: GU.uTime, uColor: { value: C(color) }, uAlpha: { value: 0.5 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha; uniform vec3 uColor;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        float across = sin(vUv.x * 3.1416);
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        float dust = 0.75 + 0.25 * noise3(vec3(vUv * vec2(6.0, 20.0), uTime * 0.22));
        float a = across * across * along * dust * uAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

// ── living flame (diyas, the sealed flame) ──────────────────────────────────
export function flameMaterial(scale = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: GU.uTime, uSeed: { value: Math.random() * 100 }, uAlpha: { value: 1 }, uScale: { value: scale } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        // billboard
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz
               + right * position.x + up * position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uSeed, uAlpha;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv - vec2(0.5, 0.28);
        float flick = noise3(vec3(uSeed, uTime * 3.1, 0.0));
        p.x += noise3(vec3(vUv.y * 3.0, uTime * 2.2, uSeed)) * 0.10 * vUv.y;
        float body = 1.0 - smoothstep(0.0, 0.34 - vUv.y * 0.16 + flick * 0.02, length(p * vec2(1.55, 0.8)));
        float core = 1.0 - smoothstep(0.0, 0.13, length((vUv - vec2(0.5, 0.3)) * vec2(1.8, 1.1)));
        vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.92, 0.6), core);
        col = mix(col, vec3(0.9, 0.2, 0.35), smoothstep(0.5, 0.95, vUv.y)); // rose tip
        float a = clamp(body, 0.0, 1.0) * uAlpha * (0.85 + flick * 0.15);
        gl_FragColor = vec4(col * a * 1.8, a);
      }`,
  });
}

// ── glowing canvas art (carvings, murals, engraved captions) ───────────────
export function carvingMaterial(tex, { color = 0xffce7a, pulse = 0.25 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: GU.uTime,
      uMap: { value: tex },
      uColor: { value: C(color) },
      uReveal: { value: 0 },     // 0..1 wipes the illumination upward
      uPulse: { value: pulse },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uColor;
      uniform float uReveal, uTime, uPulse, uAlpha;
      varying vec2 vUv;
      void main(){
        vec4 art = texture2D(uMap, vUv);
        float wipe = smoothstep(vUv.y - 0.18, vUv.y + 0.05, uReveal * 1.25);
        float breathe = 1.0 + uPulse * sin(uTime * 1.4 + vUv.y * 4.0);
        vec3 col = uColor * art.rgb * wipe * breathe;
        float a = art.a * wipe * uAlpha;
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
  });
}
