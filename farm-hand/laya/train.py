"""Fine-tune Laya (convaiinnovations/laya-multilingual, 322M, Apache-2.0) as Farm Hand's watering decider.

Recipe adapted from Laya's own notebook (notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb, Apache-2.0):
RLCD = noisy-logit policy gradient against a proper scoring rule + soft cross-entropy, then post-hoc temperature.
Changes: one GPU (RTX 4070) instead of 2xT4 DDP, our data (build_dataset.py), wait_rain oversampled x4, 3 epochs.
Train = 2019-2024. 2025-2026 is never seen here (eval.py uses it).
Run: SETUPTOOLS_USE_DISTUTILS=stdlib USE_TF=0 .venv/Scripts/python.exe train.py
"""
import json, os, random, sys, time
from pathlib import Path
import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file, save_file
from transformers import AutoTokenizer
from laya.agent import _fix_tokenizer_config
from laya.common import QTYPES, build_model, build_sequence, proper_reward, render_options
from farmhand_questions import LABELS, QUESTIONS

HERE = Path(__file__).resolve().parent
OUT = HERE / "model" / "farmhand-laya"
BASE = "convaiinnovations/laya-multilingual"
EPOCHS, MICRO, ACCUM, GROUP = 3, 16, 2, 4
LR_ENC, LR_HEAD, SIG0, SIG1 = 2.5e-5, 1.0e-4, .4, .1
SMOOTH = .03
torch.manual_seed(0); random.seed(0)
dev = torch.device("cuda")
assert torch.cuda.is_available(), "GPU required (RTX 4070)"

model_dir = snapshot_download(BASE)
_fix_tokenizer_config(model_dir)
tok = AutoTokenizer.from_pretrained(os.path.join(model_dir, "tokenizer"))
cfg = json.load(open(os.path.join(model_dir, "rl_agent_config.json")))
q = QUESTIONS["action"]
qspec = {"t": "choice", "ins": q["instructions"], "crit": q["criteria"]}
keys = list(q["criteria"].keys())
K = len(render_options({"t": "choice", "crit": q["criteria"]}))
assert keys == LABELS and K == 3


def item(r):
    seq, markers = build_sequence(tok, r["state"], qspec, cfg["max_len"], cfg["head_max_len"])
    if len(markers) != K:
        return None
    y = keys.index(r["label"])
    tgt = [SMOOTH / (K - 1)] * K; tgt[y] = 1 - SMOOTH
    return {"ids": seq, "markers": markers, "qtype": QTYPES["choice"], "target": tgt, "label": y}


rows = [json.loads(l) for l in open(HERE / "data/decisions.jsonl", encoding="utf-8")]
train_rows = [r for r in rows if r["year"] <= 2024]
items = [it for it in (item(r) for r in train_rows) if it]
order = list(range(len(items))); random.Random(20260923).shuffle(order)
n_cal = min(1000, len(items) // 10)
calib = [items[i] for i in order[:n_cal]]
train = [items[i] for i in order[n_cal:]]
train += [it for it in train if it["label"] == 1] * 3          # wait_rain x4: rare, and it's where water is saved
print(f"{len(train)} training items (after wait_rain x4), {len(calib)} held out for calibration", flush=True)


def collate(chunk):
    n, L, k = len(chunk), max(len(c["ids"]) for c in chunk), K
    ids = torch.full((n, L), tok.pad_token_id, dtype=torch.long); att = torch.zeros((n, L), dtype=torch.long)
    mpos = torch.zeros((n, k), dtype=torch.long); mm = torch.ones((n, k), dtype=torch.bool)
    tgt = torch.tensor([c["target"] for c in chunk], dtype=torch.float32)
    for i, c in enumerate(chunk):
        ids[i, :len(c["ids"])] = torch.tensor(c["ids"]); att[i, :len(c["ids"])] = 1
        mpos[i] = torch.tensor(c["markers"])
    return ids.to(dev), att.to(dev), mpos.to(dev), mm.to(dev), tgt.to(dev), torch.tensor([c["qtype"] for c in chunk]).to(dev)


model = build_model(cfg, encoder_dir=os.path.join(model_dir, "encoder"))
model.load_state_dict(load_file(os.path.join(model_dir, "model.safetensors")), strict=True)
model.to(dev).train()
enc = [p for n, p in model.named_parameters() if "encoder." in n]
head = [p for n, p in model.named_parameters() if "encoder." not in n]
opt = torch.optim.AdamW([{"params": enc, "lr": LR_ENC}, {"params": head, "lr": LR_HEAD}], weight_decay=.01)
steps = (len(train) // (MICRO * ACCUM)) * EPOCHS
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, steps), eta_min=1e-6)
scaler = torch.amp.GradScaler("cuda")
t0 = time.time()
for ep in range(EPOCHS):
    random.shuffle(train)
    sigma = SIG0 + (SIG1 - SIG0) * ep / max(1, EPOCHS - 1)
    tot, nb = 0.0, 0
    for b in range(0, len(train), MICRO):
        ids, att, mpos, mm, tgt, qt = collate(train[b:b + MICRO])
        with torch.autocast("cuda", dtype=torch.float16):
            logits, act = model(ids, att, mpos, mm, qt)
        logits = logits.float(); k = mm.sum(-1, keepdim=True).float()
        eps = torch.randn((GROUP,) + logits.shape, device=dev) * sigma * mm
        eps = (eps - eps.sum(-1, keepdim=True) / k) * mm
        z = logits.detach().unsqueeze(0) + eps
        qd = torch.softmax(z.masked_fill(~mm, -1e4), -1)
        with torch.no_grad():
            r = proper_reward(qd, tgt.unsqueeze(0), qt, mm, w_sph=.75, w_rps=1.0)
            adv = (r - r.mean(0, keepdim=True)); adv = adv / (adv.std() + 1e-6)
        logp = -(((z - logits.unsqueeze(0)) ** 2) * mm).sum(-1) / (2 * sigma ** 2)
        loss = (-(adv * logp).mean() - (tgt * torch.log_softmax(logits.masked_fill(~mm, -1e4), -1)).sum(-1).mean()) / ACCUM + 0.0 * act.sum()
        scaler.scale(loss).backward()
        nb += 1; tot += loss.item() * ACCUM
        if nb % ACCUM == 0 or b + MICRO >= len(train):
            scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt); scaler.update(); sched.step(); opt.zero_grad(set_to_none=True)
        if nb % 200 == 0:
            print(f"  epoch {ep + 1}/{EPOCHS} step {nb} loss {loss.item() * ACCUM:.4f} reward {r.mean().item():.3f} "
                  f"({time.time() - t0:.0f} s)", flush=True)
    print(f"=== epoch {ep + 1}/{EPOCHS} done, avg loss {tot / max(1, nb):.4f}, {time.time() - t0:.0f} s", flush=True)

# post-hoc temperature on the held-out calibration slice
model.eval(); Z, T = [], []
with torch.no_grad():
    for b in range(0, len(calib), 32):
        ids, att, mpos, mm, tgt, qt = collate(calib[b:b + 32])
        with torch.autocast("cuda", dtype=torch.float16):
            l, _ = model(ids, att, mpos, mm, qt)
        Z.append(l.float().cpu()); T.append(tgt.cpu())
Z, T = torch.cat(Z), torch.cat(T)
log_t = torch.zeros(1, requires_grad=True); o = torch.optim.LBFGS([log_t], lr=.1, max_iter=100)
def closure():
    o.zero_grad(); l = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean(); l.backward(); return l
o.step(closure)
temp = float(torch.clamp(log_t.exp(), .1, 10).item())
cal_acc = float((Z.argmax(-1) == T.argmax(-1)).float().mean())
print(f"calibration slice: accuracy {cal_acc:.3f}, temperature {temp:.3f}")

OUT.mkdir(parents=True, exist_ok=True)
save_file({k: v.half().contiguous().cpu() for k, v in model.state_dict().items()}, str(OUT / "model.safetensors"))
model.encoder.config.save_pretrained(str(OUT / "encoder")); tok.save_pretrained(str(OUT / "tokenizer"))
cfg.update(fine_tuned=True, model_name="farmhand-laya", temperature=[temp, temp, temp]); cfg.pop("temperature_by_options", None)
json.dump(cfg, open(OUT / "rl_agent_config.json", "w"), indent=2)
print("saved", OUT, f"total {time.time() - t0:.0f} s")
