import { CFG } from '../sim.js';
import { sim } from '../useFarmHand.js';
import { Spring, Tween, RESPONSE, POUR, prefs, easeOut, easeTube, easeFall } from '../motion.js';

/*
 * Maps the simulator (window.farmHand / fh) to the 3D scene's state, once per frame (RIG3D.md section 5).
 * It is the same director as the 2D drawing's (rigMotion.js, builder V), with the same timings and rules,
 * so the two views act out a pour, a pinch, a hand pour and an empty cup the same way. It writes nothing:
 * it returns a plain state object that scene.js applies. Every field maps to a reading or the pump.
 *
 *   probe (median)          -> level (one spring): soil color, waterline, the wet layer under it
 *   pump A running          -> tube fills (400 ms), stream once full, drops while it runs
 *   pump seconds x 20 ml/s  -> pour.ml: the wetting front's spread and the soak depth (team model)
 *   the soak result         -> chip "+4.1% from 100 ml"
 *   tube pinched            -> clamp; water stops at it; no stream
 *   cup ml                  -> the cup's water height
 *   hand-pour detector      -> a wet patch away from the nozzle, sized by the detected rise
 *   DS18B20                 -> tip tint + °C
 *   each reading            -> one LED blip (at most one per 800 ms; steady when fast-forwarding)
 *   target run              -> the target line + label (during a run and 20 s after)
 */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mlFmt = new Intl.NumberFormat();
const signed1 = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;
// Soil color maps over the working band so a 4% pour is visible (same as the 2D drawing).
const wetK = (m) => clamp01((m - CFG.DRY_PCT + 10) / (CFG.WET_PCT - CFG.DRY_PCT + 15));
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

// The team's pour model (farm-hand/laptop/static/scene.js): the ml pumped sets how far the water spreads over
// the top and how deep the even layer soaks. Units: 1 = 10 cm.
const PORE = 0.3, DEEPER = 1.25, COVER = 4.5, SPREAD_TAU = 7;
const BOX_AREA_CM2 = 434, TAKES_UP = 0.15, DEPTH_CM = 9.5;
const bulbRadius = (ml) => Math.cbrt((3 * (ml / PORE)) / (2 * Math.PI * DEEPER)) / 10;

export const PINCH_AT = 0.28;   // where the clamp sits along the tube (fraction of its length), as in 2D
const STALE_S = 30;             // a result that landed during a skip is not acted out

export function createDriver(fh) {
  const level = new Spring(fh.nowPct() ?? CFG.START_PCT, RESPONSE.drawing);
  const temp = new Spring(fh.latest?.temp_c ?? 27, RESPONSE.drawing);
  const tube = new Tween(0);
  const stream = { phase: 'off', t0: 0 };
  let pour = null;
  let poursSeen = fh.pours.length, soaksSeen = fh.soaks.length;
  let lastTs = fh.latest?.ts, beatAt = -1e9;
  let runEnd = fh.run.t_end, runEndReal = -1e9;
  const chip = { text: '', shownAt: 0, alpha: 0 };
  let prevCup = fh.world.cupMl;
  let handTs = fh.hand?.ts, handAt = -1e9, handRise = 0;
  // the soil front (team model), smoothed per frame
  const soil = { front: 0, layer: 0 };

  const setChip = (s, now) => {
    if (s === chip.text) return;
    const fresh = !chip.text || chip.alpha < 0.05 || /%/.test(s) !== /%/.test(chip.text);
    chip.text = s;
    if (fresh) chip.shownAt = now;
  };

  // `out` is reused every frame (no allocation in the loop)
  const out = {
    level: 0, wet: 0, tube: 0, pinched: false,
    stream: { alpha: 0, reach: 1, drop: 0, on: false },
    pour: { ml: 0, age: -1, active: 0, front: 0, layer: 0, t: 0 },
    hand: { a: 0, rise: 0 },
    chip: { text: '', alpha: 0, rise: 0 },
    cupMl: 0, cupK: 0, relayOn: false, led: 'ok', beat: 0,
    tempC: null, tempK: 0,
    target: null, min: CFG.DRY_PCT,
    busy: false,
  };

  return function drive(now, dt) {
    const b = fh.board, w = fh.world;
    const speed = sim.speed || 1;
    const frac = sim.frac();
    const reduced = prefs.reduced;
    let busy = false;

    // ---- readings: one spring for the soil color, the waterline and the wet layer ----
    const m = fh.nowPct();
    level.response = Math.max(0.2, Math.min(RESPONSE.drawing, 1 / speed));
    if (m != null) level.set(m);
    const lv = level.step(dt);
    if (!level.settled) busy = true;
    out.level = lv;
    out.wet = wetK(lv);
    out.min = CFG.DRY_PCT;
    out.pinched = w.pinched;

    // ---- the pour director (identical rules to rigMotion.js) ----
    const pumping = b.activePot === 'A';
    const flowing = !w.pinched && w.cupMl > 0;
    const ranS = pumping ? Math.min(b.pourMs, b.ms - b.pourStart + frac * 1000) / 1000 : 0;
    const newPours = [];
    if (fh.pours.length < poursSeen) poursSeen = 0;
    for (; poursSeen < fh.pours.length; poursSeen++) {
      const r = fh.pours[poursSeen];
      if (r.pot === 'A' && fh.t - r.ts <= STALE_S) newPours.push(r);
    }
    const fast = speed >= 600;
    const simNow = fh.t + frac;

    if (pumping) {
      if (!pour || pour.phase !== 'pour' || pour.start !== b.pourStart) {
        pour = { phase: 'pour', t0: now, start: b.pourStart, simT: fh.t, before: m ?? lv, ml: 0, wetted: false, receipt: null, cupStart: prevCup };
        soil.front = 0; soil.layer = 0;
      }
      pour.ml = ranS * CFG.FLOW_ML_S;
      pour.flowing = flowing;
      pour.cupEmpty = w.cupMl <= 0;
      if (flowing) { pour.wetted = true; pour.wetMl = pour.ml; }
    } else if (pour && pour.phase === 'pour') {
      const rec = newPours[newPours.length - 1];
      if (rec) pour.ml = (rec.ran_ms / 1000) * CFG.FLOW_ML_S;
      if (pour.wetted && !w.pinched) pour.wetMl = pour.ml;
      pour.phase = 'after';
      pour.tStop = Math.max(now, pour.t0 + (fast ? 0 : 300));
    } else if (newPours.length) {
      // the whole pour happened between two frames (fast-forward): act it out compressed
      const rec = newPours[newPours.length - 1];
      const ml = (rec.ran_ms / 1000) * CFG.FLOW_ML_S;
      const wetted = prevCup - w.cupMl > 0.5;
      pour = {
        phase: 'after', t0: now, tStop: now + (fast ? 0 : 300), start: -1, simT: fh.t - rec.ran_ms / 1000, before: m ?? lv,
        ml, wetMl: wetted ? ml : 0, wetted, flowing, cupEmpty: w.cupMl <= 0, receipt: null, compressed: true, cupStart: prevCup,
      };
      soil.front = 0; soil.layer = 0;
    }
    if (fh.soaks.length < soaksSeen) soaksSeen = 0;
    for (; soaksSeen < fh.soaks.length; soaksSeen++) {
      const s = fh.soaks[soaksSeen];
      if (s.pot !== 'A' || fh.t - s.ts > STALE_S) continue;
      if (!pour) pour = { phase: 'after', t0: now, tStop: now, start: -1, simT: s.ts, before: s.before_pct, ml: s.poured_s * CFG.FLOW_ML_S, wetMl: s.poured_s * CFG.FLOW_ML_S, wetted: true, cupStart: Infinity, receipt: null };
      pour.receipt = s;
      pour.tReceipt = now;
    }

    const acting = pour && (pour.phase === 'pour' || now < pour.tStop);
    const waterIn = acting && !pour.cupEmpty && !fast;

    // tube: fills from the pump in 400 ms (200 compressed); stops at the clamp when pinched; drains in 500 ms
    const fillTo = waterIn ? (w.pinched ? PINCH_AT - 0.01 : 1) : 0;
    if (fillTo !== tube.to) tube.go(fillTo, now, fillTo > tube.x ? (pour?.compressed ? 200 : POUR.tubeFill) : POUR.tubeDrain, easeTube);
    if (reduced) tube.jump(fillTo);
    out.tube = tube.value(now);
    if (!tube.done) busy = true;

    // stream: extends from the nozzle once the tube is full (120 ms, accelerating), falls away when the pump stops
    const streamOn = waterIn && pour.flowing && out.tube > 0.98;
    if (streamOn && (stream.phase === 'off' || stream.phase === 'out')) { stream.phase = 'in'; stream.t0 = now; }
    if (!streamOn && (stream.phase === 'in' || stream.phase === 'on')) { stream.phase = 'out'; stream.t0 = now; }
    let reach = 1, drop = 0, alpha = 0;
    if (stream.phase === 'in') {
      const k = reduced ? 1 : clamp01((now - stream.t0) / POUR.streamIn);
      reach = easeFall(k); alpha = 1;
      if (k >= 1) stream.phase = 'on';
    } else if (stream.phase === 'on') {
      alpha = 1;
    } else if (stream.phase === 'out') {
      const k = reduced ? 1 : clamp01((now - stream.t0) / POUR.streamOut);
      drop = easeFall(k); alpha = 1 - k;
      if (k >= 1) stream.phase = 'off';
    }
    out.stream.alpha = alpha; out.stream.reach = Math.max(0.001, reach); out.stream.drop = drop;
    out.stream.on = stream.phase === 'on' || stream.phase === 'in';
    if (alpha > 0) busy = true;

    // the wet front on the soil: grows with the ml that actually reached it; fades as the probe confirms the rise
    let active = 0;
    const wetMl = pour?.wetted ? (pour.wetMl ?? pour.ml) : 0;
    if (pour && pour.wetted && wetMl > 0) {
      const expected = Math.max(0.5, (fh.learnedPctPerS?.() || CFG.RATE_DEFAULT) * (wetMl / CFG.FLOW_ML_S));
      const confirm = pour.phase === 'pour' ? 0 : clamp01((lv - pour.before) / expected);
      active = 1 - confirm;
      if (pour.receipt) active *= 1 - clamp01((now - pour.tReceipt) / 800);
      const age = Math.max(0, simNow - pour.simT);
      const cover = Math.min(COVER, bulbRadius(wetMl) * 4);
      const k = Math.min(speed, 20);   // the spread plays out in sim time, like the soak
      const frontGoal = reduced ? cover : cover * (1 - 1 / (1 + age / SPREAD_TAU));
      soil.front = reduced ? frontGoal : damp(soil.front, frontGoal, 3 * k, dt);
      const layerGoal = Math.min(0.95, wetMl / (BOX_AREA_CM2 * TAKES_UP) / DEPTH_CM);
      soil.layer = reduced ? layerGoal : damp(soil.layer, age > 2 || pour.compressed ? layerGoal : soil.layer, 0.35 * k, dt);
      out.pour.age = reduced ? -1 : (now - pour.t0) / 1000;
      busy = true;
    } else {
      out.pour.age = -1;
    }
    out.pour.ml = wetMl;
    out.pour.active = active;
    out.pour.front = soil.front;
    out.pour.layer = soil.layer;
    out.pour.t = now / 1000;

    // a hand pour: a wet spot where a person tips a cup (away from the nozzle), sized by the detected rise;
    // held 1.5 s, then soaking away over 4.5 s. Nothing if it was seen during a skip.
    const h = fh.hand;
    if (h && h.phase === 'seen' && h.ts !== handTs) {
      handTs = h.ts;
      if (fh.t - h.ts <= STALE_S) { handAt = now; handRise = h.rise; }
    }
    const hk = clamp01((now - handAt - 1500) / 4500);
    out.hand.a = now - handAt >= 6000 ? 0 : reduced ? (hk < 1 ? 1 : 0) : 1 - easeTube(hk);
    out.hand.rise = handRise;
    if (out.hand.a > 0) busy = true;

    // the chip: "+64 ml" while pumping, held after, then the receipt. A pour that moved no water never claims ml.
    let chipTarget = 0;
    if (pour) {
      const secs = pour.ml / CFG.FLOW_ML_S;
      const dry = pour.phase === 'pour' ? !pour.wetted : !pour.wetted || (pour.cupStart ?? 0) - w.cupMl < 0.5;
      if (dry && (pour.ml > 0 || pour.phase === 'pour')) {
        setChip(pour.phase === 'pour' ? `${secs.toFixed(1)} s pumped` : `${+secs.toFixed(1)} s pumped, no water`, now);
        chipTarget = pour.phase === 'pour' || (pour.receipt ? now - pour.tReceipt < POUR.receiptHold : now - pour.tStop < POUR.mlHold || fh.t - pour.simT < 240) ? 1 : 0;
      } else if (pour.receipt) {
        const s = pour.receipt;
        setChip(`${signed1(s.rise_pct)}% from ${mlFmt.format(Math.round(s.poured_s * CFG.FLOW_ML_S))} ml`, now);
        chipTarget = now - pour.tReceipt < POUR.receiptHold ? 1 : 0;
      } else if (pour.ml > 0 || pour.phase === 'pour') {
        setChip(`+${mlFmt.format(Math.round(pour.ml))} ml`, now);
        chipTarget = pour.phase === 'pour' || now - (pour.tStop || now) < POUR.mlHold || fh.t - pour.simT < 240 ? 1 : 0;
      }
      if (!chipTarget && chip.alpha <= 0.001 && !acting && pour.phase === 'after') { pour = null; chip.text = ''; }
    }
    const inDur = reduced ? 100 : POUR.chipIn, outDur = reduced ? 100 : POUR.chipOut;
    const a0 = chip.alpha;
    chip.alpha = chipTarget ? Math.min(1, chip.alpha + (dt * 1000) / inDur) : Math.max(0, chip.alpha - (dt * 1000) / outDur);
    out.chip.text = chip.text;
    out.chip.alpha = chipTarget ? easeOut(chip.alpha) : chip.alpha;
    out.chip.rise = chipTarget && !reduced ? 6 * (1 - easeOut(clamp01((now - chip.shownAt) / POUR.chipIn))) : 0;
    if (a0 !== chip.alpha || out.chip.rise > 0) busy = true;

    // cup: the level drops continuously while the pump runs (the sim debits it once a sim second)
    let cup = w.cupMl;
    if (pumping && !w.pinched) {
      const end = b.pourStart + b.pourMs;
      const pend = Math.max(0, Math.min(b.ms + frac * 1000, end) - Math.max(b.ms, b.pourStart));
      cup = Math.max(0, cup - (pend / 1000) * CFG.FLOW_ML_S);
    }
    prevCup = w.cupMl;
    out.cupMl = cup;
    out.cupK = clamp01(cup / CFG.PUMP_CUP_ML);

    // relay LED and the board LED follow what the drawing is acting out
    out.relayOn = !!acting;
    out.led = acting ? 'pump' : lv < CFG.DRY_PCT ? 'dry' : 'ok';

    // heartbeat: a blip per new reading, at most one per 800 ms; steady at speed
    const L = fh.latest;
    if (L && L.ts !== lastTs) { lastTs = L.ts; if (now - beatAt >= POUR.beatGap) beatAt = now; }
    if (speed > 1 && !sim.paused) out.beat = 0.85;
    else {
      const k = (now - beatAt) / POUR.beat;
      out.beat = k < 0 || k >= 1 ? 0 : k < 0.12 ? 1 : 1 - easeOut((k - 0.12) / 0.88);
      if (k >= 0 && k < 1) busy = true;
    }

    // temperature: the tip color inside the temperature hue (lightness carries heat)
    if (L) {
      temp.set(L.temp_c);
      out.tempK = clamp01((temp.step(dt) - 20) / 14);
      out.tempC = L.temp_c;
      if (!temp.settled) busy = true;
    }

    // target: during a run, and for 20 real seconds after it ends so the result can be read
    if (fh.run.t_end !== runEnd) { runEnd = fh.run.t_end; runEndReal = now; }
    const tgt = fh.run.target;
    const showT = tgt != null && (fh.tgt || (runEnd != null && now - runEndReal < 20000 && fh.run.phase !== 'idle'));
    out.target = showT ? tgt : null;

    out.busy = busy;
    return out;
  };
}
