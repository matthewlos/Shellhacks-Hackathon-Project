"""Before-training baseline: untrained laya-multilingual on 300 held-out 2025-26 decisions."""
import json, random, time, collections
import laya
from farmhand_questions import QUESTIONS, LABELS
rows = [json.loads(l) for l in open("data/decisions.jsonl", encoding="utf-8")]
test = [r for r in rows if r["year"] >= 2025]
random.seed(1); sample = random.sample(test, 300)
agent = laya.load("convaiinnovations/laya-multilingual", device="cuda")
r0 = agent.predict(sample[0]["state"], QUESTIONS); print("result shape:", json.dumps(r0)[:600])
ok = collections.Counter(); tot = collections.Counter(); t0 = time.time()
for r in sample:
    a = agent.predict(r["state"], QUESTIONS)["answers"]["action"]
    pred = a["choice"]
    tot[r["label"]] += 1; ok[r["label"]] += (pred == r["label"])
print("zero-shot accuracy:", round(sum(ok.values()) / len(sample), 3), {k: f"{ok[k]}/{tot[k]}" for k in LABELS},
      "| ms/decision:", round((time.time() - t0) / len(sample) * 1000, 1))
