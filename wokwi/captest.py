"""Fresh sim: first command is P B 99999. The chip must cap it at 30000 ms."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
fw = Path(r"C:\Users\User\Documents\code\shellhacks2025\prompt-grass\firmware\prompt_grass\prompt_grass.ino").read_text(encoding="utf-8").replace("#define SIM 0", "#define SIM 1")
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    pg.bring_to_front()
    for lab in ("Stop the simulation",):
        s = pg.get_by_label(lab)
        if s.count(): s.click(); time.sleep(2)
    pg.evaluate("t => window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:sketch.ino').setValue(t)", fw)
    pg.get_by_label("Start the simulation").click()
    txt = lambda: pg.evaluate("() => document.body.innerText")
    while txt().count('"type":"reading"') < 1: time.sleep(3)
    pg.mouse.click(1800, 894); pg.keyboard.type("P B 99999"); pg.keyboard.press("Enter")
    t0 = time.time()
    while time.time() - t0 < 900 and '"by":"laptop","why"' not in txt(): time.sleep(5)
    print("\n".join(l for l in txt().splitlines() if l.startswith("{") and "reading" not in l))
    print("wall seconds:", round(time.time() - t0))
