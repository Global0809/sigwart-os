// SIGWART_OS // gl/camera — one continuous pose track through the facility.
// A single writer owns the camera: scroll progress → piecewise-linear key track
// → critically-damped chase (the damping IS the cinematic feel) → optional
// cine-blend (drone launches) → mouse parallax.

import * as THREE from 'three';
import { camera as cam } from './stage.mjs';
import { onFrame, state, clamp, damp } from '../core.mjs';

const track = [];   // { p, pos, tgt } sorted by p
let P = 0;

const goalPos = new THREE.Vector3(0, 2.2, 9);
const goalTgt = new THREE.Vector3(0, 2.4, -2);
const curPos = goalPos.clone();
const curTgt = goalTgt.clone();
const finalPos = new THREE.Vector3();
const finalTgt = new THREE.Vector3();

/* cine blend — drones.mjs tweens cine.w and provides cine.fn() → { pos, tgt } */
export const cine = { fn: null, w: 0 };

const mouse = { x: 0, y: 0 };

export function setProgress(p) { P = clamp(p, 0, 1); }

function key(px, docH, pos, tgt) {
  track.push({
    p: clamp(px / docH, 0, 1),
    pos: new THREE.Vector3(pos[0], pos[1], pos[2]),
    tgt: new THREE.Vector3(tgt[0], tgt[1], tgt[2]),
  });
}

export function recompute() {
  track.length = 0;
  const vh = window.innerHeight;
  const docH = Math.max(1, document.documentElement.scrollHeight - vh);
  const el = id => document.getElementById(id);
  const top = id => el(id).offsetTop;
  const hgt = id => el(id).offsetHeight;

  const opT = top('operator'), opH = hgt('operator');
  const veT = top('vehicle'), veH = hgt('vehicle');
  const haT = top('hangar'), haH = hgt('hangar');
  const coT = top('comms');

  // B00 atrium
  key(0, docH, [0, 2.2, 9], [0, 2.4, -2]);
  key(opT - vh * 0.5, docH, [0, 0.4, 7.6], [0, -0.6, -1]);
  // shaft descent behind operator / vehicle panels
  key(opT + opH * 0.5, docH, [0, -10, 7.4], [0, -12.5, 0]);
  key(veT + veH * 0.55, docH, [0, -23, 7.4], [0, -25.5, 0]);
  // hangar: approach → doors part → one slow, satisfying push-in (no lateral rail)
  const zb = vh > window.innerWidth ? 11 : 0;   // portrait phones pull back to frame all three bays
  key(haT, docH, [0, -33.5, 9.5 + zb * 0.4], [0, -36.5, -2]);
  key(haT + vh * 1.0, docH, [0, -38.6, 13.2 + zb], [0, -41, -3]);
  key(haT + haH * 0.52, docH, [0, -39.8, 10.4 + zb], [0, -42.1, -2]);
  key(haT + haH * 0.94, docH, [0, -40.3, 9.0 + zb], [0, -42.5, -1.6]);
  // comms — extra mid key so the final descent arcs in instead of plunging
  key(coT + vh * 0.15, docH, [3.2, -50.5, 10.5], [1.2, -54.5, -3]);
  key(coT + vh * 0.8, docH, [0, -58.4, 10.8], [0, -59.7, -6]);
  key(docH, docH, [0, -59.2, 8.2], [0, -60.0, -5.5]);

  track.sort((a, b) => a.p - b.p);
}

function sample(p) {
  if (track.length === 0) return;
  if (p <= track[0].p) {
    goalPos.copy(track[0].pos); goalTgt.copy(track[0].tgt);
    return;
  }
  for (let i = 1; i < track.length; i++) {
    if (p <= track[i].p) {
      const a = track[i - 1], b = track[i];
      const t = (p - a.p) / Math.max(b.p - a.p, 1e-5);
      goalPos.lerpVectors(a.pos, b.pos, t);
      goalTgt.lerpVectors(a.tgt, b.tgt, t);
      return;
    }
  }
  const last = track[track.length - 1];
  goalPos.copy(last.pos); goalTgt.copy(last.tgt);
}

function tick(dt, t) {
  sample(P);

  if (state.motionOK) {
    // idle breathing
    goalPos.x += Math.sin(t * 0.5) * 0.06;
    goalPos.y += Math.cos(t * 0.37) * 0.035;
    // mouse-responsive framing (fine pointers)
    if (state.fine) {
      goalPos.x += mouse.x * 0.42;
      goalPos.y += -mouse.y * 0.26;
      goalTgt.x += mouse.x * 0.66;
      goalTgt.y += -mouse.y * 0.4;
    }
  }

  const k = state.motionOK ? 5.4 : 40;
  curPos.x = damp(curPos.x, goalPos.x, k, dt);
  curPos.y = damp(curPos.y, goalPos.y, k, dt);
  curPos.z = damp(curPos.z, goalPos.z, k, dt);
  curTgt.x = damp(curTgt.x, goalTgt.x, k, dt);
  curTgt.y = damp(curTgt.y, goalTgt.y, k, dt);
  curTgt.z = damp(curTgt.z, goalTgt.z, k, dt);

  if (cine.w > 0.001 && cine.fn) {
    const c = cine.fn(t);
    finalPos.lerpVectors(curPos, c.pos, cine.w);
    finalTgt.lerpVectors(curTgt, c.tgt, cine.w);
  } else {
    finalPos.copy(curPos);
    finalTgt.copy(curTgt);
  }

  cam.position.copy(finalPos);
  cam.lookAt(finalTgt);
}

export function initCamera() {
  recompute();
  if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', recompute);
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  onFrame(tick, 20);

  window.__SIG = Object.assign(window.__SIG || {}, {
    goto: (p) => { setProgress(p); },
    camTrack: track,
  });
}
