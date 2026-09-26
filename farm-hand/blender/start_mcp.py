"""Run inside Blender at launch: enable the Blender MCP addon and start its socket server (port 9876)."""
import addon_utils, bpy
addon_utils.enable("blender_mcp_addon", default_set=True, persistent=True)
def _start():
    try:
        bpy.ops.blendermcp.start_server()
        print("[farmhand] Blender MCP server started on 9876")
    except Exception as e:
        print("[farmhand] could not start MCP server:", e)
    return None
bpy.app.timers.register(_start, first_interval=2.0)
