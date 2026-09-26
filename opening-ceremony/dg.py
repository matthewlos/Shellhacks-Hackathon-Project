"""Deepgram nova-3 transcript of the ShellHacks 2026 opening ceremony. Key is read from the vault, never printed."""
import json, re, urllib.request, pathlib
inv = pathlib.Path(r"C:\Users\User\Documents\Life OS\Secrets\API-Inventory.md").read_text(encoding="utf-8", errors="replace")
sec = inv.split("## Deepgram", 1)[1].split("\n## ", 1)[0]
keys = re.findall(r"\b[0-9a-f]{40}\b", sec)
assert keys, "no 40-hex Deepgram key found in the vault section"
audio = pathlib.Path("opening.m4a").read_bytes()
url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&paragraphs=true&diarize=true&language=en"
for k in keys:
    req = urllib.request.Request(url, data=audio, method="POST", headers={"Authorization": "Token " + k, "Content-Type": "audio/mp4"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            d = json.loads(r.read())
        break
    except urllib.error.HTTPError as e:
        print("key failed:", e.code)
else:
    raise SystemExit("all keys failed")
pathlib.Path("deepgram.json").write_text(json.dumps(d), encoding="utf-8")
alt = d["results"]["channels"][0]["alternatives"][0]
out = []
for p in alt.get("paragraphs", {}).get("paragraphs", []):
    t = " ".join(s["text"] for s in p["sentences"])
    m, s_ = divmod(int(p["start"]), 60)
    out.append(f"[{m:02d}:{s_:02d}] Speaker {p.get('speaker', 0)}: {t}")
pathlib.Path("transcript_deepgram.txt").write_text("\n\n".join(out) or alt["transcript"], encoding="utf-8")
print("ok", len(out), "paragraphs,", len(alt["transcript"].split()), "words,", round(d["metadata"]["duration"]), "s audio")
