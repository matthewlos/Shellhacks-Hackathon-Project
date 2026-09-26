"""Click through a Hit-the-Target run in headless Chromium and screenshot it mid-run, at the end, and on a phone."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
U = "http://127.0.0.1:8080"
def post(p): urllib.request.urlopen(urllib.request.Request(U + p, data=b"{}", headers={"Content-Type": "application/json"}, method="POST"))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        post("/api/demo/dry"); await pg.goto(U); await pg.wait_for_timeout(9000)
        await pg.click("#goBtn"); await pg.wait_for_timeout(22000)
        await pg.screenshot(path="laptop/data/v15_target_mid.png")
        for _ in range(150):
            ph = json.load(urllib.request.urlopen(U + "/api/live"))["target"].get("phase")
            if ph not in ("reading", "pulsing", "settling"): break
            await pg.wait_for_timeout(1000)
        await pg.wait_for_timeout(1500); await pg.screenshot(path="laptop/data/v15_target_done.png")
        m = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await m.goto(U); await m.wait_for_timeout(8000); await m.screenshot(path="laptop/data/v15_target_phone.png", full_page=True)
        print("phase:", ph, "errors:", errs); await b.close()
asyncio.run(main())
