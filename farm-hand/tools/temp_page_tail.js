
// temp probe adapter board: green screw block on top (probe wires), 3 pins on the bottom (DAT VCC GND)
const AX = 560, AY = 170, AW = 240, AH = 130;
const AS = {DAT: [622, AY + 32], VCC: [679, AY + 32], GND: [737, AY + 32]};      // screws
const AP = {DAT: [622, AY + AH - 14], VCC: [679, AY + AH - 14], GND: [737, AY + AH - 14]};  // pins
const PROBE = [440, 70];
function drawAdapter() {
  const G = grp('adapter');
  el('rect', {x: AX, y: AY, width: AW, height: AH, rx: 10, fill: '#1f5fbf', stroke: '#143f80', 'stroke-width': 2}, G);
  el('rect', {x: AX + 30, y: AY + 10, width: 180, height: 44, rx: 5, fill: '#2e8b3e'}, G);
  Object.entries(AS).forEach(([n, [x, y]]) => { el('circle', {cx: x, cy: y, r: 14, fill: '#d7dce0', stroke: '#888'}, G); el('line', {x1: x - 9, x2: x + 9, y1: y, y2: y, stroke: '#555', 'stroke-width': 3}, G); });
  Object.entries(AP).forEach(([n, [x, y]]) => { el('rect', {x: x - 5, y: y - 10, width: 10, height: 26, fill: '#d9b35c'}, G);
    txt(x, y - 20, n, {'text-anchor': 'middle', fill: '#fff', 'font-size': 15}, G); });
  txt(AX + 20, AY + 76, 'adapter', {fill: '#cfe0ff', 'font-size': 13}, G);
  // the steel probe + its cable
  el('rect', {x: PROBE[0] - 120, y: PROBE[1] - 12, width: 110, height: 24, rx: 12, fill: '#b9c0c8', stroke: '#8a939c'}, G);
  el('path', {d: `M ${PROBE[0] - 10} ${PROBE[1]} C ${PROBE[0] + 60} ${PROBE[1]}, 560 ${PROBE[1]}, 600 ${PROBE[1] + 20}`, fill: 'none', stroke: '#111', 'stroke-width': 10, 'stroke-linecap': 'round'}, G);
  txt(PROBE[0] - 65, PROBE[1] - 22, 'temp probe', {'text-anchor': 'middle', fill: 'var(--ink2)', 'font-size': 15}, G);
}
drawBoard(); drawESP(); drawRelay(); drawBuilt(); drawPump(); drawAdapter();
// pump wires you already did (dimmed, done)
[[RS['DC+'], RO.COM, '#f2c12e', [-110, -110]], [PUMP.red, RO.NO, '#d63a31', [-60, -90]], [PUMP.blk, RS['DC−'], '#222', [-160, -220]]].forEach(([a, b, c, bd]) => wire(a, b, c, bd, false, document.getElementById('built'), .6));
document.querySelector('#built text').textContent = 'relay + pump: done ✓, don’t touch';
const LAY = el('g'), FX = el('g');
const ring = ([x, y]) => el('circle', {cx: x, cy: y, r: 20, fill: 'none', stroke: '#ffd23f', 'stroke-width': 5, class: 'pulse'}, FX);
function tag([x, y], s, dy = -40) { const w = s.length * 10 + 22, G = el('g', {}, FX);
  el('line', {x1: x, y1: y, x2: x, y2: y + dy + (dy < 0 ? 14 : -14), stroke: '#0e1621', 'stroke-width': 2, 'stroke-dasharray': '4 3'}, G);
  el('rect', {x: x - w / 2, y: y + dy - 14, width: w, height: 30, rx: 8, fill: '#0e1621'}, G);
  txt(x, y + dy + 6, s, {'text-anchor': 'middle', fill: '#fff', 'font-size': 16}, G); }


// close-up by LEG, not by number: each transistor leg has its own line of 5 joined holes going up toward the middle gap
function closeup(p) {
  const G = el('g', {}, p), X0 = 430, Y0 = 40, W = 1000, H = 560;
  el('rect', {x: X0, y: Y0, width: W, height: H, rx: 18, fill: '#fbfcfd', stroke: '#c8ced6', 'stroke-width': 2}, G);
  txt(X0 + W / 2, Y0 + 44, 'Each leg has its own line of 5 holes (joined inside)', {'text-anchor': 'middle', fill: '#0e1621', 'font-size': 26}, G);
  const LX = [X0 + 260, X0 + 420, X0 + 580], HY = k => Y0 + 110 + k * 64, legY = HY(4);
  // lines: left = green (ground), middle + right = grey
  el('rect', {x: LX[0] - 50, y: HY(0) - 36, width: 100, height: 4 * 64 + 72, rx: 14, fill: 'rgba(31,154,58,.18)', stroke: '#1f9a3a', 'stroke-width': 4}, G);
  [1, 2].forEach(k => el('rect', {x: LX[k] - 50, y: HY(0) - 36, width: 100, height: 4 * 64 + 72, rx: 14, fill: 'rgba(0,0,0,.04)', stroke: '#b9c0c8', 'stroke-width': 2}, G));
  LX.forEach(x => [0, 1, 2, 3, 4].forEach(k => el('rect', {x: x - 16, y: HY(k) - 16, width: 32, height: 32, rx: 4, fill: '#2b2b2b'}, G)));
  // transistor on the bottom hole of each line, flat side facing you
  el('path', {d: `M ${LX[0] - 40} ${legY + 30} L ${LX[2] + 40} ${legY + 30} L ${LX[2] + 40} ${legY + 70} A 240 20 0 0 1 ${LX[0] - 40} ${legY + 70} Z`, fill: '#1d1d1f'}, G);
  txt(LX[1], legY + 60, 'transistor · flat side facing you', {'text-anchor': 'middle', fill: '#ddd', 'font-size': 17}, G);
  LX.forEach(x => el('rect', {x: x - 5, y: legY, width: 10, height: 32, fill: '#c9ccd0'}, G));
  [['LEFT leg', '#1f9a3a'], ['MIDDLE leg', '#5b6674'], ['RIGHT leg', '#5b6674']].forEach(([t, c], k) => txt(LX[k], legY + 112, t, {'text-anchor': 'middle', fill: c, 'font-size': 20}, G));
  // what's already in each line
  el('circle', {cx: LX[0], cy: HY(3), r: 20, fill: '#eee', stroke: '#999', 'stroke-width': 4}, G);
  el('path', {d: `M ${LX[0]} ${HY(3)} C ${LX[0] - 80} ${HY(2)}, ${X0 + 60} ${HY(1)}, ${X0 + 20} ${HY(0)}`, fill: 'none', stroke: '#ddd', 'stroke-width': 12, 'stroke-linecap': 'round'}, G);
  el('circle', {cx: LX[1], cy: HY(3), r: 11, fill: '#c9ccd0'}, G);
  el('path', {d: `M ${LX[1]} ${HY(3)} L ${LX[1]} ${HY(0) - 28} L ${LX[2] + 190} ${HY(0) - 28}`, fill: 'none', stroke: '#c9ccd0', 'stroke-width': 7}, G);
  el('rect', {x: LX[2] + 50, y: HY(0) - 44, width: 130, height: 32, rx: 14, fill: '#8fb4d6', stroke: '#6f93b3'}, G);
  el('circle', {cx: LX[2], cy: HY(3), r: 20, fill: '#d63a31'}, G);
  el('path', {d: `M ${LX[2]} ${HY(3)} C ${LX[2] + 80} ${HY(2)}, ${LX[2] + 120} ${HY(1)}, ${LX[2] + 140} ${HY(0) + 20}`, fill: 'none', stroke: '#d63a31', 'stroke-width': 12, 'stroke-linecap': 'round'}, G);
  // empty holes in the LEFT line pulse: temp GND goes in any one
  [0, 1, 2].forEach(k => el('rect', {x: LX[0] - 22, y: HY(k) - 22, width: 44, height: 44, rx: 6, fill: 'none', stroke: '#1f9a3a', 'stroke-width': 6, class: 'pulse'}, G));
  // callouts on the right
  const R = X0 + W - 210;
  txt(LX[0] - 70, HY(3) + 44, 'white wire', {'text-anchor': 'end', fill: '#0e1621', 'font-size': 18}, G);
  txt(LX[1] + 34, HY(0) + 6, 'resistor', {'text-anchor': 'start', fill: '#5b6674', 'font-size': 16}, G);
  txt(LX[2] + 30, HY(3) + 44, 'red wire', {'text-anchor': 'start', fill: '#d63a31', 'font-size': 18}, G);
  txt(R, HY(2) + 30, 'temp GND →', {'text-anchor': 'middle', fill: '#0e1621', 'font-size': 24}, G);
  txt(R, HY(2) + 60, 'any GREEN hole', {'text-anchor': 'middle', fill: '#1f9a3a', 'font-size': 24}, G);
  txt(R, HY(2) + 88, 'in the LEFT leg line', {'text-anchor': 'middle', fill: '#1f9a3a', 'font-size': 20}, G);
  txt(R, HY(2) + 114, 'one pin per hole', {'text-anchor': 'middle', fill: '#5b6674', 'font-size': 17}, G);
}
const SPLIT = [600, 90];
const ADAPT_ZOOM = [300, 20, 560, 320], BOARD_ZOOM = [0, 60, 1200, 760];
const S = [
  {h: 'Where you are', p: 'Relay + pump work ✓, leave them alone. Now the temp probe: its 3 wires go into the little blue adapter, then 4 jumpers go to the breadboard. I already loaded the temp test code, and it keeps the pump OFF.', zoom: [0, 0, 1600, 900], ring: [[AX + AW / 2, AY + AH / 2]]},
  {h: 'Unplug USB', p: 'Pull the USB cable out of the ESP32 while you wire.', zoom: [0, 0, 700, 420], ring: [[EX + 125, EY]], tags: [[[EX + 125, EY - 10], 'unplug', 60]]},
  {h: 'Probe wires → adapter screws', p: 'Loosen the 3 green screws. Yellow → DAT, red → VCC, black → GND (match the letters printed on YOUR adapter). Tighten, tug each one.', zoom: ADAPT_ZOOM, wires: ['yel', 'red', 'blk'], ring: [AS.DAT, AS.VCC, AS.GND], use: 'The probe’s own 3 wires, no jumpers',
    tags: [[AS.DAT, 'yellow', -60], [AS.VCC, 'red', -60], [AS.GND, 'black', -60]]},
  {h: 'Adapter DAT → a48', p: 'F-M wire. Hole end onto the adapter’s DAT pin. Pin end into breadboard hole a48 (TOP half, it’s empty).', zoom: [500, 150, 480, 480], wires: ['dat'], ring: [AP.DAT, hole(48, 'a')], use: '1 F-M wire', tags: [[hole(48, 'a'), 'a48', 60]]},
  {h: 'ESP32 D4 → c48', p: 'F-M wire. Hole end onto D4: LEFT side, 5th pin down (3V3, GND, D15, D2, D4). Pin end into c48. Same column as DAT, so they connect.', zoom: BOARD_ZOOM, wires: ['d4'], ring: [EPIN.LD4, hole(48, 'c')], use: '1 F-M wire', tags: [[hole(48, 'c'), 'c48', 60]]},
  {h: 'Adapter VCC → a45', p: 'F-M wire. Hole end onto the adapter’s VCC pin. Pin end into a45.', zoom: [500, 150, 480, 480], wires: ['vcc'], ring: [AP.VCC, hole(45, 'a')], use: '1 F-M wire', tags: [[hole(45, 'a'), 'a45', 60]]},
  {h: 'ESP32 3V3 → c45', p: 'F-M wire. Hole end onto 3V3: LEFT side, top pin. Pin end into c45.', zoom: BOARD_ZOOM, wires: ['v33'], ring: [EPIN.L3V3, hole(45, 'c')], use: '1 F-M wire', tags: [[hole(45, 'c'), 'c45', 60]],
    al: 'If the soil probe’s VCC wire is still on 3V3, pull it off and push it into e45 instead. Same power, shared.'},
  {h: 'Close-up: the LEFT leg line', p: 'Forget the numbers. Look at the transistor, flat side facing you. Its LEFT leg has the white wire in its line. That line is ground. Put the temp GND in any empty hole in the LEFT leg’s line.', zoom: [430, 40, 1000, 560], closeup: true, },
  {h: 'Adapter GND → LEFT leg line', p: 'F-M wire. Hole end onto the adapter’s GND pin. Pin end into any empty hole in the transistor’s LEFT leg line (the line with the white wire). One pin per hole.', zoom: [520, 150, 700, 660], wires: ['gnd'], ring: [AP.GND, hole(22, 'h')], use: '1 F-M wire', tags: [[hole(22, 'h'), 'h22', 58]]},
  {h: 'Plug in + read it', p: 'USB back in. The number below updates every second. Hold the steel tip in your hand: it should climb toward body temp (about 30-34 °C). Pump stays off.', zoom: [0, 0, 1600, 900], all: true, live: true, ring: [[PROBE[0] - 65, PROBE[1]]]},
];
const WIRES = {
  yel: [SPLIT, AS.DAT, '#f2c12e', [40, -40]], red: [SPLIT, AS.VCC, '#d63a31', [40, -40]], blk: [SPLIT, AS.GND, '#222', [40, -40]],
  dat: [AP.DAT, hole(48, 'a'), '#8e44ad', [80, -60]], d4: [EPIN.LD4, hole(48, 'c'), '#8e44ad', [260, -160]],
  vcc: [AP.VCC, hole(45, 'a'), '#e67e22', [80, -60]], v33: [EPIN.L3V3, hole(45, 'c'), '#e67e22', [330, -200]],
  gnd: [AP.GND, hole(22, 'h'), '#2c7a3a', [140, -160]],
};
document.querySelector('.side').insertAdjacentHTML('beforeend', '<div class="card" id="live" hidden><div class="k">LIVE · TEMP PROBE</div><div id="tv" style="font:800 3.6rem/1.05 \'JetBrains Mono\',monospace">–</div><div id="ts" style="font-weight:700;margin-top:6px"></div></div>');
async function livetick() {
  if (!S[cur].live) return;
  let d; try { d = await (await fetch('/temp-data')).json(); } catch (e) { return; }
  const tv = document.getElementById('tv'), ts = document.getElementById('ts'), t = d.last;
  if (!t) { tv.textContent = '–'; ts.textContent = d.err || 'No temp lines yet. Is USB plugged in?'; ts.style.color = 'var(--warn)'; return; }
  const c = t.temp_c, ok = t.probes > 0 && c > -100 && c !== 85;
  tv.textContent = ok ? c.toFixed(1) + ' °C' : '✗';
  ts.textContent = ok ? `probe found ✓ · ${(c * 9 / 5 + 32).toFixed(1)} °F` : t.probes === 0 ? 'No probe found: check DAT → a48, D4 → c48, and the yellow screw.' : c === 85 ? 'Reads 85: that’s its power-on default. Check VCC → a45 and 3V3 → c45.' : 'Probe lost: check the black wire / GND → h22.';
  ts.style.color = ok ? '#1f9a3a' : 'var(--warn)';
}
setInterval(livetick, 1000);

let cur = 0; try { cur = Math.min(S.length - 1, +localStorage.getItem('temp1') || 0); } catch (e) {}
const dots = document.getElementById('dots'); S.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => { cur = i; render(); }; dots.appendChild(d); });
let VB = [0, 0, 1600, 900], zid = 0;
function zoom(to) { const r = svg.clientWidth / Math.max(1, svg.clientHeight); let [x, y, w, h] = to; const cx = x + w / 2, cy = y + h / 2;
  if (w / h > r) h = w / r; else w = h * r; w *= 1.08; h *= 1.08; const T = [cx - w / 2, cy - h / 2, w, h], F = VB.slice(), t0 = performance.now(), id = ++zid;
  const st = t => { if (id !== zid) return; const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); VB = F.map((v, i) => v + (T[i] - v) * e); svg.setAttribute('viewBox', VB.join(' ')); if (k < 1) requestAnimationFrame(st); };
  requestAnimationFrame(st); }
function render() {
  try { localStorage.setItem('temp1', cur); } catch (e) {}
  const x = S[cur];
  document.getElementById('k').textContent = `STEP ${cur + 1} OF ${S.length}`;
  document.getElementById('h').textContent = x.h; document.getElementById('p').textContent = x.p;
  document.getElementById('use').textContent = x.use ? '🔌 ' + x.use : ''; document.getElementById('al').textContent = x.al ? '⚠ ' + x.al : '';
  [...dots.children].forEach((d, i) => d.className = i < cur ? 'done' : i === cur ? 'on' : '');
  LAY.innerHTML = ''; FX.innerHTML = '';
  S.slice(0, cur).forEach(y => (y.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, false, LAY, x.all ? 1 : .55); }));
  (x.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, true, LAY); });
  if (x.closeup) closeup(LAY);
  (x.ring || []).forEach(ring); (x.tags || []).forEach(([p, s, dy]) => tag(p, s, dy));
  document.getElementById('live').hidden = !x.live; if (x.live) livetick();
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
