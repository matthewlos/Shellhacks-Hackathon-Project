
// ---------- the whole build, from a bare board, in the order it was proven on 2026-09-23 ----------
function wire(a, b, c, bend, animate, p, opacity) {
  const d = `M ${a[0]} ${a[1]} C ${a[0]} ${a[1] + bend[0]}, ${b[0]} ${b[1] + bend[1]}, ${b[0]} ${b[1]}`;
  el('path', {d, fill: 'none', stroke: 'rgba(0,0,0,.25)', 'stroke-width': 10, 'stroke-linecap': 'round', transform: 'translate(2 3)', opacity: opacity ?? 1}, p);
  const w = el('path', {d, fill: 'none', stroke: c, 'stroke-width': 8, 'stroke-linecap': 'round', opacity: opacity ?? 1}, p);
  if (animate) { w.style.setProperty('--len', w.getTotalLength()); w.classList.add('draw'); }
}
// pump in its cup
const PX = 1470, PY = 150, PUMP = {red: [PX - 16, PY - 40], blk: [PX + 16, PY - 40]};
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
// temp probe adapter: screws on top (probe wires), pins on the bottom (DAT VCC GND)
const AX = 560, AY = 170, AW = 240, AH = 130;
const AS = {DAT: [622, AY + 32], VCC: [679, AY + 32], GND: [737, AY + 32]}, AP = {DAT: [622, AY + AH - 14], VCC: [679, AY + AH - 14], GND: [737, AY + AH - 14]};
const PROBE = [440, 70], SPLIT = [600, 90];
function drawAdapter() {
  const G = grp('adapter');
  el('rect', {x: AX, y: AY, width: AW, height: AH, rx: 10, fill: '#1f5fbf', stroke: '#143f80', 'stroke-width': 2}, G);
  el('rect', {x: AX + 30, y: AY + 10, width: 180, height: 44, rx: 5, fill: '#2e8b3e'}, G);
  Object.values(AS).forEach(([x, y]) => { el('circle', {cx: x, cy: y, r: 14, fill: '#d7dce0', stroke: '#888'}, G); el('line', {x1: x - 9, x2: x + 9, y1: y, y2: y, stroke: '#555', 'stroke-width': 3}, G); });
  Object.entries(AP).forEach(([n, [x, y]]) => { el('rect', {x: x - 5, y: y - 10, width: 10, height: 26, fill: '#d9b35c'}, G); txt(x, y - 20, n, {'text-anchor': 'middle', fill: '#fff', 'font-size': 15}, G); });
  txt(AX + 20, AY + 76, 'adapter', {fill: '#cfe0ff', 'font-size': 13}, G);
  el('rect', {x: PROBE[0] - 120, y: PROBE[1] - 12, width: 110, height: 24, rx: 12, fill: '#b9c0c8', stroke: '#8a939c'}, G);
  el('path', {d: `M ${PROBE[0] - 10} ${PROBE[1]} C ${PROBE[0] + 60} ${PROBE[1]}, 560 ${PROBE[1]}, 600 ${PROBE[1] + 20}`, fill: 'none', stroke: '#111', 'stroke-width': 10, 'stroke-linecap': 'round'}, G);
  txt(PROBE[0] - 65, PROBE[1] - 22, 'temp probe', {'text-anchor': 'middle', fill: 'var(--ink2)', 'font-size': 15}, G);
}
// soil probe + its 3-hole cable plug (GND VCC AOUT)
const CON = {GND: [385, 120], VCC: [425, 120], AOUT: [465, 120]};
function drawSoil() {
  const G = grp('soil');
  el('rect', {x: 365, y: 104, width: 120, height: 32, rx: 5, fill: '#f2f2f2', stroke: '#999', 'stroke-width': 2}, G);
  Object.entries(CON).forEach(([n, [x, y]]) => { el('rect', {x: x - 6, y: y - 6, width: 12, height: 12, fill: '#222'}, G); txt(x, y - 22, n, {'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 12}, G); });
  ['#222', '#d63a31', '#f2c12e'].forEach((c, k) => el('path', {d: `M ${385 + k * 40} 136 C ${385 + k * 40} 160, ${415 + k * 10} 150, ${415 + k * 10} 176`, fill: 'none', stroke: c, 'stroke-width': 4}, G));
  el('path', {d: 'M 395 176 L 455 176 L 455 380 L 425 410 L 395 380 Z', fill: '#1d1d1f'}, G);
  el('line', {x1: 388, x2: 462, y1: 240, y2: 240, stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '6 4'}, G);
  txt(470, 246, 'line', {fill: 'var(--ink2)', 'font-size': 13}, G);
  txt(425, 300, 'SOIL', {'text-anchor': 'middle', fill: '#ddd', 'font-size': 14}, G);
}
// transistor (legs j22 j21 j20 = LEFT/E, MIDDLE/B, RIGHT/C, flat side facing you) and the 1K resistor (f21 -> f15)
function drawTransistor() {
  const G = grp('tr'), y = rowY('j');
  el('path', {d: `M ${colX(22) - 12} ${y - 52} L ${colX(20) + 12} ${y - 52} L ${colX(20) + 12} ${y - 18} A 36 10 0 0 1 ${colX(22) - 12} ${y - 18} Z`, fill: '#1d1d1f'}, G);
  [20, 21, 22].forEach(n => el('rect', {x: colX(n) - 2, y: y - 20, width: 4, height: 20, fill: '#c9ccd0'}, G));
  [['L', 22], ['M', 21], ['R', 20]].forEach(([l, n]) => txt(colX(n), y - 30, l, {'text-anchor': 'middle', fill: '#fff', 'font-size': 12}, G));
}
function drawResistor() {
  const G = grp('res'), ry = rowY('f'), x1 = colX(21), x2 = colX(15);
  el('line', {x1, x2, y1: ry, y2: ry, stroke: '#c9ccd0', 'stroke-width': 4}, G);
  el('rect', {x: x1 + 22, y: ry - 11, width: x2 - x1 - 44, height: 22, rx: 10, fill: '#8fb4d6', stroke: '#6f93b3'}, G);
  [.15, .32, .49, .8].forEach((f, i) => el('rect', {x: x1 + 22 + (x2 - x1 - 44) * f, y: ry - 11, width: 8, height: 22, fill: ['#6b3a1e', '#111', '#c8281e', '#c09a3c'][i]}, G));
}
drawBoard(); drawESP(); drawRelay(); drawPump(); drawAdapter(); drawSoil(); drawTransistor(); drawResistor();
const LAY = el('g'), FX = el('g');
const ring = ([x, y]) => el('circle', {cx: x, cy: y, r: 20, fill: 'none', stroke: '#ffd23f', 'stroke-width': 5, class: 'pulse'}, FX);
function tag([x, y], s, dy = -40) { const w = s.length * 10 + 22, G = el('g', {}, FX);
  el('line', {x1: x, y1: y, x2: x, y2: y + dy + (dy < 0 ? 14 : -14), stroke: '#0e1621', 'stroke-width': 2, 'stroke-dasharray': '4 3'}, G);
  el('rect', {x: x - w / 2, y: y + dy - 14, width: w, height: 30, rx: 8, fill: '#0e1621'}, G);
  txt(x, y + dy + 6, s, {'text-anchor': 'middle', fill: '#fff', 'font-size': 16}, G); }

const WIRES = {
  vin: [EPIN.RVIN, RS['DC+'], '#d63a31', [0, 0]], rgnd: [EPIN.RGND, RS['DC−'], '#222', [0, 0]],
  d26: [EPIN.RD26, hole(15, 'g'), '#777', [120, -200]], wgnd: [EPIN.LGND, hole(22, 'g'), '#e8e8e8', [300, -120]], inw: [hole(20, 'g'), RS.IN, '#d63a31', [-200, 0]],
  jump: [RS['DC+'], RO.COM, '#f2c12e', [-110, -110]], pred: [PUMP.red, RO.NO, '#d63a31', [-60, -90]], pblk: [PUMP.blk, RS['DC−'], '#222', [-160, -220]],
  tyel: [SPLIT, AS.DAT, '#f2c12e', [40, -40]], tred: [SPLIT, AS.VCC, '#d63a31', [40, -40]], tblk: [SPLIT, AS.GND, '#222', [40, -40]],
  dat: [AP.DAT, hole(48, 'a'), '#8e44ad', [80, -60]], d4: [EPIN.LD4, hole(48, 'c'), '#8e44ad', [260, -160]],
  vcc: [AP.VCC, hole(45, 'a'), '#e67e22', [80, -60]], v33: [EPIN.L3V3, hole(45, 'c'), '#e67e22', [330, -200]], tgnd: [AP.GND, hole(22, 'h'), '#2c7a3a', [140, -160]],
  aout: [CON.AOUT, EPIN.RD32, '#f2c12e', [-80, -60]], svcc: [CON.VCC, hole(45, 'e'), '#d63a31', [-60, -120]], sgnd: [CON.GND, hole(22, 'f'), '#222', [-90, -220]],
};
const ALL = [0, 0, 1600, 900], ESPZ = [0, 0, 700, 420], RELZ = [860, 0, 740, 420], TRZ = [960, 560, 420, 280], ADZ = [300, 20, 560, 320], BRD = [0, 60, 1200, 760];
const S = [
  // ---- Part 1: relay, driven through the transistor
  {part: 'Relay', h: 'Parts on the table', p: 'ESP32 + USB-C DATA cable, breadboard, relay module (SONGLE), 1 transistor (PN2222, small black half-round, 3 legs), 1 resistor (brown-black-red-gold = 1K), pump + cup of water, temp probe + blue adapter, soil probe + cable, F-M and male-male jumper wires.', zoom: ALL,
    al: 'Transistor printed P2N2222A instead of PN2222? Its legs are reversed. Check before you start.'},
  {part: 'Relay', h: 'USB out', p: 'Nothing is plugged into the ESP32 while you wire. Every step.', zoom: ESPZ, ring: [[EX + 125, EY]]},
  {part: 'Relay', h: 'Relay jumper on L', p: 'The little black cap next to the L and H letters on the relay: push it onto the L side. With the transistor, L is right. (H never clicked.)', zoom: RELZ, jumper: true, ring: [[RX + 344, RY + 230]]},
  {part: 'Relay', h: 'VIN → relay DC+', p: 'F-M wire. Hole end onto VIN (RIGHT side, top pin, next to USB; it may be printed “VN”). Pin end into the relay’s DC+ screw: loosen, push in, tighten, tug. This is the relay’s 5V.', zoom: [0, 0, 1350, 420], wires: ['vin'], ring: [EPIN.RVIN, RS['DC+']], use: '1 F-M wire'},
  {part: 'Relay', h: 'GND → relay DC−', p: 'F-M wire. Hole end onto the RIGHT side GND (2nd pin, under VIN). Pin end into the DC− screw. Tighten, tug.', zoom: [0, 0, 1350, 420], wires: ['rgnd'], ring: [EPIN.RGND, RS['DC−']], use: '1 F-M wire'},
  {part: 'Relay', h: 'Transistor in', p: 'Bottom half, the row next to the bottom rail. Flat side (the printed side) facing you. 3 legs in 3 side-by-side holes: LEFT leg, MIDDLE leg, RIGHT leg. Tonight: columns 22, 21, 20.', zoom: TRZ, add: ['tr'], ring: [hole(22, 'j'), hole(21, 'j'), hole(20, 'j')], use: 'The transistor'},
  {part: 'Relay', h: 'Resistor in', p: 'One resistor leg in the MIDDLE leg’s line (same column, any hole above it). Other leg 6 columns to the right (column 15). The resistor must never share the LEFT leg’s line.', zoom: TRZ, add: ['res'], ring: [hole(21, 'f'), hole(15, 'f')], use: 'The 1K resistor'},
  {part: 'Relay', h: 'D26 → resistor’s far end', p: 'F-M wire (gray tonight). Hole end onto D26: RIGHT side, 7th pin down. Pin end into the column-15 line, right next to the resistor leg.', zoom: BRD, wires: ['d26'], ring: [EPIN.RD26, hole(15, 'g')], use: '1 F-M wire'},
  {part: 'Relay', h: 'GND → LEFT leg line', p: 'F-M wire (white tonight). Hole end onto the LEFT side GND (2nd pin, under 3V3). Pin end into an empty hole in the transistor’s LEFT leg line. This line is ground from now on.', zoom: BRD, wires: ['wgnd'], ring: [EPIN.LGND, hole(22, 'g')], use: '1 F-M wire'},
  {part: 'Relay', h: 'RIGHT leg line → relay IN', p: 'Male-male wire (red tonight). One end into the RIGHT leg’s line. Other end into the relay’s IN screw. Tighten, tug.', zoom: [760, 20, 800, 820], wires: ['inw'], ring: [hole(20, 'g'), RS.IN], use: '1 male-male wire'},
  {part: 'Relay', h: 'Check: it clicks', p: 'USB in. Open http://127.0.0.1:8096 (raw serial page), type P A 3000, Enter. Relay clicks, red LED1 on, 3 s later clicks off. Proven 2026-09-23.', zoom: RELZ, ring: [RS.IN], check: true},
  // ---- Part 2: pump
  {part: 'Pump', h: 'USB out, pump in the cup', p: 'Unplug USB. Pump fully under water in its cup. Never run it dry.', zoom: [1330, 0, 270, 420], add: ['pump'], ring: [[PX, PY + 100]]},
  {part: 'Pump', h: 'Jumper DC+ → COM', p: 'Male-male wire. Into the DC+ screw NEXT TO the wire already there. Other end into COM (middle screw, far side). Gives the pump 5V to switch.', zoom: RELZ, wires: ['jump'], ring: [RS['DC+'], RO.COM], use: '1 male-male wire'},
  {part: 'Pump', h: 'Pump red → NO', p: 'Pump’s red wire into the NO screw (top, far side). NO = power only when the relay clicks on.', zoom: RELZ, wires: ['pred'], ring: [RO.NO, PUMP.red]},
  {part: 'Pump', h: 'Pump black → DC−', p: 'Pump’s black wire into the DC− screw, next to the wire already there.', zoom: RELZ, wires: ['pblk'], ring: [RS['DC−'], PUMP.blk]},
  {part: 'Pump', h: 'Check: it pumps', p: 'USB in. Send P A 3000: water for 3 s. Tonight a 10 s pour (P A 10000) ran on USB with zero restarts, so no 9V adapter needed.', zoom: [860, 0, 740, 420], check: true, ring: [[PX, PY + 100]]},
  // ---- Part 3: temp probe
  {part: 'Temp', h: 'Probe wires → adapter', p: 'USB out. Probe’s bare wires into the green screws: yellow → DAT, red → VCC, black → GND (match the letters on your adapter).', zoom: ADZ, add: ['adapter'], wires: ['tyel', 'tred', 'tblk'], ring: [AS.DAT, AS.VCC, AS.GND]},
  {part: 'Temp', h: 'DAT → a48, D4 → c48', p: '2 F-M wires, TOP half. Adapter DAT pin → a48. ESP32 D4 (LEFT side, 5th pin: 3V3, GND, D15, D2, D4) → c48. Same column = connected.', zoom: BRD, wires: ['dat', 'd4'], ring: [AP.DAT, EPIN.LD4, hole(48, 'a'), hole(48, 'c')], use: '2 F-M wires'},
  {part: 'Temp', h: 'VCC → a45, 3V3 → c45', p: '2 F-M wires. Adapter VCC pin → a45. ESP32 3V3 (LEFT side, top pin) → c45. Column 45 is now the 3.3V line (the orange one).', zoom: BRD, wires: ['vcc', 'v33'], ring: [AP.VCC, EPIN.L3V3, hole(45, 'a'), hole(45, 'c')], use: '2 F-M wires'},
  {part: 'Temp', h: 'Adapter GND → LEFT leg line', p: 'F-M wire. Adapter GND pin → an empty hole in the transistor’s LEFT leg line. One pin per hole.', zoom: [520, 150, 700, 660], wires: ['tgnd'], ring: [AP.GND, hole(22, 'h')], use: '1 F-M wire'},
  // ---- Part 4: soil probe
  {part: 'Soil', h: 'Cable into the soil probe', p: 'White plug clicks into the socket on top of the probe. One way only.', zoom: [320, 30, 240, 410], add: ['soil'], ring: [[425, 176]]},
  {part: 'Soil', h: 'AOUT → D32', p: 'F-M wire. Pin end into the plug’s AOUT hole. Hole end onto D32: RIGHT side, 10th pin down.', zoom: [40, 40, 520, 480], wires: ['aout'], ring: [CON.AOUT, EPIN.RD32], use: '1 F-M wire'},
  {part: 'Soil', h: 'VCC → the 3.3V line', p: 'Male-male wire. Plug’s VCC hole → an empty hole in column 45 (the orange line). NOT VIN.', zoom: [330, 60, 480, 620], wires: ['svcc'], ring: [CON.VCC, hole(45, 'e')], use: '1 male-male wire'},
  {part: 'Soil', h: 'GND → LEFT leg line', p: 'Male-male wire. Plug’s GND hole → the last empty hole in the LEFT leg line.', zoom: [330, 60, 900, 700], wires: ['sgnd'], ring: [CON.GND, hole(22, 'f')], use: '1 male-male wire'},
  // ---- Done
  {part: 'Done', h: 'Check everything', p: 'USB in. Raw serial page shows a reading line every second: a_pct (soil %) and temp_c. Send P A 3000: pump runs. Proven 2026-09-23: soil 44%, temp 26.1 °C, a 10 s pour took soil 44% → 52%.', zoom: ALL, all: true, check: true},
  {part: 'Done', h: 'Into the box', p: 'Soil probe into the Mainstays box up to the line, against the front wall. Temp probe in the soil. Pump in its water cup, tube tip on the soil. Then run the laptop: .venv\\Scripts\\python laptop\\server.py → http://127.0.0.1:8080.', zoom: ALL, all: true},
];

let cur = 0; try { cur = Math.min(S.length - 1, +localStorage.getItem('asm1') || 0); } catch (e) {}
const qs = +new URLSearchParams(location.search).get('step'); if (qs >= 1 && qs <= S.length) cur = qs - 1;   // ?step=16 opens step 16
const dots = document.getElementById('dots'); S.forEach((s, i) => { const d = document.createElement('i'); d.title = s.part + ': ' + s.h; d.onclick = () => { cur = i; render(); }; dots.appendChild(d); });
let VB = [0, 0, 1600, 900], zid = 0;
function zoom(to) { const r = svg.clientWidth / Math.max(1, svg.clientHeight); let [x, y, w, h] = to; const cx = x + w / 2, cy = y + h / 2;
  if (w / h > r) h = w / r; else w = h * r; w *= 1.08; h *= 1.08; const T = [cx - w / 2, cy - h / 2, w, h], F = VB.slice(), t0 = performance.now(), id = ++zid;
  const st = t => { if (id !== zid) return; const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); VB = F.map((v, i) => v + (T[i] - v) * e); svg.setAttribute('viewBox', VB.join(' ')); if (k < 1) requestAnimationFrame(st); };
  requestAnimationFrame(st); }
const jumpAt = S.findIndex(s => s.jumper);
function render() {
  try { localStorage.setItem('asm1', cur); } catch (e) {}
  const x = S[cur];
  document.getElementById('k').textContent = `${x.part.toUpperCase()} · STEP ${cur + 1} OF ${S.length}`;
  document.getElementById('h').textContent = x.h; document.getElementById('p').textContent = x.p;
  document.getElementById('use').textContent = x.use ? '🔌 ' + x.use : ''; document.getElementById('al').textContent = x.al ? '⚠ ' + x.al : '';
  [...dots.children].forEach((d, i) => d.className = i < cur ? 'done' : i === cur ? 'on' : '');
  const shown = new Set(S.slice(0, cur + 1).flatMap(s => s.add || []));
  ['pump', 'adapter', 'soil', 'tr', 'res'].forEach(id => { document.getElementById(id).style.display = shown.has(id) ? '' : 'none'; });
  cap.setAttribute('x', cur >= jumpAt ? RX + 327 : RX + 351);
  LAY.innerHTML = ''; FX.innerHTML = '';
  S.slice(0, cur).forEach(y => (y.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, false, LAY, x.all ? 1 : .55); }));
  (x.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, true, LAY); });
  (x.ring || []).forEach(ring); (x.tags || []).forEach(([p, s, dy]) => tag(p, s, dy));
  zoom(x.zoom);
  document.getElementById('back').disabled = cur === 0; document.getElementById('next').textContent = cur === S.length - 1 ? 'Done ✓' : 'Next →';
}
document.getElementById('next').onclick = () => { if (cur < S.length - 1) { cur++; render(); } };
document.getElementById('back').onclick = () => { if (cur > 0) { cur--; render(); } };
document.getElementById('zfit').onclick = () => zoom(ALL);
document.getElementById('zstep').onclick = () => zoom(S[cur].zoom);
addEventListener('keydown', e => { if (e.key === 'ArrowRight') document.getElementById('next').click(); if (e.key === 'ArrowLeft') document.getElementById('back').click(); });
addEventListener('resize', () => zoom(S[cur].zoom));
render();
