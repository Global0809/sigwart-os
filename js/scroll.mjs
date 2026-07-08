// SIGWART_OS // scroll — Lenis + ScrollTrigger wiring, room tracking, hangar choreography,
// reveal animations, depth meter, elevator rides

import { bus, state, map } from './core.mjs';
import * as audio from './audio.mjs';
import { world } from './gl/world.mjs';
import { setProgress } from './gl/camera.mjs';
import { setPadPower } from './gl/drones.mjs';

let lenis = null;

export function scrollTo(target, opts = {}) {
  const dur = opts.duration || 1.6;
  if (lenis) {
    lenis.scrollTo(target, { duration: dur, easing: t => 1 - Math.pow(1 - t, 3) });
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: state.motionOK ? 'smooth' : 'auto' });
  } else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.scrollIntoView({ behavior: state.motionOK ? 'smooth' : 'auto' });
  }
}

export function initScroll() {
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  ST.config({ ignoreMobileResize: true });

  /* Lenis smoothing — desktop fine pointers only; touch stays native */
  const noLenis = new URLSearchParams(location.search).has('nolenis');
  if (!noLenis && state.fine && !state.touch && state.motionOK && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* master camera progress (single writer feeding the pose track) */
  ST.create({
    start: 0, end: 'max',
    onUpdate: self => {
      setProgress(self.progress);
      state.scrollP = self.progress;
      state.scrollVel = (self.getVelocity ? self.getVelocity() : 0) / 4000;
    },
  });

  /* room tracking → rail state + body data-room */
  const links = Array.from(document.querySelectorAll('#rail a'));
  const setRoom = (r) => {
    if (state.room === r) return;
    state.room = r;
    document.body.dataset.room = r;
    links.forEach(a => a.classList.toggle('is-here', a.dataset.floor === r));
    bus.emit('room', r);
  };
  document.querySelectorAll('.room').forEach(sec => {
    ST.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: self => { if (self.isActive) setRoom(sec.dataset.room); },
    });
  });

  /* depth meter */
  const depthEl = document.getElementById('rail-depth');
  const gateDepthEl = document.getElementById('gate-depth');
  ST.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const m = (self.progress * 78).toFixed(1).padStart(5, '0');
      if (depthEl) depthEl.textContent = '-' + m + 'M';
      if (gateDepthEl) gateDepthEl.textContent = self.progress < 0.02 ? 'SURFACE' : '-' + m + 'M';
    },
  });

  /* ---- hangar choreography: doors → power sequence → status text ---- */
  const statusText = document.getElementById('hangar-status-text');
  const sfx = { doors: false, ig: false, tt: false, fb: false };
  const PAD_WIN = { ig: [0.30, 0.44], tt: [0.37, 0.51], fb: [0.44, 0.58] };

  ST.create({
    trigger: '#hangar', start: 'top bottom', end: 'bottom bottom',
    onUpdate: self => {
      const p = self.progress;
      if (!world.doors) return;

      const doorAmt = map(p, 0.13, 0.30, 0, 1);
      world.doors.open(doorAmt * doorAmt * (3 - 2 * doorAmt)); // smoothstep feel

      if (p > 0.13 && !sfx.doors) { sfx.doors = true; audio.rumble(2.0, 0.4); }
      if (p < 0.10) sfx.doors = false;

      ['ig', 'tt', 'fb'].forEach((unit, i) => {
        const k = map(p, PAD_WIN[unit][0], PAD_WIN[unit][1], 0, 1);
        world.setPadLit(unit, k);
        setPadPower(unit, k);   // drone spins up + rises off its pad as power arrives
        if (world.padCones[i]) world.padCones[i].uniforms.uIntensity.value = k * 0.5;
        if (k > 0.05 && !sfx[unit]) { sfx[unit] = true; audio.blip(660 + i * 180, 0.1, 0.11); }
        if (k <= 0.01) sfx[unit] = false;
      });

      if (statusText) {
        statusText.textContent =
          p < 0.13 ? 'BAY DOORS SEALED' :
          p < 0.30 ? 'BAY DOORS OPENING' :
          p < 0.50 ? 'POWER SEQUENCE RUNNING' :
          'ALL UNITS ONLINE // HOVER TO WAKE';
      }
      bus.emit('hangar:progress', p);
    },
  });

  /* ---- reveals + parallax (motion users only) ---- */
  if (state.motionOK) {
    gsap.utils.toArray('[data-reveal]').forEach(el => {
      gsap.from(el, {
        y: 26, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });
    gsap.to('.gate-grid', {
      yPercent: -9, ease: 'none',
      scrollTrigger: { trigger: '#gate', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('.veh-img', {
      yPercent: 9, ease: 'none',
      scrollTrigger: { trigger: '#veh-pan', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // section titles wipe in like a scanline
    gsap.utils.toArray('.room-title').forEach(el => {
      gsap.from(el, {
        clipPath: 'inset(0 100% 0 0)', duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%' },
      });
    });
    // ID card rows cascade in
    gsap.from('.id-rows > div', {
      opacity: 0, x: -16, stagger: 0.09, duration: 0.55, ease: 'power2.out',
      scrollTrigger: { trigger: '.id-card', start: 'top 72%' },
    });
    // operator cards drift at different depths
    gsap.to('.archive-card', {
      yPercent: -6, ease: 'none',
      scrollTrigger: { trigger: '#operator', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.to('.id-card', {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: '#operator', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  /* ---- elevator rides ---- */
  links.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      audio.blip(880, 0.07, 0.09);
      scrollTo(a.getAttribute('href'), { duration: 1.7 });
    });
  });
  const brand = document.querySelector('.hud-brand');
  if (brand) brand.addEventListener('click', e => { e.preventDefault(); scrollTo(0, { duration: 1.7 }); });
  const reinit = document.getElementById('reinit');
  if (reinit) reinit.addEventListener('click', () => {
    audio.whoosh(1.1, 0.32);
    scrollTo(0, { duration: 2.4 });
  });

  bus.on('boot:done', () => ST.refresh());
  bus.on('photos:ready', () => ST.refresh());
}
