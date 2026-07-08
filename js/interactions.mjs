// SIGWART_OS // interactions — scanning cursor, magnetic elements, x-ray optics,
// typed codes (Y2K / OPENBAY), secret prototype bay, barcode plate

import { bus, state, onFrame, clamp } from './core.mjs';
import * as audio from './audio.mjs';
import { toast } from './hud.mjs';

/* ---------- custom scanning cursor (fine pointers only) ---------- */
function initCursor() {
  if (!state.fine || state.touch || !window.gsap) return;
  const gsap = window.gsap;
  const root = document.getElementById('cursor');
  const dot = root.querySelector('.cur-dot');
  const ring = root.querySelector('.cur-ring');
  // position via left/top, NOT transform — the ring's CSS state scales/spin
  // animations own transform, and both writing it caused the stutter/freeze
  const dx = gsap.quickTo(dot, 'left', { duration: 0.07, ease: 'power2.out' });
  const dy = gsap.quickTo(dot, 'top', { duration: 0.07, ease: 'power2.out' });
  const rx = gsap.quickTo(ring, 'left', { duration: 0.28, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'top', { duration: 0.28, ease: 'power3.out' });

  window.addEventListener('pointermove', e => {
    dx(e.clientX); dy(e.clientY);
    rx(e.clientX); ry(e.clientY);
  }, { passive: true });

  // context states via delegation
  document.addEventListener('pointerover', e => {
    const t = e.target;
    if (t.closest && t.closest('.bay-focus')) document.body.dataset.cursor = 'reticle';
    else if (t.closest && t.closest('a, button, [data-magnetic], [data-secret]')) document.body.dataset.cursor = 'engage';
    else document.body.dataset.cursor = '';
  }, { passive: true });

  bus.on('boot:done', () => document.body.classList.add('cursor-live'));
  if (state.phase === 'active') document.body.classList.add('cursor-live');
}

/* ---------- magnetic elements ---------- */
function initMagnetic() {
  if (!state.fine || state.touch || !state.motionOK || !window.gsap) return;
  const gsap = window.gsap;
  const els = Array.from(document.querySelectorAll('[data-magnetic]')).map(el => ({
    el,
    setX: gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' }),
    setY: gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' }),
    rect: null,
    max: el.classList.contains('cta-lines') ? 10 : 5,
  }));
  const refresh = () => els.forEach(m => { m.rect = m.el.getBoundingClientRect(); });
  refresh();
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', () => { clearTimeout(refresh._t); refresh._t = setTimeout(refresh, 120); }, { passive: true });

  window.addEventListener('pointermove', e => {
    for (const m of els) {
      if (!m.rect) continue;
      const cx = m.rect.left + m.rect.width / 2;
      const cy = m.rect.top + m.rect.height / 2;
      const dxp = e.clientX - cx, dyp = e.clientY - cy;
      const dist = Math.hypot(dxp, dyp);
      const range = Math.max(m.rect.width, 90);
      if (dist < range) {
        const pull = (1 - dist / range);
        m.setX(clamp(dxp * pull * 0.4, -m.max, m.max));
        m.setY(clamp(dyp * pull * 0.4, -m.max, m.max));
      } else {
        m.setX(0); m.setY(0);
      }
    }
  }, { passive: true });
}

/* ---------- reactive chrome title (glow + soft audio cue; magnetic via data attr) ---------- */
function initTitle() {
  const title = document.querySelector('.chrome-title');
  if (!title) return;
  let last = 0;
  title.addEventListener('pointerenter', () => {
    title.classList.add('lit');
    const now = performance.now();
    if (now - last > 600) { last = now; audio.blip(1240, 0.11, 0.05); }
  });
  title.addEventListener('pointerleave', () => title.classList.remove('lit'));
}

/* ---------- typed codes + secret bay + barcode ---------- */
let secretOpen = false;
function openSecretBay() {
  if (secretOpen) return;
  secretOpen = true;
  state.secretBay = true;
  audio.rumble(1.6, 0.4);
  toast('PROTOTYPE BAY UNLOCKED // PX-00 GHOST', 3200);
  const S = window.__SIG;
  try {
    const wall = S.world.secretWall;
    if (wall && window.gsap) window.gsap.to(wall.position, { y: wall.position.y + 5.7, duration: 1.6, ease: 'power3.inOut' });
    S.world.setPadLit('px', 1);
    if (S.drones) { S.drones.wake('px', true); setTimeout(() => S.drones.wake('px', false), 4000); }
    // brief cinematic glance toward the alcove
    const cam = S.gl && S.gl.camera;
    if (cam && window.gsap && state.motionOK) {
      import('./gl/camera.mjs').then(m => {
        const px = S.drones.list.px.group.position;
        m.cine.fn = () => ({ pos: { x: 8.5, y: px.y + 1.6, z: px.z + 9, clone() { return this; } }, tgt: px });
        window.gsap.to(m.cine, { w: 0.7, duration: 0.9, ease: 'power2.inOut' });
        setTimeout(() => window.gsap.to(m.cine, { w: 0, duration: 1.0 }), 3400);
      });
    }
  } catch (e) { /* gl not up */ }
  bus.emit('secret:open');
}

function initCodes() {
  let buf = '';
  document.addEventListener('keydown', e => {
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toUpperCase()).slice(-8);
    if (buf.endsWith('Y2K')) {
      state.crt = !state.crt;
      document.body.classList.toggle('crt', state.crt);
      audio.blip(state.crt ? 1200 : 400, 0.08, 0.12);
      toast(state.crt ? 'CRT ARCHIVE MODE // Y2K' : 'CRT MODE OFF');
    }
    if (buf.endsWith('OPENBAY')) openSecretBay();
  });

  // triple-click (or 7 taps) on the flickering wall panel
  const panel = document.getElementById('secret-panel');
  if (panel) {
    let clicks = 0, timer = 0;
    const need = state.touch ? 7 : 3;
    panel.addEventListener('click', () => {
      clicks++;
      audio.tick();
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 900);
      if (clicks >= need) { clicks = 0; openSecretBay(); }
    });
  }

  const barcode = document.getElementById('barcode-foot');
  if (barcode) {
    const plate = () => { audio.blip(300, 0.06, 0.08); toast('DS-2026 // SYSTEMATIC VISUAL LANGUAGE v5.0'); };
    barcode.addEventListener('click', plate);
    barcode.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); plate(); } });
  }
}

export function initInteractions() {
  initCursor();
  initMagnetic();
  initTitle();
  initCodes();
}
