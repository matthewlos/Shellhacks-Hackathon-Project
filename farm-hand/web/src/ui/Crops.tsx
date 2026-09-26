/**
 * Crops: what each box's soil suits right now, from the crop rules engine (data/sim/crops.ts,
 * through the board). One focal crop per box; the per-factor sentences open on demand.
 * Unknown factors say "unknown": the engine never guesses them, and neither does this page.
 */
import { useEffect, useState } from 'react';
import { brand } from '../brand';
import { seasonText } from '../data/sim/season';
import { useApp } from '../data/store';
import type { CropScore, FrostDates, PlantingWindow } from '../data/types';
import { fmtDate, fmtDoy } from './format';
import type { BoxId } from './farmData';

const REFRESH_MS = 30_000;
/** House style has no en or em dashes: ranges become hyphens, sentence dashes become commas. */
const plain = (t: string) => t.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2').replace(/\s*[—–]\s*/g, ', ');
const VERDICT: Record<CropScore['verdict'], string> = { great: 'Great fit', good: 'Good fit', marginal: 'Marginal', poor: 'Poor fit' };
const UNKNOWN: Record<string, string> = { drainage: 'drainage', soil_temp: 'soil temperature', season: 'season', sun: 'sun', ph: 'pH' };

function usePoll<T>(load: (() => Promise<T>) | null, deps: unknown[], every = REFRESH_MS): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    const run = () => load().then((d) => { if (alive) { setData(d); setFailed(false); } }).catch(() => { if (alive) setFailed(true); });
    void run();
    const id = setInterval(run, every);
    return () => { alive = false; clearInterval(id); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, failed };
}

function windowHead(w: PlantingWindow): string {
  if (w.status === 'open') return 'Plant now';
  if (w.status === 'year_round') return 'Plant any time of year';
  if (w.status === 'upcoming' && w.nextOpen) return `Planting opens ${fmtDate(w.nextOpen)}`;
  if (w.status === 'closed') return 'Planting window closed for this season';
  return 'Planting window unknown';
}

function Focal({ crop, box }: { crop: CropScore; box: BoxId }) {
  const board = useApp((s) => s.board);
  const [why, setWhy] = useState(false);
  const { data: win } = usePoll(() => board.plantingWindow(crop.id, box), [board, crop.id, box]);
  return (
    <article className="focal" key={crop.id}>
      <header className="focal-head">
        <h3>{crop.name}</h3>
        <p className="focal-score num"><b>{crop.score}</b><span>/100</span></p>
      </header>
      <p className={`focal-verdict verdict-${crop.verdict}`}>{VERDICT[crop.verdict]}{crop.confidence !== 'high' && <span>, {crop.confidence} confidence</span>}</p>
      <p className="focal-summary">{plain(crop.summary)}</p>
      {win && <p className="focal-window"><b>{windowHead(win)}.</b> {plain(win.text)}</p>}
      <button className="btn" aria-expanded={why} onClick={() => setWhy(!why)}>{why ? 'Hide the reasons' : 'Why this score'}</button>
      {why && (
        <ul className="factors">
          {crop.factors.map((f) => (
            <li key={f.key} className={f.known ? '' : 'is-unknown'}>
              <span className="factor-name">{f.label}</span>
              <span className="factor-score num">{f.known && f.score != null ? f.score : 'unknown'}</span>
              <p>{plain(f.reason)}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function BoxCrops({ id }: { id: BoxId }) {
  const board = useApp((s) => s.board);
  const { data: crops, failed } = usePoll(() => board.scoreCrops(id), [board, id]);
  const [pick, setPick] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const box = brand.boxes[id];
  const list = crops ?? [];
  const focal = list.find((c) => c.id === pick) ?? list[0];
  const shown = all ? list : list.slice(0, 8);
  const unknowns = list[0]?.unknowns ?? [];

  return (
    <section className={`crops-box box-${id}`} aria-label={`Crops for box ${id}`}>
      <header className="box-head">
        <span className="box-id" aria-hidden>{id}</span>
        <h2>{box.name}</h2>
        <p>What this box's soil suits right now</p>
      </header>
      {!crops && !failed && <p className="muted">Scoring the crops for this box.</p>}
      {(failed || (crops && !crops.length)) && <p className="muted">No crop scores yet. They appear once the server scores this box.</p>}
      {focal && <Focal crop={focal} box={id} />}
      {list.length > 0 && (
        <>
          <ol className="croplist" aria-label="All crops, best first">
            {shown.map((c, i) => (
              <li key={c.id}>
                <button className={c.id === focal?.id ? 'is-on' : ''} aria-pressed={c.id === focal?.id} onClick={() => setPick(c.id)}>
                  <span className="cl-rank num">{i + 1}</span>
                  <span className="cl-name">{c.name}</span>
                  <span className={`cl-verdict verdict-${c.verdict}`}>{VERDICT[c.verdict]}</span>
                  <span className="cl-score num">{c.score}</span>
                </button>
              </li>
            ))}
          </ol>
          {list.length > 8 && <button className="btn" onClick={() => setAll(!all)}>{all ? 'Show the top 8' : `Show all ${list.length} crops`}</button>}
          {unknowns.length > 0 && <p className="small muted">Scored without {unknowns.map((u) => UNKNOWN[u] ?? u).join(', ')}: those factors are unknown, not assumed.</p>}
        </>
      )}
    </section>
  );
}

function Season() {
  const board = useApp((s) => s.board);
  const place = useApp((s) => s.config?.place ?? null);
  const { data: frost } = usePoll<FrostDates | null>(() => board.frostDates(), [board], 30 * 60_000);
  return (
    <section className="season" aria-label="Growing season">
      <h2>Growing season{place ? ` at ${place.name}` : ''}</h2>
      {!frost ? <p className="muted">Frost dates are not available yet.</p> : (
        <>
          {frost.frostFree
            ? <p className="season-big">No regular frost</p>
            : (
              <dl className="season-grid">
                <div><dt>Last spring frost</dt><dd className="num">{fmtDoy(frost.lastSpringFrostDoy)}</dd></div>
                <div><dt>First fall frost</dt><dd className="num">{fmtDoy(frost.firstFallFrostDoy)}</dd></div>
                <div><dt>Season</dt><dd className="num">{frost.growingSeasonDays} days</dd></div>
              </dl>
            )}
          <p>{plain(seasonText(frost))}</p>
          <p className="small muted">Estimate from {frost.source === 'open-meteo-archive' ? `${frost.yearsUsed} years of weather history` : 'latitude'}: {plain(frost.label)}. Miami rarely frosts, so the planting windows come mostly from soil temperature.</p>
        </>
      )}
    </section>
  );
}

export function CropsPage() {
  return (
    <>
      <div className="crops-main">
        <BoxCrops id="A" />
        <BoxCrops id="B" />
      </div>
      <aside className="side">
        <Season />
        <section className="note-card">
          <h2>How crops are scored</h2>
          <p>A fixed rules table of 26 crops, checked against each box's soil temperature, the season, sun, drainage and pH. Anything not measured is left out of the score and shown as unknown. Same readings, same scores, every time.</p>
        </section>
      </aside>
    </>
  );
}
