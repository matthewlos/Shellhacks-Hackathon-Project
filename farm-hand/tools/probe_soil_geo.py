import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=d3d11"]); pg = await b.new_page(viewport={"width": 800, "height": 600})
        await pg.goto("http://127.0.0.1:8080/"); await pg.wait_for_timeout(8000)
        print(await pg.evaluate("""(() => { const s = FH.A.soil; const out = [];
          s.traverse(o => { if (o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
            out.push({name: o.name, type: o.type, min: bb.min.toArray().map(v => +v.toFixed(3)), max: bb.max.toArray().map(v => +v.toFixed(3)),
                      pos: o.position.toArray(), rot: o.rotation.toArray().slice(0,3), n: o.geometry.attributes.position.count}); } });
          return {self: s.type, children: s.children.length, out}; })()"""))
        await b.close()
asyncio.run(main())
