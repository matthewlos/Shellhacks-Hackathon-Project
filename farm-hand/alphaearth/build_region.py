"""AlphaEarth v2: the farm fields around Farm Hand, one by one, with crop, soil, water line, look-alikes and trend.

Farm Hand's box sits at FIU. Miami-Dade's farm belt (Redland / Homestead) starts ~15 km south-west of it. This builds a
RegionView (farm-hand/web/src/data/types.ts) for that land, from public data only:

1. Google DeepMind's AlphaEarth Foundations Satellite Embedding (64 numbers per pixel per year) for the farm belt,
   read at 20 m for 2024 and 2025, and at 40 m for every year 2017-2025 (trend). Only the window is downloaded.
2. A pixel classifier (USDA Cropland Data Layer 2024 as the answer key, 15 land/crop groups) maps farmland.
3. Farmland (2024, the year with an answer key) is cut into fields along AlphaEarth fingerprint edges (SLIC superpixels on the fingerprints, then
   touching same-crop pieces with near-identical fingerprints merged), min 0.5 ha. Each field's fingerprints are averaged and a field classifier, trained on 2024 fields labelled by
   the CDL, names its crop group. Accuracy is measured on whole fields held out in 1.5 km spatial blocks.
4. Soil per field from USDA NRCS SSURGO (Soil Data Access), at a point inside the field. Cached. Never guessed.
5. Moisture baseline per field: FAO-56 Table 22 depletion fraction p for its crop group, put on Farm Hand's probe
   scale as 20 + 45 * (1 - p) %.
   Each field also gets crop2025: the same model on its 2025 fingerprints.
6. "Fields like this one": other fields whose mean 2024 fingerprint has cosine similarity >= the 95th percentile of
   all field pairs.
7. Trend: each field's mean farm probability for 2017..2025 (the 2024-trained pixel classifier on each year).

Run:  farm-hand/laya/.venv-mac/bin/python farm-hand/alphaearth/build_region.py
Out:  farm-hand/alphaearth/out/region_v2.json (+ copied to farm-hand/cloud/region_v2.json, which receiver.py serves)
Data: "The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind." (CC-BY 4.0)
      USDA NASS Cropland Data Layer 2024; USDA NRCS SSURGO via Soil Data Access; FAO Irrigation & Drainage Paper 56.
"""
import json
import math
import shutil
import time
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import shapes
from rasterio.warp import Resampling, reproject, transform_bounds
from scipy import ndimage
from shapely.geometry import shape as to_shape
from skimage.segmentation import slic
from sklearn.decomposition import PCA
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, precision_recall_fscore_support

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
CLOUD = HERE.parent / "cloud"

W, S, E, N = -80.60, 25.43, -80.40, 25.62            # Redland / Homestead farm belt (same box as v1)
FIU = {"name": "FIU", "lat": 25.7566, "lon": -80.3740}  # the Farm Hand box
HALF_KM, GRID_N = 37, 148                             # UI grid: 74 km square on FIU, 500 m cells (covers the belt)
BUCKET = "https://storage.googleapis.com/alphaearth_foundations/satellite_embedding/v1/annual"
TILES = {  # aef_index.csv: the one UTM 17N tile per year that covers the box
    2017: "2017/17N/xpcv00xesauhf6a1r", 2018: "2018/17N/xqljtr7ni9ntsx5c4", 2019: "2019/17N/xbe7thyfu86mvyapl",
    2020: "2020/17N/x1k86w3loipahij3a", 2021: "2021/17N/xmcepcm1cv86qi62y", 2022: "2022/17N/x0t80ho599vihmsow",
    2023: "2023/17N/xurw47dkebttuo240", 2024: "2024/17N/xswc2n2unbptlyjhz", 2025: "2025/17N/xkbyccha41qpeh57w",
}
YEARS = list(range(2017, 2026))
SDA = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest"
CDL_SERVICE = "https://nassgeodata.gmu.edu/axis2/services/CDLService"
MIN_FIELD_PX = 13                                     # 13 px x 400 m2 = 0.52 ha
RNG = np.random.default_rng(7)

# ---------------------------------------------------------------- groups
# CDL 2024 in the box: avocados 3940 ha, misc vegs & fruits 2464, other tree crops (mango, lychee, longan...) 1999,
# sod/grass seed 494, citrus+oranges 632, sugarcane 340, fallow 79, and a few ha of corn/rice/beans/hay/radish
# (too few to learn on their own: folded into "vegetables & row crops").
FARM_GROUPS = {
    "avocado":    {"label": "Avocados", "code": 215, "cdl": {215}},
    "tree_fruit": {"label": "Mango, lychee & other tree fruit", "code": 71,
                   "cdl": {66, 67, 68, 69, 70, 71, 74, 75, 76, 77, 204, 210, 211, 217, 218, 220, 223}},
    "citrus":     {"label": "Citrus", "code": 72, "cdl": {72, 212}},
    "vegetables": {"label": "Vegetables & row crops", "code": 47, "cdl": set()},   # every other crop code (filled below)
    "sod":        {"label": "Sod & nursery grass", "code": 59, "cdl": {59}},
    "sugarcane":  {"label": "Sugarcane", "code": 45, "cdl": {45}},
    "fallow":     {"label": "Fallow / idle cropland", "code": 61, "cdl": {61}},
}
CROP_CODES = set(range(1, 62)) | set(range(66, 78)) | set(range(204, 255))
_named = set().union(*(g["cdl"] for g in FARM_GROUPS.values()))
FARM_GROUPS["vegetables"]["cdl"] = CROP_CODES - _named
LAND_GROUPS = {
    "developed": {"label": "Towns & roads", "code": 122, "cdl": {82, 121, 122, 123, 124}},
    "forest":    {"label": "Forest", "code": 142, "cdl": {63, 141, 142, 143}},
    "woody_wet": {"label": "Woody wetland", "code": 190, "cdl": {190}},
    "herb_wet":  {"label": "Herbaceous wetland", "code": 195, "cdl": {87, 195}},
    "shrub":     {"label": "Shrubland", "code": 152, "cdl": {64, 152}},
    "barren":    {"label": "Barren / rock", "code": 131, "cdl": {65, 131}},
    "water":     {"label": "Water", "code": 111, "cdl": {83, 92, 111}},
    "grass":     {"label": "Grass / pasture (incl. lawns)", "code": 176, "cdl": {176}},
}
GROUPS = list(FARM_GROUPS) + list(LAND_GROUPS)
ALLG = {**FARM_GROUPS, **LAND_GROUPS}
NF = len(FARM_GROUPS)

# FAO-56 Table 22 depletion fraction p (fraction of total available water that can be used before stress).
# Stress line on Farm Hand's 20-65 % probe scale = 20 + 45 * (1 - p). This mapping is Farm Hand's, not FAO's.
P_TABLE = {
    "avocado":    {"p": 0.70, "fao": "Avocado 0.70"},
    "tree_fruit": {"p": 0.50, "fao": "not in Table 22 (mango, lychee); citrus 0.50 used as the nearest evergreen tree fruit"},
    "citrus":     {"p": 0.50, "fao": "Citrus, 70% canopy 0.50"},
    "vegetables": {"p": 0.40, "fao": "Tomato 0.40 (Redland's main vegetable; peppers 0.30, beans 0.45, squash 0.50)"},
    "sod":        {"p": 0.50, "fao": "Turf grass, warm season 0.50"},
    "sugarcane":  {"p": 0.65, "fao": "Sugar cane 0.65"},
    "fallow":     {"p": None, "fao": "no crop: no stress line"},
}
for g in P_TABLE.values():
    g["baselinePct"] = None if g["p"] is None else round(20 + 45 * (1 - g["p"]), 1)

# CDL legend names/families for codes the 74 km grid may show (colours follow Prompt Grass's cdl.ts families)
FAMILY_LABEL = {"orchard": "Orchard", "vegetables": "Vegetables", "hay": "Hay & alfalfa", "other_crop": "Other crops", "grain": "Grain",
                "oilseed": "Oilseeds & beans", "berries": "Berries", "pasture": "Pasture & grass", "fallow": "Fallow", "forest": "Forest",
                "shrub": "Shrubland", "wetland": "Wetland", "water": "Water", "developed": "Towns & roads", "barren": "Barren", "nodata": "No data"}
FAMILY_COLOR = {"orchard": "#b0564a", "vegetables": "#5fae52", "hay": "#7ba863", "other_crop": "#9a9a62", "grain": "#c9a84a",
                "oilseed": "#8a9a48", "berries": "#b04a72", "pasture": "#566b4a", "fallow": "#84735c", "forest": "#2c4636",
                "shrub": "#5f5f45", "wetland": "#3c6464", "water": "#2c5674", "developed": "#4c4f54", "barren": "#6f6a60", "nodata": "#22262a"}
CDL = {  # code: (name, family, colour or None)
    215: ("Avocados", "orchard", "#4f6a3a"), 71: ("Mango, lychee & other tree fruit", "orchard", "#8a6c3c"), 72: ("Citrus", "orchard", "#dc943a"),
    212: ("Oranges", "orchard", "#dc943a"), 47: ("Vegetables & row crops", "vegetables", None), 59: ("Sod & nursery grass", "hay", "#7fb27a"),
    45: ("Sugarcane", "other_crop", None), 61: ("Fallow / idle cropland", "fallow", None), 1: ("Corn", "grain", "#d2ad3e"),
    3: ("Rice", "grain", "#9cc3a4"), 12: ("Sweet Corn", "vegetables", "#e0c25a"), 37: ("Other Hay/Non Alfalfa", "hay", "#8fae74"),
    42: ("Dry Beans", "oilseed", "#9a7a52"), 54: ("Tomatoes", "vegetables", "#c9503e"), 216: ("Peppers", "vegetables", "#c2553a"),
    221: ("Strawberries", "berries", "#c6455c"), 222: ("Squash", "vegetables", "#c9b04a"), 246: ("Radishes", "vegetables", "#c64a6a"),
    36: ("Alfalfa", "hay", None), 5: ("Soybeans", "oilseed", None), 2: ("Cotton", "other_crop", None),
    82: ("Developed", "developed", None), 83: ("Water", "water", None), 87: ("Wetlands", "wetland", None), 92: ("Aquaculture", "water", None),
    111: ("Open Water", "water", None), 121: ("Developed/Open Space", "developed", None), 122: ("Developed/Low Intensity", "developed", None),
    123: ("Developed/Med Intensity", "developed", None), 124: ("Developed/High Intensity", "developed", None), 131: ("Barren", "barren", None),
    141: ("Deciduous Forest", "forest", None), 142: ("Evergreen Forest", "forest", None), 143: ("Mixed Forest", "forest", None),
    152: ("Shrubland", "shrub", None), 176: ("Grass/Pasture", "pasture", None), 190: ("Woody Wetlands", "wetland", None),
    195: ("Herbaceous Wetlands", "wetland", None),
}


def cdl_info(code):
    if code in CDL:
        name, fam, col = CDL[code]
    elif code in CROP_CODES:
        name, fam, col = f"CDL class {code}", "other_crop", None
    else:
        name, fam, col = ("No data (sea, or outside the cropland map)" if code == 0 else f"CDL class {code}"), "nodata", None
    return name, fam, col or FAMILY_COLOR[fam]


def group_of_cdl(a):
    """CDL code raster -> group index (-1 = no data / unmapped)."""
    g = np.full(a.shape, -1, np.int8)
    for i, k in enumerate(GROUPS):
        g[np.isin(a, list(ALLG[k]["cdl"]))] = i
    return g


# ---------------------------------------------------------------- data
def fetch(url, timeout=300, tries=4, data=None, headers=None):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers or {})
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            print(f"  retry {i + 1}/{tries}: {type(e).__name__} {str(e)[:80]}", flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"gave up on {url[:80]}")


def box_grid(pix):
    """The window in UTM 17N. The 20 m grid is exactly the 40 m grid (v1's) split in two, so 40 m rows/cols = 20 m // 2."""
    crs = rasterio.crs.CRS.from_epsg(32617)
    xmin, ymin, xmax, ymax = transform_bounds("EPSG:4326", crs, W, S, E, N)
    w40, h40 = int(round((xmax - xmin) / 40)), int(round((ymax - ymin) / 40))
    k = 40 // pix
    w, h = w40 * k, h40 * k
    return (xmin, ymin, xmax, ymax), w, h, rasterio.Affine((xmax - xmin) / w, 0, xmin, 0, -(ymax - ymin) / h, ymax), crs


def read_raw(year, pix):
    """int8 window (64, h, w), north-up. Cached in out/. GDAL reads the tile's overviews at 20/40 m."""
    f = OUT / f"aef_{year}_{pix}m_raw.npz"
    if f.exists():
        return np.load(f)["raw"]
    (xmin, ymin, xmax, ymax), w, h, _, _ = box_grid(pix)
    t0 = time.time()
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tiff",
                      GDAL_HTTP_MULTIRANGE="YES", VSI_CACHE="TRUE", GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="3"):
        with rasterio.open(f"{BUCKET}/{TILES[year]}-0000000000-0000000000.tiff") as src:
            t = src.transform                           # stored SOUTH-UP: positive y pixel size
            col0 = (xmin - t.c) / t.a
            row0 = (ymin - t.f) / t.e if t.e > 0 else (ymax - t.f) / t.e
            win = rasterio.windows.Window(col0, row0, (xmax - xmin) / abs(t.a), (ymax - ymin) / abs(t.e))
            raw = src.read(window=win, out_shape=(src.count, h, w), resampling=Resampling.nearest)
            if t.e > 0:
                raw = raw[:, ::-1, :]
    raw = np.ascontiguousarray(raw)
    np.savez_compressed(f, raw=raw)
    print(f"  read AlphaEarth {year} at {pix} m: {w}x{h}, {time.time() - t0:.0f} s", flush=True)
    return raw


def dequant(raw):
    """(64, h, w) int8 -> (h*w, 64) float32 unit vectors; rows of NaN where masked."""
    x = raw.reshape(64, -1).T.astype(np.float32)
    bad = (raw.reshape(64, -1).T == -128).any(1)
    e = np.sign(x) * (x / 127.5) ** 2
    e /= np.linalg.norm(e, axis=1, keepdims=True) + 1e-9
    e[bad] = np.nan
    return e


def cdl_big():
    """CDL 2024 for the whole 74 km FIU grid (also covers the belt). One CropScape clip, cached."""
    f = OUT / "cdl_2024_fiu74km.tif"
    if not f.exists():
        x0, y0 = grid_origin()
        t = Transformer.from_crs("EPSG:32617", "EPSG:5070", always_xy=True)
        xs, ys = t.transform([x0, x0 + 2 * HALF_KM * 1000] * 2, [y0, y0, y0 - 2 * HALF_KM * 1000, y0 - 2 * HALF_KM * 1000])
        q = f"{CDL_SERVICE}/GetCDLFile?year=2024&bbox={min(xs) - 500:.0f},{min(ys) - 500:.0f},{max(xs) + 500:.0f},{max(ys) + 500:.0f}"
        xml = fetch(q).decode()
        url = xml.split("<returnURL>")[1].split("</returnURL>")[0]
        f.write_bytes(fetch(url))
    return f


def cdl_onto(dst_shape, dst_tr, dst_crs, resampling):
    dst = np.zeros(dst_shape, np.uint8)
    with rasterio.open(cdl_big()) as src:
        reproject(rasterio.band(src, 1), dst, dst_transform=dst_tr, dst_crs=dst_crs, resampling=resampling)
    return dst


def grid_origin():
    t = Transformer.from_crs("EPSG:4326", "EPSG:32617", always_xy=True)
    fx, fy = t.transform(FIU["lon"], FIU["lat"])
    return fx - HALF_KM * 1000, fy + HALF_KM * 1000     # top-left of the UI grid (UTM)


# ---------------------------------------------------------------- models
def spatial_blocks(rows, cols, pix, block_m=1500):
    k = block_m // pix
    return (rows // k) * 10000 + (cols // k)


def pixel_model(X, g, H, Wd):
    """15-group pixel classifier on 2024 (sampled). Held-out = whole 1.5 km blocks. Returns (model, metrics)."""
    ok = np.flatnonzero(~np.isnan(X[:, 0]) & (g >= 0))
    pick = []
    for i in range(len(GROUPS)):
        m = ok[g[ok] == i]
        if len(m):
            pick.append(RNG.choice(m, min(len(m), 14000), replace=False))
    pick = np.concatenate(pick)
    blocks = spatial_blocks(pick // Wd, pick % Wd, 20)
    ub = np.unique(blocks)
    test_b = set(RNG.choice(ub, len(ub) // 5, replace=False).tolist())
    te = np.array([b in test_b for b in blocks])
    clf = HistGradientBoostingClassifier(max_iter=250, learning_rate=0.1, random_state=0).fit(X[pick[~te]], g[pick[~te]])
    pr = clf.predict(X[pick[te]])
    yt = g[pick[te]]
    farm_t, farm_p = yt < NF, pr < NF
    met = {"heldOut": "20% of 1.5 km spatial blocks (pixels in them never trained on)", "testPixels": int(te.sum()),
           "farmVsNotAccuracy": round(float(accuracy_score(farm_t, farm_p)), 3), "farmF1": round(float(f1_score(farm_t, farm_p)), 3),
           "groupAccuracy": round(float(accuracy_score(yt, pr)), 3)}
    print(f"  pixel classifier (held-out blocks): {met}", flush=True)
    clf = HistGradientBoostingClassifier(max_iter=250, learning_rate=0.1, random_state=0).fit(X[pick], g[pick])
    return clf, met


def predict_proba_all(clf, X, chunk=400000):
    P = np.full((len(X), len(GROUPS)), np.nan, np.float32)
    ok = np.flatnonzero(~np.isnan(X[:, 0]))
    for i in range(0, len(ok), chunk):
        idx = ok[i:i + chunk]
        p = clf.predict_proba(X[idx])
        P[np.ix_(idx, clf.classes_.astype(int))] = p
    P[np.isnan(P) & ~np.isnan(X[:, :1])] = 0
    return P


def segment(mask, X, pca, px=70):
    """Farm mask -> fields: SLIC superpixels on the fingerprints (12 PCA components), ~px pixels (~2.8 ha) each, so
    edges follow where the fingerprint changes. Pieces < 0.5 ha are dropped."""
    H, Wd = mask.shape
    Z = pca.transform(np.nan_to_num(X)).reshape(H, Wd, -1)
    lab = slic(Z, n_segments=max(1, int(mask.sum() / px)), compactness=0.1, mask=mask, channel_axis=-1,
               convert2lab=False, enforce_connectivity=True, start_label=1)
    sz = np.bincount(lab.ravel())
    lab[(sz < MIN_FIELD_PX)[lab]] = 0
    u = np.unique(lab[lab > 0])
    remap = np.zeros(lab.max() + 1, np.int32)
    remap[u] = np.arange(1, len(u) + 1)
    return remap[lab], len(u)


def merge_fields(lab, n, gi, M, sim_min=0.985, max_px=1000):
    """Join touching superpixels with the same predicted crop and near-identical mean fingerprint (cosine >= sim_min)
    into one field, up to max_px (40 ha). Union-find over 4-neighbour adjacency."""
    U = M / np.linalg.norm(M, axis=1, keepdims=True)
    pairs = set()
    for a, b in ((lab[:, 1:], lab[:, :-1]), (lab[1:], lab[:-1])):
        m = (a > 0) & (b > 0) & (a != b)
        for x, y in np.unique(np.stack([a[m], b[m]], 1), axis=0):
            pairs.add((min(x, y) - 1, max(x, y) - 1))
    size = np.bincount(lab.ravel(), minlength=n + 1)[1:].astype(int)
    par = np.arange(n)
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    cand = sorted(((float(U[i] @ U[j]), i, j) for i, j in pairs if gi[i] == gi[j]), reverse=True)
    for s_, i, j in cand:
        if s_ < sim_min:
            break
        ri, rj = find(i), find(j)
        if ri != rj and size[ri] + size[rj] <= max_px:
            par[rj] = ri; size[ri] += size[rj]
    roots = np.array([find(i) for i in range(n)])
    u, new = np.unique(roots, return_inverse=True)
    remap = np.zeros(n + 1, np.int32); remap[1:] = new + 1
    return remap[lab], len(u)


def field_features(X, lab, n):
    """Per field: mean fingerprint (64), per-dim std (64). (No area: training pieces are superpixels, output fields are merged.)"""
    flat = lab.ravel()
    idx = np.flatnonzero(flat > 0)
    ids = flat[idx] - 1
    Xi = np.nan_to_num(X[idx])
    cnt = np.bincount(ids, minlength=n).astype(np.float32)
    s1 = np.zeros((n, 64), np.float64); s2 = np.zeros((n, 64), np.float64)
    np.add.at(s1, ids, Xi); np.add.at(s2, ids, Xi.astype(np.float64) ** 2)
    mean = s1 / cnt[:, None]
    std = np.sqrt(np.maximum(s2 / cnt[:, None] - mean ** 2, 0))
    return np.hstack([mean, std]).astype(np.float32), mean.astype(np.float32), cnt


def field_model(X24, g24, farm24, H, Wd, pca):
    """Train the crop-group classifier on 2024 fields cut by the SAME pipeline used for 2025 (predicted farm mask,
    same segmentation), labelled by the CDL 2024 majority; segments whose majority is not a crop are class
    "not farmland" (so the model can reject them). 5-fold, grouped by 1.5 km block of the field centroid: whole
    fields (and their neighbours) held out."""
    lab, n = segment(farm24, X24, pca)
    F, _, cnt = field_features(X24, lab, n)
    flat = lab.ravel(); idx = np.flatnonzero(flat > 0); ids = flat[idx] - 1
    gg = g24.ravel()[idx].astype(int)
    gg = np.where(gg < 0, NF + 1, np.minimum(gg, NF))     # farm groups 0..NF-1, not farmland NF, no data NF+1
    hist = np.zeros((n, NF + 2), np.int32)
    np.add.at(hist, (ids, gg), 1)
    hist = hist[:, :NF + 1]
    y = hist.argmax(1); purity = hist.max(1) / np.maximum(hist.sum(1), 1)
    rr, cc = np.divmod(idx, Wd)
    cy = np.bincount(ids, rr, n) / cnt; cx = np.bincount(ids, cc, n) / cnt
    blocks = spatial_blocks(cy.astype(int), cx.astype(int), 20)
    keep = purity >= 0.6
    F, y, blocks, area = F[keep], y[keep], blocks[keep], cnt[keep]
    print(f"  2024 training fields: {n} segmented, {keep.sum()} with a >=60% CDL majority", flush=True)
    ub = np.unique(blocks)
    fold_of = {b: i % 5 for i, b in enumerate(RNG.permutation(ub))}
    fold = np.array([fold_of[b] for b in blocks])
    pred = np.zeros_like(y)
    mk = lambda: HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, class_weight="balanced", random_state=0)
    models = []
    for k in range(5):
        tr = fold != k
        models.append(mk().fit(F[tr], y[tr]))
        pred[~tr] = models[-1].predict(F[~tr])
    labels = list(range(NF + 1))
    names = [FARM_GROUPS[GROUPS[i]]["label"] for i in range(NF)] + ["Not farmland (dropped)"]
    p, r, f1, sup = precision_recall_fscore_support(y, pred, labels=labels, zero_division=0)
    per = {names[i]: {"precision": round(float(p[i]), 3), "recall": round(float(r[i]), 3), "f1": round(float(f1[i]), 3), "fields": int(sup[i])} for i in labels}
    fy, fp = y < NF, pred < NF
    both = fy & fp
    met = {"heldOut": "5-fold cross-validation; whole fields held out, grouped by 1.5 km spatial block so neighbouring fields of one farm never straddle train/test",
           "trainingFields": int(len(y)), "accuracy": round(float(accuracy_score(y, pred)), 3),
           "balancedAccuracy": round(float(balanced_accuracy_score(y, pred)), 3),
           "areaWeightedAccuracy": round(float((area * (y == pred)).sum() / area.sum()), 3),
           "farmVsNotAccuracy": round(float((fy == fp).mean()), 3),
           "cropAccuracyOnTrueFarmFieldsKept": round(float((y[both] == pred[both]).mean()), 3) if both.any() else None,
           "perClass": per}
    print(f"  field classifier: {json.dumps({k: v for k, v in met.items() if k != 'perClass'})}", flush=True)
    for k, v in per.items():
        print(f"    {k:34s} P {v['precision']:.2f} R {v['recall']:.2f} F1 {v['f1']:.2f} n={v['fields']}", flush=True)
    return mk().fit(F, y), met, (fold_of, models)


# ---------------------------------------------------------------- soil
def drainage_class(d):
    d = (d or "").lower()
    if not d:
        return None
    if "excessively" in d:
        return "fast"
    if d == "well drained":
        return "moderate"
    if "moderately well" in d or "somewhat poorly" in d:
        return "slow"
    if "poorly" in d:
        return "very_slow"
    return None


def sda(query):
    body = json.dumps({"query": query, "format": "JSON+COLUMNNAME"}).encode()
    txt = fetch(SDA, timeout=90, tries=3, data=body, headers={"Content-Type": "application/json"}).decode()
    if not txt.strip():
        return []
    return (json.loads(txt).get("Table") or [])[1:]


def num(s):
    try:
        return None if s in (None, "") else float(s)
    except ValueError:
        return None


def soils(points):
    """SSURGO at each (lat, lon): dominant component of the map unit there. Cached per point and per mukey. None if unknown."""
    pf, mf = OUT / "ssurgo_points.json", OUT / "ssurgo_mukeys.json"
    pc = json.loads(pf.read_text()) if pf.exists() else {}
    mc = json.loads(mf.read_text()) if mf.exists() else {}
    keys = [f"{lat:.5f},{lon:.5f}" for lat, lon in points]
    todo = [k for k in dict.fromkeys(keys) if k not in pc]
    failed = 0
    for i in range(0, len(todo), 25):
        chunk = todo[i:i + 25]
        sql = " UNION ALL ".join(f"SELECT {j} AS i, mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point({k.split(',')[1]} {k.split(',')[0]})')"
                                 for j, k in enumerate(chunk))
        try:
            got = {}
            for j, mk in sda(sql):
                got.setdefault(int(j), mk)
            for j, k in enumerate(chunk):
                pc[k] = got.get(j)                     # None = SDA answered: no survey polygon here
        except Exception as e:
            failed += len(chunk)
            print(f"  SDA mukey batch failed ({e}); those fields stay 'unknown'", flush=True)
        time.sleep(0.3)
        if i % 250 == 0:
            print(f"  SSURGO points {i + len(chunk)}/{len(todo)}", flush=True)
    pf.write_text(json.dumps(pc))
    want = sorted({m for m in pc.values() if m and m.isdigit() and m not in mc})
    for i in range(0, len(want), 150):
        q = f"""SELECT mu.mukey, mu.muname, ma.drclassdcd, ma.aws0100wta, c.compname, c.comppct_r, c.drainagecl,
          (SELECT TOP 1 tg.texdesc FROM chorizon h JOIN chtexturegrp tg ON tg.chkey = h.chkey AND tg.rvindicator = 'Yes'
             WHERE h.cokey = c.cokey ORDER BY h.hzdept_r) AS texture,
          (SELECT TOP 1 h.ph1to1h2o_r FROM chorizon h WHERE h.cokey = c.cokey ORDER BY h.hzdept_r) AS ph,
          (SELECT TOP 1 h.ksat_r FROM chorizon h WHERE h.cokey = c.cokey ORDER BY h.hzdept_r) AS ksat
          FROM mapunit mu LEFT JOIN muaggatt ma ON ma.mukey = mu.mukey
          LEFT JOIN component c ON c.mukey = mu.mukey AND c.cokey = (SELECT TOP 1 c2.cokey FROM component c2 WHERE c2.mukey = mu.mukey ORDER BY c2.comppct_r DESC)
          WHERE mu.mukey IN ({','.join(want[i:i + 150])})"""
        try:
            for mukey, muname, drcd, aws, comp, pct, dcl, tex, ph, ksat in sda(q):
                mc[mukey] = {"mukey": mukey, "mapUnit": muname, "series": comp or muname, "componentPct": num(pct),
                             "texture": tex or None, "drainagecl": dcl or drcd or None, "drainageClass": drainage_class(dcl or drcd),
                             "ph": num(ph), "ksatUmS": num(ksat), "awsCm": num(aws)}
        except Exception as e:
            print(f"  SDA map-unit batch failed ({e})", flush=True)
        time.sleep(0.3)
    mf.write_text(json.dumps(mc))
    res = []
    for k in keys:
        mk = pc.get(k)
        s = mc.get(mk) if mk else None
        res.append(dict(s, source="USDA NRCS SSURGO (Soil Data Access), dominant component of the mapped soil unit at a point inside the field") if s else None)
    return res, failed


# ---------------------------------------------------------------- main
def proba_full(model, F):
    """predict_proba with one column per class 0..NF (crop groups + not farmland), whatever classes the model saw."""
    P = np.zeros((len(F), NF + 1), np.float32)
    P[:, model.classes_.astype(int)] = model.predict_proba(F)
    return P


def oof_proba(F, lab, n, Wd, final, fold_of, models):
    """Out-of-fold: each field is labelled by the cross-validation model that never trained on its 1.5 km block
    (fields in blocks that had no training fields use the final model, which never saw them either)."""
    flat = lab.ravel(); idx = np.flatnonzero(flat > 0); ids = flat[idx] - 1
    rr, cc = np.divmod(idx, Wd)
    c = np.bincount(ids, minlength=n)
    blocks = spatial_blocks((np.bincount(ids, rr, n) / c).astype(int), (np.bincount(ids, cc, n) / c).astype(int), 20)
    fold = np.array([fold_of.get(b, -1) for b in blocks])
    P = np.zeros((n, NF + 1), np.float32)
    for k in range(-1, len(models)):
        m = fold == k
        if m.any():
            P[m] = proba_full(final if k < 0 else models[k], F[m])
    return P


def main():
    t0 = time.time()
    (bx0, by0, bx1, by1), Wd, H, tr20, crs = box_grid(20)
    _, W40, H40, tr40, _ = box_grid(40)
    print(f"box grid 20 m: {Wd}x{H}; 40 m: {W40}x{H40}", flush=True)

    print("AlphaEarth 2024 + 2025 at 20 m...", flush=True)
    X24 = dequant(read_raw(2024, 20)); X25 = dequant(read_raw(2025, 20))
    print("USDA CDL 2024...", flush=True)
    cdl20 = cdl_onto((H, Wd), tr20, crs, Resampling.nearest)
    g24 = group_of_cdl(cdl20)

    print("pixel classifier (15 groups, 2024)...", flush=True)
    pclf, pmet = pixel_model(X24, g24.ravel(), H, Wd)
    # the pixel model saw a class-balanced sample, so P(farm) runs high: set the farm threshold so the 2024 farm
    # area matches the CDL's 2024 farm area, and use that same threshold for 2025
    pf24 = np.nansum(predict_proba_all(pclf, X24)[:, :NF], 1).reshape(H, Wd)
    valid24 = ~np.isnan(X24[:, 0]).reshape(H, Wd)
    cdl_farm_share = float(((g24 >= 0) & (g24 < NF) & valid24).sum() / valid24.sum())
    farm_t = float(np.quantile(pf24[valid24], 1 - cdl_farm_share))
    pmet["farmThreshold"] = round(farm_t, 3)
    print(f"  farm threshold {farm_t:.3f} (CDL 2024 farm share {cdl_farm_share:.3f})", flush=True)
    farm24 = ndimage.binary_opening((pf24 >= farm_t) & valid24)
    P24 = predict_proba_all(pclf, X24)
    land24 = np.where(valid24.ravel(), np.nanargmax(np.nan_to_num(P24, nan=-1), 1), -1).reshape(H, Wd)

    print("2024 fields -> field classifier...", flush=True)
    pca = PCA(12, random_state=0).fit(np.nan_to_num(X24[::37]))
    fclf, fmet, (fold_of, fold_models) = field_model(X24, g24, farm24, H, Wd, pca)

    # The map year is 2024: the year with an answer key, so the accuracy above applies to this map. (2025 was tried:
    # the same pipeline shifts toward avocado and loses ~70% of CDL-2024 vegetable land, a shift nothing can check yet.)
    print("2024 field map...", flush=True)
    lab, n = segment(farm24, X24, pca)
    F, M, cnt = field_features(X24, lab, n)
    gi = oof_proba(F, lab, n, Wd, fclf, fold_of, fold_models).argmax(1)
    nsp = n
    lab, n = merge_fields(lab, n, gi, M)                   # superpixels -> fields
    F, M, cnt = field_features(X24, lab, n)
    prob = oof_proba(F, lab, n, Wd, fclf, fold_of, fold_models)
    gi = prob.argmax(1)
    print(f"  {nsp} superpixels merged into {n} fields", flush=True)
    keepf = gi < NF                                        # "not farmland" pieces are dropped
    dropped = int((~keepf).sum()); dropped_ac = float(cnt[~keepf].sum() * 400 / 4046.86)
    remap = np.zeros(n + 1, np.int32); remap[1:][keepf] = np.arange(1, keepf.sum() + 1)
    lab = remap[lab]; n = int(keepf.sum())
    F, M, cnt, prob, gi = F[keepf], M[keepf], cnt[keepf], prob[keepf], gi[keepf]
    prob = prob[:, :NF] / prob[:, :NF].sum(1, keepdims=True)   # confidence among crop groups
    cls = np.arange(NF)
    conf = prob.max(1)
    # the same field outline, 2025 fingerprints, final model: what it looks like now (no answer key for 2025)
    F25, _, _ = field_features(X25, lab, n)
    P25f = proba_full(fclf, F25)
    gi25, conf25 = P25f.argmax(1), P25f.max(1)
    print(f"  {n} fields, {cnt.sum() * 400 / 4046.86:.0f} acres ({dropped} pieces, {dropped_ac:.0f} acres, called not farmland)", flush=True)

    # geometry per field
    flat = lab.ravel(); idx = np.flatnonzero(flat > 0); ids = flat[idx] - 1
    rr, cc = np.divmod(idx, Wd)
    cyp = np.bincount(ids, rr, n) / cnt; cxp = np.bincount(ids, cc, n) / cnt
    # a point INSIDE the field, nearest its centroid (for the soil lookup and the pin)
    d2 = (rr - cyp[ids]) ** 2 + (cc - cxp[ids]) ** 2
    order = np.lexsort((d2, ids))
    first = order[np.r_[0, np.flatnonzero(np.diff(ids[order])) + 1]]
    in_r, in_c = rr[first], cc[first]
    ux = tr20.c + (in_c + 0.5) * tr20.a; uy = tr20.f + (in_r + 0.5) * tr20.e
    to_ll = Transformer.from_crs("EPSG:32617", "EPSG:4326", always_xy=True)
    lon, lat = to_ll.transform(ux, uy)
    cux = tr20.c + (cxp + 0.5) * tr20.a; cuy = tr20.f + (cyp + 0.5) * tr20.e

    rings = {}
    for geom, v in shapes(lab.astype(np.int32), mask=lab > 0, transform=tr20):
        poly = to_shape(geom)
        v = int(v)
        if v not in rings or poly.area > rings[v].area:
            rings[v] = poly
    polys = []
    for i in range(n):
        ring = rings[i + 1].exterior.simplify(20, preserve_topology=False)
        xs, ys = ring.xy
        lo, la = to_ll.transform(list(xs), list(ys))
        polys.append([[round(a, 5), round(b, 5)] for a, b in zip(lo, la)])

    print("SSURGO soil per field...", flush=True)
    soil, soil_failed = soils(list(zip(lat, lon)))

    print("similar fields...", flush=True)
    U = M / np.linalg.norm(M, axis=1, keepdims=True)
    sim = U @ U.T
    iu = np.triu_indices(n, 1)
    thr = float(np.percentile(sim[iu], 95))
    np.fill_diagonal(sim, -1)

    print("trend 2017-2025 at 40 m...", flush=True)
    r40, c40 = np.minimum(rr // 2, H40 - 1), np.minimum(cc // 2, W40 - 1)
    trend = np.zeros((n, len(YEARS)), np.float32); tsim = np.zeros((n, len(YEARS)), np.float32)
    means = {}
    for y in YEARS:
        X = dequant(read_raw(y, 40))
        Pf = np.nansum(predict_proba_all(pclf, X)[:, :NF], 1).reshape(H40, W40)
        Pf[np.isnan(X[:, 0]).reshape(H40, W40)] = np.nan
        v = Pf[r40, c40]
        okv = ~np.isnan(v)
        s = np.bincount(ids[okv], v[okv], n); c = np.bincount(ids[okv], minlength=n)
        trend[:, YEARS.index(y)] = np.where(c > 0, s / np.maximum(c, 1), np.nan)
        e = np.nan_to_num(X.reshape(H40, W40, 64)[r40, c40])
        mm = np.zeros((n, 64)); np.add.at(mm, ids, e)
        means[y] = mm / np.linalg.norm(mm, axis=1, keepdims=True).clip(1e-9)
    for y in YEARS:
        tsim[:, YEARS.index(y)] = (means[y] * means[2025]).sum(1)

    print("UI grid (74 km on FIU, 500 m cells)...", flush=True)
    gx0, gy0 = grid_origin()
    G50 = int(2 * HALF_KM * 1000 / 50)
    tr50 = rasterio.Affine(50, 0, gx0, 0, -50, gy0)
    code50 = cdl_onto((G50, G50), tr50, crs, Resampling.nearest)
    # inside the box: our predicted picture replaces the CDL (field crop group on fields, predicted land group elsewhere)
    code20 = np.zeros((H, Wd), np.uint8)
    lg = land24.copy()
    code20[lg >= 0] = np.array([ALLG[k]["code"] for k in GROUPS], np.uint8)[lg[lg >= 0]]
    fl = lab > 0
    code20[~fl & (lg >= 0) & (lg < NF)] = ALLG["grass"]["code"]      # farm-looking pixels outside any field: tiny/opened-away bits
    code20[fl] = np.array([FARM_GROUPS[GROUPS[k]]["code"] for k in range(NF)], np.uint8)[gi[lab[fl] - 1]]
    code20[~valid24] = 0
    ov = np.zeros((G50, G50), np.uint8)
    reproject(code20, ov, src_transform=tr20, src_crs=crs, dst_transform=tr50, dst_crs=crs, resampling=Resampling.mode, src_nodata=0, dst_nodata=0)
    code50 = np.where(ov > 0, ov, code50)
    lab50 = np.zeros((G50, G50), np.int32)
    reproject(lab.astype(np.int32), lab50, src_transform=tr20, src_crs=crs, dst_transform=tr50, dst_crs=crs, resampling=Resampling.nearest, src_nodata=0, dst_nodata=0)
    k = G50 // GRID_N
    cells, field_of = [], []
    total = {}
    u, c = np.unique(code50, return_counts=True)
    for a, b in zip(u, c):
        total[int(a)] = int(b)
    farmed = lambda v: v in CROP_CODES
    field_cells = np.zeros(n, int)
    for gy in range(GRID_N):
        for gx in range(GRID_N):
            blk = code50[gy * k:(gy + 1) * k, gx * k:(gx + 1) * k].ravel()
            vals, cts = np.unique(blk, return_counts=True)
            fm = np.array([farmed(int(v)) for v in vals])
            want = cts[fm].sum() / cts.sum() >= 0.4
            sel = fm == want
            best = int(vals[sel][cts[sel].argmax()]) if sel.any() else int(vals[cts.argmax()])
            fo = -1
            if farmed(best):
                lb = lab50[gy * k:(gy + 1) * k, gx * k:(gx + 1) * k].ravel()
                lb = lb[lb > 0]
                if lb.size:
                    fo = int(np.bincount(lb).argmax()) - 1
                    field_cells[fo] += 1
            cells.append(best); field_of.append(fo)

    mid = (GRID_N - 1) / 2
    cellM = 2 * HALF_KM * 1000 / GRID_N
    fx, fy = gx0 + HALF_KM * 1000, gy0 - HALF_KM * 1000
    BEAR = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    fields = []
    acre = 400 / 4046.86
    for i in range(n):
        g = GROUPS[gi[i]]
        order_p = np.argsort(-prob[i])
        grows = [{"code": FARM_GROUPS[GROUPS[cls[j]]]["code"], "name": FARM_GROUPS[GROUPS[cls[j]]]["label"], "sharePct": int(round(100 * prob[i, j]))}
                 for m, j in enumerate(order_p) if m == 0 or prob[i, j] >= 0.12][:3]
        dx, dy = (cux[i] - fx) / 1000, (cuy[i] - fy) / 1000
        top = np.argsort(-sim[i])[:5]
        sims = sim[i]
        pt = P_TABLE[g]
        fields.append({
            "id": f"f{i}", "code": FARM_GROUPS[g]["code"], "crop": FARM_GROUPS[g]["label"], "grows": grows,
            "cells": int(field_cells[i]), "areaHa": round(float(cnt[i]) * 400 / 1e4, 2),
            "cx": round((cux[i] - gx0) / cellM - 0.5, 2), "cy": round((gy0 - cuy[i]) / cellM - 0.5, 2),
            "lat": round(float(lat[i]), 5), "lon": round(float(lon[i]), 5),
            "distanceKm": round(math.hypot(dx, dy), 1), "bearing": BEAR[int(round(((math.degrees(math.atan2(dx, dy)) + 360) % 360) / 45)) % 8],
            "soil": soil[i],
            # ---- v2 extras
            "group": g, "confidence": round(float(conf[i]), 2), "acres": round(float(cnt[i]) * acre, 1), "polygon": polys[i],
            "p": pt["p"], "baselinePct": pt["baselinePct"],
            "similar": {"count": int((sims >= thr).sum()), "top": [f"f{j}" for j in top if sims[j] >= thr]},
            "trend": [None if np.isnan(v) else int(round(100 * v)) for v in trend[i]],
            "trendSim": [int(round(100 * v)) for v in tsim[i]],
            "crop2025": {"group": GROUPS[gi25[i]] if gi25[i] < NF else "not_farmland",
                         "label": FARM_GROUPS[GROUPS[gi25[i]]]["label"] if gi25[i] < NF else "Not farmland",
                         "confidence": round(float(conf25[i]), 2)},
        })

    legend = []
    px = sum(total.values())
    present = set(cells)
    for code in sorted(present):
        name, fam, col = cdl_info(code)
        legend.append({"code": code, "name": name, "family": fam, "familyLabel": FAMILY_LABEL[fam], "color": col,
                       "farmed": farmed(code), "sharePct": round(100 * total.get(code, 0) / px, 1)})
    legend.sort(key=lambda l: (not l["farmed"], -l["sharePct"]))

    counts = {}
    for f in fields:
        c = counts.setdefault(f["crop"], {"fields": 0, "acres": 0.0})
        c["fields"] += 1; c["acres"] += f["acres"]
    for c in counts.values():
        c["acres"] = round(c["acres"])
    counts25 = {}
    for f in fields:
        c = counts25.setdefault(f["crop2025"]["label"], {"fields": 0, "acres": 0.0})
        c["fields"] += 1; c["acres"] += f["acres"]
    for c in counts25.values():
        c["acres"] = round(c["acres"])
    soil_known = sum(1 for s in soil if s)
    summary = {
        "fields": n, "acres": round(float(cnt.sum()) * acre), "mapYear": 2024, "byCrop": dict(sorted(counts.items(), key=lambda t: -t[1]["acres"])),
        "byCrop2025SameOutlines": dict(sorted(counts25.items(), key=lambda t: -t[1]["acres"])),
        "droppedNotFarmland": {"segments": dropped, "acres": round(dropped_ac)}, "cdl2024FarmAcresInBox": round(cdl_farm_share * valid24.sum() * 400 / 4046.86),
        "soilKnown": soil_known, "soilUnknown": n - soil_known, "soilLookupFailed": soil_failed,
        "fieldClassifier": fmet, "pixelClassifier": pmet,
    }
    region = {
        "centre": {"lat": FIU["lat"], "lon": FIU["lon"]}, "label": "FIU (Farm Hand box)", "year": 2024, "halfKm": HALF_KM,
        "cellM": int(round(cellM)), "n": GRID_N, "cells": cells, "fieldOf": field_of, "fields": fields, "legend": legend,
        "sources": [
            {"name": "AlphaEarth Foundations Satellite Embedding (Google, Google DeepMind), 2017-2025",
             "what": "64-number yearly fingerprint of every 10 m of land; read at 20 m (fields, crops) and 40 m (trend)",
             "url": "https://storage.googleapis.com/alphaearth_foundations/satellite_embedding/v1/annual/"},
            {"name": "USDA NASS Cropland Data Layer 2024", "what": "answer key for training; land outside the AlphaEarth box",
             "url": CDL_SERVICE},
            {"name": "USDA NRCS Soil Data Access (SSURGO)", "what": "soil series, texture, drainage class, available water storage at each field", "url": SDA},
            {"name": "FAO Irrigation and Drainage Paper 56, Table 22", "what": "depletion fraction p per crop -> the moisture line",
             "url": "https://www.fao.org/4/x0490e/x0490e0e.htm"},
        ],
        "builtAt": int(time.time() * 1000), "precomputed": True,
        "alphaearth": {
            "version": 2, "box": [W, S, E, N], "pixelM": 20, "trendYears": YEARS, "similarThreshold": round(thr, 4),
            "similarRule": "cosine similarity of the fields' mean 2024 (map-year) fingerprints >= the 95th percentile of all field pairs",
            "probeScale": "stress line % = 20 + 45 * (1 - p), on Farm Hand's 20-65 % probe scale",
            "pTable": {FARM_GROUPS[k]["label"]: P_TABLE[k] for k in FARM_GROUPS},
            "summary": summary,
            "attribution": ["The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind. (CC-BY 4.0)",
                            "USDA NASS Cropland Data Layer 2024 (public domain).", "USDA NRCS Soil Survey Geographic Database (SSURGO), via Soil Data Access.",
                            "Allen et al. 1998, FAO Irrigation and Drainage Paper 56, Table 22."],
            "honesty": [
                "Crops are PREDICTED from 2024 satellite fingerprints, not surveyed and not copied from the CDL: every field's crop comes from a cross-validation model that never trained on its 1.5 km block, so the held-out accuracy applies to this map.",
                "crop2025 = the same model on the same outline's 2025 fingerprints. There is no 2025 answer key; 2025 as a whole reads more avocado-like and less vegetable-like than 2024 (a year shift or real change, unverified).",
                "Fields are cut where the fingerprint changes: they are growing blocks, not property lines. Neighbouring fields with one crop can merge; one field with two plantings can split.",
                "Soil is SSURGO's mapped soil unit at one point inside the field (its dominant component): mapped, not measured. 'unknown' (null) when the survey has no answer; never guessed.",
                "The moisture line is FAO-56 guidance (depletion fraction p) mapped onto Farm Hand's probe scale by Farm Hand's own formula; mango/lychee have no FAO-56 row, citrus p is used.",
                "trend = the field's mean farmland probability each year (the 2024-trained pixel classifier run on each year's fingerprints at 40 m); trendSim = % cosine similarity of that year's fingerprint to 2025. Satellite-derived.",
                "Farmland = 2024 pixels over a farm-probability threshold chosen so the farm area equals the CDL 2024 farm area; segments the field model calls 'not farmland' are dropped. pixelClassifier accuracy is on a class-balanced sample of pixels in held-out 1.5 km blocks.",
                "Outside the AlphaEarth box, the map tiles are USDA CDL 2024 and carry no fields.",
                "grows[].sharePct on a field is the classifier's probability for that crop group, not a measured share of the field.",
            ],
        },
    }
    view = {"status": "ready", "reason": None, "region": region, "matches": [], "unserved": [],
            "you": {"measured": False, "drainageClass": None, "label": None, "ph": None}}
    out = OUT / "region_v2.json"
    out.write_text(json.dumps(view, separators=(",", ":")))
    shutil.copy(out, CLOUD / "region_v2.json")
    print(json.dumps({k: summary[k] for k in ("fields", "acres", "byCrop", "soilKnown", "soilUnknown")}, indent=1))
    print(f"similar threshold {thr:.4f}; region_v2.json {out.stat().st_size / 1e6:.2f} MB; done in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
