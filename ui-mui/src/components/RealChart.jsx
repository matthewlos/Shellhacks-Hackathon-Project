import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { clockAt } from '../boxData.js';

/*
 * One history line from the real box, drawn with the Vs timer chart's craft (spec 9.V.2): bucket medians instead of
 * raw points, a fitted y axis, round-time x ticks, an end label instead of a legend, the baseline as a dashed line
 * labelled in the plot. SVG sized 1:1 to its measured width, so 12 px text stays 12 px.
 *
 * Real data has holes (the board drops off WiFi, the probe gets unplugged). The line breaks wherever two buckets
 * are further apart than one bucket plus a minute, so a gap is drawn as a gap, never as a straight line across it.
 */
const STEPS = [300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];

function median(xs) {
  const s = xs.slice().sort((p, q) => p - q), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Bucket medians of `pts` ([{ts, v}], ts in s, sorted) into buckets of `size` s. */
function buckets(pts, size) {
  const out = [];
  let cur = null;
  for (const p of pts) {
    const k = Math.floor(p.ts / size);
    if (!cur || cur.k !== k) { cur = { k, ts: [], v: [] }; out.push(cur); }
    cur.ts.push(p.ts); cur.v.push(p.v);
  }
  return out.map((b) => ({ ts: b.ts.reduce((s, x) => s + x, 0) / b.ts.length, v: median(b.v) }));
}

export default function RealChart({
  rows, pick, domain, name, unit, decimals = 1, colorKey, baseline = null, height, yFit, title, ariaName, tickUnit = '',
}) {
  const theme = useTheme();
  const color = colorKey.split('.').reduce((o, k) => o?.[k], theme.palette);
  const box = useRef(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState(null);
  useLayoutEffect(() => {
    const el = box.current;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const narrow = W < 600;
  const Lp = 40, Rp = narrow ? 96 : 120, top = 12, bottom = 28;
  const plotW = Math.max(10, W - Lp - Rp), plotH = height - top - bottom;
  const [t0, t1] = domain;
  const span = Math.max(60, t1 - t0);

  const pts = useMemo(() => rows.map((r) => ({ ts: r.ts, v: pick(r) })).filter((p) => p.v != null), [rows, pick]);
  const size = Math.max(60, Math.ceil((span / plotW) * 2));
  const B = useMemo(() => buckets(pts, size), [pts, size]);

  if (!W) return <Box ref={box} sx={{ height }} />;

  const vals = B.map((b) => b.v);
  const [lo, hi, grid] = yFit(vals.length ? Math.min(...vals) : null, vals.length ? Math.max(...vals) : null);
  const X = (t) => Lp + ((t - t0) / span) * plotW;
  const Y = (v) => top + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * plotH;

  // line segments, broken at gaps
  const segs = [];
  B.forEach((b, i) => {
    if (!i || b.ts - B[i - 1].ts > size + 60) segs.push([]);
    segs[segs.length - 1].push(b);
  });
  const d = segs
    .map((s) => s.map((b, i) => `${i ? 'L' : 'M'}${X(b.ts).toFixed(1)},${Y(b.v).toFixed(1)}`).join(''))
    .join('');
  const lone = segs.filter((s) => s.length === 1).map((s) => s[0]);

  // x ticks at round local times
  // the smallest round step whose ticks (actually in range) fit about one per 80-110 px
  const maxTicks = Math.max(2, Math.floor(plotW / (narrow ? 72 : 110)));
  const tz = new Date(t0 * 1000).getTimezoneOffset() * 60;   // round in local time, not UTC
  const tickAt = (step) => {
    const out = [];
    for (let t = Math.ceil((t0 - tz) / step) * step + tz; t <= t1; t += step) out.push(t);
    return out;
  };
  let ticks = [];
  for (const s of STEPS) { ticks = tickAt(s); if (ticks.length <= maxTicks) break; }

  const yTicks = [];
  for (let v = Math.ceil(lo / grid) * grid; v <= hi + 1e-9; v += grid) yTicks.push(v);

  const last = B[B.length - 1];
  const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const ink2 = theme.palette.text.secondary;
  const font = { fontFamily: theme.fonts.body, fontSize: 12, fontVariantNumeric: 'tabular-nums' };

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - r.left - Lp) / plotW) * span;
    if (!B.length || t < t0 - size || t > t1 + size) return setHover(null);
    let bi = 0;
    B.forEach((b, i) => { if (Math.abs(b.ts - t) < Math.abs(B[bi].ts - t)) bi = i; });
    setHover(B[bi]);
  };

  const range = vals.length ? `${fmt(Math.min(...vals))} to ${fmt(Math.max(...vals))}${unit}` : 'no readings';
  const label = `${ariaName}, ${clockAt(t0)} to ${clockAt(t1)}: ${range}${baseline != null ? `. Baseline ${baseline}${unit}` : ''}.`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1, minHeight: 16 }}>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        {/* the hovered bucket, in the title row, so nothing floats over the plot */}
        <Typography variant="caption" aria-hidden="true" sx={{ color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {hover ? `${clockAt(hover.ts)}, ${fmt(hover.v)}${unit}` : ''}
        </Typography>
      </Box>
      <Box ref={box} sx={{ position: 'relative' }}>
        <svg
          width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}
          style={{ display: 'block', overflow: 'visible' }}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={Lp} x2={Lp + plotW} y1={Math.round(Y(v)) + 0.5} y2={Math.round(Y(v)) + 0.5} stroke={theme.palette.divider} />
              <text x={Lp - 8} y={Y(v)} dy="0.32em" textAnchor="end" fill={ink2} style={font}>{v}{tickUnit}</text>
            </g>
          ))}
          {baseline != null && baseline >= lo && baseline <= hi && (
            <g>
              <line x1={Lp} x2={Lp + plotW} y1={Y(baseline)} y2={Y(baseline)} stroke={theme.palette.range.edge} strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={Lp + 4} y={Y(baseline) + 16} fill={ink2} style={font}>min {baseline}{unit}</text>
            </g>
          )}
          <line x1={Lp} x2={Lp + plotW} y1={top + plotH + 0.5} y2={top + plotH + 0.5} stroke={theme.palette.ruleUI} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={X(t)} x2={X(t)} y1={top + plotH} y2={top + plotH + 4} stroke={theme.palette.ruleUI} />
              <text x={X(t)} y={height - 6} textAnchor="middle" fill={ink2} style={font}>{clockAt(t, true)}</text>
            </g>
          ))}
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {lone.map((b) => <circle key={b.ts} cx={X(b.ts)} cy={Y(b.v)} r={2} fill={color} />)}
          {hover && (
            <g>
              <line x1={X(hover.ts)} x2={X(hover.ts)} y1={top} y2={top + plotH} stroke={theme.palette.cursor} />
              <circle cx={X(hover.ts)} cy={Y(hover.v)} r={3.5} fill={color} stroke={theme.palette.background.paper} strokeWidth={1.5} />
            </g>
          )}
          {last && (
            <g>
              <circle cx={X(last.ts)} cy={Y(last.v)} r={3} fill={color} />
              <text x={X(last.ts) + 8} y={Y(last.v)} dy="0.32em" fill={color} style={{ ...font, fontWeight: 600 }}>
                {name} {fmt(last.v)}{unit}
              </text>
            </g>
          )}
          {!B.length && (
            <text x={Lp + plotW / 2} y={top + plotH / 2} textAnchor="middle" fill={ink2} style={{ ...font, fontSize: 14 }}>
              No readings in this window
            </text>
          )}
        </svg>
      </Box>
    </Box>
  );
}
