"""Headless: slim the Cycles EXR to what the comp needs; overlays move to a separate EEVEE pass."""
import bpy
sc = bpy.context.scene
main = sc.view_layers["Main"]; ov = sc.view_layers["Overlays"]
for a in ("use_pass_diffuse_direct", "use_pass_diffuse_indirect", "use_pass_diffuse_color", "use_pass_glossy_direct",
          "use_pass_glossy_indirect", "use_pass_glossy_color", "use_pass_emit", "use_pass_environment",
          "use_pass_ambient_occlusion", "use_pass_cryptomatte_asset"):
    setattr(main, a, False)
main.pass_cryptomatte_depth = 4
# Graphics collections are excluded from Main, so that light group is empty
for lg in list(main.lightgroups):
    if lg.name == "Graphics": main.lightgroups.remove(lg)
ov.use = False                                      # Cycles renders only the photoreal plate
ov.use_pass_cryptomatte_object = False
bpy.ops.wm.save_mainfile()
print("SLIM_OK", [lg.name for lg in main.lightgroups])
