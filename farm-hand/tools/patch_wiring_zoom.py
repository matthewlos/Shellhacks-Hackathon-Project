"""Wiring page: (1) breadboard is plain white; the black MB102 power module is its own part that only appears at
the 'Power module on the board' step (drops in) and stays after; (2) the view zooms to the parts each step is about."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "docs/wiring/index.html"
s = p.read_text(encoding="utf-8")

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80])
    s = s.replace(a, b)

# board tighter: columns start near the left edge, no dead space
rep("const BX = 830, BY = 540, BW = 740, BH = 250;", "const BX = 860, BY = 540, BW = 680, BH = 250;")
rep("const PITCH = 9.6, C0 = BX + 130;", "const PITCH = 9.6, C0 = BX + 34;")

# module: its own group, left end, over columns 1-6
i, j = s.index("  // MB102 power module: sits on the LEFT end"), s.index("  el('circle', {id: 'mled'")
j = s.index("\n", j) + 1
s = s[:i] + "}\nfunction drawModule() {\n" + r"""  // MB102 power module: plugs onto the LEFT end, its pins into both rail pairs (covers columns 1-6)
  const G = g('module');
  el('rect', {x: BX - 8, y: BY - 14, width: 100, height: BH + 28, rx: 6, fill: '#1b1d20', stroke: '#000'}, G);
  el('rect', {x: BX, y: BY + 100, width: 34, height: 26, rx: 3, fill: '#c7ccd1'}, G);
  el('text', {x: BX + 17, y: BY + 142, 'text-anchor': 'middle', fill: '#ddd', 'font-size': 9, 'font-family': 'Arial', 'font-weight': 700}, G).textContent = 'USB IN';
  el('rect', {x: BX + 46, y: BY + 102, width: 30, height: 24, rx: 4, fill: '#222', stroke: '#666'}, G);
  el('text', {x: BX + 61, y: BY + 142, 'text-anchor': 'middle', fill: '#ddd', 'font-size': 9, 'font-family': 'Arial', 'font-weight': 700}, G).textContent = 'ON/OFF';
  [[BY + 8, '3.3V'], [BY + BH - 28, '5V']].forEach(([y, v], k) => {
    el('rect', {id: 'mj' + k, x: BX + 66, y, width: 20, height: 20, rx: 2, fill: '#f2c12e'}, G);
    el('text', {x: BX + 62, y: y + 14, 'text-anchor': 'end', fill: '#f2c12e', 'font-size': 10, 'font-weight': 700, 'font-family': 'Arial'}, G).textContent = v;
  });
  el('circle', {id: 'mled', cx: BX + 40, cy: BY + 175, r: 5, fill: '#113311'}, G);
""" + s[j:]
rep("drawBoard(); drawPump();", "drawBoard(); drawModule(); drawPump();")
rep("callout(BX + 115, BY + 18, '3.3V'); callout(BX + 115, BY + BH - 20, '5V');", "callout(BX + 88, BY + 18, '3.3V'); callout(BX + 88, BY + BH - 18, '5V');")

# rail holes used by wires: move clear of the module (columns 1-6)
import re
MAP = {"2": "10", "5": "13", "8": "20", "10": "22"}
s, n = re.subn(r"COL\((2|5|8|10)\)(?=, RAIL)", lambda m: f"COL({MAP[m.group(1)]})", s)
assert n == 12, n

# render: module appears at its step (drops in), dims with the board; then zoom
rep("  PARTS.forEach(id => { const n = document.getElementById(id); n.classList.toggle('dim', !s.focus.includes(id)); n.classList.toggle('hl', s.focus.includes(id) && s.focus.length <= 3); });",
    """  PARTS.forEach(id => { const n = document.getElementById(id); n.classList.toggle('dim', !s.focus.includes(id)); n.classList.toggle('hl', s.focus.includes(id) && s.focus.length <= 3); });
  const mod = document.getElementById('module'), modAt = S.findIndex(x => x.fx === 'module');
  mod.style.display = cur >= modAt ? '' : 'none';
  mod.classList.toggle('dim', !s.focus.includes('board'));
  mod.style.transition = 'none'; mod.style.transform = '';
  if (cur === modAt) { mod.style.transform = 'translate(0px,-160px)'; mod.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { mod.style.transition = 'transform 1s cubic-bezier(.3,.7,.3,1), opacity .6s'; mod.style.transform = 'translate(0px,0px)'; mod.style.opacity = ''; })); }""")
rep("  // header\n  document.querySelectorAll('#tabs button')", "  zoomTo(s);\n  // header\n  document.querySelectorAll('#tabs button')")

# zoom: fit the step's parts + the ends of its wires + its pins, in the stage's shape, animated
rep("function render() {", r"""let VB = [0, 0, 1600, 900], zoomAnim = 0;
function zoomTo(s) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  s.focus.forEach(id => { const n = document.getElementById(id); if (!n) return; const b = n.getBBox(); add(b.x, b.y); add(b.x + b.width, b.y + b.height); });
  if (s.focus.includes('board')) { const b = document.getElementById('module').getBBox(); add(b.x, b.y); add(b.x + b.width, b.y + b.height); }
  (s.wires || []).forEach(id => { const w = W[id]; [w.pts[0], w.pts[w.pts.length - 1]].forEach(([x, y]) => add(x, y)); });
  (s.pins || []).forEach(([x, y]) => add(x, y));
  const pad = 70; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const r = svg.clientWidth / Math.max(1, svg.clientHeight);
  let w = Math.max(x1 - x0, 420), h = Math.max(y1 - y0, 420 / r);
  if (w / h > r) h = w / r; else w = h * r;
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w > 1600 && h > 900) { w = Math.max(1600, 900 * r); h = w / r; cx = 800; cy = 450; }
  const to = [cx - w / 2, cy - h / 2, w, h], from = VB.slice(), t0 = performance.now(), id = ++zoomAnim;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = t => { if (id !== zoomAnim) return; const k = REDUCE ? 1 : Math.min(1, (t - t0) / 750), e = 1 - Math.pow(1 - k, 3);
    VB = from.map((v, i) => v + (to[i] - v) * e); svg.setAttribute('viewBox', VB.join(' ')); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
addEventListener('resize', () => zoomTo(S[cur]));
function render() {""")
p.write_text(s, encoding="utf-8")
print("ok")
