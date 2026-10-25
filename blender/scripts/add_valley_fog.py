"""Headless: stacked translucent fog slices — valley pockets + an edge fog bank that hides the map tile borders.
Cheap stand-in for volumetrics in Cycles. Strength is keyed per shot (wide = full, high aerial = partial, close = off)."""
import bpy, json, math
import numpy as np
D = bpy.data; sc = bpy.context.scene
OUT = "/private/tmp/claude-501/-Users-jeffbannister-Code-burrows26--claude-worktrees-burrows-vehicle-scene-nc-3161ff/bacd06af-2e64-4e0c-bebd-15b29cb5b4c0/scratchpad/out"
vec = json.load(open(f"{OUT}/vectors.json")); WKM, HKM = vec["map"]["w"], vec["map"]["h"]
C0, C1 = int(sc["chase0"]), int(sc["chase1"])

# slice heights (scene units; terrain z = (elev-280 m)/1000*2): valley layer + taller edge bank
VALLEY = np.round(np.arange(0.10, 1.85, 0.1), 3)            # 18 slices
EDGE = np.array([])                                          # edge bank removed
DZ = 0.07

# ---------- material ----------
m = D.materials.get("MAT_FogSlice") or D.materials.new("MAT_FogSlice"); m.use_nodes = True
nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
if nt.animation_data: nt.animation_data_clear()
out = N.new("ShaderNodeOutputMaterial")
geo = N.new("ShaderNodeNewGeometry")
sp = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sp.inputs[0])
X, Y, Z = sp.outputs["X"], sp.outputs["Y"], sp.outputs["Z"]
def mth(op, a, b=None, c=None):
    n = N.new("ShaderNodeMath"); n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: L.new(v, n.inputs[i])
    return n.outputs[0]
def smooth(v, a, b):
    n = N.new("ShaderNodeMapRange"); n.interpolation_type = 'SMOOTHSTEP'
    n.inputs["From Min"].default_value = a; n.inputs["From Max"].default_value = b
    L.new(v, n.inputs["Value"]); return n.outputs["Result"]
# drifting pocket noise (large) x fine wisps
drift = N.new("ShaderNodeMapping"); drift.name = "Drift"; L.new(geo.outputs["Position"], drift.inputs["Vector"])
drift.inputs["Scale"].default_value = (1, 1, 2.2)
big = N.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 0.16; big.inputs["Detail"].default_value = 4; big.inputs["Roughness"].default_value = 0.55
L.new(drift.outputs[0], big.inputs["Vector"])
fine = N.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 1.4; fine.inputs["Detail"].default_value = 6; fine.inputs["Roughness"].default_value = 0.6
L.new(drift.outputs[0], fine.inputs["Vector"])
pockets = smooth(big.outputs["Fac"], 0.40, 0.62)
wisp = mth('ADD', mth('MULTIPLY', fine.outputs["Fac"], 0.7), 0.55)
# height: dense on the valley floors, thinning upward
hfall = smooth(Z, 1.75, 0.15)
valley = mth('MULTIPLY', mth('MULTIPLY', mth('ADD', mth('MULTIPLY', pockets, 0.85), 0.15), hfall), wisp)
# edge bank: distance to the map border
dx = mth('SUBTRACT', WKM / 2, mth('ABSOLUTE', X)); dy = mth('SUBTRACT', HKM / 2, mth('ABSOLUTE', Y))
de = mth('MINIMUM', dx, dy)
big2 = N.new("ShaderNodeTexNoise"); big2.inputs["Scale"].default_value = 0.09; big2.inputs["Detail"].default_value = 5
L.new(drift.outputs[0], big2.inputs["Vector"])
fade_out = smooth(de, -7.0, -1.5)                      # dissolve beyond the border instead of a flat mat
breakup = mth('ADD', mth('MULTIPLY', smooth(big2.outputs["Fac"], 0.32, 0.62), 0.7), 0.3)
edge = mth('MULTIPLY', mth('MULTIPLY', smooth(de, 8.0, 0.5), smooth(Z, 4.0, 2.6)), mth('MULTIPLY', fade_out, breakup))
edge = mth('MULTIPLY', edge, mth('ADD', mth('MULTIPLY', fine.outputs["Fac"], 0.5), 0.75))
# no edge bank any more (outer terrain continues to the horizon); fade the fog well before its own slice edges
dox = mth('SUBTRACT', 185.0, mth('ABSOLUTE', X)); doy = mth('SUBTRACT', 135.0, mth('ABSOLUTE', Y))
outer_fade = smooth(mth('MINIMUM', dox, doy), 0.0, 30.0)
dens = mth('MULTIPLY', valley, outer_fade)
amt = N.new("ShaderNodeValue"); amt.name = "FogAmount"; amt.outputs[0].default_value = 1.0
per = N.new("ShaderNodeValue"); per.name = "PerSlice"; per.outputs[0].default_value = 0.17
alpha = mth('MINIMUM', mth('MULTIPLY', mth('MULTIPLY', dens, amt.outputs[0]), per.outputs[0]), 0.9)
# soft, lit fog: white diffuse + translucency, tinted per time of day
col = N.new("ShaderNodeRGB"); col.name = "FogColor"; col.outputs[0].default_value = (0.92, 0.93, 0.96, 1)
pb = N.new("ShaderNodeBsdfPrincipled"); pb.inputs["Roughness"].default_value = 1.0; pb.inputs["Specular IOR Level"].default_value = 0.0
L.new(col.outputs[0], pb.inputs["Base Color"])
tl = N.new("ShaderNodeBsdfTranslucent"); L.new(col.outputs[0], tl.inputs["Color"])
lit = N.new("ShaderNodeMixShader"); lit.inputs[0].default_value = 0.45; L.new(pb.outputs[0], lit.inputs[1]); L.new(tl.outputs[0], lit.inputs[2])
tr = N.new("ShaderNodeBsdfTransparent")
mix = N.new("ShaderNodeMixShader"); L.new(alpha, mix.inputs[0]); L.new(tr.outputs[0], mix.inputs[1]); L.new(lit.outputs[0], mix.inputs[2])
L.new(mix.outputs[0], out.inputs["Surface"])

# ---------- slice objects (one shared mesh) ----------
col_ = D.collections.get("Valley_Fog") or D.collections.new("Valley_Fog")
if col_.name not in D.collections["Map"].children: D.collections["Map"].children.link(col_)
for o in list(col_.objects): D.objects.remove(o, do_unlink=True)
me = D.meshes.get("FogSlice_Wide") or D.meshes.new("FogSlice_Wide")
if not me.vertices:
    sx, sy = 190.0, 140.0
    me.from_pydata([(-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0)], [], [(0, 1, 2, 3)])
    me.materials.append(m)
for k, z in enumerate(list(VALLEY) + list(EDGE)):
    o = D.objects.new(f"FogSlice_{k:02d}", me); o.location = (0, 0, float(z)); col_.objects.link(o)
    o.visible_shadow = False
    try: o.visible_volume_scatter = False
    except Exception: pass

# ---------- per-frame strength: wide shots full, high aerials partial, low chase/close-ups off ----------
def fcs(idb):
    act = idb.animation_data.action
    return list(act.fcurves) if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
F = np.arange(sc.frame_start, sc.frame_end + 1)
ch = D.objects["CAM_Chase"]; car = D.objects["Burrows_Vehicle"]
cz = {fc.array_index: fc for fc in fcs(ch) if fc.data_path == "location"}
pz = {fc.array_index: fc for fc in fcs(car) if fc.data_path == "location"}
hgt = np.array([cz[2].evaluate(f) - pz[2].evaluate(f) for f in F])
cu = np.zeros(len(F), bool)
ms = sorted((mk.frame, mk.camera.name) for mk in sc.timeline_markers)
for (f0, nm), nxt in zip(ms, ms[1:] + [(sc.frame_end + 1, None)]):
    if nm.startswith("CAM_CU"): cu[(F >= f0) & (F < nxt[0])] = True
wide = (F < C0) | (F >= C1)
aerial = np.clip((hgt - 0.7) / 1.4, 0, 0.55)
# wide shots only, and only as the cloud deck clears (clouds + fog together are very slow to render)
cd = D.materials["MAT_CloudDeck"].node_tree; rvn = cd.nodes["Reveal"]
rvf = [fc for fc in fcs(cd) if fc.data_path == rvn.outputs[0].path_from_id("default_value")][0]
rev = np.array([rvf.evaluate(f) for f in F])
a = np.where(wide, np.clip(1.0 - rev * 1.6, 0.0, 1.0), 0.0)
a = np.convolve(np.pad(a, (12, 12), mode='edge'), np.ones(25) / 25, 'valid')
a = np.where(cu, 0.0, a)
amt_n = nt.nodes["FogAmount"]
for i in range(0, len(F), 3):
    amt_n.outputs[0].default_value = float(a[i]); amt_n.outputs[0].keyframe_insert("default_value", frame=int(F[i]))
for f in (C0 - 1, C0, C1 - 1, C1):
    i = f - sc.frame_start; amt_n.outputs[0].default_value = float(a[i]); amt_n.outputs[0].keyframe_insert("default_value", frame=int(f))
# hide all slices when fog is off (saves render time)
off = a < 0.01
for o in col_.objects:
    prev = None
    for i in range(len(F)):
        v = bool(off[i])
        if v != prev: o.hide_render = v; o.keyframe_insert("hide_render", frame=int(F[i])); prev = v
# slow drift
dn = nt.nodes["Drift"]
dn.inputs["Location"].default_value = (0, 0, 0); dn.inputs["Location"].keyframe_insert("default_value", frame=sc.frame_start)
dn.inputs["Location"].default_value = (6.0, 2.5, 0.3); dn.inputs["Location"].keyframe_insert("default_value", frame=sc.frame_end)
for fc in fcs(nt):
    if "Drift" in fc.data_path:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
# fog tint follows time of day: warm at dawn/dusk, blue at night (reuse the comp mist colour keys)
ct = sc.compositing_node_group
if ct and "MistColor" in ct.nodes:
    mc = ct.nodes["MistColor"]; mcf = {fc.array_index: fc for fc in fcs(ct) if fc.data_path == mc.outputs[0].path_from_id("default_value")}
    cn = nt.nodes["FogColor"]
    for f in range(sc.frame_start, sc.frame_end + 1, 6):
        c = [mcf[i].evaluate(f) for i in range(3)]
        lum = sum(c) / 3
        c = [min(1.0, 0.55 * ci / max(lum, 1e-3) * 0.95 + 0.4) if lum > 0.2 else ci * 3 for ci in c]
        cn.outputs[0].default_value = (*c, 1); cn.outputs[0].keyframe_insert("default_value", frame=f)
sc.cycles.transparent_max_bounces = max(sc.cycles.transparent_max_bounces, 48)
bpy.ops.wm.save_mainfile()
print("FOG_OK", len(col_.objects), "wide", int(wide.sum()), "aerial_frames", int(((a > 0.01) & ~wide).sum()))
