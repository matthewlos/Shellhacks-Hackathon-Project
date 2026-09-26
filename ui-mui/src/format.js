import { CFG } from './sim.js';

export const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const signed = (x) => `${x >= 0 ? '+' : '−'}${f1(Math.abs(x))}`;

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
export const PICK = { water: 'Water', wait_rain: 'Wait for rain', wait_moist: 'Wait, soil has water' };
export const BY = { laptop: 'AI', manual: 'test', target: 'target', timer: 'timer' };
export const isBad = (what) => what.startsWith('REFUSED') || what.startsWith('sent back');
