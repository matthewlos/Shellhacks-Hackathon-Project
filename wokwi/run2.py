import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
H = Path(__file__).parent
src = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    stop = pg.get_by_label("Stop the simulation")
    if stop.count(): stop.click(); time.sleep(1)
    pg.get_by_text("diagram.json", exact=True).click(); time.sleep(1)
    pg.evaluate("t => window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:diagram.json').setValue(t)", (H/src).read_text())
    time.sleep(1); pg.mouse.click(1100, 300); pg.keyboard.press("f"); time.sleep(1)
    if len(sys.argv) > 2:
        pg.get_by_label("Start the simulation").click()
        for i in range(12):
            time.sleep(5)
            txt = pg.locator("body").inner_text()
            if "Pump A (AI pot) ON" in txt:
                time.sleep(1.5); break
    pg.screenshot(path=f"wokwi_{Path(src).stem}.png")
    print(pg.locator("body").inner_text()[-700:])
