/**
 * The HTML that goes with the zoomed-out view: the zoom control, the Farm Hand pin label, tags on the fields the
 * backend ranks as similar, a card for the selected field and the crop legend.
 *
 * Everything shown comes from `RegionView` (AlphaEarth v2 satellite-embedding predictions for Farm Hand).
 * Satellite-derived values are labelled as predictions; the farm names in `identity` are illustrative and say so.
 */
import type { CSSProperties } from 'react';
import * as THREE from 'three';
import { useApp } from '../data/store';
import type { RegionField, RegionView } from '../data/types';
import type { FieldScene } from './FieldScene';

const BLUE = '#2a78d6';
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

type RegionState = {
  regionOn?: boolean; regionData?: RegionView | null; selectedFarm?: string | null;
  goRegion?: (on: boolean) => void; selectFarm?: (id: string | null) => void; loadRegion?: () => Promise<void>;
};
const useRegion = <T,>(pick: (s: RegionState) => T) => useApp((s) => pick(s as unknown as RegionState));

const v = new THREE.Vector3();
/** world point for a region anchor key ('pin' or 'farm:<fieldId>'), or null */
export function regionAnchor(scene: FieldScene, key: string): THREE.Vector3 | null {
  if (key === 'pin') return scene.region.pinTop(v);
  if (key.startsWith('farm:')) return scene.region.fieldPos(key.slice(5), v);
  return null;
}

export function RegionHud({ reg }: { reg: (key: string) => (el: HTMLElement | null) => void }) {
  const on = useRegion((s) => !!s.regionOn);
  const data = useRegion((s) => s.regionData ?? null);
  const selected = useRegion((s) => s.selectedFarm ?? null);
  const benchPlace = useApp((s) => (s as unknown as { config?: { place?: { name?: string } | null } | null }).config?.place?.name ?? null);
  const region = data?.region ?? null;
  const ready = data?.status === 'ready' && !!region;
  const matches = data?.matches ?? [];
  const fieldOf = (id: string) => region?.fields.find((f) => f.id === id) ?? null;
  const sel = selected ? fieldOf(selected) : null;
  const selMatch = selected ? matches.find((m) => m.fieldId === selected) ?? null : null;
  const st = () => useApp.getState() as unknown as RegionState;

  const place = region?.label ?? 'the bench';
  const status = !data ? null : data.status === 'loading' ? 'Loading the surrounding fields…' : data.status === 'no_place' ? 'Surrounding fields need a location' : data.status === 'unavailable' ? `Surrounding fields unavailable${data.reason ? `: ${data.reason}` : ''}` : null;

  return (
    <>
      {/* the zoom control: the scroll wheel does the same thing */}
      <div style={{ position: 'absolute', top: 12, right: 12, pointerEvents: 'auto' }}>
        {on ? (
          <button style={btn} onClick={() => st().goRegion?.(false)}>Back to the boxes</button>
        ) : ready ? (
          <button style={btn} onClick={() => st().goRegion?.(true)} title="Or scroll out">Fields around {place}</button>
        ) : status ? (
          <span style={{ ...btn, cursor: 'default', opacity: 0.75 }}>{status}</span>
        ) : null}
      </div>

      {/* anchored tags (FieldCanvas positions them; hidden until the land has risen) */}
      {on && ready && (
        <>
          <div ref={reg('pin')} className="anchor" style={fade}>
            <div style={{ ...tag, borderColor: BLUE }}>
              <span style={{ ...dot, background: BLUE }} />
              <b>Farm Hand bench</b>{benchPlace && <span style={{ opacity: 0.6 }}>{benchPlace}</span>}
            </div>
          </div>
          {matches.map((m) => {
            const f = fieldOf(m.fieldId);
            return (
              <div key={m.fieldId} ref={reg('farm:' + m.fieldId)} className="anchor" style={fade}>
                <button style={{ ...tag, cursor: 'pointer', ...(selected === m.fieldId ? { borderColor: BLUE, boxShadow: `0 0 0 2px ${BLUE}33` } : null) }}
                  onClick={() => st().selectFarm?.(selected === m.fieldId ? null : m.fieldId)}>
                  <span style={{ ...rank }}>{m.rank}</span>
                  <span>{f ? cropName(f) : 'Field'} <span style={{ opacity: 0.6 }}>predicted</span></span>
                  <span style={{ opacity: 0.6 }}>{fmtKm(m.distanceKm)} {m.bearing}</span>
                </button>
              </div>
            );
          })}
        </>
      )}

      {/* the selected field */}
      {on && ready && sel && (
        <div style={{ ...card, pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <b style={{ fontSize: 14 }}>{cropName(sel)}</b>
            <button style={{ ...link }} onClick={() => st().selectFarm?.(null)} aria-label="Close">Close</button>
          </div>
          <div style={muted}>Predicted from satellite embeddings (AlphaEarth). {fmtKm(sel.distanceKm)} {sel.bearing} of the bench, {fmtHa(sel.areaHa)}.</div>
          {sel.grows.length > 1 && (
            <div style={{ marginTop: 6 }}>Also predicted here: {sel.grows.slice(1, 4).map((g) => `${g.name} ${Math.round(g.sharePct)}%`).join(', ')}</div>
          )}
          {sel.soil && (
            <div style={{ marginTop: 6 }}>
              Soil (estimate): {[sel.soil.series, sel.soil.texture, sel.soil.drainagecl].filter(Boolean).join(' · ')}
              {sel.soil.ph != null && ` · pH ${sel.soil.ph.toFixed(1)}`}
            </div>
          )}
          {selMatch && <div style={{ marginTop: 6 }}>{selMatch.sentence}</div>}
          {selMatch?.identity?.illustrative && <div style={{ ...muted, marginTop: 6 }}>Farm name “{selMatch.identity.farm}” is illustrative: the satellite data knows land, not owners.</div>}
        </div>
      )}

      {/* legend: what the tints mean, and where they come from */}
      {on && ready && region && (
        <div style={{ ...legend, pointerEvents: 'auto' }}>
          <b style={{ display: 'block', marginBottom: 4 }}>Predicted crop type</b>
          {region.legend.filter((l) => l.sharePct > 0).sort((a, b) => b.sharePct - a.sharePct).slice(0, 7).map((l) => (
            <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flex: 'none' }} />
              <span style={{ flex: 1 }}>{l.name}</span>
              <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{Math.round(l.sharePct)}%</span>
            </div>
          ))}
          {matches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, border: `2px solid ${BLUE}`, flex: 'none' }} />
              <span>Ranked similar to the Farm Hand box</span>
            </div>
          )}
          <div style={{ ...muted, marginTop: 6 }}>
            {region.sources.map((s) => s.name).join(' · ') || 'Satellite embeddings'}{region.year ? `, ${region.year}` : ''}. Not to scale: the boxes are drawn at bench size.
          </div>
        </div>
      )}
    </>
  );
}

function cropName(f: RegionField): string { return f.grows[0]?.name ?? f.crop; }
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);
const fmtHa = (ha: number) => `${ha < 10 ? ha.toFixed(1) : Math.round(ha)} ha`;

const font = 'var(--font-ui, system-ui, sans-serif)';
const surface: CSSProperties = {
  font: `500 12px/1.35 ${font}`, color: 'var(--text, #1d2320)', background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(20,30,25,0.10)', borderRadius: 10, boxShadow: '0 2px 10px rgba(20,30,25,0.08)',
};
const fade: CSSProperties = { opacity: 0, transition: `opacity 220ms ${EASE}` };
const btn: CSSProperties = { ...surface, padding: '7px 12px', cursor: 'pointer', display: 'inline-block', whiteSpace: 'nowrap' };
const tag: CSSProperties = { ...surface, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '5px 9px', pointerEvents: 'auto' };
const dot: CSSProperties = { width: 8, height: 8, borderRadius: 99, flex: 'none' };
const rank: CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 16, height: 16, borderRadius: 4, background: BLUE, color: '#fff', fontSize: 10, fontWeight: 700 };
const card: CSSProperties = { ...surface, position: 'absolute', right: 12, top: 56, width: 'min(300px, calc(100% - 24px))', padding: '10px 12px' };
const legend: CSSProperties = { ...surface, position: 'absolute', left: 12, bottom: 12, width: 'min(260px, calc(100% - 24px))', padding: '9px 11px', fontSize: 11.5 };
const muted: CSSProperties = { opacity: 0.65, fontSize: 11 };
const link: CSSProperties = { background: 'none', border: 0, padding: 0, color: BLUE, font: `500 11px ${font}`, cursor: 'pointer' };
