import { brand } from '../brand';
import { useApp } from '../data/store';
import { ago, clock, toMs, useDecision, useNow, usePumpsArmed, type BoxLive, type Decision } from './farmData';

/** Laya's pick in plain words. Unknown picks are shown as sent, never guessed. */
export function pickWords(pick: string): { head: string; sub: string; kind: 'water' | 'hold' | 'rain' | 'other' } {
  const p = pick.toLowerCase().replace(/[^a-z]+/g, '_');
  if (p.includes('rain')) return { head: 'Waiting for rain', sub: 'Rain is forecast, so it saves the water.', kind: 'rain' };
  if (/(^|_)(moist|wet)(_|$)/.test(p)) return { head: 'Holding off', sub: 'The soil has water.', kind: 'hold' };
  if (/(^|_)(hold|skip|none|no|wait|off)(_|$)/.test(p)) return { head: 'Holding off', sub: '', kind: 'hold' };
  if (/(^|_)(water|pour|irrigate|on|yes)(_|$)/.test(p)) return { head: 'Water now', sub: '', kind: 'water' };
  return { head: pick.replace(/_/g, ' '), sub: '', kind: 'other' };
}

/** Who decided, in one sentence. The safety rule runs when a probe is missing: Laya never guesses a reading. */
function decidedBy(d: Decision, probeAOk: boolean): { text: string; hideWhy: boolean } {
  if (/laya/i.test(d.brain)) return { text: 'Decided by our decision model, a small fine-tuned model on the Mac mini.', hideWhy: false };
  if (/rule|baseline|fallback|safety/i.test(d.brain)) {
    const probeMissing = !probeAOk || /probe|not connected|disconnect|no reading/i.test(d.why ?? '');
    return probeMissing
      ? { text: "Decided by the safety rule: probe A isn't reporting, so the decision model doesn't guess.", hideWhy: true }
      : { text: `Decided by the safety rule: keep the soil at ${brand.baselinePct}% or more.`, hideWhy: false };
  }
  return { text: `Decided by ${d.brain}.`, hideWhy: false };
}

const secs = (s: number) => `${Number.isInteger(s) ? s : s.toFixed(1)} s`;

function Body({ d }: { d: Decision }) {
  const now = useNow(1000);
  const armed = usePumpsArmed();
  const words = pickWords(d.pick);
  const probeAOk = useApp((s) => { const l = s.live.A as BoxLive | undefined; return !!l && (l.probeOk ?? l.moistureOnline); });
  const by = decidedBy(d, probeAOk);
  const t = toMs(d.t);
  return (
    // keyed on the decision time: a new call swaps in with one short fade (styles.css .call-body)
    <div className="call-body" key={t ?? d.pick}>
      <p className={`call-pick call-${words.kind}`}>
        {words.head}
        {words.kind === 'water' && d.seconds > 0 && <span className="num">, {secs(d.seconds)}</span>}
      </p>
      {words.sub && <p className="call-sub">{words.sub}</p>}
      {d.why && !by.hideWhy && <p className="call-why">{d.why}</p>}
      {words.kind === 'water' && !armed && <p className="call-note">The pump is disarmed, so no water went in.</p>}
      <p className="call-meta">
        {by.text}
        {t != null && <> At <span className="num">{clock(t)}</span> (<span className="num">{ago(now - t)}</span>).</>}
      </p>
    </div>
  );
}

/** Short text for the dock button. */
export function useCallGlance(): string {
  const d = useDecision();
  return d ? pickWords(d.pick).head : 'no call yet';
}

export function LayaCall() {
  const d = useDecision();
  return (
    <section className="call" aria-live="polite" aria-label="The decision model's call for box A">
      {d ? <Body d={d} /> : (
        <div className="call-body">
          <p className="call-pick call-other">No call yet</p>
          <p className="call-sub">The decision model's first call for box A shows up here.</p>
        </div>
      )}
    </section>
  );
}
