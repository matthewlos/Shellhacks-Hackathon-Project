"""Builds docs/temp/index.html: the pump page's drawing code (board, ESP32, relay, transistor build, pump) with the
pump steps swapped for the temp probe steps in tools/temp_page_tail.js. Run build_pump_page.py first."""
from pathlib import Path
TOOLS = Path(__file__).resolve().parent
DOCS = TOOLS.parent / "docs"
page = (DOCS / "pump/index.html").read_text(encoding="utf-8")
head = page[:page.index("drawBoard(); drawESP(); drawRelay(); drawBuilt(); drawPump();")]
for a, b in [("<title>Pump Hookup</title>", "<title>Temp Probe Hookup</title>"),
             ('content="Farm Hand, step by step: hook the mini pump to the working relay and make it pump."',
              'content="Farm Hand, step by step: wire the DS18B20 temp probe and read it live."'),
             ("<h1>Part 2b: hook up the pump</h1>", "<h1>Part 3: temp probe</h1>")]:
    assert head.count(a) == 1, a
    head = head.replace(a, b)
tail = (TOOLS / "temp_page_tail.js").read_text(encoding="utf-8")
(DOCS / "temp").mkdir(exist_ok=True)
(DOCS / "temp/index.html").write_text(head + tail + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
print("ok")
