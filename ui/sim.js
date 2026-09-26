/* Farm Hand virtual rig.
   Models the real build in PLAN.md (one pot, ESP32, soil + temp probe, relay + mini pump)
   and the laptop logic around it (watering call, safety guards, pour detector, Hit the Target,
   virtual timer). No DOM in here: app.js draws it. Every number is modeled, not measured.
   To go live later, replace SimBoard with something that speaks the same serial lines. */
(function () {
  'use strict';

  const CFG = {
    FLOW_ML_S: 20,          // mini pump, about 20 ml/s (PLAN §1)
    PCT_PER_ML: 0.04,       // 200 ml took the real box 44% -> 52% (PLAN §3)
    SOAK_TAU_S: 6,          // how fast surface water reaches the probe
    DRY_PCT_H: 0.8,         // moisture lost per hour at 26 °C and 50%
    FIELD_CAP: 75,          // above this the box drains out the bottom
    NOISE: 0.25,            // probe noise, %
    RAW_DRY: 3400, RAW_WET: 1507,  // calibration from bring-up (PLAN §3)
    POUR_MAX_S: 30,
    WATER_AT: 40, WET_AT: 70, AIM: 55,
    HEALTHY: [35, 70],
    AI_GAP_S: 30 * 60,
    DAILY_MAX_ML: 1500,
    CHECK_EVERY_S: 15 * 60,
    TIMER_EVERY_S: 6 * 3600,
    TIMER_POUR_S: 5,
    CUP_ML: 1500,
    HAND_CUP_ML: 236.6,
    START_PCT: 44,
    START_HOUR: 8,
    RATE0: 0.8,             // first guess, % per pump second (learned from each pour)
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const f1 = (x) => r1(x).toFixed(1);
  const signed = (x) => (x >= 0 ? '+' : '') + f1(x);
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

  class Soil {
    constructor(pct) { this.pct = pct; this.surfaceMl = 0; this.wetDepth = 0; }
    addWater(ml) { this.surfaceMl += ml; }
    step(dt, tempC) {
      const inf = this.surfaceMl * (1 - Math.exp(-dt / CFG.SOAK_TAU_S));
      this.surfaceMl -= inf;
      if (this.surfaceMl < 0.05) this.surfaceMl = 0;
      this.pct += inf * CFG.PCT_PER_ML;
      this.wetDepth = Math.min(1, this.wetDepth + inf / 400);
      const perHour = CFG.DRY_PCT_H * (1 + 0.07 * (tempC - 26)) * (this.pct / 50);
      this.pct -= perHour * dt / 3600;
      if (this.pct > CFG.FIELD_CAP) this.pct -= (this.pct - CFG.FIELD_CAP) * 0.002 * dt;
      this.pct = clamp(this.pct, 3, 98);
      this.wetDepth *= Math.exp(-dt / (3 * 3600));
    }
  }

  // The chip: takes "P A <ms>" / "X", runs the pump, caps pours at 30 s, prints JSON lines.
  class SimBoard {
    constructor(soil) {
      this.soil = soil;
      this.pumpLeft = 0; this.pumpMs = 0;
      this.pinched = false; this.cupMl = CFG.CUP_ML; this.online = true;
      this.out = [];
    }
    get pumping() { return this.pumpLeft > 0; }
    command(cmd) {
      const p = cmd.trim().split(/\s+/);
      if (p[0] === 'P') {
        if (this.pumpLeft > 0) return 'refused busy';
        const ms = clamp(parseInt(p[2], 10) || 0, 0, CFG.POUR_MAX_S * 1000);
        this.pumpLeft = ms / 1000; this.pumpMs = ms;
        return `ok P A ${ms}`;
      }
      if (p[0] === 'X') {
        const was = this.pumpLeft > 0;
        this.pumpLeft = 0;
        return was ? 'stopped' : 'ok idle';
      }
      return 'unknown';
    }
    step(dt) {
      if (this.pumpLeft <= 0) return;
      const run = Math.min(dt, this.pumpLeft);
      this.pumpLeft -= run;
      const out = this.pinched ? 0 : Math.min(run * CFG.FLOW_ML_S, this.cupMl);
      this.cupMl -= out;
      this.soil.addWater(out);
      if (this.pumpLeft <= 1e-9) {
        this.pumpLeft = 0;
        this.out.push(`{"type":"done","pot":"A","ms":${this.pumpMs}}`);
      }
    }
  }

  class FarmHand {
    constructor() { this.reset(); }

    reset() {
      const d = new Date(); d.setHours(CFG.START_HOUR, 0, 0, 0);
      this.t0 = d.getTime();
      this.t = 0;
      this.soil = new Soil(CFG.START_PCT);
      this.timerSoil = new Soil(CFG.START_PCT);
      this.board = new SimBoard(this.soil);
      this.readings = [];
      this.reading = null;
      this.history = [];
      this.pours = [];
      this.timerPours = [];
      this.serial = []; this.serialCount = 0;
      this.events = [];
      this.rate = CFG.RATE0;
      this.timerMl = 0;
      this.lastAiPourT = -Infinity;
      this.lastPumpEndT = -Infinity;
      this.lastCheckT = 5 - CFG.CHECK_EVERY_S;   // first check 5 s in
      this.lastHandT = -Infinity; this.handPending = null;
      this.soak = null; this.target = null; this.lastTarget = null;
      this.pumpFault = null;
      this.call = null;
      this.setWeather();
    }

    setWeather() {
      const hour = (CFG.START_HOUR + this.t / 3600) % 24;
      const wave = Math.sin(2 * Math.PI * (hour - 9) / 24);
      this.tempC = 26.5 + 3 * wave;
      this.airC = this.tempC + 1.2 + 2 * wave;
    }

    now() { return r1(median(this.readings.slice(-6))); }

    log(dir, text) {
      this.serial.push({ t: this.t, dir, text });
      if (this.serial.length > 120) this.serial.shift();
      this.serialCount++;
    }

    event(type, data) {
      this.events.push(Object.assign({ type, t: this.t }, data));
      if (this.events.length > 300) this.events.shift();
    }

    step() {
      const t = ++this.t;
      this.setWeather();
      const wasPumping = this.board.pumping;
      this.board.step(1);
      if (wasPumping && !this.board.pumping) this.lastPumpEndT = t;
      this.soil.step(1, this.tempC);
      this.timerSoil.step(1, this.tempC);

      if (t % CFG.TIMER_EVERY_S === 0) {          // the virtual timer pot
        const ml = CFG.TIMER_POUR_S * CFG.FLOW_ML_S;
        this.timerSoil.addWater(ml);
        this.timerMl += ml;
        this.timerPours.push({ t, ml });
      }

      const pct = clamp(this.soil.pct + gauss() * CFG.NOISE, 0, 100);
      const raw = Math.round(CFG.RAW_DRY - pct / 100 * (CFG.RAW_DRY - CFG.RAW_WET));
      const temp = this.tempC + gauss() * 0.05;
      this.readings.push(pct);
      if (this.readings.length > 400) this.readings.shift();
      this.reading = { pct, raw, temp, pumping: this.board.pumping };
      for (const line of this.board.out) this.log('<', line);
      this.board.out.length = 0;
      this.log('<', `{"type":"reading","a_raw":${raw},"a_pct":${f1(pct)},"temp_c":${temp.toFixed(2)},"pumping":${this.board.pumping}}`);

      this.soakStep();
      this.handStep();
      this.targetStep();
      if (!this.target && t - this.lastCheckT >= CFG.CHECK_EVERY_S) this.check('auto');

      if (t % 10 === 0) {
        this.history.push({ t, m: this.now(), timer: this.timerSoil.pct, temp: this.tempC });
        if (this.history.length > 80000) this.history.shift();
      }
    }

    fastForward(sec) { for (let i = 0; i < sec; i++) this.step(); }

    used24() {
      let ml = 0;
      for (let i = this.pours.length - 1; i >= 0 && this.t - this.pours[i].t < 86400; i--) ml += this.pours[i].ml;
      return ml;
    }

    // Code-level safety rules. The AI asks, these decide (PLAN §5).
    guards(sec, byPerson) {
      const ml = sec * CFG.FLOW_ML_S, used = this.used24(), m = this.now();
      const minsAgo = (this.t - this.lastAiPourT) / 60;
      return [
        { name: 'Board online', ok: this.board.online, why: 'the board is offline' },
        { name: 'Not already wet', ok: m < CFG.WET_AT, why: `soil is ${f1(m)}%, the wet line is ${CFG.WET_AT}%` },
        { name: '30 min between AI pours', ok: byPerson || minsAgo >= 30, skipped: byPerson,
          why: `watered ${Math.round(minsAgo)} min ago, rule is 30 min` },
        { name: '1,500 ml a day', ok: used + ml <= CFG.DAILY_MAX_ML,
          why: `${Math.round(used)} ml used in the last 24 h, this pour would pass ${CFG.DAILY_MAX_ML} ml` },
        { name: 'Last pour done soaking', ok: !this.soak && !this.board.pumping, why: 'the last pour is still soaking in' },
        { name: '30 s max per pour', ok: sec <= CFG.POUR_MAX_S, why: `${sec} s is over the 30 s cap` },
      ];
    }

    // The watering call. Stands in for Laya (fast) + the Gemini team (explains).
    check(kind) {
      this.lastCheckT = this.t;
      const m = this.now(), rate = this.rate;
      const c = { t: this.t, kind, m, act: 'wait', sec: 0, why: '', guards: null };
      if (this.pumpFault) {
        c.why = `${this.pumpFault} I won't water until someone checks the pump.`;
      } else if (m >= CFG.WET_AT) {
        c.why = `Soil is at ${f1(m)}%, already wet. More water would just drain out the bottom.`;
      } else if (m > CFG.WATER_AT) {
        c.why = `Pot A's soil moisture is ${f1(m)}%, so it doesn't need water yet.`;
      } else {
        c.act = 'water';
        c.sec = r1(clamp((CFG.AIM - m) / rate, 3, CFG.POUR_MAX_S));
        c.why = `Soil is at ${f1(m)}%, under the ${CFG.WATER_AT}% line. At the learned ${rate.toFixed(2)}% per pump second, ${c.sec} s should bring it near ${CFG.AIM}%.`;
      }
      c.sure = 0.8 + 0.19 * Math.min(1, Math.abs(m - CFG.WATER_AT) / 15);
      c.layaMs = Math.round(180 + Math.random() * 260);
      c.teamS = Math.round(18 + Math.random() * 25);
      if (c.act === 'water') {
        c.guards = this.guards(c.sec, false);
        const bad = c.guards.find((g) => !g.ok);
        if (bad) {
          c.act = 'blocked';
          c.why += ` Blocked: ${bad.why}.`;
        } else {
          this.pour(c.sec, 'ai');
          this.lastAiPourT = this.t;
        }
      }
      this.call = c;
      this.event('check', { call: c });
      return c;
    }

    pour(sec, who) {
      const ms = Math.round(sec * 1000);
      this.log('>', `P A ${ms}`);
      const reply = this.board.command(`P A ${ms}`);
      this.log('<', reply);
      if (!reply.startsWith('ok')) return null;
      const p = {
        t: this.t, who, sec: ms / 1000, ml: ms / 1000 * CFG.FLOW_ML_S,
        before: this.now(), expected: ms / 1000 * this.rate, status: 'pumping',
      };
      this.pours.push(p);
      this.soak = { pour: p, reached: null };
      this.event('pour', { pour: p });
      return p;
    }

    testPour() {
      const bad = this.guards(5, true).find((g) => !g.ok);
      if (bad) return `Blocked: ${bad.why}.`;
      return this.pour(5, 'test') ? null : 'The chip refused the pour.';
    }

    stop() {
      const left = this.board.pumpLeft;
      this.log('>', 'X');
      this.log('<', this.board.command('X'));
      if (left > 0) {
        const p = this.pours[this.pours.length - 1];
        p.sec = r1(p.sec - left);
        p.ml = p.sec * CFG.FLOW_ML_S;
        p.expected = p.sec * this.rate;
        this.lastPumpEndT = this.t;
      }
      if (this.target) this.endTarget('stopped', 'Stopped by hand.');
    }

    // Pour detector (soak.py): what each pour really did, and learn % per second from it.
    soakStep() {
      const s = this.soak;
      if (!s) return;
      const p = s.pour;
      if (s.reached == null && this.now() >= p.before + 1) s.reached = this.t - p.t;
      if (this.board.pumping) return;
      const since = this.t - (p.t + Math.ceil(p.sec));
      if (since < 20) return;
      const r = this.readings;
      const a = median(r.slice(-6)), b = median(r.slice(-12, -6));
      if (Math.abs(a - b) > 0.25 && since < 90) return;
      p.after = r1(a);
      p.delta = r1(a - p.before);
      p.reachS = s.reached;
      p.failed = p.expected >= 3 && p.delta < 0.3 * p.expected;
      if (p.failed) {
        p.status = 'failed';
        this.pumpFault = `The pump ran ${p.sec.toFixed(1)} s, that should add about ${f1(p.expected)}%, but the probe moved ${signed(p.delta)}%. Water isn't reaching the soil.`;
        this.event('fault', { msg: this.pumpFault });
      } else {
        p.status = 'ok';
        if (p.delta > 0.5 && p.sec >= 1) {
          p.learned = p.delta / p.sec;
          this.rate = clamp(0.5 * this.rate + 0.5 * p.learned, 0.1, 3);
        }
        this.pumpFault = null;
      }
      p.rateAfter = this.rate;
      this.soak = null;
      this.event('soaked', { pour: p });
      if (this.target && this.target.waiting) {
        const T = this.target;
        T.waiting = false;
        // Small pulses can't be judged one by one, so add them up while they keep missing.
        T.sumExp = (T.sumExp || 0) + p.expected;
        T.sumDelta = (T.sumDelta || 0) + p.delta;
        if (p.delta >= 0.5 * p.expected) { T.sumExp = 0; T.sumDelta = 0; }
        if (p.failed) this.endTarget('fault', this.pumpFault);
        else if (T.sumExp >= 3 && T.sumDelta < 0.3 * T.sumExp) {
          this.pumpFault = `The pump ran ${T.pulses.length} pulses that should add about ${f1(T.sumExp)}%, but the probe moved ${signed(T.sumDelta)}%. Water isn't reaching the soil.`;
          this.event('fault', { msg: this.pumpFault });
          this.endTarget('fault', this.pumpFault);
        }
      }
    }

    // Someone added water: +4% with the pump quiet for 4 min.
    handStep() {
      const r = this.readings;
      if (this.handPending) {
        if (this.t - this.handPending.t < 30) return;
        const m = this.now(), jump = m - this.handPending.before;
        this.handPending = null;
        const msg = m > CFG.WATER_AT
          ? `Someone just added water. ${signed(jump)}%. Soil's at ${f1(m)}% now, so I'm skipping my next watering.`
          : `Someone just added water. ${signed(jump)}%. Soil's at ${f1(m)}% now, so my next pour will be smaller.`;
        this.event('hand', { msg });
        return;
      }
      if (this.board.pumping || this.soak || r.length < 70) return;
      if (this.t - this.lastPumpEndT < 240 || this.t - this.lastHandT < 600) return;
      const before = median(r.slice(-66, -60));
      if (median(r.slice(-6)) - before >= 4) {
        this.lastHandT = this.t;
        this.handPending = { t: this.t, before };
      }
    }

    handPour(ml) { this.soil.addWater(ml || CFG.HAND_CUP_ML); }
    setPinched(on) { this.board.pinched = on; if (!on) this.pumpFault = null; }
    refill() { this.board.cupMl = CFG.CUP_ML; this.pumpFault = null; }

    // Hit the Target (target.py): pulse up to a picked % and stop on it.
    startTarget(pct) {
      if (this.target) return 'A target run is already going.';
      pct = clamp(Math.round(pct), 36, 68);
      this.target = { pct, t0: this.t, start: this.now(), pulses: [], waiting: false, state: 'running' };
      this.event('target', { target: this.target });
      return null;
    }

    targetStep() {
      const T = this.target;
      if (!T || T.waiting) return;
      const m = this.now();
      if (!T.pulses.length && m > T.pct + 1) return this.endTarget('over', `Soil is already at ${f1(m)}%. It can't take water back out.`);
      if (m >= T.pct - 1) {
        return m > T.pct + 1
          ? this.endTarget('over', 'The last pulse overshot.')
          : this.endTarget('locked', '');
      }
      if (T.pulses.length >= 10) return this.endTarget('gave up', 'Ten pulses and still short.');
      const sec = r1(clamp((T.pct - m) / this.rate * 0.7, 1, 8));
      const bad = this.guards(sec, true).find((g) => !g.ok);
      if (bad) {
        if (bad.name === 'Last pour done soaking') return;   // wait for it
        return this.endTarget('blocked', `Blocked: ${bad.why}.`);
      }
      const p = this.pour(sec, 'target');
      if (!p) return this.endTarget('refused', 'The chip refused the pour.');
      T.pulses.push(p);
      T.waiting = true;
    }

    endTarget(state, msg) {
      const T = this.target;
      T.state = state; T.msg = msg; T.end = this.now(); T.t1 = this.t;
      T.pumpS = r1(T.pulses.reduce((s, p) => s + p.sec, 0));
      T.ml = Math.round(T.pulses.reduce((s, p) => s + p.ml, 0));
      this.target = null;
      this.lastTarget = T;
      this.event('target', { target: T });
    }

    stats() {
      const m = this.now();
      const perH = CFG.DRY_PCT_H * (1 + 0.07 * (this.tempC - 26)) * (m / 50);
      const n = Math.floor(this.t / CFG.TIMER_EVERY_S);
      const until = n * CFG.TIMER_EVERY_S;
      let aiMl = 0, aiMlAll = 0;
      for (const p of this.pours) { aiMlAll += p.ml; if (p.t <= until) aiMl += p.ml; }
      return {
        m, temp: this.tempC, air: this.airC,
        driesInH: m > CFG.HEALTHY[0] ? (m - CFG.HEALTHY[0]) / perH : 0,
        fullIntervals: n, aiMl, aiMlAll, timerMl: this.timerMl,
        saved: n ? this.timerMl - aiMl : null,
        used24: this.used24(), cupMl: this.board.cupMl, rate: this.rate,
      };
    }
  }

  window.FarmHandSim = { CFG, FarmHand, median };
})();
