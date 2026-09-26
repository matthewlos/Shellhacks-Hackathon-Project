
// temp probe wires you already did (dimmed, done)
[[SPLIT, AS.DAT, '#f2c12e', [40, -40]], [SPLIT, AS.VCC, '#d63a31', [40, -40]], [SPLIT, AS.GND, '#222', [40, -40]],
 [AP.DAT, hole(48, 'a'), '#8e44ad', [80, -60]], [EPIN.LD4, hole(48, 'c'), '#8e44ad', [260, -160]],
 [AP.VCC, hole(45, 'a'), '#e67e22', [80, -60]], [EPIN.L3V3, hole(45, 'c'), '#e67e22', [330, -200]],
 [AP.GND, hole(22, 'h'), '#2c7a3a', [140, -160]]].forEach(([a, b, c, bd]) => wire(a, b, c, bd, false, document.getElementById('built'), .6));
document.querySelector('#built text').textContent = 'relay + pump + temp: done ✓, don’t touch';

// soil probe: black board pointing down, its cable ends in a 3-hole plug (GND VCC AOUT)
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
drawSoil();

const S = [
  {h: 'Where you are', p: 'Relay, pump and temp probe all work ✓, leave them alone. Now the soil probe: its cable plug gets 3 wires. I load new test code that reads soil + temp together, pump stays OFF.', zoom: [0, 0, 1600, 900], ring: [[425, 290]]},
  {h: 'Unplug USB', p: 'Pull the USB cable out of the ESP32 while you wire.', zoom: [0, 0, 700, 420], ring: [[EX + 125, EY]], tags: [[[EX + 125, EY - 10], 'unplug', 60]]},
  {h: 'Cable into the probe', p: 'The white plug clicks into the socket on top of the probe. One way only. Already in? Skip.', zoom: [320, 30, 240, 410], ring: [[425, 176]], use: 'The probe’s own cable'},
  {h: 'AOUT → D32', p: 'F-M wire. Pin end into the cable plug’s AOUT hole. Hole end onto D32: RIGHT side, 10th pin down (VIN, GND, D13, D12, D14, D27, D26, D25, D33, D32).', zoom: [40, 40, 520, 480], wires: ['aout'], ring: [CON.AOUT, EPIN.RD32], use: '1 F-M wire', tags: [[EPIN.RD32, 'D32', 46]]},
  {h: 'VCC → the 3V3 line', p: 'Male-male wire. One end into the plug’s VCC hole. Other end into any empty hole in the line with the 2 orange wires (top half, column 45). That line is 3.3V, shared with the temp probe.', zoom: [330, 60, 480, 620], wires: ['vcc'], ring: [CON.VCC, hole(45, 'e')], use: '1 male-male wire', tags: [[hole(45, 'e'), 'orange line', 46]],
    al: 'NOT the 5V (VIN). 3V3 line only.'},
  {h: 'GND → the LEFT leg line', p: 'Male-male wire. One end into the plug’s GND hole. Other end into the LAST empty hole in the transistor’s LEFT leg line (the line with the white wire and the temp GND). One pin per hole.', zoom: [330, 60, 900, 700], wires: ['gnd'], ring: [CON.GND, hole(22, 'f')], use: '1 male-male wire', tags: [[hole(22, 'f'), 'LEFT leg line', -46]]},
  {h: 'Plug in + test', p: 'USB back in. Hold the probe in the air: about 3400. Dip it in a cup of water up to the line: drops to about 1500. The number below is live.', zoom: [0, 0, 1600, 900], all: true, live: true, ring: [[425, 300]], al: 'Only up to the line. The top part is electronics, keep it dry.'},
  {h: 'Into the box', p: 'Push the probe into the soil in the Mainstays box, up to the line. Pump stays in its water cup, tube tip resting on the soil. Temp probe goes in the soil too.', zoom: [0, 0, 1600, 900], all: true, live: true},
];
const WIRES = {aout: [CON.AOUT, EPIN.RD32, '#f2c12e', [-80, -60]], vcc: [CON.VCC, hole(45, 'e'), '#d63a31', [-60, -120]], gnd: [CON.GND, hole(22, 'f'), '#222', [-90, -220]]};

document.querySelector('.side').insertAdjacentHTML('beforeend', '<div class="card" id="live" hidden><div class="k">LIVE · FROM YOUR ESP32</div><div style="color:var(--muted);font-weight:700;margin-top:4px">SOIL (raw)</div><div id="sv" style="font:800 3.2rem/1.05 \'JetBrains Mono\',monospace">–</div><div id="ss" style="font-weight:700"></div><div style="color:var(--muted);font-weight:700;margin-top:12px">TEMP</div><div id="tv" style="font:800 2rem/1.1 \'JetBrains Mono\',monospace">–</div></div>');
async function livetick() {
  if (!S[cur].live) return;
  let d; try { d = await (await fetch('/last?type=sens')).json(); } catch (e) { return; }
  const t = d.last, sv = document.getElementById('sv'), ss = document.getElementById('ss'), tv = document.getElementById('tv');
  if (!t) { sv.textContent = '–'; ss.textContent = d.err || 'No readings yet. Is USB plugged in?'; ss.style.color = 'var(--warn)'; return; }
  const r = t.soil_raw; sv.textContent = r;
  const [msg, col] = r > 3900 ? ['Maxed out: AOUT loose? Check AOUT → D32.', 'var(--warn)'] : r < 200 ? ['Near 0: VCC or GND loose. Check the orange line + LEFT leg line.', 'var(--warn)']
    : r > 2800 ? ['DRY (air or dry soil)', '#b35a00'] : r > 2000 ? ['damp', '#1f64b8'] : ['WET (water / soaked soil)', '#1f9a3a'];
  ss.textContent = msg; ss.style.color = col;
  tv.textContent = t.probes > 0 && t.temp_c > -100 ? t.temp_c.toFixed(1) + ' °C' : 'no temp probe';
}
setInterval(livetick, 1000);

let cur = 0; try { cur = Math.min(S.length - 1, +localStorage.getItem('soil1') || 0); } catch (e) {}
const dots = document.getElementById('dots'); S.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => { cur = i; render(); }; dots.appendChild(d); });
let VB = [0, 0, 1600, 900], zid = 0;
function zoom(to) { const r = svg.clientWidth / Math.max(1, svg.clientHeight); let [x, y, w, h] = to; const cx = x + w / 2, cy = y + h / 2;
  if (w / h > r) h = w / r; else w = h * r; w *= 1.08; h *= 1.08; const T = [cx - w / 2, cy - h / 2, w, h], F = VB.slice(), t0 = performance.now(), id = ++zid;
  const st = t => { if (id !== zid) return; const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); VB = F.map((v, i) => v + (T[i] - v) * e); svg.setAttribute('viewBox', VB.join(' ')); if (k < 1) requestAnimationFrame(st); };
  requestAnimationFrame(st); }
function render() {
  try { localStorage.setItem('soil1', cur); } catch (e) {}
  const x = S[cur];
  document.getElementById('k').textContent = `STEP ${cur + 1} OF ${S.length}`;
  document.getElementById('h').textContent = x.h; document.getElementById('p').textContent = x.p;
  document.getElementById('use').textContent = x.use ? '🔌 ' + x.use : ''; document.getElementById('al').textContent = x.al ? '⚠ ' + x.al : '';
  [...dots.children].forEach((d, i) => d.className = i < cur ? 'done' : i === cur ? 'on' : '');
  LAY.innerHTML = ''; FX.innerHTML = '';
  S.slice(0, cur).forEach(y => (y.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, false, LAY, x.all ? 1 : .55); }));
  (x.wires || []).forEach(id => { const [a, b, c, bd] = WIRES[id]; wire(a, b, c, bd, true, LAY); });
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
