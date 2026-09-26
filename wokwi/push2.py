import time
from pathlib import Path
from playwright.sync_api import sync_playwright
H = Path(__file__).parent
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    pg.get_by_text("libraries.txt", exact=True).click(); time.sleep(1.5)
    t = (H / "libraries.txt").read_text(encoding="utf-8")
    print(pg.evaluate("([n,t]) => { const m = window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:'+n); if(!m) return false; m.setValue(t); return true; }", ["libraries.txt", t]))
    time.sleep(1)
    pg.get_by_text("Library Manager", exact=True).click(); time.sleep(1.5)
    pg.screenshot(path="wokwi_step3.png")
