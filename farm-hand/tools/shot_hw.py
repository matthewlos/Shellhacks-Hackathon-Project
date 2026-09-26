"""Screenshots of the hardware model: full page, the stage, and 3 close-ups (orbit via OrbitControls)."""
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(12000)
        await pg.screenshot(path="laptop/data/v16_hw.png")
        await pg.locator("#field").screenshot(path="laptop/data/v16_hw_stage.png")
        box = await pg.locator("#field").bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        # zoom in with the wheel for close-ups
        for name, dx, wheel in (("near", 0, -1400),):
            await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, wheel); await pg.wait_for_timeout(2500)
            await pg.locator("#field").screenshot(path=f"laptop/data/v16_hw_{name}.png")
        print("errors:", errs); await b.close()
asyncio.run(main())
