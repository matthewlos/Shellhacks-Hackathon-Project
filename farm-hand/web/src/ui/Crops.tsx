/**
 * Crops: which crops can live in each box right now, from the crop rules engine (data/sim/crops.ts)
 * run in the browser on the box's live moisture and temperature. Grouped Thrive / Can survive /
 * Would struggle, one short reason each. Without both readings it asks for the probes instead of guessing.
 */
import { useMemo, useState } from 'react';
import { brand } from '../brand';
import { cropById, dryLine, scoreCrops } from '../data/sim/crops';
import { fallbackFrostDates } from '../data/sim/season';
import { useApp } from '../data/store';
import type { CropScore } from '../data/types';
import { moistureOf, useBox, type BoxId } from './farmData';
import { IconCheck, IconClose } from './icons';

const one = (n: number) => n.toFixed(1);

/** One short reason: the factor that decides it, pass or fail. */
function shortReason(c: CropScore, m: number, t: number): { ok: boolean; text: string } {
  const crop = cropById(c.id);
  const line = dryLine(c.id);
  const moist = c.factors.find((f) => f.key === 'moisture');
  const temp = c.factors.find((f) => f.key === 'soil_temp');
  const [lo, hi] = crop?.tempOpt ?? [0, 0];
  const moistOk = !moist?.known || (moist.score ?? 0) >= 85;
  const tempOk = !temp?.known || (temp.score ?? 0) >= 75;
  if (!moistOk && line != null) return { ok: false, text: `needs wetter soil, above ${one(line)}%` };
  if (!tempOk && crop) return { ok: false, text: t < crop.tempMin ? `needs ${crop.tempMin} °C or warmer` : `prefers ${lo}-${hi} °C, soil is ${one(t)} °C` };
  const season = c.factors.find((f) => f.key === 'season');
  if (season?.known && (season.score ?? 100) < 50) return { ok: false, text: 'out of its planting season' };
  return { ok: true, text: line != null ? `likes ${lo}-${hi} °C, fine above ${one(line)}%` : `likes ${lo}-${hi} °C` };
}

const GROUPS = [
  { id: 'thrive', title: 'Thrive', min: 80 },
  { id: 'survive', title: 'Can survive', min: 55 },
  { id: 'struggle', title: 'Would struggle', min: -1 },
] as const;

function BoxCrops({ id }: { id: BoxId }) {
  const l = useBox(id);
  const place = useApp((s) => s.config?.place ?? null);
  const sun = useApp((s) => s.config?.zones.find((z) => z.id === id)?.sun ?? null);
  const [all, setAll] = useState(false);
  const m = moistureOf(l).pct;
  const t = l?.tempOnline && l.tempC != null ? l.tempC : null;
  const crops = useMemo(() => (m == null || t == null ? [] : scoreCrops({
    drainageClass: null, soilTempC: t, soilMoisturePct: m, sun, ph: null, frost: place ? fallbackFrostDates(place.lat) : null,
  })), [m, t, sun, place]);

  if (m == null || t == null) {
    return (
      <div className="crops-empty">
        <p className="crops-lead">Plug in the probes to see which crops fit.</p>
        <p className="muted">Box {id} needs a moisture and a temperature reading. {m == null && t == null ? 'Neither probe is' : m == null ? 'The moisture probe isn\'t' : 'The temperature probe isn\'t'} reporting right now.</p>
      </div>
    );
  }
  return (
    <div className="crops-box">
      <p className="crops-lead">With soil at <b className="num">{one(m)}%</b> moisture and <b className="num">{one(t)} °C</b>, these crops can survive in Box {id}:</p>
      {GROUPS.map((g, gi) => {
        const list = crops.filter((c) => c.score > g.min && (gi === 0 || c.score <= GROUPS[gi - 1].min));
        if (!list.length) return null;
        const shown = g.id === 'struggle' && !all ? list.slice(0, 4) : list;
        return (
          <section key={g.id} className={`crop-group group-${g.id}`}>
            <h3>{g.title} <span className="num muted">{list.length}</span></h3>
            <ul>
              {shown.map((c) => {
                const r = shortReason(c, m, t);
                return (
                  <li key={c.id}>
                    <span className="cg-name">{c.name}</span>
                    <span className={`cg-why ${r.ok ? 'is-ok' : g.id === 'struggle' ? 'is-bad' : 'is-warn'}`}>
                      {r.ok ? <IconCheck /> : g.id === 'struggle' ? <IconClose /> : null}
                      {r.ok || g.id === 'struggle' ? r.text : r.text.replace(/^needs wetter soil, above/, 'a bit dry for it, happier above').replace(/^needs/, 'happier at')}
                    </span>
                  </li>
                );
              })}
            </ul>
            {g.id === 'struggle' && list.length > 4 && <button className="btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
          </section>
        );
      })}
    </div>
  );
}

export function CropsPanel() {
  const [box, setBox] = useState<BoxId>('A');
  return (
    <div className="crops-panel">
      <div className="segmented" role="tablist" aria-label="Box">
        {(['A', 'B'] as BoxId[]).map((id) => (
          <button key={id} role="tab" aria-selected={box === id} className={box === id ? 'is-on' : ''} onClick={() => setBox(id)}>
            Box {id}, {brand.boxes[id].name}
          </button>
        ))}
      </div>
      <BoxCrops id={box} key={box} />
      <p className="small muted">Moisture needs from FAO-56 (herbs and taro are estimates). Temperature and season from Farm Hand's crop rules.</p>
    </div>
  );
}
