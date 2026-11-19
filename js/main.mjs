// SIGWART_OS // main — entry + orchestration

import { bus, state, startLoop, onFrame } from './core.mjs';
import { detectCaps, governorFrame } from './capabilities.mjs';
import * as audio from './audio.mjs';
import { initBoot } from './boot.mjs';
import { initHud, toast } from './hud.mjs';
import { initStage } from './gl/stage.mjs';
import { buildWorld, tickWorld, world } from './gl/world.mjs';
import { initParticles, tickParticles } from './gl/particles.mjs';
import { initCamera } from './gl/camera.mjs';
import { initDrones } from './gl/drones.mjs';
import { initScroll } from './scroll.mjs';
import { initOverlays } from './overlays.mjs';
import { initInteractions } from './interactions.mjs?v=8';
import { sharedMats } from './gl/world.mjs';
import { getDroneMats } from './gl/drones.mjs';

const BANNER = [
  ' ┌────────────────────────────────────────────┐',
  ' │  ◆  SIGWART_OS v5.0                        │',
  ' │     UNDERGROUND HEADQUARTERS               │',
  ' │                                            │',
  ' │  curious operator detected.                │',
  ' │  > hold SHIFT ......... x-ray optics       │',
  ' │  > type Y2K ........... crt archive mode   │',
  ' │  > the hangar wall hides a fourth drone.   │',
  ' └────────────────────────────────────────────┘',
].join('\n');

function assertVendors() {
  const missing = [];
  if (!window.gsap) missing.push('gsap');
  if (!window.ScrollTrigger) missing.push('ScrollTrigger');
  if (!window.Draggable) missing.push('Draggable');
  if (!window.InertiaPlugin) missing.push('InertiaPlugin');
  if (!window.Lenis) missing.push('Lenis');
  if (missing.length) {
    console.error('[SIGWART_OS] missing vendored libs:', missing.join(', '));
    return false;
  }
  window.gsap.registerPlugin(window.ScrollTrigger, window.Draggable, window.InertiaPlugin);
  return true;
}

function init() {
  console.log('%c' + BANNER, 'color:#8a5cff;font-family:monospace;font-size:11px;line-height:1.5');

  // the experience always begins at the gate — no half-scrolled reloads
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const ok = assertVendors();
  detectCaps();
  initHud();
  initBoot();

  let glOK = false;
  try {
    initStage();
    buildWorld();
    initParticles();
    initCamera();
    initDrones();
    onFrame((dt, t) => {
      tickWorld(dt, t);
      tickParticles(dt, t);
      // reactive sound: slime gurgles when the liquid is disturbed, wind rises with scroll
      const b0 = world.blobs[0];
      const jiggle = b0 && b0.mvv ? Math.min(b0.mvv.length() * 0.22, 1) : 0;
      audio.setSlime(Math.min((world.stir || 0) * 0.7 + jiggle, 1));
      audio.setWind(Math.min(Math.abs(state.scrollVel || 0) * 1.1, 1));
    }, 10);
    glOK = true;
  } catch (err) {
    console.error('[SIGWART_OS] GL stage failed — running in flat mode', err);
    document.getElementById('gl').style.display = 'none';
  }

  if (ok) {
    try {
      initScroll();
      if (glOK) {
        initOverlays();
        window.__SIG_MATS = Object.assign({}, sharedMats, getDroneMats());
      }
      initInteractions();
    } catch (err) {
      console.error('[SIGWART_OS] interaction layer failed', err);
    }
  }

  startLoop();
  onFrame(governorFrame, 50);

  window.__SIG = Object.assign(window.__SIG || {}, { audio, toast, world });

  if (!ok) {
    // vendored libs failed (offline copy moved?) — stay functional: skip cinematics
    document.body.dataset.state = 'active';
  }

  bus.on('boot:done', () => {
    toast('WELCOME BACK, OPERATOR', 2600);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
