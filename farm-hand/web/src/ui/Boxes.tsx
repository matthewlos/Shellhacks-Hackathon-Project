import { brand } from '../brand';
import { moistureOf, rawOf, useBox, usePumpOn, usePumpsArmed, type BoxId } from './farmData';

/** Real readings keep their decimal: 58.3, not 58. */
const one = (v: number) => v.toFixed(1);

export function PumpRow({ id }: { id: BoxId }) {
  const on = usePumpOn(id);
  const armed = usePumpsArmed();
  return (
    <p className={`pump ${on ? 'is-on' : ''}`}>
      <b>Pump {id}:</b> {on ? 'on, watering now' : armed ? 'off' : `off, ${brand.disarmedReason}`}
    </p>
  );
}

/** Short text for the dock button: the moisture, or why there is none. */
export function useBoxGlance(id: BoxId): string {
  const m = moistureOf(useBox(id));
  return m.pct != null ? `${one(m.pct)}%` : m.state === 'disconnected' ? 'no probe' : m.state === 'uncalibrated' ? 'not calibrated' : 'no reading';
}

export function BoxPanel({ id }: { id: BoxId }) {
  const l = useBox(id);
  const box = brand.boxes[id];
  const m = moistureOf(l);
  const raw = rawOf(l);
  const tempOk = !!l?.tempOnline && l.tempC != null;
  const missing = [m.state === 'disconnected' && 'moisture', l && !l.tempOnline && 'temperature'].filter(Boolean) as string[];

  return (
    <div className={`box box-${id}`}>
      <p className="box-how"><span className="box-id" aria-hidden>{id}</span>{box.how}</p>
      <div className="readings">
        <div className="reading">
          <b className={`reading-value num ${m.pct == null ? 'is-off' : ''}`}>{m.pct != null ? <>{one(m.pct)}<small>%</small></> : m.state === 'disconnected' ? 'Probe off' : m.state === 'uncalibrated' ? 'Not set up' : 'Waiting'}</b>
          <span className="reading-label">Soil moisture</span>
        </div>
        <div className="reading">
          <b className={`reading-value num ${!tempOk ? 'is-off' : ''}`}>{tempOk ? <>{one(l!.tempC!)}<small>°C</small></> : l ? 'No sensor' : 'Waiting'}</b>
          <span className="reading-label">Soil temperature</span>
        </div>
      </div>
      {missing.length > 0 && <p className="probe-warn">Check the {missing.length === 2 ? 'probe wiring' : `${missing[0]} probe`} on this box.</p>}
      {m.state === 'uncalibrated' && <p className="probe-warn">The moisture probe is connected but not calibrated.</p>}
      <div className="box-foot">
        <PumpRow id={id} />
        <p className="probe">
          {id === 'A' && <>The decision model keeps it at <span className="num">{brand.baselinePct}%</span> or more. </>}
          Raw reading <span className="mono num">{raw != null ? Math.round(raw) : 'none'}</span>.
        </p>
      </div>
    </div>
  );
}
