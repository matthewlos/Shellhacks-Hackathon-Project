import { useEffect, useMemo, useRef } from 'react';
import { brand } from '../brand';
import { useApp } from '../data/store';
import { BOX_IDS, clock } from './farmData';
import { IconPause, IconPlay } from './icons';

const HOURS = 36;
const RELOAD_MS = 60_000;
const W = 1000, H = 160;
const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Soil moisture over time, box A (Farm Hand) against box B (Timer), with the baseline Laya holds.
 * Dragging across the chart replays the recorded readings in the 3D scene.
 */
export function History() {
  const replay = useApp((s) => s.replay);
  const setReplay = useApp((s) => s.setReplay);
  const raf = useRef(0);

  // Load now, then refresh every minute unless someone is replaying.
  useEffect(() => {
    const load = () => { if (!useApp.getState().replay.active) void useApp.getState().openHistory?.(HOURS).catch?.(() => {}); };
    load();
    const id = setInterval(load, RELOAD_MS);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    const all = BOX_IDS.flatMap((id) => replay.series[id]?.points ?? []);
    if (!all.length) return null;
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
    return t1 > t0 ? { t0, t1 } : null;
  }, [replay.series]);

  useEffect(() => {
    if (!replay.playing || !range) return;
    let last = performance.now();
    const step = (now: number) => {
      const s = useApp.getState().replay;
      const t = s.t + ((now - last) / 1000) * ((range.t1 - range.t0) / 30); // the whole span in ~30 s
      last = now;
      if (t >= range.t1) { setReplay({ t: range.t1, playing: false }); return; }
      setReplay({ t });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [replay.playing, range, setReplay]);

  if (!range) {
    return (
      <div className="history">
        <p className="history-empty muted">The chart fills in as the boxes report. The ESP32 sends a reading about every 10 seconds.</p>
      </div>
    );
  }

  const x = (t: number) => ((t - range.t0) / (range.t1 - range.t0)) * W;
  const y = (pct: number) => H - (Math.max(0, Math.min(100, pct)) / 100) * H;
  const path = (id: string) => {
    let d = '', pen = false;
    for (const p of replay.series[id]?.points ?? []) {
      if (p.moisturePct == null) { pen = false; continue; }   // a gap where the probe was disconnected
      d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.moisturePct).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const base = y(brand.baselinePct);

  return (
    <div className="history">
      <div className="history-head">
        <ul className="legend">
          <li className="legend-a">Box A, Farm Hand</li>
          <li className="legend-b">Box B, Timer</li>
          <li className="legend-base">Baseline <span className="num">{brand.baselinePct}%</span></li>
        </ul>
        <div className="history-ctl">
          <span className="history-time num">{replay.active ? `Replaying ${when(replay.t)}` : `Last ${HOURS} h`}</span>
          <button
            className="btn btn-icon"
            aria-label={replay.playing ? 'Pause replay' : 'Replay the readings'}
            onClick={() => setReplay(replay.playing ? { playing: false } : { active: true, playing: true, t: replay.active && replay.t < range.t1 - 1000 ? replay.t : range.t0 })}
          >
            {replay.playing ? <IconPause /> : <IconPlay />}
          </button>
          {replay.active && <button className="btn" onClick={() => setReplay({ active: false, playing: false, t: Date.now() })}>Back to live</button>}
        </div>
      </div>
      <div className="chart">
        <div className="chart-y num" aria-hidden><span>100%</span><span>50%</span><span>0%</span></div>
        <div className="chart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Moisture of box A and box B over time">
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="grid" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2={W} y1={base} y2={base} className="baseline" vectorEffect="non-scaling-stroke" />
            <path d={path('B')} className="line line-b" vectorEffect="non-scaling-stroke" />
            <path d={path('A')} className="line line-a" vectorEffect="non-scaling-stroke" />
          </svg>
          {replay.active && <i className="playhead" style={{ left: `${(x(replay.t) / W) * 100}%` }} />}
          <input
            type="range" min={range.t0} max={range.t1} step={10_000} value={replay.active ? replay.t : range.t1}
            onChange={(e) => setReplay({ active: true, playing: false, t: +e.target.value })}
            aria-label="Replay time"
          />
        </div>
        <div className="chart-x num" aria-hidden><span>{clock(range.t0)}</span><span>{clock(range.t1)}</span></div>
      </div>
    </div>
  );
}
