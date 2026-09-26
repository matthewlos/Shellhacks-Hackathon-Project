"""Judges' conference: 4 models from 4 labs (all via right.codes) judge Rumi vs Farm Hand.
Round 1: each judges alone from tools/conference_brief.md. Round 2: each reads the other three and gives a final vote.
Writes evidence/conference_rumi_vs_farmhand.md."""
import json, os, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

H = Path(__file__).resolve().parent.parent
BRIEF = (H / "tools/conference_brief.md").read_text(encoding="utf-8")
JUDGES = [  # (name, channel, model, key env, protocol)
    ("GPT (gpt-5.5)", "codex", "gpt-5.5", "RIGHTCODES_KEY_CODEX", "openai"),   # luna is not served on this key's codex channel; never sol unless asked
    ("Claude (claude-sonnet-5)", "claude-aws", "claude-sonnet-5", "RIGHTCODES_API_KEY", "anthropic"),
    ("Gemini (gemini-3.1-pro)", "gemini", "gemini-3.1-pro", "RIGHTCODES_KEY_GEMINI", "openai"),
    ("Grok (grok-4.6)", "grok", "grok-4.6", "RIGHTCODES_KEY_GROK", "openai"),
]


def call(judge, prompt):
    name, ch, model, keyenv, proto = judge
    key = os.environ.get(keyenv) or os.environ.get("RIGHTCODES_API_KEY", "")
    if proto == "anthropic":
        req = urllib.request.Request(f"https://right.codes/{ch}/v1/messages", method="POST",
                                     headers={"User-Agent": "Mozilla/5.0", "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                                     data=json.dumps({"model": model, "max_tokens": 1500, "messages": [{"role": "user", "content": prompt}]}).encode())
    else:
        req = urllib.request.Request(f"https://right.codes/{ch}/v1/chat/completions", method="POST",
                                     headers={"User-Agent": "Mozilla/5.0", "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                     data=json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}]}).encode())
    t0 = time.time()
    try:
        d = json.load(urllib.request.urlopen(req, timeout=300))
        txt = d["content"][0]["text"] if proto == "anthropic" else d["choices"][0]["message"]["content"]
        return name, txt.strip(), round(time.time() - t0)
    except Exception as e:
        body = e.read().decode()[:300] if hasattr(e, "read") else ""
        return name, f"(FAILED: {e!r} {body})", round(time.time() - t0)


with ThreadPoolExecutor(4) as ex:
    r1 = list(ex.map(lambda j: call(j, BRIEF), JUDGES))
ok = [r for r in r1 if not r[1].startswith("(FAILED")]
r2 = []
if len(ok) >= 2:
    def final(j):
        others = "\n\n".join(f"### {n}\n{t}" for n, t, _ in ok if n != j[0])
        mine = next((t for n, t, _ in ok if n == j[0]), "(you did not answer round 1)")
        p = (BRIEF + "\n\n## Round 2: the other judges said\n" + others + "\n\n## Your round-1 answer\n" + mine +
             "\n\nRound 2 (under 150 words): after reading the others, give your FINAL vote (Rumi or Farm Hand wins ShellHacks 2026), "
             "say if you changed your mind and why, and the ONE change that most raises Farm Hand's odds.")
        return call(j, p)
    with ThreadPoolExecutor(4) as ex:
        r2 = list(ex.map(final, [j for j in JUDGES if any(n == j[0] for n, _, _ in ok)]))

out = [f"# Judges' conference: Rumi vs Farm Hand (ShellHacks 2026)\n\nRun {time.strftime('%Y-%m-%d %H:%M')}. Brief: `tools/conference_brief.md`.\n\n## Round 1 (alone)\n"]
out += [f"### {n} ({s} s)\n{t}\n" for n, t, s in r1]
out += ["## Round 2 (after reading each other)\n"] + [f"### {n} ({s} s)\n{t}\n" for n, t, s in r2]
(H / "evidence/conference_rumi_vs_farmhand.md").write_text("\n".join(out), encoding="utf-8")
print("saved evidence/conference_rumi_vs_farmhand.md")
