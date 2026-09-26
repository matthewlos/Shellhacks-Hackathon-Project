# Farm Hand hero model, built inside Blender through the Blender MCP socket (blender/mcp_send.py).
# The real setup: a Mainstays "Deep Rectangle" food storage container (clear frosted polypropylene, blue lid),
# potting mix, a capacitive soil moisture probe v1.2 pressed against the front wall, a pump tube over the soil.
# Named parts three.js drives: Soil (moisture shader), WaterFront, ProbeLED, Rim (glow), Nozzle (drops).
# Units: 1 = 10 cm.  Container size is an ESTIMATE (27 x 18 x 11 cm): set L, W, HC to the measured box.
import bpy, bmesh, math, os, random

OUT = r"C:\Users\User\Documents\code\shellhacks2025\farm-hand\laptop\static\models\farmhand.glb"
TEX = os.path.normpath(os.path.join(os.path.dirname(OUT), "..", "..", "..", "blender", "tex"))
L, W, HC, R = 2.7, 1.8, 1.1, .32      # container outer length, width, height, corner radius (top)
TAPER = .9                            # bottom is 90% of the top (these boxes nest, so the walls lean in)
HS = .95                              # soil depth: 9.5 cm
WALL = .03

bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.images):
    for x in list(block): block.remove(x)

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in c)

def mat(name, hexcol, rough=.5, metal=0.0, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if "Transmission Weight" in b.inputs: b.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1: b.inputs["Alpha"].default_value = alpha
    return m

def tex_mat(name, files, rough=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    def img(f, cs):
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(TEX, f)); n.image.colorspace_settings.name = cs; return n
    nt.links.new(img(files[0], "sRGB").outputs["Color"], b.inputs["Base Color"])
    if len(files) > 1:
        nt.links.new(img(files[1], "Non-Color").outputs["Color"], b.inputs["Roughness"])
        nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(img(files[2], "Non-Color").outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if rough is not None: b.inputs["Roughness"].default_value = rough
    return m

M_PP    = mat("Pot", "#f2f5f7", .32, transmission=.95)      # frosted polypropylene
M_LID   = mat("Lid", "#3f6f9e", .35)                          # the blue lid
M_SOIL  = tex_mat("Soil", ["farm_soil_Diffuse.jpg", "farm_soil_Rough.jpg", "farm_soil_nor_gl.jpg"])
M_PCB   = tex_mat("ProbePCB", ["probe_pcb.png"], rough=.35)
M_BAND  = mat("ProbeBand", "#e9eef3", .4)
M_LED   = mat("ProbeLED", "#0ca30c", .3)
M_TUBE  = mat("Tube", "#dce6ef", .15, transmission=.8)
M_NOZ   = mat("Nozzle", "#1b1f24", .4)
M_WATER = mat("WaterFront", "#2a78d6", .1, alpha=.55)
M_PERL  = mat("Perlite", "#eceae4", .8)

def rrect(l, w, r, z, n=10):
    """Rounded rectangle outline (counter-clockwise), centered, at height z."""
    pts = []
    for cx, cy, a0 in ((l/2 - r, w/2 - r, 0), (-l/2 + r, w/2 - r, 90), (-l/2 + r, -w/2 + r, 180), (l/2 - r, -w/2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r, z))
    return pts

def loft(name, bottom, top, material, cap_top=True, cap_bottom=True):
    bm = bmesh.new()
    vb = [bm.verts.new(p) for p in bottom]; vt = [bm.verts.new(p) for p in top]
    n = len(vb)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    if cap_top: bm.faces.new(vt)
    if cap_bottom: bm.faces.new(vb[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return ob

def uv_cube(ob, size):
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")

def curve_tube(name, pts, radius, material):
    cv = bpy.data.curves.new(name + "C", "CURVE"); cv.dimensions = "3D"; cv.bevel_depth = radius; cv.bevel_resolution = 6
    sp = cv.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cv); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    return ob

# --- the container: tapered rounded box, open top, with the rolled flange the lid snaps onto
tl, tw = L, W; bl, bw = L * TAPER, W * TAPER
pot = loft("Pot", rrect(bl, bw, R * TAPER, 0), rrect(tl, tw, R, HC), M_PP, cap_top=False)
mod = pot.modifiers.new("thick", "SOLIDIFY"); mod.thickness = WALL; mod.offset = -1
bev = pot.modifiers.new("soft", "BEVEL"); bev.width = .008; bev.segments = 2
rim = loft("Rim", rrect(tl + .02, tw + .02, R + .01, HC - .05), rrect(tl + .1, tw + .1, R + .05, HC), M_PP)
mod = rim.modifiers.new("thick", "SOLIDIFY"); mod.thickness = .025

# --- the soil: same taper, 9.5 cm deep, scanned soil texture
def at(z):   # outline size at height z (inside the wall)
    k = TAPER + (1 - TAPER) * z / HC
    return L * k - 2 * WALL, W * k - 2 * WALL - .05, R * k   # soil stops 2.5 mm short of the front/back wall: room for the probe
sb, st = at(0.0), at(HS)
soil = loft("Soil", rrect(sb[0], sb[1], sb[2], WALL), rrect(st[0], st[1], st[2], HS), M_SOIL)
uv_cube(soil, 1.4)

# --- water front: a thin slab three.js slides down during a soak
wf = loft("WaterFront", rrect(st[0] - .02, st[1] - .02, st[2], HS - .02), rrect(st[0] - .02, st[1] - .02, st[2], HS), M_WATER)

# --- the probe: 2.3 x 9.8 cm board, 7 cm in the soil, pressed against the long front wall (-Y) so it shows through
BH, IN, BW = .98, .70, .23
py = -((at(HS - IN / 2)[1] + .05) / 2) + .012   # flat against the inside of the front wall
bpy.ops.mesh.primitive_cube_add(size=1, location=(.35, py, HS - IN + BH / 2))
probe = bpy.context.active_object; probe.name = "Probe"; probe.scale = (BW, .016, BH); probe.data.materials.append(M_PCB)
bpy.ops.object.transform_apply(scale=True)
me = probe.data
if not me.uv_layers: me.uv_layers.new(name="UVMap")
uvl = me.uv_layers.active.data
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        uvl[li].uv = ((co.x + BW / 2) / BW, (co.z + BH / 2) / BH) if poly.normal.y < -.9 else (.02, .5)
bpy.ops.mesh.primitive_cube_add(size=1, location=(.35, py - .002, HS + .02))
band = bpy.context.active_object; band.name = "ProbeBand"; band.scale = (BW + .01, .02, .018); band.data.materials.append(M_BAND)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_uv_sphere_add(radius=.016, location=(.42, py - .012, HS + .23))
led = bpy.context.active_object; led.name = "ProbeLED"; led.data.materials.append(M_LED); bpy.ops.object.shade_smooth()
for k, (col, dx) in enumerate((("#c43b2f", -.06), ("#1c1c1c", 0), ("#e0b83a", .06))):
    curve_tube(f"Wire{k}", [(.35 + dx, py, HS + .29), (.4 + dx, py - .15, HS + .75), (1.3 + dx, .6, HC + .55), (2.2 + dx, 1.5, .02)], .011, mat(f"Wire{k}", col, .5))

# --- pump tube: in from the back-left, nozzle over the soil
curve_tube("Tube", [(-2.2, 1.3, .02), (-1.9, 1.1, HC + .8), (-.9, .45, HC + .75), (-.55, .25, HC + .45)], .03, M_TUBE)
bpy.ops.mesh.primitive_cylinder_add(radius=.04, depth=.1, location=(-.55, .25, HC + .42))
noz = bpy.context.active_object; noz.name = "Nozzle"; noz.data.materials.append(M_NOZ)

# --- potting-mix surface: soil crumbs and white perlite
random.seed(7)
parts = []
for i in range(520):
    x = (random.random() - .5) * (st[0] - .12); y = (random.random() - .5) * (st[1] - .12)
    perl = random.random() < .15
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=(.02 if perl else .028) * (0.6 + random.random() * .8), location=(x, y, HS + .004))
    c = bpy.context.active_object; c.scale = (1, .8 + random.random() * .5, .5 + random.random() * .3)
    c.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
    c.data.materials.append(M_PERL if perl else M_SOIL); parts.append(c)
bpy.ops.object.select_all(action="DESELECT")
for c in parts: c.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); parts[0].name = "Crumbs"

# --- the blue lid, upside down on the table to the right, like it was just popped off
lid = loft("Lid", rrect(tl + .1, tw + .1, R + .05, 0), rrect(tl + .06, tw + .06, R + .04, .09), M_LID)
bev = lid.modifiers.new("soft", "BEVEL"); bev.width = .02; bev.segments = 3
lid.location = (1.7, 2.0, .1); lid.rotation_euler = (math.radians(180), 0, math.radians(-18))

bpy.ops.object.select_all(action="DESELECT")
for area in (bpy.context.screen.areas if bpy.context.screen else []):
    if area.type == "VIEW_3D":
        for sp3 in area.spaces:
            if sp3.type == "VIEW_3D": sp3.shading.type = "MATERIAL"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True)
print("[farmhand] exported", OUT, os.path.getsize(OUT), "bytes;", len(bpy.data.objects), "objects")
