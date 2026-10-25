"""Headless: white labels with a clean navy outline, and a logo-only car wrap.

Labels: every county and town label (shared MAT_LabelWhite) is made flat and gets a navy
outline copy as a child: same text, glyphs grown evenly with the text 'offset' setting, set
just behind the white face. As a child it follows the label's pop-up scale and face-camera
constraints. Flat labels disappear when seen edge-on instead of showing as dark slabs.
Wrap: the red and light-blue stripes under the logo are hidden; the logo is the wrap.

Run on burrows_wnc_route_tour.blend, then re-run make_cut30.py. Safe to re-run.
"""
import bpy
D = bpy.data
BORDER = 0.055                                   # outline width, as a fraction of text size
NAVY = (0.012, 0.03, 0.085, 1.0)                 # campaign navy (MAT_SignNavy)

nav = D.materials.get("MAT_LabelNavy") or D.materials.new("MAT_LabelNavy")
nav.use_nodes = True
b = nav.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = NAVY
b.inputs["Emission Color"].default_value = NAVY
b.inputs["Emission Strength"].default_value = 1.0   # same navy whatever the lighting
b.inputs["Roughness"].default_value = 1.0

for o in [o for o in D.objects if o.name.endswith("_Outline")]:
    D.objects.remove(o, do_unlink=True)

labels = [o for o in D.objects if o.type == 'FONT'
          and any(s.material and s.material.name == "MAT_LabelWhite" for s in o.material_slots)]
# neighbouring towns whose names collide: hang one left of its pin, the other right
NUDGE = {"TownLabel_Dillsboro": ('RIGHT', -0.12), "TownLabel_Sylva": ('LEFT', 0.12)}
for o in labels:
    if o.name in NUDGE:
        o.data.align_x, o.data.offset_x = NUDGE[o.name]
    o.data.extrude = 0.0          # flat: a label seen edge-on vanishes instead of showing a slab
    c = o.data.copy(); c.name = o.data.name + "_Outline"
    c.offset = BORDER * o.data.size
    c.materials.clear(); c.materials.append(nav)
    ol = D.objects.new(o.name + "_Outline", c)
    for col in o.users_collection:
        col.objects.link(ol)
    ol.parent = o; ol.matrix_parent_inverse.identity()
    ol.location = (0.0, 0.0, -0.01 * o.data.size)        # just behind the white face
    ol.hide_render = o.hide_render
print("OUTLINED", len(labels), "labels")

# the Subaru "FORESTER" lettering low on each front door (red-orange, showed once the
# stripes were gone) - hidden so the Burrows logo is the only graphic on the side
FORESTER_BADGES = {"Plane.199", "Plane.200"}
hidden = []
for o in D.objects:
    if o.name.startswith("Burrows_Decal_Stripe") or o.name in FORESTER_BADGES:
        o.hide_render = True; o.hide_viewport = True; hidden.append(o.name)
print("HIDDEN", hidden)

# --- fit the side logo inside the painted door panels ---
# Car-local metres at model scale (front of car is +x). Painted doors run from the black
# lower trim (z ~3.75-4.0) to the window trim (z ~8.0), and from just ahead of the rear
# wheel arch (x ~ -7) to the front door's leading edge (x ~ +4.3). Door handles sit at
# z ~7.0-7.5. LOGO_BOX is the area the artwork must fit inside, margins included.
import os
from mathutils import Matrix, Vector
LOGO_BOX = tuple(float(v) for v in os.environ.get("LOGO_BOX", "-6.6,3.9,4.3,7.6").split(","))
car = D.objects["Burrows_Vehicle"]
def fit_logo(d):
    if "orig_matrix" not in d:                                   # remember the original placement
        d["orig_matrix"] = [v for row in d.matrix_world for v in row]
    orig = Matrix([d["orig_matrix"][i * 4:i * 4 + 4] for i in range(4)])
    inv = car.matrix_world.inverted()
    L = inv @ orig
    img = next(n.image for s in d.material_slots for n in s.material.node_tree.nodes
               if n.type == 'TEX_IMAGE' and n.image)
    w, h = img.size; px = img.pixels[:]
    alpha = [px[(y * w + x) * 4 + 3] for y in range(0, h, 4) for x in range(0, w, 4)]
    cols = [i % ((w + 3) // 4) for i, a in enumerate(alpha) if a > 0.1]
    rows = [i // ((w + 3) // 4) for i, a in enumerate(alpha) if a > 0.1]
    u0, u1 = min(cols) * 4 / w, max(cols) * 4 / w; v0, v1 = min(rows) * 4 / h, max(rows) * 4 / h
    uv = d.data.uv_layers.active.data; vuv = {}
    for l in d.data.loops:
        vuv[l.vertex_index] = uv[l.index].uv
    art = [L @ v.co for v in d.data.vertices if u0 <= vuv[v.index][0] <= u1 and v0 <= vuv[v.index][1] <= v1]
    xs = [p.x * 1000 for p in art]; zs = [p.z * 1000 for p in art]
    x0, x1, z0, z1 = LOGO_BOX
    s = min((x1 - x0) / (max(xs) - min(xs)), (z1 - z0) / (max(zs) - min(zs)))
    src = Vector(((max(xs) + min(xs)) / 2000, 0, (max(zs) + min(zs)) / 2000))
    dst = Vector(((x0 + x1) / 2000, 0, (z0 + z1) / 2000))
    src.y = dst.y = 0
    # scale along the car's length and height only, so the sheet stays at the door's depth
    T = Matrix.Translation(dst) @ Matrix.Diagonal((s, 1.0, s, 1.0)) @ Matrix.Translation(-src)
    d.matrix_world = car.matrix_world @ T @ L
    return s
for side in ("Burrows_Decal_SideXpos", "Burrows_Decal_SideXneg"):
    print("LOGO_FIT", side, "scale", round(fit_logo(D.objects[side]), 3), "box", LOGO_BOX)

bpy.ops.wm.save_mainfile()
print("STYLE_OK")
