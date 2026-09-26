import pathlib

H = pathlib.Path(r"C:\Users\User\Documents\code\shellhacks2025\farm-hand")
src = H / "laptop/data/rec/2026-09-23-151542-this-session-is-being-continued-from-a-previous-c.txt"
tmp = H / "laptop/data/rec/_clean_tmp.txt"

lines = src.read_text(encoding="utf-8").splitlines()
cut = next(i for i, ln in enumerate(lines) if ln.lstrip().startswith("\u276f") and "larp" in ln.lower())
kept = lines[:cut]
while kept and not kept[-1].strip():
    kept.pop()
tmp.write_text("\n".join(kept) + "\n", encoding="utf-8")
print("cut at txt line", cut + 1, "kept", len(kept), "lines; last kept:", kept[-1][:80])
