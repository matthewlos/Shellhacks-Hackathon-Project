"""Build app/index.html: the GridLock map + ranked coordination list, with data/overlaps.json baked in.
No build step, no framework (the EvidenceAtlas lesson). Leaflet from cdnjs, OpenStreetMap tiles.
Run: python build_app.py  then  python -m http.server 8710 -d app  ->  http://127.0.0.1:8710"""
import json
from pathlib import Path

H = Path(__file__).resolve().parent
data = json.loads((H / "data/overlaps.json").read_text(encoding="utf-8"))
tpl = (H / "app_template.html").read_text(encoding="utf-8")
(H / "app").mkdir(exist_ok=True)
(H / "app/index.html").write_text(tpl.replace("__DATA__", json.dumps(data, separators=(",", ":"))), encoding="utf-8")
print("app/index.html:", len(data["projects"]), "projects,", len(data["overlaps"]), "overlaps")
