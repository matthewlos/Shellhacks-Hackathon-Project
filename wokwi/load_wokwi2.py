"""Paste sketch.ino + diagram.json + libraries.txt into the open Wokwi tab, start the sim, screenshot."""
import time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
H = Path(__file__).parent
files = {n: (H / n).read_text(encoding="utf-8") for n in ("sketch.ino", "diagram.json", "libraries.txt")}
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    pg.bring_to_front()
    pg.get_by_text("diagram.json", exact=True).click(); time.sleep(1)
    pg.get_by_text("Library Manager", exact=True).click(); time.sleep(1)
    print(pg.evaluate("() => window.monaco.editor.getModels().map(m=>m.uri.toString())"))
    for name, text in files.items():
        ok = pg.evaluate("([n,t]) => { const m = window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:'+n); if(!m) return false; m.setValue(t); return true; }", [name, text])
        print(name, ok)
    pg.get_by_text("sketch.ino", exact=True).click(); time.sleep(2)
    pg.screenshot(path="wokwi_step2.png")
