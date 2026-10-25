"""Headless: outer terrain ring to the horizon, remove slab + edge haze, enlarge cloud decks."""
import bpy, json
import numpy as np
D = bpy.data; sc = bpy.context.scene
OUT = "/private/tmp/claude-501/-Users-jeffbannister-Code-burrows26--claude-worktrees-burrows-vehicle-scene-nc-3161ff/bacd06af-2e64-4e0c-bebd-15b29cb5b4c0/scratchpad/out"
meta = json.load(open(f"{OUT}/outer_meta.json")); RX, RY = meta["RX"], meta["RY"]
Z = np.load(f"{OUT}/outer_z.npy"); ny, nx = Z.shape
xs = np.linspace(-RX, RX, nx, dtype=np.float32); ys = np.linspace(RY, -RY, ny, dtype=np.float32)
X, Y = np.meshgrid(xs, ys)
for o in [o for o in D.objects if o.name in ("Outer_Terrain", "Map_Base")]:
    D.objects.remove(o, do_unlink=True)
idx = np.arange(nx * ny).reshape(ny, nx)
q = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], -1).astype(np.int32)
me = D.meshes.new("Outer_Terrain")
me.vertices.add(nx * ny); me.vertices.foreach_set("co", np.stack([X, Y, Z], -1).ravel())
me.loops.add(len(q) * 4); me.loops.foreach_set("vertex_index", q.ravel())
me.polygons.add(len(q)); me.polygons.foreach_set("loop_start", np.arange(0, len(q) * 4, 4, dtype=np.int32))
U = (X + RX) / (2 * RX); V = (Y + RY) / (2 * RY)
uv = np.stack([U, V], -1).reshape(-1, 2)
me.uv_layers.new(name="UVMap").data.foreach_set("uv", uv[q.ravel()].ravel().astype(np.float32))
me.polygons.foreach_set("use_smooth", np.ones(len(q), bool)); me.update()
mt = D.materials.get("MAT_OuterTerrain") or D.materials.new("MAT_OuterTerrain"); mt.use_nodes = True
b = mt.node_tree.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.95; b.inputs["Specular IOR Level"].default_value = 0.15
tx = mt.node_tree.nodes.get("Tex") or mt.node_tree.nodes.new("ShaderNodeTexImage"); tx.name = "Tex"
im = D.images.get("Outer_Tex") or D.images.load(f"{OUT}/outer_tex.jpg"); im.name = "Outer_Tex"; tx.image = im; tx.extension = 'EXTEND'
mt.node_tree.links.new(tx.outputs["Color"], b.inputs["Base Color"])
me.materials.append(mt)
ob = D.objects.new("Outer_Terrain", me); D.collections["Map"].objects.link(ob)
# the main terrain no longer fades to haze at its border
tn = D.materials["MAT_Terrain"].node_tree
eh = tn.nodes.get("EdgeHaze")
if eh:
    for l in list(eh.inputs[0].links): tn.links.remove(l)
    eh.inputs[0].default_value = 0.0
# cloud decks cover the whole region
for o in D.objects:
    if o.name.startswith("Cloud_Deck"): o.scale = (2 * RX - 20, 2 * RY - 20, 1)
# overview camera must see to the horizon
for nm in ("CAM_Overview", "CAM_Chase"):
    D.objects[nm].data.clip_end = 1500
bpy.ops.wm.save_mainfile()
print("OUTER_OK", Z.shape)
