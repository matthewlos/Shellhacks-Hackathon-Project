"""Build "Farm Hand Deck.html": one offline file.

Takes the fonts, CSS, icon sprite, engine and navigation from the eWARP Deck Starter
(DESIGN.md sections 10-18, unchanged) and drops in src/slides.js plus a few extra icons.
Run: python3 pitch/deck/build.py
"""
import base64
import pathlib

HERE = pathlib.Path(__file__).parent
STARTER = pathlib.Path.home() / "Downloads/eWARP-Deck/eWARP Deck Starter.html"
OUT = HERE / "Farm Hand Deck.html"

ICONS = """
<symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z"/></symbol>
<symbol id="i-sprout" viewBox="0 0 24 24"><path d="M12 21v-9"/><path d="M12 13c0-4-3-6.5-7.5-6.5 0 4 3 6.5 7.5 6.5z"/><path d="M12 15c0-3.6 2.7-6 6.8-6 0 3.6-2.7 6-6.8 6z"/></symbol>
<symbol id="i-cup" viewBox="0 0 24 24"><path d="M5 5h14l-1.6 14.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z"/><path d="M5.7 10.5h12.6"/></symbol>
<symbol id="i-chip" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/></symbol>
<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.6a9.5 9.5 0 0 1 12.8 0M8.7 16.1a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.4" r=".9"/></symbol>
<symbol id="i-therm" viewBox="0 0 24 24"><path d="M10 4.5a2 2 0 0 1 4 0v9.7a4 4 0 1 1-4 0z"/><path d="M12 9.5v7"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></symbol>
<symbol id="i-speaker" viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></symbol>
<symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/></symbol>
"""

EXTRA_JS = """
/* ?still in the URL: every step appears finished (for screenshots and printing) */
if (/[?&]still\\b/.test(location.search)) instant = true;
"""


def main():
    src = STARTER.read_text()
    head, rest = src.split("/* ================= example: title slide", 1)
    nav = "/* ---------- navigation" + rest.split("/* ---------- navigation", 1)[1]
    head = head.replace("<title>eWARP Deck Starter</title>", "<title>Farm Hand Deck</title>")
    # extra icons go into the first (sprite) svg
    i = head.index("</svg>")
    head = head[:i] + ICONS + head[i:]
    slides = (HERE / "src/slides.js").read_text()
    # images go in as base64 so the deck stays one offline file
    mime = {"png": "image/png", "jpg": "image/jpeg"}
    img = "".join(f'IMG.{k} = "data:{mime[f.rsplit(".", 1)[1]]};base64,{base64.b64encode((HERE / "assets" / f).read_bytes()).decode()}";\n'
                  for k, f in [("farm", "farmland_2025.png"), ("fields", "fields_map.jpg")])
    OUT.write_text(head + EXTRA_JS + img + slides + "\n" + nav)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
