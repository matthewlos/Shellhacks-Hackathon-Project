"""Live test of the Gemini agent team on the FakeBoard (right.codes Gemini lane). Not for slides."""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "laptop"))
os.environ["SERIAL_PORT"] = "fake"
import board, brain, soak, store
soak.WATCH_S = 120
B = board.FakeBoard(speed=1); brain.BOARD = B; soak.SoakWatcher(B)
while not B.latest: time.sleep(0.5)
for label, pct in (("DRY POT (should WATER)", 37.0),):
    B.m["A"] = pct; time.sleep(6)
    brain.ACTIVITY.clear()
    t0 = time.time()
    d = brain.check_now()
    print(f"\n=== {label}: pot A {B.latest['a_pct']}% | {time.time()-t0:.1f}s")
    print(d)
    for a in brain.ACTIVITY: print("   ", a["agent"], "|", a["what"])
print("\nASK:", brain.ask("Why did you water pot A, and how much has the timer pot used today?"))
