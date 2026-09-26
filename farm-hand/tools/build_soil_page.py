"""Builds docs/soil/index.html: temp page's drawing (board, ESP32, relay, transistor, pump, temp adapter) + the soil
probe steps in tools/soil_page_tail.js. Run build_pump_page.py and build_temp_page.py first."""
from pathlib import Path
TOOLS = Path(__file__).resolve().parent
DOCS = TOOLS.parent / "docs"
page = (DOCS / "temp/index.html").read_text(encoding="utf-8")
cut = page.index("const ADAPT_ZOOM")          # keep everything drawn up to (and incl.) SPLIT, drop the temp steps
head = page[:cut]
for a, b in [("<title>Temp Probe Hookup</title>", "<title>Soil Probe Hookup</title>"),
             ('content="Farm Hand, step by step: wire the DS18B20 temp probe and read it live."',
              'content="Farm Hand, step by step: wire the soil probe and read soil + temp live."'),
             ("<h1>Part 3: temp probe</h1>", "<h1>Part 4: soil probe</h1>")]:
    assert head.count(a) == 1, a
    head = head.replace(a, b)
tail = (TOOLS / "soil_page_tail.js").read_text(encoding="utf-8")
(DOCS / "soil").mkdir(exist_ok=True)
(DOCS / "soil/index.html").write_text(head + tail + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
print("ok")
