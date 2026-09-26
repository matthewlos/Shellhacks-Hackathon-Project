/* Farm Hand UI: runs the virtual rig (sim.js) and draws it. Plain JS, no build step.
   It reads the sim the way laptop/static/index.html reads server.py (/api/live, /api/state, /api/series). */
(function () {
  'use strict';
  const { CFG, FarmHand } = window.FarmHandSim;
  const fh = new FarmHand({ onePot: true });   // this page shows the one-pot virtual timer (PLAN 5b); ui-mui has the two-box view (5e)
  const $ = (id) => document.getElementById(id);
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const clockFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  const at = (t) => new Date(fh.t0 + t * 1000);
  const hhmm = (t) => timeFmt.format(at(t));
  const dayOf = (t) => Math.floor((CFG.START_HOUR * 3600 + t) / 86400) + 1;
  const ago = (s) => s < 60 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
  const PICK = { water: 'Water', wait_rain: 'Wait for rain', wait_moist: 'Wait, soil has water' };
  const BY = { laptop: 'AI', manual: 'test', target: 'target', timer: 'timer' };

  // ---------- speed + loop ----------
  let speed = 1, paused = false, acc = 0, last = performance.now();
  document.querySelectorAll('#speed button').forEach((b) => b.addEventListener('click', () => {
    speed = +b.dataset.speed;
    document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('pause').addEventListener('click', () => {
    paused = !paused;
    $('pause').textContent = paused ? 'Resume' : 'Pause';
  });
  $('skip').addEventListener('click', () => { fh.fastForward(6 * 3600); chartDirty = true; });

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += dt * speed;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0) fh.step();
    }
    render(now);
    requestAnimationFrame(frame);
  }

  // ---------- controls (the same buttons as the real dashboard) ----------
  const say = (msg) => { $('actionMsg').textContent = msg || ''; };
  $('runAgents').addEventListener('click', () => say(fh.checkNow('button') ? '' : 'The agents are already working.'));
  $('testPour').addEventListener('click', () => {
    const r = fh.testPour(5);
    say(r.watered ? '' : `Refused: ${r.refused_because}.`);
  });
  $('stop').addEventListener('click', () => { fh.stop(); say(''); });
  document.querySelectorAll('#brain button').forEach((b) => b.addEventListener('click', () => {
    fh.brainMode = b.dataset.brain;
    document.querySelectorAll('#brain button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  const T_LO = CFG.DRY_PCT, T_HI = CFG.WET_PCT - CFG.BAND;
  let tVal = CFG.TARGET_PCT;
  const setT = (v) => { tVal = clamp(v, T_LO, T_HI); $('tVal').textContent = tVal + '%'; };
  $('tMinus').addEventListener('click', () => setT(tVal - 1));
  $('tPlus').addEventListener('click', () => setT(tVal + 1));
  $('tGo').addEventListener('click', () => { const r = fh.startTarget(tVal); say(r.ok ? '' : r.why); });

  $('pinch').addEventListener('click', () => {
    const on = fh.demoPinch();
    $('pinch').setAttribute('aria-pressed', String(on));
    $('pinch').textContent = on ? 'Let go of the tube' : 'Pinch the tube';
  });
  $('hand').addEventListener('click', () => fh.demoHandPour());
  $('dry').addEventListener('click', () => fh.demoDry());
  $('refill').addEventListener('click', () => fh.refill());

  document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabbar button').forEach((x) => x.classList.toggle('on', x === b));
    for (const id of ['team', 'pours', 'serial']) $('tab-' + id).hidden = id !== b.dataset.tab;
    serialSeen = -1; poursSeen = -1;
  }));

  let win = 1, chartDirty = true;
  document.querySelectorAll('#win button').forEach((b) => b.addEventListener('click', () => {
    win = b.dataset.win === 'all' ? 'all' : +b.dataset.win;
    document.querySelectorAll('#win button').forEach((x) => x.classList.toggle('on', x === b));
    chartDirty = true;
  }));

  // ---------- banner: someone added water (soak.hand) / a pour that didn't arrive ----------
  let bannerKey = null, bannerClosed = null;
  $('bannerClose').addEventListener('click', () => { bannerClosed = bannerKey; $('banner').hidden = true; });
  function renderBanner() {
    let key = null, msg = '', bad = false;
    const h = fh.hand;
    if (h.phase === 'seen' && fh.t - h.ts < 90) {
      key = 'hand' + h.ts;
      msg = h.now > CFG.DRY_PCT + CFG.LOW_MARGIN
        ? `Someone just added water. +${f1(h.rise)}%. Soil's at ${f1(h.now)}% now, so I'm skipping my next watering.`
        : `Someone just added water. +${f1(h.rise)}%. Soil's at ${f1(h.now)}% now, so my next pour will be smaller.`;
    } else {
      const s = fh.soaks[fh.soaks.length - 1];
      if (s && !s.ok && s.note !== 'target pulse' && fh.t - s.ts < 600) { key = 'soak' + s.ts; bad = true; msg = `A ${s.poured_s} s pour moved the probe ${s.rise_pct >= 0 ? '+' : ''}${f1(s.rise_pct)}%: ${s.note}.`; }
    }
    bannerKey = key;
    const show = !!key && key !== bannerClosed;
    $('banner').hidden = !show;
    if (show) { $('bannerText').textContent = msg; $('banner').classList.toggle('bad', bad); }
  }

  // ---------- agent team: lights from the activity log, like /api/live "busy" ----------
  const nodes = {};
  document.querySelectorAll('#agents li[data-node]').forEach((li) => { nodes[li.dataset.node] = li; });
  function renderAgents() {
    const busy = {}, blocked = {};
    for (const a of fh.activity) {
      if (fh.t - a.ts >= 6) continue;
      busy[a.agent] = true;
      if (a.what.startsWith('REFUSED') || a.what.startsWith('sent back')) blocked[a.agent] = true;
    }
    if (fh.team) for (const s of fh.team.plan.slice(0, fh.team.i).slice(-1)) s.agents.forEach((a) => { busy[a] = true; });
    if (fh.live.phase === 'soaking') busy.soak = true;
    if (fh.tgt) busy.target_agent = true;
    for (const k in nodes) {
      const sub = nodes[k].classList.contains('sub') ? 'sub ' : '';
      nodes[k].className = sub + (blocked[k] ? 'blocked' : busy[k] ? 'work' : '');
    }
  }
  let actSeen = -1;
  function renderSteps() {
    const n = fh.activity.length ? fh.activity[fh.activity.length - 1].ts * 1000 + fh.activity.length : 0;
    if (n === actSeen) return;
    actSeen = n;
    const ol = $('steps');
    ol.innerHTML = '';
    for (const a of fh.activity.slice(-40).reverse()) {
      const li = document.createElement('li');
      if (a.what.startsWith('REFUSED') || a.what.startsWith('sent back')) li.className = 'bad';
      li.innerHTML = `<time>${hhmm(a.ts)}</time>`;
      li.append(`${a.agent}: ${a.what}`);
      ol.append(li);
    }
  }
  function renderGuards() {
    const ul = $('guardList');
    ul.innerHTML = '';
    for (const g of fh.guardReport()) {
      const li = document.createElement('li');
      li.className = g.ok ? 'ok' : 'no';
      li.append(g.rule);
      const d = document.createElement('span');
      d.textContent = g.detail;
      li.append(d);
      ul.append(li);
    }
  }

  // ---------- render ----------
  const DRY = [201, 180, 152], WET = [58, 41, 30];
  const mix = (k) => `rgb(${DRY.map((v, i) => Math.round(v + (WET[i] - v) * k)).join(',')})`;
  const rig = $('rig');
  let lastStageT = -1, serialSeen = -1, poursSeen = -1, lastChartDraw = 0;

  function render(now) {
    $('clock').textContent = `Day ${dayOf(fh.t)} · ${clockFmt.format(at(fh.t))}`;
    const b = fh.board, w = fh.world, L = fh.latest;
    rig.classList.toggle('pumping', b.pumping);
    rig.classList.toggle('flowing', !w.pinched && w.cupMl > 0);
    rig.classList.toggle('pinched', w.pinched);

    if (fh.t !== lastStageT && L) {
      lastStageT = fh.t;
      const m = fh.nowPct();
      $('soil').setAttribute('fill', mix(clamp((m - 20) / 55, 0, 1)));
      $('wetBand').setAttribute('height', String(Math.round(w.wetDepth * 150)));
      $('wetBand').setAttribute('opacity', String(0.25 + 0.75 * w.wetDepth));
      $('puddle').setAttribute('rx', String(Math.min(90, w.soaking * 6)));
      const h = Math.round(w.cupMl / CFG.PUMP_CUP_ML * 110);
      $('cupWater').setAttribute('y', String(382 - h));
      $('cupWater').setAttribute('height', String(h));
      $('cupText').textContent = w.cupMl > 0 ? `${Math.round(w.cupMl)} ml in cup` : 'cup is empty';
      $('cupText').setAttribute('class', 'svg-label ' + (w.cupMl > 0 ? 'dim' : 'empty'));
      $('probeLed').setAttribute('fill', b.pumping ? '#2f7de1' : m < CFG.DRY_PCT ? '#e0453a' : '#2fbf6a');
      $('probeText').textContent = f1(L.a_pct) + '%';
      $('tempText').textContent = f1(L.temp_c) + '°C';
      $('espLed').setAttribute('opacity', fh.t % 2 ? '1' : '.25');

      const soil = fh.getSoil();
      $('nMoist').textContent = f1(L.a_pct) + '%';
      $('nPin').style.left = `calc(${clamp(L.a_pct, 0, 100)}% - 1px)`;
      $('nTemp').textContent = f1(L.temp_c) + '°C';
      $('nAir').textContent = 'pot is indoors, rain ignored';
      $('nDry').textContent = soil.hours_until_dry > 0 ? f1(soil.hours_until_dry) + ' h' : 'dry now';
      $('nUsed').textContent = Math.round(fh.mlToday()) + ' ml';
      $('nRate').textContent = fh.learnedPctPerS().toFixed(2) + ' %/s';
      const rep = fh.report();
      $('nHealthy').textContent = rep.ai_pot_time_healthy_pct == null ? '–' : rep.ai_pot_time_healthy_pct + '%';
      renderSaved(rep);
      renderTarget();
      renderGuards();
      renderBanner();
    }
    renderCall();
    renderAgents();
    renderSteps();
    if (!$('tab-pours').hidden && poursSeen !== fh.soaks.length + fh.pours.length) renderPours();
    if (!$('tab-serial').hidden && serialSeen !== fh.serialCount) renderSerial();
    if (chartDirty || now - lastChartDraw > 250) { drawChart(); lastChartDraw = now; chartDirty = false; }
    $('tGo').disabled = !!fh.tgt;
    $('runAgents').disabled = !!fh.team;
  }

  function renderCall() {
    const d = fh.decisions[fh.decisions.length - 1];
    const run = fh.run;
    if (fh.tgt) {
      $('callTitle').textContent = `Hitting ${run.target}%`;
      $('callTitle').className = 'water';
      $('callWhy').textContent = run.msg;
      $('callMeta').textContent = 'target run, started by a person';
    } else if (!d) {
      $('callTitle').textContent = 'Waiting';
      $('callTitle').className = '';
      $('callWhy').textContent = 'The first check runs 20 s after start, then every 15 min. Or press Run agents.';
      $('callMeta').textContent = '';
    } else {
      const water = d.action === 'water';
      $('callTitle').textContent = d.brain === 'target run' ? (run.phase === 'locked' ? `Hit ${f1(run.now)}%` : 'Target run ended')
        : water ? `Watering ${Math.round(d.seconds)} s` : 'Holding off';
      $('callTitle').className = water ? 'water' : d.brain === 'target run' && run.phase !== 'locked' ? 'blocked' : '';
      $('callWhy').textContent = d.sentence.replace(/^(WATER|WAIT|TARGET):\s*/, '');
      $('callMeta').textContent = `${d.brain}, ${ago(fh.t - d.ts)}`;
    }

    const la = fh.LAST.laya, ck = fh.LAST.check;
    if (la) {
      $('layaLine').textContent = `Laya: ${PICK[la.pick] || la.pick}`;
      $('layaSure').textContent = `${Math.round(la.sure * 100)}% sure, ${ago(fh.t - la.ts)} · simulated`;
      $('layaMs').textContent = la.ms;
    }
    const row = $('teamLine').closest('.srow');
    if (fh.team) {
      row.classList.add('thinking');
      $('teamLine').textContent = 'Gemini team thinking…';
      $('teamSub').textContent = 'gather in parallel, then planner ⇄ critic · simulated';
      $('teamS').textContent = String(fh.t - fh.team.t0);
    } else {
      row.classList.remove('thinking');
      if (ck && ck.t1 != null && ck.brain.startsWith('gemini')) {
        $('teamLine').textContent = 'Gemini team explained';
        $('teamSub').textContent = 'the reason above, checked by the critic · simulated';
        $('teamS').textContent = String(ck.t1 - ck.t0);
      } else if (ck && ck.t1 != null) {
        $('teamLine').textContent = 'Gemini team off';
        $('teamSub').textContent = `${ck.brain} decided`;
        $('teamS').textContent = '–';
      }
    }
  }

  function renderTarget() {
    const run = fh.run, ro = $('readout');
    if (run.phase === 'idle' || (!fh.tgt && fh.t - run.t_end > 180)) { ro.hidden = true; }
    else {
      ro.hidden = false;
      const live = !!fh.tgt, now = run.now == null ? fh.nowPct() : run.now;
      $('roNow').textContent = f1(now) + '%';
      $('roTgt').textContent = run.target + '%';
      const lo = 30, hi = 75;
      $('roFill').style.width = clamp((now - lo) / (hi - lo) * 100, 0, 100) + '%';
      $('roMark').style.left = ((run.target - lo) / (hi - lo) * 100) + '%';
      ro.className = 'readout' + (live ? '' : run.phase === 'locked' ? ' locked' : ' failed');
      $('roState').textContent = live
        ? (run.phase === 'pulsing' || fh.board.pumping ? `Pulse ${run.pulses.length + 1}: pumping` : `Pulse ${run.pulses.length + 1}: waiting for it to settle`)
        : run.phase === 'locked' ? `Locked at ${f1(now)}%` : `Stopped: ${run.phase}`;
    }
    const pulses = $('pulses');
    pulses.innerHTML = '';
    for (const p of run.pulses || []) {
      const el = document.createElement('span');
      el.className = 'pulse' + (run.phase === 'fault' && p === run.pulses[run.pulses.length - 1] ? ' bad' : '');
      el.textContent = `${p.s} s ${p.rise >= 0 ? '+' : ''}${f1(p.rise)}%`;
      pulses.append(el);
    }
    if (fh.tgt && fh.tgt.state === 'settle') {
      const el = document.createElement('span');
      el.className = 'pulse';
      el.textContent = `${fh.tgt.pulse.secs} s …`;
      pulses.append(el);
    }
    const rc = $('receipt');
    if (fh.tgt || run.phase === 'idle') { rc.textContent = ''; return; }
    rc.className = 'receipt ' + (run.phase === 'locked' ? 'good' : 'bad');
    rc.textContent = `${run.msg} ${run.pulses.length} pulses · ${run.secs} s pumping · ${run.ml} ml · ${run.took_s} s`;
  }

  // views.js drawCups
  function renderSaved(r) {
    const big = $('svBig');
    $('svHow').textContent = `timer = ${r.timer_schedule}, ${r.timer_ml_per_pour} ml a pour`;
    if (!r.timer_pours) {
      $('svLabel').textContent = 'Water saved vs a timer';
      big.textContent = 'Too early';
      big.className = 'mono early';
      $('svSub').textContent = `a timer hasn't poured yet in ${r.hours_logged} h. AI used ${r.ai_pot_ml} ml`;
      return;
    }
    const saved = r.timer_pot_ml - r.ai_pot_ml, cups = Math.abs(saved) / CFG.CUP_ML;
    $('svLabel').textContent = saved >= 0 ? 'Water saved vs a timer' : 'Timer used less so far';
    big.className = 'mono ' + (saved >= 0 ? 'good' : 'bad');
    big.innerHTML = `${saved >= 0 ? '' : '−'}${cups.toFixed(cups < 10 ? 1 : 0)}<small style="font-size:16px"> ${cups >= 0.95 && cups < 1.05 ? 'cup' : 'cups'}</small>`;
    $('svSub').textContent = `AI ${r.ai_pot_ml} ml vs timer ${r.timer_pot_ml} ml` + (r.ai_pot_demo_ml ? `. ${r.ai_pot_demo_ml} ml of the AI's was test pours and demos` : '');
  }

  function renderPours() {
    poursSeen = fh.soaks.length + fh.pours.length;
    const tb = $('pourRows');
    const rows = fh.soaks.slice(-30).reverse();
    if (!rows.length && !fh.watch) { tb.innerHTML = '<tr><td colspan="6" class="dim">No pours yet.</td></tr>'; return; }
    tb.innerHTML = '';
    const add = (cells, bad) => {
      const tr = document.createElement('tr');
      cells.forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (bad && i >= 3) td.className = 'bad'; tr.append(td); });
      tb.append(tr);
    };
    if (fh.watch) add([hhmm(fh.watch.t0), BY[fh.watch.by] || fh.watch.by, `${fh.watch.poured_s} s`, 'soaking…', '', ''], false);
    for (const s of rows) {
      add([hhmm(s.ts), s.note === 'target pulse' ? 'target' : (BY[s.by] || s.by), `${s.poured_s} s · ${Math.round(s.poured_s * CFG.FLOW_ML_S)} ml`,
           `${f1(s.before_pct)}→${f1(s.peak_pct)}%`, `${s.rise_pct >= 0 ? '+' : ''}${f1(s.rise_pct)}%${s.ok ? '' : ' ✕'}`,
           s.pct_per_s == null ? '–' : s.pct_per_s.toFixed(2)], !s.ok);
    }
  }

  function renderSerial() {
    serialSeen = fh.serialCount;
    const pre = $('serial');
    const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 20;
    pre.textContent = fh.serial.slice(-80).map((l) => `${clockFmt.format(at(l.t))} ${l.dir} ${l.text}`).join('\n');
    if (stick) pre.scrollTop = pre.scrollHeight;
  }

  // ---------- chart (views.js: the money graph) ----------
  const cv = $('chart'), ctx = cv.getContext('2d');
  let hoverX = null;
  cv.addEventListener('mousemove', (e) => { hoverX = e.offsetX; chartDirty = true; });
  cv.addEventListener('mouseleave', () => { hoverX = null; $('tip').hidden = true; chartDirty = true; });

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  const COL = { ai: css('--ai'), timer: css('--timer'), temp: css('--temp'), muted: css('--muted'), line: css('--line') };

  function firstIndex(arr, t) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // views.js ghost(): the measured line, minus what the AI's own pours added, plus what the timer's pours would have
  // added, at the learned %/s, ramped in over 30 s. Test pours and target demos stay in.
  function ghostFn() {
    const rate = fh.learnedPctPerS();
    const ai = fh.pours.filter((p) => p.pot === 'A' && p.by === 'laptop').map((p) => [p.ts - p.ran_ms / 1000, p.ran_ms / 1000 * rate]);
    const tm = fh.timerPours().map((p) => [p.ts, p.s * rate]);
    return (ts, m) => {
      let g = m;
      for (const [t0, rise] of ai) if (t0 <= ts) g -= rise * clamp((ts - t0) / 30, 0, 1);
      for (const [t0, rise] of tm) if (t0 <= ts) g += rise * clamp((ts - t0) / 30, 0, 1);
      return clamp(g, 0, 100);
    };
  }

  function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const Lp = 34, R = 8, top = 6, axisH = 18;
    const plotW = W - Lp - R;
    const mH = Math.round((H - axisH - top) * 0.66), gap = 22;
    const tTop = top + mH + gap, tH = H - axisH - tTop;
    const span = win === 'all' ? Math.max(3600, fh.t) : win * 3600;
    const tEnd = win === 'all' ? Math.max(3600, fh.t) : Math.max(span, fh.t);
    const tStart = tEnd - span;
    const X = (t) => Lp + (t - tStart) / span * plotW;

    const hist = fh.history;
    const i0 = firstIndex(hist, tStart);
    const stride = Math.max(1, Math.floor((hist.length - i0) / (plotW * 1.5)));
    const ghost = ghostFn();
    const pts = [];
    for (let i = i0; i < hist.length; i += stride) pts.push(hist[i]);
    if (hist.length && pts[pts.length - 1] !== hist[hist.length - 1]) pts.push(hist[hist.length - 1]);
    const G = pts.map((p) => ghost(p.t, p.a));

    let mlo = 25, mhi = 75, tlo = Infinity, thi = -Infinity;
    pts.forEach((p, i) => { mlo = Math.min(mlo, p.a - 3, G[i] - 3); mhi = Math.max(mhi, p.a + 3, G[i] + 3); tlo = Math.min(tlo, p.temp); thi = Math.max(thi, p.temp); });
    if (!pts.length) { tlo = 22; thi = 32; }
    tlo = Math.floor(tlo - 1); thi = Math.ceil(thi + 1);
    const YM = (v) => top + (1 - (v - mlo) / (mhi - mlo)) * mH;
    const YT = (v) => tTop + (1 - (v - tlo) / (thi - tlo)) * tH;

    ctx.fillStyle = 'rgba(31,138,76,.08)';
    ctx.fillRect(Lp, YM(CFG.WET_PCT), plotW, YM(CFG.DRY_PCT) - YM(CFG.WET_PCT));
    ctx.font = '11px ' + css('--mono');
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.muted;
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    for (const v of [25, 50, 75]) {
      if (v < mlo || v > mhi) continue;
      ctx.beginPath(); ctx.moveTo(Lp, YM(v) + .5); ctx.lineTo(W - R, YM(v) + .5); ctx.stroke();
      ctx.fillText(v + '%', 0, YM(v));
    }
    ctx.fillText(tlo + '°', 0, YT(tlo) - 4);
    ctx.fillText(thi + '°', 0, YT(thi) + 4);
    ctx.fillStyle = '#1f8a4c';
    ctx.textAlign = 'right';
    ctx.fillText('healthy', W - R - 4, YM(CFG.WET_PCT) + 9);
    ctx.textAlign = 'left';
    if (pts.length < 2) {
      ctx.fillStyle = COL.muted; ctx.textAlign = 'center';
      ctx.fillText('Waiting for readings. The line starts after a few seconds of data.', Lp + plotW / 2, top + mH / 2);
      ctx.textAlign = 'left';
    }

    const line = (vals, Y, color, dash) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(vals[i])) : ctx.moveTo(X(p.t), Y(vals[i]))));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.stroke(); ctx.setLineDash([]);
    };
    line(G, YM, COL.timer, [5, 4]);
    line(pts.map((p) => p.a), YM, COL.ai);
    line(pts.map((p) => p.temp), YT, COL.temp);

    // pours: AI = blue dot, test/target = grey ring, on the bottom edge; timer = orange dot on the ghost line
    const dot = (x, y, fill, stroke) => { ctx.beginPath(); ctx.arc(x, y, 3.8, 0, 7); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); } };
    for (const p of fh.pours) if (p.ts >= tStart) dot(X(p.ts), top + mH - 3, p.by === 'laptop' ? COL.ai : '#fff', p.by === 'laptop' ? null : COL.muted);
    for (const p of fh.timerPours()) if (p.ts >= tStart) { const i = Math.min(hist.length - 1, firstIndex(hist, p.ts + 30)); if (i >= 0 && hist[i]) dot(X(p.ts), YM(ghost(hist[i].t, hist[i].a)), COL.timer); }

    ctx.fillStyle = COL.muted;
    ctx.textBaseline = 'alphabetic';
    for (let k = 0; k <= 4; k++) {
      const t = tStart + span * k / 4;
      if (t < 0) continue;
      ctx.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center';
      ctx.fillText(hhmm(t), Lp + plotW * k / 4, H - 4);
    }
    ctx.textAlign = 'left';

    const tip = $('tip');
    if (hoverX != null && hoverX >= Lp && pts.length) {
      const t = tStart + (hoverX - Lp) / plotW * span;
      let bi = 0;
      pts.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(pts[bi].t - t)) bi = i; });
      const best = pts[bi], x = X(best.t);
      ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + .5, top); ctx.lineTo(x + .5, H - axisH); ctx.stroke();
      dot(x, YM(best.a), COL.ai); dot(x, YM(G[bi]), COL.timer); dot(x, YT(best.temp), COL.temp);
      const near = fh.pours.filter((q) => Math.abs(q.ts - best.t) < Math.max(60, span / 120));
      tip.hidden = false;
      tip.innerHTML = `${hhmm(best.t)}<br><span style="color:#8fb6f0">moisture ${f1(best.a)}%</span><br><span style="color:#f2a67d">timer, est. ${f1(G[bi])}%</span><br><span style="color:#c7a4f0">soil ${f1(best.temp)}°C</span>`
        + near.map((q) => `<br>${q.by === 'laptop' ? 'AI pour' : q.by === 'target' ? 'target demo' : 'test pour'} ${Math.round(q.ran_ms / 1000)} s, ${Math.round(q.ran_ms / 1000 * CFG.FLOW_ML_S)} ml`).join('');
      tip.style.left = Math.min(W - tip.offsetWidth, Math.max(0, x + 10)) + 'px';
    }
  }

  window.addEventListener('resize', () => { chartDirty = true; });
  window.farmHand = fh;   // handy in the console
  requestAnimationFrame(frame);
})();
