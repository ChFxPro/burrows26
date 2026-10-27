import bpy, sys
p = sys.argv[sys.argv.index("--") + 1]
bpy.context.scene.render.filepath = p
bpy.ops.wm.save_mainfile(); print("OUT_OK", p)
