"""Atmosphere (haze, valley fog, edge fog, fog-clearing reveal) and a dawn-to-dawn lighting cycle."""
import bpy, math, json, os
import numpy as np
D = bpy.data; sc = bpy.context.scene
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "source", "out")  # build data (scripts/build/prep*.py write it)
vec = json.load(open(f"{OUT}/vectors.json")); WKM, HKM = vec["map"]["w"], vec["map"]["h"]
F_END = sc.frame_end
frames = np.arange(1, F_END + 1)

# distance along the route per frame (from the trail animation)
tr = D.objects["Route_Trail"].data; act = tr.animation_data.action
fcs = act.fcurves if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
fe = [f for f in fcs if f.data_path == "bevel_factor_end"][0]
rc = np.load(f"{OUT}/route_center.npy"); LR = float(np.sum(np.hypot(*np.diff(rc[:, :2], axis=0).T)))
s_f = np.array([fe.evaluate(f) for f in frames]) * LR
cuts = sorted(m.frame for m in sc.timeline_markers)
CHASE0, CHASE1 = cuts[1], cuts[2]

# ---------- time of day as a function of route km ----------
#            km    sun elevation (deg)   sun azimuth (deg, compass: 90=E, 180=S, 270=W)
KEYS = [(0.0, 4.0, 95), (15, 22, 120), (44.9, 52, 180), (68, 24, 238), (79.8, 2.5, 262),
        (84.5, -9, 280), (89, -28, 330), (100, -28, 380), (109, -8, 420), (113.3, 3.0, 455), (129.2, 22, 480)]
km = np.array([k[0] for k in KEYS]); el_k = np.array([k[1] for k in KEYS]); az_k = np.array([k[2] for k in KEYS])
elev = np.interp(s_f, km, el_k); azim = np.interp(s_f, km, az_k)
# overview shots: intro is the same dawn as the start; outro holds morning light
elev = np.where(frames >= CHASE1, np.interp(frames, [CHASE1, F_END], [22, 28]), elev)
day = np.clip((elev + 4) / 10, 0, 1)            # 0 = night, 1 = day
golden = np.clip(1 - np.abs(elev - 3) / 12, 0, 1) * day

# ---------- sun + moon lamps ----------
sun = D.objects["Sun"]; sun.animation_data_clear(); sl = sun.data
if sl.animation_data: sl.animation_data_clear()
moon = D.objects.get("Moon")
if not moon:
    ml = D.lights.new("Moon", 'SUN'); moon = D.objects.new("Moon", ml); sc.collection.objects.link(moon)
moon.animation_data_clear(); ml = moon.data
if ml.animation_data: ml.animation_data_clear()
ml.color = (0.55, 0.65, 1.0); ml.angle = math.radians(1.0)
moon.rotation_euler = (math.radians(50), 0, math.radians(30))

# ---------- world: sky + night tint + volume haze ----------
w = sc.world; w.use_nodes = True; nt = w.node_tree; N = nt.nodes; Lk = nt.links
N.clear()
out = N.new("ShaderNodeOutputWorld")
sky = N.new("ShaderNodeTexSky")
try: sky.sky_type = 'MULTIPLE_SCATTERING'
except Exception: pass
bg_day = N.new("ShaderNodeBackground"); Lk.new(sky.outputs[0], bg_day.inputs[0])
bg_night = N.new("ShaderNodeBackground"); bg_night.inputs[0].default_value = (0.006, 0.01, 0.03, 1)
add = N.new("ShaderNodeAddShader"); Lk.new(bg_day.outputs[0], add.inputs[0]); Lk.new(bg_night.outputs[0], add.inputs[1])
Lk.new(add.outputs[0], out.inputs["Surface"])
haze = N.new("ShaderNodeVolumePrincipled"); haze.inputs["Anisotropy"].default_value = 0.55
haze.inputs["Color"].default_value = (0.75, 0.82, 0.95, 1)
Lk.new(haze.outputs[0], out.inputs["Volume"])

# ---------- fog volume box (valley fog + edge walls + reveal) ----------
fog = D.objects.get("Fog_Volume")
if fog: D.objects.remove(fog, do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.2))
fog = bpy.context.active_object; fog.name = "Fog_Volume"
fog.scale = (WKM + 30, HKM + 30, 4.6); bpy.ops.object.transform_apply(scale=True)
for c in fog.users_collection: c.objects.unlink(fog)
D.collections["Map"].objects.link(fog)
fm = D.materials.get("MAT_Fog") or D.materials.new("MAT_Fog"); fm.use_nodes = True
ft = fm.node_tree; FN = ft.nodes; FL = ft.links; FN.clear()
fo = FN.new("ShaderNodeOutputMaterial"); pv = FN.new("ShaderNodeVolumePrincipled")
pv.inputs["Color"].default_value = (0.85, 0.88, 0.95, 1); pv.inputs["Anisotropy"].default_value = 0.45
FL.new(pv.outputs[0], fo.inputs["Volume"])
tc_ = FN.new("ShaderNodeTexCoord"); sp = FN.new("ShaderNodeSeparateXYZ"); FL.new(tc_.outputs["Object"], sp.inputs[0])
def m(op, a, b=None):
    n = FN.new("ShaderNodeMath"); n.operation = op
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: FL.new(v, n.inputs[i])
    return n.outputs[0]
# valley fog: exp falloff above z≈0.35 km (scene units), wispy noise
z = sp.outputs["Z"]
valley = m('EXPONENT', m('MULTIPLY', m('MAXIMUM', m('SUBTRACT', z, 0.35), 0.0), -2.6))
nz = FN.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.08; nz.inputs["Detail"].default_value = 3
FL.new(tc_.outputs["Object"], nz.inputs["Vector"])
wisp = m('MULTIPLY', m('ADD', nz.outputs["Fac"], 0.25), 1.2)
valley = m('MULTIPLY', m('MULTIPLY', valley, wisp), 0.35)
# edge walls: distance to the map border
hx, hy = WKM / 2, HKM / 2
dx = m('SUBTRACT', hx, m('ABSOLUTE', sp.outputs["X"])); dy = m('SUBTRACT', hy, m('ABSOLUTE', sp.outputs["Y"]))
de = m('MINIMUM', dx, dy)
edge = FN.new("ShaderNodeMapRange"); edge.interpolation_type = 'SMOOTHSTEP'
edge.inputs["From Min"].default_value = 14.0; edge.inputs["From Max"].default_value = 1.0
edge.inputs["To Min"].default_value = 0.0; edge.inputs["To Max"].default_value = 2.5
FL.new(de, edge.inputs["Value"])
dens = m('ADD', valley, edge.outputs["Result"])
# master control: reveal (animated) scales everything
master = FN.new("ShaderNodeValue"); master.name = "FogMaster"; master.label = "FogMaster"
reveal = FN.new("ShaderNodeValue"); reveal.name = "FogReveal"; reveal.label = "FogReveal"
dens = m('MULTIPLY', dens, master.outputs[0])
thick = m('MULTIPLY', reveal.outputs[0], m('MULTIPLY', m('EXPONENT', m('MULTIPLY', m('MAXIMUM', m('SUBTRACT', z, 0.2), 0.0), -0.9)), 1.0))
dens = m('ADD', dens, thick)
FL.new(dens, pv.inputs["Density"])
fog.data.materials.append(fm)
fog.visible_shadow = False

# ---------- EEVEE volume + glow settings ----------
ee = sc.eevee
for a, v in (("volumetric_start", 0.02), ("volumetric_end", 260.0), ("volumetric_tile_size", '8'), ("volumetric_samples", 48),
             ("volumetric_sample_distribution", 0.85), ("use_volumetric_shadows", True), ("volumetric_shadow_samples", 8),
             ("use_motion_blur", True), ("motion_blur_shutter", 0.35)):
    if hasattr(ee, a):
        try: setattr(ee, a, v)
        except Exception: pass
if hasattr(sc.render, "use_motion_blur"): sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.35
sc.use_nodes = True
ct = sc.node_tree if hasattr(sc, "node_tree") and sc.node_tree else None
if ct is None and hasattr(sc, "compositing_node_group"):
    if sc.compositing_node_group is None: sc.compositing_node_group = D.node_groups.new("Comp", 'CompositorNodeTree')
    ct = sc.compositing_node_group
if ct:
    for n in list(ct.nodes): ct.nodes.remove(n)
    rl = ct.nodes.new("CompositorNodeRLayers")
    gl = ct.nodes.new("CompositorNodeGlare")
    try: gl.glare_type = 'FOG_GLOW'
    except Exception: pass
    for a, v in (("quality", 'MEDIUM'), ("threshold", 1.6), ("size", 7), ("mix", -0.75)):
        try: setattr(gl, a, v)
        except Exception:
            try: gl.inputs[a.capitalize()].default_value = v
            except Exception: pass
    try: oc = ct.nodes.new("CompositorNodeComposite")
    except Exception: oc = ct.nodes.new("NodeGroupOutput")
    ct.links.new(rl.outputs["Image"], gl.inputs[0] if gl.inputs[0].type == 'RGBA' else gl.inputs["Image"])
    try: ct.links.new(gl.outputs[0], oc.inputs[0])
    except Exception: pass

# ---------- night lights: car ----------
head = D.materials["front_white_light"].node_tree.nodes["Principled BSDF"]
tail = D.materials["back_red_Light"].node_tree.nodes["Principled BSDF"]
beams = [D.objects.get("Headbeam_1"), D.objects.get("Headbeam_-1")]
for b in beams:
    if b:
        b.hide_render = False; b.data.spot_size = math.radians(55); b.data.spot_blend = 0.6; b.data.color = (1, 0.93, 0.8)
        b.data.use_shadow = False
        if b.data.animation_data: b.data.animation_data_clear()

# ---------- bake per-frame lighting keys ----------
def ckey(path_owner, attr, val, f, idx=None):
    setattr(path_owner, attr, val)
    path_owner.keyframe_insert(attr, frame=f) if idx is None else path_owner.keyframe_insert(attr, index=idx, frame=f)
fogn = {n.name: n for n in FN}
master_n = fogn["FogMaster"]; reveal_n = fogn["FogReveal"]
# reveal: thick fog burns off at the start, then again at the end
rev = np.zeros(len(frames))
rev = np.where(frames < 100, np.interp(frames, [1, 20, 100], [5.0, 5.0, 0.0]), rev)
rev = np.where(frames >= CHASE1, np.interp(frames, [CHASE1, CHASE1 + 10, F_END - 40], [3.5, 3.5, 0.0]), rev)
for i in range(0, len(frames), 3):
    f = int(frames[i]); e = math.radians(elev[i]); a = math.radians(azim[i])
    # sun lamp: Blender sun points down -Z; rotate so light comes from azimuth/elevation
    sun.rotation_euler = (math.pi / 2 - max(e, math.radians(-2)), 0, -a + math.pi)
    sun.keyframe_insert("rotation_euler", frame=f)
    sl.energy = float(4.8 * np.clip(np.sin(max(e, 0)) * 2.2, 0, 1)); sl.keyframe_insert("energy", frame=f)
    warm = golden[i]
    sl.color = (1.0, 0.93 - 0.28 * warm, 0.85 - 0.5 * warm); sl.keyframe_insert("color", frame=f)
    ml.energy = float(0.18 * (1 - day[i])); ml.keyframe_insert("energy", frame=f)
    sky.sun_elevation = max(e, math.radians(-6)); sky.keyframe_insert("sun_elevation", frame=f)
    sky.sun_rotation = a; sky.keyframe_insert("sun_rotation", frame=f)
    bg_day.inputs[1].default_value = float(0.08 + 0.42 * day[i]); bg_day.inputs[1].keyframe_insert("default_value", frame=f)
    bg_night.inputs[1].default_value = float(0.6 * (1 - day[i])); bg_night.inputs[1].keyframe_insert("default_value", frame=f)
    haze.inputs["Density"].default_value = float(0.006 + 0.01 * golden[i]); haze.inputs["Density"].keyframe_insert("default_value", frame=f)
    master_n.outputs[0].default_value = float(0.55 + 0.9 * golden[i] + 0.4 * (1 - day[i])); master_n.outputs[0].keyframe_insert("default_value", frame=f)
    reveal_n.outputs[0].default_value = float(rev[i]); reveal_n.outputs[0].keyframe_insert("default_value", frame=f)
    pv.inputs["Color"].default_value = (0.95, 0.85 - 0.15 * warm, 0.78 - 0.25 * warm, 1) if day[i] > 0.3 else (0.45, 0.5, 0.65, 1)
    pv.inputs["Color"].keyframe_insert("default_value", frame=f)
    night = float(1 - day[i])
    head.inputs["Emission Strength"].default_value = 30 + 60 * night; head.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
    tail.inputs["Emission Strength"].default_value = 12 + 30 * night; tail.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
    for b in beams:
        if b: b.data.energy = 0.08 * night; b.data.keyframe_insert("energy", frame=f)
ATMOS_INFO = {"chase": [CHASE0, CHASE1], "night_frames": int((day < 0.2).sum()),
              "sunset_frame": int(frames[np.argmin(np.abs(s_f - 79.8))]), "sunrise2_frame": int(frames[np.argmin(np.abs(s_f - 113.3))])}
