"""Open HackMIT's Plume gallery headless and find who won a named prize. Usage: python tools/plume_prize.py "Non-Believer" """
import asyncio, sys, json
from playwright.async_api import async_playwright
KEY = sys.argv[1].lower()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        apis = []
        pg.on("response", lambda r: apis.append(r.url) if "api" in r.url or "json" in r.headers.get("content-type", "") else None)
        hits = []
        for page in range(1, 40):
            await pg.goto(f"https://plume.hackmit.org/gallery?hackathon_id=hack-2026&page={page}", wait_until="networkidle")
            await pg.wait_for_timeout(1500)
            txt = await pg.inner_text("body")
            if page == 1: print("page1 sample:", txt[:600].replace("\n", " | "))
            if KEY in txt.lower():
                i = txt.lower().index(KEY); hits.append((page, txt[max(0, i - 700): i + 300]))
            if "no projects" in txt.lower() or len(txt) < 200: break
        print("apis:", sorted(set(a for a in apis if "plume" in a))[:10])
        for pg_no, h in hits: print(f"\n--- page {pg_no}\n", h)
        await b.close()
asyncio.run(main())
