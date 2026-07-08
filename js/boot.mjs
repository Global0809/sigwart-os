// SIGWART_OS // boot — the one required gesture, terminal typing, blast-door reveal

import { bus, state, setPhase } from './core.mjs';
import * as audio from './audio.mjs';

const LINES = [
  'SIGWART_OS v5.0 // KERNEL ONLINE',
  'MEM CHECK ........ 640TB OK',
  'AUDIO ENGINE ..... ARMED',
  'HOLO ARRAY ....... 4/4',
  'DRONE BAYS ....... 3+1 DOCKED',
  'REFLECTORS ....... CALIBRATED',
  'BIOSIGN .......... OSB.DJ.50 OK',
  '',
  '> DESCENT AUTHORIZED. WELCOME.',
];
const FAST_LINES = [
  'SIGWART_OS v5.0 // KERNEL WARM',
  'SESSION RESTORED',
  '',
  '> DESCENT AUTHORIZED.',
];

let term, btn, typingTimer = 0, skipRequested = false, sequenceDone = false;

export function initBoot() {
  term = document.getElementById('boot-term');
  btn = document.getElementById('boot-init');

  btn.addEventListener('click', () => {
    if (state.phase !== 'boot-idle') return;
    audio.unlock();                    // synchronous, inside the gesture
    audio.powerSwell();
    audio.blip(660, 0.09, 0.12);
    btn.disabled = true;
    setPhase('boot-run');
    bus.emit('boot:started');
    runSequence();
  });

  // skip typing
  document.getElementById('boot').addEventListener('click', e => {
    if (state.phase === 'boot-run' && e.target !== btn) skipRequested = true;
  });
  document.addEventListener('keydown', e => {
    if (state.phase === 'boot-run' && (e.key === 'Escape' || e.key === ' ')) skipRequested = true;
  });
}

function runSequence() {
  const fast = !!sessionStorage.getItem('sig.booted');
  const lines = fast ? FAST_LINES : LINES;

  if (!state.motionOK) {
    term.textContent = lines.join('\n');
    setTimeout(reveal, 300);
    return;
  }

  let li = 0, ci = 0, outBuf = '';
  term.textContent = '';
  const speed = fast ? 6 : 13;

  typingTimer = setInterval(() => {
    if (skipRequested) {
      clearInterval(typingTimer);
      term.textContent = lines.join('\n');
      setTimeout(reveal, 220);
      return;
    }
    const line = lines[li];
    if (ci < line.length) {
      outBuf += line[ci];
      if (ci % 3 === 0) audio.tick();
      ci++;
    } else {
      audio.chirp(li);
      outBuf += '\n';
      li++; ci = 0;
      if (li >= lines.length) {
        clearInterval(typingTimer);
        term.textContent = outBuf;
        setTimeout(reveal, 420);
        return;
      }
    }
    term.textContent = outBuf + '▌';
  }, speed);
}

function reveal() {
  if (sequenceDone) return;
  sequenceDone = true;
  setPhase('reveal');
  audio.rumble(1.5, 0.36);
  audio.padUp();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    setPhase('active');
    sessionStorage.setItem('sig.booted', '1');
    bus.emit('boot:done');
  };

  if (!state.motionOK || !window.gsap) {
    finish();
    return;
  }

  const tl = window.gsap.timeline({ onComplete: finish });
  tl.to('.boot-frame', { opacity: 0, y: -16, scale: 0.985, duration: 0.45, ease: 'power2.in' }, 0)
    .to('.boot-scanline', { opacity: 0, duration: 0.25 }, 0)
    .to('.bd-l', { xPercent: -102, duration: 1.15, ease: 'power4.inOut' }, 0.3)
    .to('.bd-r', { xPercent: 102, duration: 1.15, ease: 'power4.inOut' }, 0.3);

  // hero entrance while the doors part
  tl.from('.gate-titles > *', { y: 26, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 0.75)
    .from('.portrait-rig', { y: 30, opacity: 0, scale: 0.975, duration: 1.0, ease: 'power3.out' }, 0.85)
    .from('.gate-cue', { opacity: 0, duration: 0.6 }, 1.4);

  // watchdog: if rAF is being throttled (hidden tab, embedded preview), jump to the
  // final state rather than stranding the visitor mid-reveal. progress(1) fires onComplete.
  setTimeout(() => { if (!finished) tl.progress(1); }, 3400);
}
