// SIGWART_OS // hud — toggles, clock, toast; telemetry walks arrive with interactions phase

import { bus, state, onFrame, rng } from './core.mjs';
import * as audio from './audio.mjs';

let toastTimer = 0;

export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function initHud() {
  const sndBtn = document.getElementById('tg-snd');

  // sound toggle (pressed = audible)
  sndBtn.setAttribute('aria-pressed', String(!state.muted));
  sndBtn.addEventListener('click', () => {
    const nowMuted = !state.muted;
    audio.setMuted(nowMuted);
    sndBtn.setAttribute('aria-pressed', String(!nowMuted));
    if (!nowMuted) audio.hoverBlip();
    toast(nowMuted ? 'AUDIO CHANNEL MUTED' : 'AUDIO CHANNEL OPEN');
  });

  bus.on('toast', toast);

  // clock + light telemetry idle walk (full sparkline arrives later)
  const clock = document.getElementById('hud-clock');
  const netEl = document.getElementById('hud-net');
  const pwrEl = document.getElementById('hud-pwr');
  const rand = rng(50128);
  let acc = 0, net = 98.7, pwr = 4.2;

  onFrame((dt) => {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    net = Math.min(99.9, Math.max(96.2, net + (rand() - 0.5) * 0.3));
    pwr = Math.min(9.9, Math.max(2.8, pwr + (rand() - 0.5) * 0.22));
    netEl.textContent = 'NET ' + net.toFixed(1) + '%';
    pwrEl.textContent = 'PWR 0' + pwr.toFixed(1) + 'kW';
  }, 45);
}
