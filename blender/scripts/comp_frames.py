"""Render-time (not saved): run the comp for one chunk of frames on the GPU, writing PNG frames.

  Blender -b comp.blend --python comp_frames.py -a -- OUT_PREFIX START END EXR_FIRST OV_FIRST

EXR_FIRST / OV_FIRST are frame 1 of the plate and overlay sequences. Chunks keep memory
flat: rendering the EXR sequence in one long run grew until macOS killed Blender (~frame 69).
"""
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
out, start, end, exr_first, ov_first = a[0], int(a[1]), int(a[2]), a[3], a[4]
sc = bpy.context.scene; r = sc.render
nt = sc.compositing_node_group if getattr(sc, "compositing_node_group", None) else sc.node_tree
for n in nt.nodes:
    if n.type == 'IMAGE' and n.image and n.image.source == 'SEQUENCE':
        n.image.filepath = exr_first if n.image.filepath.lower().endswith(".exr") else ov_first
        n.image.reload()
sc.frame_start, sc.frame_end = start, end
r.compositor_device = 'GPU'
r.filepath = out
im = r.image_settings
try: im.media_type = 'IMAGE'
except Exception: pass
im.file_format = 'PNG'; im.color_mode = 'RGB'; im.color_depth = '8'
r.use_overwrite = False; r.use_placeholder = True
print("COMP_CHUNK", start, end)
