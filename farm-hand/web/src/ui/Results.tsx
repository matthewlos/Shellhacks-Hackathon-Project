/**
 * Results: a 48 h timelapse of box A (Laya) against box B (timer), from public/results-fake.json.
 * While it plays or is scrubbed, it also drives the 3D scene: the store's `timelapse` mode parks the real
 * samples and `live` / `pumps` carry the timelapse values, so the soil and the water streams follow it.
 * Closing the panel hands the scene back to the live readings (`endTimelapse`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../data/store';
import { IconDrop, IconPause, IconPlay } from './icons';
import { useTouchRange } from './touchRange';

interface Pour { t: number; box: 'A' | 'B'; s: number; ml: number; by: string }
interface Pt { h: number; a: number; b: number; ta: number; tb: number }
interface Results {
  start: string; hours: number; baselinePct: number; endEpochMs?: number;
  totals: { layaL: number; timerL: number; savedL: number; savedPct: number; layaPours: number; timerPours: number };
  pours: Pour[]; points: Pt[];
}

const PLAY_S = 20;               // the whole 48 h in about 20 s at 1x
const STREAM_H = 0.5;            // show the water stream for half a simulated hour, so a pour is visible
const W = 1000, H = 240, LO = 20, HI = 100, SOGGY = 70;   // 20 % is the bottom of the probe scale (wilting point)
const X = (h: number, hours: number) => (h / hours) * W;
const Y = (v: number) => H - ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * H;

function useResults(): Results | null {
  const [d, setD] = useState<Results | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}results.json`).then((r) => r.json()).then(setD).catch(() => {});
  }, []);
  return d;
}

function at(points: Pt[], h: number): Pt {
  let lo = 0, hi = points.length - 1;
  if (h <= points[0].h) return points[0];
  if (h >= points[hi].h) return points[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (points[m].h <= h) lo = m; else hi = m; }
  const a = points[lo], b = points[hi], k = (h - a.h) / (b.h - a.h || 1);
  const mix = (x: number, y: number) => x + (y - x) * k;
  return { h, a: mix(a.a, b.a), b: mix(a.b, b.b), ta: mix(a.ta, b.ta), tb: mix(a.tb, b.tb) };
}

const fmtClock = (d: Date) => d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const fmtHour = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric' });

/** The stored timelapse, continued with the real readings the server has recorded since it ends. */
function useTimeline() {
  const r = useResults();
  const series = useApp((s) => s.replay.series);
  return useMemo(() => {
    if (!r) return null;
    const t0 = new Date(r.start).getTime();
    const endMs = r.endEpochMs ?? t0 + r.hours * 3600e3;
    const bAt = new Map((series.B?.points ?? []).map((p) => [Math.round(p.t / 1000), p]));
    const real: Pt[] = [];
    for (const p of series.A?.points ?? []) {
      // a probe that is off reports a rail value (0 or 100 %): not a reading
      if (p.t <= endMs || p.moisturePct == null || p.moisturePct < 5 || p.moisturePct >= 99.5) continue;
      const q = bAt.get(Math.round(p.t / 1000));
      if (!q || q.moisturePct == null || q.moisturePct < 5 || q.moisturePct >= 99.5) continue;
      real.push({ h: (p.t - t0) / 3600e3, a: p.moisturePct, b: q.moisturePct, ta: p.tempC ?? NaN, tb: q.tempC ?? NaN });
    }
    real.sort((x, y) => x.h - y.h);
    const last = r.points[r.points.length - 1];
    for (const p of real) { if (!Number.isFinite(p.ta)) p.ta = last.ta; if (!Number.isFinite(p.tb)) p.tb = last.tb; }
    const points = [...r.points, ...real];
    return { ...r, points, hours: Math.max(r.hours, points[points.length - 1].h) };
  }, [r, series]);
}

export function ResultsPanel() {
  const r = useTimeline();
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [h, setH] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  // scrub by touch: the playhead jumps to the finger and follows it (touchRange.ts); pauses like a drag does
  const scrub = useTouchRange((v) => { setPlaying(false); setH(v); });
  const hRef = useRef(0);
  hRef.current = h;

  // auto-play once the data is in (not with reduced motion: scrub only)
  const loaded = !!r;
  useEffect(() => { if (loaded && !reduce) setPlaying(true); }, [loaded, reduce]);

  // the clock
  useEffect(() => {
    if (!r || !playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const next = Math.min(r.hours, hRef.current + ((now - last) / 1000) * (r.hours / PLAY_S) * speed);
      last = now;
      setH(next);
      if (next >= r.hours) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [r, playing, speed]);

  // drive the 3D scene with the timelapse values
  const cur = r ? at(r.points, h) : null;
  useEffect(() => {
    if (!r || !cur) return;
    const pouring = (box: 'A' | 'B') => r.pours.some((p) => p.box === box && h >= p.t && h - p.t < STREAM_H);
    const z = (m: number, t: number) => ({ t: Date.now(), moisturePct: m, tempC: t, moistureOnline: true, tempOnline: true, probeOk: true, raw: null, moistureRaw: null });
    useApp.setState({ timelapse: true, live: { A: z(cur.a, cur.ta), B: z(cur.b, cur.tb) }, pumps: { A: pouring('A'), B: pouring('B') } });
  }, [r, h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => useApp.getState().endTimelapse(), []);

  if (!r || !cur) return <p className="muted">Loading the results.</p>;

  const start = new Date(r.start);
  const now = new Date(start.getTime() + h * 3600e3);
  const done = h >= r.hours - 0.05;
  const upto = r.pours.filter((p) => p.t <= h);
  const litres = (box: 'A' | 'B') => upto.filter((p) => p.box === box).reduce((s, p) => s + p.ml, 0) / 1000;
  const count = (box: 'A' | 'B') => upto.filter((p) => p.box === box).length;
  const temps = r.points.map((p) => (p.ta + p.tb) / 2);
  const tLo = Math.min(...temps), tHi = Math.max(...temps);
  const warmth = ((cur.ta + cur.tb) / 2 - tLo) / (tHi - tLo || 1);    // 0 = coolest night, 1 = warmest afternoon
  const hour = now.getHours();
  const isDay = hour >= 7 && hour < 19;

  const path = (key: 'a' | 'b') => {
    let d = '';
    for (const p of r.points) { if (p.h > h) break; d += `${d ? 'L' : 'M'}${X(p.h, r.hours).toFixed(1)},${Y(p[key]).toFixed(1)}`; }
    return d + (d ? `L${X(h, r.hours).toFixed(1)},${Y(cur[key]).toFixed(1)}` : '');
  };
  // shade where box B sat above 70 %: soggy
  const soggy: { a: number; b: number }[] = [];
  for (const p of r.points) {
    if (p.h > h) break;
    const last = soggy[soggy.length - 1];
    if (p.b > SOGGY) { if (last && Math.abs(last.b - p.h) < 0.1) last.b = p.h; else soggy.push({ a: p.h, b: p.h }); }
  }

  return (
    <div className="results">
      <div className="res-head">
        <p className="res-headline">The decision model used <b className="num">{r.totals.savedL.toFixed(1)} L</b> less water than the timer</p>
        <p className="res-pct num">{r.totals.savedPct}% less</p>
      </div>

      <div className="res-top">
      <div className="res-race">
        <div className="res-box res-a">
          <span className="res-who">Decision model, box A</span>
          <b className="num">{litres('A').toFixed(1)} L</b>
          <span className="num">{count('A')} of {r.totals.layaPours} drinks</span>
          <span className="res-bar" aria-hidden><i style={{ transform: `scaleX(${litres('A') / r.totals.timerL})` }} /></span>
        </div>
        <div className="res-box res-b">
          <span className="res-who">Timer, box B</span>
          <b className="num">{litres('B').toFixed(1)} L</b>
          <span className="num">{count('B')} of {r.totals.timerPours} pours</span>
          <span className="res-bar" aria-hidden><i style={{ transform: `scaleX(${litres('B') / r.totals.timerL})` }} /></span>
        </div>
      </div>

      <div className="res-clock">
        <b className="num">{fmtClock(now)}</b>
        <span>{isDay ? 'Day' : 'Night'}, soil {((cur.ta + cur.tb) / 2).toFixed(1)} °C</span>
      </div>
      </div>

      <div className="res-chart" style={{ ['--warmth' as string]: warmth.toFixed(3) }}>
        <div className="res-y num" aria-hidden>{[100, SOGGY, r.baselinePct, LO].map((v) => <span key={v} style={{ top: `${(Y(v) / H) * 100}%` }}>{v}%</span>)}</div>
        <div className="res-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Soil moisture of both boxes over 48 hours">
            {soggy.map((s, i) => <rect key={i} className="res-soggy" x={X(s.a, r.hours)} width={Math.max(2, X(s.b, r.hours) - X(s.a, r.hours))} y={0} height={Y(SOGGY)} />)}
            <line className="res-base" x1="0" x2={W} y1={Y(r.baselinePct)} y2={Y(r.baselinePct)} vectorEffect="non-scaling-stroke" />
            <line className="res-grid" x1="0" x2={W} y1={Y(SOGGY)} y2={Y(SOGGY)} vectorEffect="non-scaling-stroke" />
            <path className="res-line res-line-b" d={path('b')} vectorEffect="non-scaling-stroke" />
            <path className="res-line res-line-a" d={path('a')} vectorEffect="non-scaling-stroke" />
          </svg>
          {soggy.length > 0 && <span className="res-soggy-label">Box B soggy</span>}
          {upto.map((p, i) => {
            const v = at(r.points, p.t)[p.box === 'A' ? 'a' : 'b'];
            return (
              <span key={i} className={`res-drop drop-${p.box} ${h - p.t < STREAM_H ? 'is-new' : ''}`} style={{ left: `${Math.max(1.5, (p.t / r.hours) * 100)}%`, top: `${(Y(v) / H) * 100}%` }}>
                <IconDrop /><em>{p.by}</em>
              </span>
            );
          })}
          <i className="res-head-line" style={{ left: `${(h / r.hours) * 100}%` }} />
          {done && <div className="res-end"><b className="num">Saved {r.totals.savedL.toFixed(1)} L</b></div>}
        </div>
        <div className="res-x num" aria-hidden><span>{fmtHour(start)}</span><span>now</span></div>
      </div>

      <div className="res-ctl">
        <button className="btn btn-icon" aria-label={playing ? 'Pause' : 'Play'} onClick={() => { if (done) setH(0); setPlaying(!playing); }}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <input ref={scrub} type="range" min={0} max={r.hours} step="any" value={h} aria-label="Timelapse time"
          onChange={(e) => { setPlaying(false); setH(+e.target.value); }} />
        <div className="segmented res-speed" role="group" aria-label="Speed">
          {([1, 2] as const).map((s) => <button key={s} className={speed === s ? 'is-on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}x</button>)}
        </div>
      </div>
      <ul className="legend">
        <li className="legend-a">Box A, decision model</li>
        <li className="legend-b">Box B, timer</li>
        <li className="legend-base">Decision model's line, {r.baselinePct}%</li>
      </ul>
    </div>
  );
}
