"""Headless: hide the end of the world and the map/outer-land seam.

- Haze ground: a huge flat plane under everything, so camera rays never reach the
  black below-horizon sky.
- Far outer land, valley fog and cloud decks fade to transparent with camera distance,
  so the outer land's edge melts into the haze ground.
- Outer land gets the same colour chain as the main map (plus a measured gain), so the
  map no longer reads as a rectangle.

Run on the scene saved after add_outer_world.py. Safe to re-run.
"""
import bpy
import numpy as np
D = bpy.data
FADE_NEAR, FADE_FAR = 160.0, 235.0     # km from camera
GAIN = (0.905, 0.840, 0.802, 1.0)      # map / outer linear means along the seam
HAZE = (0.42, 0.46, 0.52, 1.0)         # same haze colour the map's old EdgeHaze used


def node(nt, typ, name, loc=(0, 0)):
    n = nt.nodes.get(name)
    if n is None:
        n = nt.nodes.new(typ); n.name = name
    n.label = name; n.location = loc
    return n


def fade_socket(nt, x=-900, y=-600):
    """1 near the camera, 0 at FADE_FAR."""
    cam = node(nt, "ShaderNodeCameraData", "HZ_Cam", (x, y))
    mr = node(nt, "ShaderNodeMapRange", "HZ_Fade", (x + 200, y))
    mr.interpolation_type = 'SMOOTHSTEP'; mr.clamp = True
    mr.inputs["From Min"].default_value = FADE_NEAR; mr.inputs["From Max"].default_value = FADE_FAR
    mr.inputs["To Min"].default_value = 1.0; mr.inputs["To Max"].default_value = 0.0
    nt.links.new(cam.outputs["View Distance"], mr.inputs["Value"])
    return mr.outputs["Result"]


def scale_mix_fac(mat_name, src_name):
    """Multiply the opacity that feeds 'Mix Shader.001' by the distance fade."""
    nt = D.materials[mat_name].node_tree
    mix = nt.nodes["Mix Shader.001"]; src = nt.nodes[src_name]
    keep = fade_socket(nt)
    mul = node(nt, "ShaderNodeMath", "HZ_Opacity", (mix.location.x - 200, mix.location.y - 250))
    mul.operation = 'MULTIPLY'
    nt.links.new(src.outputs[0], mul.inputs[0]); nt.links.new(keep, mul.inputs[1])
    nt.links.new(mul.outputs[0], mix.inputs["Fac"])


# --- haze ground: huge flat plane under everything, lit like the land so it follows the
#     time of day. Sits below the lowest outer land so it only shows where that fades. ----
ome = D.objects["Outer_Terrain"].data
oz = np.empty(len(ome.vertices) * 3, np.float32); ome.vertices.foreach_get("co", oz)
SKIRT_Z = float(oz[2::3].min()) - 0.3
hm = D.materials.get("MAT_HorizonHaze") or D.materials.new("MAT_HorizonHaze"); hm.use_nodes = True
hb = hm.node_tree.nodes["Principled BSDF"]
hb.inputs["Base Color"].default_value = HAZE
hb.inputs["Roughness"].default_value = 1.0; hb.inputs["Specular IOR Level"].default_value = 0.0
sk = D.objects.get("Horizon_Skirt")
if sk is None:
    me = D.meshes.new("Horizon_Skirt")
    me.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
    me.materials.append(hm)
    sk = D.objects.new("Horizon_Skirt", me); D.collections["Map"].objects.link(sk)
sk.scale = (1400, 1400, 1); sk.location = (0, 0, SKIRT_Z)
sk.visible_shadow = False

# --- outer land colour: same chain as MAT_Terrain, after a seam-matched gain ------------
ot = D.materials["MAT_OuterTerrain"].node_tree
bsdf = ot.nodes["Principled BSDF"]; tex = ot.nodes["Tex"]
tt = D.materials["MAT_Terrain"].node_tree
gain = node(ot, "ShaderNodeMix", "HZ_Gain", (-500, 300)); gain.data_type = 'RGBA'; gain.blend_type = 'MULTIPLY'
gain.inputs["Factor"].default_value = 1.0; gain.inputs["B"].default_value = GAIN
co = node(ot, "ShaderNodeTexCoord", "HZ_Obj", (-900, 600))
nz = node(ot, "ShaderNodeTexNoise", "HZ_Noise", (-700, 600))
nmr = node(ot, "ShaderNodeMapRange", "HZ_NoiseRange", (-500, 600))
grain = node(ot, "ShaderNodeMix", "HZ_Grain", (-300, 400)); grain.data_type = 'RGBA'; grain.blend_type = 'MULTIPLY'
hsv = node(ot, "ShaderNodeHueSaturation", "HZ_HSV", (-100, 400))
bc = node(ot, "ShaderNodeBrightContrast", "HZ_BC", (100, 400))
src_nz, src_mr, src_mix = tt.nodes["Noise Texture"], tt.nodes["Map Range"], tt.nodes["Mix"]
for k in ("Scale", "Detail", "Roughness", "Lacunarity"):
    nz.inputs[k].default_value = src_nz.inputs[k].default_value
for k in ("From Min", "From Max", "To Min", "To Max"):
    nmr.inputs[k].default_value = src_mr.inputs[k].default_value
grain.inputs["Factor"].default_value = src_mix.inputs["Factor"].default_value


def copy_inputs(src, dst):
    for i in src.inputs:
        if not i.is_linked and hasattr(i, "default_value"):
            dst.inputs[i.identifier].default_value = i.default_value


copy_inputs(tt.nodes["Hue/Saturation/Value"], hsv)
copy_inputs(tt.nodes["Brightness/Contrast"], bc)
ot.links.new(tex.outputs["Color"], gain.inputs["A"])
ot.links.new(co.outputs["Object"], nz.inputs["Vector"]); ot.links.new(nz.outputs["Fac"], nmr.inputs["Value"])
ot.links.new(gain.outputs["Result"], grain.inputs["A"]); ot.links.new(nmr.outputs["Result"], grain.inputs["B"])
ot.links.new(grain.outputs["Result"], hsv.inputs["Color"]); ot.links.new(hsv.outputs["Color"], bc.inputs["Color"])
ot.links.new(bc.outputs["Color"], bsdf.inputs["Base Color"])

# --- far outer land fades to transparent, showing the haze ground ------------------------
# (Only the cheap outer shader gets transparency. Feathering the main map this way made
#  every shadow ray run its heavy shader, so it's left opaque; the colour match is enough.)
keep = fade_socket(ot)
tr = node(ot, "ShaderNodeBsdfTransparent", "HZ_Transparent", (200, -200))
ms = node(ot, "ShaderNodeMixShader", "HZ_Mix", (450, 0))
ot.links.new(keep, ms.inputs["Fac"]); ot.links.new(tr.outputs[0], ms.inputs[1]); ot.links.new(bsdf.outputs[0], ms.inputs[2])
ot.links.new(ms.outputs[0], ot.nodes["Material Output"].inputs["Surface"])

# --- valley fog and cloud decks thin out with distance too ------------------------------
scale_mix_fac("MAT_FogSlice", "Math.027")
for m in ("MAT_CloudDeck", "MAT_CloudDeck.003", "MAT_CloudDeck.004"):
    scale_mix_fac(m, "Math.005")

bpy.ops.wm.save_mainfile()
print("HORIZON_OK")
