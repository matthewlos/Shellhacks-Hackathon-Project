/**
 * "Your farm in Miami-Dade": the fields around the boxes, map first.
 *
 * Data: the store's RegionView (board.region()), fed by the AlphaEarth v2 build (per-field predicted crop,
 * USDA SSURGO soil, a moisture baseline from the crop's FAO-56 stress line, similar-field counts, a trend).
 * Everything on the map is a prediction from satellite data and is labeled that way.
 *
 * TODO(data): the v2-only fields (baseline, similar count, trend, water holding) are read defensively
 * below until they are added to RegionField in data/types.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../data/store';
import type { Region, RegionField, RegionView } from '../data/types';
import { IconClose } from './icons';

// ------------------------------------------------------------------ v2 extras, read defensively
type Trend = { year: number; value: number }[];
interface FieldExtra {
  baselinePct?: number; stressLinePct?: number; baseline_pct?: number;
  similarCount?: number; similar?: number; similar_count?: number;
  trend?: Trend | number[]; trendYears?: number[]; trendLabel?: string; trend_label?: string;
  confidence?: number;
}
interface SoilExtra { awcCm?: number; awc_cm?: number; waterHoldingCm?: number; waterHoldsCm?: number }

const num = (...xs: unknown[]): number | null => { for (const x of xs) if (typeof x === 'number' && Number.isFinite(x)) return x; return null; };
function extras(f: RegionField) {
  const e = f as RegionField & FieldExtra;
  const s = { ...(f as unknown as SoilExtra), ...((f.soil ?? {}) as SoilExtra) };
  let trend: Trend | null = null;
  if (Array.isArray(e.trend) && e.trend.length > 1) {
    trend = typeof e.trend[0] === 'number'
      ? (e.trend as number[]).map((value, i) => ({ year: e.trendYears?.[i] ?? 2017 + i, value }))
      : (e.trend as Trend);
  }
  return {
    baseline: num(e.baselinePct, e.stressLinePct, e.baseline_pct),
    similar: num(e.similarCount, e.similar, e.similar_count),
    waterCm: num(s.awcCm, s.awc_cm, s.waterHoldingCm, s.waterHoldsCm),
    confidence: num(e.confidence),
    trend, trendLabel: e.trendLabel ?? e.trend_label ?? 'Change in the satellite signal',
  };
}

const acres = (ha: number) => ha * 2.47105;
const fmtAcres = (ha: number) => { const a = acres(ha); return a >= 100 ? Math.round(a).toLocaleString() : a.toFixed(1); };
const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [200, 200, 200];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

// -------------------------------------------------------------------------------- the map
function MapCanvas({ region }: { region: Region }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const selected = useApp((s) => s.selectedFarm);
  const hover = useApp((s) => s.hoverFarm);
  const n = region.n;

  // base layer: one pixel per cell, crops in their legend colour, other land paled out
  const base = useMemo(() => {
    const byCode = new Map(region.legend.map((l) => [l.code, l]));
    const img = new ImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const l = byCode.get(region.cells[i]);
      let [r, g, b] = hex(l?.color ?? '#d9ddd6');
      if (!(region.fieldOf[i] >= 0)) { r = Math.round(r * 0.25 + 222 * 0.75); g = Math.round(g * 0.25 + 226 * 0.75); b = Math.round(b * 0.25 + 219 * 0.75); }
      img.data.set([r, g, b, 255], i * 4);
    }
    const c = document.createElement('canvas'); c.width = n; c.height = n;
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c;
  }, [region, n]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.floor(Math.min(el.clientWidth, el.clientHeight))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, c.width, c.height);
    const k = c.width / n;
    const idx = (id: string | null) => (id ? region.fields.findIndex((f) => f.id === id) : -1);
    const paint = (fi: number, fill: string) => {
      if (fi < 0) return;
      g.fillStyle = fill;
      for (let i = 0; i < n * n; i++) if (region.fieldOf[i] === fi) g.fillRect((i % n) * k, Math.floor(i / n) * k, k + 0.5, k + 0.5);
    };
    const sel = idx(selected), hov = idx(hover);
    if (sel >= 0) {
      // veil the land, bring the chosen field back at full colour, then ink its outline
      g.fillStyle = 'rgba(250, 251, 248, 0.6)';
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#16201a';
      g.lineWidth = Math.max(2, k * 0.3);
      g.beginPath();
      for (let i = 0; i < n * n; i++) {
        if (region.fieldOf[i] !== sel) continue;
        const x = i % n, y = Math.floor(i / n);
        g.drawImage(base, x, y, 1, 1, x * k, y * k, k + 0.5, k + 0.5);
        const out = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= n || yy >= n || region.fieldOf[yy * n + xx] !== sel;
        if (out(x, y - 1)) { g.moveTo(x * k, y * k); g.lineTo((x + 1) * k, y * k); }
        if (out(x, y + 1)) { g.moveTo(x * k, (y + 1) * k); g.lineTo((x + 1) * k, (y + 1) * k); }
        if (out(x - 1, y)) { g.moveTo(x * k, y * k); g.lineTo(x * k, (y + 1) * k); }
        if (out(x + 1, y)) { g.moveTo((x + 1) * k, y * k); g.lineTo((x + 1) * k, (y + 1) * k); }
      }
      g.stroke();
    }
    if (hov >= 0 && hov !== sel) paint(hov, 'rgba(22, 32, 26, 0.28)');
  }, [base, size, selected, hover, region, n]);

  const cellAt = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * n), y = Math.floor(((e.clientY - r.top) / r.height) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    const fi = region.fieldOf[y * n + x];
    return fi >= 0 ? region.fields[fi]?.id ?? null : null;
  };

  return (
    <div className="map-wrap" ref={wrap}>
      <div className="map-square" style={{ width: size, height: size }}>
        <canvas
          ref={canvas}
          className={`map-canvas ${hover ? 'is-pointing' : ''}`}
          style={{ width: size, height: size }}
          onPointerMove={(e) => { const id = cellAt(e); if (id !== useApp.getState().hoverFarm) useApp.setState({ hoverFarm: id }); }}
          onPointerLeave={() => useApp.setState({ hoverFarm: null })}
          onClick={(e) => useApp.getState().selectFarm(cellAt(e))}
          role="img"
          aria-label={`Map of ${region.fields.length} fields around the Farm Hand boxes`}
        />
        <span className="map-you" style={{ left: '50%', top: '50%' }}><i /><b>Farm Hand boxes</b></span>
      </div>
    </div>
  );
}

function Legend({ region }: { region: Region }) {
  const crops = region.legend.filter((l) => l.farmed).sort((a, b) => b.sharePct - a.sharePct).slice(0, 6);
  return (
    <ul className="map-legend" aria-label="Map key">
      {crops.map((l) => <li key={l.code}><i style={{ background: l.color }} />{l.name}</li>)}
      <li><i className="is-land" />Not farmed</li>
    </ul>
  );
}

// ------------------------------------------------------------------------------ the side
function Spark({ trend }: { trend: Trend }) {
  const W = 220, H = 48;
  const vs = trend.map((p) => p.value), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const pts = trend.map((p, i) => `${((i / (trend.length - 1)) * W).toFixed(1)},${(H - 4 - ((p.value - lo) / span) * (H - 8)).toFixed(1)}`).join(' ');
  const last = trend[trend.length - 1];
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Trend from ${trend[0].year} to ${last.year}`}>
        <polyline points={pts} />
      </svg>
      <figcaption className="num"><span>{trend[0].year}</span><span>{last.year}</span></figcaption>
    </figure>
  );
}

function FieldCard({ f, year }: { f: RegionField; year: number }) {
  const x = extras(f);
  const soil = f.soil;
  return (
    <section className="field-card" key={f.id} aria-label={`Field: ${f.crop}`}>
      <header>
        <div>
          <p className="predicted">Predicted from satellite, {year}</p>
          <h2>{f.crop}</h2>
          <p className="muted num">About {fmtAcres(f.areaHa)} acres, {f.distanceKm.toFixed(1)} km {f.bearing} of the boxes</p>
        </div>
        <button className="btn btn-icon" onClick={() => useApp.getState().selectFarm(null)} aria-label="Close field"><IconClose /></button>
      </header>
      {x.baseline != null && (
        <div className="field-baseline">
          <p>Farm Hand would keep this field at <b className="num">{x.baseline.toFixed(1)}%</b> or more.</p>
          <p className="small">That is where {f.crop.toLowerCase()} starts to feel dry (FAO-56 stress line).</p>
        </div>
      )}
      <dl className="field-lines">
        <div><dt>Grows here</dt><dd>{f.grows.slice(0, 3).map((g) => `${g.name.toLowerCase()} ${Math.round(g.sharePct)}%`).join(', ') || 'unknown'}</dd></div>
        <div><dt>Soil</dt><dd>{soil ? <>{soil.series}{soil.texture ? `, ${soil.texture.toLowerCase()}` : ''}{soil.drainagecl ? `, ${soil.drainagecl.toLowerCase()}` : ''}</> : 'unknown (no soil survey here)'}</dd></div>
        <div><dt>Water it holds</dt><dd className="num">{x.waterCm != null ? `${x.waterCm.toFixed(1)} cm in the root zone` : 'unknown'}</dd></div>
        <div><dt>Fields like this one</dt><dd className="num">{x.similar != null ? `${Math.round(x.similar).toLocaleString()} in Miami-Dade` : 'unknown'}</dd></div>
      </dl>
      {x.trend && (
        <div className="field-trend">
          <h3>{x.trendLabel}</h3>
          <Spark trend={x.trend} />
        </div>
      )}
      <p className="small muted">Crop and trend are predictions from AlphaEarth satellite embeddings, not a survey. Soil is from USDA SSURGO. The baseline is FAO-56 guidance for the predicted crop.</p>
    </section>
  );
}

function Overview({ data }: { data: RegionView }) {
  const region = data.region!;
  const farmedHa = region.fields.reduce((s, f) => s + f.areaHa, 0);
  const top = region.legend.filter((l) => l.farmed).sort((a, b) => b.sharePct - a.sharePct).slice(0, 4);
  return (
    <section className="field-card" aria-label="Miami-Dade overview">
      <h2>Your farm in Miami-Dade</h2>
      <p>Every field around the boxes, predicted from satellite. Pick one on the map to see its crop, its soil, and the moisture Farm Hand would hold it at.</p>
      <dl className="overview-stats">
        <div><dt>Fields</dt><dd className="num">{region.fields.length.toLocaleString()}</dd></div>
        <div><dt>Farmland</dt><dd className="num">{fmtAcres(farmedHa)}<small> acres</small></dd></div>
      </dl>
      {top.length > 0 && <p className="muted">Mostly {top.map((l) => l.name.toLowerCase()).join(', ')}.</p>}
    </section>
  );
}

export function RegionPage() {
  const data = useApp((s) => s.regionData);
  const selected = useApp((s) => s.selectedFarm);
  useEffect(() => {
    void useApp.getState().loadRegion();
    return () => useApp.setState({ hoverFarm: null });
  }, []);
  const region = data?.status === 'ready' ? data.region : null;
  const field = region && selected ? region.fields.find((f) => f.id === selected) ?? null : null;

  return (
    <>
      <div className="map-area">
        {region ? (
          <>
            <MapCanvas region={region} />
            <p className="map-label">Predicted from satellite: AlphaEarth, {region.year}. Not property lines.</p>
            <Legend region={region} />
          </>
        ) : (
          <div className="map-empty">
            <h2>Your farm in Miami-Dade</h2>
            <p className="muted">
              {!data || data.status === 'loading' ? 'Loading the fields around the boxes.'
                : data.status === 'no_place' ? 'The map needs the boxes\' location. It loads as soon as the server has one.'
                : data.reason ?? 'The field map is not available right now.'}
            </p>
          </div>
        )}
      </div>
      <aside className="side">
        {region && data && (field ? <FieldCard f={field} year={region.year} /> : <Overview data={data} />)}
        {region && region.sources.length > 0 && (
          <section className="sources">
            <h2>Sources</h2>
            <ul>{region.sources.map((s) => <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>: {s.what}</li>)}</ul>
          </section>
        )}
      </aside>
    </>
  );
}
