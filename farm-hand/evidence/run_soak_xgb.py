"""Evidence: pour detector on a pour that MISSES the pot, then the XGBoost train/predict path. Fake data only."""
import os, sys, time
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, "..", "laptop"))
os.environ["SERIAL_PORT"] = "fake"
import board, soak, store, predictor
log = open(os.path.join(H, "soak_xgb.log"), "w", encoding="utf-8")
def P(*a): print(*a); print(*a, file=log); log.flush()
soak.WATCH_S = 60
B = board.FakeBoard(speed=1); soak.SoakWatcher(B)
while not B.latest: time.sleep(0.5)
time.sleep(10)
B.pour("A", 5000); time.sleep(0.5)
B.soaking["A"] = -1e9            # simulate the tube pointing off the pot: water never reaches the soil
time.sleep(70)
B.soaking["A"] = 0
P("failed-pour soak row:", store.soaks(1)[0])
P("learned pct/s (ignores failed pours):", soak.learned_pct_per_s("A"))
predictor.MIN_ROWS = 20          # test the code path only; the real minimum is 300
X, y = predictor.build_rows(include_fake=True)
P("labeled rows available:", len(y))
if len(y) >= 20:
    P("train:", predictor.train(include_fake=True)); P("predict:", predictor.predict("A"))
    os.remove(predictor.MODEL); P("deleted the fake-trained model so it can't be used for real")
else:
    P("not enough dried-out rows in the fake DB to train; predict falls back to:", predictor.predict("A"))
