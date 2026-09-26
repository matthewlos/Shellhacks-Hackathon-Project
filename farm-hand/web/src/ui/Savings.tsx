/**
 * What it saves: time, money, water, the crop. Real numbers only:
 *   time   soil checks stored on the Mac mini (GET /farmhand/data -> count), else readings in the loaded history
 *   money  our parts order vs one commercial soil sensor (CropX retail, checked 2026-09-26)
 *   water  season replay on real Miami weather (simulated field), PLAN 5e
 *   crop   same replay (stress hours), plus box A's live time inside its band from the loaded history
 */
import { useEffect, useMemo, useState } from 'react';
import { brand } from '../brand';
import * as backend from '../data/backendBoard';
import { useApp } from '../data/store';

const BASE = (backend as unknown as { BACKEND_URL?: string }).BACKEND_URL ?? '/farmhand';

function useCheckCount(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`${BASE}/data`).then((r) => r.json()).then((j) => { if (alive && typeof j?.count === 'number') setN(j.count); }).catch(() => {});
    void load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return n;
}

export function useSavings() {
  const count = useCheckCount();
  const series = useApp((s) => s.replay.series);
  const hist = useMemo(() => {
    const pts = series.A?.points ?? [];
    const read = pts.filter((p) => p.moisturePct != null);
    const inBand = read.filter((p) => p.moisturePct! >= brand.baselinePct).length;
    return { readings: Math.max(pts.length, series.B?.points.length ?? 0), inBandPct: read.length >= 12 ? (inBand / read.length) * 100 : null };
  }, [series]);
  return { checks: count ?? (hist.readings || null), checksFromServer: count != null, inBandPct: hist.inBandPct };
}

export function SavingsPanel() {
  const s = useSavings();
  const sv = brand.savings;
  return (
    <div className="savings">
      <section className="saving">
        <h3>Time</h3>
        <p className="saving-big num">{s.checks != null ? s.checks.toLocaleString() : 'Every 10 s'}</p>
        <p>{s.checks != null ? `soil checks done for you${s.checksFromServer ? '' : ' in the last 36 h'}. No walking the beds with a probe.` : 'a soil check, done for you. No walking the beds with a probe.'}</p>
      </section>
      <section className="saving">
        <h3>Money</h3>
        <p className="saving-big num">{sv.partsUsd}</p>
        <p>for our parts. One commercial soil sensor costs <span className="num">{sv.sensorUsd}</span> plus <span className="num">{sv.sensorYearly}</span> a year.</p>
      </section>
      <section className="saving">
        <h3>Water</h3>
        <p className="saving-big num">{sv.waterLessPct}% less</p>
        <p>water than a timer, over 21 months of real Miami weather (simulated field).</p>
      </section>
      <section className="saving">
        <h3>The crop</h3>
        <p className="saving-big num">{sv.stressHoursFarmHand} h</p>
        <p>of crop stress, against <span className="num">{sv.stressHoursTimer}</span> h for the timer, same simulated season.
          {s.inBandPct != null && <> Live: box A spent <b className="num">{s.inBandPct.toFixed(1)}%</b> of the last 36 h at or above its <span className="num">{brand.baselinePct}%</span> line.</>}
        </p>
      </section>
    </div>
  );
}
