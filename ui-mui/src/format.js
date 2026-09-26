import { CFG } from './sim.js';

export const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const signed = (x) => `${x >= 0 ? '+' : '−'}${f1(Math.abs(x))}`;
export const ml = (x) => `${Math.round(x).toLocaleString()} ml`;

const clockFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });

export function makeTime(fh) {
  const at = (t) => new Date(fh.t0 + t * 1000);
  return {
    clock: (t) => clockFmt.format(at(t)),
    hhmm: (t) => timeFmt.format(at(t)),
    day: (t) => Math.floor((CFG.START_HOUR * 3600 + t) / 86400) + 1,
  };
}

export const ago = (s) => (s < 60 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);
// A duration without "0 min" tails: "45 min", "6 h", "6 h 10 min".
export const hrs = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};
export const secs = (s) => (s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

// Glossary (copy audit section 3): Farm Hand, Timer, Laya, Gemini team, pour, check, minimum.
export const PICK = { water: 'water', wait_rain: 'wait for rain', wait_moist: 'wait' };
export const BY = { laptop: 'Farm Hand', manual: 'Test', target: 'Target', timer: 'Timer' };
export const BRAIN = { 'gemini (simulated)': 'Gemini team', rules: 'Rules', 'laya (fast decider)': 'Laya', 'target run': 'Target' };
export const isBad = (what) => what.startsWith('REFUSED') || what.startsWith('sent back');

// The soil (6-reading median, the value every screen shows) at or just before sim time t.
export function soilAt(fh, t) {
  const h = fh.history;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i].a;
  return null;
}

/*
 * A decision sentence from ui/sim.js, shaped for display only: the "WATER:"/"WAIT:" prefix goes, the first letter
 * is capitalized, and the whole-number soil % the brain wrote ("soil is 50%") shows with one decimal ("49.6%"),
 * so it matches the big number. The digit is only replaced when it is that reading rounded, never otherwise.
 */
export function callSentence(fh, d) {
  // Show the brain's own words, prefix stripped. Its numbers are the reading it decided on; swapping in a nearby
  // smoothed value could land on the other side of the watering line ("39.8%… I'll water at 40%").
  const s = d.sentence.replace(/^(WATER|WAIT|TARGET):\s*/, '');
  return s[0].toUpperCase() + s.slice(1);
}

// Safety-rule names from ui/sim.js, in the glossary's words. Unknown rules pass through.
export const RULE = {
  'Pot A not already wet': 'Soil not already wet',
  'Gap since last AI pour': `${CFG.AI_MIN_GAP_MIN} min since last pour`,
  'Last pour finished soaking': 'Last pour soaked in',
};

// A call is stale once the soil has moved more than 2 points since it was made.
export function isStale(fh, d) {
  const then = d ? soilAt(fh, d.ts) : null, now = fh.nowPct();
  return then != null && now != null && Math.abs(now - then) > 2;
}
