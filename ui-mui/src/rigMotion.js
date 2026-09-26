import { CFG } from './sim.js';
import { sim } from './useFarmHand.js';
import {
  Spring, Tween, RESPONSE, POUR, prefs, easeOut, easeTube, easeFall, mixHex, attr, text,
} from './motion.js';

/*
 * The drawing's per-frame writer (motion.md P1 + P2). It reads the sim each frame and writes SVG attributes.
 * No React state, no CSS transitions on geometry. Every beat maps to data:
 *   pump state            -> relay LED, water filling the tube (400 ms), a stream that falls with gravity
 *   pump seconds x 20 ml/s -> the ml chip and a wet patch under the nozzle that grows with it
 *   the probe (median)     -> waterline, wet layer, soil color (one spring, so line, fill and label move together);
 *                            the patch fades as the probe confirms the water arrived
 *   the soak result        -> the receipt, "+4.1% from 100 ml", in the same chip
 *   each reading           -> a 300 ms LED blip, at most one per 800 ms; held steady when fast-forwarding
 *   DS18B20                -> tip color within the temperature hue, and the °C beside it
 */

const SOIL_TOP = 224, SOIL_BOT = 381;
export const levelY = (pct) => SOIL_BOT - (Math.max(0, Math.min(100, pct)) / 100) * (SOIL_BOT - SOIL_TOP);
export const NOZZLE = { x: 306, y: 190 };
export const TUBE = `M115 328 C 115 200, 175 150, 255 150 L 296 150 Q 306 150 306 160 L ${NOZZLE.x} ${NOZZLE.y}`;
export const PINCH_AT = 0.28;   // where the clamp sits on the tube, as a fraction of its length

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mlFmt = new Intl.NumberFormat();
const signed1 = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;
// Soil color maps over the working band so a 4% pour is visible (P1.8). Presentation only.
const wetK = (m) => clamp01((m - CFG.DRY_PCT + 10) / (CFG.WET_PCT - CFG.DRY_PCT + 15));

export function createRigWriter(n, fh, palette) {
  const R = palette.rig;
  const level = new Spring(fh.nowPct() ?? CFG.START_PCT, RESPONSE.drawing);
  const temp = new Spring(fh.latest?.temp_c ?? 27, RESPONSE.drawing);
  const tube = new Tween(0);
  const stream = { phase: 'off', t0: 0 };
  let pour = null;                // the pour being acted out
  let poursSeen = fh.pours.length, soaksSeen = fh.soaks.length;
  let lastTs = fh.latest?.ts, beatAt = -1e9;
  let runEnd = fh.run.t_end, runEndReal = -1e9;
  let chip = { text: '', shownAt: 0, hideAt: Infinity, alpha: 0 };
  let prevCup = fh.world.cupMl;
  let handTs = fh.hand?.ts, handAt = -1e9, handRise = 0;
  // A result is stale if it belongs to a pour that finished during a skip or a fast-forward frame.
  const STALE_S = 30;

  const setChip = (s, now) => {
    if (s === chip.text) return;
    const fresh = !chip.text || chip.alpha < 0.05 || /%/.test(s) !== /%/.test(chip.text);
    chip.text = s;
    text(n.pourText, s);
    if (n.pourText && n.pourRect) {
      // width: the widest it has been this pour, so the chip never jumps narrower mid-count
      const w = Math.max(74, n.pourText.getComputedTextLength() + 12, chip.w || 0);
      chip.w = w;
      attr(n.pourRect, 'width', w);
    }
    if (fresh) chip.shownAt = now;
  };

  return function frame(now, dt) {
    const b = fh.board, w = fh.world;
    const speed = sim.speed || 1;
    const frac = sim.frac();
    const reduced = prefs.reduced;

    // ---- readings: one spring for waterline, wet layer, soil color and the waterline chip ----
    const m = fh.nowPct();
    level.response = Math.max(0.2, Math.min(RESPONSE.drawing, 1 / speed));
    if (m != null) level.set(m);
    const lv = level.step(dt);
    const wl = levelY(lv);
    attr(n.wet, 'transform', `translate(0 ${wl.toFixed(2)})`);
    attr(n.wlTag, 'transform', `translate(0 ${wl.toFixed(2)})`);
    attr(n.soil, 'fill', mixHex(R.soilDry, R.soilWet, wetK(lv)));

    // ---- the pour director ----
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

    if (pumping) {
      if (!pour || pour.phase !== 'pour' || pour.start !== b.pourStart) {
        pour = { phase: 'pour', t0: now, start: b.pourStart, simT: fh.t, before: m ?? lv, ml: 0, wetted: false, receipt: null, cupStart: prevCup };
        chip.w = 0;
      }
      pour.ml = ranS * CFG.FLOW_ML_S;
      pour.flowing = flowing;
      pour.cupEmpty = w.cupMl <= 0;
      if (flowing) pour.wetted = true;
    } else if (pour && pour.phase === 'pour') {
      const rec = newPours[newPours.length - 1];
      if (rec) pour.ml = (rec.ran_ms / 1000) * CFG.FLOW_ML_S;
      pour.phase = 'after';
      pour.tStop = Math.max(now, pour.t0 + (fast ? 0 : 300));   // a pour that lasted one frame still reads (P1.7)
    } else if (newPours.length) {
      // the whole pour happened between two frames (fast-forward): act it out compressed, or chip only at >= 10 min/s
      const rec = newPours[newPours.length - 1];
      pour = {
        phase: 'after', t0: now, tStop: now + (fast ? 0 : 300), start: -1, simT: fh.t - rec.ran_ms / 1000, before: m ?? lv,
        ml: (rec.ran_ms / 1000) * CFG.FLOW_ML_S, wetted: prevCup - w.cupMl > 0.5, flowing, cupEmpty: w.cupMl <= 0, receipt: null, compressed: true,
        cupStart: prevCup,
      };
      chip.w = 0;
    }
    // the soak result for this pour: the sim's own number, when it lands
    if (fh.soaks.length < soaksSeen) soaksSeen = 0;
    for (; soaksSeen < fh.soaks.length; soaksSeen++) {
      const s = fh.soaks[soaksSeen];
      if (s.pot !== 'A' || fh.t - s.ts > STALE_S) continue;   // no stale receipts after a skip
      if (!pour) pour = { phase: 'after', t0: now, tStop: now, start: -1, simT: s.ts, before: s.before_pct, ml: s.poured_s * CFG.FLOW_ML_S, wetted: true, cupStart: Infinity, receipt: null };
      pour.receipt = s;
      pour.tReceipt = now;
    }

    const acting = pour && (pour.phase === 'pour' || now < pour.tStop);
    const waterIn = acting && !pour.cupEmpty && !fast;

    // tube: fills from the pump in 400 ms (200 compressed); stops at the clamp when pinched; drains back in 500 ms
    const fillTo = waterIn ? (w.pinched ? PINCH_AT - 0.01 : 1) : 0;
    if (fillTo !== tube.to) tube.go(fillTo, now, fillTo > tube.x ? (pour?.compressed ? 200 : POUR.tubeFill) : POUR.tubeDrain, easeTube);
    if (reduced) tube.jump(fillTo);
    const tf = tube.value(now);
    attr(n.tubeWater, 'stroke-dashoffset', (1 - tf).toFixed(4));

    // stream: extends from the nozzle once the tube is full (120 ms, accelerating), falls away when the pump stops
    const streamOn = waterIn && pour.flowing && tf > 0.98;
    if (streamOn && (stream.phase === 'off' || stream.phase === 'out')) { stream.phase = 'in'; stream.t0 = now; }
    if (!streamOn && (stream.phase === 'in' || stream.phase === 'on')) { stream.phase = 'out'; stream.t0 = now; }
    let sy = 1, dy = 0, so = 0;
    if (stream.phase === 'in') {
      const k = reduced ? 1 : clamp01((now - stream.t0) / POUR.streamIn);
      sy = easeFall(k); so = 1;
      if (k >= 1) stream.phase = 'on';
    } else if (stream.phase === 'on') {
      so = 1;
    } else if (stream.phase === 'out') {
      const k = reduced ? 1 : clamp01((now - stream.t0) / POUR.streamOut);
      dy = 8 * easeFall(k); so = 1 - k;
      if (k >= 1) stream.phase = 'off';
    }
    attr(n.stream, 'opacity', so.toFixed(3));
    attr(n.stream, 'transform', `translate(0 ${dy.toFixed(2)}) translate(${NOZZLE.x} ${NOZZLE.y}) scale(1 ${Math.max(0.001, sy).toFixed(3)}) translate(${-NOZZLE.x} ${-NOZZLE.y})`);
    if (pour && so > 0) attr(n.streamHi, 'stroke-dashoffset', (-(pour.ml / CFG.FLOW_ML_S) * 1000 * 0.06).toFixed(2));

    // wet patch: rx/ry grow with ml; fades as the probe rises by what this soil's learned rate says the pour is worth
    let patchA = 0;
    if (pour && pour.wetted && pour.ml > 0) {
      const expected = Math.max(0.5, (fh.learnedPctPerS?.() || CFG.RATE_DEFAULT) * (pour.ml / CFG.FLOW_ML_S));
      const confirm = pour.phase === 'pour' ? 0 : clamp01((lv - pour.before) / expected);
      patchA = 0.38 * (1 - confirm);
      if (pour.receipt) patchA *= 1 - clamp01((now - pour.tReceipt) / 800);
      attr(n.patch, 'rx', Math.min(110, 8 + 0.5 * pour.ml));
      attr(n.patch, 'ry', Math.min(70, 3 + 0.35 * pour.ml));
    }
    attr(n.patch, 'opacity', patchA.toFixed(3));

    // a hand pour: when the pour detector sees a rise nobody pumped, a wet spot where a cup would land
    // (away from the nozzle), sized by the detected rise, held 1.5 s then fading over 4.5 s. Nothing if it was seen during a skip.
    const h = fh.hand;
    if (h && h.phase === 'seen' && h.ts !== handTs) {
      handTs = h.ts;
      if (fh.t - h.ts <= STALE_S) { handAt = now; handRise = h.rise; }
    }
    // hold 1.5 s so it registers, then soak away over 4.5 s (a gentle in-out; the strong UI ease-out drops too fast)
    const hk = clamp01((now - handAt - 1500) / 4500);
    attr(n.handPatch, 'opacity', (now - handAt >= 6000 ? 0 : 0.34 * (1 - easeTube(hk))).toFixed(3));
    if (hk < 1) { attr(n.handPatch, 'rx', Math.min(120, 30 + 7 * handRise)); attr(n.handPatch, 'ry', Math.min(60, 8 + 4 * handRise)); }

    // the chip: "+64 ml" while pumping, held after, then the receipt; exits after it has been read.
    // A pour that moved no water (tube pinched, cup empty: the cup level never dropped) never claims ml or a %:
    // it counts pump seconds and says no water reached the soil.
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
        // hold the total until the soak result lands (or 4 min of sim time without one)
        chipTarget = pour.phase === 'pour' || now - (pour.tStop || now) < POUR.mlHold || fh.t - pour.simT < 240 ? 1 : 0;
      }
      // done: the chip has faded and there's nothing left to wait for
      if (!chipTarget && chip.alpha <= 0.001 && !acting && pour.phase === 'after') { pour = null; chip.text = ''; }
    }
    const inDur = reduced ? 100 : POUR.chipIn, outDur = reduced ? 100 : POUR.chipOut;
    chip.alpha = chipTarget ? Math.min(1, chip.alpha + (dt * 1000) / inDur) : Math.max(0, chip.alpha - (dt * 1000) / outDur);
    const rise = chipTarget && !reduced ? 6 * (1 - easeOut(clamp01((now - chip.shownAt) / POUR.chipIn))) : 0;
    attr(n.pourChip, 'opacity', (chipTarget ? easeOut(chip.alpha) : chip.alpha).toFixed(3));
    attr(n.pourChip, 'transform', `translate(0 ${rise.toFixed(2)})`);

    // cup: the level drops continuously while the pump runs (the sim debits it once a sim second)
    let cup = w.cupMl;
    if (pumping && !w.pinched) {
      const end = b.pourStart + b.pourMs;
      const pend = Math.max(0, Math.min(b.ms + frac * 1000, end) - Math.max(b.ms, b.pourStart));
      cup = Math.max(0, cup - (pend / 1000) * CFG.FLOW_ML_S);
    }
    prevCup = w.cupMl;
    const cupH = (cup / CFG.PUMP_CUP_ML) * 110;
    attr(n.cup, 'y', 382 - cupH);
    attr(n.cup, 'height', cupH);
    text(n.cupText, cup > 0.5 ? `${mlFmt.format(Math.round(cup))} ml left` : 'Cup empty');

    // relay LED and probe LED color follow what the drawing is acting out
    attr(n.relayLed, 'fill', acting ? R.relayOn : R.relayOff);
    const led = acting ? R.ledPump : lv < CFG.DRY_PCT ? R.ledDry : R.ledOk;
    attr(n.led, 'fill', led);
    attr(n.beat, 'fill', led);

    // heartbeat: a blip per new reading, at most one per 800 ms; steady at speed (readings outrun a heartbeat)
    const L = fh.latest;
    if (L && L.ts !== lastTs) { lastTs = L.ts; if (now - beatAt >= POUR.beatGap) beatAt = now; }
    let beat;
    if (speed > 1 && !sim.paused) beat = 0.85;
    else {
      const k = (now - beatAt) / POUR.beat;
      beat = k < 0 || k >= 1 ? 0 : k < 0.12 ? 1 : 1 - easeOut((k - 0.12) / 0.88);
    }
    attr(n.beat, 'opacity', beat.toFixed(3));

    // temperature: tip color inside the temperature hue (lightness carries heat), the reading beside it
    if (L) {
      temp.set(L.temp_c);
      attr(n.tip, 'fill', mixHex(palette.temp.tip, palette.temp.main, (temp.step(dt) - 20) / 14));
      const s = `${L.temp_c.toFixed(1)} °C`;
      if (n.tempText && n.tempText.__t !== s) {
        text(n.tempText, s);
        const r = n.tempText.previousSibling;
        if (r) attr(r, 'width', Math.max(n.tempText.getComputedTextLength() + 12, 0));
      }
    }

    // target line + chip: during a run, and for 20 real seconds after it ends so the result can be read
    if (fh.run.t_end !== runEnd) { runEnd = fh.run.t_end; runEndReal = now; }
    const tgt = fh.run.target;
    const showT = tgt != null && (fh.tgt || (runEnd != null && now - runEndReal < 20000 && fh.run.phase !== 'idle'));
    attr(n.targetLine, 'display', showT ? 'inline' : 'none');
    attr(n.targetTag, 'display', showT ? 'inline' : 'none');
    if (showT) {
      const ty = levelY(tgt);
      attr(n.targetLine, 'y1', ty); attr(n.targetLine, 'y2', ty);
      attr(n.targetTag, 'transform', `translate(0 ${(ty - 30).toFixed(2)})`);
      const s = `target ${tgt}%`;
      if (n.targetText && n.targetText.__t !== s) {
        text(n.targetText, s);
        const r = n.targetText.previousSibling;
        if (r) attr(r, 'width', n.targetText.getComputedTextLength() + 12);
      }
    }

    // the min chip steps aside when the waterline or target chip would crowd it
    const by = levelY(CFG.DRY_PCT);
    attr(n.baseTag, 'display', Math.abs(by - wl) > 30 && (!showT || Math.abs(by - levelY(tgt)) > 34) ? 'inline' : 'none');
  };
}
