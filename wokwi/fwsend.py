"""Reload the real firmware (SIM=1) into Wokwi and run the command test.
Waits on the chip's own output (sim runs slower than real time), not on wall-clock sleeps."""
import time, re
from pathlib import Path
from playwright.sync_api import sync_playwright
fw = Path(r"C:\Users\User\Documents\code\shellhacks2025\prompt-grass\firmware\prompt_grass\prompt_grass.ino").read_text(encoding="utf-8").replace("#define SIM 0", "#define SIM 1")
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    stop = pg.get_by_label("Stop the simulation")
    if stop.count(): stop.click(); time.sleep(1)
    pg.get_by_text("sketch.ino", exact=True).click(); time.sleep(0.5)
    pg.evaluate("t => window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:sketch.ino').setValue(t)", fw)
    pg.get_by_label("Start the simulation").click()
    def events():
        return [l for l in pg.evaluate("() => document.body.innerText").splitlines() if l.startswith('{"type"') and '"reading"' not in l]
    def wait(pat, n=1, timeout=240):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if sum(bool(re.search(pat, e)) for e in events()) >= n: return True
            time.sleep(4)
        print("TIMEOUT waiting for", pat); return False
    def send(c):
        pg.mouse.click(1800, 894); pg.keyboard.type(c); pg.keyboard.press("Enter")
    wait('"boot"')
    while pg.evaluate("() => (document.body.innerText.match(/\"type\":\"reading\"/g)||[]).length") < 2: time.sleep(3)
    send("P A 3000"); wait('pour_start.*"A"')
    send("P B 1000"); wait('refused.*"B"')                     # A is running -> busy
    wait('pour_done.*"A"')
    send("T 3 1000"); wait('pour_done.*"B".*timer')
    send("T 0"); time.sleep(3)
    n_before = len(events())
    send("P B 99999"); wait('pour_start.*"ms":30000'); wait('pour_done.*"B".*laptop', timeout=400)
    send("X")
    for e in events(): print(e)
    pg.screenshot(path="fwtest.png")
