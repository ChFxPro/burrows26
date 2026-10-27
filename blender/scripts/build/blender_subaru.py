"""Swap the placeholder for the user's Subaru Forester, apply the Burrows livery, rig wheels."""
import bpy, math, mathutils
import numpy as np
D = bpy.data; sc = bpy.context.scene
LOGO = "/Users/jeffbannister/Code/burrows26/.claude/worktrees/burrows-vehicle-scene-nc-3161ff/nc119-dashboard/src/imgs/logo-white.png"
SUB_COLL = D.collections["Subaru Forester Wilderness 2026"]
SUB_ROOT = D.objects["Subaru Forester Wilderness 2026"]
VEH = D.collections["Burrows_Vehicle"]
VS = D.objects["Vehicle_Scale"]
NAVY = (0.012, 0.03, 0.085); RED = (0.62, 0.02, 0.05); BLUE = (0.36, 0.62, 0.84)

# ---------- 1. remove placeholder geometry (keep scale empty, headlight beams, beacon) ----------
keep = {"Vehicle_Scale", "Burrows_Vehicle", "Vehicle_Beacon", "Beacon_Cone", "Beacon_Ball", "Headbeam_1", "Headbeam_-1"}
for o in list(VS.children):
    if o.name not in keep:
        D.objects.remove(o, do_unlink=True)

# ---------- 2. move the Subaru under the vehicle rig ----------
if SUB_COLL.name not in VEH.children:
    VEH.children.link(SUB_COLL)
for c in D.collections:
    if c != VEH and SUB_COLL.name in c.children: c.children.unlink(SUB_COLL)
if not D.collections["Collection"].objects and not D.collections["Collection"].children:
    D.collections.remove(D.collections["Collection"])
SUB_ROOT.parent = VS
SUB_ROOT.location = (0, 0, 0)
SUB_ROOT.rotation_euler = (0, 0, math.radians(90))   # model faces -Y, rig faces +X
SUB_ROOT.scale = (1, 1, 1)

# ---------- 3. materials ----------
for m in {s.material for o in SUB_COLL.all_objects if o.type == 'MESH' for s in o.material_slots if s.material}:
    if not m.use_nodes: continue
    for nd in m.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            ec = nd.inputs["Emission Color"].default_value
            if "light" not in m.name.lower() and max(ec[:3]) > 0 and nd.inputs["Emission Strength"].default_value > 0:
                nd.inputs["Emission Strength"].default_value = 0.0
paint = D.materials["Car paint"]
b = paint.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (*NAVY, 1); b.inputs["Metallic"].default_value = 0.65
b.inputs["Roughness"].default_value = 0.22; b.inputs["Coat Weight"].default_value = 1.0; b.inputs["Coat Roughness"].default_value = 0.03
b.inputs["Emission Strength"].default_value = 0.0
orange = D.materials["MetallicOrange"].node_tree.nodes["Principled BSDF"]
orange.inputs["Base Color"].default_value = (*RED, 1); orange.inputs["Emission Strength"].default_value = 0.0
for name, col, strength in (("front_white_light", (1, 0.97, 0.9), 30), ("back_red_Light", (1, 0.02, 0.01), 18)):
    nb = D.materials[name].node_tree.nodes["Principled BSDF"]
    nb.inputs["Emission Color"].default_value = (*col, 1); nb.inputs["Emission Strength"].default_value = strength
    nb.inputs["Base Color"].default_value = (*col, 1)

# ---------- 4. logo decals shrink-wrapped to the body ----------
for o in list(SUB_COLL.objects):
    if o.name.startswith(("Burrows_Decal", "Burrows_DecalTarget")): D.objects.remove(o, do_unlink=True)
paint_objs = [o for o in SUB_COLL.all_objects if o.type == 'MESH' and any(s.material == paint for s in o.material_slots)]
# joined, hidden copy of the painted panels as the wrap target (in Subaru-local space)
tgt_me = D.meshes.new("Burrows_DecalTarget")
import bmesh
bm = bmesh.new()
inv_root = SUB_ROOT.matrix_world.inverted()
for o in paint_objs:
    tmp = bmesh.new(); tmp.from_mesh(o.data)
    tmp.transform(inv_root @ o.matrix_world)
    m2 = D.meshes.new("_t"); tmp.to_mesh(m2); tmp.free()
    bm.from_mesh(m2); D.meshes.remove(m2)
bm.to_mesh(tgt_me); bm.free()
tgt = D.objects.new("Burrows_DecalTarget", tgt_me); SUB_COLL.objects.link(tgt)
tgt.parent = SUB_ROOT; tgt.hide_render = True; tgt.hide_viewport = True; tgt.display_type = 'WIRE'

img = D.images.get("Burrows_Logo") or D.images.load(LOGO, check_existing=True); img.name = "Burrows_Logo"
dm = D.materials.get("MAT_BurrowsWrap") or D.materials.new("MAT_BurrowsWrap"); dm.use_nodes = True
nt = dm.node_tree; nt.nodes.clear()
outn = nt.nodes.new("ShaderNodeOutputMaterial"); bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img; tx.extension = 'CLIP'
nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"]); nt.links.new(tx.outputs["Alpha"], bsdf.inputs["Alpha"])
bsdf.inputs["Roughness"].default_value = 0.22; bsdf.inputs["Coat Weight"].default_value = 1.0
bsdf.inputs["Metallic"].default_value = 0.0
nt.links.new(bsdf.outputs[0], outn.inputs[0])
try: dm.surface_render_method = 'DITHERED'
except Exception: pass

A = 1082 / 2072
def decal(name, w, h, loc, rot, offset=0.004, sub=(48, 26), mat=dm):
    """Subdivided grid in Subaru space, projected onto the body along -normal."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=sub[0], y_subdivisions=sub[1], size=1)
    o = bpy.context.active_object; o.name = name
    for c in o.users_collection: c.objects.unlink(o)
    SUB_COLL.objects.link(o)
    o.scale = (w, h, 1); o.rotation_euler = rot; o.location = loc
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.parent = SUB_ROOT; o.matrix_parent_inverse.identity()
    o.data.materials.append(mat)
    sw = o.modifiers.new("Wrap", 'SHRINKWRAP'); sw.target = tgt; sw.wrap_method = 'PROJECT'
    sw.use_negative_direction = True; sw.use_positive_direction = True; sw.use_project_z = True
    sw.offset = offset; sw.wrap_mode = 'OUTSIDE_SURFACE'
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    return o

R = math.radians
# Grid primitives face +Z with U along +X. Subaru: front -Y, right side -X... (left side +X when facing -Y)
# side facing +X (driver's right when facing -Y is -X): text must read front->back? keep reading left->right as seen.
decal("Burrows_Decal_SideXpos", 1.30, 1.30 * A, (0.95, 0.10, 0.80), (R(90), 0, R(90)))     # normal +X, U along +Y
decal("Burrows_Decal_SideXneg", 1.30, 1.30 * A, (-0.95, 0.10, 0.80), (R(90), 0, R(-90)))   # normal -X, U along -Y
decal("Burrows_Decal_Hood", 1.05, 1.05 * A, (0, -1.45, 1.3), (0, 0, R(180)))             # read from driver/behind
decal("Burrows_Decal_Roof", 1.0, 1.0 * A, (0, 0.55, 1.9), (0, 0, R(180)), offset=0.006)   # read from chase camera
# red + blue accent stripes along the doors (between wheel arches)
sr = D.materials.get("MAT_StripeRedWrap") or D.materials.new("MAT_StripeRedWrap"); sr.use_nodes = True
sr.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*RED, 1)
sr.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
sb = D.materials.get("MAT_StripeBlueWrap") or D.materials.new("MAT_StripeBlueWrap"); sb.use_nodes = True
sb.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*BLUE, 1)
sb.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
for sx, rz in ((0.95, R(90)), (-0.95, R(-90))):
    decal(f"Burrows_Decal_StripeRed_{'p' if sx > 0 else 'n'}", 1.75, 0.045, (sx, 0.05, 0.47), (R(90), 0, rz), sub=(60, 2), mat=sr)
    decal(f"Burrows_Decal_StripeBlue_{'p' if sx > 0 else 'n'}", 1.75, 0.025, (sx, 0.05, 0.42), (R(90), 0, rz), sub=(60, 2), mat=sb)

# ---------- 5. wheel pivots ----------
wheels = {}
for o in SUB_COLL.all_objects:
    if o.type != 'MESH': continue
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    ctr_w = sum(bb, mathutils.Vector()) / 8
    ctr = SUB_ROOT.matrix_world.inverted() @ ctr_w
    is_wheel_part = (o.name.startswith("tire") or (o.name.startswith("Cylinder00") and o.dimensions.z > 0.0) or o.name.startswith("Circle.0") or o.name == "Circle.001")
    if not is_wheel_part: continue
    if abs(ctr.z - 0.35) > 0.05 or abs(abs(ctr.x) - 0.8) > 0.1: continue
    key = ("R" if ctr.x > 0 else "L") + ("F" if ctr.y < 0 else "B")
    wheels.setdefault(key, []).append((o, ctr))
pivots = {}
for key, parts in wheels.items():
    pv = D.objects.get(f"WheelPivot_{key}") or D.objects.new(f"WheelPivot_{key}", None)
    if pv.name not in SUB_COLL.objects: SUB_COLL.objects.link(pv)
    pv.empty_display_size = 0.4
    tires = [c for o, c in parts if o.name.startswith("tire")]
    cy = tires[0].y if tires else parts[0][1].y
    pv.parent = SUB_ROOT; pv.matrix_parent_inverse.identity()
    pv.location = (0.8 if key[0] == "R" else -0.8, cy, 0.35); pv.rotation_euler = (0, 0, 0)
    sc.view_layer.update()
    for o, _ in parts:
        mw = o.matrix_world.copy()
        o.parent = pv; o.matrix_world = mw
    pivots[key] = pv
WHEEL_INFO = {k: [o.name for o, _ in v] for k, v in wheels.items()}
