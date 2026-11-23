"""Build burrows_comp.blend: reads the multilayer EXR sequence and finishes the film in the compositor.
Usage: blender -b --factory-startup --python build_comp.py -- keys.json sample_exr comp.blend out.mp4"""
import bpy, json, sys, os
a = sys.argv[sys.argv.index("--") + 1:]
K = json.load(open(a[0])); SAMPLE, SAVE, MP4 = a[1], a[2], a[3]
D = bpy.data
sc = bpy.context.scene; sc.name = "Burrows_Comp"
for o in list(D.objects): D.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = K["frame_start"], K["frame_end"]
r = sc.render; r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.fps = K["fps"]; r.use_compositing = True; r.use_sequencer = False
im = r.image_settings
try: im.media_type = 'VIDEO'
except Exception: pass
im.file_format = 'FFMPEG'
r.ffmpeg.format = 'MPEG4'; r.ffmpeg.codec = 'H264'; r.ffmpeg.constant_rate_factor = 'HIGH'; r.ffmpeg.ffmpeg_preset = 'GOOD'
r.ffmpeg.video_bitrate = 24000
r.filepath = MP4
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass

ct = D.node_groups.new("Burrows_Finish", 'CompositorNodeTree'); sc.compositing_node_group = ct
ct.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
N = ct.nodes; L = ct.links
def node(t, x, y, **kw):
    n = N.new(t); n.location = (x, y)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def sock(n, name, out=True):
    socks = n.outputs if out else n.inputs
    m = [s for s in socks if s.name == name and s.enabled] or [s for s in socks if s.name == name]
    return m[0]

img = D.images.load(SAMPLE); img.source = 'SEQUENCE'; img.name = "Burrows_EXR"
def exr_node(layer, x, y):
    n = node("CompositorNodeImage", x, y); n.image = img
    n.frame_duration = K["frame_end"]; n.frame_start = 1; n.frame_offset = 0; n.use_auto_refresh = True
    try: n.layer = layer
    except Exception: pass
    return n
mainN = exr_node("Main", -1600, 300)
ovN = exr_node("Overlays", -1600, -700)

# ---- relight: denoise each light group, apply gain, sum ----
GROUPS = ["Sun", "Moon", "Sky", "CarLights", "TownLights", "Graphics"]
gains = {}
acc = None; y = 600
for g in GROUPS:
    src = [s for s in mainN.outputs if s.name.endswith(g) and s.name.startswith("Combined")]
    if not src: continue
    dn = node("CompositorNodeDenoise", -1150, y)
    L.new(src[0], dn.inputs["Image"])
    for nm in ("Denoising Normal", "Denoising Albedo"):
        if nm in mainN.outputs: L.new(mainN.outputs[nm], dn.inputs[nm.split()[-1]])
    gv = node("ShaderNodeValue", -1150, y - 120); gv.name = f"Gain_{g}"; gv.label = f"Gain {g}"; gv.outputs[0].default_value = 1.0
    gains[g] = gv
    mul = node("ShaderNodeMix", -900, y, data_type='RGBA', blend_type='MULTIPLY'); mul.inputs[0].default_value = 1.0
    L.new(dn.outputs[0], mul.inputs[6])
    cg = node("CompositorNodeCombineColor", -1000, y - 160)
    for ch in ("Red", "Green", "Blue"): L.new(gv.outputs[0], sock(cg, ch, False))
    L.new(cg.outputs[0], mul.inputs[7])
    if acc is None: acc = mul.outputs[2]
    else:
        add = node("ShaderNodeMix", -700, y, data_type='RGBA', blend_type='ADD'); add.inputs[0].default_value = 1.0
        L.new(acc, add.inputs[6]); L.new(mul.outputs[2], add.inputs[7]); acc = add.outputs[2]
    y -= 260
use_relight = node("ShaderNodeValue", -700, 900); use_relight.name = "Use_Relight"; use_relight.label = "Use Relight (0/1)"
use_relight.outputs[0].default_value = 1.0
sw = node("ShaderNodeMix", -450, 500, data_type='RGBA')
L.new(use_relight.outputs[0], sw.inputs[0]); L.new(mainN.outputs["Image"], sw.inputs[6]); L.new(acc, sw.inputs[7])
beauty = sw.outputs[2]

# ---- vector motion blur ----
vb = node("CompositorNodeVecBlur", -250, 500)
L.new(beauty, sock(vb, "Image", False))
for nm, cand in (("Depth", ("Depth", "Z")), ("Vector", ("Speed", "Vector"))):
    if nm in mainN.outputs:
        tgt = [s for s in vb.inputs if s.name in cand]
        if tgt: L.new(mainN.outputs[nm], tgt[0])
for k, v in (("Samples", 16), ("Shutter", 0.35)):
    if k in vb.inputs: vb.inputs[k].default_value = v
mbamt = node("ShaderNodeValue", -250, 700); mbamt.name = "MotionBlur_Mix"; mbamt.outputs[0].default_value = 1.0
mbmix = node("ShaderNodeMix", 0, 500, data_type='RGBA')
L.new(mbamt.outputs[0], mbmix.inputs[0]); L.new(beauty, mbmix.inputs[6]); L.new(vb.outputs[0], mbmix.inputs[7])

# ---- mist (time-of-day colour; light on overhead shots) ----
mamt = node("ShaderNodeValue", 0, 800); mamt.name = "MistAmount"
mcol = node("CompositorNodeRGB", 0, 950); mcol.name = "MistColor"
C0, C1 = K["chase0"], K["chase1"]
for i, f in enumerate(range(K["frame_start"], K["frame_end"] + 1)):
    if f % 3 and f not in (C0 - 1, C0, C1 - 1, C1): continue
    amt = K["mist_amt"][i] * (0.18 if (f < C0 or f >= C1) else 1.0)
    mamt.outputs[0].default_value = amt; mamt.outputs[0].keyframe_insert("default_value", frame=f)
    mcol.outputs[0].default_value = (*K["mist_col"][i], 1.0); mcol.outputs[0].keyframe_insert("default_value", frame=f)
mm = node("ShaderNodeMath", 200, 700, operation='MULTIPLY')
L.new(mainN.outputs["Mist"], mm.inputs[0]); L.new(mamt.outputs[0], mm.inputs[1])
mist = node("ShaderNodeMix", 400, 500, data_type='RGBA')
L.new(mm.outputs[0], mist.inputs[0]); L.new(mbmix.outputs[2], mist.inputs[6]); L.new(mcol.outputs[0], mist.inputs[7])

# ---- overlays (labels, pins, borders, trail, beacon) ----
ovop = node("ShaderNodeValue", 400, -500); ovop.name = "Overlay_Opacity"; ovop.outputs[0].default_value = 1.0
ao = node("CompositorNodeAlphaOver", 650, 300)
L.new(mist.outputs[2], ao.inputs[[s.name for s in ao.inputs if s.type == 'RGBA'][0]] if False else ao.inputs[1])
L.new(ovN.outputs["Image"], ao.inputs[2])
L.new(ovop.outputs[0], ao.inputs[0])

# ---- bloom + grade + vignette ----
gl = node("CompositorNodeGlare", 900, 300)
L.new(ao.outputs[0], gl.inputs["Image"])
for k, v in (("Type", 'Bloom'), ("Quality", 'High'), ("Threshold", 2.5), ("Strength", 0.3), ("Size", 0.5)):
    try: gl.inputs[k].default_value = v
    except Exception: pass
ex = node("CompositorNodeExposure", 1150, 300); L.new(gl.outputs["Image"], ex.inputs[0])
exv = [s for s in ex.inputs if s.name == "Exposure"]
if exv: exv[0].default_value = 0.0
cb = node("CompositorNodeColorBalance", 1350, 300); L.new(ex.outputs[0], [s for s in cb.inputs if s.type == 'RGBA'][0])
el = node("CompositorNodeEllipseMask", 1350, -100)
for k, v in (("Size", (0.95, 0.95)),):
    if k in el.inputs:
        try: el.inputs[k].default_value = v
        except Exception: pass
bl = node("CompositorNodeBlur", 1550, -100)
L.new(el.outputs[0], bl.inputs[0])
for k, v in (("Size", (300, 300)),):
    if k in bl.inputs:
        try: bl.inputs[k].default_value = v
        except Exception: pass
vg = node("ShaderNodeMix", 1750, 300, data_type='RGBA', blend_type='MULTIPLY')
vgamt = node("ShaderNodeValue", 1550, 500); vgamt.name = "Vignette"; vgamt.outputs[0].default_value = 0.25
inv = node("ShaderNodeMath", 1600, 100, operation='SUBTRACT'); inv.inputs[0].default_value = 1.0
L.new(bl.outputs[0], inv.inputs[1])
vmul = node("ShaderNodeMath", 1700, 100, operation='MULTIPLY'); L.new(inv.outputs[0], vmul.inputs[0]); L.new(vgamt.outputs[0], vmul.inputs[1])
vfac = node("ShaderNodeMath", 1800, 100, operation='SUBTRACT'); vfac.inputs[0].default_value = 1.0; L.new(vmul.outputs[0], vfac.inputs[1])
vg.inputs[0].default_value = 1.0
L.new(cb.outputs[0], vg.inputs[6])
cvf = node("CompositorNodeCombineColor", 1900, 100)
for ch in ("Red", "Green", "Blue"): L.new(vfac.outputs[0], sock(cvf, ch, False))
L.new(cvf.outputs[0], vg.inputs[7])
out = node("NodeGroupOutput", 2100, 300); L.new(vg.outputs[2], out.inputs[0])
viewer = node("CompositorNodeViewer", 2100, 0); L.new(vg.outputs[2], viewer.inputs[0])
bpy.ops.wm.save_as_mainfile(filepath=SAVE)
print("COMP_OK", [s.name for s in mainN.outputs][:60], [s.name for s in ovN.outputs][:10])
