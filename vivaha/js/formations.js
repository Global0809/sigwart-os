// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — particle formations
// One river of ~100k particles flows through the whole film. These are the
// shapes it takes. Each generator returns Float32Array(N*4): xyz + brightness.
// World anchors (must match the camera script in main.js):
//   orb (0,0,0) · gate (0,0,-38) · dome (0,108,-75) · nebula (0,140,-75)
//   text (0,-58,-95) · pavilion halo (0,-114,-149)
// ═══════════════════════════════════════════════════════════════════════════
import { mulberry32, textPoints } from './utils.js';

const TAU = Math.PI * 2;

// 0 — a shell of embers hugging the sleeping orb
export function orbShell(N) {
  const rnd = mulberry32(101);
  const out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    // fibonacci sphere + breathing noise
    const t = i / N;
    const phi = Math.acos(1 - 2 * t);
    const theta = TAU * i * 0.61803398875;
    const r = 1.55 + rnd() * 0.55 + (rnd() < 0.06 ? rnd() * 3.5 : 0); // few strays
    out[i * 4 + 0] = Math.sin(phi) * Math.cos(theta) * r;
    out[i * 4 + 1] = Math.cos(phi) * r;
    out[i * 4 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    out[i * 4 + 3] = 0.25 + rnd() * 0.5;
  }
  return out;
}

// 1 — the shatter: a violent shell expanding through the void
export function burst(N) {
  const rnd = mulberry32(202);
  const out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * TAU;
    const s = Math.sqrt(1 - u * u);
    const r = 3 + Math.pow(rnd(), 0.42) * 58; // dense core, long reach
    out[i * 4 + 0] = s * Math.cos(th) * r;
    out[i * 4 + 1] = u * r * 0.85;
    out[i * 4 + 2] = s * Math.sin(th) * r - r * 0.28; // biased toward the road ahead
    out[i * 4 + 3] = 0.5 + rnd() * 0.5;
  }
  return out;
}

// 2 — the mandala gate: nine carved rings, petals and spokes
export function gate(N) {
  const rnd = mulberry32(303);
  const out = new Float32Array(N * 4);
  const CX = 0, CY = 0, CZ = -38;
  for (let i = 0; i < N; i++) {
    const roll = rnd();
    let x, y, z, w;
    if (roll < 0.68) {
      // concentric petal rings
      const k = Math.floor(Math.pow(rnd(), 0.8) * 9);
      const baseR = 2.4 + k * 1.35;
      const petals = 8 + k * 3;
      const th = rnd() * TAU;
      const petal = Math.sin(th * petals) * (0.16 + k * 0.028);
      const scallop = Math.sin(th * petals * 2 + 1.3) * 0.08;
      const r = baseR + petal + scallop + (rnd() - 0.5) * 0.16;
      x = Math.cos(th) * r; y = Math.sin(th) * r;
      z = (k % 2 ? 0.7 : -0.7) + (rnd() - 0.5) * 0.5;
      w = 0.5 + 0.5 * (1 - k / 9) + rnd() * 0.2;
    } else if (roll < 0.86) {
      // 24 radial spokes
      const sp = Math.floor(rnd() * 24);
      const th = (sp / 24) * TAU + (rnd() - 0.5) * 0.012;
      const r = 2.2 + rnd() * 12.4;
      x = Math.cos(th) * r; y = Math.sin(th) * r;
      z = (rnd() - 0.5) * 0.6;
      w = 0.35 + rnd() * 0.3;
    } else if (roll < 0.96) {
      // inner bindu cluster
      const th = rnd() * TAU;
      const r = Math.pow(rnd(), 0.5) * 1.7;
      x = Math.cos(th) * r; y = Math.sin(th) * r;
      z = (rnd() - 0.5) * 0.8;
      w = 0.8 + rnd() * 0.2;
    } else {
      // filigree scatter between rings
      const th = rnd() * TAU;
      const r = 2 + rnd() * 13;
      x = Math.cos(th) * r; y = Math.sin(th) * r;
      z = (rnd() - 0.5) * 2.4;
      w = 0.18 + rnd() * 0.2;
    }
    out[i * 4 + 0] = CX + x; out[i * 4 + 1] = CY + y; out[i * 4 + 2] = CZ + z;
    out[i * 4 + 3] = w;
  }
  return out;
}

// 3 — a slow galaxy blooming above the dome's oculus
export function nebula(N) {
  const rnd = mulberry32(404);
  const out = new Float32Array(N * 4);
  const CX = 0, CY = 140, CZ = -75;
  const ARMS = 3;
  for (let i = 0; i < N; i++) {
    const arm = Math.floor(rnd() * ARMS);
    const t = Math.pow(rnd(), 0.6);
    const r = 4 + t * 44;
    const th = arm * (TAU / ARMS) + t * 4.4 + (rnd() - 0.5) * (0.5 + t * 0.8);
    const y = (rnd() - 0.5) * (1.5 + t * 6) * (rnd() < 0.5 ? 1 : 0.35);
    out[i * 4 + 0] = CX + Math.cos(th) * r;
    out[i * 4 + 1] = CY + y;
    out[i * 4 + 2] = CZ + Math.sin(th) * r;
    out[i * 4 + 3] = (1 - t) * 0.85 + rnd() * 0.15;
  }
  return out;
}

// 4 — "शुभ विवाह" written on the air, read from above during the dive
export function shubh(N) {
  const flat = textPoints('शुभ विवाह', {
    font: '600 168px "Noto Serif Devanagari", serif',
    n: N, worldW: 34, jitter: 0.16, seed: 505,
  });
  const rnd = mulberry32(505);
  const out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    // lay the plane flat (XZ), hovering over the descent path
    out[i * 4 + 0] = flat[i * 3 + 0];
    out[i * 4 + 1] = -58 + flat[i * 3 + 2] * 0.4;
    out[i * 4 + 2] = -95 - flat[i * 3 + 1];
    out[i * 4 + 3] = 0.6 + rnd() * 0.4;
  }
  return out;
}

// 5 — the pavilion halo: a ring of drifting lamplight around the final scene
export function halo(N) {
  const rnd = mulberry32(606);
  const out = new Float32Array(N * 4);
  const CX = 0, CY = -113, CZ = -149;
  for (let i = 0; i < N; i++) {
    const roll = rnd();
    if (roll < 0.8) {
      // flattened torus cloud
      const th = rnd() * TAU;
      const R = 15 + rnd() * 14;
      const y = (rnd() - 0.5) * 6.5 + Math.sin(th * 3 + R) * 1.2;
      out[i * 4 + 0] = CX + Math.cos(th) * R;
      out[i * 4 + 1] = CY + y * 0.6 + 2.5;
      out[i * 4 + 2] = CZ + Math.sin(th) * R;
    } else {
      // slow columns of rising light either side of the mandap
      const side = rnd() < 0.5 ? -1 : 1;
      out[i * 4 + 0] = CX + side * (9 + rnd() * 3) + (rnd() - 0.5) * 2;
      out[i * 4 + 1] = CY + rnd() * 16;
      out[i * 4 + 2] = CZ + (rnd() - 0.5) * 10;
    }
    out[i * 4 + 3] = 0.25 + rnd() * 0.55;
  }
  return out;
}

export const FORMATION_BUILDERS = [orbShell, burst, gate, nebula, shubh, halo];
export const FORMATION_NAMES = ['orbShell', 'burst', 'gate', 'nebula', 'shubh', 'halo'];
