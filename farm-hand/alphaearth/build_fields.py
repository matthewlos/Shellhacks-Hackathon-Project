"""Where Farm Hand fits: Miami-Dade's farm belt, found from space with Google DeepMind's AlphaEarth Foundations.

1. Reads the AlphaEarth Satellite Embedding (64 numbers per pixel, one image per year) for the Redland/Homestead
   farm belt, 2024 and 2025, straight from Google's public bucket (no account; only the window is downloaded).
2. Learns "farmland or not" from the fingerprints, using USDA's 2024 Cropland Data Layer as the answer key,
   checks itself on pixels it didn't train on, then maps 2025 farmland from the 2025 fingerprints.
3. Measures how much each farm pixel's fingerprint changed 2024 -> 2025 (the drought year).
4. Counts farm fields and writes the map layers + numbers for fields.html.

Run:  python farm-hand/alphaearth/build_fields.py      (writes farm-hand/alphaearth/out/)
Data: "The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind." (CC-BY 4.0)
      USDA NASS Cropland Data Layer 2024 (public domain).
"""
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import from_bounds
from scipy import ndimage
from sklearn.decomposition import PCA
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

W, S, E, N = -80.60, 25.43, -80.40, 25.62           # Redland / Homestead farm belt, Miami-Dade
PIXEL_M = 40                                         # read at 40 m (a field is 0.5-40 acres; 40 m = 0.4 acre)
BUCKET = "https://storage.googleapis.com/alphaearth_foundations/satellite_embedding/v1/annual"
TILES = {  # from aef_index.csv: the one tile per year that covers the box (UTM 17N)
    2024: f"{BUCKET}/2024/17N/xswc2n2unbptlyjhz-0000000000-0000000000.tiff",
    2025: f"{BUCKET}/2025/17N/xkbyccha41qpeh57w-0000000000-0000000000.tiff",
}
FIU = (25.7566, -80.3740)                            # where the Farm Hand box is

# USDA CDL classes counted as farmland: crops (1-60, 66-77, 204-254) and fallow/idle cropland (61).
# Not farmland: pasture/grass 176, developed 121-124, forest 141-143, shrub 152, wetlands 190/195, water 111, barren 131.
CROP = set(range(1, 62)) | set(range(66, 78)) | set(range(204, 255))


def read_embedding_cached(year):
    """read_embedding, saved to out/ so reruns don't download it again."""
    f = OUT / f"aef_{year}_{PIXEL_M}m.npz"
    if f.exists():
        z = np.load(f, allow_pickle=True)
        return z["emb"], rasterio.Affine(*z["transform"][:6]), rasterio.crs.CRS.from_string(str(z["crs"]))
    emb, tr, crs = read_embedding(TILES[year])
    np.savez_compressed(f, emb=emb, transform=np.array(tuple(tr)), crs=str(crs))
    return emb, tr, crs


def fetch(url, timeout=300, tries=4):
    for i in range(tries):
        try:
            return urllib.request.urlopen(url, timeout=timeout).read()
        except Exception as e:
            print(f"  retry {i + 1}/{tries}: {type(e).__name__}", flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"gave up on {url[:80]}")


def read_embedding(url):
    """64-band window at PIXEL_M, dequantized to [-1, 1] (int8 / 127.5, squared, signed). NaN where masked."""
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tiff",
                      GDAL_HTTP_MULTIRANGE="YES", VSI_CACHE="TRUE"):
        with rasterio.open(url) as src:
            # AlphaEarth tiles are stored south-up (positive y pixel size): rows count northward from the origin.
            xmin, ymin, xmax, ymax = transform_bounds("EPSG:4326", src.crs, W, S, E, N)
            t = src.transform
            col0 = (xmin - t.c) / t.a
            row0 = (ymin - t.f) / t.e if t.e > 0 else (ymax - t.f) / t.e
            win = rasterio.windows.Window(col0, row0, (xmax - xmin) / abs(t.a), (ymax - ymin) / abs(t.e))
            h = int(round((ymax - ymin) / PIXEL_M)); w = int(round((xmax - xmin) / PIXEL_M))
            raw = src.read(window=win, out_shape=(src.count, h, w), resampling=Resampling.nearest)
            if t.e > 0:
                raw = raw[:, ::-1, :]                       # flip to north-up
            transform = rasterio.Affine((xmax - xmin) / w, 0, xmin, 0, -(ymax - ymin) / h, ymax)
            crs = src.crs
    x = raw.astype(np.float32)
    emb = np.sign(x) * (x / 127.5) ** 2
    emb[:, raw[0] == -128] = np.nan
    return emb, transform, crs


def read_cdl(shape, transform, crs):
    """USDA Cropland Data Layer 2024 for the box, resampled onto the AlphaEarth grid."""
    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:4326", "EPSG:5070", always_xy=True)
    x0, y0 = t.transform(W, S); x1, y1 = t.transform(E, N)
    q = f"https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLFile?year=2024&bbox={min(x0,x1):.0f},{min(y0,y1):.0f},{max(x0,x1):.0f},{max(y0,y1):.0f}"
    f = OUT / "cdl_2024.tif"
    if not f.exists():
        xml = fetch(q).decode()
        url = xml.split("<returnURL>")[1].split("</returnURL>")[0]
        f.write_bytes(fetch(url))
    dst = np.zeros(shape, dtype=np.uint8)
    with rasterio.open(f) as src:
        reproject(rasterio.band(src, 1), dst, dst_transform=transform, dst_crs=crs, resampling=Resampling.mode)
    return dst


def rgba(mask_rgb):
    return Image.fromarray(mask_rgb, "RGBA")


def main():
    t0 = time.time()
    print("reading AlphaEarth 2024 + 2025 (window only)...", flush=True)
    e24, tr, crs = read_embedding_cached(2024)
    e25, tr25, _ = read_embedding_cached(2025)
    _, H, Wd = e24.shape
    print(f"  grid {Wd}x{H} at {PIXEL_M} m, {time.time() - t0:.0f} s", flush=True)

    print("reading USDA Cropland Data Layer 2024...", flush=True)
    cdl = read_cdl((H, Wd), tr, crs)

    valid = ~np.isnan(e24).any(0) & ~np.isnan(e25).any(0) & (cdl > 0)
    X24 = e24.reshape(64, -1).T; X25 = e25.reshape(64, -1).T
    y = np.isin(cdl, list(CROP)).reshape(-1)
    idx = np.flatnonzero(valid.reshape(-1))
    rng = np.random.default_rng(7)
    rng.shuffle(idx)
    cut = int(len(idx) * 0.7)
    tr_i, te_i = idx[:cut], idx[cut:]
    clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.1).fit(X24[tr_i], y[tr_i])   # 0.87 held-out vs 0.81 logistic
    pred_te = clf.predict(X24[te_i])
    acc, f1 = accuracy_score(y[te_i], pred_te), f1_score(y[te_i], pred_te)
    print(f"  farmland classifier on held-out 2024 pixels: accuracy {acc:.3f}, F1 {f1:.3f}", flush=True)

    farm25 = np.zeros(H * Wd, bool)
    ok = np.flatnonzero((~np.isnan(e25).any(0)).reshape(-1))
    farm25[ok] = clf.predict(X25[ok])
    farm25 = farm25.reshape(H, Wd)
    farm25 = ndimage.binary_opening(farm25, iterations=1)          # drop speckle

    # fingerprint change 2024 -> 2025 (1 - cosine similarity) on farm pixels
    a = X24 / np.linalg.norm(X24, axis=1, keepdims=True); b = X25 / np.linalg.norm(X25, axis=1, keepdims=True)
    change = (1 - np.nansum(a * b, axis=1)).reshape(H, Wd)
    ch_farm = change[farm25 & ~np.isnan(change)]
    hi = float(np.nanpercentile(ch_farm, 85)) if ch_farm.size else 1.0
    changed = farm25 & (change >= hi)

    # fields = connected farm patches of at least 3 pixels (~1.2 acres)
    lab, n = ndimage.label(farm25)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    fields = int((sizes >= 3).sum())
    acre = PIXEL_M * PIXEL_M / 4046.86
    farm_acres = float(farm25.sum() * acre)
    changed_acres = float(changed.sum() * acre)

    # layers (RGBA PNGs over the lat/lon box)
    pca = PCA(3).fit(X25[ok][rng.choice(len(ok), min(20000, len(ok)), replace=False)])
    rgb = np.zeros((H * Wd, 3), np.float32); rgb[ok] = pca.transform(X25[ok])
    lo, hi_ = np.percentile(rgb[ok], 2, 0), np.percentile(rgb[ok], 98, 0)
    rgb = np.clip((rgb - lo) / (hi_ - lo), 0, 1).reshape(H, Wd, 3)
    view = np.dstack([(rgb * 255).astype(np.uint8), np.where(np.isnan(e25).any(0), 0, 235).astype(np.uint8)])
    rgba(view).save(OUT / "alphaearth_2025.png")
    lay = np.zeros((H, Wd, 4), np.uint8); lay[farm25] = (34, 160, 90, 170)
    rgba(lay).save(OUT / "farmland_2025.png")
    lay = np.zeros((H, Wd, 4), np.uint8); lay[changed] = (224, 112, 40, 220)
    rgba(lay).save(OUT / "changed_2024_2025.png")
    lay = np.zeros((H, Wd, 4), np.uint8); lay[np.isin(cdl, list(CROP))] = (60, 110, 200, 150)
    rgba(lay).save(OUT / "usda_cdl_2024_farmland.png")

    stats = {
        "built": time.strftime("%Y-%m-%d %H:%M"),
        "box_wsen": [W, S, E, N], "pixel_m": PIXEL_M, "grid": [Wd, H], "fiu": FIU,
        "classifier": {"trained_on": "AlphaEarth 2024 fingerprints, labels from USDA CDL 2024 (farmland vs not)",
                       "held_out_accuracy": round(acc, 3), "held_out_f1": round(f1, 3),
                       "train_pixels": int(len(tr_i)), "test_pixels": int(len(te_i))},
        "farmland_2025_acres": round(farm_acres), "usda_2024_farmland_acres": round(float(np.isin(cdl, list(CROP)).sum() * acre)),
        "fields_2025": fields,
        "changed_most_acres": round(changed_acres), "changed_threshold": round(hi, 4),
        "stations_one_per_field": fields, "stations_one_per_10_acres": int(round(farm_acres / 10)),
        "attribution": ["The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind. CC-BY 4.0.",
                        "USDA NASS Cropland Data Layer 2024."],
        "honesty": ["Farmland 2025 is predicted from AlphaEarth fingerprints by a classifier trained on USDA's 2024 map; accuracy above is on 2024 pixels it never saw.",
                    "'Changed most' = the 15% of farm pixels whose fingerprint moved most from 2024 to 2025. Change has many causes (drought, harvest timing, replanting); it is not proof of drought damage.",
                    "Field count = connected farm patches of 3+ pixels at 40 m; neighbouring fields can merge. An estimate.",
                    "Station counts are a sizing estimate, not a quote."],
    }
    (OUT / "fields.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps({k: stats[k] for k in ("classifier", "farmland_2025_acres", "usda_2024_farmland_acres", "fields_2025", "changed_most_acres", "stations_one_per_10_acres")}, indent=2))
    print(f"done in {time.time() - t0:.0f} s -> {OUT}")


if __name__ == "__main__":
    main()
