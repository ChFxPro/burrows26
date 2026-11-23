"""Headless: keep scattered trees off the road the car actually drives.

The tree scatter clears around a stored route line (road_d), but the car drives up to
~8 m off that line, so trees landed in the road and cut through the car in close-ups.
This builds 'Car_Path' (a polyline of every car position on the route) and removes any
tree point within CLEAR_KM of it, measured in plan view so steep banks don't fool it.

Run on the long-version scene (burrows_wnc_route_tour.blend); re-run make_cut30.py after.
Safe to re-run.
"""
import bpy
import numpy as np
D = bpy.data
sc = bpy.context.scene
CLEAR_KM = 0.024          # road half-width (~7 m) + widest canopy radius (~10 m) + margin

# --- Car_Path: one vertex per frame of the drive, joined by edges, flattened to z=0 ---
car = D.objects["Burrows_Vehicle"]
loc = {}
for layer in car.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                if fc.data_path == "location":
                    loc[fc.array_index] = fc
frames = np.arange(sc.frame_start, sc.frame_end + 1, 0.25)
pts = np.array([[loc[0].evaluate(f), loc[1].evaluate(f), 0.0] for f in frames], np.float32)
keep = np.r_[True, np.linalg.norm(np.diff(pts, axis=0), axis=1) > 1e-5]   # drop parked frames
pts = pts[keep]
old = D.objects.get("Car_Path")
if old:
    D.objects.remove(old, do_unlink=True)
me = D.meshes.get("Car_Path") or D.meshes.new("Car_Path")
me.clear_geometry()
me.from_pydata(pts.tolist(), [(i, i + 1) for i in range(len(pts) - 1)], [])
path = D.objects.new("Car_Path", me)
D.collections["Map"].objects.link(path)
path.hide_render = True; path.hide_viewport = True

# --- TreeScatter: delete points near Car_Path ---
g = D.node_groups["TreeScatter"]
N, L = g.nodes, g.links
def node(t, name, x, y):
    n = N.get(name) or N.new(t); n.name = n.label = name; n.location = (x, y); return n
info = node("GeometryNodeObjectInfo", "CP_Info", -400, -900)
info.inputs["Object"].default_value = path
info.transform_space = 'RELATIVE'
pos = node("GeometryNodeInputPosition", "CP_Pos", -400, -1100)
flat = node("ShaderNodeVectorMath", "CP_Flat", -200, -1100); flat.operation = 'MULTIPLY'
flat.inputs[1].default_value = (1.0, 1.0, 0.0)
prox = node("GeometryNodeProximity", "CP_Proximity", 0, -950)
prox.target_element = 'EDGES'
near = node("ShaderNodeMath", "CP_Near", 200, -950); near.operation = 'LESS_THAN'
near.inputs[1].default_value = CLEAR_KM
either = node("ShaderNodeMath", "CP_DeleteEither", 400, -800); either.operation = 'MAXIMUM'
L.new(info.outputs["Geometry"], prox.inputs[0])
L.new(pos.outputs[0], flat.inputs[0])
L.new(flat.outputs[0], prox.inputs["Sample Position"])
L.new(prox.outputs["Distance"], near.inputs[0])
dele = N["Delete Geometry"]
forest = N["Forest2_notforest"]
L.new(forest.outputs[0], either.inputs[0])
L.new(near.outputs[0], either.inputs[1])
L.new(either.outputs[0], dele.inputs["Selection"])

bpy.ops.wm.save_mainfile()
print("CLEAR_OK path verts", len(pts), "clearance m", CLEAR_KM * 1000)
