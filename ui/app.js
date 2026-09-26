/* Farm Hand UI: runs the virtual rig (sim.js) and draws it. Plain JS, no build step. */
(function () {
  'use strict';
  const { CFG, FarmHand } = window.FarmHandSim;
  const fh = new FarmHand();
  const $ = (id) => document.getElementById(id);
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const clockFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  const at = (t) => new Date(fh.t0 + t * 1000);
  const hhmm = (t) => timeFmt.format(at(t));
  const dayOf = (t) => Math.floor((CFG.START_HOUR * 3600 + t) / 86400) + 1;

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

  // ---------- controls ----------
  const say = (msg) => { $('actionMsg').textContent = msg || ''; };
  $('runAgents').addEventListener('click', () => {
    if (fh.target) return say('A target run is going. The AI loop waits for it.');
    say('');
    fh.check('manual');
  });
  $('testPour').addEventListener('click', () => say(fh.testPour()));
  $('stop').addEventListener('click', () => { fh.stop(); say(''); });

  let tVal = 55;
  const setT = (v) => { tVal = clamp(v, 36, 68); $('tVal').textContent = tVal + '%'; };
  $('tMinus').addEventListener('click', () => setT(tVal - 1));
  $('tPlus').addEventListener('click', () => setT(tVal + 1));
  $('tGo').addEventListener('click', () => say(fh.startTarget(tVal)));

  $('pinch').addEventListener('click', () => {
    const on = $('pinch').getAttribute('aria-pressed') !== 'true';
    $('pinch').setAttribute('aria-pressed', String(on));
    $('pinch').textContent = on ? 'Let go of the tube' : 'Pinch the tube';
    fh.setPinched(on);
  });
  $('hand').addEventListener('click', () => fh.handPour());
  $('refill').addEventListener('click', () => fh.refill());

  document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabbar button').forEach((x) => x.classList.toggle('on', x === b));
    for (const id of ['team', 'pours', 'serial']) $('tab-' + id).hidden = id !== b.dataset.tab;
    serialSeen = -1;
  }));

  let win = 1, chartDirty = true;
  document.querySelectorAll('#win button').forEach((b) => b.addEventListener('click', () => {
    win = b.dataset.win === 'all' ? 'all' : +b.dataset.win;
    document.querySelectorAll('#win button').forEach((x) => x.classList.toggle('on', x === b));
    chartDirty = true;
  }));

  // ---------- banner ----------
  let bannerTimer = 0;
  function banner(msg, bad) {
    $('bannerText').textContent = msg;
    $('banner').classList.toggle('bad', !!bad);
    $('banner').hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { $('banner').hidden = true; }, bad ? 20000 : 12000);
  }
  $('bannerClose').addEventListener('click', () => { $('banner').hidden = true; });

  // ---------- agent team (plays in wall time, whatever the sim speed) ----------
  const nodes = {};
  document.querySelectorAll('#agents li[data-node]').forEach((li) => { nodes[li.dataset.node] = li; });
  const setNode = (names, state) => [].concat(names).forEach((n) => { nodes[n].className = (nodes[n].classList.contains('sub') ? 'sub ' : '') + (state || ''); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function step(text, bad, t) {
    const li = document.createElement('li');
    if (bad) li.className = 'bad';
    li.innerHTML = `<time>${hhmm(t == null ? fh.t : t)}</time>`;
    li.append(text);
    const ol = $('steps');
    ol.prepend(li);
    while (ol.children.length > 40) ol.lastChild.remove();
  }
  function showGuards(guards) {
    const ul = $('guardList');
    ul.innerHTML = '';
    if (!guards) return;
    for (const g of guards) {
      const li = document.createElement('li');
      li.className = g.skipped ? 'skip' : g.ok ? 'ok' : 'no';
      li.textContent = g.skipped ? `${g.name} (skipped, a person started it)` : g.ok ? g.name : `${g.name}: ${g.why}`;
      ul.append(li);
    }
  }

  let teamBusy = false, teamStart = 0;
  async function playTeam(c) {
    if (teamBusy) return;
    teamBusy = true;
    Object.keys(nodes).forEach((n) => setNode(n, (n === 'target' && fh.target) || (n === 'soak' && fh.soak) ? 'work' : ''));
    const s = fh.stats();
    const verb = c.act === 'wait' ? 'wait' : `water ${c.sec} s`;

    setNode('laya', 'work'); await sleep(250);
    setNode('laya', 'done'); step(`Laya: ${verb} (${c.layaMs} ms, ${Math.round(c.sure * 100)}% sure)`);
    if (c.guards) {
      setNode('guards', 'work'); showGuards(c.guards); await sleep(300);
      const bad = c.guards.find((g) => !g.ok);
      setNode('guards', bad ? 'blocked' : 'done');
      if (bad) step(`Safety rules blocked it: ${bad.why}`, true);
      else {
        setNode('pump', 'work'); step(`Pump: P A ${Math.round(c.sec * 1000)}`);
        await sleep(400); setNode('pump', 'done');
      }
    } else showGuards(null);

    teamStart = performance.now();
    $('teamLine').textContent = 'Gemini team thinking…';
    $('teamLine').closest('.srow').classList.add('thinking');
    setNode(['weather', 'soil', 'memory'], 'work'); await sleep(900);
    setNode(['weather', 'soil', 'memory'], 'done');
    step('weather_agent: pot is indoors, rain ignored. Miami-Dade 100% in drought.');
    step(`soil_agent: pot A ${f1(c.m)}%, dries out in ${f1(s.driesInH)} h`);
    step(`memory_agent: ${fh.pours.filter((p) => fh.t - p.t < 86400).length} pours in 24 h, learned ${s.rate.toFixed(2)} %/s`);
    setNode('planner', 'work'); await sleep(600);
    setNode('planner', 'done'); step(`planner_agent: propose ${verb}`);
    setNode('critic', 'work'); await sleep(600);
    if (Math.random() < 0.25) {
      setNode('critic', 'blocked');
      step('critic_agent: sent it back, the sentence has a number the tools didn\'t give', true);
      setNode('planner', 'work'); await sleep(600);
      setNode('planner', 'done'); step('planner_agent: fixed the sentence');
      setNode('critic', 'work'); await sleep(500);
    }
    setNode('critic', 'done'); step('critic_agent: approved');
    $('teamLine').closest('.srow').classList.remove('thinking');
    $('teamLine').textContent = 'Gemini team explained';
    teamStart = 0;
    teamBusy = false;
  }

  // ---------- events from the sim ----------
  let lastCall = null;
  function drain() {
    const evs = fh.events.splice(0);
    let check = null;
    for (const e of evs) {
      if (e.type === 'check') check = e.call;
      else if (e.type === 'hand') banner(e.msg, false);
      else if (e.type === 'fault') banner(e.msg, true);
      else if (e.type === 'soaked') {
        const p = e.pour;
        setNode('soak', p.failed ? 'blocked' : 'done');
        step(p.failed ? `Pour detector: ${p.delta >= 0 ? '+' : ''}${f1(p.delta)}%, water isn't arriving` :
          `Pour detector: ${p.sec} s gave ${p.delta >= 0 ? '+' : ''}${f1(p.delta)}%, rate now ${p.rateAfter.toFixed(2)} %/s`, p.failed, e.t);
      } else if (e.type === 'pour') setNode('soak', 'work');
      else if (e.type === 'target') {
        const T = e.target;
        setNode('target', T.state === 'running' ? 'work' : T.state === 'locked' ? 'done' : 'blocked');
        if (T.state === 'running') step(`Target controller: walk soil to ${T.pct}%`, false, e.t);
        else step(`Target controller: ${T.state}${T.msg ? '. ' + T.msg : ''}`, T.state !== 'locked', e.t);
      }
      if (e.type === 'pour' || e.type === 'soaked') poursDirty = true;
    }
    if (check) playTeam(check);
  }

  // ---------- render ----------
  const DRY = [201, 180, 152], WET = [58, 41, 30];
  const mix = (k) => `rgb(${DRY.map((v, i) => Math.round(v + (WET[i] - v) * k)).join(',')})`;
  const rig = $('rig');
  let lastStageT = -1, serialSeen = -1, poursDirty = true, lastChartDraw = 0;

  function render(now) {
    drain();
    const s = fh.stats();

    // clock
    $('clock').textContent = `Day ${dayOf(fh.t)} · ${clockFmt.format(at(fh.t))}`;

    // stage
    const b = fh.board;
    rig.classList.toggle('pumping', b.pumping);
    rig.classList.toggle('flowing', !b.pinched && b.cupMl > 0);
    rig.classList.toggle('pinched', b.pinched);
    if (fh.t !== lastStageT && !Number.isNaN(s.m)) {
      lastStageT = fh.t;
      $('soil').setAttribute('fill', mix(clamp((s.m - 20) / 55, 0, 1)));
      const wd = fh.soil.wetDepth;
      $('wetBand').setAttribute('height', String(Math.round(wd * 150)));
      $('wetBand').setAttribute('opacity', String(0.25 + 0.75 * wd));
      $('puddle').setAttribute('rx', String(Math.min(90, fh.soil.surfaceMl * 0.6)));
      const h = Math.round(b.cupMl / CFG.CUP_ML * 110);
      $('cupWater').setAttribute('y', String(382 - h));
      $('cupWater').setAttribute('height', String(h));
      $('cupText').textContent = b.cupMl > 0 ? `${Math.round(b.cupMl)} ml in cup` : 'cup is empty';
      $('cupText').setAttribute('class', 'svg-label ' + (b.cupMl > 0 ? 'dim' : 'empty'));
      $('probeLed').setAttribute('fill', b.pumping ? '#2f7de1' : s.m < CFG.HEALTHY[0] ? '#e0453a' : '#2fbf6a');
      $('probeText').textContent = f1(s.m) + '%';
      $('tempText').textContent = f1(fh.reading.temp) + '°C';
      $('espLed').setAttribute('opacity', fh.t % 2 ? '1' : '.25');

      // numbers
      $('nMoist').textContent = f1(s.m) + '%';
      $('nPin').style.left = `calc(${clamp(s.m, 0, 100)}% - 1px)`;
      $('nTemp').textContent = f1(fh.reading.temp) + '°C';
      $('nAir').textContent = `outside air ${f1(s.air)}°C`;
      $('nDry').textContent = s.driesInH > 0 ? f1(s.driesInH) + ' h' : 'dry now';
      $('nUsed').textContent = Math.round(s.used24) + ' ml';
      $('nRate').textContent = s.rate.toFixed(2) + ' %/s';
      renderSaved(s);
      renderTarget(s);
    }

    // the call
    if (fh.call !== lastCall) {
      lastCall = fh.call;
      renderCall(fh.call);
    }
    if (teamStart) $('teamS').textContent = ((now - teamStart) / 1000).toFixed(1);
    if (fh.target) {
      $('callTitle').textContent = `Hitting ${fh.target.pct}%`;
      $('callTitle').className = 'water';
      $('callWhy').textContent = `Walking the soil up to ${fh.target.pct}% in short pulses, learning the soak rate as it goes.`;
      $('callMeta').textContent = 'You pressed Go. The AI loop waits until this is done.';
      lastCall = undefined;
    }
    $('runAgents').disabled = !!fh.target;
    $('tGo').disabled = !!fh.target;

    if (poursDirty && !$('tab-pours').hidden) renderPours();
    if (!$('tab-serial').hidden && serialSeen !== fh.serialCount) renderSerial();
    if (chartDirty || now - lastChartDraw > 250) { drawChart(); lastChartDraw = now; chartDirty = false; }
  }

  function renderCall(c) {
    if (!c) {
      $('callTitle').textContent = 'Waiting';
      $('callTitle').className = '';
      $('callWhy').textContent = 'The first check runs in a few seconds, or press Run agents.';
      $('callMeta').textContent = '';
      return;
    }
    const title = c.act === 'water' ? `Watering ${c.sec} s` : c.act === 'blocked' ? 'Wanted to water' : 'Holding off';
    $('callTitle').textContent = title;
    $('callTitle').className = c.act === 'water' ? 'water' : c.act === 'blocked' ? 'blocked' : '';
    $('callWhy').textContent = c.why;
    $('callMeta').textContent = `${c.kind === 'manual' ? 'You pressed Run agents' : 'The 15 min check'}, ${hhmm(c.t)}`;
    $('layaLine').textContent = c.act === 'wait' ? 'Laya: wait, soil has water' : `Laya: water ${c.sec} s`;
    $('layaSure').textContent = `${Math.round(c.sure * 100)}% sure · simulated`;
    $('layaMs').textContent = c.layaMs;
    $('teamS').textContent = c.teamS;
    $('teamSub').textContent = 'the reason above, checked by the critic · simulated';
  }

  function renderTarget(s) {
    const T = fh.target || fh.lastTarget;
    const ro = $('readout');
    if (!T) { ro.hidden = true; return; }
    const live = !!fh.target;
    // keep a finished run's readout up for 3 sim-minutes, or 20 s of wall time at real speed
    if (!live && fh.t - T.t1 > 180) { ro.hidden = true; } else ro.hidden = false;
    $('roNow').textContent = f1(live ? s.m : T.end) + '%';
    $('roTgt').textContent = T.pct + '%';
    const lo = 30, hi = 75;
    $('roFill').style.width = clamp(((live ? s.m : T.end) - lo) / (hi - lo) * 100, 0, 100) + '%';
    $('roMark').style.left = ((T.pct - lo) / (hi - lo) * 100) + '%';
    ro.className = 'readout' + (live ? '' : T.state === 'locked' ? ' locked' : ' failed');
    $('roState').textContent = live
      ? (fh.board.pumping ? `Pulse ${T.pulses.length}: pumping` : `Pulse ${T.pulses.length}: waiting for it to soak in`)
      : T.state === 'locked' ? `Locked on ${f1(T.end)}%` : `Stopped: ${T.state}`;

    $('pulses').innerHTML = '';
    for (const p of T.pulses) {
      const el = document.createElement('span');
      el.className = 'pulse' + (p.failed ? ' bad' : '');
      el.textContent = `${p.sec} s ${p.delta == null ? '…' : (p.delta >= 0 ? '+' : '') + f1(p.delta) + '%'}`;
      $('pulses').append(el);
    }
    const rc = $('receipt');
    if (live) { rc.textContent = ''; return; }
    const secs = T.t1 - T.t0;
    const tail = `${T.pulses.length} pulses · ${T.pumpS} s pumping · ${T.ml} ml · ${secs} s`;
    rc.className = 'receipt ' + (T.state === 'locked' ? 'good' : 'bad');
    rc.textContent = T.state === 'locked'
      ? `Hit ${f1(T.end)}% (target ${T.pct}%). ${tail}`
      : `${T.msg || 'Stopped.'} ${tail}`;
  }

  function renderSaved(s) {
    const big = $('svBig');
    if (!s.fullIntervals) {
      $('svLabel').textContent = 'Water saved vs a timer';
      big.textContent = '–';
      big.className = 'mono';
      $('svSub').textContent = "Not enough data yet: the timer's first 6 h isn't done.";
      return;
    }
    const cups = s.saved / CFG.HAND_CUP_ML;
    big.className = 'mono' + (s.saved < 0 ? ' bad' : '');
    $('svLabel').textContent = s.saved >= 0 ? 'Water saved vs a timer' : 'Timer used less so far';
    big.innerHTML = `${cups >= 0 ? '+' : '−'}${f1(Math.abs(cups))}<small style="font-size:16px"> cup${Math.abs(cups) >= 1.05 || Math.abs(cups) < 0.95 ? 's' : ''}</small>`;
    $('svSub').textContent = `AI ${Math.round(s.aiMl)} ml vs timer ${Math.round(s.timerMl)} ml, over ${s.fullIntervals * 6} h`;
  }

  function renderPours() {
    poursDirty = false;
    const rows = fh.pours.slice(-30).reverse();
    const tb = $('pourRows');
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="5" class="dim">No pours yet.</td></tr>'; return; }
    tb.innerHTML = '';
    for (const p of rows) {
      const tr = document.createElement('tr');
      const who = { ai: 'AI', test: 'test', target: 'target' }[p.who];
      const soil = p.delta == null ? 'soaking…' : `${p.delta >= 0 ? '+' : ''}${f1(p.delta)}%`;
      const reach = p.delta == null ? '' : p.failed ? 'never' : p.reachS == null ? '–' : `${p.reachS} s`;
      [hhmm(p.t), who, `${p.sec} s · ${Math.round(p.ml)} ml`, soil, reach].forEach((v, i) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (p.failed && i >= 3) td.className = 'bad';
        tr.append(td);
      });
      tb.append(tr);
    }
  }

  function renderSerial() {
    serialSeen = fh.serialCount;
    const pre = $('serial');
    const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 20;
    pre.textContent = fh.serial.slice(-80).map((l) => `${clockFmt.format(at(l.t))} ${l.dir} ${l.text}`).join('\n');
    if (stick) pre.scrollTop = pre.scrollHeight;
  }

  // ---------- chart ----------
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

  function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const L = 34, R = 8, top = 6, axisH = 18;
    const plotW = W - L - R;
    const mH = Math.round((H - axisH - top) * 0.66), gap = 22;
    const tTop = top + mH + gap, tH = H - axisH - tTop;
    const span = win === 'all' ? Math.max(3600, fh.t) : win * 3600;
    const tEnd = win === 'all' ? Math.max(3600, fh.t) : Math.max(span, fh.t);
    const tStart = tEnd - span;
    const X = (t) => L + (t - tStart) / span * plotW;

    const hist = fh.history;
    const i0 = firstIndex(hist, tStart);
    const pts = [];
    const stride = Math.max(1, Math.floor((hist.length - i0) / (plotW * 1.5)));
    for (let i = i0; i < hist.length; i += stride) pts.push(hist[i]);
    if (hist.length && pts[pts.length - 1] !== hist[hist.length - 1]) pts.push(hist[hist.length - 1]);

    let mlo = 25, mhi = 75, tlo = Infinity, thi = -Infinity;
    for (const p of pts) {
      mlo = Math.min(mlo, p.m - 3, p.timer - 3); mhi = Math.max(mhi, p.m + 3, p.timer + 3);
      tlo = Math.min(tlo, p.temp); thi = Math.max(thi, p.temp);
    }
    if (!pts.length) { tlo = 22; thi = 31; }
    tlo = Math.floor(tlo - 1); thi = Math.ceil(thi + 1);
    const YM = (v) => top + (1 - (v - mlo) / (mhi - mlo)) * mH;
    const YT = (v) => tTop + (1 - (v - tlo) / (thi - tlo)) * tH;

    // healthy band + grid
    ctx.fillStyle = 'rgba(31,138,76,.08)';
    ctx.fillRect(L, YM(CFG.HEALTHY[1]), plotW, YM(CFG.HEALTHY[0]) - YM(CFG.HEALTHY[1]));
    ctx.font = '11px ' + css('--mono');
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.muted;
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    for (const v of [25, 50, 75]) {
      if (v < mlo || v > mhi) continue;
      ctx.beginPath(); ctx.moveTo(L, YM(v) + .5); ctx.lineTo(W - R, YM(v) + .5); ctx.stroke();
      ctx.fillText(v + '%', 0, YM(v));
    }
    ctx.fillText(tlo + '°', 0, YT(tlo) - 4);
    ctx.fillText(thi + '°', 0, YT(thi) + 4);
    ctx.fillStyle = '#1f8a4c';
    ctx.textAlign = 'right';
    ctx.fillText('healthy', W - R - 4, YM(CFG.HEALTHY[1]) + 9);
    ctx.textAlign = 'left';

    const line = (key, Y, color, dash) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p[key])) : ctx.moveTo(X(p.t), Y(p[key]))));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.stroke(); ctx.setLineDash([]);
    };
    line('timer', YM, COL.timer, [5, 4]);
    line('m', YM, COL.ai);
    line('temp', YT, COL.temp);

    // pour dots
    const valAt = (t, key) => { const i = Math.min(hist.length - 1, firstIndex(hist, t)); return i >= 0 && hist[i] ? hist[i][key] : null; };
    const dot = (x, y, c) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = c; ctx.fill(); };
    for (const p of fh.pours) if (p.t >= tStart) { const v = valAt(p.t, 'm'); if (v != null) dot(X(p.t), YM(v), COL.ai); }
    for (const p of fh.timerPours) if (p.t >= tStart) { const v = valAt(p.t, 'timer'); if (v != null) dot(X(p.t), YM(v), COL.timer); }

    // time axis
    ctx.fillStyle = COL.muted;
    ctx.textBaseline = 'alphabetic';
    for (let k = 0; k <= 4; k++) {
      const t = tStart + span * k / 4;
      if (t < 0) continue;
      const x = L + plotW * k / 4;
      ctx.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center';
      ctx.fillText(hhmm(t), x, H - 4);
    }
    ctx.textAlign = 'left';

    // hover
    const tip = $('tip');
    if (hoverX != null && hoverX >= L && pts.length) {
      const t = tStart + (hoverX - L) / plotW * span;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
      const x = X(best.t);
      ctx.strokeStyle = '#9aa3ad'; ctx.beginPath(); ctx.moveTo(x + .5, top); ctx.lineTo(x + .5, H - axisH); ctx.stroke();
      dot(x, YM(best.m), COL.ai); dot(x, YM(best.timer), COL.timer); dot(x, YT(best.temp), COL.temp);
      tip.hidden = false;
      tip.innerHTML = `${hhmm(best.t)}<br><span style="color:#8fb6f0">moisture ${f1(best.m)}%</span><br><span style="color:#f2a67d">timer ${f1(best.timer)}%</span><br><span style="color:#c7a4f0">soil ${f1(best.temp)}°C</span>`;
      tip.style.left = Math.min(W - tip.offsetWidth, Math.max(0, x + 10)) + 'px';
    }
  }

  window.addEventListener('resize', () => { chartDirty = true; });
  window.farmHand = fh;   // handy in the console
  requestAnimationFrame(frame);
})();
