/**
 * Crops: a what-if simulator for Box A. Two sliders (soil moisture, soil temperature) start at Box A's live
 * readings, or at 45 % and 24 °C when a probe is off. Every move re-runs the crop rules engine
 * (data/sim/crops.ts) in the browser on just those two numbers, and the list regroups at once:
 * Grows well / Survives / Too dry, wet, hot or cold, one short reason each.
 *
 * Two limits the engine leaves out, because real soil never reaches them, are added here so the far ends of
 * the sliders read true: soil past field capacity (65 %) drowns roots unless the crop takes waterlogging
 * (its very-slow-drainage score), and soil more than 10 °C over a crop's ideal is too hot for it.
 *
 * "Send this setting to Laya" is a preview: it confirms in the panel and calls nothing.
 *
 * Motion (Emil): rows that change place slide there (FLIP, 220 ms ease-out, interruptible mid-drag);
 * rows that appear fade in. Nothing moves under prefers-reduced-motion.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CROPS, DEPLETION, dryLine, scoreCrop, type Crop } from '../data/sim/crops';
import type { CropScore } from '../data/types';
import { CropIcon } from './CropIcons';
import { moistureOf, useBox } from './farmData';
import { IconCheck } from './icons';
import './crops.css';

const DEFAULT_M = 45;
const DEFAULT_T = 24;
const M_RANGE = [0, 100] as const;
const T_RANGE = [5, 45] as const;
/** Farm Hand's probe scale: 20 % is wilting point, 65 % is field capacity (see DEPLETION in crops.ts). */
const FIELD_CAPACITY = 65;

const CAT_ICON: Record<string, string> = { fruiting: 'vegetables', root: 'vegetables', leafy: 'vegetables', legume: 'vegetables', allium: 'vegetables', grain: 'vegetables', fruit: 'tree fruit', herb: 'grass', cover: 'grass' };
const CAT_COLOR: Record<string, string> = { fruiting: '#d9503f', root: '#c9822e', leafy: '#3f9a4a', legume: '#6f9a2e', allium: '#9a6fb0', grain: '#c9a23a', fruit: '#d24a6c', herb: '#2f8f7a', cover: '#5a8f3a' };

type Cause = 'dry' | 'wet' | 'hot' | 'cold';
type Group = 'well' | 'survive' | 'no';
interface Verdict { id: string; name: string; category: string; group: Group; score: number; cause: Cause | null; text: string }

const r1 = (n: number) => String(Math.round(n * 10) / 10);
/** The wettest the crop copes with: field capacity, plus up to 30 points for crops that take waterlogged soil. */
const wetLimit = (c: Crop) => Math.round(FIELD_CAPACITY + (c.drainage.very_slow / 100) * 30);
const hotLimit = (c: Crop) => c.tempOpt[1] + 10;
const factor = (s: CropScore, key: string) => s.factors.find((f) => f.key === key)?.score ?? 100;

/** Engine score on moisture and temperature only, then the panel's wet and heat limits, then one plain reason. */
function judge(c: Crop, m: number, t: number): Verdict {
  const s = scoreCrop(c, { drainageClass: null, soilTempC: t, soilMoisturePct: m, sun: null, ph: null, frost: null });
  const line = dryLine(c.id) ?? 45;
  const about = DEPLETION[c.id]?.est ? 'about ' : '';
  const [lo, hi] = c.tempOpt;
  const wet = wetLimit(c), hot = hotLimit(c);
  const base = { id: c.id, name: c.name, category: c.category };

  // How far past each hard limit the soil is (0 = inside it); the biggest miss is the reason.
  const misses: [Cause, number][] = [
    ['cold', factor(s, 'soil_temp') < 25 && t < c.tempMin ? (c.tempMin - t) / 5 : 0],
    ['hot', t > hot ? (t - hot) / 5 : 0],
    ['dry', factor(s, 'moisture') < 25 ? (line - m) / 10 : 0],
    ['wet', m > wet ? (m - wet) / 10 : 0],
  ];
  const worst = misses.reduce((a, b) => (b[1] > a[1] ? b : a));
  const failText: Record<Cause, string> = {
    cold: `too cold, needs ${c.tempMin} °C or warmer`,
    hot: `too hot, it likes ${lo}-${hi} °C`,
    dry: `too dry, needs ${about}${r1(line)}% or more`,
    wet: `too wet, roots rot above ${wet}%`,
  };
  if (worst[1] > 0) return { ...base, group: 'no', score: Math.min(s.score, 40) - worst[1], cause: worst[0], text: failText[worst[0]] };

  const soggy = m > FIELD_CAPACITY && c.drainage.very_slow < 90;
  const score = soggy ? Math.min(s.score, 70) : s.score;
  const mScore = factor(s, 'moisture'), tScore = factor(s, 'soil_temp');
  if (score >= 80) {
    return { ...base, group: 'well', score, cause: null, text: `likes ${lo}-${hi} °C and soil above ${about}${r1(line)}%` };
  }
  // Survives or not, the reason is whichever of the two numbers holds it back most.
  const cause: Cause = soggy ? 'wet' : mScore < tScore ? 'dry' : t < lo ? 'cold' : t > hi ? 'hot' : 'dry';
  const group: Group = score >= 55 ? 'survive' : 'no';
  const soft: Record<Cause, string> = {
    wet: `soggy soil, copes below ${wet}% for a while`,
    dry: `a bit dry, happier above ${about}${r1(line)}%`,
    cold: `a bit cool, happier at ${lo}-${hi} °C`,
    hot: `a bit warm, happier at ${lo}-${hi} °C`,
  };
  const acidOnly = mScore >= 85 && tScore >= 90 && !soggy;
  const text = acidOnly ? 'needs acidic soil to do well' : group === 'no' ? failText[cause] : soft[cause];
  return { ...base, group, score, cause: acidOnly ? null : cause, text };
}

const CAUSE_ORDER: Cause[] = ['dry', 'wet', 'hot', 'cold'];
function noHeading(causes: Set<Cause>): string {
  const words = CAUSE_ORDER.filter((c) => causes.has(c)).map((c) => `too ${c}`);
  const s = words.length <= 1 ? words[0] ?? 'will not grow' : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1);
}

const plainName = (name: string) => name.replace(/\s*\(.*\)$/, '').toLowerCase();
const clamp = (n: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, n));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** FLIP for the crop rows: call `snap()` right before a state change; the rows glide from where they were. */
function useFlip(root: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const before = useRef<Map<string, DOMRect> | null>(null);
  const snap = () => {
    if (!root.current || reducedMotion()) return;
    const m = new Map<string, DOMRect>();
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => m.set(el.dataset.flip!, el.getBoundingClientRect()));
    before.current = m;
  };
  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    if (!first || !root.current) return;
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      const a = first.get(el.dataset.flip!);
      const b = el.getBoundingClientRect();
      if (!a) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }); return; }
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return snap;
}

function Dial(props: {
  id: string; label: string; unit: ReactNode; unitText: string; value: number; range: readonly [number, number];
  live: number | null; hint: ReactNode; tone: 'water' | 'heat'; onChange: (v: number) => void;
}) {
  const { id, label, unit, unitText, value, range, live, hint, tone, onChange } = props;
  const at = (v: number) => (clamp(v, range) - range[0]) / (range[1] - range[0]);
  return (
    <div className={`cs-dial is-${tone}`}>
      <div className="cs-dial-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="cs-value num" aria-hidden>{value}<small>{unit}</small></output>
      </div>
      <div className="cs-track" style={{ ['--p' as string]: at(value), ['--live' as string]: live == null ? 0 : at(live) }}>
        {live != null && <span className="cs-live" aria-hidden />}
        <input
          id={id} type="range" min={range[0]} max={range[1]} step={1} value={value}
          aria-valuetext={`${value} ${unitText}`}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
        />
      </div>
      <p className="cs-hint num">{hint}</p>
    </div>
  );
}

const GROUP_TITLE: Record<Exclude<Group, 'no'>, string> = { well: 'Grows well', survive: 'Survives' };
const NO_SHOWN = 5;

export function CropsPanel() {
  const l = useBox('A');
  const liveM = moistureOf(l).pct;
  const liveT = l?.tempOnline && l.tempC != null ? l.tempC : null;
  const startM = Math.round(clamp(liveM ?? DEFAULT_M, M_RANGE));
  const startT = Math.round(clamp(liveT ?? DEFAULT_T, T_RANGE));

  // The sliders follow Box A's readings until someone moves one; "Use live reading" hands them back.
  const [own, setOwn] = useState<{ m: number; t: number } | null>(null);
  const m = own?.m ?? startM;
  const t = own?.t ?? startT;
  const [sent, setSent] = useState<{ m: number; crop: string } | null>(null);
  const [allNo, setAllNo] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const snap = useFlip(listRef, [m, t, allNo]);

  const verdicts = useMemo(() => CROPS.map((c) => judge(c, m, t)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)), [m, t]);
  const groups = useMemo(() => ({
    well: verdicts.filter((v) => v.group === 'well'),
    survive: verdicts.filter((v) => v.group === 'survive'),
    no: verdicts.filter((v) => v.group === 'no'),
  }), [verdicts]);
  const top = groups.well[0] ?? groups.survive[0] ?? null;
  const canGrow = groups.well.length + groups.survive.length;

  // A new setting makes the last confirmation stale.
  useEffect(() => { if (sent && sent.m !== m) setSent(null); }, [m, sent]);

  const move = (next: { m: number; t: number }) => { snap(); setOwn(next); };
  const moved = own != null && (own.m !== startM || own.t !== startT);
  const anyLive = liveM != null || liveT != null;

  return (
    <div className="csim">
      <section className="cs-controls" aria-label="Soil setting for Box A">
        <div className="cs-dials">
          <Dial
            id="cs-moist" label="Soil moisture" unit="%" unitText="percent" tone="water"
            value={m} range={M_RANGE} live={liveM}
            hint={liveM != null ? <>Box A reads {r1(liveM)}% now</> : <>Probe off, starting at {DEFAULT_M}%</>}
            onChange={(v) => move({ m: v, t })}
          />
          <Dial
            id="cs-temp" label="Soil temperature" unit=" °C" unitText="degrees Celsius" tone="heat"
            value={t} range={T_RANGE} live={liveT}
            hint={liveT != null ? <>Box A reads {r1(liveT)} °C now</> : <>Sensor off, starting at {DEFAULT_T} °C</>}
            onChange={(v) => move({ m, t: v })}
          />
        </div>
        <div className="cs-actions">
          <button
            className="btn cs-send" disabled={!top}
            onClick={() => top && setSent({ m, crop: plainName(top.name) })}
          >
            Send this setting to Laya
          </button>
          {moved && (
            <button className="btn cs-reset" onClick={() => move({ m: startM, t: startT })}>
              {anyLive ? 'Use live reading' : 'Reset'}
            </button>
          )}
        </div>
        <div className="cs-sent" role="status" aria-live="polite">
          {sent ? (
            <p key={`${sent.m}-${sent.crop}`}>
              <IconCheck />
              <span><b>Sent to Laya:</b> keep Box A near <span className="num">{sent.m}%</span> for {sent.crop}.<small>A preview: Box A's live watering stays as it is.</small></span>
            </p>
          ) : !top ? <p className="is-quiet">Nothing survives at this setting, so there is nothing to send.</p> : null}
        </div>
      </section>

      <div className="cs-results" ref={listRef}>
        <p className="cs-lead">
          With soil at <b className="num">{m}%</b> and <b className="num">{t} °C</b>,{' '}
          {canGrow ? <>these crops can survive in Box A:</> : <>none of these crops can survive in Box A.</>}
        </p>
        {(['well', 'survive'] as const).map((g) => groups[g].length > 0 && (
          <section key={g} className={`cs-group g-${g}`}>
            <h3 data-flip={`h-${g}`}>{GROUP_TITLE[g]} <span className="num">{groups[g].length}</span></h3>
            <ul>{groups[g].map((v) => <Row key={v.id} v={v} />)}</ul>
          </section>
        ))}
        {groups.no.length > 0 && (
          <section className="cs-group g-no">
            <h3 data-flip="h-no">{noHeading(new Set(groups.no.map((v) => v.cause!).filter(Boolean)))} <span className="num">{groups.no.length}</span></h3>
            <ul>{(allNo ? groups.no : groups.no.slice(0, NO_SHOWN)).map((v) => <Row key={v.id} v={v} />)}</ul>
            {groups.no.length > NO_SHOWN && (
              <button className="btn cs-more" onClick={() => { snap(); setAllNo(!allNo); }}>
                {allNo ? 'Show fewer' : `Show all ${groups.no.length}`}
              </button>
            )}
          </section>
        )}
        <p className="small muted cs-foot">Only moisture and temperature are checked here. Moisture needs from FAO-56 (herbs and taro are estimates); temperature from Farm Hand's crop rules.</p>
      </div>
    </div>
  );
}

function Row({ v }: { v: Verdict }) {
  const color = CAT_COLOR[v.category] ?? 'var(--text-dim)';
  // "too dry, needs 47% or more": the verdict before the comma carries the weight
  const cut = v.group === 'well' ? -1 : v.text.indexOf(',');
  return (
    <li data-flip={v.id} className={v.cause ? `c-${v.cause}` : undefined}>
      <span className="cs-icon" style={{ ['--c' as string]: color }}><CropIcon crop={CAT_ICON[v.category] ?? v.name} /></span>
      <span className="cs-name">{v.name}</span>
      <span className="cs-why">{cut < 0 ? v.text : <><b>{v.text.slice(0, cut)}</b>{v.text.slice(cut)}</>}</span>
    </li>
  );
}
