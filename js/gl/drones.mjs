// SIGWART_OS // gl/drones — the centerpiece: 3 social drones + 1 prototype.
// Procedural build from primitives, wake sim, popup-safe launch cinematic.

import * as THREE from 'three';
import { scene } from './stage.mjs';
import { world, UNIT_COLORS, glowSprite } from './world.mjs';
import { cine } from './camera.mjs';
import { bus, state, onFrame, damp } from '../core.mjs';
import * as audio from '../audio.mjs';

export const SOCIALS = {
  ig: { name: 'INSTAGRAM', callsign: 'IG-01 // VISION', feed: 'VISUAL FEED', url: 'https://www.instagram.com/osb.dj.50?igsh=a2p3eHpqdmNmbW9s&utm_source=qr' },
  tt: { name: 'TIKTOK', callsign: 'TT-02 // PULSE', feed: 'MOTION FEED', url: 'https://www.tiktok.com/@user69495488?_r=1&_t=ZT-95BTlckRpeA' },
  fb: { name: 'FACEBOOK', callsign: 'FB-03 // RELAY', feed: 'SIGNAL RELAY', url: 'https://www.facebook.com/osb.dj.50?mibextid=wwXIfr&rdid=xWQbpoFmQVSob9eb&share_url=https%3A%2F%2F' },
};

export const drones = {};   // unit → drone record
let geo = null;
let hullMat = null, chromeMat = null;

function buildShared() {
  geo = {
    chassis: new THREE.CylinderGeometry(0.55, 0.62, 0.26, 24),
    canopy: new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
    eye: new THREE.SphereGeometry(0.07, 12, 8),
    arm: new THREE.BoxGeometry(0.78, 0.05, 0.1),
    nacelle: new THREE.CylinderGeometry(0.1, 0.12, 0.09, 12),
    ring: new THREE.TorusGeometry(0.3, 0.028, 10, 36),
    blade: new THREE.BoxGeometry(0.5, 0.008, 0.05),
    strip: new THREE.BoxGeometry(0.46, 0.022, 0.022),
    underRing: new THREE.TorusGeometry(0.4, 0.016, 8, 40),
  };
  hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x101018, metalness: 0.85, roughness: 0.35,
    clearcoat: 1.0, clearcoatRoughness: 0.25, envMapIntensity: 1.2,
  });
  chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8d3e8, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.6,
  });
}

function makeDrone(unit) {
  if (!geo) buildShared();
  const accent = new THREE.Color(UNIT_COLORS[unit]);
  const accentMat = new THREE.MeshBasicMaterial({ color: accent.clone() });
  accentMat.toneMapped = false;
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5edff).multiplyScalar(1.8) });
  eyeMat.toneMapped = false;

  const g = new THREE.Group();
  const body = new THREE.Mesh(geo.chassis, unit === 'px' ? chromeMat : hullMat);
  g.add(body);
  const canopy = new THREE.Mesh(geo.canopy, chromeMat);
  canopy.position.y = 0.13;
  g.add(canopy);
  const eye = new THREE.Mesh(geo.eye, eyeMat);
  eye.position.set(0, 0.16, 0.34);
  g.add(eye);

  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * (Math.PI / 2);
    const arm = new THREE.Mesh(geo.arm, unit === 'px' ? chromeMat : hullMat);
    arm.position.set(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62);
    arm.rotation.y = -a;
    g.add(arm);
    const nac = new THREE.Mesh(geo.nacelle, unit === 'px' ? chromeMat : hullMat);
    nac.position.set(Math.cos(a) * 1.0, 0.03, Math.sin(a) * 1.0);
    g.add(nac);
    const ring = new THREE.Mesh(geo.ring, accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0);
    g.add(ring);
    const rotor = new THREE.Group();
    rotor.position.copy(ring.position);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(geo.blade, hullMat);
      blade.rotation.y = (b / 3) * Math.PI * 2;
      rotor.add(blade);
    }
    g.add(rotor);
    rotors.push({ rotor, dir: i % 2 === 0 ? 1 : -1 });
  }

  // light strips + under ring
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2);
    const s = new THREE.Mesh(geo.strip, accentMat);
    s.position.set(Math.cos(a) * 0.56, -0.02, Math.sin(a) * 0.56);
    s.rotation.y = -a + Math.PI / 2;
    g.add(s);
  }
  const under = new THREE.Mesh(geo.underRing, accentMat);
  under.rotation.x = Math.PI / 2;
  under.position.y = -0.14;
  g.add(under);

  const light = new THREE.PointLight(UNIT_COLORS[unit], 0, 5, 2);
  light.position.y = -0.4;
  g.add(light);
  const glow = glowSprite(UNIT_COLORS[unit], 2.6, 1.3, 0);
  glow.position.y = -0.35;
  g.add(glow);

  // soft blob shadow lives on the floor, outside the group
  const shadowMat = new THREE.SpriteMaterial({
    map: glow.material.map, color: 0x000000, transparent: true,
    opacity: 0.5, depthWrite: false,
  });
  const shadow = new THREE.Sprite(shadowMat);
  shadow.scale.set(2.4, 1.2, 1);

  // per-unit silhouettes
  if (unit === 'fb') g.scale.set(1.14, 0.94, 1.14);
  if (unit === 'ig') canopy.scale.setScalar(1.1);
  if (unit === 'tt') accentMat.color.lerp(new THREE.Color(0x4be1ff), 0.18);
  if (unit === 'px') { g.scale.setScalar(0.82); }

  const pad = world.pads.find(p => p.unit === unit);
  const home = pad.pos.clone().add(new THREE.Vector3(0, 0.62, 0));
  g.position.copy(home);
  shadow.position.set(home.x, pad.pos.y + 0.15, home.z);
  scene.add(g);
  scene.add(shadow);

  return {
    unit, group: g, rotors, eye, accentMat, accentBase: accentMat.color.clone(),
    light, glow, shadow, home, phase: Math.random() * 6.28,
    sim: { rpm: 0.02, wake: 0, lift: 0, boost: 0, padK: unit === 'px' ? 1 : 0 },
    launching: false,
  };
}

/* scroll choreography feeds pad power here — drones spin up + rise as bays light */
export function setPadPower(unit, k) {
  const d = drones[unit];
  if (d) d.sim.padK = k;
}

/* ---------- wake / launch API ---------- */
export function wake(unit, on) {
  const d = drones[unit];
  if (!d) return;
  if (on && d.sim.wakeTarget !== 1) { audio.hoverBlip(); bus.emit('drone:wake', unit); }
  d.sim.wakeTarget = on ? 1 : 0;
}

export function launch(unit, opts = {}) {
  const d = drones[unit];
  if (!d || d.launching || unit === 'px') return false;
  d.launching = true;
  const gsap = window.gsap;
  const social = SOCIALS[unit];

  let openHandled = !!opts.skipOpen;
  const doOpen = () => {
    if (openHandled) return;
    openHandled = true;
    if (opts.dryRun) { bus.emit('drone:open-stub', { unit, url: social.url }); return; }
    const w = window.open(social.url, '_blank', 'noopener');
    if (!w) bus.emit('drone:blocked', unit);
  };
  // Safari refuses async window.open — fire in the same gesture stack
  const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (safari && !opts.skipOpen && !opts.dryRun) doOpen();

  bus.emit('drone:launch', unit);
  audio.whoosh(0.9, 0.28);

  if (!state.motionOK) {
    doOpen();
    d.launching = false;
    bus.emit('drone:docked', unit);
    return true;
  }

  const g = d.group;
  const trailTimer = { t: 0 };
  const tl = gsap.timeline({
    onUpdate: () => {
      // energy trail while ascending
      if (d.sim.lift > 0.4) {
        trailTimer.t += tl.deltaTime ? 0 : 0;
        spawnTrail(d);
      }
    },
    onComplete: () => {
      d.launching = false;
      bus.emit('drone:docked', unit);
    },
  });

  tl.to(d.sim, { boost: 1, duration: 0.45, ease: 'power2.in' }, 0)
    .to(d.sim, { lift: 1.7, duration: 0.75, ease: 'power2.in' }, 0.25)
    .add(() => audio.whoosh(1.2, 0.5), 0.85)
    .to(d.sim, { lift: 8.5, duration: 1.1, ease: 'power2.in' }, 0.95)
    .to(cine, { w: 0.85, duration: 0.55, ease: 'power2.out' }, 0.7)
    .add(doOpen, 1.8)
    .add(() => bus.emit('drone:portal', unit), 1.9)
    .to(cine, { w: 0, duration: 0.7, ease: 'power2.inOut' }, 2.25)
    .add(() => { d.sim.lift = 4.5; }, 2.95)          // reappear above the pad
    .to(d.sim, { lift: 0, duration: 1.3, ease: 'power3.out' }, 3.05)
    .to(d.sim, { boost: 0, duration: 0.6 }, 3.4)
    .add(() => audio.blip(520, 0.1, 0.1), 4.1);

  cine.fn = () => ({
    pos: new THREE.Vector3(g.position.x + 2.4, g.position.y + 1.2, g.position.z + 4.8),
    tgt: g.position.clone(),
  });

  // watchdog for throttled-rAF contexts: never strand the cinematic.
  // progress(1, false) = do NOT suppress events, so doOpen/portal still fire.
  setTimeout(() => { if (d.launching) { tl.progress(1, false); } }, 6500);
  return true;
}

/* ---------- energy trail (pooled glow sprites, no shaders) ---------- */
const trailPool = [];
let lastTrail = 0;
function spawnTrail(d) {
  const now = performance.now();
  if (now - lastTrail < 70) return;
  lastTrail = now;
  let s = trailPool.pop();
  if (!s) s = glowSprite(UNIT_COLORS[d.unit], 1.4, 1.4, 0.5);
  s.material.color.set(UNIT_COLORS[d.unit]);
  s.material.opacity = 0.5;
  s.scale.set(1.4, 1.4, 1);
  s.position.copy(d.group.position).add(new THREE.Vector3(0, -0.5, 0));
  scene.add(s);
  window.gsap.to(s.material, {
    opacity: 0, duration: 0.9, ease: 'power1.out',
    onComplete: () => { scene.remove(s); trailPool.push(s); },
  });
  window.gsap.to(s.scale, { x: 0.4, y: 2.6, duration: 0.9, ease: 'power1.out' });
}

/* ---------- per-frame sim ---------- */
const mouseN = { x: 0 };
function tick(dt, t) {
  for (const unit in drones) {
    const d = drones[unit];
    const s = d.sim;
    s.wake = damp(s.wake, s.wakeTarget || 0, 6, dt);
    const targetRpm = 0.04 + s.padK * 0.12 + s.wake * 0.4 + s.boost * 0.9;
    s.rpm = damp(s.rpm, targetRpm, 3.2, dt);

    for (const r of d.rotors) r.rotor.rotation.y += s.rpm * r.dir * dt * 46;

    // powered-down drones crouch on the pad; they rise as their bay lights up
    const bob = Math.sin(t * 2 + d.phase) * 0.035 * (0.4 + s.rpm);
    d.group.position.y = d.home.y - 0.26 + s.padK * 0.3 + bob * s.padK + s.wake * 0.22 + s.lift;
    d.group.rotation.z = Math.sin(t * 1.3 + d.phase) * 0.01 * (1 - s.boost);
    d.group.rotation.x = -0.08 * s.boost;
    d.group.rotation.y = damp(d.group.rotation.y, mouseN.x * 0.16 * s.wake, 2.4, dt);

    const powered = 0.1 + s.padK * 0.9;
    const glowK = (0.75 + s.wake * 1.0 + s.boost * 2.2) * powered;
    d.accentMat.color.copy(d.accentBase).multiplyScalar(glowK);
    d.light.intensity = s.wake * 2.0 + s.boost * 3.5;
    d.glow.material.opacity = s.wake * 0.32 + s.boost * 0.4;

    const alt = d.group.position.y - d.home.y;
    d.shadow.position.x = d.group.position.x;
    d.shadow.position.z = d.group.position.z;
    d.shadow.material.opacity = Math.max(0, 0.5 - alt * 0.16);
    const sc = 2.4 + alt * 0.5;
    d.shadow.scale.set(sc, sc * 0.5, 1);
  }
}

export function getDroneMats() { return { hullMat, chromeMat }; }

export function initDrones() {
  for (const unit of ['ig', 'tt', 'fb', 'px']) drones[unit] = makeDrone(unit);
  window.addEventListener('pointermove', e => {
    mouseN.x = (e.clientX / window.innerWidth) * 2 - 1;
  }, { passive: true });
  onFrame(tick, 12);

  window.__SIG = Object.assign(window.__SIG || {}, {
    drones: {
      list: drones,
      wake,
      launch: (u, o) => launch(u, o || {}),
    },
  });
}
