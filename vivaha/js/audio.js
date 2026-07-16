// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — sound, conjured from oscillators
// A tanpura that never stops, temple bells, breath, water, and the great
// shatter. No audio files — everything is synthesized the moment it is heard.
// ═══════════════════════════════════════════════════════════════════════════
import { clamp } from './utils.js';

const SA = 138.59; // C#3 — the tonic the whole world hums in

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this._levels = { drone: 0, pad: 0, water: 0 };
  }

  start() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    this.started = true;
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 5;
    this.master.connect(comp); comp.connect(ctx.destination);

    // temple reverb — generated impulse
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(2.8, 2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.4;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);

    this.droneBus = ctx.createGain(); this.droneBus.gain.value = 0;
    this.droneBus.connect(this.master);
    const droneSend = ctx.createGain(); droneSend.gain.value = 0.5;
    this.droneBus.connect(droneSend); droneSend.connect(this.verb);

    this.padBus = ctx.createGain(); this.padBus.gain.value = 0;
    this.padBus.connect(this.master);
    const padSend = ctx.createGain(); padSend.gain.value = 0.65;
    this.padBus.connect(padSend); padSend.connect(this.verb);

    this.fxBus = ctx.createGain(); this.fxBus.gain.value = 0.9;
    this.fxBus.connect(this.master);
    const fxSend = ctx.createGain(); fxSend.gain.value = 0.55;
    this.fxBus.connect(fxSend); fxSend.connect(this.verb);

    this._startTanpura();
    this._startPad();
    this._startWater();

    // fade the hall in
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, ctx.currentTime, 1.2);
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.5;
      }
    }
    return buf;
  }

  // ── the eternal tanpura: Pa · Sa' · Sa' · Sa, plucked forever ─────────────
  _startTanpura() {
    const ctx = this.ctx;
    const notes = [SA * 1.5, SA * 2, SA * 2, SA];
    let step = 0;
    const pluck = () => {
      if (!this.started) return;
      const t = ctx.currentTime + 0.02;
      const f = notes[step % 4];
      step++;
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 1.003;
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(420, t + 3.4);
      lp.Q.value = 2.5; // a whisper of jawari buzz
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 4.4);
      o1.connect(g); o2.connect(g); g.connect(lp); lp.connect(this.droneBus);
      o1.start(t); o2.start(t); o1.stop(t + 4.6); o2.stop(t + 4.6);
      this._tanpuraTimer = setTimeout(pluck, 1150 + Math.random() * 120);
    };
    pluck();
  }

  // ── slow celestial pad — swells inside the dome ───────────────────────────
  _startPad() {
    const ctx = this.ctx;
    const make = (freq, detune, vol) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(this.padBus); o.start();
      return o;
    };
    make(SA, 0, 0.20); make(SA * 2, 5, 0.10); make(SA * 3, -6, 0.05);
    make(SA * 1.5, 3, 0.08);
    // slow shimmer
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.16;
    lfo.connect(lfoG); lfoG.connect(this.padBus.gain); lfo.start();
  }

  // ── lake ─────────────────────────────────────────────────────────────────
  _startWater() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { // brown-ish noise
      last = (last + (Math.random() * 2 - 1) * 0.03) * 0.985;
      d[i] = last * 6;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    this.waterBus = ctx.createGain(); this.waterBus.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.35;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    src.connect(lp); lp.connect(this.waterBus); this.waterBus.connect(this.master);
    src.start();
  }

  // ── one temple bell ───────────────────────────────────────────────────────
  bell(pitch = 1, vol = 0.5) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = 420 * pitch;
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f * 2.76;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.4, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 2.4);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28 * vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 3.6);
    car.connect(g); g.connect(this.fxBus);
    car.start(t); mod.start(t); car.stop(t + 3.8); mod.stop(t + 3.8);
  }

  // tiny interface pluck
  tick() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = SA * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.3);
    o.connect(g); g.connect(this.fxBus);
    o.start(t); o.stop(t + 0.32);
  }

  // rising shimmer while the guest holds the orb
  setCharge(v) {
    if (!this.started) return;
    if (!this._chargeNodes) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = SA * 2;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14;
      bp.frequency.value = 300;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(bp); bp.connect(g); g.connect(this.fxBus);
      o.start();
      this._chargeNodes = { o, bp, g };
    }
    const { o, bp, g } = this._chargeNodes;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(v * 0.12, t, 0.08);
    bp.frequency.setTargetAtTime(300 + v * v * 3200, t, 0.1);
    o.frequency.setTargetAtTime(SA * 2 * (1 + v * 1.5), t, 0.15);
  }

  // the world breaks open
  shatter() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // sub drop
    const sub = ctx.createOscillator(); sub.frequency.setValueAtTime(96, t);
    sub.frequency.exponentialRampToValueAtTime(27, t + 1.6);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.6, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
    sub.connect(sg); sg.connect(this.fxBus);
    sub.start(t); sub.stop(t + 2);
    // crystal burst
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.setValueAtTime(300, t);
    hp.frequency.exponentialRampToValueAtTime(2400, t + 1.0);
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    noise.connect(hp); hp.connect(ng); ng.connect(this.fxBus);
    noise.start(t);
    // rain of golden pings
    for (let i = 0; i < 14; i++) {
      setTimeout(() => this.bell(1.6 + Math.random() * 2.2, 0.12 + Math.random() * 0.12),
        180 + Math.random() * 1900);
    }
    this.bell(0.62, 0.9); // the great bell underneath it all
  }

  // called every frame with scene mix targets (0..1 each)
  setScene({ drone = 0, pad = 0, water = 0 } = {}) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const L = this._levels;
    if (Math.abs(L.drone - drone) > 0.01) { this.droneBus.gain.setTargetAtTime(drone * 0.75, t, 0.8); L.drone = drone; }
    if (Math.abs(L.pad - pad) > 0.01)     { this.padBus.gain.setTargetAtTime(pad * 0.30, t, 1.4); L.pad = pad; }
    if (Math.abs(L.water - water) > 0.01) { this.waterBus.gain.setTargetAtTime(water * 0.5, t, 1.2); L.water = water; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.started) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.4);
    }
    return this.muted;
  }
}
