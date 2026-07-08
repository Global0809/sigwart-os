// SIGWART_OS // audio — 100% procedural WebAudio. no files, no samples.
// unlock() MUST be called synchronously inside a user gesture (the INITIALIZE click).

import { state, bus } from './core.mjs';

let ctx = null;
let master = null;
let padGain = null;
let padFilter = null;
let whiteBuf = null;
let brownBuf = null;

state.muted = localStorage.getItem('sig.muted') === '1';

const now = () => ctx.currentTime;

function makeNoise(type) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === 'brown') {
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * w) / 1.02;
      d[i] = lastOut * 3.2;
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function noiseSource(type) {
  const src = ctx.createBufferSource();
  if (type === 'brown') { brownBuf = brownBuf || makeNoise('brown'); src.buffer = brownBuf; }
  else { whiteBuf = whiteBuf || makeNoise('white'); src.buffer = whiteBuf; }
  src.loop = true;
  return src;
}

export function unlocked() { return !!ctx; }

export function unlock() {
  if (ctx) { resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = state.muted ? 0 : 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 12;
  comp.attack.value = 0.004; comp.release.value = 0.24;
  master.connect(comp);
  comp.connect(ctx.destination);

  buildPad();
  bus.emit('audio:unlocked');
}

export function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });

export function setMuted(m) {
  state.muted = m;
  localStorage.setItem('sig.muted', m ? '1' : '0');
  if (ctx && master) {
    master.gain.cancelScheduledValues(now());
    master.gain.linearRampToValueAtTime(m ? 0 : 0.85, now() + 0.18);
  }
  bus.emit('mute:toggle', m);
}

/* ---------- ambient pad (sub room tone; padUp() after boot) ---------- */
function buildPad() {
  padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 340; padFilter.Q.value = 0.8;

  padGain = ctx.createGain(); padGain.gain.value = 0;
  padFilter.connect(padGain);
  padGain.connect(master);

  const voices = [
    { f: 55.0, type: 'sawtooth', g: 0.055, det: -4 },
    { f: 82.41, type: 'sawtooth', g: 0.04, det: 3 },
    { f: 110.0, type: 'triangle', g: 0.05, det: 6 },
  ];
  for (const v of voices) {
    const o = ctx.createOscillator();
    o.type = v.type; o.frequency.value = v.f; o.detune.value = v.det;
    const g = ctx.createGain(); g.gain.value = v.g;
    o.connect(g); g.connect(padFilter);
    o.start();
  }

  // slow filter breathing
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 95;
  lfo.connect(lfoAmt); lfoAmt.connect(padFilter.frequency);
  lfo.start();

  // airy noise bed
  const nz = noiseSource('white');
  const nzF = ctx.createBiquadFilter(); nzF.type = 'bandpass'; nzF.frequency.value = 190; nzF.Q.value = 0.5;
  const nzG = ctx.createGain(); nzG.gain.value = 0.016;
  nz.connect(nzF); nzF.connect(nzG); nzG.connect(padGain);
  nz.start();

  // cavern delay space
  const dl = ctx.createDelay(1.2); dl.delayTime.value = 0.47;
  const fb = ctx.createGain(); fb.gain.value = 0.36;
  const fbF = ctx.createBiquadFilter(); fbF.type = 'lowpass'; fbF.frequency.value = 1100;
  const wet = ctx.createGain(); wet.gain.value = 0.15;
  padFilter.connect(dl); dl.connect(fbF); fbF.connect(fb); fb.connect(dl);
  dl.connect(wet); wet.connect(master);
}

export function padUp() {
  if (!ctx) return;
  padGain.gain.cancelScheduledValues(now());
  padGain.gain.linearRampToValueAtTime(0.5, now() + 3.0);
}

/* ---------- one-shot voices ---------- */
function env(g, t0, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(end, t0 + a + d);
}

export function blip(f = 880, dur = 0.08, g = 0.14, type = 'sine') {
  if (!ctx || state.muted) return;
  const t0 = now();
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.frequency.exponentialRampToValueAtTime(f * 1.45, t0 + dur);
  const gn = ctx.createGain();
  env(gn, t0, 0.006, g, dur);
  o.connect(gn); gn.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function hoverBlip() {
  blip(740, 0.07, 0.10);
  setTimeout(() => blip(1180, 0.05, 0.05), 40);
}

export function deny() {
  blip(190, 0.09, 0.12, 'square');
  setTimeout(() => blip(150, 0.11, 0.10, 'square'), 90);
}

export function tick() {
  if (!ctx || state.muted) return;
  const t0 = now();
  const o = ctx.createOscillator();
  o.type = 'square'; o.frequency.value = 2300 + Math.random() * 500;
  const gn = ctx.createGain();
  env(gn, t0, 0.001, 0.028, 0.018);
  o.connect(gn); gn.connect(master);
  o.start(t0); o.stop(t0 + 0.03);
}

export function chirp(i = 0) {
  blip(520 + i * 36, 0.05, 0.06);
}

export function whoosh(dur = 1.15, g = 0.5) {
  if (!ctx || state.muted) return;
  const t0 = now();
  const nz = noiseSource('white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(280, t0);
  bp.frequency.exponentialRampToValueAtTime(3600, t0 + dur);
  const gn = ctx.createGain();
  env(gn, t0, dur * 0.42, g, dur * 0.62);
  nz.connect(bp); bp.connect(gn); gn.connect(master);
  nz.start(t0); nz.stop(t0 + dur + 0.1);

  const sub = ctx.createOscillator();
  sub.frequency.setValueAtTime(46, t0);
  sub.frequency.exponentialRampToValueAtTime(30, t0 + dur);
  const sg = ctx.createGain();
  env(sg, t0, 0.05, 0.26, dur * 0.9);
  sub.connect(sg); sg.connect(master);
  sub.start(t0); sub.stop(t0 + dur + 0.1);
}

export function rumble(dur = 1.6, g = 0.4) {
  if (!ctx || state.muted) return;
  const t0 = now();
  const nz = noiseSource('brown');
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 92;
  const gn = ctx.createGain();
  env(gn, t0, 0.14, g, dur);
  // 8Hz judder
  const am = ctx.createOscillator(); am.frequency.value = 8;
  const amAmt = ctx.createGain(); amAmt.gain.value = g * 0.4;
  am.connect(amAmt); amAmt.connect(gn.gain);
  nz.connect(lp); lp.connect(gn); gn.connect(master);
  nz.start(t0); nz.stop(t0 + dur + 0.1);
  am.start(t0); am.stop(t0 + dur + 0.1);

  const sub = ctx.createOscillator(); sub.frequency.value = 36;
  const sg = ctx.createGain();
  env(sg, t0, 0.2, 0.16, dur * 0.95);
  sub.connect(sg); sg.connect(master);
  sub.start(t0); sub.stop(t0 + dur + 0.1);
}

export function powerSwell(dur = 1.3) {
  if (!ctx || state.muted) return;
  const t0 = now();
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(55, t0);
  o.frequency.exponentialRampToValueAtTime(110, t0 + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(180, t0);
  lp.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
  const gn = ctx.createGain();
  env(gn, t0, dur * 0.55, 0.22, dur * 0.5);
  o.connect(lp); lp.connect(gn); gn.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.1);
}
