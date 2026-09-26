"""Drive the Hit-the-Target demo against the running server (fake board) and log every step.
Usage: python evidence/run_target.py <target_pct> [pinch]"""
import json, sys, time, urllib.request
U = "http://127.0.0.1:8080"
def post(p, b=None):
    r = urllib.request.Request(U + p, data=json.dumps(b or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(r))
def live(): return json.load(urllib.request.urlopen(U + "/api/live"))
tgt = float(sys.argv[1]); pinch = len(sys.argv) > 2
print("dry:", post("/api/demo/dry")); time.sleep(8)
if pinch and not live()["pinched"]: print("pinch:", post("/api/demo/pinch"))
print("start soil:", live()["a"], "->", post("/api/target", {"pct": tgt}))
t0, last = time.time(), None
while time.time() - t0 < 400:
    T = live()["target"]
    line = (T.get("phase"), T.get("msg"))
    if line != last: print(f"{time.time() - t0:6.0f}s  {T.get('phase'):9} now={T.get('now')}  {T.get('msg')}"); last = line
    if T.get("phase") in ("locked", "over", "fault", "blocked", "stopped", "short"): break
    time.sleep(1)
print("RECEIPT:", json.dumps({k: T.get(k) for k in ("phase", "target", "start", "now", "pulses", "secs", "ml", "took_s", "rate")}))
if pinch: print("unpinch:", post("/api/demo/pinch"))
