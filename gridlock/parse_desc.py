"""Dominion Energy South Carolina: SCRTP 'Planned Transmission Projects $2M and above' (2026-2030) -> data/desc_projects.json"""
import json, re
from pathlib import Path
import pdfplumber

H = Path(__file__).resolve().parent
SRC = H / "data/raw/desc_scrtp_2026_2030_projects.pdf"


def grab(block, label, nxt):
    m = re.search(re.escape(label) + r"\s*\n(.*?)\n(?:" + "|".join(map(re.escape, nxt)) + r")", block, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


def main():
    with pdfplumber.open(SRC) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    blocks = re.split(r"(?=Project \d+ of \d+\n)", text)
    out = []
    for b in blocks:
        m = re.match(r"Project (\d+) of (\d+)\n", b)
        if not m:
            continue
        title = re.search(r"5 Year Budget\n(.*?)\nProject ID", b, re.S)
        cost = re.search(r"Previous 2026 2027 2028 2029 2030 Total\n(.*)", b)
        nums = re.findall(r"\$[\d,]+", cost.group(1)) if cost else []
        out.append({
            "utility": "DESC",
            "n": int(m.group(1)),
            "name": re.sub(r"\s+", " ", title.group(1)).replace("�", "-").strip() if title else None,
            "project_id": grab(b, "Project ID", ["Project Description"]),
            "description": grab(b, "Project Description", ["Project Need"]),
            "need": grab(b, "Project Need", ["Project Status"]),
            "status": grab(b, "Project Status", ["Planned In-Service Date"]),
            "in_service": grab(b, "Planned In-Service Date", ["Estimated Project Cost"]),
            "cost_total_usd": int(nums[-1].replace("$", "").replace(",", "")) if nums else None,
            "source": "SCRTP DESC Planned Transmission Projects $2M and above, 2026-2030 (scrtp.com)",
        })
    (H / "data").mkdir(exist_ok=True)
    (H / "data/desc_projects.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(len(out), "DESC projects")
    for p in out:
        print(f'{p["n"]:>2} {p["in_service"]!s:>10}  ${p["cost_total_usd"] or 0:>12,}  {p["name"]}')


if __name__ == "__main__":
    main()
