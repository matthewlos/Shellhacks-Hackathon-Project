"""Record the dashboard while a 5 s test pour runs (fake board). Saves a .webm, pulls frames for checking.
Usage: python tools/record_pour.py <name> [zoom]"""
import asyncio, glob, json, os, shutil, sys, urllib.request
from playwright.async_api import async_playwright
U = "http://127.0.0.1:8080"; name = sys.argv[1]; zoom = int(sys.argv[2]) if len(sys.argv) > 2 else 0
OUT = "laptop/data/rec"; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=OUT, record_video_size={"width": 1440, "height": 900})
        pg = await ctx.new_page()
        urllib.request.urlopen(urllib.request.Request(U + "/api/demo/dry", data=b"{}", method="POST", headers={"Content-Type": "application/json"}))
        await pg.goto(U); await pg.wait_for_timeout(9000)
        if zoom:
            bx = await pg.locator("#field").bounding_box()
            await pg.mouse.move(bx["x"] + bx["width"] * .4, bx["y"] + bx["height"] * .5); await pg.mouse.wheel(0, -zoom); await pg.wait_for_timeout(1500)
        await pg.click(os.environ.get("BTN", "#pourBtn"))
        n, gap = int(os.environ.get("SHOTS", 8)), int(os.environ.get("GAP_MS", 4000))
        for i in range(n):
            await pg.wait_for_timeout(gap); await pg.screenshot(path=f"{OUT}/{name}_{i:02d}.png")
        v = pg.video; await ctx.close(); src = await v.path()
        shutil.move(src, f"{OUT}/{name}.webm"); await b.close()
        print("saved", f"{OUT}/{name}.webm")
asyncio.run(main())
