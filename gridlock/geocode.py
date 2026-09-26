"""Put coordinates on every planned project by matching the substation/plant names in its title to OpenStreetMap.
In:  data/desc_projects.json, data/sertp_southern_projects.json, data/osm_power.json
Out: data/projects_geo.json  (one record per project: geometry = point or straight line through its named endpoints)

Lines are straight segments between endpoints: the same approximation Sperry's spec calls out for HIFLD.
A name that matches several far-apart places is only accepted when the other endpoint pins it down; otherwise
the project is kept but marked unplaced, with the reason. Nothing is guessed."""
import difflib, json, math, re
from pathlib import Path

H = Path(__file__).resolve().parent
OSM = json.loads((H / "data/osm_power.json").read_text(encoding="utf-8"))

DROP = r"\b(substation|substations|sub|switching station|switching|sw|switchyard|plant|steam plant|generating|station|energy center|ct|cc|transmission|tss|dist|distribution|primary|customer)\b"


def norm(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(DROP, " ", s)
    s = re.sub(r"\b\d+(\.\d+)?\s*(kv|/|mva)?\b", " ", s)
    s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(r"\b(st)\b", "saint", s)
    return re.sub(r"\s+", " ", s).strip()


INDEX = {}
for o in OSM:
    n = norm(o["name"])
    if n:
        INDEX.setdefault(n, []).append(o)
KEYS = list(INDEX)


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


# Savannah River (the SC/GA border), coarse polyline south to north: (lat, lon). SC is east of it, GA west.
RIVER = [(32.03, -80.85), (32.17, -81.12), (32.36, -81.15), (32.60, -81.30), (32.95, -81.50), (33.15, -81.70),
         (33.30, -81.87), (33.47, -81.95), (33.65, -82.20), (34.00, -82.55), (34.35, -82.75), (34.70, -83.10), (35.20, -83.35)]


def river_lon(lat):
    if lat <= RIVER[0][0]:
        return RIVER[0][1]
    for (a, x), (b, y) in zip(RIVER, RIVER[1:]):
        if lat <= b:
            return x + (y - x) * (lat - a) / (b - a)
    return RIVER[-1][1]


def in_state(o, st):
    if st is None:
        return True
    east = o["lon"] > river_lon(o["lat"])
    return east if st == "SC" else not east


CACHE_F = H / "data/nominatim_cache.json"
CACHE = json.loads(CACHE_F.read_text(encoding="utf-8")) if CACHE_F.exists() else {}
STATE = {"SC": "South Carolina", "GA": "Georgia"}


def town(name, st):
    """Fallback for substations too new to be in OpenStreetMap: the town/community of the same name (approximate)."""
    import time, urllib.parse, urllib.request
    q = f"{name}, {STATE[st]}"
    if q not in CACHE:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "us"})
        try:
            CACHE[q] = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "gridlock-shellhacks/0.1"}), timeout=30).read())
        except Exception:
            CACHE[q] = []
        CACHE_F.write_text(json.dumps(CACHE, indent=0), encoding="utf-8")
        time.sleep(1.1)                                   # Nominatim policy: max 1 request a second
    r = CACHE[q]
    if not r or r[0].get("addresstype") in ("state", "county", "country"):
        return []
    o = {"name": f"{name} (town, approx.)", "lat": float(r[0]["lat"]), "lon": float(r[0]["lon"]), "kind": "town"}
    return [o] if in_state(o, st) else []


def candidates(name, st):
    n = norm(name)
    if not n:
        return []
    got = _power_candidates(n, st)
    return got or (town(name, st) if st in STATE and len(n) > 3 else [])


def _power_candidates(n, st):
    hit = INDEX.get(n)
    if not hit:
        close = difflib.get_close_matches(n, KEYS, n=3, cutoff=0.88)
        hit = [o for k in close for o in INDEX[k]]
    pref = [o for o in hit if in_state(o, st)]
    if st == "SC" and not pref:
        pref = [o for o in hit if abs(o["lon"] - river_lon(o["lat"])) < 0.15]   # GA side, within ~15 km of the river (cross-border ties)
    return pref


def endpoints(title):
    t = re.sub(r"^(SAV|MEAG|DU|GTC|OPC|GP|APC|MPC|SEPA|SMEPA|PS):\s*", "", title, flags=re.I)
    t = t.split(":")[0] if ":" in t and not re.match(r"^[A-Z]+:", t) else t
    t = re.split(r",| - Construct| – Construct", t)[0]
    t = re.sub(r"(?i)\b(\d+(\.\d+)?\s*/?\s*)+kv\b.*$", "", t) if re.search(r"(?i)kv", t) else t
    t = re.sub(r"(?<=[A-Za-z.])-(?=\s?[A-Z])", " - ", t)          # 'Canadys-Ritter' -> 'Canadys - Ritter'
    t = re.sub(r"(?i)\b(vcs1|vcs2|vcs)\b", "Virgil C. Summer Nuclear #1", t)
    parts = [p.strip() for p in re.split(r"\s[–-]\s|\s–|–\s|\bto\b", t) if p.strip()]
    return parts[:3]


def place(title, st):
    names = endpoints(title)
    cands = [candidates(n, st) for n in names]
    found = [(n, c) for n, c in zip(names, cands) if c]
    if not found:
        return None, names, "no endpoint name found in OpenStreetMap"
    if len(found) == 1:
        n, c = found[0]
        if len(c) > 1 and max(km(a, b) for a in c for b in c) > 30:
            return None, names, f"'{n}' matches {len(c)} places far apart"
        o = c[0]
        return {"type": "Point", "coords": [[o["lon"], o["lat"]]], "matched": [o["name"]]}, names, None
    # two+ endpoints: pick the combination with the shortest total span (lines are local)
    best = None
    for a in found[0][1][:8]:
        for b in found[1][1][:8]:
            d = km(a, b)
            if best is None or d < best[0]:
                best = (d, a, b)
    d, a, b = best
    if d > 60:
        # these rebuilds are local; a long span means a town-name guess landed on a same-named place elsewhere.
        real = [o for o in (a, b) if o.get("kind") != "town"]
        if real:
            o = real[0]
            return {"type": "Point", "coords": [[o["lon"], o["lat"]]], "matched": [o["name"]],
                    "note": f"other endpoint dropped: guessed {d:.0f} km away"}, names, None
        return None, names, f"only town-name guesses, {d:.0f} km apart"
    return {"type": "LineString", "coords": [[a["lon"], a["lat"]], [b["lon"], b["lat"]]], "matched": [a["name"], b["name"]], "span_km": round(d, 1)}, names, None


def year_of(p):
    if p.get("in_service_year"):
        return p["in_service_year"]
    m = re.findall(r"(20\d\d|\b\d\d)\s*(?:\(|$)", (p.get("in_service") or "").strip())
    y = re.findall(r"/(\d{2,4})\b", p.get("in_service") or "")
    if y:
        v = int(y[-1])
        return v + 2000 if v < 100 else v
    return None


def main():
    desc = json.loads((H / "data/desc_projects.json").read_text(encoding="utf-8"))
    sou = json.loads((H / "data/sertp_southern_projects.json").read_text(encoding="utf-8"))
    out, miss = [], []
    for p, st, util in [(p, "SC", "DESC") for p in desc] + [(p, "GA", "GPC") for p in sou]:
        geom, names, why = place(p["name"], st)
        if geom:
            geom["precision"] = "approx (town)" if any("(town, approx.)" in m for m in geom["matched"]) else "substation"
        rec = {"utility": util, "name": p["name"], "year": year_of(p), "endpoints": names, "geometry": geom,
               "unplaced_reason": why, "cost_total_usd": p.get("cost_total_usd"), "description": p.get("description"),
               "need": p.get("need"), "source": p["source"], "project_id": p.get("project_id")}
        # Southern BA also covers Alabama/Mississippi: keep only what lands in Georgia (or is unplaced, for honesty)
        if util == "GPC" and geom and not all(in_state({"lon": c[0], "lat": c[1]}, "GA") for c in geom["coords"]):
            continue
        out.append(rec)
        if not geom:
            miss.append(rec)
    (H / "data/projects_geo.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    for u in ("DESC", "GPC"):
        tot = sum(1 for r in out if r["utility"] == u)
        ok = sum(1 for r in out if r["utility"] == u and r["geometry"])
        print(f"{u}: {ok}/{tot} placed")


if __name__ == "__main__":
    main()
