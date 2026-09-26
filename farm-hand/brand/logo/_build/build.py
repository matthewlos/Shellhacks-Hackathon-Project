"""Build the FarmHand logo concepts: SVGs, preview HTML, then render.mjs makes the PNGs.

    python build.py && node render.mjs

All geometry is hand-set on a 48x48 grid. Colors come from farm-hand/web/src/brand.ts.
"""
import json
import os

from wordmark import outline

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
FONT_URL = 'file://' + os.path.normpath(os.path.join(
    HERE, '../../../web/node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2'))

# brand.ts tokens; dark tints lifted so strokes clear 3:1 on ink
LIGHT = dict(ink='#16201a', water='#1b66c9', good='#2b7a45', warm='#b3540c', ground='#16201a',
             bg='#e9ede7', panel='#fafbf8', dim='#44504a', knock='#e9ede7')
DARK = dict(ink='#eef1ea', water='#5b9cf0', good='#5cb57e', warm='#e0843a', ground='#eef1ea',
            bg='#16201a', panel='#1d2922', dim='#a9b4ad', knock='#16201a')


# ---------------------------------------------------------------- symbols
# Each returns inner SVG markup on a 48x48 grid. `fav` = the heavier cut for 16-32 px.

def taproot(c, fav=False):
    """A sprout whose root is the soil probe: leaves above the ground line, the sensor blade below."""
    if fav:
        return f'''
  <path d="M24 19C24 11.5 18.5 7 8.5 7c0 8 5.5 12 15.5 12z" fill="{c['good']}"/>
  <path d="M24 14.5C24 8.5 28 3.5 39 3.5c0 7-4.5 11-15 11z" fill="{c['good']}"/>
  <path d="M24 14v13" stroke="{c['good']}" stroke-width="5"/>
  <path d="M5 27.5h38" stroke="{c['ground']}" stroke-width="5" stroke-linecap="round"/>
  <path d="M19 32.5h10v8L24 47l-5-6.5z" fill="{c['water']}"/>'''
    return f'''
  <path d="M24 19.5C24 12.5 19 8 10.5 8c0 7.5 5 11.5 13.5 11.5z" fill="{c['good']}"/>
  <path d="M24 15.5C24 9.5 27.8 5 36.5 5c0 6.5-4 10.5-12.5 10.5z" fill="{c['good']}"/>
  <path d="M24 15v11" stroke="{c['good']}" stroke-width="3.6"/>
  <path d="M8 27.5h32" stroke="{c['ground']}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M20.2 31.2h7.6v10L24 46.5l-3.8-5.3z" fill="{c['water']}"/>
'''


def _pt(cx, cy, r, deg):
    import math
    a = math.radians(deg)
    return cx + r * math.cos(a), cy - r * math.sin(a)


def _arc(cx, cy, r, a0, a1):
    x0, y0 = _pt(cx, cy, r, a0)
    x1, y1 = _pt(cx, cy, r, a1)
    return f'M{x0:.2f} {y0:.2f}A{r} {r} 0 0 1 {x1:.2f} {y1:.2f}'


def needle(c, fav=False):
    """A moisture dial sunk in the ground; the needle carries a leaf and sits in the good band."""
    cx, cy = 24, 36
    r = 19.5 if fav else 19
    sw = 6 if fav else 4
    gap = 10 if fav else 7
    dry = _arc(cx, cy, r, 180, 124 + gap / 2)
    ok = _arc(cx, cy, r, 124 - gap / 2, 56 + gap / 2)
    wet = _arc(cx, cy, r, 56 - gap / 2, 0)
    ang = 100
    # the pointer is a leaf: an almond from the hub toward the good band
    L = 15 if fav else 16
    W = 4.6 if fav else 3.8
    leaf = (f'<path d="M0 0C{L*.3:.2f} {-W} {L*.7:.2f} {-W} {L} 0C{L*.7:.2f} {W} {L*.3:.2f} {W} 0 0z" '
            f'fill="{c["good"]}" transform="translate({cx} {cy}) rotate({-ang})"/>')
    return f'''
  <path d="{dry}" fill="none" stroke="{c['warm']}" stroke-width="{sw}"/>
  <path d="{ok}" fill="none" stroke="{c['good']}" stroke-width="{sw}"/>
  <path d="{wet}" fill="none" stroke="{c['water']}" stroke-width="{sw}"/>
  <path d="M{2 if fav else 2.5} {cy}h{44 if fav else 43}" stroke="{c['ground']}" stroke-width="{sw}" stroke-linecap="round"/>
  {leaf}
  <circle cx="{cx}" cy="{cy}" r="{5.2 if fav else 4.4}" fill="{c['ink']}"/>'''


def fork(c, fav=False):
    """F and H sharing one stem, drawn as the two-prong soil probe, with the reading between the prongs."""
    if fav:
        return f'''
  <path d="M8 3h19v6H14v10h26v6H14v11l-3 7-3-7z" fill="{c['ink']}"/>
  <path d="M34 3h6v33l-3 7-3-7z" fill="{c['ink']}"/>
  <path d="M24 28c3.6 4.2 5.4 6.9 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.3 1.8-5 5.4-9.2z" fill="{c['water']}"/>'''
    return f'''
  <path d="M9.5 4h17v5H14.5v10.5H38.5v5H14.5V36l-2.5 6.5L9.5 36z" fill="{c['ink']}"/>
  <path d="M33.5 4h5v32l-2.5 6.5L33.5 36z" fill="{c['ink']}"/>
  <path d="M24 27.5c3.6 4.2 5.5 6.9 5.5 9.3a5.5 5.5 0 0 1-11 0c0-2.4 1.9-5.1 5.5-9.3z" fill="{c['water']}"/>'''


CONCEPTS = [
    dict(slug='taproot', name='Taproot', fn=taproot, baseline=27.5,
         idea='A sprout whose root is the soil probe: leaves above the ground line, the blue sensor blade below it.'),
    dict(slug='needle', name='Needle', fn=needle, baseline=36,
         idea='A moisture dial sunk in the ground, dry to wet; the needle is a sprout parked in the good band.'),
    dict(slug='fork', name='Fork', fn=fork, baseline=None,
         idea='An F/H ligature drawn as the two-prong soil probe, with a water drop held between the prongs.'),
]


def svg(inner, w, h, vb=None, bg=None, title='FarmHand'):
    vb = vb or f'0 0 {w} {h}'
    back = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{back}{inner}\n</svg>\n')


WM = outline()


def lockup_inner(cn, c):
    """Symbol (48 units) + outlined wordmark. Returns (inner, width, height)."""
    cap_units = 21.0                      # wordmark cap height in symbol units
    s = cap_units / WM['cap']
    x0, y0, x1, y1 = WM['bounds']
    # baseline: sit on the ground line when the mark has one, else optically centre the caps
    base = cn['baseline'] if cn['baseline'] is not None else 24 + cap_units / 2
    gap = 11
    tx = 48 + gap - x0 * s
    width = 48 + gap + (x1 - x0) * s + 1
    inner = (f'<g>{cn["fn"](c)}</g>'
             f'<path transform="translate({tx:.3f} {base}) scale({s:.5f})" d="{WM["d"]}" fill="{c["ink"]}"/>')
    return inner, width, 48


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(text)


def main():
    manifest = []
    for cn in CONCEPTS:
        d = os.path.join(OUT, cn['slug'])
        for mode, c in (('light', LIGHT), ('dark', DARK)):
            sfx = '' if mode == 'light' else '-dark'
            write(f'{d}/symbol{sfx}.svg', svg(cn['fn'](c), 48, 48, title=f'FarmHand {cn["name"]} symbol'))
            inner, w, h = lockup_inner(cn, c)
            pad = 0
            write(f'{d}/lockup{sfx}.svg', svg(inner, round(w * 4), h * 4, vb=f'{-pad} 0 {w:.2f} {h}',
                                             title='FarmHand'))
        # favicon: heavy cut on a rounded ink tile so it holds on light and dark tab bars
        tile = f'<rect width="48" height="48" rx="11" fill="{DARK["bg"]}"/>'
        fav_inner = tile + f'<g transform="translate(4.8 4.8) scale(.8)">{cn["fn"](DARK, fav=True)}</g>'
        write(f'{d}/favicon.svg', svg(fav_inner, 48, 48, title='FarmHand'))
        manifest.append(dict(slug=cn['slug'], name=cn['name'], idea=cn['idea']))
    write(os.path.join(HERE, 'manifest.json'), json.dumps(dict(concepts=manifest, font=FONT_URL,
                                                               light=LIGHT, dark=DARK), indent=2))
    print('built', [c['slug'] for c in CONCEPTS])


if __name__ == '__main__':
    main()
