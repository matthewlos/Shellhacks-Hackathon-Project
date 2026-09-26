"""Vegetation / land cover for the whole Farm Hand map (74 km on FIU), from USDA NASS Cropland Data Layer 2024.

The farm fields (build_region.py) only cover cropland. Around FIU it is suburbs, so this gives every spot a plain
land-cover class: trees, grass & parks, wetlands, suburbs with yards, built-up, water (crop pixels = "farmland", drawn faint because the
AlphaEarth fields already show crops).

Out: out/landcover_v1.png, a paletted PNG in Web Mercator (EPSG:3857) at ~60 m, so Leaflet can lay it over the map
     with a plain imageOverlay; its palette doubles as the lookup table (the web app reads a pixel to name a spot).
     The metadata (bounds, classes, shares near FIU) is written into region_v2.json as region.landcover, and both
     files are copied to farm-hand/cloud/ (receiver.py serves the PNG at /farmhand/api/landcover.png).
Run:  farm-hand/laya/.venv-mac/bin/python farm-hand/alphaearth/build_landcover.py   (also called by build_region.py)
Data: USDA NASS Cropland Data Layer 2024 (public domain), the clip build_region.py caches.

Note: AlphaEarth could give a finer greenness/tree score, but its embeddings here are only read for the farm box
(not all 74 km), and a tree-vs-lawn head would need its own labels; CDL is the honest, already-labelled source.
"""
import json
import math
import shutil
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.warp import Resampling, reproject

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CLOUD = HERE.parent / "cloud"
CDL_TIF = OUT / "cdl_2024_fiu74km.tif"
FIU = {"lat": 25.7566, "lon": -80.3740}
HALF_KM = 37
PIX_M = 60                                     # ground metres per pixel (Mercator pixel = PIX_M / cos(lat))

CROP_CODES = set(range(1, 62)) | set(range(66, 78)) | set(range(204, 255))
# index: (id, label, colour, alpha 0-255, CDL codes). Index 0 = no data (transparent).
CLASSES = [
    ("nodata",   "No data",                  (0, 0, 0),       0,   {0}),
    ("trees",    "Trees",                    (38, 122, 58),   170, {63, 141, 142, 143}),
    ("grass",    "Grass & parks",            (150, 205, 95),  150, {64, 121, 152, 176}),
    ("wetland",  "Wetlands",                 (64, 160, 150),  160, {87, 190, 195}),
    ("yards",    "Suburbs with yards",        (196, 214, 120), 105, {122}),         # CDL low intensity: 20-49 % paved, the rest yards & trees
    ("built",    "Built-up",                 (150, 140, 150), 120, {82, 123, 124, 131}),
    ("water",    "Water",                    (60, 120, 200),  150, {83, 92, 111}),
    ("farmland", "Farmland (see the fields)", (220, 180, 90),  70,  CROP_CODES),
]


def main():
    to_m = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    to_ll = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    utm = Transformer.from_crs("EPSG:4326", "EPSG:32617", always_xy=True)
    utm_ll = Transformer.from_crs("EPSG:32617", "EPSG:4326", always_xy=True)
    fx, fy = utm.transform(FIU["lon"], FIU["lat"])
    lons, lats = utm_ll.transform([fx - HALF_KM * 1000, fx + HALF_KM * 1000] * 2, [fy - HALF_KM * 1000] * 2 + [fy + HALF_KM * 1000] * 2)
    W, S, E, N = min(lons), min(lats), max(lons), max(lats)
    x0, y0 = to_m.transform(W, S)
    x1, y1 = to_m.transform(E, N)
    px = PIX_M / math.cos(math.radians(FIU["lat"]))
    w, h = int(round((x1 - x0) / px)), int(round((y1 - y0) / px))
    tr = rasterio.Affine((x1 - x0) / w, 0, x0, 0, -(y1 - y0) / h, y1)
    code = np.zeros((h, w), np.uint8)
    with rasterio.open(CDL_TIF) as src:
        reproject(rasterio.band(src, 1), code, dst_transform=tr, dst_crs="EPSG:3857", resampling=Resampling.mode)
    idx = np.zeros((h, w), np.uint8)
    for i, (_, _, _, _, codes) in enumerate(CLASSES):
        if i:
            idx[np.isin(code, list(codes))] = i

    img = Image.fromarray(idx, "P")
    pal = []
    for _, _, rgb, _, _ in CLASSES:
        pal += list(rgb)
    img.putpalette(pal + [0] * (768 - len(pal)))
    png = OUT / "landcover_v1.png"
    img.save(png, optimize=True, transparency=bytes(a for *_, a, _ in CLASSES))

    # shares within 5 km of FIU (for the legend / honesty)
    cx, cy = to_m.transform(FIU["lon"], FIU["lat"])
    rr, cc = np.indices((h, w))
    mx, my = x0 + (cc + 0.5) * tr.a, y1 + (rr + 0.5) * tr.e
    near = np.hypot(mx - cx, my - cy) * math.cos(math.radians(FIU["lat"])) <= 5000
    tot = max(1, int((near & (idx > 0)).sum()))
    share = {CLASSES[i][0]: round(100 * int((near & (idx == i)).sum()) / tot, 1) for i in range(1, len(CLASSES))}

    meta = {
        "url": "api/landcover.png", "version": 1, "year": 2024, "pixelM": PIX_M, "crs": "EPSG:3857",
        "bounds": [[round(S, 6), round(W, 6)], [round(N, 6), round(E, 6)]],
        "classes": [{"id": k, "label": lab, "color": "#%02x%02x%02x" % rgb, "alpha": a, "cdl": sorted(c) if k != "farmland" else "all crop codes"}
                    for k, lab, rgb, a, c in CLASSES[1:]],
        "shareNearFiu5km": share,
        "source": "USDA NASS Cropland Data Layer 2024 (30 m), grouped into plain land-cover classes; resampled (mode) to ~60 m",
        "sourceUrl": "https://nassgeodata.gmu.edu/CropScape/",
    }
    for f in (OUT / "region_v2.json",):
        v = json.loads(f.read_text())
        v["region"]["landcover"] = meta
        src = v["region"].setdefault("sources", [])
        if not any("Land cover" in s.get("what", "") for s in src):
            src.append({"name": "USDA NASS Cropland Data Layer 2024 (land cover)", "what": "Land cover: trees, grass & parks, wetlands, suburbs with yards, built-up, water",
                        "url": meta["sourceUrl"]})
        f.write_text(json.dumps(v, separators=(",", ":")))
        shutil.copy(f, CLOUD / "region_v2.json")
    shutil.copy(png, CLOUD / "landcover_v1.png")
    print(f"landcover {w}x{h}, {png.stat().st_size / 1e3:.0f} kB; within 5 km of FIU: {share}")


if __name__ == "__main__":
    main()
