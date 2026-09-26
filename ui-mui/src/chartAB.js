import { CFG } from './sim.js';

/*
 * Vs timer chart (round 6, spec 9.V.2): box A (Farm Hand, creek blue) and box B (Timer, orange) soil moisture.
 * Canvas, redrawn with each sim render. No legend: each line is named at its end, the band edges are named
 * inside the plot, and pours sit on a rug under the plot (a dot for Farm Hand, a hollow square for the timer),
 * so the two series differ in shape and label as well as color (deuteranopia).
 *
 * The small pieces (bucketing, the fitted y axis, round-hour ticks, end labels) are exported as `chartKit`
 * so another chart in the app can share the same craft.
 */

// ---------- shared kit ------------------------------------------------------------------------------------

function firstIndex(arr, t, key = 't') {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid][key] < t) lo = mid + 1; else hi = mid; }
  return lo;
}

/**
 * Bucket rows into means (B16). rows: sorted by rows[i][tKey]. keys: the value fields to average (nulls skipped).
 * `tail`: an optional newest row not yet in `rows` (the live reading).
 * Returns [{ t, n, [key]: mean | null }], one per non-empty bucket, t = the mean time of the rows in it.
 */
export function bucketMeans(rows, { tKey = 't', keys, from = -Infinity, to = Infinity, size, tail = null }) {
  const out = [];
  let cur = null;
  const n = rows.length + (tail ? 1 : 0);
  for (let i = firstIndex(rows, from, tKey); i < n; i++) {
    const r = i < rows.length ? rows[i] : tail, t = r[tKey];
    if (t > to) break;
    const k = Math.floor(t / size);
    if (!cur || cur.k !== k) {
      if (cur) out.push(close(cur));
      cur = { k, st: 0, n: 0, s: {}, c: {} };
    }
    cur.st += t; cur.n++;
    for (const key of keys) {
      const v = r[key];
      if (v != null && !Number.isNaN(v)) { cur.s[key] = (cur.s[key] || 0) + v; cur.c[key] = (cur.c[key] || 0) + 1; }
    }
  }
  if (cur) out.push(close(cur));
  return out;
  function close(b) {
    const o = { t: b.st / b.n, n: b.n };
    for (const key of keys) o[key] = b.c[key] ? b.s[key] / b.c[key] : null;
    return o;
  }
}

/**
 * A light triangular smoothing over bucket means (weights 1-2-3-2-1), so ADC quantization steps don't read
 * as a staircase. Nulls stay null and are skipped. Returns new objects; the input is untouched.
 */
export function smooth(pts, keys, r = 2) {
  return pts.map((p, i) => {
    const o = { ...p };
    for (const k of keys) {
      if (p[k] == null) continue;
      let s = 0, w = 0;
      for (let j = Math.max(0, i - r); j <= Math.min(pts.length - 1, i + r); j++) {
        if (pts[j][k] == null) continue;
        const wt = r + 1 - Math.abs(j - i);
        s += wt * pts[j][k]; w += wt;
      }
      o[k] = s / w;
    }
    return o;
  });
}

/** A fitted y axis (B18): steps of 5 around the data and the band edges it must show. */
export function fitY(values, { must = [], floor = 20, ceil = 80, pad = 3, minSpan = 10 } = {}) {
  const v = values.filter((x) => x != null);
  const lo0 = Math.min(...v, ...must), hi0 = Math.max(...v, ...must, (must[0] ?? lo0) + minSpan);
  const lo = Math.max(floor, Math.floor((lo0 - pad) / 5) * 5);
  const hi = Math.min(ceil, Math.ceil((hi0 + pad) / 5) * 5);
  const step = hi - lo <= 25 ? 5 : 10;
  const ticks = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push(y);
  return { lo, hi, step, ticks };
}

/**
 * Round-hour ticks (B17). toMs(t) turns a chart time into epoch ms (wall clock). Picks the smallest step in
 * [1, 2, 3, 6, 12, 24] h with at most maxTicks ticks, placed where the local hour is a multiple of the step.
 */
export function hourTicks(tStart, tEnd, toMs, maxTicks, fromMs) {
  const d = new Date(toMs(tStart));
  d.setMinutes(0, 0, 0);
  if (d.getTime() < toMs(tStart)) d.setHours(d.getHours() + 1);
  const hours = [];
  for (let n = 0; n < 24 * 400 && d.getTime() <= toMs(tEnd); n++) { hours.push(new Date(d)); d.setHours(d.getHours() + 1); }
  for (const step of [1, 2, 3, 6, 12, 24]) {
    const hit = hours.filter((h) => h.getHours() % step === 0);
    if (hit.length <= Math.max(1, maxTicks)) return hit.map((h) => fromMs(h.getTime()));
  }
  return [];
}
// "9:00 AM" reads "9 AM" on a round hour; 24-hour locales keep "09:00".
export const hourLabel = (s) => s.replace(/:00(?=\s)/, '');

/**
 * End-of-line labels: [{ y, color, name, value }] -> drawn right of each line's last point, pushed apart
 * symmetrically when closer than their height. Two lines (name over value) when the right padding is narrow.
 */
export function endLabels(ctx, items, { x, font, minY, maxY, room }) {
  ctx.font = `600 12px ${font}`;
  const wide = items.every((it) => ctx.measureText(`${it.name} ${it.value}`).width <= room);
  const h = wide ? 16 : 30;
  const ys = items.map((it) => it.y);
  if (items.length === 2 && Math.abs(ys[0] - ys[1]) < h) {
    const mid = (ys[0] + ys[1]) / 2, up = ys[0] <= ys[1] ? 0 : 1;
    ys[up] = mid - h / 2; ys[1 - up] = mid + h / 2;
  }
  const lift = Math.max(0, ...ys.map((y) => y + h / 2 - maxY)), drop = Math.max(0, ...ys.map((y) => minY - (y - h / 2)));
  items.forEach((it, i) => {
    const y = ys[i] - lift + drop;
    ctx.fillStyle = it.color; ctx.textAlign = 'left';
    if (wide) { ctx.textBaseline = 'middle'; ctx.fillText(`${it.name} ${it.value}`, x, y); }
    else { ctx.textBaseline = 'alphabetic'; ctx.fillText(it.name, x, y - 2); ctx.fillText(it.value, x, y + 12); }
  });
  ctx.textBaseline = 'alphabetic';
}

export const chartKit = { bucketMeans, smooth, fitY, hourTicks, hourLabel, endLabels };

// ---------- the Vs timer chart ----------------------------------------------------------------------------

/**
 * drawAB(cv, fh, win, hoverX, hhmm, C) -> hover tip | null
 * C: { a, b, aText, bText, band, edge, ink, muted, grid, surface, cursor, font, padR }
 */
export function drawAB(cv, fh, win, hoverX, hhmm, C) {
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if ('fontVariantNumeric' in ctx) ctx.fontVariantNumeric = 'tabular-nums';
  const f12 = `12px ${C.font}`;
  ctx.font = f12;

  // plot box: y labels left, end labels right, then the pour rug and the time labels under the plot
  const Lp = 40, R = C.padR ?? 128, top = 10, rugH = 10, labH = 20;
  const plotW = Math.max(40, W - Lp - R), plotB = H - labH - rugH - 4, plotH = plotB - top;
  const span = win === 'all' ? Math.max(3600, fh.t) : win * 3600;
  const tEnd = Math.max(span, fh.t), tStart = tEnd - span;
  const X = (t) => Lp + ((t - tStart) / span) * plotW;

  const size = Math.max(60, (span / plotW) * 2);
  // history gets a row every 10 sim seconds; the live reading rides along as the newest point, so a fresh
  // page draws from its first reading (B7) and the end labels match the numbers elsewhere.
  const lastH = fh.history[fh.history.length - 1];
  const tail = fh.latest && (!lastH || lastH.t < fh.t) ? { t: fh.t, a: fh.nowPct(), b: fh.nowPctB() } : null;
  const raw = bucketMeans(fh.history, { keys: ['a', 'b'], from: tStart, to: tEnd, size, tail });
  const pts = smooth(raw, ['a', 'b']);
  const { lo, hi, ticks } = fitY(pts.flatMap((p) => [p.a, p.b]), { must: [CFG.DRY_PCT] });
  const Y = (v) => top + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * plotH;
  const right = Lp + plotW;

  // band: between min and full (or the top of the plot when full is off the scale)
  const bandTop = Y(Math.min(CFG.WET_PCT, hi));
  ctx.fillStyle = C.band;
  ctx.fillRect(Lp, bandTop, plotW, Y(CFG.DRY_PCT) - bandTop);

  // gridlines and y labels
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.fillStyle = C.muted; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (const v of ticks) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(Lp, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillText(v + '%', Lp - 8, Y(v));
  }
  ctx.textAlign = 'left';

  // band edges: min dashed, full solid (only when on the scale)
  ctx.strokeStyle = C.edge;
  ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(Lp, Y(CFG.DRY_PCT)); ctx.lineTo(right, Y(CFG.DRY_PCT)); ctx.stroke();
  ctx.setLineDash([]);
  const showFull = CFG.WET_PCT <= hi;
  if (showFull) {
    const y = Math.round(Y(CFG.WET_PCT)) + 0.5;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Lp, y); ctx.lineTo(right, y); ctx.stroke();
  }

  // the series: bucket means, B first then A, broken where a box has no reading
  const line = (key, color) => {
    ctx.beginPath();
    let pen = false;
    for (const q of pts) {
      if (q[key] == null) { pen = false; continue; }
      if (pen) ctx.lineTo(X(q.t), Y(q[key])); else ctx.moveTo(X(q.t), Y(q[key]));
      pen = true;
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  };
  line('b', C.b);
  line('a', C.a);

  // the pour rug, at each pour's start time
  const rugY = plotB + 4 + rugH / 2;
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Lp, plotB + 0.5); ctx.lineTo(right, plotB + 0.5); ctx.stroke();
  for (const p of fh.pours) {
    const t0 = p.ts - p.ran_ms / 1000;
    if (t0 < tStart || t0 > tEnd) continue;
    const x = X(t0);
    if (p.by === 'hand') {
      ctx.fillStyle = C.edge; ctx.fillRect(Math.round(x), rugY - 4, 1, 8);
    } else if (p.pot === 'B') {
      ctx.strokeStyle = C.b; ctx.lineWidth = 1.5; ctx.strokeRect(x - 3, rugY - 3, 6, 6);
    } else {
      ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(x, rugY, 3, 0, 7); ctx.fill();
    }
  }

  // time labels on round hours, none cut off at either end
  ctx.fillStyle = C.muted; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = f12;
  const toMs = (t) => fh.t0 + t * 1000, fromMs = (ms) => (ms - fh.t0) / 1000;
  for (const t of hourTicks(tStart, tEnd, toMs, Math.floor(plotW / 110), fromMs)) {
    const s = hourLabel(hhmm(t)), w = ctx.measureText(s).width, x = X(t);
    // a tick exactly on a plot edge reads inward; any other label that would be cut off is dropped
    const align = x - w / 2 >= Lp - 8 ? (x + w / 2 <= right ? 'center' : x >= right - 0.5 ? 'right' : null) : x <= Lp + 0.5 ? 'left' : null;
    if (!align) continue;
    ctx.textAlign = align;
    ctx.fillText(s, x, H - 4);
    ctx.fillRect(Math.round(x), plotB + 1, 1, 3);
  }

  // band names, inside the plot at the left end, with a paper halo so a line can't cut them
  const halo = (s, x, y) => {
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = C.surface; ctx.strokeText(s, x, y);
    ctx.fillStyle = C.muted; ctx.fillText(s, x, y);
  };
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  halo(`min ${CFG.DRY_PCT}%`, Lp + 6, Y(CFG.DRY_PCT) + 4);
  if (showFull) halo(`full ${CFG.WET_PCT}%`, Lp + 6, Y(CFG.WET_PCT) + 4);
  ctx.textBaseline = 'alphabetic';

  // no data at all: say so (B7). One bucket or more: draw what exists.
  if (fh.latest == null || !pts.length) {
    if (fh.latest == null) {
      ctx.textAlign = 'center'; ctx.font = `14px ${C.font}`; ctx.fillStyle = C.muted;
      ctx.fillText('No readings yet', Lp + plotW / 2, top + plotH / 2);
      ctx.textAlign = 'left'; ctx.font = f12;
    }
    return null;
  }

  // end labels: a dot on each line's last point, then its name and value
  // the dot sits on the drawn (smoothed) line; the words give the last bucket's own mean
  const last = (key) => { for (let i = pts.length - 1; i >= 0; i--) if (pts[i][key] != null) return i; return -1; };
  const ends = [];
  for (const [key, dot, textC, name] of [['a', C.a, C.aText, 'Farm Hand'], ['b', C.b, C.bText, 'Timer']]) {
    const i = last(key);
    if (i < 0) continue;
    const p = pts[i];
    ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(X(p.t), Y(p[key]), 3, 0, 7); ctx.fill();
    ends.push({ y: Y(p[key]), color: textC, name, value: `${raw[i][key].toFixed(1)}%`, x: X(p.t) });
  }
  const ex = Math.max(...ends.map((e) => e.x)) + 8;
  endLabels(ctx, ends, { x: ex, font: C.font, minY: top, maxY: plotB, room: W - ex - 2 });
  ctx.font = f12;

  // hover: the nearest bucket
  if (hoverX == null || hoverX < Lp || hoverX > right) return null;
  const t = tStart + ((hoverX - Lp) / plotW) * span;
  let bi = 0;
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(pts[bi].t - t)) bi = i;
  const best = pts[bi], x = X(best.t);
  ctx.strokeStyle = C.cursor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, top); ctx.lineTo(Math.round(x) + 0.5, plotB); ctx.stroke();
  return { x, W, time: hhmm(best.t), a: best.a, b: best.b };
}
