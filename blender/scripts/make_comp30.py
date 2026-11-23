"""Headless: make burrows_comp_30s.blend from burrows_comp.blend for the 30-second cut.

The comp's mist is keyed to the long timeline: MistAmount follows the shot/camera and
MistColor follows the time of day. Both are re-sampled with the same per-frame timing the
30-second scene uses (cut30_maps.json, written by make_cut30.py), so each shot keeps its haze.
Input paths and output are set at render time by comp_frames.py.

  Blender -b burrows_comp.blend --python make_comp30.py
"""
import bpy, json, os
D = bpy.data
sc = bpy.context.scene
HERE = os.path.dirname(bpy.data.filepath)
maps = json.load(open(os.path.join(HERE, "cut30_maps.json")))
TOTAL = len(maps["motion"])
nt = sc.compositing_node_group if getattr(sc, "compositing_node_group", None) else sc.node_tree

use_map = {'nodes["MistAmount"]': maps["motion"], 'nodes["MistColor"]': maps["light"]}
ad = nt.animation_data
for layer in ad.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                src = next((m for k, m in use_map.items() if fc.data_path.startswith(k)), None)
                if src is None:
                    raise SystemExit(f"unexpected comp curve {fc.data_path}")
                vals = [fc.evaluate(s) for s in src]
                kps = fc.keyframe_points
                kps.clear(); kps.add(TOTAL)
                co = []
                for i, v in enumerate(vals):
                    co += [i + 1, v]
                kps.foreach_set("co", co)
                for kp in kps:
                    kp.interpolation = 'LINEAR'
                fc.update()
                print("RETIMED", fc.data_path, fc.array_index)

for n in nt.nodes:
    if n.type == 'IMAGE' and n.image and n.image.source == 'SEQUENCE':
        n.frame_duration = TOTAL; n.frame_start = 1; n.frame_offset = 0
sc.frame_start, sc.frame_end = 1, TOTAL
sc.render.compositor_device = 'GPU'

# realism grade: per-shot exposure / dehaze / contrast / saturation + lens finish (realism_grade.py)
import sys
sys.path.insert(0, os.path.join(HERE, "scripts"))
import realism_grade
print("GRADED", realism_grade.apply(nt, maps))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "burrows_comp_30s.blend"))
print("COMP30_OK frames", TOTAL)
