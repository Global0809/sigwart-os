// SIGWART_OS // core — event bus, state store, single RAF loop, math utils

/* ---------- event bus ---------- */
const handlers = new Map();
export const bus = {
  on(evt, fn) {
    if (!handlers.has(evt)) handlers.set(evt, new Set());
    handlers.get(evt).add(fn);
    return () => bus.off(evt, fn);
  },
  off(evt, fn) {
    const s = handlers.get(evt);
    if (s) s.delete(fn);
  },
  emit(evt, data) {
    const s = handlers.get(evt);
    if (s) for (const fn of [...s]) fn(data);
  },
};

/* ---------- state store ---------- */
export const state = {
  phase: 'boot-idle',     // boot-idle → boot-run → reveal → active
  tier: 2,                // 0 | 1 | 2 (render quality)
  touch: false,
  fine: true,
  motionOK: true,
  debug: false,
  xray: false,
  muted: false,
  crt: false,
  secretBay: false,
  room: 'gate',
  scrollVel: 0,
};

export function setPhase(p) {
  state.phase = p;
  document.body.dataset.state = p;
  bus.emit('phase', p);
}

/* ---------- single RAF loop (priority ordered) ---------- */
// priorities: 0 input · 10 sim · 20 camera · 30 render · 40 dom-anchors
const subs = [];
let rafId = 0;
let last = 0;
let running = false;

export function onFrame(fn, pri = 10) {
  subs.push({ fn, pri });
  subs.sort((a, b) => a.pri - b.pri);
  return () => {
    const i = subs.findIndex(s => s.fn === fn);
    if (i >= 0) subs.splice(i, 1);
  };
}

function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min((t - last) / 1000, 0.1) || 0.016;
  last = t;
  const time = t / 1000;
  for (let i = 0; i < subs.length; i++) subs[i].fn(dt, time);
}

export function startLoop() {
  if (running) return;
  running = true;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

/* verification/debug: drive the whole frame pipeline manually (throttled-rAF environments) */
export function pumpFrames(n = 1, dt = 1 / 60) {
  const t0 = performance.now() / 1000;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < subs.length; i++) subs[i].fn(dt, t0 + j * dt);
  }
}
export function stopLoop() {
  running = false;
  cancelAnimationFrame(rafId);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
  else { startLoop(); bus.emit('visible'); }
});

/* ---------- utils ---------- */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const map = (v, a, b, c, d) => c + (d - c) * clamp((v - a) / (b - a), 0, 1);
// framerate-independent exponential smoothing
export const damp = (cur, target, k, dt) => lerp(cur, target, 1 - Math.exp(-k * dt));
// tiny seeded rng (mulberry32) for stable telemetry walks
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
