/**
 * Map panel: the farm fields around the boxes at FIU (Sweetwater, Kendall, the 8.5 Square Mile Area, down to
 * Redland / Homestead), from the AlphaEarth v2 build served at /farmhand/api/region. Each field is drawn from its
 * own polygon, coloured by predicted crop. The map opens framed on FIU.
 * Click a field: crop, soil, the moisture line Farm Hand would hold it at, similar fields, the yearly trend.
 * Click anywhere else: that spot's soil water and temperature now (Open-Meteo) and its USDA soil type.
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
import './region.css';

// ------------------------------------------------------------------ v2 shapes, read defensively
interface FieldV2 extends RegionField {
  polygon?: [number, number][];
  acres?: number; confidence?: number; baselinePct?: number | null;
  similar?: { count: number; top?: string[] } | number;
  trend?: number[];
}
interface CropSummary { fields: number; acres: number }
interface SoilSpot { lat: number; lon: number; series: string | null; mapUnit?: string | null; texture?: string | null; drainageClass?: string | null; awsCm?: number | null }
const spotsOf = (r: Region) => (r as Region & { soilSpots?: { points?: SoilSpot[] } }).soilSpots?.points ?? [];
interface AlphaEarth {
  box?: [number, number, number, number];
  trendYears?: number[];
  summary?: {
    fields?: number; acres?: number; byCrop?: Record<string, CropSummary>; nearFiu?: Record<string, CropSummary>;
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
/** Soil water (% by volume): dry sand to wet blue. */
const MOIST_LO = 5, MOIST_HI = 45;
const MOIST_STOPS: [number, number[]][] = [[MOIST_LO, [227, 194, 122]], [20, [128, 196, 226]], [MOIST_HI, [27, 95, 201]]];
function moistColor(v: number | null): string {
  if (v == null) return '#8a8f86';
  const x = Math.max(MOIST_LO, Math.min(MOIST_HI, v));
  const i = x <= MOIST_STOPS[1][0] ? 0 : 1;
  const [[x0, a], [x1, b]] = [MOIST_STOPS[i], MOIST_STOPS[i + 1]];
  const k = (x - x0) / (x1 - x0);
  return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * k)).join(',')})`;
}
function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * 110.574, (a.lon - b.lon) * 111.32 * k);
}
type Spot = { lat: number; lon: number };

// ------------------------------------------------------------------ the map (Leaflet over satellite imagery)
function FieldMap({ region, selected, onPick, soilNow, spot, onSpot }: {
  region: Region; selected: string | null; onPick: (id: string | null) => void;
  soilNow: SoilNow | null; spot: Spot | null; onSpot: (s: Spot | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, L.Polygon>());
  const soilLayer = useRef<L.LayerGroup | null>(null);
  const spotMark = useRef<L.CircleMarker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const spotRef = useRef(onSpot);
  spotRef.current = onSpot;
  const colors = useMemo(() => new Map(region.fields.map((f) => [f.crop, cropColor(f.crop)])), [region]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, preferCanvas: false, minZoom: 8, maxZoom: 17, zoomSnap: 0.25 });
    map.current = m;
    // default view (set first, so every layer is added to a map that has one): centred on the boxes at FIU,
    // wide enough to take in the nearest ~25 farms (6-13 km out)
    const home: [number, number] = [region.centre.lat, region.centre.lon];
    const near = region.fields.map((f) => f.distanceKm).sort((a, b) => a - b);
    const reachKm = Math.max(6, Math.min(13, (near[Math.min(24, near.length - 1)] ?? 8) + 0.5));
    const frameBox = L.latLng(home).toBounds(2 * reachKm * 1000);
    // keep FIU centred in the part of the map the legend card does not cover; re-frame on resize until the user moves the map
    let framing = false, touched = false;
    const frame = () => {
      const card = el.current?.parentElement?.querySelector<HTMLElement>('.map-legend-card');
      const right = card && getComputedStyle(card).position === 'absolute' ? card.offsetWidth + 24 : 8;
      framing = true;
      m.fitBounds(frameBox, { paddingTopLeft: [8, 8], paddingBottomRight: [right, 8], animate: false });
      framing = false;
    };
    m.on('movestart', () => { if (!framing) touched = true; });
    frame();
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => { pick.current(null); spotRef.current({ lat: e.latlng.lat, lon: e.latlng.lng }); });

    const fieldsLayer = L.layerGroup().addTo(m);
    for (const f of region.fields) {
      const poly = fv(f).polygon;
      if (!poly || poly.length < 3) continue;
      const ll = poly.map(([lon, lat]) => [lat, lon] as [number, number]);
      const layer = L.polygon(ll, { color: colors.get(f.crop) ?? '#e0e0e0', weight: 1.5, fillOpacity: 0.7, opacity: 1 })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); spotRef.current(null); pick.current(f.id); })
        .bindTooltip(`${f.crop}, about ${fmtInt(acresOf(f))} acres`, { sticky: true, direction: 'top', className: 'field-tip' })
        .addTo(fieldsLayer);
      layers.current.set(f.id, layer);
    }
    // USDA soil type at points around the boxes (land with no fields still has a soil)
    const typeLayer = L.layerGroup();                 // off at first (a 1 km grid); tapping any spot gives its soil anyway
    for (const p of spotsOf(region)) {
      if (!p.series) continue;
      L.circleMarker([p.lat, p.lon], { radius: 3, color: '#16201a', weight: 0.5, fillColor: '#e0c68f', fillOpacity: 0.95 })
        .bindTooltip(`USDA soil: ${p.series}${p.texture ? `, ${p.texture.toLowerCase()}` : ''}`, { direction: 'top', className: 'field-tip' })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); pick.current(null); spotRef.current({ lat: p.lat, lon: p.lon }); })
        .addTo(typeLayer);
    }
    const soilNowLayer = L.layerGroup().addTo(m);
    soilLayer.current = soilNowLayer;
    L.control.layers(undefined, {
      'Farm fields <small>(Google AlphaEarth)</small>': fieldsLayer,
      'Soil water now <small>(Open-Meteo)</small>': soilNowLayer,
      'Soil type points <small>(USDA)</small>': typeLayer,
    }, { position: 'bottomleft', collapsed: el.current.clientWidth < 700 }).addTo(m);
    // the Farm Hand boxes at FIU
    L.circleMarker(home, { radius: 8, color: '#fafbf8', weight: 3, fillColor: '#1b66c9', fillOpacity: 1, interactive: false })
      .bindTooltip('Your boxes (FIU)', { permanent: true, direction: 'right', offset: [10, 0], className: 'home-tip' })
      .addTo(m);
    const ro = new ResizeObserver(() => { m.invalidateSize(); if (!touched) frame(); });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; layers.current.clear(); soilLayer.current = null; spotMark.current = null; };
  }, [region, colors]);

  // soil water now: one dot per Open-Meteo point, coloured dry -> wet
  useEffect(() => {
    const g = soilLayer.current;
    if (!g || !soilNow) return;
    g.clearLayers();
    for (const p of soilNow.points) {
      if (p.moisturePct == null) continue;            // open water: the soil model has no value there
      L.circleMarker([p.lat, p.lon], { radius: 7, color: '#16201a', weight: 1, opacity: 0.6, fillColor: moistColor(p.moisturePct), fillOpacity: 0.9 })
        .bindTooltip(`Soil water now ${p.moisturePct ?? '?'}%, ${p.temp6cmC ?? '?'} °C at 6 cm (Open-Meteo)`, { direction: 'top', className: 'field-tip' })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); pick.current(null); spotRef.current({ lat: p.lat, lon: p.lon }); })
        .addTo(g);
    }
  }, [soilNow, region]);

  // the clicked spot
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    spotMark.current?.remove(); spotMark.current = null;
    if (spot) spotMark.current = L.circleMarker([spot.lat, spot.lon], { radius: 10, color: '#fafbf8', weight: 3, fill: false, interactive: false }).addTo(m);
  }, [spot, region]);

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

function SoilNowBlock({ soilNow, lat, lon }: { soilNow: SoilNow | null; lat: number; lon: number }) {
  const pt = soilNow ? nearest(soilNow.points, lat, lon) : null;
  const week = (pt?.week ?? []).filter((v): v is number => typeof v === 'number');
  return (
    <div className="fc-block">
      <h4>Soil right now <span className="fc-src">Open-Meteo model</span></h4>
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
  );
}

function FieldCard({ f, soilNow, onClose }: { f: RegionField; soilNow: SoilNow | null; onClose: () => void }) {
  const x = fv(f), sim = similarOf(f), soil = f.soil as (RegionField['soil'] & { awsCm?: number | null }) | null;
  const sw = soilWords(soil?.texture), ww = waterWords(soil?.awsCm);
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

      <SoilNowBlock soilNow={soilNow} lat={f.lat} lon={f.lon} />

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

const DRAIN_WORDS: Record<string, string> = { fast: 'drains fast', moderate: 'drains well', slow: 'drains slowly', very_slow: 'stays wet (poorly drained)' };
const BEAR8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
function bearingWords(from: Spot, to: Spot) {
  const dx = (to.lon - from.lon) * Math.cos((from.lat * Math.PI) / 180), dy = to.lat - from.lat;
  return BEAR8[Math.round((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) / 45) % 8];
}

/** Any spot on the map, farm or not: soil water now (Open-Meteo), USDA soil type, the nearest farm. */
function SpotCard({ spot, region, soilNow, onPick, onClose }: { spot: Spot; region: Region; soilNow: SoilNow | null; onPick: (id: string) => void; onClose: () => void }) {
  const home = region.centre;
  const dk = kmBetween(home, spot);
  let soil: SoilSpot | null = null, sd = Infinity;
  for (const p of spotsOf(region)) { const d = kmBetween(spot, p); if (d < sd) { sd = d; soil = p; } }
  if (sd > 1.2) soil = null;
  let farm: RegionField | null = null, fd = Infinity;
  for (const f of region.fields) { const d = kmBetween(spot, f); if (d < fd) { fd = d; farm = f; } }
  const sw = soilWords(soil?.texture), ww = waterWords(soil?.awsCm);
  return (
    <section className="field-card rich" aria-label="This spot">
      <header className="fc-head">
        <span className="fc-icon spot-icon" aria-hidden><i /></span>
        <div>
          <h3>This spot</h3>
          <p className="num">{dk < 0.3 ? 'At your boxes' : `${dk.toFixed(1)} km ${bearingWords(home, spot)} of your boxes`}</p>
        </div>
        <button className="btn btn-icon" onClick={onClose} aria-label="Back to the overview"><IconClose /></button>
      </header>
      <SoilNowBlock soilNow={soilNow} lat={spot.lat} lon={spot.lon} />
      <div className="fc-block">
        <h4>Soil type <span className="fc-src">USDA soil survey</span></h4>
        {soil?.series ? (
          <p className="fc-need"><b>{soil.series}</b>{sw ? `, ${sw}` : ''}{soil.drainageClass && DRAIN_WORDS[soil.drainageClass] ? `, ${DRAIN_WORDS[soil.drainageClass]}` : ''}{ww ? `; ${ww}` : ''}.</p>
        ) : (
          <p className="muted">{spotsOf(region).length ? 'Soil type points cover 8 km around your boxes; tap a farm for its soil.' : 'No soil type points in this map.'}</p>
        )}
      </div>
      {farm && (
        <div className="fc-block">
          <h4>Nearest farm</h4>
          <button className="spot-farm" onClick={() => onPick(farm.id)}>
            <i style={{ background: cropColor(farm.crop) }} /><span>{farm.crop}</span><b className="num">{fd < 1 ? `${Math.round(fd * 1000)} m` : `${fd.toFixed(1)} km`}</b>
          </button>
        </div>
      )}
      <p className="fc-source">Soil now: Open-Meteo model (~10 km). Soil type: USDA SSURGO. Farms: Google satellite (AlphaEarth).</p>
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
      <h4>What grows here <span>Google AlphaEarth satellite data, {region.year}</span></h4>
      <ul>
        {main.map(([name, n]) => <li key={name}><i style={{ background: cropColor(name) }} /><span>{shortName(name)}</span><b className="num">{fmtInt(n)}</b></li>)}
        {other > 0 && <li><i className="is-other" style={{ background: `linear-gradient(90deg, ${rest.map(([n]) => cropColor(n)).join(', ')})` }} /><span>Other</span><b className="num">{fmtInt(other)}</b></li>}
      </ul>
      <div className="legend-soil">
        <h4>Soil water now <span>Open-Meteo model, dots</span></h4>
        <div className="legend-ramp" aria-hidden style={{ background: `linear-gradient(90deg, ${moistColor(MOIST_LO)}, ${moistColor(20)} ${(100 * (20 - MOIST_LO)) / (MOIST_HI - MOIST_LO)}%, ${moistColor(MOIST_HI)})` }} />
        <div className="legend-ramp-labels num"><span>dry {MOIST_LO}%</span><span>wet {MOIST_HI}%</span></div>
      </div>
      <ul><li className="legend-home"><i /><span>Your boxes (FIU)</span></li></ul>
      <p className="legend-src">Crops: Google DeepMind AlphaEarth. Soil water and temperature: Open-Meteo. Soil type: USDA. Tap anywhere for that spot.</p>
    </div>
  );
}

function HowWeKnow({ region }: { region: Region }) {
  const acc = ae(region).summary?.fieldClassifier;
  return (
    <details className="how">
      <summary>How we know</summary>
      <p>Crops are predicted from Google DeepMind's AlphaEarth satellite data ({region.year}){acc?.accuracy != null ? `, right on ${pct(acc.accuracy)} of test fields (${pct(acc.areaWeightedAccuracy ?? acc.accuracy)} of the area)` : ''}. Soil type comes from the USDA soil survey. Soil water and temperature right now come from the Open-Meteo soil model (about 10 km across, so nearby dots can read the same). The moisture line is FAO-56 guidance for each crop.</p>
      <ul>{region.sources.map((s) => <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}</ul>
    </details>
  );
}

function Overview({ region }: { region: Region }) {
  const s = ae(region).summary ?? {};
  const near = region.fields.filter((f) => f.distanceKm <= 10);
  return (
    <section className="field-card" aria-label="All farms">
      <h4 className="near-h">Within 10 km of your boxes</h4>
      <dl className="overview-stats">
        <div><dt>Farms</dt><dd className="num">{fmtInt(near.length)}</dd></div>
        <div><dt>Acres</dt><dd className="num">{fmtInt(near.reduce((t, f) => t + acresOf(f), 0))}</dd></div>
      </dl>
      <p className="muted num">On the whole map: {fmtInt(s.fields ?? region.fields.length)} farms, {fmtInt(s.acres ?? region.fields.reduce((t, f) => t + acresOf(f), 0))} acres, down to Homestead.</p>
      <p className="muted">Tap a colored shape to see what grows there, its soil, and the moisture Farm Hand would keep it at. Tap anywhere else for that spot's soil water, temperature and soil type.</p>
    </section>
  );
}

export function MapPanel() {
  const data = useApp((s) => s.regionData);
  const [sel, setSel] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
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
        <p className="map-intro">Farms around your boxes at FIU, colored by what the satellite says grows there. Dots show soil water right now. Tap anything.</p>
        <div className="map-frame">
          <FieldMap region={region} selected={sel} onPick={setSel} soilNow={soilNow} spot={spot} onSpot={setSpot} />
          <Legend region={region} />
        </div>
      </div>
      <div className="map-side">
        {field ? <FieldCard f={field} soilNow={soilNow} onClose={() => setSel(null)} />
          : spot ? <SpotCard spot={spot} region={region} soilNow={soilNow} onPick={(id) => { setSpot(null); setSel(id); }} onClose={() => setSpot(null)} />
          : <Overview region={region} />}
        <HowWeKnow region={region} />
      </div>
    </div>
  );
}
