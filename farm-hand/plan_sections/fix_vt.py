"""One-time: replace the stray vertical-tab byte (chr 11) in PLAN_BODY.md with the intended backslash + v."""
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "PLAN_BODY.md"
s = p.read_text(encoding="utf-8")
n = s.count(chr(11))
s = s.replace(chr(11), chr(92) + "v")
p.write_text(s, encoding="utf-8")
print("replaced", n, "| left", s.count(chr(11)))
