"""Headless: replace volumetric reveal with cloud planes, edge haze in the terrain shader, speed settings, decal cleanup."""
import bpy, json, os
D = bpy.data; sc = bpy.context.scene
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "source", "out")  # build data (scripts/build/prep*.py write it)
vec = json.load(open(f"{OUT}/vectors.json")); WKM, HKM = vec["map"]["w"], vec["map"]["h"]
C0, C1 = int(sc["chase0"]), int(sc["chase1"])

def fcurves(idb):
    ad = idb.animation_data
    if not ad or not ad.action: return []
    act = ad.action
    return list(act.fcurves) if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]

# ---- reveal curve from the old fog material ----
fnt = D.materials["MAT_Fog"].node_tree
rev_fc = [fc for fc in fcurves(fnt) if fc.data_path == fnt.nodes["FogReveal"].outputs[0].path_from_id("default_value")][0]
frames = range(1, sc.frame_end + 1)
rev = {f: rev_fc.evaluate(f) for f in frames}
fog = D.objects.get("Fog_Volume")
if fog: D.objects.remove(fog, do_unlink=True)

# ---- cloud deck: three noise-cut planes that burn off ----
cm = D.materials.get("MAT_CloudDeck") or D.materials.new("MAT_CloudDeck"); cm.use_nodes = True
nt = cm.node_tree; N = nt.nodes; L = nt.links; N.clear()
out = N.new("ShaderNodeOutputMaterial")
tc = N.new("ShaderNodeTexCoord"); mp = N.new("ShaderNodeMapping"); L.new(tc.outputs["Object"], mp.inputs["Vector"])
nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = '3D'
nz.inputs["Scale"].default_value = 0.09; nz.inputs["Detail"].default_value = 9; nz.inputs["Roughness"].default_value = 0.62
L.new(mp.outputs["Vector"], nz.inputs["Vector"])
rv = N.new("ShaderNodeValue"); rv.name = "Reveal"
def m(op, a, b=None):
    n = N.new("ShaderNodeMath"); n.operation = op
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: L.new(v, n.inputs[i])
    return n.outputs[0]
thr = m('SUBTRACT', 1.0, m('MULTIPLY', rv.outputs[0], 0.6))
cov = m('MINIMUM', m('MAXIMUM', m('MULTIPLY', m('SUBTRACT', nz.outputs["Fac"], thr), 5.0), 0.0), 0.92)
tr = N.new("ShaderNodeBsdfTransparent")
dif = N.new("ShaderNodeBsdfPrincipled"); dif.inputs["Base Color"].default_value = (0.95, 0.95, 0.97, 1); dif.inputs["Roughness"].default_value = 1.0
tl = N.new("ShaderNodeBsdfTranslucent"); tl.inputs["Color"].default_value = (0.9, 0.9, 0.92, 1)
mix1 = N.new("ShaderNodeMixShader"); mix1.inputs[0].default_value = 0.35; L.new(dif.outputs[0], mix1.inputs[1]); L.new(tl.outputs[0], mix1.inputs[2])
mix2 = N.new("ShaderNodeMixShader"); L.new(cov, mix2.inputs[0]); L.new(tr.outputs[0], mix2.inputs[1]); L.new(mix1.outputs[0], mix2.inputs[2])
L.new(mix2.outputs[0], out.inputs["Surface"])
for f in frames:
    if f % 2 == 1 or f in (C0 - 1, C1):
        rv.outputs[0].default_value = float(rev[f]); rv.outputs[0].keyframe_insert("default_value", frame=f)
for o in [o for o in D.objects if o.name.startswith("Cloud_Deck")]: D.objects.remove(o, do_unlink=True)
for k, (z, off) in enumerate(((2.55, (0, 0, 0)), (2.95, (13.1, 7.7, 3.3)), (3.35, (-9.4, 21.2, 7.9)))):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, z))
    p = bpy.context.active_object; p.name = f"Cloud_Deck_{k}"; p.scale = (WKM + 40, HKM + 40, 1)
    for c in p.users_collection: c.objects.unlink(p)
    D.collections["Map"].objects.link(p)
    mk = cm if k == 0 else cm.copy()
    if k: [n for n in mk.node_tree.nodes if n.type == 'MAPPING'][0].inputs["Location"].default_value = off
    p.data.materials.append(mk)
    for fr, hide in ((1, False), (C0, True), (C1, False)):
        p.hide_render = hide; p.keyframe_insert("hide_render", frame=fr)

# ---- edge haze: terrain + base slab fade to a soft haze colour near the map border ----
HAZE = (0.42, 0.46, 0.52, 1)
tm = D.materials["MAT_Terrain"]; tn = tm.node_tree; TN = tn.nodes; TL = tn.links
b = TN["Principled BSDF"]; src = b.inputs["Base Color"].links[0].from_socket if b.inputs["Base Color"].is_linked else None
if src and not TN.get("EdgeHaze"):
    tcn = TN.new("ShaderNodeTexCoord"); sp = TN.new("ShaderNodeSeparateXYZ"); TL.new(tcn.outputs["Object"], sp.inputs[0])
    def tmth(op, a, bb):
        n = TN.new("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, bb)):
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: TL.new(v, n.inputs[i])
        return n.outputs[0]
    dx = tmth('SUBTRACT', WKM / 2, tmth('ABSOLUTE', sp.outputs["X"], 0)); dy = tmth('SUBTRACT', HKM / 2, tmth('ABSOLUTE', sp.outputs["Y"], 0))
    de = tmth('MINIMUM', dx, dy)
    mr = TN.new("ShaderNodeMapRange"); mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs["From Min"].default_value = 9.0; mr.inputs["From Max"].default_value = 0.5
    TL.new(de, mr.inputs["Value"])
    mx = TN.new("ShaderNodeMix"); mx.data_type = 'RGBA'; mx.name = "EdgeHaze"
    TL.new(mr.outputs["Result"], mx.inputs[0]); TL.new(src, mx.inputs[6]); mx.inputs[7].default_value = HAZE
    TL.new(mx.outputs[2], b.inputs["Base Color"])
slab = D.materials.get("MAT_MapBase")
if slab: slab.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = HAZE

# ---- speed ----
cy = sc.cycles
cy.samples = 32; cy.adaptive_threshold = 0.05; cy.adaptive_min_samples = 12
sc.render.use_motion_blur = False

# ---- decal duplicates ----
names = sorted(o.name for o in D.objects if o.name.startswith("Burrows_Decal"))
dups = [n for n in names if "." in n]
for n in dups: D.objects.remove(D.objects[n], do_unlink=True)
bpy.ops.wm.save_mainfile()
print("FIXED2", names, dups)
