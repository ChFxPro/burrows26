"""Run on the main .blend: dump per-frame mist colour/amount and shot ranges for the comp file."""
import bpy, json, sys
sc = bpy.context.scene
out = sys.argv[sys.argv.index("--") + 1]
ct = sc.compositing_node_group
mc = ct.nodes["MistColor"]; ma = ct.nodes["MistAmount"]
def fcs(idb):
    act = idb.animation_data.action
    return list(act.fcurves) if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
F = range(sc.frame_start, sc.frame_end + 1)
col_paths = {mc.outputs[0].path_from_id("default_value"): "col", ma.outputs[0].path_from_id("default_value"): "amt"}
curves = {}
for fc in fcs(ct):
    if fc.data_path in col_paths: curves[(col_paths[fc.data_path], fc.array_index)] = fc
data = {"frame_start": sc.frame_start, "frame_end": sc.frame_end, "fps": sc.render.fps,
        "chase0": int(sc["chase0"]), "chase1": int(sc["chase1"]),
        "mist_col": [[curves[("col", i)].evaluate(f) for i in range(3)] for f in F],
        "mist_amt": [curves[("amt", 0)].evaluate(f) for f in F],
        "exr": bpy.path.abspath(sc.render.filepath)}
json.dump(data, open(out, "w")); print("KEYS_OK", len(data["mist_amt"]))
