"""Evidence: shipped brain.py on the FakeBoard via the right.codes Gemini lane (AI_TIMEOUT_S as shipped).
Wet pot then dry pot, then farm chat. Everything goes to evidence/team.log. Fake data only, never for slides."""
import os, sys, time, io, contextlib
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, "..", "laptop"))
os.environ["SERIAL_PORT"] = "fake"
import config, board, brain, soak, store
log = open(os.path.join(H, "team.log"), "w", encoding="utf-8")
def P(*a):
    print(*a); print(*a, file=log); log.flush()
P("brain:", brain.which_brain(), "| AI_TIMEOUT_S:", config.AI_TIMEOUT_S, "| db:", store.DB.name)
B = board.FakeBoard(speed=1); brain.BOARD = B; soak.SoakWatcher(B)
while not B.latest: time.sleep(0.5)
for label, pct in (("WET POT, expect WAIT", 62.0), ("DRY POT, expect WATER", 37.0)):
    B.m["A"] = pct; time.sleep(8)
    brain.ACTIVITY.clear(); t0 = time.time()
    d = brain.check_now()
    P(f"\n=== {label}: pot A {B.latest['a_pct']}% | took {time.time()-t0:.1f} s")
    P("decision:", d)
    for a in brain.ACTIVITY: P("   ", a["agent"], "|", a["what"])
P("\nwaiting for the pour detector (180 s)...")
time.sleep(195)
P("soaks table:", store.soaks(3))
P("\nASK:", brain.ask("Why did you water pot A, and how much has the timer pot used today?"))
