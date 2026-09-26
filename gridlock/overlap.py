"""GridLock overlap engine: every DESC project vs every Georgia Power project -> data/overlaps.json (ranked).

Geographic (primary, Sperry spec): closest points between the two geometries, edge to edge, in meters (EPSG:5070).
  touching / crossing  < 0.05 km  -> must coordinate (outage timing, crossing structures)
  < 1.6 km                          -> share the land (right-of-way, access roads, permits)
  < 8 km                            -> share site logistics (laydown yards, deliveries)
  < 40 km                           -> share crews and equipment
  >= 40 km                          -> ignored
Timeline (secondary): in-service years within 1 year of each other = same build window.
Confidence: 'high' when both sides sit on real substations, 'medium' when one is a town-level approximation, 'low' when both are."""
import json
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points, transform

H = Path(__file__).resolve().parent
TO_M = Transformer.from_crs(4326, 5070, always_xy=True).transform
TO_LL = Transformer.from_crs(5070, 4326, always_xy=True).transform
TIERS = [(0.05, 1, "Touching / crossing", "Must coordinate: outage timing and crossing structures"),
         (1.6, 2, "Under 1.6 km", "Can share the land: right-of-way, access roads, permits"),
         (8.0, 3, "Under 8 km", "Can share site logistics: laydown yards, deliveries"),
         (40.0, 4, "Under 40 km", "Can share crews and equipment")]


def shape(g):
    c = g["coords"]
    return transform(TO_M, Point(c[0]) if g["type"] == "Point" or len(c) == 1 else LineString(c))


def main():
    P = json.loads((H / "data/projects_geo.json").read_text(encoding="utf-8"))
    for i, p in enumerate(P):
        p["id"] = i
    placed = [p for p in P if p["geometry"]]
    desc = [p for p in placed if p["utility"] == "DESC"]
    gpc = [p for p in placed if p["utility"] == "GPC"]
    shp = {p["id"]: shape(p["geometry"]) for p in placed}
    out = []
    for a in desc:
        for b in gpc:
            d_km = shp[a["id"]].distance(shp[b["id"]]) / 1000
            if d_km >= 40:
                continue
            tier = next(t for t in TIERS if d_km < t[0])
            dy = abs(a["year"] - b["year"]) if a["year"] and b["year"] else None
            prec = [x["geometry"]["precision"] for x in (a, b)]
            conf = {0: "high", 1: "medium", 2: "low"}[prec.count("approx (town)")]
            pa, pb = nearest_points(shp[a["id"]], shp[b["id"]])
            out.append({"desc_id": a["id"], "gpc_id": b["id"], "km": round(d_km, 2), "tier": tier[1], "tier_label": tier[2],
                        "share": tier[3], "desc_year": a["year"], "gpc_year": b["year"], "year_gap": dy,
                        "same_window": dy is not None and dy <= 1, "confidence": conf,
                        "link": [list(TO_LL(pa.x, pa.y)), list(TO_LL(pb.x, pb.y))]})
    # rank: closer tier first, then same build window, then confidence, then distance
    cr = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda o: (o["tier"], not o["same_window"], cr[o["confidence"]], o["km"]))
    for r, o in enumerate(out, 1):
        o["rank"] = r
    (H / "data/overlaps.json").write_text(json.dumps({"projects": P, "overlaps": out}, indent=0), encoding="utf-8")
    print(f"{len(desc)} DESC x {len(gpc)} GPC placed -> {len(out)} pairs under 40 km")
    from collections import Counter
    print("by tier:", dict(Counter(o["tier_label"] for o in out)), "| same window:", sum(o["same_window"] for o in out),
          "| confidence:", dict(Counter(o["confidence"] for o in out)))
    for o in out[:15]:
        a, b = P[o["desc_id"]], P[o["gpc_id"]]
        print(f'#{o["rank"]:>2} {o["km"]:>6} km {o["tier_label"]:<20} {o["confidence"]:<6} {a["year"]}/{b["year"]}  {a["name"][:42]}  <>  {b["name"][:48]}')


if __name__ == "__main__":
    main()
