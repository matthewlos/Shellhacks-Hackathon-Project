"""Named substations + power plants in South Carolina and Georgia from OpenStreetMap (Overpass API) -> data/osm_power.json.
Used to put coordinates on project endpoints named in the utility filings. Public data, no CEII."""
import json, urllib.request, urllib.parse
from pathlib import Path
H = Path(__file__).resolve().parent
Q = """[out:json][timeout:180];
(area["ISO3166-2"="US-SC"];area["ISO3166-2"="US-GA"];)->.s;
(nwr["power"="substation"]["name"](area.s);nwr["power"="plant"]["name"](area.s););
out center tags;"""
req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": Q}).encode(),
                             headers={"User-Agent": "gridlock-shellhacks/0.1"})
d = json.loads(urllib.request.urlopen(req, timeout=240).read())
out = []
for e in d["elements"]:
    c = e.get("center") or {"lat": e.get("lat"), "lon": e.get("lon")}
    if c.get("lat") is None:
        continue
    t = e["tags"]
    out.append({"name": t["name"], "kind": t.get("power"), "operator": t.get("operator", ""), "voltage": t.get("voltage", ""),
                "lat": c["lat"], "lon": c["lon"], "osm": f'{e["type"]}/{e["id"]}'})
(H / "data/osm_power.json").write_text(json.dumps(out, indent=0), encoding="utf-8")
print(len(out), "named substations/plants")
from collections import Counter
print(Counter(o["operator"] for o in out).most_common(12))
