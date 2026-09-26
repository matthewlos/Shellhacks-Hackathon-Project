/**
 * BackendBoard: the real data source. Implements BoardSource against the Farm Hand server
 * (farm-hand/cloud/receiver.py on the Mac mini), same origin under /farmhand.
 *
 *   live data   Server-Sent Events from GET /farmhand/api/events (named events: config, sample,
 *               decision, link; the Prompt Grass ones are still listened for)
 *   everything  plain REST, one route per BoardSource method
 *
 * There is no simulator. Crop scores, planting windows and frost dates are computed HERE in the
 * browser with the Prompt Grass engine (sim/crops.ts, sim/season.ts), fed with the zone's live soil
 * temperature and its config (sun, pH if set); frost dates come from the Open-Meteo archive at FIU
 * (estimates). Drainage stays unknown unless the region payload gives SSURGO drainage for the plot.
 * Features Farm Hand doesn't have (pour test, notes, calibration from the app) answer "not available".
 * Point it elsewhere with VITE_BACKEND, e.g. VITE_BACKEND=https://farmhand.dmchang.xyz/farmhand npm run dev
 */
import type { BoardEvent, BoardSource } from './source';
import { scoreCrops as engineScoreCrops, cropById } from './sim/crops';
import { plantingWindow as enginePlantingWindow } from './sim/season';
import { fetchFrostDates } from '../services/openMeteo';
import type {
  BoardConfig, Connectivity, CropScore, DrainageClass, ZoneLive, RegionView, Diagnosis, Forecast, FrostDates, HistorySeries, Note, Overrides, Place, PlantingWindow, Plot,
  ProbeId, SoilProfile, Zone, ZoneId, ZoneReading,
} from './types';

export const BACKEND_URL = ((import.meta.env.VITE_BACKEND as string | undefined) || '/farmhand').replace(/\/$/, '');

/** Where the boxes are: FIU, Miami. Frost history is looked up here. */
const FIU: Place = { name: 'FIU', region: 'Florida', country: 'United States', lat: 25.7566, lon: -80.374 };
const DRAINAGE: readonly DrainageClass[] = ['fast', 'moderate', 'slow', 'very_slow'];

const PUMPS_DISARMED = 'pumps are disarmed until the box mapping is confirmed';

const STREAMED = ['config', 'sample', 'decision', 'link', 'pour', 'profile', 'notes', 'overrides', 'agent_call', 'ui_command', 'region'] as const;

async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(BACKEND_URL + path, {
    ...init,
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && body?.ok === undefined) throw new Error(body?.error ?? `Backend answered ${res.status}`);
  return body as T;
}
const post = <T>(path: string, json: unknown = {}) => api<T>(path, { method: 'POST', json });
const put = <T>(path: string, json: unknown) => api<T>(path, { method: 'PUT', json });
/** Fire-and-forget commands: the resulting state comes back on the event stream. */
const send = (p: Promise<unknown>) => void p.catch((e) => console.warn('[backend]', e instanceof Error ? e.message : e));

export class BackendBoard implements BoardSource {
  readonly mode = 'board' as const;
  private listener: (e: BoardEvent) => void = () => {};
  private stream: EventSource | null = null;
  /** What the crop engine reads: kept from the stream here (not from the store, which imports this file). */
  private config: BoardConfig | null = null;
  private live: Record<ZoneId, ZoneLive> = {};
  private lastRegion: RegionView | null = null;
  private frost: Promise<FrostDates> | null = null;

  connect(listener: (e: BoardEvent) => void): void {
    this.listener = (e) => {
      if (e.type === 'config') this.config = e.config;
      else if (e.type === 'sample') this.live = e.zones;
      else if (e.type === 'link' && !e.online) this.live = {};
      listener(e);
    };
    this.open();
  }

  /** Frost dates at FIU: Open-Meteo archive (cached in localStorage by openMeteo.ts), latitude estimate if unreachable. */
  private frostAtFiu(): Promise<FrostDates> {
    if (!this.frost) {
      this.frost = fetchFrostDates(FIU);
      // a fallback (archive unreachable) is kept 5 min, then the archive is tried again
      const retry = () => setTimeout(() => { this.frost = null; }, 5 * 60_000);
      void this.frost.then((f) => { if (f.source !== 'open-meteo-archive') retry(); }, retry);
    }
    return this.frost;
  }

  /** SSURGO drainage for the plot, only if the region payload states it. Never guessed. */
  private surveyDrainage(): DrainageClass | null {
    const d = this.lastRegion?.you?.drainageClass;
    return d && (DRAINAGE as readonly string[]).includes(d) ? (d as DrainageClass) : null;
  }

  private cropContext(zoneId: ZoneId, frost: FrostDates) {
    const zone = this.config?.zones.find((z) => z.id === zoneId);
    const lv = this.live[zoneId];
    return {
      drainageClass: this.surveyDrainage(),
      soilTempC: lv?.tempOnline && lv.tempC != null ? lv.tempC : null,
      sun: zone?.sun ?? null,
      ph: zone?.ph ?? null,
      frost,
    };
  }

  private open(): void {
    const es = new EventSource(`${BACKEND_URL}/api/events`);
    this.stream = es;
    es.onopen = () => this.listener({ type: 'link', online: true });
    // The browser reconnects by itself (the server asks for a 2 s retry). We only report state.
    es.onerror = () => this.listener({ type: 'link', online: false });
    for (const type of STREAMED) {
      es.addEventListener(type, (m) => {
        try { this.listener(JSON.parse((m as MessageEvent).data) as BoardEvent); }
        catch (e) { console.warn('[backend] bad event', type, e); }
      });
    }
  }

  // ------------------------------------------------------------------ configuration
  setPlot(plot: Plot, zones: Zone[]): void { send(put('/api/config/plot', { plot, zones })); }
  updateZone(id: ZoneId, patch: Partial<Pick<Zone, 'sun' | 'ph' | 'name'>>): void { send(api(`/api/zones/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch })); }
  setPlace(place: Place | null): void { send(put('/api/config/place', { place })); }
  setOnboarded(done: boolean): void { send(post('/api/config/onboarded', { done })); }
  async calibrate(probe: ProbeId, step: 'air' | 'water') {
    try { return await post<{ ok: true; raw: number } | { ok: false; error: string }>(`/api/calibrate/${probe}`, { step }); }
    catch { return { ok: false as const, error: 'The backend is not reachable.' }; }
  }
  clearCalibration(probe: ProbeId): void { send(post(`/api/calibrate/${probe}/reset`)); }

  // ------------------------------------------------------------------------- pour test
  armPour(): void { send(post('/api/pour/arm')); }
  resetPour(): void { send(post('/api/pour/reset')); }
  clearSoilProfile(): void { send(post('/api/soil-profile/clear')); }

  // --------------------------------------------------------------------------- answers
  async readZone(id: ZoneId): Promise<ZoneReading> { return (await api<{ reading: ZoneReading }>(`/api/zones/${encodeURIComponent(id)}`)).reading; }
  async soilProfile(): Promise<SoilProfile | null> { return (await api<{ profile: SoilProfile | null }>('/api/soil-profile')).profile; }
  async scoreCrops(id: ZoneId): Promise<CropScore[]> {
    const ctx = this.cropContext(id, await this.frostAtFiu());
    const survey = ctx.drainageClass != null;
    // The engine's wording assumes a pour test. Farm Hand has none: say where drainage came from, or that it is unknown.
    return engineScoreCrops(ctx).map((c) => ({
      ...c,
      factors: c.factors.map((f) => f.key !== 'drainage' ? f
        : !f.known ? { ...f, reason: 'Drainage unknown: Farm Hand has no pour test, and no soil survey drainage for this spot.' }
        : survey ? { ...f, reason: f.reason.replace(/^Measured /, 'USDA soil survey (SSURGO, an estimate): ') } : f),
      summary: survey ? c.summary.replace(/Measured /g, 'Soil-survey ') : c.summary,
    }));
  }
  async plantingWindow(cropId: string, zoneId: ZoneId): Promise<PlantingWindow | null> {
    const crop = cropById(cropId);
    if (!crop) return null;
    const frost = await this.frostAtFiu();
    return enginePlantingWindow(crop, frost, new Date(), this.cropContext(zoneId, frost).soilTempC);
  }
  async forecast(): Promise<Forecast> { return (await api<{ forecast: Forecast }>('/api/forecast')).forecast; }
  async frostDates(): Promise<FrostDates | null> { return this.frostAtFiu(); }
  async diagnose(id: ZoneId): Promise<Diagnosis> { return (await api<{ diagnosis: Diagnosis }>(`/api/zones/${encodeURIComponent(id)}/findings`)).diagnosis; }
  async history(id: ZoneId, hours: number): Promise<HistorySeries> { return (await api<{ history: HistorySeries }>(`/api/zones/${encodeURIComponent(id)}/history?hours=${hours}`)).history; }
  async addNote(text: string, zoneId: ZoneId | null, author: 'user' | 'agent'): Promise<Note> {
    const r = await post<{ note?: Note; error?: string }>('/api/notes', { text, zoneId, author });
    if (!r.note) throw new Error(r.error ?? 'Notes are not on Farm Hand');
    return r.note;
  }
  async connectivity(): Promise<Connectivity> { return (await api<{ connectivity: Connectivity }>('/api/connectivity')).connectivity; }
  /** Passed through untouched: extra per-field keys from the AlphaEarth server (crop group, soil, trend, polygons...) survive. */
  async region(): Promise<RegionView> { const r = await api<RegionView>('/api/region'); this.lastRegion = r; return r; }
  async demoPlace(): Promise<Place> { return (await api<{ place: Place }>('/api/region/demo-place')).place; }

  // ------------------------------------------------------------------- demo controls
  setOverrides(o: Overrides): void { send(put('/api/overrides', o)); }
  async runPump(seconds: number): Promise<{ ok: false; reason: string }> {
    // The server refuses too (403); this never reports success while the pumps are disarmed.
    try { const r = await post<{ reason?: string }>('/api/pump', { seconds }); return { ok: false, reason: r.reason ?? PUMPS_DISARMED }; }
    catch { return { ok: false, reason: PUMPS_DISARMED }; }
  }
}
