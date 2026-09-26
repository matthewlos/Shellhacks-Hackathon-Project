"""Wiring page: switch the drawn ESP32 to Dechante's real board (30-pin DevKit V1, USB-C), fix pin names
(5V = VIN, D32, D26, D4), only 2 GND pins -> relay DC- and the ESP32's 2nd GND go through the breadboard GND rail,
and re-order part 2 so the breadboard + power module go in first."""
from pathlib import Path
p = Path(__file__).resolve().parent.parent / "docs/wiring/index.html"
s = p.read_text(encoding="utf-8")

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)

def cut(a, b, new):
    global s
    i, j = s.index(a), s.index(b)
    s = s[:i] + new + s[j:]

# pins: USB at the bottom, chip text readable (the way the page draws it)
rep("const LP = ['3V3','EN','VP','VN','34','35','32','33','25','26','27','14','12','GND','13','D2','D3','CMD','5V'];",
    "// Dechante's board: 30-pin ESP32 DevKit V1 (USB-C). Read off his photo 2026-09-23. USB at the bottom:\n"
    "const LP = ['EN','VP','VN','D34','D35','D32','D33','D25','D26','D27','D14','D12','D13','GND','VIN'];")
rep("const RP = ['GND','23','22','TX','RX','21','GND','19','18','5','17','16','4','0','2','15','D1','D0','CLK'];",
    "const RP = ['D23','D22','TX0','RX0','D21','D19','D18','D5','TX2','RX2','D4','D2','D15','GND','3V3'];")
rep("const PY = i => EY + 200 + i * 18;", "const PY = i => EY + 196 + i * 22;")
rep("textContent = 'ESPRESSIF';", "textContent = 'ESP-32';")
rep("textContent = 'ESP32-WROOM-32';", "textContent = 'WiFi+BT SoC inside';")

# wires that touch the ESP32 or changed route
cut("  p_gnd:  {pts:", "  com:    {pts:", """  p_gnd:  {pts: [HOLE.GND, [HOLE.GND[0] + 40, 520], [470, 520], pinL('GND')], c: 'black', fem: 'end', lab: 'GND'},
  p_vcc:  {pts: [HOLE.VCC, [HOLE.VCC[0] + 60, 700], [EX + EW + 60, 700], [EX + EW + 50, PY(14) + 10], pinR('3V3')], c: 'red', fem: 'end', lab: '3V3'},
  p_aout: {pts: [HOLE.AOUT, [HOLE.AOUT[0] + 90, 330], [480, PY(5)], pinL('D32')], c: 'yellow', fem: 'end', lab: 'D32'},
  r_vcc:  {pts: [pinL('VIN'), [470, PY(14) + 30], [500, 780], [860, 790], [880, 360], [RX - 60, RT['DC+'][1]], RT['DC+']], c: 'red', fem: 'start', lab: 'VIN (5V)'},
  r_gnd:  {pts: [[COL(5), RAIL.GNDt], [COL(5), RAIL.GNDt - 70], [890, 420], [RX - 50, RT['DC-'][1]], RT['DC-']], c: 'black', fem: null, lab: 'DC−'},
  r_in:   {pts: [pinL('D26'), [460, PY(8)], [430, 60], [880, 60], [880, RT.IN[1]], RT.IN], c: 'blue', fem: 'start', lab: 'D26'},
""")
rep("  e_gnd:  {pts: [pinR('GND', 1), [860, PY(6)], [870, 520], [COL(2), RAIL.GNDt - 40], [COL(2), RAIL.GNDt]], c: 'black', fem: 'start', lab: 'GND'},",
    "  e_gnd:  {pts: [pinR('GND'), [860, PY(13)], [870, 520], [COL(2), RAIL.GNDt - 40], [COL(2), RAIL.GNDt]], c: 'black', fem: 'start', lab: 'GND rail'},")
rep("  e_d4:   {pts: [pinR('4'), [860, PY(12)],", "  e_d4:   {pts: [pinR('D4'), [860, PY(10)],")
rep("lab: 'pin 4'}", "lab: 'D4'}")

# part 1 text: say where each pin is on HIS board
rep("p: 'Pin end into the cable\\'s GND hole. Hole end onto the ESP32 pin labeled GND (left side).', focus: ['cable', 'esp'], wires: ['p_gnd'], pins: [pinL('GND')]",
    "p: 'Pin end into the cable\\'s GND hole. Hole end onto GND: left side, 2nd pin from the USB.', focus: ['cable', 'esp'], wires: ['p_gnd'], pins: [pinL('GND')]")
rep("p: 'Pin end into VCC. Hole end onto 3V3 (top left).', focus: ['cable', 'esp'], wires: ['p_vcc'], pins: [pinL('3V3')]",
    "p: 'Pin end into VCC. Hole end onto 3V3: right side, the pin right next to the USB.', focus: ['cable', 'esp'], wires: ['p_vcc'], pins: [pinR('3V3')]")
rep("{part: 1, t: 'Yellow → 32', use: '1 yellow F-M wire', p: 'Pin end into AOUT. Hole end onto 32 (may say D32 or IO32).', focus: ['cable', 'esp'], wires: ['p_aout'], pins: [pinL('32')]",
    "{part: 1, t: 'Yellow → D32', use: '1 yellow F-M wire', p: 'Pin end into AOUT. Hole end onto D32: left side, 6th pin from the top.', focus: ['cable', 'esp'], wires: ['p_aout'], pins: [pinL('D32')]")

# part 2, re-ordered: board + module first (the relay's GND goes through the breadboard: this board has only 2 GND pins)
cut("  {part: 2, t: '5V → DC+'", "  {part: 2, t: 'Charger + test'", """  {part: 2, t: 'Power module on the board', p: 'Press it onto the breadboard\\'s end. Yellow jumpers: top side 3.3V, bottom side 5V. Nothing plugged into it yet.', focus: ['board'], fx: 'module', photo: 'mm'},
  {part: 2, t: 'ESP32 GND → board', use: '1 black F-M wire: hole end on the ESP32, pin end into the rail', p: 'Hole end on GND: right side, 2nd pin from the USB. Pin end into the top GND (−) rail.', focus: ['esp', 'board'], wires: ['e_gnd'], pins: [pinR('GND'), [COL(2), RAIL.GNDt]], al: 'Your board has only 2 GND pins, so the rest of the grounds meet on this rail.', photo: 'fm'},
  {part: 2, t: 'VIN (5V) → DC+', use: '1 F-M wire, any color: hole end on the ESP32, pin end into the relay', p: 'Hole end on VIN: left side, the pin right next to the USB. That is your 5V. Pin end into DC+: loosen screw, push in, tighten.', focus: ['esp', 'relay'], wires: ['r_vcc'], pins: [pinL('VIN'), RT['DC+']], fx: 'screw', fxAt: RT['DC+'], photo: 'relay'},
  {part: 2, t: 'GND rail → DC−', use: '1 male-male wire (the loose bundle)', p: 'One end into the top GND (−) rail, other end screwed into DC−.', focus: ['board', 'relay'], wires: ['r_gnd'], pins: [[COL(5), RAIL.GNDt], RT['DC-']], fx: 'screw', fxAt: RT['DC-'], photo: 'mm'},
  {part: 2, t: 'D26 → IN', use: '1 F-M wire, any color', p: 'Hole end on D26: left side, 9th pin from the top. Pin end screwed into IN.', focus: ['esp', 'relay'], wires: ['r_in'], pins: [pinL('D26'), RT.IN], fx: 'screw', fxAt: RT.IN, photo: 'relay'},
  {part: 2, t: '5V rail → COM', use: '1 male-male wire (the loose bundle), pins on both ends', p: 'One end in the bottom 5V (+) rail, other end screwed into COM.', focus: ['board', 'relay'], wires: ['com'], pins: [RT.COM], fx: 'screw', fxAt: RT.COM, photo: 'mm'},
  {part: 2, t: 'Pump wires', use: 'No jumper: the pump’s own red + black wires', p: 'Pump red → NO (screw it in). Pump black → bottom GND (−) rail.', focus: ['pump', 'relay', 'board'], wires: ['pumpR', 'pumpB'], pins: [RT.NO, [COL(27), RAIL.GNDb]], fx: 'screw', fxAt: RT.NO},
""")
rep("p: 'Power off before any wire. Always.'", "p: 'Power off before any wire. Always.'")
p.write_text(s, encoding="utf-8")
print("ok")
