"""Wiring page: draw Dechante's real ELEGOO 830-point breadboard (63 columns, rows a-e / f-j, +/- rails on both
edges with blue - above red +), fix the step-10 photo, un-cover the VIN/3V3 labels, fix the footer."""
import re
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "docs/wiring/index.html"
s = p.read_text(encoding="utf-8")

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80])
    s = s.replace(a, b)

# ---- breadboard geometry + drawing
i, j = s.index("const BX = 900"), s.index("// ---------------- pump in a cup")
s = s[:i] + r"""const BX = 830, BY = 540, BW = 740, BH = 250;
// ELEGOO 830: seen from above, landscape. Top edge: blue − rail, red + rail. Then rows j i h g f, the middle
// channel, rows e d c b a, then blue − rail, red + rail. 63 numbered columns; holes a-e in one column are joined.
const RAIL = {'GNDt': BY + 16, '3V3': BY + 30, 'GNDb': BY + BH - 30, '5V': BY + BH - 16};
const PITCH = 9.6, C0 = BX + 130;
const COL = i => C0 + i * PITCH;                         // i = 0..62  ->  column i+1
const HALF = {j: 0, i: 1, h: 2, g: 3, f: 4, e: 6, d: 7, c: 8, b: 9, a: 10};
const ROWL = r => BY + 58 + HALF[r] * 14.5;
const ROWY = k => ROWL(['e', 'd', 'c', 'b', 'a'][k]); // bottom half, e first
function drawBoard() {
  const G = g('board');
  el('rect', {x: BX, y: BY, width: BW, height: BH, rx: 8, fill: '#f3f2ec', stroke: '#c8c8c0'}, G);
  el('rect', {x: C0 - 14, y: ROWL('f') + 8, width: 63 * PITCH + 18, height: 13, rx: 2, fill: '#e2e1da'}, G);   // middle channel
  [[RAIL.GNDt, '#1e5bd6', '−'], [RAIL['3V3'], '#d32f2f', '+'], [RAIL.GNDb, '#1e5bd6', '−'], [RAIL['5V'], '#d32f2f', '+']].forEach(([y, c, lab], k) => {
    const off = k % 2 ? 7 : -7;
    el('line', {x1: C0 - 10, x2: COL(62) + 8, y1: y + off, y2: y + off, stroke: c, 'stroke-width': 1.6}, G);
    for (let i = 0; i < 63; i++) if (i % 6 !== 5) el('rect', {x: COL(i) - 2, y: y - 2, width: 4, height: 4, fill: '#3a3a3a'}, G);   // rails: groups of 5
    el('text', {x: COL(62) + 16, y: y + 4, fill: c, 'font-size': 13, 'font-weight': 800, 'font-family': 'Arial'}, G).textContent = lab;
  });
  for (const r of 'jihgfedcba') {
    for (let i = 0; i < 63; i++) el('rect', {x: COL(i) - 2, y: ROWL(r) - 2, width: 4, height: 4, fill: '#3a3a3a'}, G);
    el('text', {x: C0 - 20, y: ROWL(r) + 3.5, 'text-anchor': 'middle', fill: '#777', 'font-size': 9, 'font-family': 'Arial', 'font-weight': 700}, G).textContent = r;
  }
  for (const n of [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]) {
    el('text', {x: COL(n - 1), y: ROWL('j') - 9, 'text-anchor': 'middle', fill: '#777', 'font-size': 8, 'font-family': 'Arial'}, G).textContent = n;
    el('text', {x: COL(n - 1), y: ROWL('a') + 15, 'text-anchor': 'middle', fill: '#777', 'font-size': 8, 'font-family': 'Arial'}, G).textContent = n;
  }
  // MB102 power module: sits on the LEFT end, its pins in both rail pairs
  el('rect', {x: BX + 6, y: BY - 12, width: 116, height: BH + 24, rx: 6, fill: '#1b1d20', stroke: '#000'}, G);
  el('rect', {x: BX + 14, y: BY + 100, width: 34, height: 26, rx: 3, fill: '#c7ccd1'}, G);
  el('text', {x: BX + 31, y: BY + 142, 'text-anchor': 'middle', fill: '#ddd', 'font-size': 9, 'font-family': 'Arial', 'font-weight': 700}, G).textContent = 'USB IN';
  el('rect', {x: BX + 62, y: BY + 102, width: 30, height: 24, rx: 4, fill: '#222', stroke: '#666'}, G);
  el('text', {x: BX + 77, y: BY + 142, 'text-anchor': 'middle', fill: '#ddd', 'font-size': 9, 'font-family': 'Arial', 'font-weight': 700}, G).textContent = 'ON/OFF';
  [[BY + 10, '3.3V'], [BY + BH - 30, '5V']].forEach(([y, v], k) => {
    el('rect', {id: 'mj' + k, x: BX + 96, y, width: 20, height: 20, rx: 2, fill: '#f2c12e'}, G);
    el('text', {x: BX + 92, y: y + 14, 'text-anchor': 'end', fill: '#f2c12e', 'font-size': 10, 'font-weight': 700, 'font-family': 'Arial'}, G).textContent = v;
  });
  el('circle', {id: 'mled', cx: BX + 60, cy: BY + 175, r: 5, fill: '#113311'}, G);
}

""" + s[j:]

# rail/pin users that assumed the old 29-column board
rep("[COL(26), RAIL['5V']], [COL(26) + 40, RAIL['5V'] - 60]", "[COL(60), RAIL['5V']], [COL(60) + 30, RAIL['5V'] + 40]")
rep("[CX - 20, CY + 200], [COL(27) + 30, RAIL.GNDb + 30], [COL(27), RAIL.GNDb]", "[CX - 20, CY + 200], [COL(62) + 20, RAIL.GNDb - 30], [COL(62), RAIL.GNDb]")
rep("[RT.NO, [COL(27), RAIL.GNDb]]", "[RT.NO, [COL(62), RAIL.GNDb]]")

# step 10: his photo + clearer words (regex: the line has an escaped apostrophe)
s, n = re.subn(r"\{part: 2, t: 'Power module on the board', p: '[^\n]*?photo: 'mm'\},",
               "{part: 2, t: 'Power module on the board', use: 'No wire: the black power module itself', p: 'LEFT end of the breadboard (column 1 side). Its pins go into the 4 long rail rows, top and bottom. Match its + / − to the red + / blue − lines, then press down hard. Yellow jumpers: top side 3.3V, bottom side 5V. Nothing in its USB yet.', focus: ['board'], fx: 'module', photo: 'bb'},", s)
assert n == 1, n
rep("mm: ['../parts/wires.jpg', 29.5, 26.7, 68.5, 30.7],", "mm: ['../parts/wires.jpg', 29.5, 26.7, 68.5, 30.7], bb: ['../parts/breadboard_module.jpg', 10, 10, 88, 88],")
rep("function crop(key) {\n  const [src, x, y, w, h] = PH[key]; const c = document.getElementById('crop');",
    "function crop(key) {\n  const [src, x, y, w, h] = PH[key]; const c = document.getElementById('crop'); c.onclick = () => window.open(src, '_blank');")
rep('<div class="crop" id="crop"></div>', '<div class="crop" id="crop" title="tap to open full size" style="cursor:zoom-in"></div>')

# rail + row names in the text now match what's printed on his board
s = s.replace("One end into the top GND (−) rail, other end screwed into DC−.", "One end into the TOP blue (−) rail, other end screwed into DC−.")
s = s.replace("Pin end into the top GND (−) rail.", "Pin end into the TOP blue (−) rail (the very top row of holes).")
s = s.replace("One end in the bottom 5V (+) rail, other end screwed into COM.", "One end in the BOTTOM red (+) rail (the very bottom row), other end screwed into COM.")
s = s.replace("Pump black → bottom GND (−) rail.", "Pump black → BOTTOM blue (−) rail.")
s = s.replace("p: 'DAT → a breadboard row. ESP32 pin 4 → the SAME row. The row joins them.'",
              "p: 'DAT wire → column 15, hole d. ESP32 D4 wire → column 15, hole c. Holes a to e in one column are joined inside, so they connect.'")

# ESP32 buttons below the last pin row so VIN / 3V3 labels show
rep("const EX = 560, EY = 90, EW = 220, EH = 560;", "const EX = 560, EY = 90, EW = 220, EH = 590;")
rep("el('rect', {x: bx, y: EY + 500, width: 26, height: 20,", "el('rect', {x: bx, y: EY + 524, width: 26, height: 20,")
rep("el('rect', {x: bx + 8, y: EY + 505, width: 10,", "el('rect', {x: bx + 8, y: EY + 529, width: 10,")
rep("el('text', {x: bx + 13, y: EY + 534,", "el('text', {x: bx + 13, y: EY + 556,")
rep("Pin spots match the standard 38-pin ESP32 DevKit. Always go by the <b>label printed on your board</b>.",
    "Drawn to match your 30-pin ESP32 (USB-C) and ELEGOO 830 breadboard. Always go by the <b>label printed on your board</b>.")
p.write_text(s, encoding="utf-8")
print("ok")
