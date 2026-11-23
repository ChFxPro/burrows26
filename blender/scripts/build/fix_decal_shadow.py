import bpy
n = 0
for o in bpy.data.objects:
    if o.name.startswith(("Burrows_Decal", "Burrows_Sign_Logo", "Logo_")):
        o.visible_shadow = False; n += 1
bpy.ops.wm.save_mainfile(); print("DECAL_OK", n)
