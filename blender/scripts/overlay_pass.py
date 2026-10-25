"""Render-time only (not saved): EEVEE pass of the graphics layer with map/car as holdout -> RGBA PNG."""
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.view_layers["Main"].use = False; sc.view_layers["Overlays"].use = True
sc.render.film_transparent = True
sc.eevee.taa_render_samples = 16
sc.render.use_compositing = False
im = sc.render.image_settings
try: im.media_type = 'IMAGE'
except Exception: pass
im.file_format = 'PNG'; im.color_mode = 'RGBA'; im.color_depth = '16'
sc.render.filepath = a[0]
sc.render.use_overwrite = False; sc.render.use_placeholder = True
if len(a) > 2: sc.frame_start, sc.frame_end = int(a[1]), int(a[2])

# only terrain + car need to occlude graphics: drop trees, town lights, strips, roads, clouds from this pass
D = bpy.data
for o in D.collections["Corridor_HiRes"].objects:
    if o.animation_data: o.animation_data_clear()
    for m in o.modifiers: m.show_render = False
def walk(lc, fn):
    fn(lc)
    for ch in lc.children: walk(ch, fn)
DROP = {"Roadside_HiRes", "Roads", "Tree_Assets", "Valley_Fog"}
def trim(lc):
    if lc.name in DROP: lc.exclude = True
walk(sc.view_layers["Overlays"].layer_collection, trim)
for o in D.objects:
    if o.name.startswith("Cloud_Deck"):
        if o.animation_data: o.animation_data_clear()
        o.hide_render = True
sc.eevee.taa_render_samples = 8
for l in D.lights: l.use_shadow = False
for a in ("use_raytracing", "use_shadows", "use_gtao", "use_volumetric_shadows"):
    if hasattr(sc.eevee, a): setattr(sc.eevee, a, False)
