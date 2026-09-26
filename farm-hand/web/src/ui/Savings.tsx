/**
 * What it saves: time, money, water, the crop. Real numbers only:
 *   time   soil checks stored on the Mac mini (GET /farmhand/data -> count), else readings in the loaded history
 *   money  our parts order vs one commercial soil sensor (CropX retail, checked 2026-09-26)
 *   water  season replay on real Miami weather (simulated field), PLAN 5e
 *   crop   same replay (stress hours), plus box A's live time inside its band from the loaded history
 *
 * A second tab, "Crop risk", reads the same data the way an insurer or grower does (data/risk.ts):
 * stress hours per box from the loaded history, drought exposure at FIU now (Open-Meteo soil model via the server),
 * how much of the window a probe was actually watching, and the water saved.
 */
import { useEffect, useMemo, useState } from 'react';
import { brand } from '../brand';
import * as backend from '../data/backendBoard';
import { droughtLevel, FIU, nearestPoint, windowRisk, type Level, type SoilPoint } from '../data/risk';
import { useApp } from '../data/store';
import './risk.css';

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

function SavingsList() {
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
        <p>water than a timer, over 21 months of real Miami weather.</p>
      </section>
      <section className="saving">
        <h3>The crop</h3>
        <p className="saving-big num">{sv.stressHoursFarmHand} h</p>
        <p>of crop stress, against <span className="num">{sv.stressHoursTimer}</span> h for the timer.
          {s.inBandPct != null && <> Live: box A spent <b className="num">{s.inBandPct.toFixed(1)}%</b> of the last 36 h at or above its <span className="num">{brand.baselinePct}%</span> line.</>}
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ crop risk
type Tab = 'savings' | 'risk';
const TAB_KEY = 'fh.saves.tab';
const readTab = (): Tab => { try { return sessionStorage.getItem(TAB_KEY) === 'risk' ? 'risk' : 'savings'; } catch { return 'savings'; } };

export function SavingsPanel() {
  const [tab, setTab] = useState<Tab>(readTab);
  const pick = (t: Tab) => { setTab(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* private mode */ } };
  return (
    <div className="saves-tabs">
      <div className="segmented" role="tablist" aria-label="Savings or crop risk">
        <button role="tab" id="tab-savings" aria-selected={tab === 'savings'} aria-controls="tp-saves" className={tab === 'savings' ? 'is-on' : ''} onClick={() => pick('savings')}>Savings</button>
        <button role="tab" id="tab-risk" aria-selected={tab === 'risk'} aria-controls="tp-saves" className={tab === 'risk' ? 'is-on' : ''} onClick={() => pick('risk')}>Crop risk</button>
      </div>
      <div role="tabpanel" id="tp-saves" aria-labelledby={`tab-${tab}`} key={tab} className="saves-tp">
        {tab === 'savings' ? <SavingsList /> : <RiskPanel />}
      </div>
    </div>
  );
}

/** The Open-Meteo soil point nearest FIU. The server caches the grid for 30 minutes. */
function useSoilAtFiu(): { pt: SoilPoint | null; failed: boolean } {
  const place = useApp((s) => s.config?.place);
  const [st, setSt] = useState<{ pts: SoilPoint[] | null; failed: boolean }>({ pts: null, failed: false });
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/api/soil-now`).then((r) => r.json())
      .then((j: { status?: string; points?: SoilPoint[] }) => { if (alive) setSt(j?.status === 'ready' && Array.isArray(j.points) ? { pts: j.points, failed: false } : { pts: null, failed: true }); })
      .catch(() => { if (alive) setSt({ pts: null, failed: true }); });
    return () => { alive = false; };
  }, []);
  const lat = place?.lat ?? FIU.lat, lon = place?.lon ?? FIU.lon;
  return { pt: st.pts ? nearestPoint(st.pts, lat, lon) : null, failed: st.failed };
}

const hrs = (h: number) => (h === 0 ? '0' : h < 10 ? h.toFixed(1) : Math.round(h).toString());
const LEVEL_WORD: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const IDS = ['A', 'B'] as const;

function RiskPanel() {
  const series = useApp((s) => s.replay.series);
  const sv = brand.savings;
  const line = brand.baselinePct;
  const w = useMemo(() => windowRisk(series, [...IDS], line), [series, line]);
  const soil = useSoilAtFiu();
  const drought = soil.pt ? droughtLevel(soil.pt) : null;
  const loaded = w.t0 != null;
  const maxStress = Math.max(0.5, ...IDS.map((id) => w.box[id]?.stressH ?? 0));
  const span = `${Math.max(1, Math.round(w.spanH))} h`;

  return (
    <div className="savings risk">
      <section className="saving">
        <h3>Stress hours</h3>
        {loaded ? (
          <table className="risk-boxes num">
            <caption className="sr-only">Hours below the {line}% line, last {span}</caption>
            <tbody>
              {IDS.map((id) => {
                const b = w.box[id];
                const h = b?.stressH ?? 0;
                return (
                  <tr key={id} className={`rb-${id.toLowerCase()}`}>
                    <th scope="row">Box {id}<span>, {brand.boxes[id].name}</span></th>
                    <td className="rb-val">{hrs(h)} h</td>
                    <td className="rb-bar" aria-hidden><b><i style={{ transform: `scaleX(${Math.min(1, h / maxStress)})` }} /></b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="saving-big">Waiting</p>}
        <p>{loaded ? <>below the <span className="num">{line}%</span> line in the last <span className="num">{span}</span>. </> : 'for the first readings to load. '}
          Season replay: <b className="num">{sv.stressHoursFarmHand} h</b> for Farm Hand, <b className="num">{sv.stressHoursTimer} h</b> for the timer.</p>
      </section>

      <section className="saving">
        <h3>Drought now</h3>
        {drought ? (
          <div className={`risk-level lv-${drought.level}`}>
            <p className="saving-big">{LEVEL_WORD[drought.level]}</p>
            <span className="risk-steps" role="img" aria-label={`${LEVEL_WORD[drought.level]} drought exposure`}><i /><i /><i /></span>
          </div>
        ) : <p className="saving-big">{soil.failed ? 'Unknown' : 'Loading'}</p>}
        {drought && soil.pt ? (
          <p>{drought.why} <span className="risk-meta num">Open-Meteo soil model at FIU{soil.pt.temp6cmC != null ? `, ${soil.pt.temp6cmC.toFixed(1)} °C at 6 cm` : ''}.</span></p>
        ) : <p>{soil.failed ? "Today's soil data isn't reachable right now." : "Reading today's soil near FIU."}</p>}
      </section>

      <section className="saving">
        <h3>Watched</h3>
        <p className="saving-big num">{w.watchedPct != null ? `${Math.round(w.watchedPct)}%` : 'Waiting'}</p>
        <p>{w.watchedPct != null
          ? <>of the last <span className="num">{span}</span> had a working probe reading. Box A <span className="num">{hrs(w.box.A?.watchedH ?? 0)} h</span>, box B <span className="num">{hrs(w.box.B?.watchedH ?? 0)} h</span>.</>
          : 'for the first readings to load.'}</p>
      </section>

      <section className="saving">
        <h3>Water</h3>
        <p className="saving-big num">{sv.waterLessPct}% less</p>
        <p>water than a timer. Season replay, 21 months of real Miami weather.</p>
      </section>

      <section className="saving risk-why">
        <h3>Why it matters</h3>
        <p>A watched field with no stress hours is a lower-risk field: fewer crop-loss claims, and proof the grower acted.</p>
      </section>

      <p className="risk-note">Estimate. Hours come from the logged readings; drought level from the soil model.</p>
    </div>
  );
}
