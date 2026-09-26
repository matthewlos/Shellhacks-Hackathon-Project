"""Load the REAL firmware (SIM=1) into the open Wokwi tab, run it, send serial commands, print output."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
fw = Path(r"C:\Users\User\Documents\code\shellhacks2025\prompt-grass\firmware\prompt_grass\prompt_grass.ino").read_text(encoding="utf-8")
fw = fw.replace("#define SIM 0", "#define SIM 1")
def out(pg):
    return pg.evaluate("() => { const x=[...document.querySelectorAll('.xterm-rows, pre, textarea')].map(e=>e.innerText).join('\n'); return x; }")
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    stop = pg.get_by_label("Stop the simulation")
    if stop.count(): stop.click(); time.sleep(1)
    pg.get_by_text("sketch.ino", exact=True).click(); time.sleep(0.5)
    pg.evaluate("t => window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:sketch.ino').setValue(t)", fw)
    pg.get_by_label("Start the simulation").click()
    for _ in range(40):
        time.sleep(3)
        if '"type":"reading"' in pg.locator("body").inner_text(): break
    box = pg.locator("input[type=text]").last
    def send(c):
        box.click(); box.fill(c); box.press("Enter"); time.sleep(1)
    send("P A 3000"); time.sleep(6)
    send("P B 99999"); time.sleep(3)
    send("X"); time.sleep(6)
    send("T 5 2000"); time.sleep(20)
    send("T 0")
    send("Q"); time.sleep(3)
    pg.screenshot(path="fwtest.png")
    txt = pg.locator("body").inner_text()
    print(txt[txt.find('{"type":"boot"'):][-4000:])
