"""Wiring page: (1) stable zoom (part boxes measured once at load, before any animation moves them), (2) click any
wire to see where it goes, (3) live power overlay when served from tools/power_page.py (reads the ESP32 probes:
D34 = relay DC+ screw, D35 = relay NO screw / pump red), plus 2 new steps that add those sensing wires."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "docs/wiring/index.html"
s = p.read_text(encoding="utf-8")

def rep(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80])
    s = s.replace(a, b)

# ---------- (1) zoom from boxes measured once
rep("  s.focus.forEach(id => { const n = document.getElementById(id); if (!n) return; const b = n.getBBox(); add(b.x, b.y); add(b.x + b.width, b.y + b.height); });\n"
    "  if (s.focus.includes('board')) { const b = document.getElementById('module').getBBox(); add(b.x, b.y); add(b.x + b.width, b.y + b.height); }",
    "  s.focus.forEach(id => { const b = BOX[id]; if (!b) return; add(b.x, b.y); add(b.x + b.width, b.y + b.height); });\n"
    "  if (s.focus.includes('board') && !s.noModule) { const b = BOX.module; add(b.x, b.y); add(b.x + b.width, b.y + b.height); }")
rep("let VB = [0, 0, 1600, 900], zoomAnim = 0;",
    "let VB = [0, 0, 1600, 900], zoomAnim = 0;\nconst BOX = {};   // each part's box, measured once at load (animations move parts; zoom must not follow them)\n"
    "['esp', 'probe', 'cable', 'relay', 'board', 'module', 'pump', 'temp', 'usb', 'charger'].forEach(id => { const n = document.getElementById(id); if (n) { const b = n.getBBox(); BOX[id] = {x: b.x, y: b.y, width: b.width, height: b.height}; } });")

# ---------- (2) clickable wires
INFO = {
 'p_gnd': ('Soil probe cable GND hole', 'ESP32 GND', 'F-M jumper'), 'p_vcc': ('Soil probe cable VCC hole', 'ESP32 3V3', 'F-M jumper'),
 'p_aout': ('Soil probe cable AOUT hole', 'ESP32 D32', 'F-M jumper'), 'r_vcc': ('ESP32 VIN (5V)', 'Relay DC+ screw', 'F-M jumper'),
 'r_gnd': ('Breadboard top blue − row', 'Relay DC− screw', 'male-male jumper'), 'r_in': ('ESP32 D26', 'Relay IN screw', 'F-M jumper'),
 'com': ('Breadboard bottom red + row', 'Relay COM screw', 'male-male jumper'), 'pumpR': ('Pump red wire', 'Relay NO screw', 'pump’s own wire'),
 'pumpB': ('Pump black wire', 'Breadboard bottom blue − row', 'pump’s own wire'), 'e_gnd': ('ESP32 GND', 'Breadboard top blue − row', 'F-M jumper'),
 't_red': ('Temp probe red', 'Adapter VCC screw', 'probe’s own wire'), 't_blk': ('Temp probe black', 'Adapter GND screw', 'probe’s own wire'),
 't_yel': ('Temp probe yellow', 'Adapter DAT screw', 'probe’s own wire'), 't_vcc': ('Adapter VCC pin', 'Breadboard top red + row (3.3V)', 'F-M jumper'),
 't_gnd': ('Adapter GND pin', 'Breadboard top blue − row', 'F-M jumper'), 't_dat': ('Adapter DAT pin', 'Breadboard column 15, hole d', 'F-M jumper'),
 'v_rail': ('ESP32 VIN (5V)', 'Breadboard bottom red + row, column 41', 'F-M jumper'), 'dcp_rail': ('Relay DC+ screw', 'Breadboard bottom red + row, column 45', 'male-male jumper'),
 'pumpB2': ('Pump black wire', 'Breadboard top blue − row, column 31', 'pump’s own wire'), 'e_d4': ('ESP32 D4', 'Breadboard column 15, hole c', 'F-M jumper'),
 's_a': ('ESP32 D34 (sensor A)', 'Relay DC+ screw (shares the screw)', 'F-M jumper'), 's_b': ('ESP32 D35 (sensor B)', 'Relay NO screw (shares the screw with pump red)', 'F-M jumper'),
}
js = "const INFO = {" + ", ".join(f"{k}: [{a!r}, {b!r}, {c!r}]" for k, (a, b, c) in INFO.items()) + "};\n"
rep("const wireLayer = el('g', {id: 'wires'});", js + "const wireLayer = el('g', {id: 'wires'});")
rep("""  const w = W[id], G = el('g', {class: 'wire', 'data-id': id}, wireLayer);
  const d = smooth(w.pts);""",
"""  const w = W[id], G = el('g', {class: 'wire', 'data-id': id}, wireLayer);
  const d = smooth(w.pts);
  el('path', {d, fill: 'none', stroke: 'transparent', 'stroke-width': 22, style: 'cursor:pointer'}, G);     // fat invisible hit area
  G.style.cursor = 'pointer'; G.addEventListener('click', e => { e.stopPropagation(); pickWire(id); });""")
rep("function render() {", """let picked = null;
function pickWire(id) {
  picked = id; const w = W[id], i = INFO[id] || ['?', '?', '?'];
  wireLayer.querySelectorAll('.wire').forEach(g => { g.style.opacity = g.dataset.id === id ? '1' : '.15'; });
  const box = document.getElementById('wireInfo');
  box.hidden = false;
  box.innerHTML = `<div class="k">THIS WIRE</div><div class="wl"><span class="sw" style="background:${C[w.c]}"></span><b>${i[2]}</b></div>
    <div class="ft"><span>FROM</span>${i[0]}</div><div class="ft"><span>TO</span>${i[1]}</div><button id="unpick">show all wires</button>`;
  document.getElementById('unpick').onclick = unpick;
  fx.querySelectorAll('.pick').forEach(n => n.remove());
  [w.pts[0], w.pts[w.pts.length - 1]].forEach(([x, y]) => el('circle', {cx: x, cy: y, r: 12, fill: 'none', stroke: '#ffd23f', 'stroke-width': 4, class: 'pulse pick'}, fx));
}
function unpick() { picked = null; document.getElementById('wireInfo').hidden = true; fx.querySelectorAll('.pick').forEach(n => n.remove()); render(); }
svg.addEventListener('click', () => { if (picked) unpick(); });
function render() {
  picked = null; const wi = document.getElementById('wireInfo'); if (wi) wi.hidden = true;""")
rep('<div class="serial" id="serial" hidden></div>',
    '<div class="serial" id="serial" hidden></div>\n    <div class="winfo" id="wireInfo" hidden></div>\n    <div class="live" id="live" hidden></div>')
rep("footer{display:flex;", """.winfo,.live{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.winfo .k,.live .k{font:700 12px "JetBrains Mono",monospace;color:var(--ai);letter-spacing:.06em}
.winfo .wl{display:flex;gap:10px;align-items:center;margin:6px 0 8px;font-size:15px}.winfo .sw{width:34px;height:8px;border-radius:4px;border:1px solid rgba(0,0,0,.3)}
.winfo .ft{display:grid;grid-template-columns:52px 1fr;gap:6px;margin:4px 0;font-weight:700}.winfo .ft span{font:700 11px "JetBrains Mono";color:var(--muted);padding-top:3px}
.winfo button{margin-top:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer}
.live .row{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;margin:7px 0;font-weight:700}
.live .d{width:14px;height:14px;border-radius:50%;background:#777}.live .v{font:700 13px "JetBrains Mono"}
.live .note{color:var(--muted);font-size:13px;margin-top:6px}
footer{display:flex;""")

# ---------- (3) live power: only when served by the power page (same origin as /data)
rep("render();\n</script>", r"""render();
// live power from the ESP32 probes (sensor A on D34 -> relay DC+, sensor B on D35 -> relay NO = pump red)
const liveOn = location.protocol.startsWith('http');
const glow = el('g', {id: 'glow'});
async function livetick() {
  let d; try { d = await (await fetch('/data')).json(); } catch (e) { return; }
  const p = (d.pts || []).slice(-1)[0], L = document.getElementById('live'); L.hidden = false;
  if (!p) { L.innerHTML = '<div class="k">LIVE POWER</div><div class="note">No readings. Is the ESP32 plugged in with the power_probe code?</div>'; return; }
  const st = mv => mv >= 3000 ? ['POWER', '#2fbf4a'] : mv < 150 ? ['no power', '#d84a4a'] : ['loose / not touching', '#f0a040'];
  const [a, ac] = st(p.a_mv), [b, bc] = st(p.b_mv), inOn = p.relay_in === 'LOW';
  L.innerHTML = `<div class="k">LIVE POWER · from your ESP32</div>
    <div class="row"><span class="d" style="background:#2fbf4a"></span><span>ESP32 running</span><span class="v">yes</span></div>
    <div class="row"><span class="d" style="background:${inOn ? '#2fbf4a' : '#777'}"></span><span>ESP32 telling relay: ${inOn ? 'ON' : 'OFF'}</span><span class="v">D26 ${p.relay_in}</span></div>
    <div class="row"><span class="d" style="background:${ac}"></span><span>Relay has power (DC+)</span><span class="v">${a}</span></div>
    <div class="row"><span class="d" style="background:${bc}"></span><span>Pump getting power (NO)</span><span class="v">${b}</span></div>
    <div class="note">Needs the 2 sensor wires (last 2 steps of part 2). Without them, the relay and pump rows say “loose”.</div>`;
  glow.innerHTML = '';
  const ring = ([x, y], c) => el('circle', {cx: x, cy: y, r: 16, fill: c, 'fill-opacity': .35, stroke: c, 'stroke-width': 3}, glow);
  ring(RT['DC+'], ac); ring(RT.NO, bc); ring(RT.IN, inOn ? '#2fbf4a' : '#777');
  ring([CX, CY + 130], bc);
}
if (liveOn) { setInterval(livetick, 400); livetick(); }
</script>""")

# sensing wires + 2 steps (after the laptop-power test)
rep("  e_d4:   {pts: [pinR('D4'), [860, PY(10)],",
    "  s_a:    {pts: [pinL('D34'), [470, PY(3)], [470, 40], [RX - 30, 40], [RX - 30, RT['DC+'][1] - 16], RT['DC+']], c: 'green', fem: 'start', lab: 'DC+', from: 'D34'},\n"
    "  s_b:    {pts: [pinL('D35'), [455, PY(4)], [455, 30], [RX + 320, 30], [RX + 320, RT.NO[1] - 20], RT.NO], c: 'purple', fem: 'start', lab: 'NO', from: 'D35'},\n"
    "  e_d4:   {pts: [pinR('D4'), [860, PY(10)],")
i = s.index("  {part: 2, noModule: true, t: 'Plug in: pump test'"); j = s.index("\n", i) + 1
s = s[:j] + """  {part: 2, noModule: true, t: 'Sensor wire A → DC+', use: '1 F-M wire, any color', p: 'Hole end on D34 (right side, 12th pin down). Pin end into the relay DC+ screw, next to the wire already there. Now the page can see if the relay has power.', focus: ['esp', 'relay'], wires: ['s_a'], pins: [pinL('D34'), RT['DC+']], fx: 'screw', fxAt: RT['DC+']},
  {part: 2, noModule: true, t: 'Sensor wire B → NO', use: '1 F-M wire, any color', p: 'Hole end on D35 (right side, 11th pin down). Pin end into the relay NO screw, next to the pump red wire. Now the page can see if the pump gets power. Open http://127.0.0.1:8097/wiring to see it live.', focus: ['esp', 'relay', 'pump'], wires: ['s_b'], pins: [pinL('D35'), RT.NO], fx: 'screw', fxAt: RT.NO},
""" + s[j:]
p.write_text(s, encoding="utf-8")
print("ok")
