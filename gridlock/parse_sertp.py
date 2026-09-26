"""SERTP 2025 Regional Transmission Plan -> Southern Balancing Authority projects (Georgia Power + Alabama/Mississippi Power + GA co-ops/munis)
-> data/sertp_southern_projects.json. The PDF section headers are garbled overlays; pages are grouped by that header line,
and the group that starts on page 61 (first 'Southern' page) is kept."""
import json, re
from pathlib import Path
import pdfplumber

H = Path(__file__).resolve().parent
SRC = H / "data/raw/sertp_2025_regional_plan.pdf"
FIRST_SOUTHERN_PAGE = 61


def main():
    with pdfplumber.open(SRC) as pdf:
        pages = [(i + 1, p.extract_text() or "") for i, p in enumerate(pdf.pages)]
    head = lambda t: (t.split("\n") + ["", ""])[1]
    key = head(dict(pages)[FIRST_SOUTHERN_PAGE])
    sec = [(i, t) for i, t in pages if i >= FIRST_SOUTHERN_PAGE and head(t) == key]
    # stop at the first gap (the section is contiguous)
    run = [sec[0]]
    for i, t in sec[1:]:
        if i != run[-1][0] + 1:
            break
        run.append((i, t))
    text = "\n".join(re.sub(r"\n\d+\s*$", "", t) for _, t in run)
    items = re.split(r"(?=In-Service \d{4}\nYear:)", text)
    out = []
    for it in items:
        m = re.match(r"In-Service (\d{4})\nYear:\n", it)
        if not m:
            continue
        body = it[m.end():]
        name = re.search(r"Project Name:(.*?)\nDescription:", body, re.S)
        desc = re.search(r"Description:(.*?)\nSupporting", body, re.S)
        why = re.search(r"Supporting(.*)", body, re.S)
        clean = lambda s: re.sub(r"\s+", " ", s.replace("Statements:", "")).strip() if s else None
        out.append({
            "utility": "SOUTHERN",
            "in_service_year": int(m.group(1)),
            "name": clean(name.group(1)) if name else None,
            "description": clean(desc.group(1)) if desc else None,
            "need": clean(why.group(1)) if why else None,
            "source": f"SERTP 2025 Regional Transmission Plan, Southern BA section, pages {run[0][0]}-{run[-1][0]} (southeasternrtp.com)",
        })
    (H / "data/sertp_southern_projects.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{len(out)} Southern BA projects from pages {run[0][0]}-{run[-1][0]}")
    for p in out:
        print(p["in_service_year"], p["name"])


if __name__ == "__main__":
    main()
