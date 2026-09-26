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

function Missing({ text, warn }: { text: string; warn?: boolean }) {
  return <b className={`reading-missing ${warn ? 'is-warn' : ''}`}>{text}</b>;
}

export function BoxCard({ id }: { id: BoxId }) {
  const l = useBox(id);
  const box = brand.boxes[id];
  const m = moistureOf(l);
  const raw = rawOf(l);
  const tempOk = !!l?.tempOnline && l.tempC != null;
  const probe = m.state === 'ok' ? 'probe connected' : m.state === 'uncalibrated' ? 'probe connected, not calibrated' : m.state === 'disconnected' ? 'probe disconnected' : 'no reading yet';

  return (
    <section className={`box box-${id}`} aria-label={`Box ${id}: ${box.name}`}>
      <header className="box-head">
        <span className="box-id" aria-hidden>{id}</span>
        <h2>{box.name}</h2>
        <p>{box.how}</p>
      </header>

      <div className="readings">
        <div className="reading">
          {m.pct != null
            ? <b className="reading-value num" key="v">{one(m.pct)}<small>%</small></b>
            : <Missing text={m.state === 'disconnected' ? 'Probe disconnected' : m.state === 'uncalibrated' ? 'Not calibrated' : 'No reading'} warn={m.state === 'disconnected'} />}
          <span className="reading-label">Soil moisture</span>
        </div>
        <div className="reading">
          {tempOk
            ? <b className="reading-value num">{one(l!.tempC!)}<small>°C</small></b>
            : <Missing text={l && !l.tempOnline ? 'Probe disconnected' : 'No reading'} warn={!!l && !l.tempOnline} />}
          <span className="reading-label">Soil temperature</span>
        </div>
      </div>

      <footer className="box-foot">
        <PumpRow id={id} />
        <p className="probe">
          {id === 'A' && <>Keeps soil at <span className="num">{brand.baselinePct}%</span> or more. </>}
          Raw <span className="mono num">{raw != null ? Math.round(raw) : 'none'}</span>, {probe}.
        </p>
      </footer>
    </section>
  );
}
