// SIGWART_OS // capabilities — device tiering, motion prefs, url overrides, fps governor

import { state, bus, pumpFrames, startLoop, stopLoop } from './core.mjs';

export function detectCaps() {
  const q = new URLSearchParams(location.search);

  state.fine = matchMedia('(pointer: fine)').matches;
  state.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionParam = q.get('motion');
  state.motionOK = motionParam === 'on' ? true : motionParam === 'off' ? false : !reduced;

  // tier: desktop fine-pointer → 2, coarse default → 1; low memory drops one
  let tier = state.fine && !state.touch ? 2 : 1;
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) tier = Math.max(0, tier - 1);
  const tierParam = q.get('tier');
  if (tierParam !== null) tier = Math.max(0, Math.min(2, parseInt(tierParam, 10) || 0));
  setTier(tier);

  state.debug = q.get('debug') === '1';

  document.body.classList.toggle('is-touch', state.touch);
  document.body.classList.toggle('motion-off', !state.motionOK);

  // debug / verification surface
  window.__SIG = window.__SIG || {};
  Object.assign(window.__SIG, {
    state,
    bus,
    setTier,
    pump: pumpFrames,
    startLoop,
    stopLoop,
    fps: () => fpsAvg,
  });
  return state;
}

export function setTier(t) {
  state.tier = t;
  document.body.dataset.tier = String(t);
  document.body.classList.toggle('no-blur', t < 2);
  bus.emit('tier:change', t);
}

/* ---------- runtime fps governor ----------
   rolling 60-frame average; sustained > 22ms after activation steps quality down.
   stage.mjs listens for 'governor:step' and applies the next rung. never re-upgrades. */
let fpsAvg = 60;
let acc = 0, n = 0, badStreak = 0, armed = false;

bus.on('boot:done', () => { setTimeout(() => { armed = true; }, 4000); });

export function governorFrame(dt) {
  acc += dt; n++;
  if (n >= 60) {
    const avgMs = (acc / n) * 1000;
    fpsAvg = Math.round(1000 / Math.max(avgMs, 1));
    acc = 0; n = 0;
    if (!armed) return;
    if (avgMs > 22) {
      badStreak++;
      if (badStreak >= 2) { badStreak = 0; bus.emit('governor:step'); }
    } else {
      badStreak = 0;
    }
  }
}
