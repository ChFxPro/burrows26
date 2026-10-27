"""Headless: Cycles multipass setup — light groups, utility passes, cryptomatte, overlay view layer,
resumable multilayer EXR output. Compositing is moved to a separate comp file."""
import bpy, sys
D = bpy.data; sc = bpy.context.scene
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
EXR_DIR = argv[0] if argv else "//renders/exr/"

# ---------- light groups ----------
GROUPS = ["Sun", "Moon", "Sky", "CarLights", "TownLights", "Graphics"]
vl_main = sc.view_layers[0]; vl_main.name = "Main"
existing = {lg.name for lg in vl_main.lightgroups}
for g in GROUPS:
    if g not in existing: vl_main.lightgroups.add(name=g)
D.objects["Sun"].lightgroup = "Sun"
D.objects["Moon"].lightgroup = "Moon"
sc.world.lightgroup = "Sky"
for nm in ("Headbeam_1", "Headbeam_-1"):
    if nm in D.objects: D.objects[nm].lightgroup = "CarLights"
sub = [c for c in D.collections if c.name.startswith("Subaru")][0]
for o in sub.all_objects:
    if o.type != 'MESH': continue
    mats = {s.material.name for s in o.material_slots if s.material}
    if mats & {"front_white_light", "back_red_Light", "orange_Light223"}: o.lightgroup = "CarLights"
for o in D.collections["Corridor_HiRes"].objects: o.lightgroup = "TownLights"   # only their town-light instances emit
for cn in ("Labels", "Town_Pins", "Route", "County_Borders"):
    for o in D.collections[cn].all_objects: o.lightgroup = "Graphics"
for nm in ("Vehicle_Beacon", "Beacon_Cone", "Beacon_Ball"):
    if nm in D.objects: D.objects[nm].lightgroup = "Graphics"
# sign/logo/plate emission is tiny; keep with the car body (no group needed for non-emitters)

# ---------- utility passes on Main ----------
vl = vl_main
for a in ("use_pass_z", "use_pass_mist", "use_pass_normal", "use_pass_vector", "use_pass_diffuse_direct", "use_pass_diffuse_indirect",
          "use_pass_diffuse_color", "use_pass_glossy_direct", "use_pass_glossy_indirect", "use_pass_glossy_color",
          "use_pass_emit", "use_pass_environment", "use_pass_ambient_occlusion",
          "use_pass_cryptomatte_object", "use_pass_cryptomatte_material", "use_pass_cryptomatte_asset"):
    if hasattr(vl, a): setattr(vl, a, True)
vl.pass_cryptomatte_depth = 6
vl.cycles.denoising_store_passes = True
vl.cycles.use_denoising = True

# ---------- overlay view layer: graphics only, map/car as holdout so occlusion is correct ----------
ov = sc.view_layers.get("Overlays") or sc.view_layers.new("Overlays")
GRAPHICS = {"Labels", "Town_Pins", "Route", "County_Borders"}
def walk(lc, fn):
    fn(lc)
    for ch in lc.children: walk(ch, fn)
def set_main(lc):
    if lc.name in GRAPHICS: lc.exclude = True
def set_ov(lc):
    if lc.name == ov.layer_collection.name: return
    if lc.name in GRAPHICS: lc.exclude = False; lc.holdout = False
    elif lc.name == "Tree_Assets": lc.exclude = False
    else: lc.holdout = True
walk(vl_main.layer_collection, set_main)
walk(ov.layer_collection, set_ov)
# beacon lives in the vehicle collection: hide it from Main via object visibility per layer is not possible,
# so move it to the Route collection (graphics)
bc = D.objects.get("Vehicle_Beacon")
if bc:
    for o in [bc] + list(bc.children):
        for c in list(o.users_collection): c.objects.unlink(o)
        D.collections["Route"].objects.link(o)
ov.use_pass_cryptomatte_object = True; ov.pass_cryptomatte_depth = 4
ov.cycles.use_denoising = True
ov.samples = 16 if hasattr(ov, "samples") else None

# ---------- output: resumable multilayer EXR, compositing deferred to the comp file ----------
r = sc.render
r.use_compositing = False
r.use_sequencer = False
im = r.image_settings
try: im.media_type = 'MULTI_LAYER_IMAGE'
except Exception: pass
im.file_format = 'OPEN_EXR_MULTILAYER'
im.color_depth = '16'
try: im.exr_codec = 'DWAA'
except Exception: im.exr_codec = 'ZIP'
r.filepath = EXR_DIR + "burrows_"
r.use_overwrite = False
r.use_placeholder = True
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.use_motion_blur = False   # vector pass -> motion blur in comp
bpy.ops.wm.save_mainfile()
print("PASSES_OK", [lg.name for lg in vl_main.lightgroups], r.filepath)
