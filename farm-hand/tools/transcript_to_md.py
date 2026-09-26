"""Turn a raw Claude Code CLI transcript export into readable Markdown.

Usage:  python tools/transcript_to_md.py <in.txt> [out.md]

The export is a flat text dump where every block starts with a marker glyph:
  U+25CF  an assistant action: prose, or a tool call if it reads like Tool(...)
  U+276F  a user message
  U+23BF  a tool result
  U+273B  a status line ("Brewed for 3m 22s")
  U+203B  the turn recap
  U+203A  an attachment / file reference
Anything not starting with a marker is a wrapped continuation of the block above.

Prose gets unwrapped back into paragraphs. Tool calls and results stay verbatim
inside fenced blocks, because reflowing them would break diffs and paths.
"""
import re
import sys
from pathlib import Path

# Markers are written as escapes: the console codepage mangles raw glyphs.
BULLET, USER, RESULT, STATUS, RECAP, ATTACH = (
    "\u25cf", "\u276f", "\u23bf", "\u273b", "\u203b", "\u203a",
)
MARKERS = BULLET + USER + RESULT + STATUS + RECAP + ATTACH

TOOL_RE = re.compile(
    r"^(Bash|Write|Edit|MultiEdit|Read|Web Search|WebSearch|Fetch|PowerShell|"
    r"NotebookEdit|TodoWrite|Task|Agent|Glob|Grep|LS)\s*\(",
    re.IGNORECASE,
)
FENCE_LANG = {"bash": "bash", "powershell": "powershell", "write": "diff", "edit": "diff"}
BULLET_RE = re.compile(r"^([-*]|\d+[.)])\s")
ICON_PREFIXES = (
    "\u2705", "\u26a0\ufe0f", "\U0001f4cd", "\U0001f534", "\u25b6\ufe0f",
    "\u274c", ATTACH, "*",
)


def dedent(lines):
    """Drop the display indentation a block carries, keeping relative indents."""
    body = [ln for ln in lines if ln.strip()]
    if not body:
        return []
    pad = min(len(ln) - len(ln.lstrip()) for ln in body)
    return [ln[pad:] if ln.strip() else "" for ln in lines]


def unwrap(lines):
    """Re-join wrapped prose, but keep bullets, icon lines and blanks separate."""
    out = []
    for raw in lines:
        text = raw.strip()
        if not text:
            out.append("")
            continue
        standalone = text.startswith(ICON_PREFIXES) or bool(BULLET_RE.match(text))
        mergeable = (
            out
            and out[-1]
            and not standalone
            and not out[-1].startswith(ICON_PREFIXES)
            and not BULLET_RE.match(out[-1])
        )
        if mergeable:
            out[-1] += " " + text
        else:
            out.append(text)
    while out and not out[-1]:
        out.pop()
    return out


def classify(lines):
    """Split the flat dump into [marker, content_lines] blocks."""
    blocks, current = [], None
    for raw in lines:
        line = raw.rstrip("\n")
        head = line.lstrip()
        if head and head[0] in MARKERS:
            if current:
                blocks.append(current)
            current = [head[0], [head[1:].lstrip()]]
        elif current is not None:
            current[1].append(line)
        else:
            current = [" ", [line]]
    if current:
        blocks.append(current)
    return blocks


def fence(lang, body):
    text = "\n".join(body).rstrip()
    return f"```{lang}\n{text}\n```" if text else ""


def render(blocks):
    out = ["# Farm Hand \u2014 session transcript (2026-09-23)", ""]
    for marker, lines in blocks:
        body = dedent(lines)
        if marker == " ":
            head = [ln for ln in body if ln.strip()]
            if head:
                out += ["> Raw Claude Code export header:", "", fence("", head), ""]
        elif marker == USER:
            out += ["---", "", f"## {USER} Dechante", ""] + unwrap(body) + [""]
        elif marker == BULLET:
            first = next((ln for ln in body if ln.strip()), "")
            tool = TOOL_RE.match(first.strip())
            if tool:
                name = tool.group(1)
                out += [f"#### \U0001f527 `{name}`", "", fence(FENCE_LANG.get(name.lower(), ""), body), ""]
            else:
                out += ["#### \U0001f916 Claude", ""] + unwrap(body) + [""]
        elif marker == RESULT:
            if any(ln.strip() for ln in body):
                out += [fence("", body), ""]
        elif marker == STATUS:
            text = " ".join(ln.strip() for ln in body if ln.strip())
            if text:
                out += [f"*{text}*", ""]
        elif marker == RECAP:
            text = " ".join(ln.strip() for ln in body if ln.strip())
            if text:
                out += [f"> {text}", ""]
        elif marker == ATTACH:
            text = " ".join(ln.strip() for ln in body if ln.strip())
            if text:
                out += [f"*Attachment:* `{text}`", ""]
    return "\n".join(out).rstrip() + "\n"


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: transcript_to_md.py <in.txt> [out.md]")
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".md")
    blocks = classify(src.read_text(encoding="utf-8", errors="replace").splitlines())
    dst.write_text(render(blocks), encoding="utf-8")
    print(f"wrote {dst} {dst.stat().st_size} bytes from {len(blocks)} blocks")


if __name__ == "__main__":
    main()
