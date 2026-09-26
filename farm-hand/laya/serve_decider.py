"""Farm Hand's fast decider: the trained Laya model behind a tiny local HTTP API (loads from disk, no downloads).

  POST http://127.0.0.1:8091/decide   {"state": {...}}   ->  {"choice": "water", "probabilities": {...}, "ms": 12.3}
  GET  http://127.0.0.1:8091/health

Run (GPU if there is one, else CPU; an M2 Mac uses "mps"):
  SETUPTOOLS_USE_DISTUTILS=stdlib USE_TF=0 .venv/Scripts/python.exe serve_decider.py
"""
import os, sys, time
from pathlib import Path
import torch, uvicorn
from fastapi import FastAPI
import laya
sys.path.insert(0, str(Path(__file__).resolve().parent))
from farmhand_questions import QUESTIONS

MODEL = os.environ.get("LAYA_MODEL", str(Path(__file__).resolve().parent / "model" / "farmhand-laya"))
DEVICE = os.environ.get("LAYA_DEVICE") or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
agent = laya.load(MODEL, device=DEVICE)
app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "model": Path(MODEL).name, "device": DEVICE}


@app.post("/decide")
def decide(body: dict):
    t0 = time.perf_counter()
    a = agent.predict(body["state"], QUESTIONS)["answers"]["action"]
    return {"choice": a["choice"], "probabilities": a["probabilities"], "confidence": a.get("confidence"),
            "ms": round((time.perf_counter() - t0) * 1000, 1), "device": DEVICE}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("LAYA_PORT", "8091")), log_level="warning")
