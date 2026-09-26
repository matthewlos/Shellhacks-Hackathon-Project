# Farm Hand hero model. Run headless:  blender -b --factory-startup --python blender/build_farmhand.py
# (or send it through the Blender MCP socket with blender/mcp_send.py).
# The real setup, every part at its real size:
#   Mainstays "Deep Rectangle" food storage box (frosted polypropylene, blue lid) filled with potting mix,
#   capacitive soil moisture sensor v1.2 + DS18B20 temp probe in the soil against the front wall,
#   ESP32 devkit on an 830-point breadboard, 1-channel relay module, mini submersible pump in a cup of water.
# Named parts three.js drives: Soil (moisture shader), WaterFront, ProbeLED, Rim (glow), Nozzle (drops).
# Units: 1 = 10 cm, so 1 mm = 0.01.  Box size is an ESTIMATE (27 x 18 x 11 cm): set L, W, HC to the measured box.
import bpy, bmesh, math, os, random
from mathutils import Vector, noise

OUT = r"C:\Users\User\Documents\code\shellhacks2025\farm-hand\laptop\static\models\farmhand.glb"
HERE = r"C:\Users\User\Documents\code\shellhacks2025\farm-hand\blender"
TEX = os.path.join(HERE, "tex")
L, W, HC, R = 2.7, 1.8, 1.1, .32      # container outer length, width, height, corner radius (top)
TAPER = .9                            # bottom is 90% of the top (these boxes nest, so the walls lean in)
HS = .95                              # soil depth: 9.5 cm
WALL = .03
MMU = .01                             # one millimetre

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

def tex_mat(name, files, rough=None, metal=0.0):
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
    b.inputs["Metallic"].default_value = metal
    return m

M_PP    = mat("Pot", "#f2f5f7", .32, transmission=.95)      # frosted polypropylene
M_LID   = mat("Lid", "#3f6f9e", .35)                          # the blue lid
M_SOIL  = tex_mat("Soil", ["potting_mix.png", "farm_soil_Rough.jpg", "farm_soil_nor_gl.jpg"])
M_WATER = mat("WaterFront", "#2a78d6", .1, alpha=.55)
M_PERL  = mat("Perlite", "#eceae4", .8)
M_BARK  = mat("Bark", "#5c3520", .7)

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

def activate(ob):
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob

def uv_cube(ob, size):
    activate(ob)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")

def curve_tube(name, pts, radius, material, res=6):
    cv = bpy.data.curves.new(name + "C", "CURVE"); cv.dimensions = "3D"; cv.bevel_depth = radius; cv.bevel_resolution = res
    sp = cv.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cv); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
    activate(ob); bpy.ops.object.convert(target="MESH")
    return ob

# --- the container: tapered rounded box, open top, with the rolled flange the lid snaps onto
tl, tw = L, W; bl, bw = L * TAPER, W * TAPER
pot = loft("Pot", rrect(bl, bw, R * TAPER, 0), rrect(tl, tw, R, HC), M_PP, cap_top=False)
mod = pot.modifiers.new("thick", "SOLIDIFY"); mod.thickness = WALL; mod.offset = -1
bev = pot.modifiers.new("soft", "BEVEL"); bev.width = .008; bev.segments = 2
rim = loft("Rim", rrect(tl + .02, tw + .02, R + .01, HC - .05), rrect(tl + .1, tw + .1, R + .05, HC), M_PP, cap_top=False, cap_bottom=False)   # a ring, no caps
mod = rim.modifiers.new("thick", "SOLIDIFY"); mod.thickness = .025

# --- the soil: same taper, 9.5 cm deep, potting-mix texture at real grain size (8 cm tile)
def at(z):   # soil outline at height z (inside the wall; 2.5 mm short front and back to leave room for the probe)
    k = TAPER + (1 - TAPER) * z / HC
    return L * k - 2 * WALL, W * k - 2 * WALL - .05, R * k
sb, st = at(0.0), at(HS)
soil = loft("Soil", rrect(sb[0], sb[1], sb[2], WALL), rrect(st[0], st[1], st[2], HS), M_SOIL)
uv_cube(soil, .8)
for pg in soil.data.polygons: pg.use_smooth = False   # flat sides: the soil shader tells top from side by the normal

# lumpy top: a fine grid pushed up by noise (potting mix is never flat), fading to flat at the walls
def edge_dist(x, y, l, w, r):
    ax, ay = abs(x), abs(y)
    if ax > l / 2 - r and ay > w / 2 - r:
        return r - math.hypot(ax - (l / 2 - r), ay - (w / 2 - r))
    return min(l / 2 - ax, w / 2 - ay)

def lump(x, y):
    p = Vector((x, y, 0))
    h = .016 * max(0.0, .45 + .7 * noise.noise(p * 7.0)) + .007 * noise.noise(p * 21.0 + Vector((5, 1, 0))) + .003 * noise.noise(p * 60.0)
    e = edge_dist(x, y, st[0], st[1], st[2])
    return max(0.0, h) * min(1.0, max(0.0, e / .12))

bm = bmesh.new(); step = .02; grid = {}
nx, ny = int(st[0] / step) + 1, int(st[1] / step) + 1
for i in range(nx):
    for j in range(ny):
        x, y = -st[0] / 2 + i * step, -st[1] / 2 + j * step
        if edge_dist(x, y, st[0], st[1], st[2]) >= 0:
            grid[i, j] = bm.verts.new((x, y, HS + .001 + lump(x, y)))
for i in range(nx - 1):
    for j in range(ny - 1):
        q = [grid.get(k) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
        if all(q): bm.faces.new(q)
uvl = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    for lp in f.loops: lp[uvl].uv = (lp.vert.co.x / .8, lp.vert.co.y / .8)
me = bpy.data.meshes.new("SoilTop"); bm.to_mesh(me); bm.free()
top = bpy.data.objects.new("SoilTop", me); bpy.context.collection.objects.link(top); top.data.materials.append(M_SOIL)
for p in me.polygons: p.use_smooth = True
activate(soil); top.select_set(True); bpy.ops.object.join()      # one Soil object: the page's moisture shader covers the top too

# --- water front: a thin slab three.js slides down during a soak
wf = loft("WaterFront", rrect(st[0] - .02, st[1] - .02, st[2], HS - .02), rrect(st[0] - .02, st[1] - .02, st[2], HS), M_WATER)

# --- crumbs, perlite and bark sitting on the lumpy surface
random.seed(7)
parts = []
for i in range(360):
    x = (random.random() - .5) * (st[0] - .1); y = (random.random() - .5) * (st[1] - .1)
    kind = random.random()
    z = HS + .001 + lump(x, y)
    if kind < .22:     # perlite
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.012 + random.random() * .018, location=(x, y, z + .004))
        m = M_PERL
    elif kind < .32:   # bark chip
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + .002))
        c = bpy.context.active_object; c.scale = (.02 + random.random() * .03, .008 + random.random() * .01, .004)
        m = M_BARK
    else:              # soil clump
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.01 + random.random() * .025, location=(x, y, z))
        m = M_SOIL
    c = bpy.context.active_object
    if m is not M_BARK: c.scale = (1, .75 + random.random() * .5, .45 + random.random() * .35)
    c.rotation_euler = (random.random() * .6, random.random() * .6, random.random() * 6.3)
    c.data.materials.append(m); parts.append(c)
bpy.ops.object.select_all(action="DESELECT")
for c in parts: c.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); parts[0].name = "Crumbs"

# --- the blue lid, flat on the table behind the box (just its edge peeks out)
lid = loft("Lid", rrect(tl + .1, tw + .1, R + .05, 0), rrect(tl + .06, tw + .06, R + .04, .09), M_LID)
bev = lid.modifiers.new("soft", "BEVEL"); bev.width = .02; bev.segments = 3
lid.location = (.2, 2.25, 0); lid.rotation_euler = (0, 0, math.radians(-6))

# --- all the electronics: probe, temp probe, ESP32 + breadboard, relay, pump + cup, wires
exec(open(os.path.join(HERE, "hardware.py"), encoding="utf-8").read())

bpy.ops.object.select_all(action="DESELECT")
for area in (bpy.context.screen.areas if bpy.context.screen else []):
    if area.type == "VIEW_3D":
        for sp3 in area.spaces:
            if sp3.type == "VIEW_3D": sp3.shading.type = "MATERIAL"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True)
print("[farmhand] exported", OUT, os.path.getsize(OUT), "bytes;", len(bpy.data.objects), "objects:",
      sorted(o.name for o in bpy.data.objects))
