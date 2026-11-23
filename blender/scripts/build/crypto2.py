import bpy
bpy.context.scene.view_layers["Main"].pass_cryptomatte_depth = 2
bpy.ops.wm.save_mainfile(); print("CRYPTO2_OK")
