# Farm Hand hero model, built inside Blender via the MCP socket.
# One pot cut in half so you see into the soil. Every part is its own named object so three.js can drive it:
#   Pot, Rim, Soil (one body; three.js shades moisture by depth), Probe, ProbeBand, ProbeLED, Tube, Nozzle,
#   WaterFront (thin disc three.js moves down during a soak).
# Units: 1 = 10 cm. Soil is 20 cm deep (2.0), pot radius 13 cm top / 10 cm bottom.
import bpy, bmesh, math, os

OUT = r"C:\Users\User\Documents\code\shellhacks2025\farm-hand\laptop\static\models\farmhand.glb"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# clean scene
bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for x in list(block):
        block.remove(x)

def mat(name, rgb, rough=.5, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    return m

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in c)

M_POT   = mat("Pot",   srgb("#f3f5f7"), .35)
M_RIM   = mat("Rim",   srgb("#2a78d6"), .35)
M_SOIL  = [mat(f"Soil_L{i}", srgb(c), .95) for i, c in enumerate(["#8a6a48", "#7a5a3c", "#6a4d33", "#5a412b", "#4b3624", "#3e2d1e"])]
M_PROBE = mat("Probe", srgb("#16222d"), .45)
M_BAND  = mat("ProbeBand", srgb("#e9eef3"), .4)
M_LED   = mat("ProbeLED", srgb("#0ca30c"), .3)
M_TUBE  = mat("Tube", srgb("#dce6ef"), .15, alpha=.8)
M_PLIN  = mat("Plinth", srgb("#e7ecf1"), .6)
M_WATER = mat("WaterFront", srgb("#2a78d6"), .1, alpha=.55)

R_TOP, R_BOT, H, WALL = 1.3, 1.0, 2.0, .07
def r_at(y):  # soil radius at height y (0 = bottom, H = top)
    return R_BOT + (R_TOP - R_BOT) * y / H

def half_frustum(name, r0, r1, y0, y1, material, segs=96, cap=True):
    """Back half (+Y) of a cone slice; the flat cut faces -Y, which becomes +Z (toward the three.js camera) after export."""
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(segs + 1):
        a = math.pi * i / segs                 # 0..pi -> x from +r to -r, y >= 0 (back half)
        ring0.append(bm.verts.new((math.cos(a) * r0, math.sin(a) * r0, y0)))
        ring1.append(bm.verts.new((math.cos(a) * r1, math.sin(a) * r1, y1)))
    for i in range(segs):
        bm.faces.new((ring0[i], ring0[i + 1], ring1[i + 1], ring1[i]))
    bm.faces.new(ring1)                                    # top cap
    bm.faces.new(ring0[::-1])                              # bottom cap
    bm.faces.new((ring0[0], ring1[0], ring1[-1], ring0[-1]))  # the flat cut face
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return ob

def half_shell(name, r0, r1, y0, y1, material, segs=96):
    """Thin open half-wall (the pot), with thickness via a solidify modifier."""
    bm = bmesh.new(); ring0, ring1 = [], []
    for i in range(segs + 1):
        a = math.pi * i / segs
        ring0.append(bm.verts.new((math.cos(a) * r0, math.sin(a) * r0, y0)))
        ring1.append(bm.verts.new((math.cos(a) * r1, math.sin(a) * r1, y1)))
    for i in range(segs):
        bm.faces.new((ring0[i], ring0[i + 1], ring1[i + 1], ring1[i]))
    # half-disc floor
    c = bm.verts.new((0, 0, y0));
    for i in range(segs): bm.faces.new((c, ring0[i + 1], ring0[i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    mod = ob.modifiers.new("thick", "SOLIDIFY"); mod.thickness = WALL; mod.offset = 1
    bev = ob.modifiers.new("soft", "BEVEL"); bev.width = .012; bev.segments = 2
    for p in me.polygons: p.use_smooth = True
    return ob

# pot wall (just outside the soil), floor under the soil
half_shell("Pot", R_BOT + .005, R_TOP + .005, -.08, H + .1, M_POT)

# rim: half torus on top
bpy.ops.mesh.primitive_torus_add(major_radius=R_TOP + .04, minor_radius=.055, major_segments=96, minor_segments=16, location=(0, 0, H + .1))
rim = bpy.context.active_object; rim.name = "Rim"; rim.data.materials.append(M_RIM)
bm = bmesh.new(); bm.from_mesh(rim.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -.001], context="VERTS"); bm.to_mesh(rim.data); bm.free()
bpy.ops.object.shade_smooth()

# soil: ONE body with a real scanned soil texture (Poly Haven "farm_soil", CC0). three.js darkens it by
# moisture at each depth, like real wet soil, so the look stays photographic.
TEX = os.path.join(os.path.dirname(OUT), "..", "..", "..", "blender", "tex")
M_REAL = bpy.data.materials.new("Soil"); M_REAL.use_nodes = True
nt = M_REAL.node_tree; bsdf = nt.nodes["Principled BSDF"]
def img(name, colorspace):
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.normpath(os.path.join(TEX, name)))
    n.image.colorspace_settings.name = colorspace; return n
d = img("farm_soil_Diffuse.jpg", "sRGB"); r = img("farm_soil_Rough.jpg", "Non-Color"); nrm = img("farm_soil_nor_gl.jpg", "Non-Color")
nm = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(d.outputs["Color"], bsdf.inputs["Base Color"]); nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
nt.links.new(nrm.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
soil = half_frustum("Soil", R_BOT, R_TOP, 0.0, H, M_REAL, segs=128)
bpy.ops.object.select_all(action="DESELECT"); soil.select_set(True); bpy.context.view_layer.objects.active = soil
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.cube_project(cube_size=1.4)          # about 14 cm of soil per texture tile: real grain size
bpy.ops.object.mode_set(mode="OBJECT")

# probe: capacitive v1.2 style, true to size: 2.3 cm wide blade, 11 cm in the soil, 3.5 cm head above it
px = R_TOP * .42
bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -.012, H - 1.1 + (1.1 + .35) / 2))
probe = bpy.context.active_object; probe.name = "Probe"; probe.scale = (.23, .02, 1.1 + .35); probe.data.materials.append(M_PROBE)
bpy.ops.object.transform_apply(scale=True)
b = probe.modifiers.new("soft", "BEVEL"); b.width = .012; b.segments = 3
bpy.ops.mesh.primitive_cube_add(size=1, location=(px, -.016, H + .01))
band = bpy.context.active_object; band.name = "ProbeBand"; band.scale = (.24, .026, .025); band.data.materials.append(M_BAND)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_uv_sphere_add(radius=.022, location=(px + .06, -.03, H + .26))
led = bpy.context.active_object; led.name = "ProbeLED"; led.data.materials.append(M_LED); bpy.ops.object.shade_smooth()

# pump tube: a clean arc from behind the pot, ending in a nozzle over the soil
curve = bpy.data.curves.new("TubeCurve", "CURVE"); curve.dimensions = "3D"; curve.bevel_depth = .03; curve.bevel_resolution = 8
sp = curve.splines.new("BEZIER"); sp.bezier_points.add(2)
pts = [(-1.55, .9, 0.0), (-1.45, .75, H + .9), (-.5, .35, H + .7)]
for bp, co in zip(sp.bezier_points, pts):
    bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
tube = bpy.data.objects.new("Tube", curve); bpy.context.collection.objects.link(tube); tube.data.materials.append(M_TUBE)
bpy.ops.mesh.primitive_cylinder_add(radius=.042, depth=.09, location=(-.5, .35, H + .66))
noz = bpy.context.active_object; noz.name = "Nozzle"; noz.data.materials.append(M_RIM)

# water front: a thin half disc three.js slides down while a pour soaks in (hidden at rest)
half_frustum("WaterFront", R_TOP - .01, R_TOP - .005, H - .02, H, M_WATER, segs=64)

# convert the tube curve to a mesh so it exports
bpy.ops.object.select_all(action="DESELECT"); tube.select_set(True); bpy.context.view_layer.objects.active = tube
bpy.ops.object.convert(target="MESH")

# nice viewport for the person watching Blender
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        for sp3 in area.spaces:
            if sp3.type == "VIEW_3D":
                sp3.shading.type = "MATERIAL"
bpy.ops.object.select_all(action="DESELECT")

# export for three.js (Blender Z-up -> glTF Y-up is handled by the exporter)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True)
print("[farmhand] exported", OUT, os.path.getsize(OUT), "bytes;", len(bpy.data.objects), "objects")
