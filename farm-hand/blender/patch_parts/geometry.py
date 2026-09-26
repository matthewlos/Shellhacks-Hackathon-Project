def frustum(name, r0, r1, y0, y1, material, segs=128, full=True):
    """Solid cone slice. full=True: the whole round body; full=False: back half with a flat cut face."""
    bm = bmesh.new(); ring0, ring1 = [], []
    n = segs if full else segs + 1
    for i in range(n):
        a = (2 * math.pi if full else math.pi) * i / segs
        ring0.append(bm.verts.new((math.cos(a) * r0, math.sin(a) * r0, y0)))
        ring1.append(bm.verts.new((math.cos(a) * r1, math.sin(a) * r1, y1)))
    m = n if full else n - 1
    for i in range(m):
        j = (i + 1) % n
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bm.faces.new(ring1); bm.faces.new(ring0[::-1])
    if not full:
        bm.faces.new((ring0[0], ring1[0], ring1[-1], ring0[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return ob

def half_frustum(name, r0, r1, y0, y1, material, segs=96, cap=True):
    return frustum(name, r0, r1, y0, y1, material, segs, full=True)

def shell(name, r0, r1, y0, y1, material, segs=128):
    """Open round container: wall + floor, thickness from a solidify modifier (a clear plastic bowl)."""
    bm = bmesh.new(); ring0, ring1 = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ring0.append(bm.verts.new((math.cos(a) * r0, math.sin(a) * r0, y0)))
        ring1.append(bm.verts.new((math.cos(a) * r1, math.sin(a) * r1, y1)))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bm.faces.new(ring0[::-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    mod = ob.modifiers.new("thick", "SOLIDIFY"); mod.thickness = .045; mod.offset = 1
    bev = ob.modifiers.new("soft", "BEVEL"); bev.width = .01; bev.segments = 2
    for p in me.polygons: p.use_smooth = True
    return ob

