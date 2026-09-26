"""One-time patch: turn build_farmhand.py into the realistic version (clear container, full soil, real-looking
probe with PCB texture pressed against the front wall, jumper wires, crumbs + perlite on the surface)."""
from pathlib import Path

p = Path(__file__).parent / "build_farmhand.py"
s = p.read_text(encoding="utf-8")

s = s.replace('M_POT   = mat("Pot",   srgb("#f3f5f7"), .35)',
              'M_POT   = mat("Pot",   srgb("#f4f7fa"), .06)\n'
              'bp = M_POT.node_tree.nodes["Principled BSDF"]\n'
              'for k, v in (("Transmission Weight", 1.0), ("IOR", 1.49)):\n'
              '    if k in bp.inputs: bp.inputs[k].default_value = v')
s = s.replace('M_RIM   = mat("Rim",   srgb("#2a78d6"), .35)', 'M_RIM   = mat("Rim",   srgb("#eef3f7"), .08)')

a, b = s.index("def half_frustum("), s.index("# pot wall (just outside the soil)")
s = s[:a] + (Path(__file__).parent / "patch_parts" / "geometry.py").read_text(encoding="utf-8") + s[b:]

a, b = s.index("# pot wall (just outside the soil)"), s.index("# soil: ONE body")
s = s[:a] + (Path(__file__).parent / "patch_parts" / "container.py").read_text(encoding="utf-8") + s[b:]

a, b = s.index("# probe: capacitive v1.2 style, true to size"), s.index("# pump tube:")
s = s[:a] + (Path(__file__).parent / "patch_parts" / "probe_surface.py").read_text(encoding="utf-8") + s[b:]

s = s.replace('noz = bpy.context.active_object; noz.name = "Nozzle"; noz.data.materials.append(M_RIM)',
              'noz = bpy.context.active_object; noz.name = "Nozzle"; noz.data.materials.append(M_PROBE)')
s = s.replace('half_frustum("WaterFront", R_TOP - .01, R_TOP - .005, H - .02, H, M_WATER, segs=64)',
              'frustum("WaterFront", R_TOP - .02, R_TOP - .015, H - .02, H, M_WATER, segs=96)')
p.write_text(s, encoding="utf-8")
print("patched")
