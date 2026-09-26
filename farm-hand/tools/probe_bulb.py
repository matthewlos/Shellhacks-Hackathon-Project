import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11"]); pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(9000)
        print(await pg.evaluate("(() => { const p = FH.A; return {noz: p.noz.toArray(), c: p.wetU.uWetC.value.toArray()}; })()"))
        await pg.evaluate("(() => { const p = FH.A; p.ml = 400; p.tPump = Date.now()/1000; p.r = .728; window.LENS = 'moisture'; })()")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("FH.A.root.traverse(o => { if (o.name === 'Pot' || o.name === 'Rim') o.visible = false; })")
        await pg.wait_for_timeout(500)
        print(await pg.evaluate("(() => { const u = FH.A.wetU; return [u.uWetR.value, u.uWetD.value, u.uWet.value]; })()"))
        await pg.locator("#field").screenshot(path="laptop/data/rec/bulb_moist.png"); await b.close()
asyncio.run(main())
