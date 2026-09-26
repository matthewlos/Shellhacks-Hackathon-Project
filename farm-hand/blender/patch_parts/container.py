# clear plastic container. Its shape is set by R_TOP / R_BOT / H: match these to the real bowl.
shell("Pot", R_BOT + .01, R_TOP + .01, -.06, H + .35, M_POT)
bpy.ops.mesh.primitive_torus_add(major_radius=R_TOP + .055, minor_radius=.035, major_segments=128, minor_segments=16, location=(0, 0, H + .35))
rim = bpy.context.active_object; rim.name = "Rim"; rim.data.materials.append(M_POT); bpy.ops.object.shade_smooth()

