"""Open a HackMIT Plume project page by name and print its links (GitHub, video, devpost). Usage: python tools/plume_project.py Rumi"""
import asyncio, sys
from playwright.async_api import async_playwright
NAME = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        for page in range(1, 40):
            await pg.goto(f"https://plume.hackmit.org/gallery?hackathon_id=hack-2026&page={page}", wait_until="networkidle")
            await pg.wait_for_timeout(1200)
            card = pg.locator(f"text={NAME}").first
            if await card.count():
                links = await pg.eval_on_selector_all("a", "els => els.map(e => [e.innerText.trim(), e.href])")
                views = [h for t, h in links if 'project' in h.lower() or t.lower() == 'view']
                # the View link right after this card
                box = card.locator("xpath=ancestor::*[.//a][1]")
                href = await box.locator("a").first.get_attribute("href")
                print("card link:", href)
                target = href if href and href.startswith("http") else "https://plume.hackmit.org" + (href or "")
                await pg.goto(target, wait_until="networkidle"); await pg.wait_for_timeout(2000)
                print("page:", pg.url)
                print((await pg.inner_text("body"))[:2500])
                for t, h in await pg.eval_on_selector_all("a", "els => els.map(e => [e.innerText.trim(), e.href])"):
                    if any(k in h for k in ("github", "youtu", "devpost", "vimeo", "loom", "drive.google")): print("LINK:", t, h)
                break
        await b.close()
asyncio.run(main())
