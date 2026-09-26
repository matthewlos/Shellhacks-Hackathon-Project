/* Farm Hand virtual rig.
   A browser copy of the real code in farm-hand/ (main branch):
     SimBoard   = firmware/farm_hand/farm_hand.ino  (same commands, same JSON lines, 30 s cap, 5 s gap)
     FarmHand   = laptop/board.py + brain.py (guards, Laya / rules / Gemini-team decisions)
                  + soak.py (pour detector, hand-pour detector) + target.py (Hit the Target) + report.py
   The soil itself is a model (World). Everything the page shows is simulated, never measured.
   Time is simulated seconds (this.t), advanced one step per second like the chip's 1 reading a second. */
(function () {
  'use strict';

  const CFG = {
    // laptop/config.py
    DRY_PCT: 35, WET_PCT: 70, TARGET_PCT: 55, LOW_MARGIN: 5,
    POUR_CAP_S: 30, AI_MIN_GAP_MIN: 30, DAILY_MAX_ML: 1500, CHECK_EVERY_MIN: 15,
    TIMER_EVERY_S: 6 * 3600, TIMER_POUR_MS: 5000, FLOW_ML_S: 20,
    ONE_POT: 0,   // PLAN 5e: box B is a real second box on the chip's timer. 1 = old one-pot mode (virtual timer)
    // firmware/farm_hand/farm_hand.ino
    RAW_AIR: 3400, RAW_WATER: 1507, PUMP_CAP_MS: 30000, PUMP_GAP_MS: 5000,
    // laptop/soak.py
    WATCH_S: 180, RISE_SEEN: 1.0, MIN_OK_RISE: 1.5, HAND_RISE: 4.0, PUMP_QUIET_S: 240, RATE_DEFAULT: 1.2,
    // laptop/target.py
    BAND: 2.0, LOCK: 1.0, MAX_PULSES: 6, PULSE_MAX_S: 8, PULSE_MIN_S: 1, CREEP: 0.7,
    MIN_SETTLE_S: 12, MAX_SETTLE_S: 90, FLAT: 0.4, MISS_RISE: 0.8, MISS_SHARE: 0.3, CHECKABLE: 3.0,
    // the world (a model): the real box took 200 ml -> +8% (44% -> 52%) on 2026-09-23
    PCT_PER_ML: 0.04, SEEP_PCT_S: 0.4, DRY_PCT_H: 0.8, NOISE: 0.25,
    START_PCT: 44, START_HOUR: 8, CUP_ML: 236.6, PUMP_CUP_ML: 1500,
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const f0 = (x) => Math.round(x).toString();
  function median(a) {
    if (!a.length) return NaN;
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const rawToPct = (raw) => clamp((CFG.RAW_AIR - raw) * 100 / (CFG.RAW_AIR - CFG.RAW_WATER), 0, 100);

  // ---------- the physical box (model) ----------
  class World {
    constructor() {
      this.pct = CFG.START_PCT;   // true moisture at the probe
      this.soaking = 0;           // water poured but not at the probe yet, in %
      this.wetDepth = 0;          // 0..1, for the drawing only
      this.cupMl = CFG.PUMP_CUP_ML;
      this.pinched = false;
      this.tempC = 27;
    }
    step(t) {
      const hour = (CFG.START_HOUR + t / 3600) % 24;
      this.tempC = 27 + 5 * Math.sin((hour - 9) / 24 * 2 * Math.PI);     // laptop/board.py FakeBoard
      const move = Math.min(this.soaking, CFG.SEEP_PCT_S);               // seeps down at ~0.4 %/s (FakeBoard)
      this.soaking -= move;
      this.pct += move;
      this.wetDepth = Math.min(1, this.wetDepth + move / 12);
      const perHour = CFG.DRY_PCT_H * (1 + 0.07 * (this.tempC - 26)) * (this.pct / 50);
      this.pct = clamp(this.pct - perHour / 3600, 3, 95);
      this.wetDepth *= Math.exp(-1 / (3 * 3600));
    }
    pump(ml) {                       // what the pump pushes out of the cup
      if (this.pinched) return 0;
      const out = Math.min(ml, this.cupMl);
      this.cupMl -= out;
      this.soaking += out * CFG.PCT_PER_ML;
      return out;
    }
    dryPerHour() { return CFG.DRY_PCT_H * (1 + 0.07 * (this.tempC - 26)) * (this.pct / 50); }
  }

  // ---------- the chip (firmware/farm_hand/farm_hand.ino) ----------
  class SimBoard {
    constructor(worldA, worldB, emit, twoPot) {
      this.worlds = { A: worldA, B: worldB }; this.world = worldA; this.emit = emit; this.twoPot = twoPot;
      this.ms = 0;
      this.activePot = null; this.pourStart = 0; this.pourMs = 0; this.pourBy = ''; this.lastPourEnd = null;
      this.timerEveryMs = 6 * 3600 * 1000; this.timerPourMs = 5000;   // firmware defaults: pot B every 6 h for 5 s
      this.lastTimerAt = 0; this.timerPending = false;
    }
    line(obj) { this.emit(obj); }
    send(cmd) {
      cmd = cmd.trim();
      if (!cmd) return;
      const c = cmd[0];
      if (c === 'P') {
        const pot = cmd[2] === 'B' ? 'B' : 'A';
        const ms = parseInt(cmd.substring(4), 10) || 0;
        if (!ms) return this.line({ type: 'error', why: 'usage: P A 3000' });
        this.startPour(pot, ms, 'laptop');
      } else if (c === 'T') {
        const p = cmd.split(/\s+/);
        const every = parseInt(p[1], 10) || 0;
        this.timerEveryMs = every * 1000;
        if (p[2]) this.timerPourMs = parseInt(p[2], 10) || this.timerPourMs;
        this.lastTimerAt = this.ms;
        this.timerPending = false;   // T 0 cancels a pour that was already waiting
        this.line({ type: 'timer', every_s: every, pour_ms: this.timerPourMs });
      } else if (c === 'S') this.report();
      else if (c === 'X') this.stopPour('emergency_stop');
      else this.line({ type: 'error', why: 'unknown command' });
    }
    startPour(pot, ms, by) {
      if (this.activePot) return this.line({ type: 'refused', pot, why: 'busy' });
      if (this.lastPourEnd !== null && this.ms - this.lastPourEnd < CFG.PUMP_GAP_MS) return this.line({ type: 'refused', pot, why: 'gap' });
      ms = Math.min(ms, CFG.PUMP_CAP_MS);
      this.activePot = pot; this.pourStart = this.ms; this.pourMs = ms; this.pourBy = by;
      this.line({ type: 'pour_start', pot, ms, by });
    }
    stopPour(why) {
      if (!this.activePot) return;
      const ran = this.ms - this.pourStart;
      this.line({ type: 'pour_done', pot: this.activePot, ran_ms: ran, by: this.pourBy, why });
      this.activePot = null; this.lastPourEnd = this.ms;
    }
    report() {
      const w = this.world;
      const raw = (pct) => Math.round(CFG.RAW_AIR - clamp(pct + gauss() * CFG.NOISE, 0, 100) / 100 * (CFG.RAW_AIR - CFG.RAW_WATER));
      const ra = raw(w.pct);
      const rb = this.twoPot ? raw(this.worlds.B.pct) : Math.round(1200 + Math.random() * 2000);   // one-pot: pin 33 is empty, it reads junk
      this.line({ type: 'reading', ms: this.ms, a_raw: ra, b_raw: rb, a_pct: Math.round(rawToPct(ra)), b_pct: Math.round(rawToPct(rb)),
                  temp_c: r1(w.tempC + gauss() * 0.05), pumping: this.activePot || 'none' });
    }
    step() {                          // one second of loop()
      const t0 = this.ms;
      this.ms += 1000;
      if (this.activePot) {
        const end = this.pourStart + this.pourMs;
        const runMs = Math.max(0, Math.min(this.ms, end) - Math.max(t0, this.pourStart));
        this.worlds[this.activePot].pump(runMs / 1000 * CFG.FLOW_ML_S);
        if (this.ms >= end) { this.ms = end; this.stopPour('time_up'); this.ms = t0 + 1000; }
      }
      // pot B's timer waits quietly until the pump is free and the 5 s gap has passed (farm_hand.ino loop())
      if (this.timerEveryMs > 0 && this.ms - this.lastTimerAt >= this.timerEveryMs) { this.timerPending = true; this.lastTimerAt = this.ms; }
      const pumpFree = !this.activePot && (this.lastPourEnd === null || this.ms - this.lastPourEnd >= CFG.PUMP_GAP_MS);
      if (this.timerPending && pumpFree) { this.startPour('B', this.timerPourMs, 'timer'); if (this.activePot === 'B') this.timerPending = false; }
      this.report();
    }
    get pumping() { return !!this.activePot; }
  }

  // ---------- the laptop (board.py, brain.py, soak.py, target.py, report.py) ----------
  class FarmHand {
    constructor(opts) {
      this.onePot = opts && opts.onePot != null ? !!opts.onePot : !!CFG.ONE_POT;
      this.reset();
    }

    reset() {
      const d = new Date(); d.setHours(CFG.START_HOUR, 0, 0, 0);
      this.t0 = d.getTime();
      this.t = 0;
      this.brainMode = this.brainMode || 'gemini';   // 'gemini' | 'laya' | 'rules'
      this.world = new World();
      this.worldB = new World();   // box B: same soil, same room, watered only by the chip's timer (PLAN 5e)
      this.board = new SimBoard(this.world, this.worldB, (o) => this.onLine(o), !this.onePot);
      this.latest = null; this.boardEvents = [];
      this.tagNext = null; this.curTag = 'laptop';
      // store.py tables
      this.readings = []; this.history = []; this.pours = []; this.soaks = []; this.decisions = [];
      this.activity = []; this.serial = []; this.serialCount = 0;
      // soak.py
      this.hist = []; this.histB = []; this.long = []; this.lastPump = -1e9; this.watch = null;
      this.live = { phase: 'idle' }; this.hand = { phase: 'idle' }; this.PAUSED = false;
      // brain.py
      this.LAST = { laya: null, check: null }; this.team = null; this.nextCheck = 20;   // server.py loop sleeps 20 s first
      // target.py
      this.run = { phase: 'idle' }; this.tgt = null;
      this.log('<', JSON.stringify({ type: 'boot', fw: 'farm-hand-1', sim: 1, probes: 1 }));
      // board.py open_board: one-pot mode switches the chip's pot-B timer off; two-pot mode sends the real schedule
      this.send(this.onePot ? `T 0 ${CFG.TIMER_POUR_MS}` : `T ${CFG.TIMER_EVERY_S} ${CFG.TIMER_POUR_MS}`);
    }

    // ----- plumbing -----
    log(dir, text) {
      this.serial.push({ t: this.t, dir, text });
      if (this.serial.length > 150) this.serial.shift();
      this.serialCount++;
    }
    logAct(agent, what) {
      this.activity.push({ ts: this.t, agent, what });
      if (this.activity.length > 200) this.activity.shift();
    }
    send(cmd) { this.log('>', cmd); this.board.send(cmd); }
    midnight() { return Math.floor((CFG.START_HOUR * 3600 + this.t) / 86400) * 86400 - CFG.START_HOUR * 3600; }
    nowPct() { const v = this.hist.slice(-6); return v.length ? r1(median(v)) : null; }
    nowPctB() { const v = this.histB.slice(-6); return v.length ? r1(median(v)) : null; }

    // board.py _on_line
    onLine(obj) {
      obj = Object.assign({}, obj);
      this.log('<', JSON.stringify(obj));
      obj.ts = this.t;
      if (obj.type === 'reading') {
        obj.a_pct = r1(rawToPct(obj.a_raw));
        obj.b_pct = r1(rawToPct(obj.b_raw));
        this.latest = obj;
        this.readings.push(obj);
        if (this.readings.length > 400) this.readings.shift();
      } else {
        if (obj.type === 'pour_start' && obj.by === 'laptop') { this.curTag = this.tagNext || 'laptop'; this.tagNext = null; obj.by = this.curTag; }
        else if (obj.type === 'pour_done' && obj.by === 'laptop') obj.by = this.curTag;
        this.boardEvents.push(obj);
        if (this.boardEvents.length > 50) this.boardEvents.shift();
        if (obj.type === 'pour_done') this.pours.push({ ts: this.t, pot: obj.pot, ran_ms: obj.ran_ms, by: obj.by, why: obj.why });
      }
      this.soakOnLine(obj);
    }

    step() {
      this.t++;
      this.world.step(this.t);
      this.worldB.step(this.t);
      this.board.step();
      this.soakTick();
      this.targetTick();
      this.teamTick();
      if (this.t >= this.nextCheck) {
        this.checkNow('loop');
        this.nextCheck = this.t + CFG.CHECK_EVERY_MIN * 60;
      }
      if (this.t % 10 === 0 && this.latest) {
        this.history.push({ t: this.t, a: this.nowPct(), temp: this.latest.temp_c, b: this.onePot ? null : this.nowPctB() });
        if (this.history.length > 80000) this.history.shift();
      }
    }
    fastForward(sec) { for (let i = 0; i < sec; i++) this.step(); }

    // ----- soak.py -----
    soakOnLine(obj) {
      if (obj.type === 'reading') {
        this.hist.push(obj.a_pct);
        if (this.hist.length > 30) this.hist.shift();
        this.histB.push(obj.b_pct);
        if (this.histB.length > 30) this.histB.shift();
        if (obj.pumping !== 'none') this.lastPump = this.t;
        this.checkHand(obj.a_pct);
      } else if (obj.type === 'pour_start') {
        this.lastPump = this.t;
        const h = obj.pot === 'B' ? this.histB : this.hist;
        if (!this.PAUSED && h.length) {
          const before = median(h.slice(-6));
          this.watch = { pot: obj.pot, poured_s: obj.ms / 1000, before, t0: this.t, peak: before, first: null, by: obj.by };
          this.live = { phase: 'soaking', pot: obj.pot, before, now: before, t0: this.t, watch_s: CFG.WATCH_S, poured_s: obj.ms / 1000 };
        }
      }
    }
    soakTick() {
      const w = this.watch;
      if (!w) return;
      const h = w.pot === 'B' ? this.histB : this.hist;
      const v = h[h.length - 1];
      w.peak = Math.max(w.peak, v);
      this.live.now = v;
      if (w.first === null && v >= w.before + CFG.RISE_SEEN) w.first = this.t - w.t0;
      if (this.t - w.t0 < CFG.WATCH_S) return;
      const rise = r1(w.peak - w.before), ok = rise >= CFG.MIN_OK_RISE;
      const note = ok ? 'water reached the probe'
        : "probe barely moved: check the pump is in water, the tube isn't kinked, and the tube points at the pot";
      const d = { ts: this.t, pot: w.pot, poured_s: w.poured_s, before_pct: r1(w.before), peak_pct: r1(w.peak), rise_pct: rise,
                  first_rise_s: w.first, pct_per_s: w.poured_s ? r3(rise / w.poured_s) : null, ok, note, by: w.by };
      this.soaks.push(d);
      this.watch = null;
      this.live = { phase: 'done', last: d, t_done: this.t };
    }
    checkHand(pct) {
      const now = this.t;
      this.long = this.long.filter(([ts]) => now - ts < 180);
      this.long.push([now, pct]);
      if (this.hand.phase === 'seen') {
        if (now - this.hand.ts < 90) {
          const v = median(this.long.slice(-5).map((x) => x[1]));
          this.hand.now = r1(v);
          this.hand.rise = r1(Math.max(this.hand.rise, v - this.hand.before));
          return;
        }
        if (now - this.hand.ts < 180) return;
        this.hand = { phase: 'idle' };
      }
      const base = this.long.filter(([ts]) => now - ts >= 45 && now - ts <= 120).map((x) => x[1]);
      if (base.length < 10 || this.long.length < 5 || this.PAUSED || now - this.lastPump < CFG.PUMP_QUIET_S) return;
      const before = median(base), v = median(this.long.slice(-5).map((x) => x[1]));
      if (v - before >= CFG.HAND_RISE) this.hand = { phase: 'seen', ts: now, before: r1(before), now: r1(v), rise: r1(v - before) };
    }
    learnedPctPerS() {
      const vals = this.soaks.slice(-20).reverse().filter((s) => s.pot === 'A' && s.ok && s.pct_per_s).map((s) => s.pct_per_s);
      return vals.length ? r3(median(vals.slice(0, 5))) : CFG.RATE_DEFAULT;
    }

    // ----- brain.py: hard rules -----
    lastAiPourTs() { const p = this.pours.filter((x) => x.pot === 'A'); return p.length ? p[p.length - 1].ts : null; }
    mlToday() {
      const since = this.midnight();
      return this.pours.filter((p) => p.pot === 'A' && p.ts >= since).reduce((s, p) => s + p.ran_ms / 1000 * CFG.FLOW_ML_S, 0);
    }
    guards(seconds, skipGap) {
      const b = this.latest;
      if (!b || this.t - b.ts > 120) return [false, 'board offline', 0];
      if (b.a_pct >= CFG.WET_PCT) return [false, `pot A already wet (${b.a_pct}% >= ${CFG.WET_PCT}%)`, 0];
      if (this.PAUSED && !skipGap) return [false, 'a Hit-the-Target run is using the pump', 0];
      const last = this.lastAiPourTs();
      const gap = last === null ? Infinity : (this.t - last) / 60;
      if (gap < CFG.AI_MIN_GAP_MIN && !skipGap) return [false, `watered ${f0(gap)} min ago, rule is ${CFG.AI_MIN_GAP_MIN} min`, 0];
      const ml = this.mlToday();
      if (ml >= CFG.DAILY_MAX_ML) return [false, `daily cap hit (${f0(ml)} ml)`, 0];
      if (this.live.phase === 'soaking') return [false, 'last pour is still soaking in', 0];
      return [true, 'ok', Math.max(1, Math.min(seconds, CFG.POUR_CAP_S))];
    }
    guardReport() {
      const b = this.latest, fresh = !!(b && this.t - b.ts <= 120);
      const last = this.lastAiPourTs();
      const gap = last === null ? null : (this.t - last) / 60;
      const ml = this.mlToday();
      return [
        { rule: 'Board online', ok: fresh, detail: 'reading ' + (b ? `${this.t - b.ts} s ago` : 'none yet') },
        { rule: 'Pot A not already wet', ok: fresh && b.a_pct < CFG.WET_PCT, detail: b ? `${b.a_pct.toFixed(1)}% (limit ${CFG.WET_PCT}%)` : '–' },
        { rule: 'Gap since last AI pour', ok: gap === null || gap >= CFG.AI_MIN_GAP_MIN, detail: (gap === null ? 'no pours yet' : `${f0(gap)} min`) + ` (min ${CFG.AI_MIN_GAP_MIN})` },
        { rule: 'Daily water cap', ok: ml < CFG.DAILY_MAX_ML, detail: `${f0(ml)} / ${CFG.DAILY_MAX_ML} ml` },
        { rule: 'Last pour finished soaking', ok: this.live.phase !== 'soaking', detail: this.live.phase },
        { rule: 'Pour length cap', ok: true, detail: `${CFG.POUR_CAP_S} s (laptop) + 30 s (chip)` },
      ];
    }
    waterPot(seconds, reason, tag) {
      const [ok, why, secs] = this.guards(seconds, false);
      if (!ok) { this.logAct('guards', 'REFUSED: ' + why); return { watered: false, refused_because: why }; }
      this.tagNext = tag || null;
      this.send(`P A ${Math.round(secs * 1000)}`);
      this.logAct('executor', `pump A ${f0(secs)}s`);
      return { watered: true, seconds: r1(secs) };
    }

    // ----- brain.py: the call -----
    getSoil() {
      const b = this.latest;
      if (!b || this.t - b.ts > 120) return { error: 'no fresh reading from the board in the last 2 minutes' };
      const perH = this.world.dryPerHour();
      return { moisture_pct: b.a_pct, soil_temp_c: b.temp_c, hours_until_dry: b.a_pct > CFG.DRY_PCT ? (b.a_pct - CFG.DRY_PCT) / perH : 0 };
    }
    failedPoursRecently() { return this.soaks.slice(-5).filter((s) => !s.ok).length; }

    // Laya (laya/serve_decider.py): the real one is a fine-tuned model. Here it's a stand-in that
    // follows the same line the planner uses: water at or below DRY_PCT + LOW_MARGIN. Indoors, no wait_rain.
    fastDecision() {
      const soil = this.getSoil();
      if (soil.error) return { error: soil.error };
      const pct = soil.moisture_pct, line = CFG.DRY_PCT + CFG.LOW_MARGIN;
      const pick = pct <= line ? 'water' : 'wait_moist';
      const sure = r3(0.8 + 0.19 * Math.min(1, Math.abs(pct - line) / 10));
      const ms = r1(12 + Math.random() * 20);
      this.logAct('laya', `${pick} ${Math.round(sure * 100)}% (${ms} ms)`);
      this.LAST.laya = { ts: this.t, pick, sure, ms, soil_pct: pct };
      return { pick, sure, ms, soil_pct: pct };
    }
    layaDecide() {
      if (this.failedPoursRecently() >= 2) return null;
      const d = this.fastDecision();
      if (d.error) return null;
      const pct = d.soil_pct, sure = `${Math.round(d.sure * 100)}%`;
      if (d.pick !== 'water') return ['wait', 0, `WAIT: soil is ${f0(pct)}% and the soil still has enough water (Laya, ${sure} sure).`];
      const secs = Math.max(1, (CFG.TARGET_PCT - pct) / this.learnedPctPerS());
      const r = this.waterPot(secs, `Laya: water (${sure})`);
      if (r.watered) return ['water', r.seconds, `WATER: soil is ${f0(pct)}% and no rain will cover it. Watering ${f0(r.seconds)} s (Laya, ${sure} sure).`];
      return ['wait', 0, `WAIT: Laya said water, but the safety rules said no (${r.refused_because}).`];
    }
    ruleDecide() {
      for (const a of ['weather_agent', 'soil_agent', 'memory_agent']) this.logAct(a, '(rules) gathering');
      const soil = this.getSoil();
      if (soil.error) return ['wait', 0, `WAIT: ${soil.error}.`];
      const pct = soil.moisture_pct;
      this.logAct('planner_agent', '(rules) deciding');
      if (this.failedPoursRecently() >= 2) return ['wait', 0, "WAIT: the last pours didn't reach the probe. Check the pump and tube before watering again."];
      if (pct >= CFG.WET_PCT) return ['wait', 0, `WAIT: soil is ${f0(pct)}%, already wet.`];
      if (pct > CFG.DRY_PCT + CFG.LOW_MARGIN) return ['wait', 0, `WAIT: soil is ${f0(pct)}%, about ${f0(soil.hours_until_dry)} hours of water left. Water only when it's low, then a real drink.`];
      const secs = (CFG.TARGET_PCT - pct) / this.learnedPctPerS();
      const r = this.waterPot(secs, `soil ${f0(pct)}%, no rain coming`);
      if (r.watered) return ['water', r.seconds, `WATER: soil is ${f0(pct)}% and no rain is coming. Watering ${f0(r.seconds)} s.`];
      return ['wait', 0, `WAIT: wanted to water but ${r.refused_because}.`];
    }
    whichBrain() { return this.brainMode === 'gemini' ? 'gemini (simulated)' : 'rules'; }

    checkNow(kind) {
      if (this.team) return false;                 // one check at a time (brain._check_lock)
      const brain = this.whichBrain();
      this.LAST.check = { t0: this.t, t1: null, brain, kind };
      if (this.brainMode === 'gemini') {
        this.fastDecision();                       // Laya's instant call lands first; the team explains after
        this.startTeam(kind);
        return true;
      }
      let got = this.brainMode === 'laya' ? this.layaDecide() : null, name = 'laya (fast decider)';
      if (!got) { got = this.ruleDecide(); name = 'rules'; }
      this.finishCheck(name, got, kind);
      return true;
    }
    finishCheck(brain, got, kind) {
      const [action, seconds, sentence] = got;
      this.decisions.push({ ts: this.t, action, seconds, brain, sentence, kind });
      this.LAST.check = Object.assign({}, this.LAST.check, { t1: this.t, brain, action });
    }

    // The Gemini team (brain._build_team): gather in parallel, then planner <-> critic, up to 3 rounds.
    // Its timings are made up (seen on the fake board: about 37 s). Its plan follows the planner's rules of thumb.
    startTeam(kind) {
      const total = 20 + Math.random() * 30;
      const reject = Math.random() < 0.25;
      const g = total * 0.45, p1 = g + total * 0.2, c1 = p1 + total * (reject ? 0.1 : 0.35);
      const plan = [
        { at: 0, agents: ['weather_agent', 'soil_agent', 'memory_agent'], what: ['calls get_forecast', 'calls get_soil', 'calls get_memory'] },
        { at: g, agents: ['planner_agent'], what: ['calls get_fast_decision'] },
        { at: p1, agents: ['critic_agent'], what: ['reviewing'] },
      ];
      if (reject) {
        plan.push({ at: c1, agents: ['planner_agent'], what: ['fixing the plan'], reject: true });
        plan.push({ at: c1 + total * 0.12, agents: ['critic_agent'], what: ['reviewing'] });
      }
      this.team = { t0: this.t, end: this.t + Math.round(total), kind, plan, i: 0, reject };
    }
    teamTick() {
      const T = this.team;
      if (!T) return;
      while (T.i < T.plan.length && this.t - T.t0 >= T.plan[T.i].at) {
        const s = T.plan[T.i++];
        if (s.reject) this.logAct('critic_agent', "sent back: the farmer sentence has a number the tools didn't give");
        s.agents.forEach((a, k) => this.logAct(a, s.what[k]));
        if (s.agents[0] === 'planner_agent') {
          const soil = this.getSoil();
          const water = !soil.error && soil.moisture_pct <= CFG.DRY_PCT + CFG.LOW_MARGIN && this.failedPoursRecently() < 2;
          T.water = water;
          T.secs = water ? Math.min(CFG.POUR_CAP_S, (CFG.TARGET_PCT - soil.moisture_pct) / this.learnedPctPerS()) : 0;
          this.logAct('planner_agent', `proposed ${water ? 'water' : 'wait'} ${f0(T.secs)}s`);
        }
      }
      if (this.t < T.end) return;
      this.team = null;
      this.logAct('critic_agent', 'approved: plan matches the data');
      const soil = this.getSoil(), pct = soil.moisture_pct;
      let got;
      if (soil.error) got = ['wait', 0, `WAIT: ${soil.error}.`];
      else if (this.failedPoursRecently() >= 2) got = ['wait', 0, "WAIT: the last pours didn't reach the probe, so I'm holding off. Check the pump and the tube."];
      else if (!T.water) got = ['wait', 0, `WAIT: the soil is at ${f0(pct)}%, which still has enough water. I'll water when it gets down to ${CFG.DRY_PCT + CFG.LOW_MARGIN}%.`];
      else {
        const r = this.waterPot(T.secs, `planner: soil ${f0(pct)}%`);
        got = r.watered ? ['water', r.seconds, `WATER: the soil dropped to ${f0(pct)}% and no rain can reach it indoors, so I'm giving it one real drink of ${f0(r.seconds)} seconds.`]
          : ['wait', 0, `WAIT: the plan said water, but the safety rules said no (${r.refused_because}).`];
        if (!r.watered) this.logAct('executor', 'approved plan refused by guards');
      }
      if (got[0] === 'wait') this.logAct('executor', 'approved wait');
      this.finishCheck(this.whichBrain(), got, T.kind);
    }

    // ----- server.py buttons -----
    testPour(seconds) {
      const secs = Math.max(1, Math.min(seconds || 5, CFG.POUR_CAP_S));
      const r = this.waterPot(secs, 'manual test pour from the dashboard', 'manual');
      this.logAct('executor', r.watered ? `manual test pour ${f0(secs)}s` : 'manual pour refused');
      return r;
    }
    stop() {
      if (this.tgt) this.endTarget('stopped', 'Stopped.');
      this.send('X');
    }
    demoDry() { this.world.pct = CFG.DRY_PCT + 1; this.world.soaking = 0; this.world.wetDepth = 0; }
    demoHandPour(pot) { (pot === 'B' ? this.worldB : this.world).soaking += CFG.CUP_ML * CFG.PCT_PER_ML; }

    // server.py POST /api/baseline: the level to keep. Box A waters at or below it (+ LOW_MARGIN in the planner),
    // and each pour aims 20 points above it, capped 5 under the wet limit.
    setBaseline(pct) {
      pct = Number(pct);
      if (!(pct >= 20 && pct <= CFG.WET_PCT - 15)) return { error: `pick a level between 20% and ${CFG.WET_PCT - 15}%` };
      CFG.DRY_PCT = r1(pct);
      CFG.TARGET_PCT = r1(Math.min(pct + 20, CFG.WET_PCT - 5));
      this.logAct('executor', `baseline set to ${CFG.DRY_PCT}%, pours aim for ${CFG.TARGET_PCT}%`);
      return { baseline: CFG.DRY_PCT, target: CFG.TARGET_PCT, wet_limit: CFG.WET_PCT };
    }
    demoPinch() { this.world.pinched = !this.world.pinched; return this.world.pinched; }
    refill() { this.world.cupMl = CFG.PUMP_CUP_ML; }

    // ----- target.py -----
    startTarget(pct) {
      const lo = CFG.DRY_PCT, hi = CFG.WET_PCT - CFG.BAND;
      if (!(pct >= lo && pct <= hi)) return { ok: false, why: `pick a target between ${lo}% and ${hi}%` };
      if (this.tgt) return { ok: false, why: 'a target run is already going' };
      const start = this.nowPct();
      const rate = this.learnedPctPerS();
      this.run = { phase: 'reading', target: pct, band: CFG.BAND, start, now: start, rate, pulses: [], t0: this.t, msg: `Soil is ${start}%. Target ${pct}%.` };
      this.logAct('target_agent', `target ${pct}%, soil ${start}%`);
      this.PAUSED = true;
      this.tgt = { state: 'decide', i: 0, rate };
      return { ok: true };
    }
    targetTick() {
      const G = this.tgt;
      if (!G) return;
      const run = this.run;
      if (G.state === 'decide') {
        const now = this.nowPct(), target = run.target;
        run.now = now;
        if (now === null) return this.endTarget('fault', 'No readings from the board.');
        if (now >= target - CFG.LOCK) {
          const inBand = now <= target + CFG.BAND;
          return this.endTarget(inBand ? 'locked' : 'over', inBand ? `Locked at ${now}%, target ${target}%.`
            : run.pulses.length ? `Overshot: the last pulse took the soil to ${now}%, past the ${target}% target.`
              : `Soil is ${now}%, already above the ${target}% target. Water can't be taken back out.`);
        }
        if (G.i >= CFG.MAX_PULSES) {
          return this.endTarget(Math.abs(now - target) <= CFG.BAND ? 'locked' : 'short', `Out of pulses at ${now}%, target ${target}%.`);
        }
        const gap = target - now;
        const secs = r1(Math.max(CFG.PULSE_MIN_S, Math.min(CFG.PULSE_MAX_S, gap / G.rate * CFG.CREEP)));
        const [ok, why] = this.guards(secs, true);
        if (!ok) return this.endTarget('blocked', `Safety rules stopped it: ${why}.`);
        run.phase = 'pulsing';
        run.msg = `Pulse ${G.i + 1}: ${secs} s. Gap ${gap.toFixed(1)}%, learned ${G.rate.toFixed(2)} % per second.`;
        this.logAct('target_agent', `pulse ${G.i + 1}: ${secs}s for a ${gap.toFixed(1)}% gap`);
        this.logAct('executor', `pump A ${f0(secs)}s`);
        const n = this.boardEvents.length;
        this.tagNext = 'target';
        this.send(`P A ${Math.round(secs * 1000)}`);
        const ev = this.boardEvents.slice(n).find((e) => e.pot === 'A' && (e.type === 'pour_start' || e.type === 'refused'));
        if (!ev || ev.type === 'refused') return this.endTarget('blocked', `The chip didn't start the pump (${(ev && ev.why) || 'no answer'}). No water went in.`);
        const expect = G.rate * secs;
        G.pulse = { secs, before: now, expect, need: expect >= CFG.CHECKABLE ? Math.max(CFG.MISS_RISE, CFG.MISS_SHARE * expect) : 0, t1: null };
        G.state = 'settle';
        run.phase = 'settling';
        return;
      }
      if (G.state === 'settle') {
        const P = G.pulse;
        run.now = this.nowPct();
        if (P.t1 === null) { if (!this.board.pumping) P.t1 = this.t; return; }
        const waited = this.t - P.t1;
        const v = this.hist.slice(-20);
        let done = waited >= CFG.MAX_SETTLE_S;
        if (!done && waited >= CFG.MIN_SETTLE_S && v.length >= 20) {
          const a = median(v.slice(0, 10)), b = median(v.slice(10));
          done = Math.abs(b - a) < CFG.FLAT && b - P.before >= P.need;
        }
        if (!done) return;
        const after = this.nowPct(), rise = r1(after - P.before);
        this.soaks.push({ ts: this.t, pot: 'A', poured_s: P.secs, before_pct: P.before, peak_pct: after, rise_pct: rise, first_rise_s: null,
                          pct_per_s: r3(rise / P.secs), ok: rise >= Math.max(P.need, CFG.MISS_RISE), note: 'target pulse', by: 'target' });
        run.pulses.push({ s: P.secs, before: P.before, after, rise, wait_s: waited });
        G.i++;
        if (P.need && rise < P.need) {
          this.logAct('target_agent', `pulse ${G.i} moved the probe only ${rise}%: stopping`);
          return this.endTarget('fault', `The pump ran ${P.secs} s, that should add about ${(G.rate * P.secs).toFixed(1)}%, but the probe moved ${rise >= 0 ? '+' : ''}${rise.toFixed(1)}%. Water isn't reaching the soil: check the tube isn't pinched, the pump is under water, and the tube points at the pot.`);
        }
        if (rise >= CFG.MISS_RISE) G.rate = r3(0.5 * G.rate + 0.5 * rise / P.secs);
        run.rate = G.rate;
        this.logAct('target_agent', `pulse ${G.i}: +${rise}%, rate now ${G.rate}`);
        G.state = 'decide';
      }
    }
    endTarget(phase, msg) {
      const run = this.run;
      Object.assign(run, { phase, msg, now: this.nowPct(), t_end: this.t });
      this.logAct('target_agent', msg.slice(0, 90));
      const secs = r1(run.pulses.reduce((s, p) => s + p.s, 0));
      this.decisions.push({ ts: this.t, action: run.pulses.length ? 'water' : 'wait', seconds: secs, brain: 'target run', sentence: `TARGET: ${msg}`, kind: 'target' });
      this.PAUSED = false;
      run.secs = secs;
      run.ml = Math.round(secs * CFG.FLOW_ML_S);
      run.took_s = this.t - run.t0;
      this.tgt = null;
    }

    // ----- report.py -----
    // one-pot: box B is virtual (full TIMER_EVERY_S intervals x TIMER_POUR_MS at pot A's flow).
    // two-pot (ONE_POT=0): box B's water is its real pours, and its time in the healthy band is measured too.
    report() {
      const flow = CFG.FLOW_ML_S;
      const ml = (arr) => arr.reduce((s, p) => s + p.ran_ms / 1000 * flow, 0);
      const a = this.pours.filter((p) => p.pot === 'A'), b = this.pours.filter((p) => p.pot === 'B');
      const aiMl = ml(a);
      const demoMl = ml(a.filter((p) => p.by === 'manual' || p.by === 'target'));
      const span = this.t - 1;
      const n = this.onePot ? Math.floor(span / CFG.TIMER_EVERY_S) : b.length;
      const timerMl = this.onePot ? n * CFG.TIMER_POUR_MS / 1000 * flow : ml(b);
      const band = (key) => {
        const vals = this.history.map((h) => h[key]).filter((v) => v != null);
        return vals.length ? r1(100 * vals.filter((v) => v >= CFG.DRY_PCT && v <= CFG.WET_PCT).length / vals.length) : null;
      };
      return {
        hours_logged: r1(span / 3600), ai_pot_ml: Math.round(aiMl), timer_pot_ml: Math.round(timerMl), ai_pot_demo_ml: Math.round(demoMl),
        ai_pours: a.length, timer_pours: n,
        water_saved_pct: timerMl ? r1(100 * (timerMl - aiMl) / timerMl) : null,
        ai_pot_time_healthy_pct: band('a'), timer_pot_time_healthy_pct: this.onePot ? null : band('b'),
        timer_is_virtual: this.onePot,
        timer_schedule: `${CFG.TIMER_POUR_MS / 1000} s every ${CFG.TIMER_EVERY_S / 3600} h`,
        timer_ml_per_pour: Math.round(CFG.TIMER_POUR_MS / 1000 * flow),
        healthy_band: `${CFG.DRY_PCT}-${CFG.WET_PCT}%`,
      };
    }
    // server.py /api/series: the virtual timer's schedule (one-pot mode only), first reading + every TIMER_EVERY_S
    timerPours() {
      const out = [];
      if (!this.onePot) return out;
      for (let k = 1; 1 + k * CFG.TIMER_EVERY_S <= this.t; k++) out.push({ ts: 1 + k * CFG.TIMER_EVERY_S, s: CFG.TIMER_POUR_MS / 1000 });
      return out;
    }
  }

  window.FarmHandSim = { CFG, FarmHand, median };
})();
