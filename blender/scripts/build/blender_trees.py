"""Tree assets + roadside forest scatter (geometry nodes) on the corridor cells."""
import bpy, bmesh, math, random
import numpy as np
D = bpy.data; sc = bpy.context.scene
TREE_SCALE = 0.001 * 1.3       # metres -> km, 1.3x hyperreal
DENSITY = 2500.0               # trees per km² before the forest filter
BAND = 0.22                    # km either side of the route

# ---------- assets, built directly with bmesh so origins sit at the trunk base ----------
ac = D.collections.get("Tree_Assets") or D.collections.new("Tree_Assets")
if ac.name not in sc.collection.children: sc.collection.children.link(ac)
for o in list(ac.objects): D.objects.remove(o, do_unlink=True)

def mat(name):
    return D.materials.get(name) or D.materials.new(name)
tm = mat("MAT_Tree"); tm.use_nodes = True
nt = tm.node_tree; N = nt.nodes; L = nt.links
for n in list(N):
    if n.type not in ('OUTPUT_MATERIAL', 'BSDF_PRINCIPLED'): N.remove(n)
b = N["Principled BSDF"]
at = N.new("ShaderNodeAttribute"); at.attribute_type = 'INSTANCER'; at.attribute_name = "sat_col"
oi = N.new("ShaderNodeObjectInfo")
mr = N.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.6; mr.inputs["To Max"].default_value = 0.95
L.new(oi.outputs["Random"], mr.inputs["Value"])
hs = N.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = 1.2
L.new(at.outputs["Color"], hs.inputs["Color"]); L.new(mr.outputs["Result"], hs.inputs["Value"])
L.new(hs.outputs["Color"], b.inputs["Base Color"])
b.inputs["Roughness"].default_value = 0.85; b.inputs["Specular IOR Level"].default_value = 0.1
trunk = mat("MAT_TreeTrunk"); trunk.use_nodes = True
trunk.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.06, 0.045, 0.03, 1)

def build(name, parts):
    """parts: list of (kind, params, material_index). Coordinates in metres."""
    bm = bmesh.new()
    for kind, p, mi in parts:
        if kind == "cyl":
            g = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=p["r"], radius2=p["r"] * 0.7, depth=p["h"])
        elif kind == "cone":
            g = bmesh.ops.create_cone(bm, cap_ends=True, segments=9, radius1=p["r"], radius2=0.0, depth=p["h"])
        else:
            g = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=p["r"])
        vs = g["verts"]
        bmesh.ops.scale(bm, vec=p.get("s", (1, 1, 1)), verts=vs)
        bmesh.ops.translate(bm, vec=p["at"], verts=vs)
        for f in {f for v in vs for f in v.link_faces}: f.material_index = mi; f.smooth = (kind == "ball")
    bmesh.ops.scale(bm, vec=(TREE_SCALE,) * 3, verts=bm.verts)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(tm); me.materials.append(trunk)
    o = D.objects.new(name, me); ac.objects.link(o); return o

random.seed(3)
for v in range(2):
    h = 20 + v * 6
    parts = [("cyl", {"r": 0.45, "h": 4, "at": (0, 0, 2)}, 1)]
    for k in range(3):
        parts.append(("cone", {"r": (4.0 - k * 1.0) * (1 + v * 0.1), "h": h * 0.45, "at": (0, 0, 3 + k * h * 0.22 + h * 0.22)}, 0))
    build(f"Tree_Conifer_{v}", parts)
for v in range(3):
    parts = [("cyl", {"r": 0.5, "h": 8, "at": (0, 0, 4)}, 1)]
    for k in range(3):
        parts.append(("ball", {"r": 4.2 + random.random() * 1.5, "s": (1, 1, 0.85),
                               "at": (random.uniform(-2, 2), random.uniform(-2, 2), 11 + random.uniform(-1, 3))}, 0))
    build(f"Tree_Broadleaf_{v}", parts)
for k, o in enumerate(ac.objects): o.location = (k * 0.2, 0, -5)   # parked under the map base

# ---------- scatter node group ----------
ng = D.node_groups.get("TreeScatter")
if ng: D.node_groups.remove(ng)
ng = D.node_groups.new("TreeScatter", 'GeometryNodeTree')
I = ng.interface
I.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
I.new_socket("Image", in_out='INPUT', socket_type='NodeSocketImage')
s = I.new_socket("Density", in_out='INPUT', socket_type='NodeSocketFloat'); s.default_value = DENSITY
s = I.new_socket("Band", in_out='INPUT', socket_type='NodeSocketFloat'); s.default_value = BAND
I.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
N = ng.nodes; L = ng.links
def S(socks, name, n=0):
    m = [x for x in socks if x.name == name and x.enabled] or [x for x in socks if x.name == name]
    return m[n]
def nd(t, **kw):
    n = N.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
gi = nd("NodeGroupInput"); go = nd("NodeGroupOutput")
rd = nd("GeometryNodeInputNamedAttribute", data_type='FLOAT'); S(rd.inputs, "Name").default_value = "road_d"
near = nd("ShaderNodeMapRange", interpolation_type='SMOOTHSTEP'); S(near.inputs, "From Min").default_value = 0.026; S(near.inputs, "From Max").default_value = 0.04
L.new(S(rd.outputs, "Attribute"), S(near.inputs, "Value"))
far = nd("ShaderNodeMapRange", interpolation_type='SMOOTHSTEP'); S(far.inputs, "From Min").default_value = 0.0
L.new(S(gi.outputs, "Band"), S(far.inputs, "From Max")); L.new(S(rd.outputs, "Attribute"), S(far.inputs, "Value"))
inv = nd("ShaderNodeMath", operation='SUBTRACT'); inv.inputs[0].default_value = 1.0; L.new(S(far.outputs, "Result"), inv.inputs[1])
mask = nd("ShaderNodeMath", operation='MULTIPLY'); L.new(S(near.outputs, "Result"), mask.inputs[0]); L.new(inv.outputs[0], mask.inputs[1])
dist = nd("GeometryNodeDistributePointsOnFaces"); dist.distribute_method = 'RANDOM'
L.new(S(gi.outputs, "Geometry"), S(dist.inputs, "Mesh")); L.new(S(gi.outputs, "Density"), S(dist.inputs, "Density"))
L.new(mask.outputs[0], S(dist.inputs, "Density Factor"))
uvn = nd("GeometryNodeInputNamedAttribute", data_type='FLOAT_VECTOR'); S(uvn.inputs, "Name").default_value = "UVMap"
cap = nd("GeometryNodeSampleNearestSurface", data_type='FLOAT_VECTOR')
L.new(S(gi.outputs, "Geometry"), S(cap.inputs, "Mesh")); L.new(S(uvn.outputs, "Attribute"), S(cap.inputs, "Value"))
tex = nd("GeometryNodeImageTexture"); tex.interpolation = 'Linear'
L.new(S(gi.outputs, "Image"), S(tex.inputs, "Image")); L.new(S(cap.outputs, "Value"), S(tex.inputs, "Vector"))
sep = nd("FunctionNodeSeparateColor"); L.new(S(tex.outputs, "Color"), S(sep.inputs, "Color"))
rb = nd("ShaderNodeMath", operation='MAXIMUM'); L.new(S(sep.outputs, "Red"), rb.inputs[0]); L.new(S(sep.outputs, "Blue"), rb.inputs[1])
gd = nd("ShaderNodeMath", operation='SUBTRACT'); L.new(S(sep.outputs, "Green"), gd.inputs[0]); L.new(rb.outputs[0], gd.inputs[1])
isg = nd("ShaderNodeMath", operation='GREATER_THAN'); isg.inputs[1].default_value = 0.015; L.new(gd.outputs[0], isg.inputs[0])
dark = nd("ShaderNodeMath", operation='LESS_THAN'); dark.inputs[1].default_value = 0.30; L.new(S(sep.outputs, "Green"), dark.inputs[0])
forest = nd("ShaderNodeMath", operation='MULTIPLY'); L.new(isg.outputs[0], forest.inputs[0]); L.new(dark.outputs[0], forest.inputs[1])
notf = nd("ShaderNodeMath", operation='LESS_THAN'); notf.inputs[1].default_value = 0.5; L.new(forest.outputs[0], notf.inputs[0])
dele = nd("GeometryNodeDeleteGeometry"); dele.domain = 'POINT'
L.new(S(dist.outputs, "Points"), S(dele.inputs, "Geometry")); L.new(notf.outputs[0], S(dele.inputs, "Selection"))
st = nd("GeometryNodeStoreNamedAttribute", data_type='FLOAT_COLOR', domain='POINT'); S(st.inputs, "Name").default_value = "sat_col"
L.new(S(dele.outputs, "Geometry"), S(st.inputs, "Geometry")); L.new(S(tex.outputs, "Color"), S(st.inputs, "Value"))
ci = nd("GeometryNodeCollectionInfo"); ci.transform_space = 'RELATIVE'
S(ci.inputs, "Collection").default_value = ac
S(ci.inputs, "Separate Children").default_value = True; S(ci.inputs, "Reset Children").default_value = True
rot = nd("FunctionNodeRandomValue", data_type='FLOAT_VECTOR'); S(rot.inputs, "Max").default_value = (0, 0, 6.283)
scl = nd("FunctionNodeRandomValue", data_type='FLOAT'); S(scl.inputs, "Min").default_value = 0.7; S(scl.inputs, "Max").default_value = 1.3
inst = nd("GeometryNodeInstanceOnPoints")
L.new(S(st.outputs, "Geometry"), S(inst.inputs, "Points")); L.new(S(ci.outputs, "Instances"), S(inst.inputs, "Instance"))
S(inst.inputs, "Pick Instance").default_value = True
L.new(S(rot.outputs, "Value"), S(inst.inputs, "Rotation")); L.new(S(scl.outputs, "Value"), S(inst.inputs, "Scale"))
join = nd("GeometryNodeJoinGeometry")
L.new(S(inst.outputs, "Instances"), S(join.inputs, "Geometry")); L.new(S(gi.outputs, "Geometry"), S(join.inputs, "Geometry"))
L.new(S(join.outputs, "Geometry"), S(go.inputs, "Geometry"))
ids = {x.name: x.identifier for x in ng.interface.items_tree if x.in_out == 'INPUT'}
for o in D.collections["Corridor_HiRes"].objects:
    m = o.modifiers.get("Trees") or o.modifiers.new("Trees", 'NODES')
    m.node_group = ng; m[ids["Image"]] = D.images.get(o.name)
    m.show_viewport = False; m.show_render = True
