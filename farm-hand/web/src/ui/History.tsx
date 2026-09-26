/**
 * Soil moisture over time, box A (Farm Hand) against box B (Timer), with the 45 % line Laya holds.
 *
 * Kept honest and readable:
 *   - a reading from a probe that is off (the server reports it as exactly 0 % or 100 %) is a gap, never a dip to 0
 *   - long gaps (the board was off) are cut out of the time axis and drawn as a narrow labelled band
 *   - lines are lightly smoothed (3-point average) so power flicker doesn't read as a tangle
 *   - "Latest" (default) shows the most recent stretch with real data; "36 h" shows every stretch
 * Replay walks through the stretches only and drives the 3D scene (store `replay`), as before.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { brand } from '../brand';
import { sampleSeries, useApp } from '../data/store';
import { BOX_IDS } from './farmData';
import { IconPause, IconPlay } from './icons';

const HOURS = 36;
const RELOAD_MS = 60_000;
const GAP_MS = 30 * 60_000;          // a longer silence is "board offline" and gets cut out of the axis
const GAP_W = 0.06;                   // share of the width a cut-out gap takes
const W = 1000, H = 220;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const dur = (ms: number) => { const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3); return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };

type Pt = { t: number; v: number | null };
type Seg = { t0: number; t1: number; x0: number; x1: number };

/** A probe that is off reads as a rail value (under 5 % or 100 %); treat it as no reading. */
const valid = (v: number | null | undefined) => (v == null || v < 5 || v >= 99.5 ? null : v);

function smooth(pts: Pt[]): Pt[] {
  return pts.map((p, i) => {
    if (p.v == null) return p;
    const n = [pts[i - 1], p, pts[i + 1]].filter((q) => q && q.v != null && Math.abs(q.t - p.t) < GAP_MS) as { t: number; v: number }[];
    return { t: p.t, v: n.reduce((s, q) => s + q.v, 0) / n.length };
  });
}

export function History() {
  const replay = useApp((s) => s.replay);
  const setReplay = useApp((s) => s.setReplay);
  const [range, setRange] = useState<'latest' | 'all'>('latest');
  const raf = useRef(0);

  // Load now, then refresh every minute unless someone is replaying.
  useEffect(() => {
    const load = () => { if (!useApp.getState().replay.active) void useApp.getState().openHistory?.(HOURS).catch?.(() => {}); };
    load();
    const id = setInterval(load, RELOAD_MS);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const lines = Object.fromEntries(BOX_IDS.map((id) => [id, smooth((replay.series[id]?.points ?? []).map((p) => ({ t: p.t, v: valid(p.moisturePct) })).sort((a, b) => a.t - b.t))])) as Record<string, Pt[]>;
    const times = [...new Set(BOX_IDS.flatMap((id) => lines[id].filter((p) => p.v != null).map((p) => p.t)))].sort((a, b) => a - b);
    if (!times.length) return null;
    // stretches of real data, split where the board was silent for longer than GAP_MS
    let stretches: { t0: number; t1: number }[] = [];
    for (const t of times) {
      const last = stretches[stretches.length - 1];
      if (last && t - last.t1 <= GAP_MS) last.t1 = t; else stretches.push({ t0: t, t1: t });
    }
    if (range === 'latest') stretches = stretches.slice(-1);
    const minSpan = 10 * 60_000;
    stretches = stretches.map((s) => (s.t1 - s.t0 < minSpan ? { t0: s.t1 - minSpan, t1: s.t1 } : s));
    // lay the stretches out on the x axis, each gap a narrow fixed band
    const total = stretches.reduce((s, x) => s + (x.t1 - x.t0), 0);
    const room = 1 - GAP_W * (stretches.length - 1);
    let x = 0;
    const segs: Seg[] = stretches.map((s, i) => {
      const w = room * ((s.t1 - s.t0) / total);
      const seg = { ...s, x0: x, x1: x + w };
      x += w + (i < stretches.length - 1 ? GAP_W : 0);
      return seg;
    });
    return { lines, segs };
  }, [replay.series, range]);

  const X = (t: number): number | null => {
    if (!data) return null;
    for (const s of data.segs) if (t >= s.t0 - 60_000 && t <= s.t1 + 60_000) return (s.x0 + ((Math.min(Math.max(t, s.t0), s.t1) - s.t0) / Math.max(1, s.t1 - s.t0)) * (s.x1 - s.x0)) * W;
    return null;
  };
  // replay walks position 0..1 across the stretches only
  const tAt = (pos: number): number => {
    const segs = data!.segs; const room = segs.reduce((s, x) => s + (x.x1 - x.x0), 0);
    let left = pos * room;
    for (const s of segs) { const w = s.x1 - s.x0; if (left <= w) return s.t0 + (left / w) * (s.t1 - s.t0); left -= w; }
    return segs[segs.length - 1].t1;
  };
  const posOf = (t: number): number => {
    const segs = data!.segs; const room = segs.reduce((s, x) => s + (x.x1 - x.x0), 0);
    let acc = 0;
    for (const s of segs) { if (t <= s.t1) return (acc + Math.max(0, (t - s.t0) / Math.max(1, s.t1 - s.t0)) * (s.x1 - s.x0)) / room; acc += s.x1 - s.x0; }
    return 1;
  };

  useEffect(() => {
    if (!replay.playing || !data) return;
    let last = performance.now();
    const step = (now: number) => {
      const s = useApp.getState().replay;
      const pos = posOf(s.t) + (now - last) / 1000 / 20;      // the whole view in about 20 s
      last = now;
      if (pos >= 1) { setReplay({ t: tAt(1), playing: false }); return; }
      setReplay({ t: tAt(pos) });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [replay.playing, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // while replaying, the 3D boxes show the replayed readings (same mechanism as the Results timelapse)
  useEffect(() => {
    if (!replay.active) { useApp.getState().endTimelapse(); return; }
    const z = (id: string) => { const p = sampleSeries(replay.series[id], replay.t); const m = valid(p.moisturePct); return { t: Date.now(), moisturePct: m, tempC: p.tempC, moistureOnline: m != null, tempOnline: p.tempC != null, probeOk: m != null, raw: null, moistureRaw: null }; };
    useApp.setState({ timelapse: true, live: { A: z('A'), B: z('B') }, pumps: { A: false, B: false } });
  }, [replay.active, replay.t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { useApp.getState().setReplay({ active: false, playing: false }); useApp.getState().endTimelapse(); }, []);

  const Toggle = (
    <div className="segmented hist-range" role="group" aria-label="Time range">
      <button className={range === 'latest' ? 'is-on' : ''} aria-pressed={range === 'latest'} onClick={() => setRange('latest')}>Latest</button>
      <button className={range === 'all' ? 'is-on' : ''} aria-pressed={range === 'all'} onClick={() => setRange('all')}>36 h</button>
    </div>
  );

  if (!data) {
    return (
      <div className="history">
        <p className="history-empty muted">No moisture readings in the last 36 h yet. The line starts as soon as a probe reports.</p>
      </div>
    );
  }

  const Y = (v: number) => H - (v / 100) * H;
  const path = (id: string) => {
    let d = '', pen = false;
    for (const p of data.lines[id]) {
      const x = p.v == null ? null : X(p.t);
      if (x == null || p.v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${Y(p.v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const segs = data.segs;
  const t0 = segs[0].t0, t1 = segs[segs.length - 1].t1;
  const head = replay.active ? X(replay.t) : null;

  return (
    <div className="history">
      <div className="history-head">
        <ul className="legend">
          <li className="legend-a">Box A, Farm Hand</li>
          <li className="legend-b">Box B, Timer</li>
          <li className="legend-base">Laya's line <span className="num">{brand.baselinePct}%</span></li>
        </ul>
        {Toggle}
      </div>
      <div className="chart">
        <div className="chart-y num" aria-hidden><span>100%</span><span>50%</span><span>0%</span></div>
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Moisture of box A and box B over time">
            {segs.slice(1).map((s, i) => (
              <rect key={i} className="gap-band" x={segs[i].x1 * W} width={(s.x0 - segs[i].x1) * W} y={0} height={H} />
            ))}
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="grid" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2={W} y1={Y(brand.baselinePct)} y2={Y(brand.baselinePct)} className="baseline" vectorEffect="non-scaling-stroke" />
            <path d={path('B')} className="line line-b" vectorEffect="non-scaling-stroke" />
            <path d={path('A')} className="line line-a" vectorEffect="non-scaling-stroke" />
          </svg>
          {segs.slice(1).map((s, i) => (
            <span key={i} className="gap-label" style={{ left: `${((segs[i].x1 + s.x0) / 2) * 100}%` }}>Board off {dur(s.t0 - segs[i].t1)}</span>
          ))}
          {head != null && <i className="playhead" style={{ left: `${(head / W) * 100}%` }} />}
          <input
            type="range" min={0} max={1} step="any" value={replay.active ? posOf(replay.t) : 1}
            onChange={(e) => setReplay({ active: true, playing: false, t: tAt(+e.target.value) })}
            aria-label="Replay time"
          />
        </div>
        <div className="chart-x num" aria-hidden><span>{clock(t0)}</span><span>{clock(t1)}</span></div>
      </div>
      <div className="history-ctl">
        <button
          className="btn btn-replay"
          onClick={() => setReplay(replay.playing ? { playing: false } : { active: true, playing: true, t: replay.active && posOf(replay.t) < 0.999 ? replay.t : t0 })}
        >
          {replay.playing ? <IconPause /> : <IconPlay />}
          {replay.playing ? 'Pause' : 'Replay in 3D'}
        </button>
        <span className="history-time num">{replay.active ? when(replay.t) : 'Drag across the chart to scrub'}</span>
        {replay.active && <button className="btn" onClick={() => setReplay({ active: false, playing: false, t: Date.now() })}>Back to live</button>}
      </div>
    </div>
  );
}
