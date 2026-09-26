# probe: capacitive v1.2, true to size (2.3 x 9.8 cm board: 7 cm in the soil, 2.8 cm above), pressed against the
# front wall (-Y) so it shows through the clear plastic, the way growers use clear pots to watch roots
M_PCB = bpy.data.materials.new("ProbePCB"); M_PCB.use_nodes = True
pn = M_PCB.node_tree; pb = pn.nodes["Principled BSDF"]; pb.inputs["Roughness"].default_value = .35
ti = pn.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(os.path.normpath(os.path.join(TEX, "probe_pcb.png")))
pn.links.new(ti.outputs["Color"], pb.inputs["Base Color"])
BOARD_H, IN_SOIL, BOARD_W = .98, .70, .23
yz = H - IN_SOIL + BOARD_H / 2
ry = -(R_BOT + (R_TOP - R_BOT) * (H - IN_SOIL / 2) / H) + .045
bpy.ops.mesh.primitive_cube_add(size=1, location=(.25, ry, yz))
probe = bpy.context.active_object; probe.name = "Probe"; probe.scale = (BOARD_W, .016, BOARD_H); probe.data.materials.append(M_PCB)
bpy.ops.object.transform_apply(scale=True)
me = probe.data
if not me.uv_layers: me.uv_layers.new(name="UVMap")
uvl = me.uv_layers.active.data
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        if poly.normal.y < -.9:
            uvl[li].uv = ((co.x + BOARD_W / 2) / BOARD_W, (co.z + BOARD_H / 2) / BOARD_H)
        else:
            uvl[li].uv = (.02, .5)   # sides and back: the plain black board edge
bpy.ops.mesh.primitive_cube_add(size=1, location=(.25, ry - .002, H + .02))
band = bpy.context.active_object; band.name = "ProbeBand"; band.scale = (BOARD_W + .01, .02, .018); band.data.materials.append(M_BAND)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.mesh.primitive_uv_sphere_add(radius=.016, location=(.25 + .07, ry - .012, H + .25))
led = bpy.context.active_object; led.name = "ProbeLED"; led.data.materials.append(M_LED); bpy.ops.object.shade_smooth()

# 3-wire jumper cable out of the header
for k, (col, dx) in enumerate(((srgb("#c43b2f"), -.06), (srgb("#1c1c1c"), 0), (srgb("#e0b83a"), .06))):
    cm = mat(f"Wire{k}", col, .5)
    cv = bpy.data.curves.new(f"WireC{k}", "CURVE"); cv.dimensions = "3D"; cv.bevel_depth = .012; cv.bevel_resolution = 4
    spw = cv.splines.new("BEZIER"); spw.bezier_points.add(2)
    for bpt, co in zip(spw.bezier_points, [(.25 + dx, ry, H + .3), (.3 + dx, ry - .3, H + .75), (1.6 + dx, -1.6, .05)]):
        bpt.co = co; bpt.handle_left_type = bpt.handle_right_type = "AUTO"
    wo = bpy.data.objects.new(f"Wire{k}", cv); bpy.context.collection.objects.link(wo); wo.data.materials.append(cm)
    bpy.ops.object.select_all(action="DESELECT"); wo.select_set(True); bpy.context.view_layer.objects.active = wo
    bpy.ops.object.convert(target="MESH")

# potting-mix surface: crumbs of soil and white perlite bits on top
import random
random.seed(7)
M_PERL = mat("Perlite", srgb("#eceae4"), .8)
for i in range(420):
    a = random.random() * 2 * math.pi; rr = math.sqrt(random.random()) * (R_TOP - .1)
    perl = random.random() < .16
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=(.022 if perl else .03) * (0.6 + random.random() * .8),
                                          location=(math.cos(a) * rr, math.sin(a) * rr, H + .005))
    c = bpy.context.active_object; c.name = f"Crumb{i}"
    c.scale = (1, .8 + random.random() * .5, .55 + random.random() * .3)
    c.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
    c.data.materials.append(M_PERL if perl else M_REAL)
bpy.ops.object.select_all(action="DESELECT")
crumbs = [o for o in bpy.data.objects if o.name.startswith("Crumb")]
for o in crumbs: o.select_set(True)
bpy.context.view_layer.objects.active = crumbs[0]; bpy.ops.object.join(); crumbs[0].name = "Crumbs"

