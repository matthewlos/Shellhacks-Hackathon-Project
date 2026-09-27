"""PLAN.md = PLAN_BODY.md + section 12 (simulated run results) + a code appendix copied from the real files.
Re-run after any code change so the plan never shows stale code:  python build_plan.py"""
from pathlib import Path

H = Path(__file__).resolve().parent
FILES = [
    ("firmware/farm_hand/farm_hand.ino", "cpp"),
    ("laptop/config.py", "python"),
    ("laptop/board.py", "python"),
    ("laptop/store.py", "python"),
    ("laptop/feeds.py", "python"),
    ("laptop/predictor.py", "python"),
    ("laptop/soak.py", "python"),
    ("laptop/target.py", "python"),
    ("laptop/brain.py", "python"),
    ("laptop/report.py", "python"),
    ("laptop/calibrate.py", "python"),
    ("laptop/server.py", "python"),
    ("laptop/static/index.html", "html"),
    ("laptop/requirements.txt", "text"),
    ("../wokwi/diagram.json", "json"),
]

out = [(H / "PLAN_BODY.md").read_text(encoding="utf-8").rstrip(), ""]
res = H / "SIM_RUN_RESULTS.md"
if res.exists():
    out += [res.read_text(encoding="utf-8").rstrip(), ""]
out += ["---", "", "## Appendix: all the code", "",
        "Copied from the real files by `build_plan.py`. Edit the files, not this appendix.", "",
        "Set up the laptop side once:", "", "```",
        "cd Documents\\code\\shellhacks2025\\farm-hand",
        "py -3.11 -m venv .venv",
        ".venv\\Scripts\\python -m pip install -r laptop\\requirements.txt", "```", ""]
for rel, lang in FILES:
    p = (H / rel).resolve()
    out += [f"### `{rel}`", "", f"```{lang}", p.read_text(encoding="utf-8").rstrip(), "```", ""]
(H / "PLAN.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print("wrote", H / "PLAN.md", sum(1 for _ in (H / "PLAN.md").open(encoding="utf-8")), "lines")
