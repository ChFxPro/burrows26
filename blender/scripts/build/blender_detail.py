"""Roadside 0.6 m strips, tree road-clearance + autumn forest test, town lights, close-up cameras and the edit."""
import bpy, math, json, os
import numpy as np
D = bpy.data; sc = bpy.context.scene
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "source", "out")  # build data (scripts/build/prep*.py write it)
SD = f"{OUT}/strips"

def coll(name, parent=None):
    c = D.collections.get(name) or D.collections.new(name)
    p = parent or sc.collection
    if c.name not in p.children: p.children.link(c)
    return c

# ---------- 1. roadside strips ----------
col = coll("Roadside_HiRes", D.collections["Map"])
for o in list(col.objects):
    me = o.data; mats = list(me.materials); D.objects.remove(o, do_unlink=True); D.meshes.remove(me)
    for m in mats:
        if m and m.users == 0:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image and n.image.users <= 1: D.images.remove(n.image)
            D.materials.remove(m)
tmpl = D.materials.get("MAT_StripTemplate")
if not tmpl:
    tmpl = D.materials.new("MAT_StripTemplate"); tmpl.use_nodes = True
    nt = tmpl.node_tree; N = nt.nodes; L = nt.links
    b = N["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.92; b.inputs["Specular IOR Level"].default_value = 0.15
    tx = N.new("ShaderNodeTexImage"); tx.name = "StripTex"; tx.extension = 'EXTEND'; tx.interpolation = 'Cubic'
    L.new(tx.outputs["Color"], b.inputs["Base Color"])
    uv = N.new("ShaderNodeUVMap"); sp = N.new("ShaderNodeSeparateXYZ"); L.new(uv.outputs["UV"], sp.inputs[0])
    e1 = N.new("ShaderNodeMapRange"); e1.interpolation_type = 'SMOOTHSTEP'; e1.inputs["From Min"].default_value = 0.0; e1.inputs["From Max"].default_value = 0.28
    e2 = N.new("ShaderNodeMapRange"); e2.interpolation_type = 'SMOOTHSTEP'; e2.inputs["From Min"].default_value = 1.0; e2.inputs["From Max"].default_value = 0.72
    L.new(sp.outputs["Y"], e1.inputs["Value"]); L.new(sp.outputs["Y"], e2.inputs["Value"])
    m1 = N.new("ShaderNodeMath"); m1.operation = 'MULTIPLY'; L.new(e1.outputs["Result"], m1.inputs[0]); L.new(e2.outputs["Result"], m1.inputs[1])
    m2 = N.new("ShaderNodeMath"); m2.operation = 'MULTIPLY'; L.new(m1.outputs[0], m2.inputs[0]); L.new(tx.outputs["Alpha"], m2.inputs[1])
    L.new(m2.outputs[0], b.inputs["Alpha"])
    # fine canopy relief from the photo itself
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25; bump.inputs["Distance"].default_value = 0.0004
    L.new(tx.outputs["Color"], bump.inputs["Height"]); L.new(bump.outputs["Normal"], b.inputs["Normal"])
meta = json.load(open(f"{SD}/strips.json")) if os.path.exists(f"{SD}/strips.json") else {"strips": []}
for k in meta["strips"]:
    z = np.load(f"{SD}/strip_{k:03d}.npz"); xyz = z["xyz"]; uvv = z["uv"]
    na, nc = xyz.shape[:2]
    idx = np.arange(na * nc).reshape(na, nc)
    q = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], -1).astype(np.int32)
    me = D.meshes.new(f"Strip_{k:03d}")
    me.vertices.add(na * nc); me.vertices.foreach_set("co", xyz.reshape(-1).astype(np.float32))
    me.loops.add(len(q) * 4); me.loops.foreach_set("vertex_index", q.ravel())
    me.polygons.add(len(q)); me.polygons.foreach_set("loop_start", np.arange(0, len(q) * 4, 4, dtype=np.int32))
    me.uv_layers.new(name="UVMap").data.foreach_set("uv", uvv.reshape(-1, 2)[q.ravel()].ravel().astype(np.float32))
    me.polygons.foreach_set("use_smooth", np.ones(len(q), bool)); me.update()
    m = tmpl.copy(); m.name = f"MAT_Strip_{k:03d}"
    im = D.images.load(f"{SD}/strip_{k:03d}.png"); im.name = f"Strip_{k:03d}"
    m.node_tree.nodes["StripTex"].image = im
    me.materials.append(m)
    o = D.objects.new(f"Strip_{k:03d}", me); col.objects.link(o); o.visible_shadow = False

# ---------- 2. trees: clearance from every road + autumn-aware forest test ----------
for o in D.collections["Corridor_HiRes"].objects:
    i, j = o.name.split("_")[1:3]
    p = f"{OUT}/cells/roadall_{i}_{j}.npy"
    if os.path.exists(p):
        d = np.load(p)
        a = o.data.attributes.get("roadall_d") or o.data.attributes.new("roadall_d", 'FLOAT', 'POINT')
        a.data.foreach_set("value", d)
ng = D.node_groups["TreeScatter"]; N = ng.nodes; L = ng.links
def S(socks, name):
    m = [x for x in socks if x.name == name and x.enabled] or [x for x in socks if x.name == name]
    return m[0]
dist_n = [n for n in N if n.bl_idname == "GeometryNodeDistributePointsOnFaces"][0]
mask_n = dist_n.inputs["Density Factor"].links[0].from_node
if not N.get("RoadAll"):
    ra = N.new("GeometryNodeInputNamedAttribute"); ra.name = "RoadAll"; ra.data_type = 'FLOAT'; S(ra.inputs, "Name").default_value = "roadall_d"
    mr = N.new("ShaderNodeMapRange"); mr.name = "RoadAllClear"; mr.interpolation_type = 'SMOOTHSTEP'
    S(mr.inputs, "From Min").default_value = 0.022; S(mr.inputs, "From Max").default_value = 0.034
    L.new(S(ra.outputs, "Attribute"), S(mr.inputs, "Value"))
    mul = N.new("ShaderNodeMath"); mul.operation = 'MULTIPLY'; mul.name = "MaskAll"
    L.new(mask_n.outputs[0], mul.inputs[0]); L.new(S(mr.outputs, "Result"), mul.inputs[1])
    L.new(mul.outputs[0], dist_n.inputs["Density Factor"])
# replace the green-only forest test with: saturated (not grey pavement/roofs) and dark (not fields/grass)
sep = [n for n in N if n.bl_idname == "FunctionNodeSeparateColor"][0]
dele = [n for n in N if n.bl_idname == "GeometryNodeDeleteGeometry"][0]
for n in [n for n in N if n.name.startswith("Forest2_")]: N.remove(n)
def mth(op, a, b, name):
    n = N.new("ShaderNodeMath"); n.operation = op; n.name = "Forest2_" + name
    for i, v in enumerate((a, b)):
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: L.new(v, n.inputs[i])
    return n.outputs[0]
R, G, B = S(sep.outputs, "Red"), S(sep.outputs, "Green"), S(sep.outputs, "Blue")
mx = mth('MAXIMUM', mth('MAXIMUM', R, G, "mx1"), B, "mx")
mn = mth('MINIMUM', mth('MINIMUM', R, G, "mn1"), B, "mn")
sat = mth('SUBTRACT', mx, mn, "sat")
lum = mth('MULTIPLY', mth('ADD', mth('ADD', R, G, "l1"), B, "l2"), 0.3333, "lum")
ok = mth('MULTIPLY', mth('GREATER_THAN', mth('DIVIDE', sat, mth('ADD', mx, 0.02, "mxe"), "relsat"), 0.28, "satok"),
         mth('LESS_THAN', lum, 0.17, "dark"), "forest")
notf = mth('LESS_THAN', ok, 0.5, "notforest")
L.new(notf, S(dele.inputs, "Selection"))

# ---------- 3. town lights (night) ----------
lm = D.materials.get("MAT_TownLight") or D.materials.new("MAT_TownLight"); lm.use_nodes = True
lb = lm.node_tree.nodes["Principled BSDF"]
lb.inputs["Base Color"].default_value = (1, 0.75, 0.4, 1); lb.inputs["Emission Color"].default_value = (1, 0.72, 0.38, 1)
lt = D.node_groups.get("TownLights")
if lt: D.node_groups.remove(lt)
lt = D.node_groups.new("TownLights", 'GeometryNodeTree')
lt.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
lt.interface.new_socket("Image", in_out='INPUT', socket_type='NodeSocketImage')
lt.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
TN = lt.nodes; TL = lt.links
gi = TN.new("NodeGroupInput"); go = TN.new("NodeGroupOutput")
rd = TN.new("GeometryNodeInputNamedAttribute"); rd.data_type = 'FLOAT'; S(rd.inputs, "Name").default_value = "road_d"
near = TN.new("ShaderNodeMapRange"); near.interpolation_type = 'SMOOTHSTEP'
S(near.inputs, "From Min").default_value = 0.7; S(near.inputs, "From Max").default_value = 0.02
TL.new(S(rd.outputs, "Attribute"), S(near.inputs, "Value"))
dp = TN.new("GeometryNodeDistributePointsOnFaces"); dp.distribute_method = 'RANDOM'
S(dp.inputs, "Density").default_value = 900.0
TL.new(S(gi.outputs, "Geometry"), S(dp.inputs, "Mesh")); TL.new(S(near.outputs, "Result"), dp.inputs["Density Factor"])
uvn = TN.new("GeometryNodeInputNamedAttribute"); uvn.data_type = 'FLOAT_VECTOR'; S(uvn.inputs, "Name").default_value = "UVMap"
cap = TN.new("GeometryNodeSampleNearestSurface"); cap.data_type = 'FLOAT_VECTOR'
TL.new(S(gi.outputs, "Geometry"), S(cap.inputs, "Mesh")); TL.new(S(uvn.outputs, "Attribute"), S(cap.inputs, "Value"))
tx = TN.new("GeometryNodeImageTexture"); TL.new(S(gi.outputs, "Image"), S(tx.inputs, "Image")); TL.new(S(cap.outputs, "Value"), S(tx.inputs, "Vector"))
sp2 = TN.new("FunctionNodeSeparateColor"); TL.new(S(tx.outputs, "Color"), S(sp2.inputs, "Color"))
def tm(op, a, b):
    n = TN.new("ShaderNodeMath"); n.operation = op
    for i, v in enumerate((a, b)):
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: TL.new(v, n.inputs[i])
    return n.outputs[0]
r2, g2, b2 = S(sp2.outputs, "Red"), S(sp2.outputs, "Green"), S(sp2.outputs, "Blue")
lum2 = tm('MULTIPLY', tm('ADD', tm('ADD', r2, g2), b2), 0.3333)
sat2 = tm('SUBTRACT', tm('MAXIMUM', tm('MAXIMUM', r2, g2), b2), tm('MINIMUM', tm('MINIMUM', r2, g2), b2))
built = tm('MULTIPLY', tm('GREATER_THAN', lum2, 0.22), tm('LESS_THAN', sat2, 0.07))
dl = TN.new("GeometryNodeDeleteGeometry"); dl.domain = 'POINT'
TL.new(S(dp.outputs, "Points"), S(dl.inputs, "Geometry")); TL.new(tm('LESS_THAN', built, 0.5), S(dl.inputs, "Selection"))
ico = TN.new("GeometryNodeMeshIcoSphere"); S(ico.inputs, "Radius").default_value = 0.0016; S(ico.inputs, "Subdivisions").default_value = 1
sm = TN.new("GeometryNodeSetMaterial"); S(sm.inputs, "Material").default_value = lm
TL.new(S(ico.outputs, "Mesh"), S(sm.inputs, "Geometry"))
ip = TN.new("GeometryNodeInstanceOnPoints"); TL.new(S(dl.outputs, "Geometry"), S(ip.inputs, "Points")); TL.new(S(sm.outputs, "Geometry"), S(ip.inputs, "Instance"))
tr_ = TN.new("GeometryNodeTranslateInstances"); S(tr_.inputs, "Translation").default_value = (0, 0, 0.004)
TL.new(S(ip.outputs, "Instances"), S(tr_.inputs, "Instances"))
jn = TN.new("GeometryNodeJoinGeometry"); TL.new(S(tr_.outputs, "Instances"), S(jn.inputs, "Geometry")); TL.new(S(gi.outputs, "Geometry"), S(jn.inputs, "Geometry"))
TL.new(S(jn.outputs, "Geometry"), S(go.inputs, "Geometry"))
img_id = [x.identifier for x in lt.interface.items_tree if x.name == "Image"][0]
for o in D.collections["Corridor_HiRes"].objects:
    m = o.modifiers.get("TownLights") or o.modifiers.new("TownLights", 'NODES')
    m.node_group = lt; m[img_id] = D.images.get(o.name); m.show_viewport = False

# ---------- 4. close-up cameras riding with the car ----------
car = D.objects["Burrows_Vehicle"]
def rig_cam(name, loc, look, lens, fstop):
    cam = D.objects.get(name)
    if not cam:
        cd = D.cameras.new(name); cam = D.objects.new(name, cd); D.collections["Burrows_Vehicle"].objects.link(cam)
    tgt = D.objects.get(name + "_T") or D.objects.new(name + "_T", None)
    if tgt.name not in D.collections["Burrows_Vehicle"].objects: D.collections["Burrows_Vehicle"].objects.link(tgt)
    for o in (cam, tgt): o.parent = car; o.matrix_parent_inverse.identity()
    cam.location = loc; tgt.location = look
    cam.constraints.clear(); c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    cd = cam.data; cd.lens = lens; cd.clip_start = 0.0003; cd.clip_end = 300
    cd.dof.use_dof = True; cd.dof.focus_object = car; cd.dof.aperture_fstop = fstop
    return cam
# car local: +X forward, metres*0.0072 -> km; car ~0.033 long, 0.0126 tall
cams = {
    "CU_Front34": rig_cam("CAM_CU_Front34", (0.042, -0.026, 0.005), (0.0, 0.0, 0.0065), 55, 0.004),
    "CU_Side":    rig_cam("CAM_CU_Side", (0.004, -0.047, 0.0045), (0.004, 0.0, 0.0065), 45, 0.005),
    "CU_RearLow": rig_cam("CAM_CU_RearLow", (-0.046, 0.010, 0.0035), (0.01, 0.0, 0.0075), 35, 0.006),
    "CU_Sign":    rig_cam("CAM_CU_Sign", (-0.03, -0.012, 0.022), (-0.002, 0.0, 0.016), 60, 0.003),
}

# ---------- 5. the edit ----------
tr = D.objects["Route_Trail"].data; act = tr.animation_data.action
fcs = act.fcurves if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
fe = [f for f in fcs if f.data_path == "bevel_factor_end"][0]
rc = np.load(f"{OUT}/route_center.npy"); LR = float(np.sum(np.hypot(*np.diff(rc[:, :2], axis=0).T)))
frames = np.arange(1, sc.frame_end + 1); s_f = np.array([fe.evaluate(f) for f in frames]) * LR
C0, C1 = int(sc["chase0"]), int(sc["chase1"])
def at_km(km): return int(frames[np.argmin(np.abs(s_f - km))])
ov = D.objects["CAM_Overview"]; ch = D.objects["CAM_Chase"]
# (km, camera, seconds) — close-ups land in the slow town stretches
SHOTS = [(0.35, "CU_Front34", 2.5), (44.9, "CU_Side", 2.5), (79.8, "CU_Front34", 3.0),
         (89.0, "CU_RearLow", 3.0), (89.0 + 0.0, "CU_Sign", 0.0), (113.3, "CU_Side", 2.5), (128.6, "CU_Sign", 2.0)]
sc.timeline_markers.clear()
def mark(f, cam):
    m = sc.timeline_markers.new(f"cut_{cam.name}", frame=int(f)); m.camera = cam
mark(1, ov); mark(C0, ch)
for km_, key, secs in SHOTS:
    if secs <= 0: continue
    fc = at_km(km_); n = int(secs * sc.render.fps)
    f0 = max(C0 + 12, fc - n // 2); f1 = min(C1 - 12, f0 + n)
    mark(f0, cams[key]); mark(f1, ch)
mark(C1, ov)
EDIT = sorted((m.frame, m.camera.name) for m in sc.timeline_markers)
