/* Farm Hand views (2026-09-24): money graph, cups saved, Laya fast + Gemini smart strip,
   someone-added-water banner, field view. Reads window.LIVE (index.html polls /api/live) and /api/series. */
(() => {
const $ = id => document.getElementById(id);
const CUP_ML = 236.6;
const NS = 'http://www.w3.org/2000/svg';
const fmtClock = ts => new Date(ts * 1000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}).replace(/\s(?=[AP]M)/, ' ');
const ago = s => s < 60 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- the money graph ---------- */
let win = 24, SER = null, hoverI = null;
document.querySelectorAll('[data-win]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-win]').forEach(x => x.classList.toggle('on', x === b));
  win = +b.dataset.win; loadSeries();
});

async function loadSeries() {
  try { const r = await fetch('/api/series?hours=' + win); if (!r.ok) return; SER = await r.json(); } catch (e) { return; }
  drawChart(); drawCups();
}

// Timer ghost: the measured line, minus what the AI's own pours added, plus what the timer's pours would have added.
// Test pours and target demos stay in (a person would do those on either pot). Each pour's rise = seconds x learned
// %-per-second, ramped in over 30 s like real water. A model, labeled "estimated" on screen.
function ghost(ts, m) {
  let g = m;
  const add = (t0, rise) => { const k = clamp((ts - t0) / 30, 0, 1); return rise * k; };
  for (const p of SER.pours) if (p.by === 'laptop' && p.ts <= ts) g -= add(p.ts, p.s * SER.rate);
  for (const t of SER.timer) if (t.ts <= ts) g += add(t.ts, t.s * SER.rate);
  return clamp(g, 0, 100);
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function drawChart() {
  const svg = $('chartSvg'); svg.innerHTML = '';
  const W = svg.clientWidth || 800, H = 188, L = 40, R = 10;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const P = SER?.points || [];
  if (P.length < 2) { el('text', {x: W / 2, y: 90, 'text-anchor': 'middle', class: 'empty'}, svg).textContent = 'Waiting for readings. The line starts after a minute of data.'; return; }
  const m0 = 4, m1 = 108, h0 = 136, h1 = 166;                 // moisture panel, temperature panel (two panels, one axis each)
  const t0 = P[0][0], t1 = P[P.length - 1][0];
  const x = ts => L + (ts - t0) / Math.max(1, t1 - t0) * (W - L - R);
  const G = P.map(p => ghost(p[0], p[1]));
  const ms = P.map(p => p[1]).concat(G);
  const lo = Math.max(0, Math.floor(Math.min(SER.band[0] - 5, ...ms) / 5) * 5), hi = Math.min(100, Math.ceil(Math.max(SER.band[1] + 5, ...ms) / 5) * 5);
  const y = v => m1 - (v - lo) / (hi - lo) * (m1 - m0);
  const tv = P.map(p => p[2]).filter(v => v != null);
  const tlo = tv.length ? Math.floor(Math.min(...tv) - .5) : 20, thi = tv.length ? Math.ceil(Math.max(...tv) + .5) : 30;
  const yt = v => h1 - (v - tlo) / Math.max(.5, thi - tlo) * (h1 - h0);

  // healthy band + gridlines
  el('rect', {x: L, y: y(SER.band[1]), width: W - L - R, height: y(SER.band[0]) - y(SER.band[1]), fill: 'rgba(10,138,10,.07)'}, svg);
  el('text', {x: W - R - 4, y: y(SER.band[1]) + 13, 'text-anchor': 'end', class: 'lab', fill: '#0a8a0a', style: 'fill:#0a8a0a'}, svg).textContent = 'healthy';
  for (const v of [lo, (lo + hi) / 2, hi]) {
    el('line', {x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid'}, svg);
    el('text', {x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'ax'}, svg).textContent = Math.round(v) + '%';
  }
  el('line', {x1: L, x2: W - R, y1: h1, y2: h1, class: 'grid'}, svg);
  el('text', {x: L - 6, y: h0 + 4, 'text-anchor': 'end', class: 'ax'}, svg).textContent = thi + '°';
  el('text', {x: L - 6, y: h1 + 4, 'text-anchor': 'end', class: 'ax'}, svg).textContent = tlo + '°';

  // time axis
  const n = W < 520 ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const ts = t0 + (t1 - t0) * i / (n - 1);
    el('text', {x: x(ts), y: H - 4, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'ax'}, svg).textContent = fmtClock(ts);
  }

  const path = (arr, fy) => arr.map((v, i) => v == null ? null : `${x(P[i][0]).toFixed(1)},${fy(v).toFixed(1)}`).filter(Boolean).join(' L');
  // timer ghost (orange dashed), then the measured moisture (blue) on top
  el('path', {d: 'M' + path(G, y), fill: 'none', stroke: '#c4501f', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'stroke-linejoin': 'round', opacity: .9}, svg);
  el('path', {d: 'M' + path(P.map(p => p[1]), y), fill: 'none', stroke: '#1f64b8', 'stroke-width': 2, 'stroke-linejoin': 'round'}, svg);
  if (tv.length) el('path', {d: 'M' + path(P.map(p => p[2]), yt), fill: 'none', stroke: '#7646b8', 'stroke-width': 2, 'stroke-linejoin': 'round'}, svg);

  // pours: AI = blue drop, test/demo = grey ring, timer = orange dot on the ghost
  for (const p of SER.pours) {
    if (p.ts < t0 || p.ts > t1) continue;
    const ai = p.by === 'laptop';
    el('circle', {cx: x(p.ts), cy: m1 - 2, r: 4, fill: ai ? '#1f64b8' : '#fbfcfd', stroke: ai ? '#fbfcfd' : '#5b6674', 'stroke-width': 2}, svg);
  }
  for (const t of SER.timer) {
    if (t.ts < t0 || t.ts > t1) continue;
    el('circle', {cx: x(t.ts), cy: y(ghost(t.ts + 30, P[nearest(t.ts)][1])), r: 4.5, fill: '#c4501f', stroke: '#fbfcfd', 'stroke-width': 2}, svg);
  }

  // direct end labels (latest values)
  const last = P[P.length - 1];
  el('circle', {cx: x(last[0]), cy: y(last[1]), r: 4, fill: '#1f64b8', stroke: '#fbfcfd', 'stroke-width': 2}, svg);
  if (last[2] != null) el('circle', {cx: x(last[0]), cy: yt(last[2]), r: 4, fill: '#7646b8', stroke: '#fbfcfd', 'stroke-width': 2}, svg);

  // hover layer
  const cross = el('line', {y1: m0, y2: h1, stroke: 'rgba(14,22,33,.35)', 'stroke-width': 1, opacity: 0}, svg);
  const dots = ['#1f64b8', '#c4501f', '#7646b8'].map(c => el('circle', {r: 4.5, fill: c, stroke: '#fbfcfd', 'stroke-width': 2, opacity: 0}, svg));
  const hit = el('rect', {x: L, y: 0, width: W - L - R, height: H, fill: 'transparent'}, svg);
  const tip = $('tip');
  const show = i => {
    const p = P[i], X = x(p[0]);
    cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('opacity', 1);
    [[y(p[1])], [y(G[i])], [p[2] != null ? yt(p[2]) : null]].forEach(([cy], k) => { dots[k].setAttribute('cx', X); dots[k].setAttribute('cy', cy ?? -99); dots[k].setAttribute('opacity', cy == null ? 0 : 1); });
    const near = SER.pours.filter(q => Math.abs(q.ts - p[0]) < Math.max(60, (t1 - t0) / 120));
    const tn = SER.timer.filter(q => Math.abs(q.ts - p[0]) < Math.max(60, (t1 - t0) / 120));
    tip.innerHTML = `${fmtClock(p[0])}<br><span class="sw" style="background:#1f64b8"></span>moisture <b>${p[1].toFixed(1)}%</b>`
      + `<br><span class="sw" style="background:#c4501f"></span>timer, est. <b>${G[i].toFixed(1)}%</b>`
      + (p[2] != null ? `<br><span class="sw" style="background:#7646b8"></span>soil temp <b>${p[2].toFixed(1)}°C</b>` : '')
      + near.map(q => `<br>${q.by === 'laptop' ? 'AI pour' : q.by === 'target' ? 'target demo' : 'test pour'} <b>${q.s.toFixed(0)} s, ${q.ml} ml</b>`).join('')
      + tn.map(q => `<br>timer would pour <b>${q.ml} ml</b>`).join('');
    const bw = svg.getBoundingClientRect().width, px = X / W * bw;
    tip.style.left = clamp(px, 90, bw - 90) + 'px'; tip.style.top = '-8px'; tip.style.transform = 'translate(-50%,-100%)'; tip.style.opacity = 1;
  };
  hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), X = (e.clientX - r.left) / r.width * W;
    let b = 0; for (let i = 1; i < P.length; i++) if (Math.abs(x(P[i][0]) - X) < Math.abs(x(P[b][0]) - X)) b = i; hoverI = b; show(b); });
  hit.addEventListener('pointerleave', () => { hoverI = null; tip.style.opacity = 0; cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); });
  svg.setAttribute('aria-label', `Soil moisture now ${last[1].toFixed(1)}%, soil temperature ${last[2] != null ? last[2].toFixed(1) + ' C' : 'unknown'}, over the last ${win ? win + ' hours' : 'run'}.`);

  function nearest(ts) { let b = 0; for (let i = 1; i < P.length; i++) if (Math.abs(P[i][0] - ts) < Math.abs(P[b][0] - ts)) b = i; return b; }
}

function drawCups() {
  const r = SER?.report; if (!r) return;
  const saved = r.timer_pot_ml - r.ai_pot_ml, big = $('cups');
  $('cupsHow').textContent = `timer = ${r.timer_schedule}, ${r.timer_ml_per_pour} ml a pour`;
  if (!r.timer_pours) {
    $('cupsK').textContent = 'Water saved vs a timer';
    big.textContent = 'Too early'; big.style.color = 'var(--muted)'; big.style.fontSize = '1.7rem'; $('cupsU').hidden = true;
    $('cupsSub').innerHTML = `a timer hasn't poured yet in ${r.hours_logged} h. AI used <b style="color:var(--ai)">${r.ai_pot_ml} ml</b>`;
    return;
  }
  big.style.fontSize = ''; $('cupsU').hidden = false;
  const cups = Math.abs(saved) / CUP_ML;
  $('cupsK').textContent = saved >= 0 ? 'Water saved vs a timer' : 'Timer used less so far';
  big.textContent = (saved >= 0 ? '' : '−') + cups.toFixed(cups < 10 ? 1 : 0);
  big.style.color = saved >= 0 ? 'var(--good)' : 'var(--bad)';
  $('cupsU').textContent = cups >= .95 && cups < 1.05 ? 'cup' : 'cups';
  $('cupsSub').innerHTML = `AI <b style="color:var(--ai)">${r.ai_pot_ml.toLocaleString()} ml</b> vs timer <b style="color:var(--timer)">${r.timer_pot_ml.toLocaleString()} ml</b>`
    + (r.ai_pot_demo_ml ? `<br>${r.ai_pot_demo_ml.toLocaleString()} ml of the AI's was test pours and demos` : '');
}

/* ---------- Laya fast, Gemini smart ---------- */
const PICK = {water: 'Water', wait_rain: 'Wait for rain', wait_moist: 'Wait, soil has water'};
function brains(Lv) {
  const now = Date.now() / 1000, la = Lv.last?.laya, ck = Lv.last?.check;
  if (la) {
    $('fastPick').textContent = `Laya: ${PICK[la.pick] || la.pick}`;
    $('fastSub').textContent = `${Math.round(la.sure * 100)}% sure, ${ago(now - la.ts)}`;
    $('fastT').innerHTML = `${la.ms < 10 ? (+la.ms).toFixed(1) : Math.round(la.ms)} ms<small>to decide</small>`;
    $('brFast').classList.toggle('fresh', now - la.ts < 20);
  }
  const b = ck?.brain || '';
  const team = b.startsWith('gemini');
  $('brSmart').classList.toggle('off', !!ck && !team);
  if (!ck) return;
  if (team && ck.t1 == null) {
    $('smartH').textContent = 'Gemini team is thinking';
    $('smartSub').textContent = 'weather, soil, memory, planner, critic';
    $('smartT').innerHTML = `${Math.round(now - ck.t0)} s<small>so far</small>`;
    $('brSmart').classList.add('fresh');
  } else if (team) {
    $('smartH').textContent = 'Gemini team explained';
    $('smartSub').textContent = 'the reason above, checked by the critic';
    $('smartT').innerHTML = `${Math.round(ck.t1 - ck.t0)} s<small>to explain</small>`;
    $('brSmart').classList.toggle('fresh', now - ck.t1 < 20);
  } else {
    $('smartH').textContent = 'Gemini team: off this run';
    $('smartSub').textContent = b.startsWith('laya') ? 'no Gemini key, Laya decided alone' : 'no Gemini key, the backup rules decided';
    $('smartT').innerHTML = '–';
    $('brSmart').classList.remove('fresh');
  }
}

/* ---------- someone added water ---------- */
function handAlert(Lv) {
  const h = Lv.hand || {}, on = h.phase === 'seen' && Date.now() / 1000 - h.ts < 45;
  $('alert').classList.toggle('on', on);
  if (!on) return;
  $('alertT').innerHTML = `Someone just added water. <span class="num">+${(+h.rise).toFixed(1)}%</span>`;
  $('alertS').textContent = h.now > Lv.wet_skip_above
    ? `Soil's at ${(+h.now).toFixed(1)}% now, so I'm skipping my next watering.`
    : `Soil's at ${(+h.now).toFixed(1)}%. My next pour will be smaller.`;
}
$('handBtn').onclick = () => fetch('/api/demo/handpour', {method: 'POST'});

/* ---------- field view (an illustration of scale, labeled as one) ---------- */
const RAMP = [[200, 168, 120], [90, 143, 200], [31, 95, 176]];
function wetColor(v) {                                          // same dry -> wet ramp as the Moisture lens
  const t = clamp((v - 30) / 35, 0, 1), k = t < .5 ? 0 : 1, u = t < .5 ? t * 2 : (t - .5) * 2;
  return `rgb(${RAMP[k].map((c, i) => Math.round(c + (RAMP[k + 1][i] - c) * u)).join(',')})`;
}
const LIVE_DOT = {x: 330, y: 205};
function buildField() {
  const fv = $('fieldView');
  const svg = el('svg', {viewBox: '0 0 1200 760', preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Illustration: a farm with a soil probe every few rows. Only one probe is live.'}, fv);
  const g = el('g', {id: 'fieldZoom'}, svg);
  el('rect', {x: 20, y: 20, width: 1160, height: 730, rx: 24, fill: '#ddd4bf'}, g);
  const plots = [[70, 70, 520, 290, 56], [640, 70, 490, 290, 61], [70, 410, 520, 290, 36], [640, 410, 490, 290, 50]];
  plots.forEach(([px, py, pw, ph, base], zi) => {
    el('rect', {x: px, y: py, width: pw, height: ph, rx: 14, fill: '#d6cdb4'}, g);
    for (let ry = py + 12; ry < py + ph - 6; ry += 13) el('line', {x1: px + 12, x2: px + pw - 12, y1: ry, y2: ry, stroke: '#8fae63', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: .75}, g);
    const bx = px + pw - 46, by = py + ph - 34;                   // one board per zone, wires out to its probes
    const dots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const dx = px + 60 + c * (pw - 120) / 4, dy = py + 50 + r * (ph - 100) / 2;
      let v = base + 6 * Math.sin(dx * .037 + dy * .021) + 4 * Math.cos(dx * .013 - dy * .05);
      if (zi === 2 && c < 3) v -= 12;                           // the dry patch
      dots.push([dx, dy, v]);
    }
    for (const [dx, dy] of dots) el('path', {d: `M${bx},${by} Q${(bx + dx) / 2},${by} ${dx},${dy}`, fill: 'none', stroke: 'rgba(14,22,33,.16)', 'stroke-width': 1.5}, g);
    el('rect', {x: bx - 16, y: by - 11, width: 32, height: 22, rx: 4, fill: '#1c2430'}, g);
    el('rect', {x: bx - 9, y: by - 6, width: 12, height: 12, rx: 1.5, fill: '#b9c0c8'}, g);
    for (const [dx, dy, v] of dots) {
      if (Math.abs(dx - LIVE_DOT.x) < 2 && Math.abs(dy - LIVE_DOT.y) < 2) continue;
      el('circle', {cx: dx, cy: dy, r: 10, fill: wetColor(v), stroke: '#fbfcfd', 'stroke-width': 3}, g);
    }
    if (zi === 2) {
      el('rect', {x: px + 34, y: py + 22, width: (pw - 120) / 2 + 52, height: ph - 44, rx: 16, fill: 'rgba(31,100,184,.06)', stroke: '#1f64b8', 'stroke-width': 2, 'stroke-dasharray': '7 6'}, g);
      const t = el('text', {x: px + 34, y: py + 12, style: 'font:700 26px var(--f-display);fill:#1f64b8'}, g);
      t.textContent = 'Dry patch: only this part gets water';
    }
  });
  // the one live probe: this box
  const ring = el('circle', {cx: LIVE_DOT.x, cy: LIVE_DOT.y, r: 24, fill: 'none', stroke: '#1f64b8', 'stroke-width': 3}, g);
  ring.innerHTML = '<animate attributeName="r" values="18;30;18" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.25;1" dur="2.4s" repeatCount="indefinite"/>';
  el('circle', {cx: LIVE_DOT.x, cy: LIVE_DOT.y, r: 13, id: 'liveDot', fill: wetColor(45), stroke: '#fbfcfd', 'stroke-width': 4}, g);
  const lb = el('g', {transform: `translate(${LIVE_DOT.x + 34},${LIVE_DOT.y - 84}) scale(1.7)`}, g);
  el('rect', {width: 190, height: 44, rx: 10, fill: '#0e1621'}, lb);
  const t1 = el('text', {x: 12, y: 18, style: 'font:600 12px var(--f-body);fill:rgba(255,255,255,.75)'}, lb); t1.textContent = 'This box, live';
  const t2 = el('text', {x: 12, y: 36, id: 'liveDotTxt', style: 'font:600 15px var(--f-num);fill:#fff'}, lb); t2.textContent = '–';
  const cap = document.createElement('div'); cap.className = 'fieldcap';
  cap.innerHTML = `<span class="est">Illustration</span><br><b>What a whole field looks like.</b><span class="long"> Every dot is a probe like the one in this box.
    One board reads several probes over longer waterproof wire, so the farm waters only the dry patch.</span>
    <div class="fk"><span>dry</span><span class="ramp"></span><span>wet</span></div>
    <div class="fk muted">Only the ringed dot is live. The other dots are made up for the picture.</div>`;
  fv.appendChild(cap);
}
buildField();

function setView(v) {
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === v));
  const field = v === 'field';
  $('fieldView').hidden = !field; $('lensSeg').hidden = field; $('lensKey').hidden = field;
  $('stage').classList.toggle('field', field);
  if (field) {                                                   // zoom out: start tight on this box, pull back to the farm
    const z = $('fieldZoom');
    z.style.transition = 'none'; z.style.transformOrigin = `${LIVE_DOT.x}px ${LIVE_DOT.y}px`; z.style.transform = 'scale(7)';
    z.getBoundingClientRect();
    requestAnimationFrame(() => { z.style.transition = ''; z.style.transform = 'scale(1)'; });
  }
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));

/* ---------- tick ---------- */
function tick() {
  const Lv = window.LIVE || {};
  $('handBtn').hidden = !Lv.fake;
  brains(Lv); handAlert(Lv);
  if (Lv.a != null) { $('liveDot').setAttribute('fill', wetColor(Lv.a)); $('liveDotTxt').textContent = `${Lv.a.toFixed(1)}%  ${Lv.temp != null ? Lv.temp.toFixed(1) + '°C' : ''}`; }
}
setInterval(tick, 500); tick();
loadSeries(); setInterval(() => { if (hoverI == null) loadSeries(); }, 15000);
new ResizeObserver(() => SER && drawChart()).observe($('chart'));
})();
