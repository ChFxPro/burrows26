"""Headless: make the Burrows wrap sit on the real car body instead of floating off it.

The side graphics and stripes stood ~4-15 cm (real-car scale) off the paint: their
shrinkwrap projected along local Z, which runs up the door for these upright pieces, and the
target was a simplified stand-in shape. This builds 'Burrows_BodySkin' from the actual body
panels under the graphics (modifiers applied), retargets every wrap shrinkwrap to it,
projects each piece along its own thin axis, and prints the gap before/after. Run on burrows_wnc_route_tour.blend, then re-run make_cut30.py. Safe to re-run.
"""
import bpy, bmesh
from mathutils.bvhtree import BVHTree
D = bpy.data
dg = bpy.context.evaluated_depsgraph_get()
car = D.objects["Burrows_Vehicle"]
decals = [o for o in car.children_recursive
          if o.type == 'MESH' and any(m.type == 'SHRINKWRAP' and m.target and m.target.name in
                                      ("Burrows_DecalTarget", "Burrows_BodySkin") for m in o.modifiers)]
skip = {o.name for o in decals} | {"Burrows_DecalTarget", "Burrows_BodySkin"}
body = [o for o in car.children_recursive if o.type == 'MESH' and o.name not in skip
        and not o.name.startswith("Burrows_Sign")]

def world_tris(o):
    oe = o.evaluated_get(dg); me = oe.to_mesh(); M = o.matrix_world
    vs = [M @ v.co for v in me.vertices]; ps = [list(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); return vs, ps

def gaps(target_objs):
    """Distance from each decal vertex (as currently evaluated) to the given body objects."""
    trees = []
    for o in target_objs:
        vs, ps = world_tris(o)
        if ps: trees.append(BVHTree.FromPolygons(vs, ps))
    out = {}
    for d in decals:
        de = d.evaluated_get(dg); me = de.to_mesh(); M = d.matrix_world; ds = []
        for v in me.vertices:
            p = M @ v.co
            ds.append(min(t.find_nearest(p)[3] for t in trees))
        de.to_mesh_clear(); ds.sort()
        out[d.name] = (ds[len(ds) // 2], ds[-1])
    return out, trees

# body panels that actually lie under the graphics
before, _ = gaps(body)
under = set()
per = []
for o in body:
    vs, ps = world_tris(o)
    if ps: per.append((o, BVHTree.FromPolygons(vs, ps)))
for d in decals:
    de = d.evaluated_get(dg); me = de.to_mesh(); M = d.matrix_world
    for v in list(me.vertices)[::3]:
        p = M @ v.co
        best = min(per, key=lambda ot: ot[1].find_nearest(p)[3])
        under.add(best[0].name)
    de.to_mesh_clear()
print("SKIN from", len(under), "body panels:", sorted(under))

# build the skin in the decals' parent space so the car's motion carries it.
# Only painted panels and the lower plastic cladding: mirrors and trim made graphics snap onto them.
SKIN_MATERIALS = {"Car paint", "MetallicBlack02_Pl"}
parent = decals[0].parent
inv = parent.matrix_world.inverted()
bm = bmesh.new()
for o in body:
    if o.name not in under: continue
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    tmp = me.copy(); tmp.transform(inv @ o.matrix_world)
    names = [s.material.name if s.material else "" for s in o.material_slots]
    part = bmesh.new(); part.from_mesh(tmp)
    drop = [f for f in part.faces if not (f.material_index < len(names) and names[f.material_index] in SKIN_MATERIALS)]
    bmesh.ops.delete(part, geom=drop, context='FACES')
    part.to_mesh(tmp); part.free()
    bm.from_mesh(tmp); D.meshes.remove(tmp); oe.to_mesh_clear()
old = D.objects.get("Burrows_BodySkin")
if old: D.objects.remove(old, do_unlink=True)
skin_me = D.meshes.get("Burrows_BodySkin") or D.meshes.new("Burrows_BodySkin")
bm.to_mesh(skin_me); bm.free()
skin = D.objects.new("Burrows_BodySkin", skin_me)
for c in decals[0].users_collection: c.objects.link(skin)
skin.parent = parent; skin.matrix_parent_inverse.identity()
skin.hide_render = True; skin.hide_viewport = True

for d in decals:
    # project along the graphic's own thin axis (sides/stripes stand upright: local X; hood: Z)
    co = [v.co for v in d.data.vertices]
    ext = [max(c[i] for c in co) - min(c[i] for c in co) for i in range(3)]
    thin = ext.index(min(ext))
    for m in d.modifiers:
        if m.type == 'SHRINKWRAP':
            m.target = skin
            m.wrap_method = 'PROJECT'
            m.use_project_x, m.use_project_y, m.use_project_z = (thin == 0), (thin == 1), (thin == 2)
            m.use_negative_direction = m.use_positive_direction = True
            m.offset = 0.012   # ~1.2 cm at real-car scale: clears the body's flat facets
    # like real vinyl: bridge small recesses (door handles, panel seams) instead of dipping in,
    # then push anything that sank into the body back out to the surface
    sm = d.modifiers.get("WrapSmooth") or d.modifiers.new("WrapSmooth", 'SMOOTH')
    sm.factor = 0.6; sm.iterations = 12
    # smooth only in and out of the body (the thin axis), so artwork edges don't shrink inward
    sm.use_x, sm.use_y, sm.use_z = (thin == 0), (thin == 1), (thin == 2)
    ko = d.modifiers.get("WrapKeepOut") or d.modifiers.new("WrapKeepOut", 'SHRINKWRAP')
    ko.target = skin; ko.wrap_method = 'NEAREST_SURFACEPOINT'; ko.wrap_mode = 'OUTSIDE'; ko.offset = 0.012
    print("AXIS", d.name, "XYZ"[thin], [m.name for m in d.modifiers])
dg.update()
after, _ = gaps(body)
# report at real-car scale: the model car is ~33.4 units*1000 long vs a ~4.6 m Forester
k = 1000 * 4.6 / 33.4 * 100       # world units -> real-car centimetres
for n in sorted(before):
    print(f"GAP {n:28s} before median {before[n][0]*k:5.1f} cm max {before[n][1]*k:5.1f} cm"
          f"  ->  after median {after[n][0]*k:5.1f} cm max {after[n][1]*k:5.1f} cm")
bpy.ops.wm.save_mainfile()
print("WRAP_OK")
