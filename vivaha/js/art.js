// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — the hand-painted layer
// Everything drawn here is painted stroke by stroke onto canvases at boot:
// the gate mandala, the Ganesha invocation, the Om, the divine murals, the
// couple's shadow-puppet silhouettes, the marble invitation, the map, the
// gallery miniatures. No images are loaded, ever.
// ═══════════════════════════════════════════════════════════════════════════
import { makeCanvas, mulberry32 } from './utils.js';
import { COUPLE, WEDDING } from './config.js';

const GOLD = '#ffce7a';
const GOLD_DIM = 'rgba(255,206,122,0.55)';
const TAU = Math.PI * 2;

function glowStroke(ctx, width, color = GOLD, blur = 14) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

// ── the gate's filigree disc ────────────────────────────────────────────────
export function mandalaDisc(size = 1024) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.translate(c, c);
  const R = size * 0.48;
  glowStroke(ctx, 2.5, GOLD, 10);

  // concentric decorated rings
  const rings = [0.16, 0.28, 0.4, 0.53, 0.66, 0.8, 0.93];
  rings.forEach((rr, k) => {
    const r = R * rr;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.globalAlpha = 0.85; ctx.stroke();
    const n = 12 + k * 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.save(); ctx.rotate(a);
      ctx.globalAlpha = 0.9;
      if (k % 3 === 0) {          // petal ticks
        ctx.beginPath();
        ctx.moveTo(r - 6, 0);
        ctx.quadraticCurveTo(r + R * 0.035, R * 0.02, r + R * 0.055, 0);
        ctx.quadraticCurveTo(r + R * 0.035, -R * 0.02, r - 6, 0);
        ctx.stroke();
      } else if (k % 3 === 1) {   // dots
        ctx.beginPath(); ctx.arc(r + 8, 0, 3.2, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
      } else {                    // little arcs
        ctx.beginPath(); ctx.arc(r + 10, 0, 7, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      }
      ctx.restore();
    }
  });
  // 24 spokes of tiny diamonds
  for (let i = 0; i < 24; i++) {
    ctx.save(); ctx.rotate((i / 24) * TAU);
    for (let d = 0.2; d < 0.9; d += 0.14) {
      const r = R * d;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(r, -4); ctx.lineTo(r + 6, 0); ctx.lineTo(r, 4); ctx.lineTo(r - 6, 0);
      ctx.closePath(); ctx.fillStyle = GOLD_DIM; ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

// ── श्री गणेशाय नमः — the first invocation, as living line-carving ─────────
export function ganeshaMedallion(size = 1024) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.translate(c, c * 1.02);
  const S = size / 512; // stroke scale
  glowStroke(ctx, 5 * S, GOLD, 16);

  // halo
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(0, -30 * S, 190 * S, 0, TAU); ctx.stroke();
  ctx.setLineDash([2 * S, 14 * S]);
  ctx.beginPath(); ctx.arc(0, -30 * S, 210 * S, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 222 * S, -30 * S + Math.sin(a) * 222 * S);
    ctx.lineTo(Math.cos(a) * 238 * S, -30 * S + Math.sin(a) * 238 * S);
    ctx.globalAlpha = 0.5; ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // crown — three tiers
  glowStroke(ctx, 6 * S, GOLD, 16);
  ctx.beginPath();
  ctx.moveTo(-52 * S, -148 * S);
  ctx.quadraticCurveTo(0, -196 * S, 52 * S, -148 * S);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34 * S, -172 * S);
  ctx.quadraticCurveTo(0, -212 * S, 34 * S, -172 * S);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -212 * S); ctx.lineTo(0, -232 * S);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -238 * S, 6 * S, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();

  // ears — great mirrored paisleys
  [-1, 1].forEach((m) => {
    ctx.beginPath();
    ctx.moveTo(m * 44 * S, -128 * S);
    ctx.bezierCurveTo(m * 148 * S, -178 * S, m * 172 * S, -44 * S, m * 76 * S, -22 * S);
    ctx.bezierCurveTo(m * 60 * S, -18 * S, m * 48 * S, -44 * S, m * 52 * S, -66 * S);
    ctx.stroke();
    // inner ear curl
    ctx.beginPath();
    ctx.moveTo(m * 68 * S, -110 * S);
    ctx.quadraticCurveTo(m * 116 * S, -118 * S, m * 104 * S, -66 * S);
    ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  });

  // head dome + tilak + eyes
  ctx.beginPath();
  ctx.moveTo(-52 * S, -128 * S);
  ctx.quadraticCurveTo(0, -158 * S, 52 * S, -128 * S);
  ctx.stroke();
  ctx.beginPath(); // tilak — crescent + dot
  ctx.arc(0, -118 * S, 12 * S, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -134 * S, 4 * S, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
  [-1, 1].forEach((m) => {  // gentle sleeping eyes
    ctx.beginPath();
    ctx.moveTo(m * 14 * S, -96 * S);
    ctx.quadraticCurveTo(m * 30 * S, -88 * S, m * 44 * S, -96 * S);
    ctx.stroke();
  });

  // trunk — the great S, curling left to a modak
  glowStroke(ctx, 7 * S, GOLD, 18);
  ctx.beginPath();
  ctx.moveTo(-10 * S, -84 * S);
  ctx.bezierCurveTo(-4 * S, -44 * S, 26 * S, -36 * S, 24 * S, -6 * S);
  ctx.bezierCurveTo(22 * S, 22 * S, -8 * S, 30 * S, -30 * S, 22 * S);
  ctx.bezierCurveTo(-46 * S, 16 * S, -50 * S, 0, -40 * S, -6 * S);
  ctx.stroke();
  // modak at the trunk's tip
  ctx.beginPath(); ctx.arc(-46 * S, 10 * S, 10 * S, 0, TAU); ctx.stroke();
  // tusk (right whole, left broken — as the scribe of the Mahabharata)
  ctx.beginPath();
  ctx.moveTo(18 * S, -74 * S);
  ctx.quadraticCurveTo(44 * S, -62 * S, 40 * S, -44 * S);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-20 * S, -74 * S);
  ctx.quadraticCurveTo(-30 * S, -68 * S, -32 * S, -60 * S);
  ctx.stroke();

  // body — the generous belly, folded legs
  glowStroke(ctx, 6 * S, GOLD, 16);
  ctx.beginPath();
  ctx.moveTo(-58 * S, -20 * S);
  ctx.bezierCurveTo(-108 * S, 44 * S, -70 * S, 122 * S, 0, 122 * S);
  ctx.bezierCurveTo(70 * S, 122 * S, 108 * S, 44 * S, 58 * S, -20 * S);
  ctx.stroke();
  // belly band
  ctx.beginPath();
  ctx.moveTo(-62 * S, 54 * S);
  ctx.quadraticCurveTo(0, 74 * S, 62 * S, 54 * S);
  ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  // folded legs
  ctx.beginPath();
  ctx.moveTo(-64 * S, 116 * S);
  ctx.quadraticCurveTo(0, 92 * S, 64 * S, 116 * S);
  ctx.stroke();

  // four arms — upper pair: goad & noose-lotus · lower pair: blessing & modak
  [-1, 1].forEach((m) => {
    // upper arm sweeping outward-up
    ctx.beginPath();
    ctx.moveTo(m * 52 * S, -6 * S);
    ctx.bezierCurveTo(m * 118 * S, -18 * S, m * 138 * S, -66 * S, m * 124 * S, -96 * S);
    ctx.stroke();
    if (m === 1) { // lotus bud
      ctx.beginPath(); ctx.arc(124 * S, -104 * S, 9 * S, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(116 * S, -100 * S); ctx.quadraticCurveTo(124 * S, -118 * S, 132 * S, -100 * S);
      ctx.stroke();
    } else { // goad curl
      ctx.beginPath(); ctx.arc(-124 * S, -104 * S, 9 * S, Math.PI * 0.2, Math.PI * 1.5); ctx.stroke();
    }
    // lower arm resting forward
    ctx.beginPath();
    ctx.moveTo(m * 58 * S, 34 * S);
    ctx.quadraticCurveTo(m * 96 * S, 56 * S, m * 78 * S, 84 * S);
    ctx.stroke();
    // open palm
    ctx.beginPath(); ctx.arc(m * 76 * S, 92 * S, 8 * S, 0, TAU); ctx.stroke();
  });

  // lotus seat
  glowStroke(ctx, 4.5 * S, GOLD, 12);
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    const x = i * 26 * S;
    ctx.moveTo(x - 16 * S, 138 * S);
    ctx.quadraticCurveTo(x, 118 * S, x + 16 * S, 138 * S);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-124 * S, 138 * S); ctx.lineTo(124 * S, 138 * S);
  ctx.stroke();

  // mouse companion — two humble arcs, bottom right
  ctx.beginPath();
  ctx.moveTo(96 * S, 132 * S);
  ctx.quadraticCurveTo(116 * S, 118 * S, 132 * S, 132 * S);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(134 * S, 128 * S, 2.5 * S, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();

  return canvas;
}

// ── text plates ─────────────────────────────────────────────────────────────
export function textPlate(text, { w = 1024, h = 192, font = '600 64px "Noto Serif Devanagari", serif', sub = null, subFont = '400 30px "Cinzel", serif', color = GOLD } = {}) {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  glowStroke(ctx, 1, color, 18);
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.font = font;
  ctx.fillText(text, w / 2, sub ? h * 0.36 : h / 2);
  if (sub) {
    ctx.font = subFont;
    ctx.globalAlpha = 0.75;
    ctx.fillText(sub, w / 2, h * 0.74);
    ctx.globalAlpha = 1;
  }
  return canvas;
}

export function omMedallion(size = 768) {
  const { canvas, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.translate(c, c);
  glowStroke(ctx, 3, GOLD, 12);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.44, 0, TAU); ctx.stroke();
  ctx.setLineDash([3, 17]);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.48, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 16; i++) {
    ctx.save(); ctx.rotate((i / 16) * TAU);
    ctx.beginPath();
    ctx.moveTo(size * 0.35, 0); ctx.lineTo(size * 0.41, 0);
    ctx.globalAlpha = 0.55; ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.shadowColor = GOLD; ctx.shadowBlur = 30;
  ctx.font = `700 ${size * 0.42}px "Noto Serif Devanagari", serif`;
  ctx.fillText('ॐ', 0, size * 0.02);
  return canvas;
}

// ── divine presence, abstracted into light: four mural variants ────────────
export function divineMural(seed = 1, w = 512, h = 832) {
  const { canvas, ctx } = makeCanvas(w, h);
  const rnd = mulberry32(seed * 997);
  const cx = w / 2;

  // border — twin columns of diamonds
  glowStroke(ctx, 2, GOLD_DIM, 8);
  for (const x of [26, w - 26]) {
    for (let y = 30; y < h - 30; y += 34) {
      ctx.beginPath();
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y);
      ctx.closePath(); ctx.stroke();
    }
  }

  // halo stack behind the crown
  glowStroke(ctx, 3, GOLD, 14);
  const hy = h * 0.3;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.85 - i * 0.25;
    ctx.beginPath(); ctx.arc(cx, hy, 78 + i * 34, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // radial beams
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    ctx.globalAlpha = 0.4 + rnd() * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 150, hy + Math.sin(a) * 150);
    ctx.lineTo(cx + Math.cos(a) * (185 + rnd() * 40), hy + Math.sin(a) * (185 + rnd() * 40));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the presence — a flame-bodied figure of pure light (no face, only radiance)
  glowStroke(ctx, 4, GOLD, 22);
  ctx.beginPath();
  ctx.moveTo(cx, hy - 64);
  ctx.bezierCurveTo(cx + 58, hy + 6, cx + 44, h * 0.56, cx, h * 0.62);
  ctx.bezierCurveTo(cx - 44, h * 0.56, cx - 58, hy + 6, cx, hy - 64);
  ctx.stroke();
  ctx.beginPath(); // inner flame
  ctx.moveTo(cx, hy - 20);
  ctx.bezierCurveTo(cx + 26, hy + 20, cx + 20, h * 0.5, cx, h * 0.54);
  ctx.bezierCurveTo(cx - 20, h * 0.5, cx - 26, hy + 20, cx, hy - 20);
  ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
  // bindu heart
  ctx.beginPath(); ctx.arc(cx, h * 0.42, 6, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();

  // blessing arcs either side (as raised palms of light)
  [-1, 1].forEach((m) => {
    ctx.beginPath();
    ctx.arc(cx + m * 92, h * 0.46, 26, Math.PI * (m === 1 ? 1.5 : 0.5), Math.PI * (m === 1 ? 0.5 : 1.5), m === 1);
    ctx.stroke();
  });

  // lotus throne
  glowStroke(ctx, 3.5, GOLD, 12);
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 34;
    ctx.beginPath();
    ctx.moveTo(x - 22, h * 0.7);
    ctx.quadraticCurveTo(x, h * 0.64, x + 22, h * 0.7);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx - 120, h * 0.705); ctx.lineTo(cx + 120, h * 0.705); ctx.stroke();

  // rising offerings — dots ascending
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    ctx.beginPath();
    ctx.arc(cx + (rnd() - 0.5) * 260, h * (0.78 + rnd() * 0.16), 1.5 + rnd() * 2.5, 0, TAU);
    ctx.fillStyle = GOLD; ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

// ── the couple, as shadow-puppet silhouettes (Tholu Bommalata) ─────────────
export function coupleSilhouette(w = 1600, h = 1000) {
  const { canvas, ctx } = makeCanvas(w, h);
  const ink = '#0c0508';
  const baseY = h * 0.94;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;

  // ——— GROOM (left, facing right) ———
  const gx = w * 0.40;
  ctx.beginPath();
  // safa (turban), tall with a proud kalgi sweep
  ctx.moveTo(gx - 58, baseY - 520);
  ctx.quadraticCurveTo(gx - 66, baseY - 596, gx - 8, baseY - 612);
  ctx.quadraticCurveTo(gx + 52, baseY - 622, gx + 64, baseY - 556);
  ctx.quadraticCurveTo(gx + 70, baseY - 528, gx + 56, baseY - 512);
  // face profile facing right
  ctx.quadraticCurveTo(gx + 70, baseY - 500, gx + 66, baseY - 480);
  ctx.quadraticCurveTo(gx + 62, baseY - 462, gx + 46, baseY - 452);
  // neck & shoulder back
  ctx.quadraticCurveTo(gx + 44, baseY - 436, gx + 52, baseY - 424);
  // chest → extended forearm reaching right to her hand
  ctx.quadraticCurveTo(gx + 96, baseY - 402, gx + 118, baseY - 368);
  ctx.quadraticCurveTo(gx + 148, baseY - 330, gx + 190, baseY - 318);
  // hand
  ctx.quadraticCurveTo(gx + 206, baseY - 314, gx + 204, baseY - 300);
  ctx.quadraticCurveTo(gx + 186, baseY - 288, gx + 168, baseY - 296);
  // underside of arm back to torso
  ctx.quadraticCurveTo(gx + 130, baseY - 300, gx + 96, baseY - 330);
  ctx.quadraticCurveTo(gx + 80, baseY - 344, gx + 70, baseY - 342);
  // sherwani front falling straight, slight flare
  ctx.quadraticCurveTo(gx + 78, baseY - 220, gx + 64, baseY - 96);
  // hem
  ctx.lineTo(gx + 20, baseY - 92);
  // legs: churidar + mojari with curled toes
  ctx.lineTo(gx + 26, baseY - 18);
  ctx.quadraticCurveTo(gx + 30, baseY - 4, gx + 52, baseY - 6);
  ctx.quadraticCurveTo(gx + 62, baseY - 8, gx + 60, baseY);
  ctx.lineTo(gx - 26, baseY);
  ctx.quadraticCurveTo(gx - 30, baseY - 10, gx - 22, baseY - 20);
  ctx.lineTo(gx - 30, baseY - 92);
  // sherwani back
  ctx.quadraticCurveTo(gx - 78, baseY - 100, gx - 72, baseY - 250);
  ctx.quadraticCurveTo(gx - 70, baseY - 380, gx - 50, baseY - 440);
  // back shoulder → nape
  ctx.quadraticCurveTo(gx - 54, baseY - 470, gx - 58, baseY - 520);
  ctx.closePath();
  ctx.fill();
  // kalgi plume
  ctx.beginPath();
  ctx.moveTo(gx + 30, baseY - 614);
  ctx.quadraticCurveTo(gx + 52, baseY - 668, gx + 22, baseY - 700);
  ctx.quadraticCurveTo(gx + 44, baseY - 664, gx + 18, baseY - 618);
  ctx.closePath(); ctx.fill();

  // ——— BRIDE (right, facing left) ———
  const bx = w * 0.62;
  ctx.beginPath();
  // head with low bun, face profile facing left
  ctx.moveTo(bx - 34, baseY - 508);
  ctx.quadraticCurveTo(bx - 44, baseY - 486, bx - 38, baseY - 470);
  ctx.quadraticCurveTo(bx - 46, baseY - 458, bx - 30, baseY - 446);
  // chin → neck
  ctx.quadraticCurveTo(bx - 24, baseY - 436, bx - 26, baseY - 424);
  // arm reaching forward-left; hands meet
  ctx.quadraticCurveTo(bx - 60, baseY - 396, bx - 88, baseY - 352);
  ctx.quadraticCurveTo(bx - 110, baseY - 320, bx - 138, baseY - 310);
  ctx.quadraticCurveTo(bx - 152, baseY - 306, bx - 148, baseY - 294);
  ctx.quadraticCurveTo(bx - 130, baseY - 284, bx - 114, baseY - 292);
  ctx.quadraticCurveTo(bx - 76, baseY - 296, bx - 48, baseY - 322);
  // blouse → waist
  ctx.quadraticCurveTo(bx - 32, baseY - 330, bx - 26, baseY - 320);
  ctx.quadraticCurveTo(bx - 22, baseY - 280, bx - 34, baseY - 252);
  // the lehenga — a great bell
  ctx.bezierCurveTo(bx - 150, baseY - 180, bx - 190, baseY - 60, bx - 178, baseY);
  // scalloped hem
  const hemL = bx - 178, hemR = bx + 168;
  const scallops = 7;
  for (let i = 0; i <= scallops; i++) {
    const x1 = hemL + ((hemR - hemL) / scallops) * i;
    const xm = x1 - (hemR - hemL) / scallops / 2;
    if (i > 0) ctx.quadraticCurveTo(xm, baseY - 16, x1, baseY);
  }
  // right side of lehenga up
  ctx.bezierCurveTo(bx + 178, baseY - 80, bx + 132, baseY - 200, bx + 30, baseY - 258);
  // back of blouse → shoulder
  ctx.quadraticCurveTo(bx + 24, baseY - 300, bx + 28, baseY - 340);
  ctx.quadraticCurveTo(bx + 34, baseY - 396, bx + 24, baseY - 436);
  // bun with flowers
  ctx.quadraticCurveTo(bx + 44, baseY - 448, bx + 38, baseY - 472);
  ctx.quadraticCurveTo(bx + 58, baseY - 488, bx + 30, baseY - 508);
  ctx.quadraticCurveTo(bx + 8, baseY - 524, bx - 12, baseY - 518);
  ctx.quadraticCurveTo(bx - 30, baseY - 516, bx - 34, baseY - 508);
  ctx.closePath();
  ctx.fill();

  // dupatta — arcing from her bun back over the lehenga
  ctx.beginPath();
  ctx.moveTo(bx - 6, baseY - 516);
  ctx.bezierCurveTo(bx + 120, baseY - 560, bx + 210, baseY - 420, bx + 186, baseY - 210);
  ctx.quadraticCurveTo(bx + 180, baseY - 160, bx + 150, baseY - 130);
  ctx.quadraticCurveTo(bx + 168, baseY - 230, bx + 148, baseY - 340);
  ctx.quadraticCurveTo(bx + 130, baseY - 452, bx + 22, baseY - 496);
  ctx.closePath();
  ctx.fill();

  // ——— joined hands: the garland hangs between them ———
  const hx = (gx + 186 + (bx - 130)) / 2, hy = baseY - 294;
  ctx.save();
  glowStroke(ctx, 3, GOLD, 10);
  ctx.beginPath();
  ctx.moveTo(hx - 40, hy);
  ctx.quadraticCurveTo(hx, hy + 88, hx + 40, hy - 2);
  ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const px = hx - 40 + 80 * t;
    const py = hy + Math.sin(Math.PI * t) * 84 * 0.5 + (1 - Math.abs(t - 0.5) * 2) * 4;
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU);
    ctx.fillStyle = i % 2 ? '#ffb84d' : '#ff7a3c'; ctx.fill();
  }
  ctx.restore();

  // ——— cut-work: light punched through the puppet ———
  ctx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  // groom: button line + sleeve dots
  for (let i = 0; i < 7; i++) punch(gx + 30 - i * 1.5, baseY - 420 + i * 44, 4);
  for (let i = 0; i < 5; i++) punch(gx + 108 + i * 16, baseY - 352 + i * 9, 3);
  // turban jewels
  punch(gx + 10, baseY - 566, 6); punch(gx - 22, baseY - 556, 4); punch(gx + 38, baseY - 556, 4);
  // bride: lehenga — rows of paisley-dots following the bell
  for (let row = 0; row < 4; row++) {
    const ry = baseY - 40 - row * 52;
    const spread = 150 - row * 26;
    const n = 9 - row;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      punch(bx - spread + spread * 2 * t, ry + Math.sin(t * Math.PI) * -14, 5 - row * 0.5);
    }
  }
  // dupatta stars
  for (let i = 0; i < 8; i++) punch(bx + 150 + Math.sin(i * 2.3) * 22, baseY - 190 - i * 34, 3);
  // bun flowers
  punch(bx + 22, baseY - 492, 5); punch(bx + 34, baseY - 478, 4);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}

// ── the marble invitation itself ────────────────────────────────────────────
export function invitationPlate(w = 1180, h = 1500) {
  const { canvas, ctx } = makeCanvas(w, h);
  const cx = w / 2;
  ctx.textAlign = 'center';

  // twin filigree border
  glowStroke(ctx, 3, GOLD, 8);
  ctx.strokeRect(46, 46, w - 92, h - 92);
  ctx.setLineDash([2, 10]);
  ctx.strokeRect(68, 68, w - 136, h - 136);
  ctx.setLineDash([]);
  // corner paisley curls
  const corner = (x, y, sx, sy) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.quadraticCurveTo(0, 0, 60, 0);
    ctx.moveTo(14, 60);
    ctx.quadraticCurveTo(16, 16, 60, 14);
    ctx.beginPath();
    ctx.moveTo(10, 90); ctx.quadraticCurveTo(4, 30, 24, 24); ctx.quadraticCurveTo(52, 16, 46, 44);
    ctx.quadraticCurveTo(42, 62, 26, 56);
    ctx.stroke();
    ctx.restore();
  };
  corner(80, 80, 1, 1); corner(w - 80, 80, -1, 1);
  corner(80, h - 80, 1, -1); corner(w - 80, h - 80, -1, -1);

  ctx.fillStyle = GOLD;
  ctx.shadowColor = GOLD; ctx.shadowBlur = 16;

  ctx.font = '600 44px "Noto Serif Devanagari", serif';
  ctx.fillText('॥ श्री गणेशाय नमः ॥', cx, 170);

  ctx.shadowBlur = 6;
  ctx.font = '400 30px "Cinzel", serif';
  ctx.globalAlpha = 0.8;
  ctx.fillText('TOGETHER  WITH  THEIR  FAMILIES', cx, 268);
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 22;
  ctx.font = '700 128px "Cinzel", serif';
  ctx.fillText(COUPLE.groom.toUpperCase(), cx, 420);
  // lotus-ampersand
  ctx.font = 'italic 400 76px "Cormorant Garamond", serif';
  ctx.fillText('weds', cx, 528);
  ctx.font = '700 128px "Cinzel", serif';
  ctx.fillText(COUPLE.bride.toUpperCase(), cx, 672);

  // rule with center diamond
  glowStroke(ctx, 2, GOLD, 8);
  ctx.beginPath(); ctx.moveTo(cx - 240, 740); ctx.lineTo(cx - 22, 740); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 22, 740); ctx.lineTo(cx + 240, 740); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, 730); ctx.lineTo(cx + 10, 740); ctx.lineTo(cx, 750); ctx.lineTo(cx - 10, 740);
  ctx.closePath(); ctx.stroke();

  ctx.shadowBlur = 10;
  ctx.font = '500 46px "Cormorant Garamond", serif';
  ctx.fillText(WEDDING.dateLine, cx, 830);
  ctx.font = 'italic 400 36px "Cormorant Garamond", serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(WEDDING.muhurat, cx, 895);
  ctx.globalAlpha = 1;

  ctx.font = '400 40px "Cinzel", serif';
  ctx.fillText(WEDDING.venue.toUpperCase(), cx, 1000);
  ctx.font = 'italic 400 34px "Cormorant Garamond", serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(WEDDING.venueCity, cx, 1054);
  ctx.globalAlpha = 1;

  ctx.font = '400 30px "Cormorant Garamond", serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText(COUPLE.blessing, cx, 1180);
  ctx.globalAlpha = 1;

  ctx.font = '600 34px "Noto Serif Devanagari", serif';
  ctx.fillText('॥ शुभ विवाह ॥', cx, 1290);

  ctx.font = '400 26px "Cinzel", serif';
  ctx.globalAlpha = 0.65;
  ctx.fillText(COUPLE.hashtag.toUpperCase(), cx, 1380);
  ctx.globalAlpha = 1;

  return canvas;
}

// the names, in flowing script — revealed as if written by the thread
export function namesScript(w = 1600, h = 460) {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9b8';
  ctx.shadowColor = '#ffce7a'; ctx.shadowBlur = 26;
  ctx.font = '400 190px "Great Vibes", cursive';
  ctx.fillText(`${COUPLE.groom}  &  ${COUPLE.bride}`, w / 2, h / 2);
  return canvas;
}

// ── a hand-drawn map for the venue panel ────────────────────────────────────
export function venueMap(w = 900, h = 600) {
  const { canvas, ctx } = makeCanvas(w, h);
  // parchment
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#241a12'); bg.addColorStop(1, '#191016');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // the lake
  glowStroke(ctx, 3, GOLD, 10);
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.3);
  ctx.bezierCurveTo(w * 0.42, h * 0.12, w * 0.75, h * 0.2, w * 0.82, h * 0.46);
  ctx.bezierCurveTo(w * 0.88, h * 0.7, w * 0.6, h * 0.88, w * 0.38, h * 0.8);
  ctx.bezierCurveTo(w * 0.14, h * 0.7, w * 0.06, h * 0.44, w * 0.2, h * 0.3);
  ctx.stroke();
  // ripple hatching
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 14; i++) {
    const y = h * (0.28 + i * 0.042);
    ctx.beginPath();
    ctx.moveTo(w * (0.22 + Math.sin(i) * 0.04), y);
    ctx.quadraticCurveTo(w * 0.5, y + 6, w * (0.74 - Math.sin(i) * 0.03), y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the palace — island with domes
  const px = w * 0.5, py = h * 0.48;
  ctx.beginPath(); ctx.ellipse(px, py + 26, 92, 24, 0, 0, TAU); ctx.stroke();
  glowStroke(ctx, 3.5, GOLD, 14);
  ctx.beginPath(); // main dome
  ctx.arc(px, py - 6, 26, Math.PI, 0);
  ctx.lineTo(px + 26, py + 18); ctx.lineTo(px - 26, py + 18); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px, py - 32); ctx.lineTo(px, py - 44); ctx.stroke();
  [-52, 52].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(px + dx, py + 2, 14, Math.PI, 0);
    ctx.lineTo(px + dx + 14, py + 18); ctx.lineTo(px + dx - 14, py + 18); ctx.closePath(); ctx.stroke();
  });

  // ghat + boat route
  glowStroke(ctx, 2.5, GOLD_DIM, 6);
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.62);
  ctx.quadraticCurveTo(w * 0.3, h * 0.62, px - 70, py + 30);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); // little boat
  ctx.moveTo(w * 0.3, h * 0.635);
  ctx.quadraticCurveTo(w * 0.315, h * 0.665, w * 0.35, h * 0.64);
  ctx.stroke();

  // compass rose
  const rx = w * 0.86, ry = h * 0.16;
  glowStroke(ctx, 2, GOLD, 8);
  ctx.beginPath(); ctx.arc(rx, ry, 30, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rx, ry - 26); ctx.lineTo(rx + 7, ry); ctx.lineTo(rx, ry + 26); ctx.lineTo(rx - 7, ry);
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = '600 20px "Cinzel", serif'; ctx.textAlign = 'center';
  ctx.fillText('N', rx, ry - 38);

  // labels
  ctx.fillStyle = GOLD;
  ctx.font = 'italic 500 26px "Cormorant Garamond", serif';
  ctx.fillText('Lake Pichola', w * 0.32, h * 0.24);
  ctx.font = '600 24px "Cinzel", serif';
  ctx.fillText(WEDDING.venue, px, py + 74);
  ctx.font = 'italic 400 22px "Cormorant Garamond", serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('boats every 15 minutes from Bansi Ghat', w * 0.34, h * 0.7);
  ctx.globalAlpha = 1;
  return canvas;
}

// ── gallery placeholders: six little dusk miniatures ────────────────────────
export function miniature(seed = 1, w = 640, h = 460) {
  const { canvas, ctx } = makeCanvas(w, h);
  const rnd = mulberry32(seed * 313 + 7);
  // dusk sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const hues = [
    ['#2a0f2e', '#c2452e', '#f5a54a'],
    ['#1a1030', '#7a2848', '#f2b23c'],
    ['#0d1530', '#3a4878', '#e8956a'],
  ][seed % 3];
  sky.addColorStop(0, hues[0]); sky.addColorStop(0.62, hues[1]); sky.addColorStop(0.8, hues[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // moon/sun
  ctx.beginPath();
  ctx.arc(w * (0.25 + rnd() * 0.5), h * (0.2 + rnd() * 0.2), 26 + rnd() * 18, 0, TAU);
  ctx.fillStyle = 'rgba(255,240,210,0.92)'; ctx.fill();
  // water
  const wy = h * 0.68;
  ctx.fillStyle = 'rgba(10,6,20,0.85)'; ctx.fillRect(0, wy, w, h - wy);
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#f2b23c'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const y = wy + 8 + i * 9;
    ctx.beginPath(); ctx.moveTo(w * rnd() * 0.3, y); ctx.lineTo(w * (0.6 + rnd() * 0.38), y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // palace silhouette
  ctx.fillStyle = '#120818';
  const bx = w * (0.3 + rnd() * 0.3);
  ctx.beginPath();
  ctx.moveTo(bx - 120, wy);
  ctx.lineTo(bx - 120, wy - 60); ctx.lineTo(bx - 70, wy - 60);
  ctx.arc(bx - 45, wy - 60, 25, Math.PI, 0);
  ctx.lineTo(bx - 20, wy - 60); ctx.lineTo(bx - 20, wy - 90);
  ctx.arc(bx + 10, wy - 90, 30, Math.PI, 0);
  ctx.lineTo(bx + 40, wy - 60); ctx.lineTo(bx + 90, wy - 60);
  ctx.arc(bx + 108, wy - 60, 18, Math.PI, 0);
  ctx.lineTo(bx + 126, wy); ctx.closePath(); ctx.fill();
  // two tiny figures
  ctx.fillStyle = '#0a0410';
  ctx.beginPath(); ctx.arc(w * 0.5 - 8, wy - 8, 5, 0, TAU); ctx.fill();
  ctx.fillRect(w * 0.5 - 12, wy - 6, 8, 16);
  ctx.beginPath(); ctx.arc(w * 0.5 + 8, wy - 7, 5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.5 + 2, wy + 10); ctx.lineTo(w * 0.5 + 8, wy - 4); ctx.lineTo(w * 0.5 + 16, wy + 10); ctx.closePath(); ctx.fill();
  // gilded border
  ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.globalAlpha = 0.8;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.globalAlpha = 1;
  return canvas;
}
