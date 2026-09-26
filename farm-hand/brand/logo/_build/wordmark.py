"""Outline the "FarmHand" wordmark from the web app's own Archivo variable font.

Needs: fonttools, brotli, uharfbuzz (pip install fonttools brotli uharfbuzz).
Returns an SVG path (y-down, baseline at 0, left edge at 0) plus metrics, so the
lockups render without the font installed.
"""
import io
import os

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.normpath(os.path.join(
    HERE, '../../../web/node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2'))


def outline(text='FarmHand', wght=700, wdth=86, tracking=-0.012):
    """Shape and outline `text`. Units are font units (upm). Returns dict."""
    font = TTFont(FONT)
    font.flavor = None
    inst = instancer.instantiateVariableFont(font, {'wght': wght, 'wdth': wdth})
    buf = io.BytesIO()
    inst.save(buf)
    data = buf.getvalue()
    font = TTFont(io.BytesIO(data))
    upm = font['head'].unitsPerEm
    cap = font['OS/2'].sCapHeight
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()

    face = hb.Face(data)
    hbf = hb.Font(face)
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(hbf, b, {'kern': True, 'liga': True})

    track = tracking * upm
    x = 0.0
    parts = []
    bp = BoundsPen(gs)
    for i, (info, pos) in enumerate(zip(b.glyph_infos, b.glyph_positions)):
        name = order[info.codepoint]
        pen = SVGPathPen(gs)
        # font is y-up; flip to y-down with baseline at 0
        tp = TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset))
        gs[name].draw(tp)
        gs[name].draw(TransformPen(bp, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        parts.append(pen.getCommands())
        x += pos.x_advance + (track if i < len(b.glyph_infos) - 1 else 0)
    # tight left/right bounds from the F stem and the final d
    return {'d': ' '.join(parts), 'advance': x, 'upm': upm, 'cap': cap, 'bounds': bp.bounds}


if __name__ == '__main__':
    o = outline()
    print(o['advance'], o['upm'], o['cap'], o['bounds'])
