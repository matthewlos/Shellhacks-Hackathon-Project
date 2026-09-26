"""Board thumbnails: frames/<id>.png (2752 px) -> frames/thumb/<id>.jpg (1376 px) so board.html stays fast."""
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent
(H / "frames" / "thumb").mkdir(exist_ok=True)
for p in sorted((H / "frames").glob("*.png")):
    t = H / "frames" / "thumb" / (p.stem + ".jpg")
    if not t.exists() or t.stat().st_mtime < p.stat().st_mtime:
        im = Image.open(p).convert("RGB"); im.thumbnail((1376, 1376)); im.save(t, quality=84)
print(len(list((H / "frames" / "thumb").glob("*.jpg"))), "thumbs")
