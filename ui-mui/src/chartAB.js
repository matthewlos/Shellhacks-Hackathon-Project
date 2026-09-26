import { CFG } from './sim.js';
import { clamp } from './format.js';

// Control page chart: box A (blue) and box B (orange) moisture over the run, the baseline dashed,
// the wet limit shaded, a dot on its line for every pour. Canvas, redrawn with each sim render.

function firstIndex(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; }
  return lo;
}

export function drawAB(cv, fh, win, hoverX, hhmm, C) {
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = `12px ${C.font}`;
  if ('fontVariantNumeric' in ctx) ctx.fontVariantNumeric = 'tabular-nums';

  const Lp = 40, R = 8, top = 8, axisH = 20;
  const plotW = W - Lp - R, plotH = H - top - axisH;
  const span = win === 'all' ? Math.max(3600, fh.t) : win * 3600;
  const tEnd = Math.max(span, fh.t), tStart = tEnd - span;
  const X = (t) => Lp + ((t - tStart) / span) * plotW;
  const lo = 15, hi = 85;
  const Y = (v) => top + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * plotH;

  const hist = fh.history;
  const i0 = firstIndex(hist, tStart);
  const stride = Math.max(1, Math.floor((hist.length - i0) / (plotW * 1.5)));
  const pts = [];
  for (let i = i0; i < hist.length; i += stride) pts.push(hist[i]);
  if (hist.length && pts[pts.length - 1] !== hist[hist.length - 1]) pts.push(hist[hist.length - 1]);

  // wet limit: shaded above WET_PCT
  ctx.fillStyle = C.wetFill;
  ctx.fillRect(Lp, top, plotW, Y(CFG.WET_PCT) - top);
  ctx.fillStyle = C.muted; ctx.textBaseline = 'middle';
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (const v of [25, 50, 75]) {
    ctx.beginPath(); ctx.moveTo(Lp, Y(v) + 0.5); ctx.lineTo(W - R, Y(v) + 0.5); ctx.stroke();
    ctx.fillText(v + '%', 0, Y(v));
  }
  ctx.textAlign = 'right';
  ctx.fillText(`wet above ${CFG.WET_PCT}%`, W - R - 4, top + 10);
  // baseline, dashed
  ctx.strokeStyle = C.baseline; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(Lp, Y(CFG.DRY_PCT)); ctx.lineTo(W - R, Y(CFG.DRY_PCT)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.muted;
  ctx.fillText(`baseline ${CFG.DRY_PCT}%`, W - R - 4, Y(CFG.DRY_PCT) + 10);
  ctx.textAlign = 'left';

  if (pts.length < 2) {
    ctx.textAlign = 'center'; ctx.font = `14px ${C.font}`;
    ctx.fillText('Waiting for readings…', Lp + plotW / 2, top + plotH / 2);
    ctx.textAlign = 'left'; ctx.font = `12px ${C.font}`;
  }
  const line = (key, color) => {
    const p = pts.filter((q) => q[key] != null);
    if (p.length < 2) return;
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(X(q.t), Y(q[key])) : ctx.moveTo(X(q.t), Y(q[key]))));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  };
  line('b', C.b);
  line('a', C.a);

  // pours: a dot on its box's line
  for (const p of fh.pours) {
    if (p.ts < tStart) continue;
    const i = Math.min(hist.length - 1, firstIndex(hist, p.ts));
    if (i < 0 || !hist[i]) continue;
    const v = p.pot === 'B' ? hist[i].b : hist[i].a;
    if (v == null) continue;
    ctx.beginPath(); ctx.arc(X(p.ts), Y(v), 4, 0, 7);
    ctx.fillStyle = p.pot === 'B' ? C.b : C.a; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.surface; ctx.stroke();
  }

  ctx.fillStyle = C.muted; ctx.textBaseline = 'alphabetic';
  const nT = plotW < 420 ? 2 : 4;
  for (let k = 0; k <= nT; k++) {
    const t = tStart + (span * k) / nT;
    if (t < 0) continue;
    ctx.textAlign = k === 0 ? 'left' : k === nT ? 'right' : 'center';
    ctx.fillText(hhmm(t), Lp + (plotW * k) / nT, H - 4);
  }
  ctx.textAlign = 'left';

  if (hoverX == null || hoverX < Lp || !pts.length) return null;
  const t = tStart + ((hoverX - Lp) / plotW) * span;
  let bi = 0;
  pts.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(pts[bi].t - t)) bi = i; });
  const best = pts[bi], x = X(best.t);
  ctx.strokeStyle = C.cursor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 0.5, top); ctx.lineTo(x + 0.5, top + plotH); ctx.stroke();
  return { x, W, time: hhmm(best.t), a: best.a, b: best.b };
}
