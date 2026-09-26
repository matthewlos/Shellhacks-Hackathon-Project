"""Debug: one dry-pot team run with a long timeout, printing when each agent step happened."""
import os, sys, time
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, "..", "laptop"))
os.environ["SERIAL_PORT"] = "fake"
import config, board, brain, soak, store
config.AI_TIMEOUT_S = 400
import litellm, logging
B = board.FakeBoard(speed=1); brain.BOARD = B
while not B.latest: time.sleep(0.5)
B.m["A"] = 37.0; time.sleep(6)
t0 = time.time()
orig = litellm.acompletion
async def timed(*a, **k):
    s = time.time()
    try:
        return await orig(*a, **k)
    finally:
        print(f"   [llm call {s-t0:6.1f}s -> {time.time()-t0:6.1f}s  ({time.time()-s:.1f}s)]", flush=True)
litellm.acompletion = timed
brain.ACTIVITY.clear()
d = brain.check_now()
for a in brain.ACTIVITY: print(f"{a['ts']-t0:6.1f}s  {a['agent']} | {a['what']}")
print("total", round(time.time() - t0, 1), d)
