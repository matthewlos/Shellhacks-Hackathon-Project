"""Same view twice: plastic as it ships vs plastic hidden, to see which one makes the soil read as water."""
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11"]); pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(9000)
        await pg.locator("#field").screenshot(path="laptop/data/rec/ab_with.png")
        await pg.evaluate("FH.A.root.traverse(o => { if (o.name === 'Pot' || o.name === 'Rim') o.visible = false; })")
        await pg.wait_for_timeout(800); await pg.locator("#field").screenshot(path="laptop/data/rec/ab_without.png"); await b.close()
asyncio.run(main())
