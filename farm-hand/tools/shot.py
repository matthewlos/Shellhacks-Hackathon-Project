"""Screenshot the dashboard (desktop + close-up) with headless Chromium. Usage: python tools/shot.py <name>"""
import sys, asyncio
from playwright.async_api import async_playwright
name = sys.argv[1] if len(sys.argv) > 1 else "shot"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(9000)
        await pg.screenshot(path=f"laptop/data/{name}.png")
        await pg.locator("#field").screenshot(path=f"laptop/data/{name}_stage.png")
        print("errors:", errs); await b.close()
asyncio.run(main())
