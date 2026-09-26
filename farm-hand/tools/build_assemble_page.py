"""Builds docs/assemble/index.html: the whole Farm Hand hardware build on one page, from a bare board, in the order it
was proven on 2026-09-23 (relay + transistor, pump, temp probe, soil probe). Uses the pump page's drawing code
(board, ESP32, relay with NO/COM/NC) minus its always-on relay wires, + tools/assemble_page_tail.js.
Run build_pump_page.py first."""
from pathlib import Path
TOOLS = Path(__file__).resolve().parent
DOCS = TOOLS.parent / "docs"
page = (DOCS / "pump/index.html").read_text(encoding="utf-8")
head = page[:page.index("// pump sitting in a cup of water")]

def rep(a, b):
    global head
    assert head.count(a) == 1, a
    head = head.replace(a, b)

rep("<title>Pump Hookup</title>", "<title>Farm Hand Assembly</title>")
rep('content="Farm Hand, step by step: hook the mini pump to the working relay and make it pump."',
    'content="The whole Farm Hand hardware build on one page: relay + transistor, pump, temp probe, soil probe."')
rep("<h1>Part 2b: hook up the pump</h1>", "<h1>Farm Hand: assemble everything</h1>")
# the relay's VIN/GND wires become real steps here, so drop the always-drawn faded ones and their caption
i = head.index("  el('path', {d: `M ${RS['DC+'][0]}"); j = head.index("'already there: VIN → DC+, GND → DC−'")
j = head.index("\n", j) + 1
head = head[:i] + head[j:]
tail = (TOOLS / "assemble_page_tail.js").read_text(encoding="utf-8")
(DOCS / "assemble").mkdir(exist_ok=True)
(DOCS / "assemble/index.html").write_text(head + tail + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
print("ok")
