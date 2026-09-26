"""Evidence: run the SHIPPED firmware (SIM=1) in Wokwi, send test commands, save every chip line to evidence/fw_wokwi.log.
Waits on the chip's own output (the sim runs slower than real time)."""
import re, time
from pathlib import Path
from playwright.sync_api import sync_playwright
H = Path(__file__).parent
src = (H.parent / "firmware/farm_hand/farm_hand.ino").read_text(encoding="utf-8")
fw = src.replace("#define SIM 0", "#define SIM 1")
assert "REPORT_MS   = 1000" in fw and "setWaitForConversion(false)" in fw
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:19358")
    pg = [x for x in b.contexts[0].pages if "wokwi.com" in x.url][-1]
    pg.bring_to_front()
    s = pg.get_by_label("Stop the simulation")
    if s.count(): s.click(); time.sleep(2)
    pg.evaluate("t => window.monaco.editor.getModels().find(m=>m.uri.toString()==='vfs:sketch.ino').setValue(t)", fw)
    pg.get_by_label("Start the simulation").click()
    txt = lambda: pg.evaluate("() => document.body.innerText")
    ev = lambda: [l for l in txt().splitlines() if l.startswith('{"type"')]
    def wait(pat, t=600):
        t0 = time.time()
        while time.time() - t0 < t:
            if any(re.search(pat, e) for e in ev()): return True
            time.sleep(3)
        return False
    def send(c):
        pg.mouse.click(1800, 894); pg.keyboard.type(c); pg.keyboard.press("Enter")
    steps = []
    steps.append(("boot", wait('"boot"')))
    while sum('"reading"' in e for e in ev()) < 3: time.sleep(2)
    send("S"); time.sleep(3)                 # first command after focusing the box gets eaten: send a harmless one
    send("P A 3000"); steps.append(("pour A start", wait('pour_start.*"A".*"ms":3000')))
    send("P B 1000"); steps.append(("busy refusal", wait('refused.*"B".*busy')))
    steps.append(("pour A done", wait('pour_done.*"A".*laptop')))
    time.sleep(3)
    while sum('"reading"' in e for e in ev()) < 12: time.sleep(2)   # > 5 s gap in sim time
    send("T 4 1000"); steps.append(("timer pour", wait('pour_done.*"B".*timer')))
    send("T 0"); steps.append(("timer off", wait('"every_s":0')))
    n = sum('"reading"' in e for e in ev())
    while sum('"reading"' in e for e in ev()) < n + 8: time.sleep(2)
    send("P B 99999"); steps.append(("cap start 30000", wait('pour_start.*"B".*"ms":30000')))
    steps.append(("cap done ~30000 ms", wait('pour_done.*"B".*"ran_ms":300\d\d.*laptop', t=900)))
    lines = ev()
    out = ["SHIPPED firmware, SIM=1, REPORT_MS=1000, non-blocking temp", ""]
    out += [f"{name}: {'PASS' if ok else 'FAIL'}" for name, ok in steps] + [""]
    out += [l for l in lines if '"reading"' not in l]
    out += ["", "first 3 readings:"] + [l for l in lines if '"reading"' in l][:3]
    (H / "fw_wokwi.log").write_text("\n".join(out), encoding="utf-8")
    pg.screenshot(path=str(H / "fw_wokwi.png"))
    print("\n".join(out))
