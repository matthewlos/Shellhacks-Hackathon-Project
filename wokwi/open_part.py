"""Open a Wokwi ESP32 project in the Farm Hand browser (CDP 19371), paste a sketch + diagram, start the sim, screenshot.
Usage: python open_part.py diagram_part1.json sketch_part1.ino part1"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
H = Path(__file__).parent
diag, sketch, name = sys.argv[1], sys.argv[2], sys.argv[3]
files = {"diagram.json": (H / diag).read_text(encoding="utf-8"), "sketch.ino": (H / sketch).read_text(encoding="utf-8")}
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19371")
    pg = next((x for x in b.contexts[0].pages if "wokwi.com" in x.url), None) or b.contexts[0].new_page()
    if "wokwi.com/projects" not in pg.url:
        pg.goto("https://wokwi.com/projects/new/esp32")
    pg.bring_to_front(); pg.wait_for_function("() => window.monaco && window.monaco.editor.getModels().length >= 2", timeout=90000)
    time.sleep(2)
    pg.get_by_text("diagram.json", exact=True).click(); time.sleep(2)
    for n, t in files.items():
        ok = pg.evaluate("([n,t]) => { const m = window.monaco.editor.getModels().find(m=>m.uri.toString().endsWith(n)); if(!m) return false; m.setValue(t); return true; }", [n, t])
        print(n, "pasted" if ok else "NOT FOUND")
    time.sleep(3)
    try:
        pg.get_by_role("button", name="Start the simulation").click(timeout=10000); time.sleep(8)
    except Exception as e:
        print("start click:", type(e).__name__)
    pg.screenshot(path=str(H / f"wokwi_{name}.png")); print("screenshot", f"wokwi_{name}.png")
