import bpy, math
from mathutils import Vector
scn = bpy.context.scene
cam_data = bpy.data.cameras.new("PreviewCam"); cam = bpy.data.objects.new("PreviewCam", cam_data); scn.collection.objects.link(cam)
cam.location = (2.2, -9.5, 3.6)
d = Vector((0, 0, 1.1)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 50; scn.camera = cam
sun = bpy.data.lights.new("PreviewSun", "SUN"); sun.energy = 3.5; so = bpy.data.objects.new("PreviewSun", sun); so.rotation_euler = (math.radians(50), math.radians(10), math.radians(30)); scn.collection.objects.link(so)
scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
scn.render.resolution_x, scn.render.resolution_y = 1200, 900
if scn.world is None: scn.world = bpy.data.worlds.new("W")
scn.world.use_nodes = True; scn.world.node_tree.nodes["Background"].inputs[0].default_value = (0.86, 0.89, 0.92, 1)
scn.render.filepath = r"C:\Users\User\Documents\code\shellhacks2025\farm-hand\blender\preview.png"
bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(cam); bpy.data.objects.remove(so)
print("rendered with", scn.render.engine)
