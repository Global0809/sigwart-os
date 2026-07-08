// SIGWART_OS // gl/particles — ambient dust that REACTS to the cursor ray:
// wherever you point, motes along the sight-line ignite and drift aside.

import * as THREE from 'three';
import { scene } from './stage.mjs';
import { state, bus } from '../core.mjs';
import { world } from './world.mjs';

const uniforms = {
  uTime: { value: 0 },
  uPix: { value: 1 },
  uRayO: { value: new THREE.Vector3(0, 0, 999) },
  uRayD: { value: new THREE.Vector3(0, 0, -1) },
};
let dust = null;

const DUST_REGIONS = [
  // [cx, cy, cz, w, h, d, weight] — hangar intentionally clean
  [0, 4.5, -2, 26, 11, 14, 0.45],   // atrium
  [0, -16, 0, 10, 30, 10, 0.30],    // shaft
  [0, -59, -2, 22, 8, 12, 0.25],    // comms
];

function dustCount() { return state.tier >= 2 ? 800 : state.tier === 1 ? 300 : 110; }

export function initParticles() {
  const count = dustCount();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const sz = new Float32Array(count);
  let idx = 0;
  const totalW = DUST_REGIONS.reduce((a, r) => a + r[6], 0);
  for (const r of DUST_REGIONS) {
    const n = Math.round(count * (r[6] / totalW));
    for (let i = 0; i < n && idx < count; i++, idx++) {
      pos[idx * 3 + 0] = r[0] + (Math.random() - 0.5) * r[3];
      pos[idx * 3 + 1] = r[1] + (Math.random() - 0.5) * r[4];
      pos[idx * 3 + 2] = r[2] + (Math.random() - 0.5) * r[5];
      seed[idx] = Math.random() * 100;
      sz[idx] = 1.25 * (0.55 + Math.random() * 0.9);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPix;
      uniform vec3 uRayO;
      uniform vec3 uRayD;
      varying float vFade;
      varying float vHot;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.11 + aSeed * 17.0) * 0.55;
        p.y += sin(uTime * 0.09 + aSeed * 29.0) * 0.4;
        p.z += sin(uTime * 0.13 + aSeed * 7.0) * 0.55;

        // cursor sight-line: motes near the ray glow and get nudged aside
        vec3 rel = p - uRayO;
        float along = dot(rel, uRayD);
        float m = 0.0;
        if (along > 0.5) {
          float dRay = length(rel - uRayD * along);
          m = exp(-dRay * 0.9);
          vec3 perp = rel - uRayD * along;
          p += normalize(perp + vec3(1e-4)) * m * 0.6;
        }
        vHot = m;
        vFade = (0.6 + 0.4 * sin(uTime * 0.7 + aSeed * 3.0)) * (1.0 + m * 2.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * uPix * (130.0 / -mv.z) * (1.0 + m * 1.2), 0.6, 8.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vFade;
      varying float vHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        vec3 col = mix(vec3(0.66, 0.56, 0.91), vec3(1.0, 0.8, 1.3), clamp(vHot, 0.0, 1.0));
        float a = smoothstep(0.5, 0.08, d) * 0.26 * vFade;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  dust = new THREE.Points(geo, mat);
  scene.add(dust);

  uniforms.uPix.value = Math.min(window.devicePixelRatio || 1, 2);

  bus.on('tier:change', (t) => {
    if (dust) dust.material.uniforms.uPix.value = Math.min(window.devicePixelRatio || 1, t >= 2 ? 2 : 1.5);
  });
}

export function tickParticles(dt, t) {
  uniforms.uTime.value = t;
  if (world.rayO) {
    uniforms.uRayO.value.copy(world.rayO);
    uniforms.uRayD.value.copy(world.rayD);
  }
}
