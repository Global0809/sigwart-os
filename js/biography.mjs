// Liquid dossier: visible-only effects, smoothed reflections and a single count-in.
// Reuse the site's existing frame loop; never compete with its card transforms.
import { state, onFrame } from './core.mjs';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const panels = [...document.querySelectorAll('.artist-id, .bio-dossier')].map(el => ({
  el, visible: false, x: 50, y: 30, tx: 50, ty: 30,
}));
const metrics = document.querySelector('.bio-metrics');
const values = [...document.querySelectorAll('.bio-value')].map(el => ({
  el, value: Number(el.dataset.value), shown: Number(el.dataset.value),
}));
let metricsVisible = false;
let elapsed = 0;
let counting = false;
let counted = false;
const motionOK = () => state.motionOK && !reduced.matches;

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.target === metrics) {
      metricsVisible = entry.isIntersecting;
      continue;
    }
    const panel = panels.find(p => p.el === entry.target);
    if (!panel) continue;
    panel.visible = entry.isIntersecting;
    panel.el.classList.toggle('bio-in-view', panel.visible);
  }
}, { threshold: 0.12 });

for (const panel of panels) {
  observer.observe(panel.el);
  panel.el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !motionOK() || !panel.visible) return;
    const r = panel.el.getBoundingClientRect();
    panel.tx = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
    panel.ty = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
  }, { passive: true });
  panel.el.addEventListener('pointerleave', () => { panel.tx = 50; panel.ty = 30; });
}
if (metrics) observer.observe(metrics);

const visibility = () => document.body.classList.toggle('bio-tab-hidden', document.hidden);
document.addEventListener('visibilitychange', visibility);
visibility();

function finishCounts() {
  for (const item of values) {
    item.el.textContent = String(item.value);
    item.shown = item.value;
  }
  counting = false;
  counted = true;
}
reduced.addEventListener('change', () => { if (reduced.matches) finishCounts(); });

onFrame(dt => {
  if (document.hidden || state.phase !== 'active') return;
  if (!motionOK()) {
    if (!counted || counting) finishCounts();
    return;
  }
  for (const p of panels) {
    if (!p.visible || (Math.abs(p.tx - p.x) < .05 && Math.abs(p.ty - p.y) < .05)) continue;
    const ease = 1 - Math.exp(-6 * dt);
    p.x += (p.tx - p.x) * ease;
    p.y += (p.ty - p.y) * ease;
    p.el.style.setProperty('--bio-x', `${p.x.toFixed(2)}%`);
    p.el.style.setProperty('--bio-y', `${p.y.toFixed(2)}%`);
  }
  if (metricsVisible && !counted) { counting = true; counted = true; }
  if (!counting || !metricsVisible) return;
  elapsed = Math.min(1.6, elapsed + dt);
  const progress = 1 - Math.pow(1 - elapsed / 1.6, 3);
  for (const item of values) {
    const next = Math.round(item.value * progress);
    if (next !== item.shown) { item.el.textContent = String(next); item.shown = next; }
  }
  if (elapsed >= 1.6) finishCounts();
}, 45);
