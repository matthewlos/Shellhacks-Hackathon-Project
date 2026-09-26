"""Builds docs/pump/index.html from the transistor page's drawing code (board, ESP32, relay) plus the relay's
NO/COM/NC screws, the transistor build as it sits on the owner's board, and the pump steps."""
from pathlib import Path
DOCS = Path(__file__).resolve().parent.parent / "docs"
src = (DOCS / "transistor/index.html").read_text(encoding="utf-8")
head = src[:src.index("drawBoard(); drawESP(); drawRelay();")]

def rep(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)

head = rep(head, "<title>Transistor Fix</title>", "<title>Pump Hookup</title>")
head = rep(head, 'content="Farm Hand relay fix, step by step: a PN2222 transistor lets the 3.3V ESP32 switch the 5V relay."',
           'content="Farm Hand, step by step: hook the mini pump to the working relay and make it pump."')
head = rep(head, "<h1>Relay fix: add the transistor</h1>", "<h1>Part 2b: hook up the pump</h1>")
head = rep(head, 'aria-label="Breadboard, ESP32 and relay"', 'aria-label="Breadboard, ESP32, relay and pump"')
head = rep(head, "el('rect', {x: RX + 150, y: RY + 40, width: 170, height: 170, rx: 8, fill: '#2d5fc4'}, G);\n  txt(RX + 235,",
           "el('rect', {x: RX + 130, y: RY + 40, width: 150, height: 170, rx: 8, fill: '#2d5fc4'}, G);\n  txt(RX + 205,")
head = rep(head, "const RX = 900, RY = 60, RW = 420, RH = 250, RS = {",
           "const RX = 900, RY = 60, RW = 420, RH = 250, RO = {NO: [RX + RW - 40, RY + 70], COM: [RX + RW - 40, RY + 125], NC: [RX + RW - 40, RY + 180]}, RS = {")
head = rep(head, "  el('circle', {cx: RX + 110, cy: RY + 22, r: 8, fill: '#ff3b30'}, G);",
"""  el('rect', {x: RX + RW - 70, y: RY + 40, width: 58, height: 170, rx: 6, fill: '#2f6fd6'}, G);
  Object.entries(RO).forEach(([n, [x, y]]) => { el('circle', {cx: x, cy: y, r: 18, fill: '#d7dce0', stroke: '#888'}, G); el('line', {x1: x - 11, x2: x + 11, y1: y, y2: y, stroke: '#555', 'stroke-width': 4}, G);
    txt(x - 30, y + 6, n, {'text-anchor': 'end', fill: '#fff', 'font-size': 17}, G); });
  el('circle', {cx: RX + 110, cy: RY + 22, r: 8, fill: '#ff3b30'}, G);""")
head = rep(head, "'wires 1 + 2 stay: VIN → DC+, GND → DC−'", "'already there: VIN → DC+, GND → DC−'")
head = rep(head, "cap = el('rect', {x: RX + 351,", "cap = el('rect', {x: RX + 327,")   # jumper stays on L

tail = (Path(__file__).resolve().parent / "pump_page_tail.js").read_text(encoding="utf-8")
(DOCS / "pump").mkdir(exist_ok=True)
(DOCS / "pump/index.html").write_text(head + tail + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
print("ok")
