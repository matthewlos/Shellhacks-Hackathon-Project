import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11"]); pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(8000)
        hide = len(sys.argv) > 1
        await pg.evaluate("""(hide) => { const p = FH.A; setInterval(() => { p.ml = 500; p.tPump = Date.now()/1000; p.t0 = Date.now()/1000 - 30; }, 100);
          if (hide) FH.A.root.traverse(o => { if (o.name === 'Pot' || o.name === 'Rim') o.visible = false; }); }""", hide)
        await pg.wait_for_timeout(4000)
        print(await pg.evaluate("(() => { const u = FH.A.su; return [u.uPour.value.toArray(), u.uPourActive.value, FH.A.front]; })()"))
        await pg.locator("#field").screenshot(path=f"laptop/data/rec/seep_{'nopot' if hide else 'pot'}.png"); await b.close()
asyncio.run(main())
