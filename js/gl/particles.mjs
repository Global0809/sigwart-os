// SIGWART_OS // gl/particles — dust motes + hangar embers, 100% GPU-drifted (zero per-frame CPU)

import * as THREE from 'three';
import { scene } from './stage.mjs';
import { state, bus } from '../core.mjs';

const uniforms = { uTime: { value: 0 }, uPix: { value: 1 } };
let dust = null;
let embers = null;

const DUST_REGIONS = [
  // [cx, cy, cz, w, h, d, weight]
  [0, 4.5, -2, 26, 11, 14, 0.32],   // atrium
  [0, -16, 0, 10, 30, 10, 0.20],    // shaft
  [0, -40, -3, 32, 8, 14, 0.32],    // hangar
  [0, -59, -2, 22, 8, 12, 0.16],    // comms
];

function dustCount() { return state.tier >= 2 ? 900 : state.tier === 1 ? 320 : 110; }
function emberCount() { return state.tier >= 2 ? 200 : state.tier === 1 ? 60 : 0; }

function buildPoints(count, regions, { color, size, opacity, rise }) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const sz = new Float32Array(count);
  let idx = 0;
  const totalW = regions.reduce((a, r) => a + r[6], 0);
  for (const r of regions) {
    const n = Math.round(count * (r[6] / totalW));
    for (let i = 0; i < n && idx < count; i++, idx++) {
      pos[idx * 3 + 0] = r[0] + (Math.random() - 0.5) * r[3];
      pos[idx * 3 + 1] = r[1] + (Math.random() - 0.5) * r[4];
      pos[idx * 3 + 2] = r[2] + (Math.random() - 0.5) * r[5];
      seed[idx] = Math.random() * 100;
      sz[idx] = size * (0.55 + Math.random() * 0.9);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uPix: uniforms.uPix,
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uRise: { value: rise },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPix;
      uniform float uRise;
      varying float vFade;
      void main() {
        vec3 p = position;
        float riseOn = step(0.001, uRise);
        p.x += sin(uTime * 0.11 + aSeed * 17.0) * 0.55;
        p.y += sin(uTime * 0.09 + aSeed * 29.0) * 0.4 + riseOn * (mod(uTime * uRise + aSeed * 7.0, 5.0) - 2.5);
        p.z += sin(uTime * 0.13 + aSeed * 7.0) * 0.55;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * uPix * (130.0 / -mv.z), 0.6, 6.0);
        vFade = 0.6 + 0.4 * sin(uTime * 0.7 + aSeed * 3.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d) * uOpacity * vFade;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  return new THREE.Points(geo, mat);
}

export function initParticles() {
  dust = buildPoints(dustCount(), DUST_REGIONS, {
    color: 0xa98fe8, size: 1.25, opacity: 0.26, rise: 0,
  });
  scene.add(dust);

  const ec = emberCount();
  if (ec > 0) {
    embers = buildPoints(ec, [[0, -41.5, -3, 30, 6, 12, 1]], {
      color: 0xd9a8ff, size: 2.4, opacity: 0.5, rise: 0.22,
    });
    scene.add(embers);
  }

  uniforms.uPix.value = Math.min(window.devicePixelRatio || 1, 2);

  bus.on('tier:change', (t) => {
    if (embers) embers.visible = t >= 1;
    if (dust) dust.material.uniforms.uOpacity.value = t >= 2 ? 0.34 : 0.24;
  });
}

export function tickParticles(dt, t) {
  uniforms.uTime.value = t;
}
