
// pump sitting in a cup of water, right of the relay
const PX = 1470, PY = 150;
const PUMP = {red: [PX - 16, PY - 40], blk: [PX + 16, PY - 40]};
function drawPump() {
  const G = grp('pump');
  el('path', {d: `M ${PX - 85} ${PY - 70} L ${PX + 85} ${PY - 70} L ${PX + 70} ${PY + 190} L ${PX - 70} ${PY + 190} Z`, fill: 'rgba(160,200,235,.35)', stroke: '#8fb3cc', 'stroke-width': 3}, G);
  el('path', {d: `M ${PX - 80} ${PY - 20} L ${PX + 80} ${PY - 20} L ${PX + 70} ${PY + 188} L ${PX - 70} ${PY + 188} Z`, fill: 'rgba(60,140,220,.45)'}, G);
  el('rect', {x: PX - 40, y: PY + 40, width: 80, height: 120, rx: 14, fill: '#1d1d1f'}, G);
  el('rect', {x: PX + 36, y: PY + 70, width: 30, height: 14, rx: 4, fill: '#333'}, G);
  txt(PX, PY + 105, 'PUMP', {'text-anchor': 'middle', fill: '#ddd', 'font-size': 16}, G);
  el('path', {d: `M ${PX - 16} ${PY + 40} L ${PUMP.red[0]} ${PUMP.red[1]}`, stroke: '#d63a31', 'stroke-width': 5}, G);
  el('path', {d: `M ${PX + 16} ${PY + 40} L ${PUMP.blk[0]} ${PUMP.blk[1]}`, stroke: '#222', 'stroke-width': 5}, G);
  txt(PX, PY + 222, 'cup of water', {'text-anchor': 'middle', fill: 'var(--ink2)', 'font-size': 15}, G);
}
function wire(a, b, c, bend, animate, p, opacity) {
  const d = `M ${a[0]} ${a[1]} C ${a[0]} ${a[1] + bend[0]}, ${b[0]} ${b[1] + bend[1]}, ${b[0]} ${b[1]}`;
  el('path', {d, fill: 'none', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 10, 'stroke-linecap': 'round', transform: 'translate(2 3)', opacity: opacity ?? 1}, p);
  const w = el('path', {d, fill: 'none', stroke: c, 'stroke-width': 8, 'stroke-linecap': 'round', opacity: opacity ?? 1}, p);
  if (animate) { w.style.setProperty('--len', w.getTotalLength()); w.classList.add('draw'); }
}
// what you already built (your photo): bottom half, transistor legs in j22 j21 j20, resistor 21 -> 15
function drawBuilt() {
  const G = grp('built'), y = rowY('j');
  el('path', {d: `M ${colX(22) - 12} ${y - 52} L ${colX(20) + 12} ${y - 52} L ${colX(20) + 12} ${y - 18} A 36 10 0 0 1 ${colX(22) - 12} ${y - 18} Z`, fill: '#1d1d1f'}, G);
  [20, 21, 22].forEach(n => el('rect', {x: colX(n) - 2, y: y - 20, width: 4, height: 20, fill: '#c9ccd0'}, G));
  const ry = rowY('f'), x1 = colX(21), x2 = colX(15);
  el('line', {x1, x2, y1: ry, y2: ry, stroke: '#c9ccd0', 'stroke-width': 4}, G);
  el('rect', {x: x1 + 22, y: ry - 11, width: x2 - x1 - 44, height: 22, rx: 10, fill: '#8fb4d6', stroke: '#6f93b3'}, G);
  [.15, .32, .49, .8].forEach((f, i) => el('rect', {x: x1 + 22 + (x2 - x1 - 44) * f, y: ry - 11, width: 8, height: 22, fill: ['#6b3a1e', '#111', '#c8281e', '#c09a3c'][i]}, G));
  const w = (a, b, c, bd) => wire(a, b, c, bd, false, G, .75);
  w(EPIN.LGND, hole(22, 'g'), '#e8e8e8', [300, -120]);
  w(EPIN.RD26, hole(15, 'g'), '#777', [120, -200]);
  w(hole(20, 'g'), RS.IN, '#d63a31', [-200, 0]);
  txt(colX(18), rowY('j') + 50, 'your transistor build (done ✓, don’t touch)', {'text-anchor': 'middle', fill: 'var(--ink2)', 'font-size': 15}, G);
}
drawBoard(); drawESP(); drawRelay(); drawBuilt(); drawPump();
const LAY = el('g'), FX = el('g');
const ring = ([x, y]) => el('circle', {cx: x, cy: y, r: 22, fill: 'none', stroke: '#ffd23f', 'stroke-width': 5, class: 'pulse'}, FX);
function tag([x, y], s, dy = -40) { const w = s.length * 10 + 22, G = el('g', {}, FX);
  el('line', {x1: x, y1: y, x2: x, y2: y + dy + (dy < 0 ? 14 : -14), stroke: '#0e1621', 'stroke-width': 2, 'stroke-dasharray': '4 3'}, G);
  el('rect', {x: x - w / 2, y: y + dy - 14, width: w, height: 30, rx: 8, fill: '#0e1621'}, G);
  txt(x, y + dy + 6, s, {'text-anchor': 'middle', fill: '#fff', 'font-size': 16}, G); }

const RELAY_ZOOM = [860, 0, 740, 420];
const S = [
  {h: 'Where you are', p: 'Relay clicks ✓. Your transistor build stays exactly like it is. Now the pump: 1 new wire + the pump’s 2 wires, all into relay screws. Nothing new on the breadboard.', zoom: [0, 0, 1600, 900], ring: [RS.IN]},
  {h: 'Unplug USB', p: 'Pull the USB cable out of the ESP32. Never loosen screws with power on.', zoom: [0, 0, 700, 420], ring: [[EX + 125, EY]], tags: [[[EX + 125, EY - 10], 'unplug', 60]]},
  {h: 'Jumper: DC+ → COM', p: 'Male-male wire. Loosen the DC+ screw, push one end in NEXT TO the red wire already there, tighten. Other end into COM (middle screw on the far side), tighten. Tug both. This gives the pump 5V to switch.', zoom: RELAY_ZOOM, wires: ['jump'], ring: [RS['DC+'], RO.COM], use: '1 male-male wire, any color', tags: [[RO.COM, 'COM', 60]]},
  {h: 'Pump red → NO', p: 'Loosen the NO screw (top screw on the far side). Push the pump’s red wire in, tighten, tug. NO = “normally open”: power only flows when the relay clicks on.', zoom: RELAY_ZOOM, wires: ['red'], ring: [RO.NO, PUMP.red], use: 'The pump’s red wire', tags: [[RO.NO, 'NO', -44]]},
  {h: 'Pump black → DC−', p: 'Loosen the DC− screw. Push the pump’s black wire in NEXT TO the black wire already there, tighten, tug. That’s the pump’s ground.', zoom: RELAY_ZOOM, wires: ['blk'], ring: [RS['DC−'], PUMP.blk], use: 'The pump’s black wire'},
  {h: 'Pump in the water', p: 'Drop the pump in a cup of water so it’s fully under. Point the outlet tube into a second cup or the sink.', zoom: [1330, 0, 270, 420], ring: [[PX, PY + 100]], al: 'Never run the pump dry. It burns out.'},
  {h: 'Plug in + watch', p: 'USB back in. Test code flips the relay every 2 s: click → pump runs 2 s → click → stops 2 s. Over and over.', zoom: [0, 0, 1600, 900], all: true, run: true, ring: [[EX + 125, EY]],
    al: 'If the ESP32 keeps restarting when the pump kicks on, the USB can’t feed it. Tell me, that’s what the 9V adapter fixes.'},
];
const WIRES = {jump: [RS['DC+'], RO.COM, '#f2c12e', [-110, -110]], red: [PUMP.red, RO.NO, '#d63a31', [-60, -90]], blk: [PUMP.blk, RS['DC−'], '#222', [-160, -220]]};

let cur = 0; try { cur = Math.min(S.length - 1, +localStorage.getItem('pump1') || 0); } catch (e) {}
const dots = document.getElementById('dots'); S.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => { cur = i; render(); }; dots.appendChild(d); });
let VB = [0, 0, 1600, 900], zid = 0;
function zoom(to) { const r = svg.clientWidth / Math.max(1, svg.clientHeight); let [x, y, w, h] = to; const cx = x + w / 2, cy = y + h / 2;
  if (w / h > r) h = w / r; else w = h * r; w *= 1.08; h *= 1.08; const T = [cx - w / 2, cy - h / 2, w, h], F = VB.slice(), t0 = performance.now(), id = ++zid;
  const st = t => { if (id !== zid) return; const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); VB = F.map((v, i) => v + (T[i] - v) * e); svg.setAttribute('viewBox', VB.join(' ')); if (k < 1) requestAnimationFrame(st); };
  requestAnimationFrame(st); }
let runId = 0;
function render() {
  try { localStorage.setItem('pump1', cur); } catch (e) {}
  const x = S[cur];
  document.getElementById('k').textContent = `STEP ${cur + 1} OF ${S.length}`;
  document.getElementById('h').textContent = x.h; document.getElementById('p').textContent = x.p;
  document.getElementById('use').textContent = x.use ? '🔌 ' + x.use : ''; document.getElementById('al').textContent = x.al ? '⚠ ' + x.al : '';
  [...dots.children].forEach((d, i) => d.className = i < cur ? 'done' : i === cur ? 'on' : '');
  LAY.innerHTML = ''; FX.innerHTML = '';
  S.slice(0, cur).forEach(y => (y.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, false, LAY, x.all ? 1 : .55); }));
  (x.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, true, LAY); });
  (x.ring || []).forEach(ring); (x.tags || []).forEach(([p, s, dy]) => tag(p, s, dy));
  const id = ++runId;
  if (x.run) { const G = el('g', {}, FX), t0 = performance.now();
    const a = t => { if (id !== runId) return; const on = Math.floor((t - t0) / 2000) % 2 === 0; G.innerHTML = '';
      el('rect', {x: PX - 90, y: PY - 125, width: 180, height: 40, rx: 10, fill: on ? '#1f9a3a' : '#555'}, G);
      txt(PX, PY - 98, on ? 'CLICK · PUMP ON' : 'PUMP OFF', {'text-anchor': 'middle', fill: '#fff', 'font-size': 17}, G);
      if (on) for (let k = 0; k < 6; k++) { const ph = ((t / 600) + k / 6) % 1; el('circle', {cx: PX + 66 + ph * 40, cy: PY + 77 - ph * 60, r: 5, fill: '#3c8cdc', opacity: 1 - ph}, G); }
      requestAnimationFrame(a); }; requestAnimationFrame(a); }
  zoom(x.zoom);
  document.getElementById('back').disabled = cur === 0; document.getElementById('next').textContent = cur === S.length - 1 ? 'Done ✓' : 'Next →';
}
document.getElementById('next').onclick = () => { if (cur < S.length - 1) { cur++; render(); } };
document.getElementById('back').onclick = () => { if (cur > 0) { cur--; render(); } };
document.getElementById('zfit').onclick = () => zoom([0, 0, 1600, 900]);
document.getElementById('zstep').onclick = () => zoom(S[cur].zoom);
addEventListener('keydown', e => { if (e.key === 'ArrowRight') document.getElementById('next').click(); if (e.key === 'ArrowLeft') document.getElementById('back').click(); });
addEventListener('resize', () => zoom(S[cur].zoom));
render();
