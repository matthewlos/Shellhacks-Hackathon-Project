/**
 * Map panel: the farm fields south of the boxes (Redland / Homestead), from the AlphaEarth v2 build
 * served at /farmhand/api/region. Each field is drawn from its own polygon, coloured by predicted crop.
 * Click a field: crop, soil, the moisture line Farm Hand would hold it at, similar fields, the yearly trend.
 *
 * TODO(data): the v2 extras (polygon, baselinePct, similar, trend, acres, confidence, region.alphaearth)
 * are not in data/types.ts yet, so they are read through the local types below.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../data/store';
import type { Region, RegionField } from '../data/types';
import * as backend from '../data/backendBoard';
import { CropIcon } from './CropIcons';
import { IconClose } from './icons';

// ------------------------------------------------------------------ v2 shapes, read defensively
interface FieldV2 extends RegionField {
  polygon?: [number, number][];
  acres?: number; confidence?: number; baselinePct?: number | null;
  similar?: { count: number; top?: string[] } | number;
  trend?: number[];
}
interface CropSummary { fields: number; acres: number }
interface AlphaEarth {
  box?: [number, number, number, number];
  trendYears?: number[];
  summary?: {
    fields?: number; acres?: number; byCrop?: Record<string, CropSummary>;
    fieldClassifier?: { accuracy?: number; areaWeightedAccuracy?: number };
  };
  pTable?: Record<string, { fao?: string; baselinePct?: number | null }>;
}
const ae = (r: Region) => ((r as Region & { alphaearth?: AlphaEarth }).alphaearth ?? {}) as AlphaEarth;
const fv = (f: RegionField) => f as FieldV2;
const acresOf = (f: RegionField) => fv(f).acres ?? f.areaHa * 2.47105;
const similarOf = (f: RegionField) => { const s = fv(f).similar; return typeof s === 'number' ? { count: s, top: [] } : s ?? null; };
const fmtInt = (x: number) => Math.round(x).toLocaleString();
/** Bright enough to read over satellite imagery; one colour per crop group. */
const CROP_COLORS: [RegExp, string][] = [[/avocado/i, '#9be15d'], [/vegetable|row crop|tomato/i, '#ffd23f'], [/mango|lychee|tree fruit/i, '#ff8c42'], [/citrus/i, '#ff5d8f'], [/sugar/i, '#c77dff'], [/sod|nursery|grass/i, '#5ce1e6']];
const cropColor = (name: string) => CROP_COLORS.find(([re]) => re.test(name))?.[1] ?? '#e0e0e0';
const pct = (x: number) => `${Math.round(x * 100)}%`;

// ------------------------------------------------------------------ the map (Leaflet over satellite imagery)
function FieldMap({ region, selected, onPick }: { region: Region; selected: string | null; onPick: (id: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, L.Polygon>());
  const pick = useRef(onPick);
  pick.current = onPick;
  const colors = useMemo(() => new Map(region.fields.map((f) => [f.crop, cropColor(f.crop)])), [region]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, preferCanvas: false, minZoom: 8, maxZoom: 17 });
    map.current = m;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    }).addTo(m);
    m.on('click', () => pick.current(null));

    const all: L.LatLngExpression[] = [];
    for (const f of region.fields) {
      const poly = fv(f).polygon;
      if (!poly || poly.length < 3) continue;
      const ll = poly.map(([lon, lat]) => [lat, lon] as [number, number]);
      all.push(...ll);
      const layer = L.polygon(ll, { color: colors.get(f.crop) ?? '#e0e0e0', weight: 1.5, fillOpacity: 0.7, opacity: 1 })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); pick.current(f.id); })
        .bindTooltip(`${f.crop}, about ${fmtInt(acresOf(f))} acres`, { sticky: true, direction: 'top', className: 'field-tip' })
        .addTo(m);
      layers.current.set(f.id, layer);
    }
    // the Farm Hand boxes at FIU
    const home: [number, number] = [region.centre.lat, region.centre.lon];
    L.circleMarker(home, { radius: 8, color: '#fafbf8', weight: 3, fillColor: '#1b66c9', fillOpacity: 1, interactive: false })
      .bindTooltip('Your boxes (FIU)', { permanent: true, direction: 'right', offset: [10, 0], className: 'home-tip' })
      .addTo(m);
    // default view: the farm belt with the boxes still in frame
    // on a narrow phone the farms alone fill the frame (the pin is a scroll away); wider screens show both
    const narrow = el.current.clientWidth < 500;
    const bounds = all.length ? (narrow ? L.latLngBounds(all) : L.latLngBounds(all).extend(home)) : L.latLng(home).toBounds(30000);
    m.fitBounds(bounds, { padding: [24, 24] });
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; layers.current.clear(); };
  }, [region, colors]);

  // selection: the chosen field inked, its similar fields outlined blue, the rest faded
  useEffect(() => {
    const f = selected ? region.fields.find((x) => x.id === selected) : null;
    const sim = new Set(f ? similarOf(f)?.top ?? [] : []);
    for (const [id, layer] of layers.current) {
      const base = colors.get(region.fields.find((x) => x.id === id)?.crop ?? '') ?? '#8a8f86';
      if (id === selected) {
        layer.setStyle({ color: '#fafbf8', weight: 3, fillColor: base, fillOpacity: 0.85 }).bringToFront();
        // bring the chosen farm into view, clear of the legend card
        map.current?.flyToBounds(layer.getBounds(), { maxZoom: 14, duration: 0.45, paddingTopLeft: [40, 40], paddingBottomRight: [400, 40] });
      }
      else if (sim.has(id)) layer.setStyle({ color: '#5aa2ff', weight: 2.5, fillColor: base, fillOpacity: 0.6 });
      else layer.setStyle({ color: base, weight: 1.5, fillColor: base, fillOpacity: f ? 0.3 : 0.7 });
    }
  }, [selected, region, colors]);

  return <div className="fieldmap" ref={el} role="application" aria-label={`${region.fields.length} farm fields over satellite imagery`} />;
}

// ------------------------------------------------------------------ side: plain words
const DIRS: Record<string, string> = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
const waterWords = (cm: number | null | undefined) => cm == null ? null : cm < 5 ? 'holds little water' : cm < 10 ? 'holds some water' : 'holds a lot of water';
function soilWords(texture: string | null | undefined): string | null {
  if (!texture) return null;
  const t = texture.toLowerCase();
  if (t.includes('very gravelly')) return 'very gravelly';
  if (t.includes('gravelly')) return 'gravelly';
  if (t.includes('muck') || t.includes('peat')) return 'mucky';
  if (t.includes('sand')) return 'sandy';
  if (t.includes('clay')) return 'clay';
  return t.replace(/ loam$/, ' loam');
}

// ------------------------------------------------------------------ soil right now (Open-Meteo model, via the server)
interface SoilPoint { lat: number; lon: number; moisturePct: number | null; temp6cmC: number | null; week?: (number | null)[] }
interface SoilNow { status: string; points: SoilPoint[] }
const API = ((backend as unknown as { BACKEND_URL?: string }).BACKEND_URL ?? '/farmhand') + '/api/soil-now';

/** Fetched once per map open; the server caches it for 30 minutes. */
function useSoilNow(): SoilNow | null {
  const [d, setD] = useState<SoilNow | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(API).then((r) => r.json()).then((j: SoilNow) => { if (alive && j?.status === 'ready' && Array.isArray(j.points)) setD(j); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return d;
}
function nearest(points: SoilPoint[], lat: number, lon: number): SoilPoint | null {
  const k = Math.cos((lat * Math.PI) / 180);
  let best: SoilPoint | null = null, bd = Infinity;
  for (const p of points) { const d = (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

/** Counts up once to the value (~600 ms, ease-out); instant with reduced motion. */
function CountUp({ value, digits = 1 }: { value: number; digits?: number }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(value); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 600); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{v.toFixed(digits)}</>;
}

function WeekLine({ week }: { week: number[] }) {
  const W = 120, H = 32, lo = Math.min(...week) - 1, hi = Math.max(...week) + 1;
  const pts = week.map((v, i) => `${((i / (week.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`).join(' ');
  return <svg className="week-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden><polyline points={pts} /></svg>;
}
function weekWords(week: number[]): string {
  const d = week[week.length - 1] - week[0];
  if (d <= -2) return 'drying all week';
  if (d >= 2) return 'wetter than last week';
  return 'about the same all week';
}

function FieldCard({ f, soilNow, onClose }: { f: RegionField; soilNow: SoilNow | null; onClose: () => void }) {
  const x = fv(f), sim = similarOf(f), soil = f.soil as (RegionField['soil'] & { awsCm?: number | null }) | null;
  const sw = soilWords(soil?.texture), ww = waterWords(soil?.awsCm);
  const pt = soilNow ? nearest(soilNow.points, f.lat, f.lon) : null;
  const week = (pt?.week ?? []).filter((v): v is number => typeof v === 'number');
  const color = cropColor(f.crop);
  return (
    <section className="field-card rich" key={f.id} aria-label={`Farm: ${f.crop}`}>
      <header className="fc-head">
        <span className="fc-icon" style={{ color, background: `${color}26` }}><CropIcon crop={f.crop} /></span>
        <div>
          <h3>{f.crop}</h3>
          <p className="num">About {fmtInt(acresOf(f))} acres, {Math.round(f.distanceKm)} km {DIRS[f.bearing] ?? f.bearing} of your boxes</p>
        </div>
        <button className="btn btn-icon" onClick={onClose} aria-label="Back to the overview"><IconClose /></button>
      </header>

      <div className="fc-block">
        <h4>Soil right now</h4>
        {!pt ? <p className="muted">Loading today's soil.</p> : (
          <div className="fc-now">
            <div className="fc-moist">
              <p className="fc-big num">{pt.moisturePct != null ? <><CountUp value={pt.moisturePct} />%</> : 'unknown'}<small> water</small></p>
              {pt.moisturePct != null && <div className="gauge" aria-hidden><i style={{ transform: `scaleX(${Math.min(1, pt.moisturePct / 50)})` }} /><span>dry</span><span>wet</span></div>}
            </div>
            <div className="fc-temp">
              <p className="fc-mid num">{pt.temp6cmC != null ? <><CountUp value={pt.temp6cmC} /> °C</> : 'unknown'}</p>
              <p className="muted small">at 6 cm deep</p>
            </div>
            {week.length > 1 && (
              <div className="fc-week">
                <WeekLine week={week} />
                <p className="small"><b>{weekWords(week)}</b></p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fc-block">
        <h4>What this crop needs</h4>
        {x.baselinePct != null && <p className="fc-need">Farm Hand would water it before the soil drops below <b className="num">{x.baselinePct.toFixed(1)}%</b> on its probe.</p>}
        <p className="fc-need">Soil here is {sw ?? 'of an unknown type'}{ww ? `, and it ${ww}` : ''}.</p>
        {sim && sim.count > 0 && <p className="muted num">{fmtInt(sim.count)} farms nearby look like this one{sim.top?.length ? ' (outlined in blue)' : ''}.</p>}
      </div>

      <p className="fc-source">Soil now: Open-Meteo model (~10 km). Crop: Google satellite (AlphaEarth). Soil type: USDA.</p>
    </section>
  );
}

const SHORT: [RegExp, string][] = [[/mango|lychee/i, 'Mango/lychee/tree fruit']];
const shortName = (n: string) => SHORT.find(([re]) => re.test(n))?.[1] ?? n;

/** Always on the map, readable from 2-3 m: what each colour means, and whose data it is. */
function Legend({ region }: { region: Region }) {
  const counts = new Map<string, number>();
  const by = ae(region).summary?.byCrop;
  if (by) for (const [n, c] of Object.entries(by)) counts.set(n, c.fields);
  else for (const f of region.fields) counts.set(f.crop, (counts.get(f.crop) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const main = sorted.slice(0, 3), rest = sorted.slice(3);
  const other = rest.reduce((t, [, n]) => t + n, 0);
  return (
    <div className="map-legend-card" aria-label="Map legend">
      <h4>What grows here <span>(Google satellite data)</span></h4>
      <ul>
        {main.map(([name, n]) => <li key={name}><i style={{ background: cropColor(name) }} /><span>{shortName(name)}</span><b className="num">{fmtInt(n)}</b></li>)}
        {other > 0 && <li><i className="is-other" style={{ background: `linear-gradient(90deg, ${rest.map(([n]) => cropColor(n)).join(', ')})` }} /><span>Other</span><b className="num">{fmtInt(other)}</b></li>}
        <li className="legend-home"><i /><span>Your boxes (FIU)</span></li>
      </ul>
      <p>Crop types predicted by Google DeepMind's AlphaEarth satellite model, {region.year}.</p>
    </div>
  );
}

function HowWeKnow({ region }: { region: Region }) {
  const acc = ae(region).summary?.fieldClassifier;
  return (
    <details className="how">
      <summary>How we know</summary>
      <p>Crops are predicted from Google DeepMind's AlphaEarth satellite data ({region.year}){acc?.accuracy != null ? `, right on ${pct(acc.accuracy)} of test fields (${pct(acc.areaWeightedAccuracy ?? acc.accuracy)} of the area)` : ''}. Soil comes from the USDA soil survey. The moisture line is FAO-56 guidance for each crop.</p>
      <ul>{region.sources.map((s) => <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}</ul>
    </details>
  );
}

function Overview({ region }: { region: Region }) {
  const s = ae(region).summary ?? {};
  return (
    <section className="field-card" aria-label="All farms">
      <dl className="overview-stats">
        <div><dt>Farms</dt><dd className="num">{fmtInt(s.fields ?? region.fields.length)}</dd></div>
        <div><dt>Acres</dt><dd className="num">{fmtInt(s.acres ?? region.fields.reduce((t, f) => t + acresOf(f), 0))}</dd></div>
      </dl>
      <p className="muted">Tap a colored square to see what grows there, its soil, and the moisture Farm Hand would keep it at.</p>
    </section>
  );
}

export function MapPanel() {
  const data = useApp((s) => s.regionData);
  const [sel, setSel] = useState<string | null>(null);
  const soilNow = useSoilNow();
  useEffect(() => { if (!useApp.getState().regionData) void useApp.getState().loadRegion(); }, []);
  const region = data?.status === 'ready' ? data.region : null;
  const field = region && sel ? region.fields.find((f) => f.id === sel) ?? null : null;

  if (!region) {
    return <div className="map-empty"><p className="muted">{!data || data.status === 'loading' ? 'Loading the farms.' : data.reason ?? 'The farm map is not available right now.'}</p></div>;
  }
  return (
    <div className="map-layout">
      <div className="map-main">
        <p className="map-intro">Each colored square is a farm near you. The color is what the satellite says grows there. Tap one.</p>
        <div className="map-frame">
          <FieldMap region={region} selected={sel} onPick={setSel} />
          <Legend region={region} />
        </div>
      </div>
      <div className="map-side">
        {field ? <FieldCard f={field} soilNow={soilNow} onClose={() => setSel(null)} /> : <Overview region={region} />}
        <HowWeKnow region={region} />
      </div>
    </div>
  );
}
