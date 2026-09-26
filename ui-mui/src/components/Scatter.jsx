import { useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

/*
 * Water (x) by stress hours (y), one point per method: the whole Outside argument in one chart.
 * The probe saves water on x; Laya keeps the crop off the stress line on y. Rules, Farm Hand and the best case
 * sit within 40 mm of each other, so the chart shows that honestly instead of a bar that looks like a win.
 * Plain SVG sized from the measured width (ResizeObserver), direct labels, no legend, no animation.
 */

const PAD = { l: 48, r: 24, t: 32, b: 48 };
const X_DOM = [1000, 3600], X_TICKS = [1000, 2000, 3000];
const Y_DOM = [0, 14], Y_TICKS = [0, 5, 10];

// points: [{ key, name, mm, stress }] with keys timer / rules / laya / oracle
export default function Scatter({ points, sx }) {
  const theme = useTheme();
  const P = theme.palette;
  const ref = useRef(null);
  const [w, setW] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => {
      setW(Math.round(el.clientWidth));
      setNarrow(window.innerWidth < theme.breakpoints.values.md);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [theme]);

  const h = narrow ? 280 : 400;
  const pw = Math.max(0, w - PAD.l - PAD.r), ph = h - PAD.t - PAD.b;
  const X = (mm) => PAD.l + ((mm - X_DOM[0]) / (X_DOM[1] - X_DOM[0])) * pw;
  const Y = (hr) => PAD.t + ph - ((hr - Y_DOM[0]) / (Y_DOM[1] - Y_DOM[0])) * ph;
  const by = Object.fromEntries(points.map((p) => [p.key, p]));
  const label = points.map((p) => `${p.name}: ${p.mm.toLocaleString()} mm, ${p.stress} hours of stress`).join('; ');

  const font = { fontFamily: theme.fonts.body, fontVariantNumeric: 'tabular-nums' };
  const cap = { ...font, fontSize: 12, fill: P.text.secondary };
  const lab = { ...font, fontSize: 14 };

  const dot = (p, r, fill) => <circle key={p.key} cx={X(p.mm)} cy={Y(p.stress)} r={r} fill={fill} />;

  return (
    <Box ref={ref} sx={{ width: '100%', height: h, ...sx }}>
      {w > 0 && (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Water used against hours past the stress line. ${label}.`} style={{ display: 'block', overflow: 'visible' }}>
          <text x={0} y={16} style={cap}>Hours past the stress line</text>

          {Y_TICKS.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={PAD.l + pw} y1={Y(v)} y2={Y(v)} stroke={P.divider} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.l - 12} y={Y(v)} dy="0.35em" textAnchor="end" style={cap}>{v}</text>
            </g>
          ))}
          {X_TICKS.map((v) => (
            <text key={v} x={X(v)} y={PAD.t + ph + 20} textAnchor="middle" style={cap}>{v.toLocaleString()}</text>
          ))}
          <text x={PAD.l + pw} y={PAD.t + ph + 40} textAnchor="end" style={cap}>mm of water, 21 months</text>

          {/* Filled points first, the best-case ring last so it stays visible where it overlaps Farm Hand. */}
          {dot(by.timer, 6, P.timer.main)}
          {dot(by.rules, 6, P.text.secondary)}
          {dot(by.laya, 7, P.moisture.main)}
          <circle cx={X(by.oracle.mm)} cy={Y(by.oracle.stress)} r={6} fill="none" stroke={P.text.secondary} strokeWidth={1.5} />

          <text x={X(by.timer.mm) - 12} y={Y(by.timer.stress)} dy="0.35em" textAnchor="end" style={{ ...lab, fill: P.timer.text }}>{by.timer.name}</text>
          <text x={X(by.rules.mm) + 12} y={Y(by.rules.stress)} dy="0.35em" style={{ ...lab, fill: P.text.primary }}>{by.rules.name}</text>
          <text x={X(by.laya.mm) + 10} y={Y(by.laya.stress) - 12} style={{ ...lab, fill: P.moisture.main, fontWeight: 600 }}>{by.laya.name}</text>
          {/* Left of the ring; on a phone the ring sits 45 px from the y axis, so the label rises above-left
              (mirroring Farm Hand) instead of running into the "0" tick. */}
          <text x={X(by.oracle.mm) - (narrow ? 10 : 12)} y={Y(by.oracle.stress) - (narrow ? 12 : 0)} dy={narrow ? 0 : '0.35em'} textAnchor="end" style={{ ...lab, fill: P.text.secondary }}>{by.oracle.name}</text>
        </svg>
      )}
    </Box>
  );
}
