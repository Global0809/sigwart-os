// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — math, easing, PRNG, canvas helpers
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// progress of p within [a,b], clamped 0..1
export const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
// bell curve: 0 at a and c, 1 at b
export const bell = (p, a, b, c) => p < b ? seg(p, a, b) : 1 - seg(p, b, c);

export const easeInCubic = (t) => t * t * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeInExpo = (t) => t <= 0 ? 0 : Math.pow(2, 10 * t - 10);
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};

// deterministic PRNG — the world must assemble the same way for every guest
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

export function canvasTexture(canvas, { srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Sample n points from the opaque pixels of text drawn to an offscreen canvas.
// Returns Float32Array of xyz in a plane of given world width, centred at 0.
export function textPoints(text, { font = '600 180px serif', n = 8000, worldW = 30, jitter = 0.12, seed = 7 } = {}) {
  const W = 1024, H = 320;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);
  const data = ctx.getImageData(0, 0, W, H).data;
  const candidates = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4] > 100) candidates.push(x, y);
    }
  }
  const rnd = mulberry32(seed);
  const out = new Float32Array(n * 3);
  const scale = worldW / W;
  const m = candidates.length / 2;
  for (let i = 0; i < n; i++) {
    if (m === 0) break;
    const k = (rnd() * m) | 0;
    const x = candidates[k * 2], y = candidates[k * 2 + 1];
    out[i * 3 + 0] = (x - W / 2) * scale + (rnd() - 0.5) * jitter;
    out[i * 3 + 1] = -(y - H / 2) * scale + (rnd() - 0.5) * jitter;
    out[i * 3 + 2] = (rnd() - 0.5) * jitter * 6;
  }
  return out;
}

// Await webfonts so canvas-drawn typography uses the real faces.
export async function loadFonts(specs) {
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s, 'ॐ शुभ Aa')));
  } catch { /* canvas falls back to system serif — acceptable */ }
}

export const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
