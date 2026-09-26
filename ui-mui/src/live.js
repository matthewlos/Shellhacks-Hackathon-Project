import { CFG } from './sim.js';

// Derived live state shared by the right column, the rig and the alerts. Sim time only.

export function readingAge(fh, frac) {
  const L = fh.latest;
  return L ? Math.max(0, fh.t - L.ts + frac) : null;
}

// Seconds a pump has run in the current pour, and seconds left (the chip caps a pour at 30 s).
// Two-box mode: board.pumping is true for either pump, so ask which pot is running.
export function pumpClock(fh, frac, pot = 'A') {
  const b = fh.board;
  if (b.activePot !== pot) return null;
  const ran = Math.min(b.pourMs, b.ms - b.pourStart + frac * 1000) / 1000;
  return { ran, left: Math.max(0, b.pourMs / 1000 - ran), total: b.pourMs / 1000, ml: ran * CFG.FLOW_ML_S };
}

/*
 * The one alert on screen (PLAN 5d: only one red thing at a time, von Restorff).
 * Priority: a target run that found water isn't reaching the soil, a pour that didn't reach the probe,
 * then someone adding water by hand (info, not red).
 */
export function currentAlert(fh) {
  const run = fh.run;
  if (run.phase === 'fault' && fh.t - run.t_end < 600) {
    const p = run.pulses[run.pulses.length - 1];
    const msg = p ? `Pumped ${p.s} s, soil moved ${p.rise >= 0 ? '+' : '−'}${Math.abs(p.rise).toFixed(1)}%. Check the tube is open and in the box.` : run.msg;
    return { key: 'fault' + run.t_end, severity: 'error', title: "Water isn't reaching the soil", msg };
  }
  const s = fh.soaks[fh.soaks.length - 1];
  if (s && !s.ok && s.note !== 'target pulse' && fh.t - s.ts < 600) {
    return { key: 'soak' + s.ts, severity: 'error', title: "Water isn't reaching the soil", msg: `Pumped ${s.poured_s} s, soil moved ${s.rise_pct >= 0 ? '+' : '−'}${Math.abs(s.rise_pct).toFixed(1)}%. Check the tube is open and in the box.` };
  }
  const h = fh.hand;
  if (h.phase === 'seen' && fh.t - h.ts < 90) {
    const skip = h.now > CFG.DRY_PCT + CFG.LOW_MARGIN;
    return {
      key: 'hand' + h.ts, severity: 'info', title: 'Water added by hand',
      msg: `+${h.rise.toFixed(1)}%, now ${h.now.toFixed(1)}%. ${skip ? 'Skipping the next pour.' : 'Next pour will be smaller.'}`,
    };
  }
  return null;
}

/*
 * The Demo page's status word (spec 9.L.3). First match wins, so a word never contradicts the soil:
 * "Holding off" only shows while the soil is above the watering line and nothing is running.
 * Only "Watering" is blue (tone 'moisture.main'); every other word is ink.
 */
export function pumpState(fh, frac, hhmm) {
  const run = fh.run;
  const pc = pumpClock(fh, frac);
  const last = fh.decisions[fh.decisions.length - 1];
  const ink = 'text.primary';
  if (pc) return { word: 'Watering', num: `${Math.ceil(pc.left)} s`, tone: 'moisture.main' };
  if (fh.tgt) return { word: 'Hitting', num: `${run.target}%`, tone: ink };
  if (last && last.brain === 'target run' && run.phase === 'locked') return { word: 'Locked at', num: `${run.now.toFixed(1)}%`, tone: ink };
  if (fh.live.phase === 'soaking' && fh.live.pot !== 'B') return { word: 'Soaking in', num: '', tone: ink };
  if (fh.team) return { word: 'Checking', num: `${Math.floor(fh.t - fh.team.t0 + frac)} s`, tone: ink };
  if (!last) return { word: 'Starting up', num: '', tone: ink };
  const now = fh.nowPct();
  if (now != null && now <= CFG.DRY_PCT + CFG.LOW_MARGIN) return { word: 'Next check', num: hhmm(fh.nextCheck), tone: ink };
  return { word: 'Holding off', num: '', tone: ink };
}
