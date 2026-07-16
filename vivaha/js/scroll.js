// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — the scroll director
// There is no page to scroll. Wheel, touch, drag and keys feed one smoothed
// timeline value p ∈ [0,1]; the film plays wherever p goes.
// ═══════════════════════════════════════════════════════════════════════════
import { clamp, lerp } from './utils.js';

const TRAVEL = 15000; // virtual pixels for the full film

export class ScrollDirector {
  constructor() {
    this.target = 0;      // 0..1
    this.p = 0;           // smoothed
    this.vel = 0;
    this.locked = true;   // Act I holds the door shut
    this.paused = false;  // portal panels pause the film
    this._glide = null;
    this._lastP = 0;
    this._touchY = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('wheel', (e) => {
      if (this.locked || this.paused) return;
      e.preventDefault();
      this._nudge(e.deltaY * (e.deltaMode === 1 ? 33 : 1));
    }, { passive: false });

    window.addEventListener('touchstart', (e) => { this._touchY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (this.locked || this.paused || this._touchY == null) return;
      const y = e.touches[0].clientY;
      this._nudge((this._touchY - y) * 2.6);
      this._touchY = y;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', () => { this._touchY = null; }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (this.locked || this.paused) return;
      const step = { ArrowDown: 340, PageDown: 900, ' ': 900, ArrowUp: -340, PageUp: -900 }[e.key];
      if (step) { this._nudge(step); e.preventDefault(); }
      if (e.key === 'Home') this.target = 0;
      if (e.key === 'End') this.target = 1;
    });
  }

  _nudge(px) {
    this._glide = null;
    this.target = clamp(this.target + px / TRAVEL, 0, 1);
  }

  unlock() { this.locked = false; }

  // cinematic auto-move (used right after the shatter)
  glideTo(p, seconds = 3) {
    this._glide = { from: this.target, to: p, t: 0, dur: seconds };
  }

  update(dt) {
    if (this._glide) {
      const g = this._glide;
      g.t += dt;
      const k = clamp(g.t / g.dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      this.target = lerp(g.from, g.to, e);
      if (k >= 1) this._glide = null;
    }
    // Act III breathes slower — heavier smoothing as p rises past 0.6
    const heaviness = this.p > 0.6 ? lerp(0.05, 0.028, clamp((this.p - 0.6) / 0.3, 0, 1)) : 0.05;
    const k = 1 - Math.pow(1 - heaviness, dt * 60);
    this.p = lerp(this.p, this.target, k);
    if (Math.abs(this.p - this.target) < 1e-5) this.p = this.target;
    this.vel = (this.p - this._lastP) / Math.max(dt, 1e-4);
    this._lastP = this.p;
  }
}
