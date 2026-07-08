// SIGWART_OS // overlays — DOM↔3D bay buttons + holo panel + bottom sheet,
// portal flash, and the client photo pipeline (probe → rig → fallback).

import * as THREE from 'three';
import { camera } from './gl/stage.mjs';
import { drones, wake, launch, SOCIALS } from './gl/drones.mjs';
import { bus, state, onFrame, clamp } from './core.mjs';
import * as audio from './audio.mjs';

const v3 = new THREE.Vector3();
let panel = null;
let activeUnit = null;
let hideTimer = 0;

/* ============================== drone panel ============================== */

function buildPanel() {
  panel = document.createElement('div');
  panel.className = 'holo-panel glass';
  panel.id = 'dronePanel';
  panel.innerHTML =
    '<span class="hp-stem" aria-hidden="true"></span>' +
    '<div class="hp-head"><span class="hp-callsign hud-label"></span><span class="hp-live hud-label" style="color:var(--vio-hot)">● RDY</span></div>' +
    '<a class="hp-name" target="_blank" rel="noopener"></a>' +
    '<div class="hp-rows hud-label">' +
    '<div><span>FEED</span><b class="val hp-feed"></b></div>' +
    '<div><span>PWR</span><b class="val">98.7%</b></div>' +
    '<div><span>ALT</span><b class="val hp-alt">0.0M</b></div>' +
    '</div>' +
    '<a class="hp-launch" target="_blank" rel="noopener">LAUNCH -&#8599;</a>';
  document.getElementById('anchors').appendChild(panel);

  const onAnchorLaunch = (e) => {
    // native anchor opens the tab (unblockable); we just play the cinematic
    launch(activeUnit, { skipOpen: true });
    audio.blip(990, 0.07, 0.1);
    if (state.touch) closeSheet();
  };
  panel.querySelector('.hp-launch').addEventListener('click', onAnchorLaunch);
  panel.querySelector('.hp-name').addEventListener('click', onAnchorLaunch);

  // hovering the panel itself keeps the drone awake — no wake/sleep flicker
  panel.addEventListener('pointerenter', () => {
    clearTimeout(hideTimer);
    if (activeUnit) wake(activeUnit, true);
  });
  panel.addEventListener('pointerleave', () => {
    if (activeUnit && !state.touch) { wake(activeUnit, false); hidePanelSoon(); }
  });
}

function fillPanel(unit) {
  const s = SOCIALS[unit];
  panel.querySelector('.hp-callsign').textContent = s.callsign;
  const name = panel.querySelector('.hp-name');
  name.textContent = s.name;
  name.href = s.url;
  panel.querySelector('.hp-feed').textContent = s.feed;
  const la = panel.querySelector('.hp-launch');
  la.href = s.url;
  panel.classList.remove('blocked');
}

function showPanel(unit) {
  clearTimeout(hideTimer);
  activeUnit = unit;
  fillPanel(unit);
  if (state.touch) {
    const sheet = document.getElementById('sheet');
    if (panel.parentElement !== sheet) sheet.appendChild(panel);
    sheet.classList.add('open');
  } else if (panel.parentElement !== document.getElementById('anchors')) {
    document.getElementById('anchors').appendChild(panel);
  }
  panel.classList.add('live');
  panel.style.opacity = '1';
}

function hidePanelSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (activeUnit && drones[activeUnit] && drones[activeUnit].launching) return;
    panel.classList.remove('live');
    panel.style.opacity = '0';
    activeUnit = null;
  }, 260);
}

function closeSheet() {
  document.getElementById('sheet').classList.remove('open');
  if (activeUnit) wake(activeUnit, false);
  activeUnit = null;
}

/* project drone → screen px inside the sticky pin */
function positionFrame() {
  const pin = document.querySelector('.hangar-pin');
  if (!pin) return;
  const rect = pin.getBoundingClientRect();
  const inView = rect.top < 4 && rect.bottom > window.innerHeight - 4;

  for (const unit of ['ig', 'tt', 'fb']) {
    const btn = document.getElementById('bay-' + unit);
    const d = drones[unit];
    if (!btn || !d) continue;
    if (!inView) { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; continue; }
    // freeze the hit-zone while hovered — a moving target under a still cursor
    // fires enter/leave loops (the flicker)
    if (btn.matches(':hover')) { btn.style.pointerEvents = 'auto'; continue; }
    v3.copy(d.group.position); v3.y += 0.4;
    v3.project(camera);
    if (v3.z > 1 || Math.abs(v3.x) > 1.2) { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; continue; }
    const x = (v3.x * 0.5 + 0.5) * window.innerWidth - rect.left;
    const y = (-v3.y * 0.5 + 0.5) * window.innerHeight - rect.top;
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    btn.style.pointerEvents = 'auto';
  }

  // float the panel beside the active drone on fine pointers
  if (!state.touch && activeUnit && panel.classList.contains('live')) {
    const d = drones[activeUnit];
    v3.copy(d.group.position); v3.y += 0.35;
    v3.project(camera);
    const x = (v3.x * 0.5 + 0.5) * window.innerWidth + 56;
    const y = (-v3.y * 0.5 + 0.5) * window.innerHeight - 40;
    panel.style.transform = 'translate3d(' + Math.round(clamp(x, 8, window.innerWidth - 250)) + 'px,' + Math.round(clamp(y, 70, window.innerHeight - 240)) + 'px,0)';
    const alt = Math.max(0, d.group.position.y - d.home.y);
    panel.querySelector('.hp-alt').textContent = (alt * 3).toFixed(1) + 'M';
  }
}

function wireBays() {
  for (const unit of ['ig', 'tt', 'fb']) {
    const btn = document.getElementById('bay-' + unit);
    if (!btn) continue;
    btn.addEventListener('pointerenter', () => { if (!state.touch) { wake(unit, true); showPanel(unit); } });
    btn.addEventListener('pointerleave', () => { if (!state.touch) { wake(unit, false); hidePanelSoon(); } });
    btn.addEventListener('focus', () => { wake(unit, true); showPanel(unit); });
    btn.addEventListener('blur', () => { if (!state.touch) { wake(unit, false); hidePanelSoon(); } });
    btn.addEventListener('click', () => {
      if (state.touch) {
        if (activeUnit !== unit) { wake(unit, true); showPanel(unit); audio.hoverBlip(); }
        else launch(unit);
      } else {
        launch(unit);
      }
    });
  }
  // tapping the dim area above the sheet closes it
  document.addEventListener('pointerdown', (e) => {
    if (!state.touch || !activeUnit) return;
    const sheet = document.getElementById('sheet');
    if (!sheet.classList.contains('open')) return;
    if (!sheet.contains(e.target) && !e.target.closest('.bay-focus')) closeSheet();
  }, { passive: true });

  bus.on('drone:blocked', () => {
    panel.classList.add('blocked');
    bus.emit('toast', 'POP-UP SHIELDED — USE THE LAUNCH LINK');
    if (activeUnit) showPanel(activeUnit);
  });
  bus.on('drone:portal', () => {
    const f = document.getElementById('flash');
    if (f && window.gsap && state.motionOK) {
      window.gsap.fromTo(f, { opacity: 0.85 }, { opacity: 0, duration: 0.65, ease: 'power2.out' });
    }
  });
  bus.on('drone:docked', () => { if (!state.touch) hidePanelSoon(); });
}

/* ============================== photo pipeline ============================== */

const EXTS = ['webp', 'jpg', 'jpeg', 'png'];
function probe(base) {
  return new Promise(resolve => {
    let i = 0;
    const tryNext = () => {
      if (i >= EXTS.length) { resolve(null); return; }
      const url = 'assets/photos/' + base + '.' + EXTS[i++];
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

async function initPhotos() {
  const [portrait, archive, vehicle] = await Promise.all([
    probe('portrait'), probe('archive'), probe('vehicle'),
  ]);

  if (portrait) {
    const card = document.getElementById('portrait-card');
    for (const sel of ['.p-photo', '.p-light', '.p-eyes']) {
      card.querySelector(sel).style.backgroundImage = 'url("' + portrait + '")';
    }
    card.classList.add('has-photo');
    initPortraitRig(card);
  }
  if (archive) {
    const c = document.getElementById('archive-card');
    c.querySelector('.ac-photo').style.backgroundImage = 'url("' + archive + '")';
    c.classList.add('has-photo');
  }
  if (vehicle) {
    const p = document.getElementById('veh-pan');
    p.querySelector('.veh-img').style.backgroundImage = 'url("' + vehicle + '")';
    p.classList.add('has-photo');
  }

  // looping video feeds (lazy: only load + play while on screen; photo stays as poster/fallback)
  mountLoopVideo('assets/photos/archiveloopvideo.mp4', document.querySelector('#archive-card .ac-photo'));
  mountLoopVideo('assets/photos/vehicleloopvideo.mp4', document.querySelector('#veh-pan .veh-img'));

  bus.emit('photos:ready');
}

function mountLoopVideo(src, host) {
  if (!host) return;
  const vid = document.createElement('video');
  vid.className = 'loop-video';
  vid.muted = true;
  vid.loop = true;
  vid.playsInline = true;
  vid.setAttribute('muted', '');
  vid.setAttribute('playsinline', '');
  vid.preload = 'none';
  vid.addEventListener('error', () => vid.remove(), { once: true });
  vid.addEventListener('canplay', () => { if (vid.__wanted) vid.play().catch(() => {}); });
  host.appendChild(vid);

  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) {
        vid.__wanted = true;
        if (!vid.src) vid.src = src;           // first sight: start loading
        vid.play().catch(() => {});
      } else {
        vid.__wanted = false;
        vid.pause();
      }
    }
  }, { rootMargin: '160px' });
  io.observe(host);
}

/* head/eye cursor-follow on a flat photo: 3D tilt + eye-band micro-shift + light mask */
function initPortraitRig(card) {
  const rig = document.getElementById('portrait-rig');
  const eyes = card.querySelector('.p-eyes');   // head layer (soft ellipse mask)
  const photo = card.querySelector('.p-photo');
  // calibrated for the frontal portrait: head centered, crown→beard ≈ 13%→57%
  card.style.setProperty('--head-cx', '50%');
  card.style.setProperty('--head-cy', '33%');
  card.style.setProperty('--head-rx', '24%');
  card.style.setProperty('--head-ry', '25%');

  if (state.fine && state.motionOK && window.gsap) {
    const rx = window.gsap.quickTo(card, 'rotationX', { duration: 0.65, ease: 'power3.out' });
    const ry = window.gsap.quickTo(card, 'rotationY', { duration: 0.65, ease: 'power3.out' });
    const ex = window.gsap.quickTo(eyes, 'x', { duration: 0.38, ease: 'power2.out' });
    const ey = window.gsap.quickTo(eyes, 'y', { duration: 0.38, ease: 'power2.out' });
    const ery = window.gsap.quickTo(eyes, 'rotationY', { duration: 0.42, ease: 'power2.out' });
    const erz = window.gsap.quickTo(eyes, 'rotationZ', { duration: 0.5, ease: 'power2.out' });
    window.addEventListener('pointermove', (e) => {
      const r = rig.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const nx = clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
      const ny = clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
      ry(nx * 8);
      rx(-ny * 6);
      // the head TURNS, faster than the card — it leads, the body follows
      ex(nx * 9);
      ey(ny * 4.5);
      ery(nx * 11);
      erz(nx * 2.4);
      card.style.setProperty('--mx', (50 + nx * 32) + '%');
      card.style.setProperty('--my', (38 + ny * 22) + '%');
    }, { passive: true });
  } else if (state.motionOK && window.gsap) {
    // touch: slow idle sway so the portrait still feels alive
    window.gsap.to(card, { rotationY: 3.2, duration: 3.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    window.gsap.to(eyes, { x: 4.5, duration: 3.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  // occasional glitch slice
  if (state.motionOK) {
    const glitch = () => {
      photo.classList.add('glitching');
      setTimeout(() => photo.classList.remove('glitching'), 340);
      setTimeout(glitch, 6500 + Math.random() * 7000);
    };
    setTimeout(glitch, 4000);
  }
}

/* ============================== init ============================== */

export function initOverlays() {
  buildPanel();
  wireBays();
  onFrame(positionFrame, 40);
  initPhotos();
}
