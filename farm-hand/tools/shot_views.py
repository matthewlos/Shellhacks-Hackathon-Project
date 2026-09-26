"""Screenshot the new views (graph, AI strip, hand-pour banner, field view, phone). Usage: python tools/shot_views.py [port] [name]"""
import sys, asyncio
from playwright.async_api import async_playwright
port = sys.argv[1] if len(sys.argv) > 1 else "8081"
name = sys.argv[2] if len(sys.argv) > 2 else "v17"
URL = f"http://127.0.0.1:{port}/"
OUT = "laptop/data/"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(9000)
        await pg.screenshot(path=f"{OUT}{name}_desk.png")
        box = await pg.locator("#chartSvg").bounding_box()
        await pg.mouse.move(box["x"] + box["width"] * 0.62, box["y"] + 60); await pg.wait_for_timeout(400)
        await pg.locator(".graph").screenshot(path=f"{OUT}{name}_graph_hover.png")
        await pg.mouse.move(5, 5)
        await pg.click("[data-view=field]"); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=f"{OUT}{name}_field.png")
        await pg.click("[data-view=pot]")
        if "--hand" in sys.argv:
            await pg.click("#handBtn"); await pg.wait_for_timeout(40000)
            await pg.screenshot(path=f"{OUT}{name}_hand.png")
        ph = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ph.goto(URL); await ph.wait_for_timeout(8000)
        await ph.screenshot(path=f"{OUT}{name}_phone.png", full_page=True)
        print("errors:", errs); await b.close()
asyncio.run(main())
