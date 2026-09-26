"""Default-zoom stage shot in the dry state (after /api/demo/dry). Usage: python tools/shot_dry.py name"""
import asyncio, sys, urllib.request, json
from playwright.async_api import async_playwright
U = "http://127.0.0.1:8080"
async def main():
    urllib.request.urlopen(urllib.request.Request(U + "/api/demo/dry", data=b"{}", method="POST", headers={"Content-Type": "application/json"}))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11"]); pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto(U); await pg.wait_for_timeout(9000)
        print("soil %:", json.load(urllib.request.urlopen(U + "/api/live"))["a"])
        await pg.locator("#field").screenshot(path=f"laptop/data/rec/{sys.argv[1]}.png"); await b.close()
asyncio.run(main())
