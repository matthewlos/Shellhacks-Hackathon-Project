# Farm Hand electronics, exec'd by build_farmhand.py (shares its namespace: mat, tex_mat, loft, curve_tube, activate,
# HS, HC, W, L, TAPER, WALL, MMU ...). Every part is modeled at its real size in millimetres (MMU = 0.01 units).
# Layout on the table (Blender: +X right, +Y back, +Z up):
#   box at the origin, breadboard + ESP32 in front of it, relay module front-right, pump in a cup of water on the left.
#   Both probes sit at the right end so the left of the box is clear soil to look into.
from mathutils import Matrix

M_EDGE   = mat("PcbBlack", "#131417", .32)
M_BLACK  = mat("BlackPlastic", "#1b1b1d", .5)
M_WHITE  = mat("WhitePlastic", "#efefeb", .45)
M_SILVER = mat("Silver", "#d4d7da", .22, metal=1.0)
M_GOLD   = mat("Gold", "#d9b35c", .28, metal=1.0)
M_STEEL  = mat("Steel", "#c9ccd0", .16, metal=1.0)
M_CABLE  = mat("Cable", "#161618", .55)
M_TERM   = mat("Terminal", "#2c7b4c", .45)
M_RBODY  = mat("RelayBody", "#2d5fc4", .35)
M_MODULE = mat("ModulePcb", "#1c222c", .35)
M_TAN    = mat("Ceramic", "#b8946a", .5)
M_RES    = mat("ResistorBody", "#d6bd8f", .5)
M_CUP    = mat("Cup", "#f4f7fa", .05, transmission=1.0)
M_H2O    = mat("Water", "#d6ecf7", .02, transmission=1.0)
M_TUBE   = mat("Tube", "#e2ebf2", .12, transmission=.85)
M_NOZ    = mat("Nozzle", "#1b1f24", .4)
M_LED    = mat("ProbeLED", "#0ca30c", .3)
M_RED    = mat("LedRed", "#e0342a", .3)
T_PROBE  = tex_mat("ProbeFace", ["probe_v12.png"], rough=.3)
T_ESP    = tex_mat("Esp32Top", ["esp32_pcb.png"], rough=.3)
T_CAN    = tex_mat("Esp32Can", ["esp32_can.png"], rough=.25, metal=1.0)
T_ANT    = tex_mat("Esp32Antenna", ["esp32_ant.png"], rough=.3)
T_BB     = tex_mat("BreadboardTop", ["breadboard.png"], rough=.5)
T_RPCB   = tex_mat("RelayPcb", ["relay_pcb.png"], rough=.35)
T_RTOP   = tex_mat("RelayTop", ["relay_top.png"], rough=.35)
WIRE = {c: mat("Wire_" + c, h, .45) for c, h in (("red", "#c8312a"), ("black", "#202022"), ("yellow", "#e2b534"),
                                                   ("blue", "#2b6fd6"), ("green", "#2f9a4f"), ("white", "#e8e8e4"))}


def box(name, sx, sy, sz, loc, m, bev=0.0):
    """Box sized in mm, placed in units."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = (sx * MMU, sy * MMU, sz * MMU)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev:
        b = o.modifiers.new("b", "BEVEL"); b.width = bev * MMU; b.segments = 2
        bpy.ops.object.modifier_apply(modifier="b")
    o.data.materials.append(m)
    return o


def cyl(name, r, h, loc, m, rot=(0, 0, 0), verts=24):
    """Cylinder: radius and height in mm."""
    bpy.ops.mesh.primitive_cylinder_add(radius=r * MMU, depth=h * MMU, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def face_tex(o, tmat, normal=(0, 0, 1), rot=False):
    """Put an image on the faces pointing along `normal` (local), stretched to the object's extent."""
    me = o.data
    me.materials.append(tmat); idx = len(me.materials) - 1
    if not me.uv_layers: me.uv_layers.new(name="UVMap")
    uvl = me.uv_layers.active.data
    n = Vector(normal)
    co = [v.co for v in me.vertices]
    ax = (0, 1) if abs(n.z) > .5 else (0, 2)            # top faces use x,y; front faces use x,z
    lo = [min(c[a] for c in co) for a in ax]; hi = [max(c[a] for c in co) for a in ax]
    for p in me.polygons:
        if p.normal.dot(n) > .9:
            p.material_index = idx
            for li in p.loop_indices:
                c = me.vertices[me.loops[li].vertex_index].co
                u = (c[ax[0]] - lo[0]) / (hi[0] - lo[0]); v = (c[ax[1]] - lo[1]) / (hi[1] - lo[1])
                uvl[li].uv = (v, 1 - u) if rot else (u, v)


def join(name, objs):
    objs = [o for o in objs if o]
    activate(objs[0])
    for o in objs[1:]: o.select_set(True)
    bpy.ops.object.join(); o = bpy.context.active_object; o.name = name
    return o


def place(objs, m):
    """Move objects built around the origin by the 4x4 matrix m."""
    for o in objs:
        o.matrix_world = m @ o.matrix_world


def xf(m, p):
    return m @ Vector(p)


def dupont(name, top_at, m=M_BLACK, female=False):
    """Jumper-wire end standing in a hole (male) or on a header pin (female). top_at = bottom-centre point."""
    x, y, z = top_at
    h = box(name, 2.54, 2.54, 14, (x, y, z + .07), m, bev=.25)
    return h, Vector((x, y, z + .14))


def wire(name, pts, color, r=.0085):
    return curve_tube(name, [tuple(p) for p in pts], r, WIRE[color], res=4)


# ================= capacitive soil moisture sensor v1.2 (built standing at the origin, tip at z=0) =================
BW_, BH_ = .23, .98
bm = bmesh.new()
outline = [(-BW_ / 2, BH_), (BW_ / 2, BH_), (BW_ / 2, .12), (.035, 0), (-.035, 0), (-BW_ / 2, .12)]
front = [bm.verts.new((x, -.008, z)) for x, z in outline]; back = [bm.verts.new((x, .008, z)) for x, z in outline]
bm.faces.new(front); bm.faces.new(back[::-1])
for i in range(len(outline)):
    j = (i + 1) % len(outline)
    bm.faces.new((front[i], front[j], back[j], back[i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Probe"); bm.to_mesh(me); bm.free()
board = bpy.data.objects.new("Probe", me); bpy.context.collection.objects.link(board); me.materials.append(M_EDGE)
face_tex(board, T_PROBE, normal=(0, -1, 0))                  # the silkscreen side faces the wall: you read it through the plastic
by = .008
pb = [board,
      box("P555", 4.9, 1.5, 3.9, (-.03, by + .0075, BH_ - .17), M_BLACK),                  # 555 timer (SOIC-8)
      box("PReg", 2.9, 1.2, 1.6, (.05, by + .006, BH_ - .165), M_BLACK),                   # 3.3 V regulator
      box("PJst", 10, 5.8, 7, (0, by + .029, BH_ - .045), M_WHITE, bev=.3),               # JST-PH socket
      box("PPlug", 8, 4.5, 6, (0, by + .029, BH_ - .045 + .065), M_WHITE, bev=.3)]        # the plug on the cable
for k in range(4):                                                                         # 555 legs
    for s in (-1, 1):
        pb.append(box(f"PLeg{k}{s}", .4, .9, .6, (-.03 + s * .029, by + .003, BH_ - .187 + k * .0127), M_SILVER))
for zz in (.23, .26):
    for xx in (-.06, 0, .06):
        pb.append(box("PSmd", 1.6, .6, .8, (xx, by + .003, BH_ - zz), M_TAN if xx else M_BLACK))
probe = join("Probe", pb)
tilt = math.atan(W * (1 - TAPER) / HC / 2)                   # lean with the wall (the box's sides slope out)
def wall_y(z):
    return (W * (TAPER + (1 - TAPER) * z / HC)) / 2 - WALL
z0 = HS - .70                                                # 7 cm of the board in the soil
M_PROBE = Matrix.Translation((.72, -wall_y(z0) + .016, z0)) @ Matrix.Rotation(tilt, 4, "X")
place([probe], M_PROBE)
PLUG_TOP = [xf(M_PROBE, (dx, by + .029, BH_ - .045 + .095)) for dx in (-.025, 0, .025)]

# ================= DS18B20 waterproof temperature probe (steel tube in the soil, cable out) =================
tx, tz0 = 1.05, .35
M_DS = Matrix.Translation((tx, -wall_y(tz0) + .033, tz0)) @ Matrix.Rotation(tilt, 4, "X")
ds = [cyl("DsTube", 3, 50, (0, 0, .25), M_STEEL), cyl("DsCrimp", 3.3, 6, (0, 0, .5), M_STEEL)]
bpy.ops.mesh.primitive_uv_sphere_add(radius=.03, location=(0, 0, 0)); tip = bpy.context.active_object
tip.data.materials.append(M_STEEL); bpy.ops.object.shade_smooth(); ds.append(tip)
ds = join("TempProbe", ds); place([ds], M_DS)
DS_TOP = xf(M_DS, (0, 0, .53))

# ================= 830-point breadboard + ESP32 devkit (built flat at the origin, long side on X) =================
P = .0254
ROW = {"a": -.1397, "b": -.1143, "c": -.0889, "d": -.0635, "e": -.0381, "f": .0381, "g": .0635, "h": .0889, "i": .1143, "j": .1397,
       "+": -.203, "-": -.229}
def hole(col, row):
    return Vector(((col - 32) * P, ROW[row], .085))
bb = box("Breadboard", 165.1, 54.6, 8.5, (0, 0, .0425), M_WHITE, bev=.6)
face_tex(bb, T_BB)

ex, ey = -.508, .0127                                         # ESP32 pins in rows b and j, columns 3-21
pcb_z = .118
esp = [box("EspHdrA", 48.3, 2.5, 2.5, (ex, ROW["b"], .0975), M_BLACK),
       box("EspHdrB", 48.3, 2.5, 2.5, (ex, ROW["j"], .0975), M_BLACK)]
top = box("EspPcb", 51.5, 28.3, 1.6, (ex, ey, pcb_z), M_EDGE); face_tex(top, T_ESP); esp.append(top)
left = ex - .2575
esp.append(box("EspModule", 25.5, 18, .8, (left - .012 + .1275, ey, .130), M_MODULE))
ant = box("EspAnt", 6.5, 18, .1, (left - .012 + .0325, ey, .1345), M_MODULE); face_tex(ant, T_ANT, rot=True); esp.append(ant)
can = box("EspCan", 17.8, 15.8, 2.4, (left - .012 + .159, ey, .146), M_SILVER, bev=.3); face_tex(can, T_CAN, rot=True); esp.append(can)
usb_x = ex + .2575 - .0325
esp += [box("EspUsb", 7.3, 8.9, 3.2, (usb_x, ey, .142), M_SILVER, bev=.9),
        box("EspUsbHole", .4, 7.0, 1.4, (usb_x + .0366, ey, .142), M_BLACK),
        box("EspUart", 5, 5, .9, (ex + .12, ey - .03, .1305), M_BLACK),
        box("EspLdo", 6.5, 3.5, 1.6, (ex + .06, ey + .075, .134), M_BLACK)]
for by_ in (.042, -.053):                                     # BOOT and EN buttons
    esp += [box("EspBtn", 5.1, 2.9, 1.2, (ex + .19, ey + by_, .132), M_SILVER), box("EspBtnCap", 1.8, 1.2, .9, (ex + .19, ey + by_, .1405), M_BLACK)]
for k, (dx, dy) in enumerate(((.02, .05), (.03, -.06), (.09, -.08), (.1, .02), (-.0, .09), (.16, .09), (.16, -.09))):
    esp.append(box("EspSmd", 1.6, .8, .5, (ex + dx, ey + dy, .1285), M_TAN if k % 2 else M_BLACK))
esp.append(box("EspPwrLed", 1.6, .8, .6, (ex + .15, ey + .11, .129), M_RED))
esp = join("ESP32", esp)
bpy.ops.mesh.primitive_uv_sphere_add(radius=.009, location=(ex + .15, ey - .11, .13), segments=16, ring_count=8)
led = bpy.context.active_object; led.name = "ProbeLED"; led.data.materials.append(M_LED); led.scale = (1, 1, .6)   # the board's status LED (the page colors it)

# 4.7k pull-up resistor for the temp probe, columns 26-30 row c
res = [cyl("ResBody", 1.2, 6.3, ((28 - 32) * P, ROW["c"], .115), M_RES, rot=(0, math.pi / 2, 0))]
for k, (dx, c) in enumerate(((-.02, "#e6be1e"), (-.008, "#8a3cb0"), (.004, "#c8281e"), (.022, "#c09a3c"))):
    res.append(cyl("ResBand", 1.25, .7, ((28 - 32) * P + dx, ROW["c"], .115), mat(f"Band{k}", c, .45), rot=(0, math.pi / 2, 0)))
for col in (26, 30):
    h = hole(col, "c"); s = 1 if col > 28 else -1
    res.append(curve_tube("ResLeg", [(h.x, h.y, .083), (h.x, h.y, .108), (h.x - s * .01, h.y, .115), ((28 - 32) * P + s * .03, h.y, .115)], .0025, M_SILVER, res=2))
res = join("Resistor", res)

# jumper-wire ends plugged into the board: (column, row, color)
PLUGS = {"probe_vcc": (9, "+", "red"), "probe_gnd": (10, "-", "black"), "probe_out": (6, "a", "yellow"),
         "relay_vcc": (3, "+", "red"), "relay_gnd": (4, "-", "black"), "relay_in": (8, "a", "blue"),
         "esp_5v": (21, "a", "red"), "esp_gnd": (15, "a", "black")}
houses = []
for k, (col, row, c) in PLUGS.items():
    hs, _ = dupont("Dupont", hole(col, row) + Vector((0, 0, .002)))
    houses.append(hs)
houses = join("DupontEnds", houses)
# short on-board jumpers: ESP 5V and GND to the power rails
short = [wire("Jmp5v", [hole(21, "a") + Vector((0, 0, .16)), hole(21, "a") + Vector((0, -.03, .23)), hole(21, "+") + Vector((0, .01, .2)),
                        hole(21, "+") + Vector((0, 0, .12))], "red"),
         wire("JmpGnd", [hole(15, "a") + Vector((0, 0, .16)), hole(15, "a") + Vector((0, -.04, .24)), hole(15, "-") + Vector((0, .01, .2)),
                         hole(15, "-") + Vector((0, 0, .12))], "black")]
for col, row in ((21, "+"), (15, "-")):
    hs, _ = dupont("DupontEnd2", hole(col, row) + Vector((0, 0, .002))); short.append(hs)
short = join("BoardJumpers", short)

M_BB = Matrix.Translation((.55, -1.5, 0)) @ Matrix.Rotation(math.radians(180), 4, "Z")   # in front of the box, rails on the box side
place([bb, esp, led, res, houses, short], M_BB)
PLUG_W = {k: xf(M_BB, hole(col, row) + Vector((0, 0, .142))) for k, (col, row, c) in PLUGS.items()}

# USB-C cable out of the ESP32, off the back of the table
usb_end = xf(M_BB, (usb_x + .04, ey, .142))
usb = [curve_tube("UsbCable", [tuple(usb_end + Vector((-.1, 0, 0))), tuple(xf(M_BB, (usb_x + .3, ey, .05))), (.9, -2.0, .02), (2.2, -2.25, .02), (3.6, -2.3, .02)], .018, M_CABLE),
       box("UsbPlug", 7, 12, 5, tuple(usb_end + Vector((-.06, 0, 0))), mat("UsbOvermold", "#2a2a2c", .5), bev=1.2)]   # to the laptop
join("UsbCable", usb)

# ================= 1-channel relay module (built at the origin, header on -X, screw terminals on +X) =================
rz = .013
rel = [box("RelayPcb", 50, 26, 1.6, (0, 0, rz), M_EDGE)]
face_tex(rel[0], T_RPCB)
body = box("RelayCube", 19, 15.5, 15.3, (-.075, .01, rz + .008 + .0765), M_RBODY, bev=.4); face_tex(body, T_RTOP); rel.append(body)
rel.append(box("RelayTerm", 7.6, 15, 10, (.173, 0, rz + .008 + .05), M_TERM, bev=.4))
for yy in (-.05, 0, .05):
    rel += [cyl("RelayScrew", 1.6, .8, (.165, yy, rz + .108 + .004), M_SILVER),
            box("RelaySlot", .4, 2.6, .3, (.165, yy, rz + .1135), M_BLACK),
            box("RelayHole", .3, 3.2, 3.0, (.173 + .0385, yy, rz + .008 + .035), M_BLACK)]
rel.append(box("RelayHdr", 2.5, 7.6, 2.5, (-.225, .0346, rz + .02), M_BLACK))
REL_PINS = [(-.225, y) for y in (.06, .0346, .0092)]
for x, y in REL_PINS:
    rel.append(box("RelayPin", .64, .64, 8.5, (x, y, rz + .05), M_GOLD))
rel += [box("RelayOpto", 4.6, 6.5, 3.5, (-.14, -.04, rz + .026), M_BLACK),
        box("RelayJmpHdr", 7.6, 2.5, 2.5, (-.15, .085, rz + .02), M_BLACK),
        box("RelayJumper", 5.1, 2.6, 6, (-.163, .085, rz + .045), mat("JumperCap", "#e8c43a", .45)),
        box("RelayLedR", 1.6, .8, .6, (-.19, -.09, rz + .011), M_RED),
        box("RelayLedG", 1.6, .8, .6, (-.17, -.09, rz + .011), mat("LedGreen", "#2fb84a", .3)),
        box("RelayDiode", 3.5, 1.5, 1.5, (.03, -.1, rz + .015), M_BLACK)]
fem = []
for x, y in REL_PINS:
    hs, _ = dupont("RelayDupont", (x, y, rz + .03)); fem.append(hs)
rel = join("Relay", rel); fem = join("RelayWireEnds", fem)
M_REL = Matrix.Translation((1.95, -1.35, 0))
place([rel, fem], M_REL)
REL_TOPS = [xf(M_REL, (x, y, rz + .03 + .14)) for x, y in REL_PINS]
REL_TERM = [xf(M_REL, (.173 + .04, yy, rz + .043)) for yy in (-.05, 0, .05)]   # wire entry holes: NO, COM, NC

# ================= mini submersible pump in a cup of water =================
CX, CY = -2.0, .4
def circ(r, z, n=48):
    return [(CX + math.cos(2 * math.pi * i / n) * r, CY + math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]
cup = loft("Cup", circ(.36, 0), circ(.42, .95), M_CUP, cap_top=False)
m_ = cup.modifiers.new("t", "SOLIDIFY"); m_.thickness = .012; m_.offset = -1
loft("Water", circ(.345, .012), circ(.395, .72), M_H2O)
pump = [cyl("PumpBody", 12, 30, (CX, CY, .19), M_BLACK, verts=32),
        cyl("PumpInlet", 12.6, 4, (CX, CY, .04), mat("PumpGrey", "#3a3c40", .5), verts=32),
        cyl("PumpCap", 11, 2, (CX, CY, .35), mat("PumpGrey2", "#2a2c30", .45), verts=32),
        cyl("PumpOutlet", 3.6, 10, (CX + .05, CY, .41), M_BLACK)]
for k in range(8):
    a = k * math.pi / 4
    pump.append(box("PumpSlot", 1.2, 4, 2.5, (CX + math.cos(a) * .124, CY + math.sin(a) * .124, .04), M_CABLE))
join("Pump", pump)

# ================= tube from the pump, over the left rim (binder clip holds it), pouring near the front =================
# near the front on purpose: the wet bulb it makes in the soil is visible through the front wall
NOZ = Vector((-.62, -.38, 1.2))
curve_tube("Tube", [(CX + .05, CY, .45), (CX + .05, CY, 1.05), (-1.7, .05, 1.42), (-1.37, -.3, 1.24), (-1.05, -.4, 1.28), (-.75, -.39, 1.25),
                    NOZ + Vector((0, 0, .03))], .04, M_TUBE)
cyl("Nozzle", 4.5, 4, tuple(NOZ), M_NOZ)
clip = [box("ClipBody", 8, 19, 12, (-1.375, -.3, HC - .02), M_BLACK, bev=.8)]
for s_ in (-1, 1):
    clip.append(curve_tube("ClipHandle", [(-1.405, -.3 + s_ * .07, HC + .03), (-1.45, -.3 + s_ * .07, HC + .14), (-1.48, -.3 + s_ * .02, HC + .18)], .004, M_SILVER, res=2))
join("BinderClip", clip)

# ================= wires =================
wires = []
# probe cable: from the plug on the probe, up over the front-right rim, down to the breadboard
for top_, key, c in zip(PLUG_TOP, ("probe_gnd", "probe_vcc", "probe_out"), ("black", "red", "yellow")):
    end = PLUG_W[key]
    wires.append(wire("ProbeWire", [top_, top_ + Vector((0, 0, .2)), Vector((top_.x + .3, -.95, 1.42)), Vector((1.28, -1.02, 1.2)),
                                    Vector((end.x + .04, end.y + .08, .45)), end + Vector((0, 0, .15)), end], c))
# temp-probe cable: black jacket out of the soil, over the front rim, splitting into 3 tinned wires at the breadboard
split = xf(M_BB, hole(28, "a")) + Vector((0, .12, -.055))
wires.append(curve_tube("DsCable", [DS_TOP, DS_TOP + Vector((0, -.02, .35)), Vector((1.3, -.98, 1.3)), Vector((1.4, -1.1, .7)), Vector((split.x + .1, split.y + .05, .2)), split],
                        .02, M_CABLE))
for col, c in ((26, "red"), (28, "yellow"), (30, "black")):
    h = xf(M_BB, hole(col, "a"))
    wires.append(wire("DsWire", [split, split + Vector((0, 0, .05)), h + Vector((0, 0, .1)), h + Vector((0, 0, .02))], c, r=.006))
    wires.append(curve_tube("DsTin", [tuple(h + Vector((0, 0, .025))), tuple(h + Vector((0, 0, -.002)))], .003, M_SILVER, res=2))
# relay header to the breadboard
for top_, key, c in zip(REL_TOPS, ("relay_vcc", "relay_gnd", "relay_in"), ("red", "black", "blue")):
    end = PLUG_W[key]
    wires.append(wire("RelayWire", [top_, top_ + Vector((0, 0, .15)), (top_ + end) / 2 + Vector((0, 0, .45)), end + Vector((0, 0, .2)), end], c))
# pump: red to the relay's COM terminal, black to ground; supply red into NO
for k, (c, dx) in enumerate((("red", -.03), ("black", .03))):
    start = Vector((CX - .04 + dx, CY + .03, .36))
    path = [start, start + Vector((0, .05, .5)), Vector((CX + dx, CY + .45, .98)), Vector((-1.9, 1.25, .02)), Vector((0, 1.13 + dx, .012)),
            Vector((1.5, 1.2 + dx, .012)), Vector((1.75, .2, .012)), Vector((2.45, -.9 + dx, .012))]
    if c == "red":
        path += [REL_TERM[1] + Vector((.25, 0, .0)), REL_TERM[1]]
    else:
        path += [Vector((2.3, -1.12, .012)), PLUG_W["relay_gnd"] + Vector((.1, .1, 0)), PLUG_W["relay_gnd"] + Vector((0, 0, .15))]
    wires.append(wire("PumpWire", path, c, r=.007))
wires.append(wire("SupplyWire", [REL_TERM[0], REL_TERM[0] + Vector((.2, 0, 0)), Vector((2.35, -1.7, .02)), PLUG_W["relay_vcc"] + Vector((.15, -.2, 0)),
                                 PLUG_W["relay_vcc"] + Vector((0, 0, .12))], "red", r=.007))
join("Wires", wires)
