"""Headless: build the 30-second cut as its own file (burrows_30s.blend) from the long route film.

Each shot takes a short stretch of the original route and re-times it:
  - motion (car, wheels, cameras, pins/labels, tree visibility) is sampled from the original
    animation starting at `src`, slowed so the car moves at `speed` km/s (None = original speed)
  - light/atmosphere (sun, moon, sky, car + town lights, fog, clouds) is sampled at `light`
    (a fixed original frame), or follows the motion when `light` is None
Every animation curve is rewritten with one key per new frame; the long version is untouched.

  Blender -b burrows_wnc_route_tour.blend --python make_cut30.py
"""
import bpy, os, shutil
D = bpy.data
sc = bpy.context.scene
HERE = os.path.dirname(bpy.data.filepath)
OUTFILE = os.path.join(HERE, "burrows_30s.blend")
ASSETS = os.path.join(HERE, "assets")
RENDERS = "/Volumes/HeleneOYOH/Burrows Campaign 26/renders/cut30"

#        name                    frames camera            src   speed  light
SHOTS = [("intro",                 119, "CAM_Overview",     1,  None,  None),
         ("brevard_drone",          96, "CAM_Chase",      196,  0.30,  None),
         ("cashiers_cu_side",       72, "CAM_CU_Side",    520,  0.16,  None),
         ("ridge_drone",            96, "CAM_Chase",      610,  0.30,  None),
         ("cullowhee_cu_front",     72, "CAM_CU_Front34", 875,  0.16,   820),
         ("dillsboro_drone_golden", 72, "CAM_Chase",     1112,  0.30,   820),
         ("bryson_cu_arrival",      73, "CAM_CU_Arrival",1470,  0.12,   820),
         ("outro",                 120, "CAM_Overview",  1599,  None,  None)]
TOTAL = sum(s[1] for s in SHOTS)
assert TOTAL == 720, TOTAL

LIGHT_OBJECTS = {"Sun"}
def is_light_owner(kind, idb):
    if kind in ("LA", "MA", "WO"):
        return True
    return kind == "OB" and (idb.name in LIGHT_OBJECTS or idb.name.startswith(("Cloud_Deck", "FogSlice")))

def fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves

# --- car speed on the original timeline (km per original frame) ---
car = D.objects["Burrows_Vehicle"]
loc = {fc.array_index: fc for fc in fcurves(car.animation_data.action) if fc.data_path == "location"}
def car_pos(f):
    return [loc[i].evaluate(f) for i in range(3)]
def speed_at(f, span=6):
    a, b = car_pos(f), car_pos(f + span)
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5 / span

# --- per new frame: source frame for motion and for light ---
motion_map, light_map, starts = [], [], []
t = 1
for name, n, cam, src, speed, light in SHOTS:
    starts.append(t)
    rate = 1.0 if speed is None else min(1.0, (speed / sc.render.fps) / max(speed_at(src), 1e-6))
    for i in range(n):
        s = src + i * rate
        motion_map.append(s)
        light_map.append(s if light is None else light)
    print(f"SHOT {name:22s} new {t:4d}-{t + n - 1:4d}  src {src}->{src + (n - 1) * rate:.1f}  x{1 / rate:.1f} slower  light {light or 'follows'}")
    t += n

# --- collect every animated datablock and its class ---
owners = []
for o in D.objects: owners.append(("OB", o))
for l in D.lights: owners.append(("LA", l))
for m in D.materials:
    if m.node_tree: owners.append(("MA", m.node_tree))
for w in D.worlds:
    if w.node_tree: owners.append(("WO", w.node_tree))
for g in D.node_groups: owners.append(("NG", g))
done = {}
for kind, idb in owners:
    ad = getattr(idb, "animation_data", None)
    if not (ad and ad.action):
        continue
    cls = "light" if is_light_owner(kind, idb) else "motion"
    prev = done.get(ad.action.name)
    if prev:
        assert prev == cls, f"{ad.action.name} shared across classes"
        continue
    done[ad.action.name] = cls
    src_map = light_map if cls == "light" else motion_map
    for fc in fcurves(ad.action):
        vals = [fc.evaluate(s) for s in src_map]
        step = fc.data_path.endswith(("hide_render", "show_render", "hide_viewport", "show_viewport"))
        kps = fc.keyframe_points
        kps.clear(); kps.add(TOTAL)
        co = []
        for i, v in enumerate(vals):
            co += [i + 1, v]
        kps.foreach_set("co", co)
        for kp in kps:
            kp.interpolation = 'CONSTANT' if step else 'LINEAR'
        fc.update()
print("REWROTE", len(done), "actions:", sum(1 for c in done.values() if c == "light"), "light /",
      sum(1 for c in done.values() if c == "motion"), "motion")

# --- town labels face the overview camera for the whole intro and outro ---
# (the long version turned them toward the chase camera during the intro; with hard cuts
#  that only made them smear edge-on)
overview_frames = [st + i for (name, n, cam, *_), st in zip(SHOTS, starts) if cam == "CAM_Overview" for i in range(n)]
faced = 0
for o in D.objects:
    ad = o.animation_data
    if not (o.name.startswith("TownLabel_") and ad and ad.action):
        continue
    for fc in fcurves(ad.action):
        if fc.data_path == 'constraints["Face_Overview"].influence':
            for f in overview_frames:
                fc.keyframe_points[f - 1].co.y = 1.0
            fc.update(); faced += 1
print("FACED", faced, "town labels toward the overview camera in", len(overview_frames), "frames")

# --- vehicle marker: the Burrows campaign badge instead of the red balloon ---
# assets/marker_badge.png (scripts/make_marker_badge.py) on a flat panel that follows the car
# (child of Vehicle_Beacon, so it keeps the per-shot scale) and faces the camera like the town
# labels. Origin = pointer tip, where the balloon's cone tip was. Drawn in the overlay pass.
BADGE_W, BADGE_TIP_Z, BADGE_TIP_Z_MAP, BADGE_MAP_SCALE = 4.4, 0.4, 3.0, 1.6   # bigger + higher on the map
img_path = os.path.join(HERE, "assets", "marker_badge.png")
img = D.images.load(img_path, check_existing=True)
img.colorspace_settings.name = 'sRGB'
bh = BADGE_W * img.size[1] / img.size[0]
for nm in ("Beacon_Badge",):
    if nm in D.objects:
        D.objects.remove(D.objects[nm], do_unlink=True)
me = D.meshes.new("Beacon_Badge")
me.from_pydata([(-BADGE_W / 2, 0, 0), (BADGE_W / 2, 0, 0), (BADGE_W / 2, bh, 0), (-BADGE_W / 2, bh, 0)], [], [(0, 1, 2, 3)])
uv = me.uv_layers.new(name="UVMap")
for loop, co in zip(me.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    uv.data[loop.index].uv = co
mat = D.materials.get("MAT_MarkerBadge") or D.materials.new("MAT_MarkerBadge")
mat.use_nodes = True
mat.surface_render_method = 'DITHERED'
nt_m = mat.node_tree; nt_m.nodes.clear()
tex = nt_m.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = 'Cubic'
emi = nt_m.nodes.new("ShaderNodeEmission"); emi.inputs["Strength"].default_value = 1.2   # like the labels
trn = nt_m.nodes.new("ShaderNodeBsdfTransparent")
mix = nt_m.nodes.new("ShaderNodeMixShader")
outn = nt_m.nodes.new("ShaderNodeOutputMaterial")
nt_m.links.new(tex.outputs["Color"], emi.inputs["Color"])
nt_m.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
nt_m.links.new(trn.outputs[0], mix.inputs[1]); nt_m.links.new(emi.outputs[0], mix.inputs[2])
nt_m.links.new(mix.outputs[0], outn.inputs["Surface"])
me.materials.append(mat)
beacon = D.objects["Vehicle_Beacon"]
badge = D.objects.new("Beacon_Badge", me)
for c in beacon.users_collection:
    c.objects.link(badge)
badge.parent = beacon; badge.location = (0, 0, BADGE_TIP_Z)
for cam_name, cname in (("CAM_Chase", "Face_Chase"), ("CAM_Overview", "Face_Overview")):
    c = badge.constraints.new('TRACK_TO'); c.name = cname; c.target = D.objects[cam_name]
    c.track_axis = 'TRACK_Z'; c.up_axis = 'UP_Y'
ov = set(overview_frames)
inf = badge.constraints["Face_Overview"]
for f in range(1, TOTAL + 1):
    inf.influence = 1.0 if f in ov else 0.0
    badge.keyframe_insert(f'constraints["Face_Overview"].influence', frame=f)
    badge.location.z = BADGE_TIP_Z_MAP if f in ov else BADGE_TIP_Z
    badge.keyframe_insert("location", index=2, frame=f)
    k = BADGE_MAP_SCALE if f in ov else 1.0
    badge.scale = (k, k, k)
    badge.keyframe_insert("scale", frame=f)
for fc in fcurves(badge.animation_data.action):
    for kp in fc.keyframe_points:
        kp.interpolation = 'CONSTANT'
for nm in ("Beacon_Ball", "Beacon_Cone"):
    D.objects[nm].hide_render = True
print("MARKER badge", round(BADGE_W, 2), "x", round(bh, 2), "replaces the balloon")

# --- arrival camera: low rear 3/4, car driving away into Bryson City, roof sign readable ---
# Offsets are in metres relative to the car. The car is modelled ~1/140 of real size in
# Blender units, so f/700 gives the depth of field of a ~f/5 lens.
def car_camera(name, cam_m, target_m, lens, fstop=700.0):
    for n in (name, name + "_T"):
        if n in D.objects:
            D.objects.remove(D.objects[n], do_unlink=True)
    coll = car.users_collection[0]
    tgt = D.objects.new(name + "_T", None); coll.objects.link(tgt)
    tgt.parent = car; tgt.location = [v / 1000 for v in target_m]
    cd = D.cameras.new(name); cd.lens = lens; cd.clip_start = 0.0003; cd.clip_end = 1500
    cd.dof.use_dof = True; cd.dof.focus_object = tgt; cd.dof.aperture_fstop = fstop
    cam = D.objects.new(name, cd); coll.objects.link(cam)
    cam.parent = car; cam.location = [v / 1000 for v in cam_m]
    tr = cam.constraints.new('TRACK_TO'); tr.target = tgt
    tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
car_camera("CAM_CU_Arrival", (-60, 25, 6), (5, 0, 9), 35)

# --- drone shots: no trees popping mid-shot ---
# The long version switches tree cells on/off by area; slowed down 10x, one of those switches
# landed mid-shot in brevard_drone (frame 152) and half the forest vanished in one frame.
# In the drone shots a cell that is on at any point of the shot stays on for all of it.
held = 0
for (name, n, cam_name, *_), st in zip(SHOTS, starts):
    if cam_name != "CAM_Chase":
        continue
    for o in D.objects:
        ad = o.animation_data
        if not (ad and ad.action):
            continue
        for fc in fcurves(ad.action):
            if fc.data_path == 'modifiers["Trees"].show_render':
                kps = fc.keyframe_points
                on = max(kps[f - 1].co.y for f in range(st, st + n))
                if any(kps[f - 1].co.y != on for f in range(st, st + n)):
                    held += 1
                for f in range(st, st + n):
                    kps[f - 1].co.y = on
                fc.update()
print("HELD", held, "tree cells constant through the drone shots")

# --- close-ups: road speed, steady camera car, clear line of sight ---
# The car is ~7x real size (33 m long), so 0.16 km/s reads as ~48 mph and 0.12 as ~36 mph.
# The route's heading jumps up to 55 deg in one frame at polyline corners, and the close-up
# cameras were parented to the car, so every jump swung the whole frame. In these shots the
# car's heading and pitch are smoothed and each camera is baked to follow the smoothed car
# (horizon level), like a camera car alongside. Motion blur is on for these shots only.
import math
from mathutils import Matrix, Vector, Euler
CU_CAMS = ("CAM_CU_Side", "CAM_CU_Front34", "CAM_CU_Arrival")
SMOOTH = 6.0                                            # frames (gaussian sigma)

def smooth(vals, sigma=SMOOTH):
    # gaussian-weighted local *linear* fit: a plain average near a shot's first/last frames only
    # sees one side and drags a sloping value (road height on a grade) up or down
    r, out = int(3 * sigma), []
    for i in range(len(vals)):
        js = list(range(max(0, i - r), min(len(vals), i + r + 1)))
        ws = [math.exp(-((j - i) ** 2) / (2 * sigma * sigma)) for j in js]
        sw = sum(ws); mx = sum(w * (j - i) for w, j in zip(ws, js)) / sw
        my = sum(w * vals[j] for w, j in zip(ws, js)) / sw
        sxx = sum(w * (j - i - mx) ** 2 for w, j in zip(ws, js))
        sxy = sum(w * (j - i - mx) * (vals[j] - my) for w, j in zip(ws, js))
        out.append(my - (sxy / sxx) * mx if sxx > 1e-12 else my)
    return out

WHEEL_STEP_DEG = float(os.environ.get("WHEEL_STEP_DEG", 75))

# wheels sat ~0.5% off their spin axis (pivot vs tyre centre), so they wobbled at speed:
# shift each wheel's parts so the tyre is centred on its pivot (spin plane only)
import numpy as np
for w in (o for o in D.objects if o.name.startswith("WheelPivot_")):
    tyre = next(c for c in w.children if c.type == 'MESH' and c.name.startswith("tire"))
    to_piv = w.matrix_world.inverted() @ tyre.matrix_world
    v = np.array([(to_piv @ x.co)[:] for x in tyre.data.vertices])
    ctr = (v.max(0) + v.min(0)) / 2
    shift = Matrix.Translation((0.0, -ctr[1], -ctr[2]))
    for c in w.children:
        c.matrix_parent_inverse = shift @ c.matrix_parent_inverse
    print(f"CENTRED {w.name}: moved parts {ctr[1] * 1000:.2f}, {ctr[2] * 1000:.2f} (x1000 units)")

BODY_SMOOTH, BODY_Z_SMOOTH = 10.0, 6.0                  # frames: body pitch, body height
ROLL_PER_TURN, ROLL_MAX = math.radians(1.6), math.radians(1.0)   # per rad/s of turn rate
TRAVEL, SQUASH = 0.15, 0.03                             # of wheel radius

cfc = {(fc.data_path, fc.array_index): fc for fc in fcurves(car.animation_data.action)}
def key(fc, f):
    return fc.keyframe_points[f - 1]
assert ("rotation_euler", 0) in cfc, "car has no roll curve"

# wheel rest pose relative to the car (pivots sit at the wheel centres after centring above)
wheels = [o for o in D.objects if o.name.startswith("WheelPivot_")]
car_inv = car.matrix_world.inverted()
wheel_rest = {w.name: ((car_inv @ w.matrix_world).translation.to_4d(),
                       car_inv @ w.parent.matrix_world, w.location.copy()) for w in wheels}
WHEEL_R = max(((c.matrix_world @ Vector(b)).z for c in wheels[0].children_recursive if c.type == 'MESH' for b in c.bound_box)) \
        - wheels[0].matrix_world.translation.z
road = D.objects["Route_Road"]; road_inv = road.matrix_world.inverted()
road_down = (road_inv.to_3x3() @ Vector((0, 0, -1))).normalized()
travel = []

# close-up lenses stopped down from f/22 (scene units): the background was a pale wash. Fully
# sharp (~1000) exposes the simple low-poly trees, so a middle value keeps shape but stays soft.
CU_FSTOP = float(os.environ.get("CU_FSTOP", 66))
for cname in ("CAM_CU_Side", "CAM_CU_Front34"):
    D.objects[cname].data.dof.aperture_fstop = CU_FSTOP
cu_ribbon, cu_path = [], []
for (name, n, cam_name, *_), st in zip(SHOTS, starts):
    if cam_name not in CU_CAMS:
        continue
    fr = list(range(st, st + n))
    P = [Vector([key(cfc[("location", i)], f).co.y for i in range(3)]) for f in fr]
    head = []
    for i in range(n):
        d = P[min(i + 2, n - 1)] - P[max(i - 2, 0)]
        h = math.atan2(d.y, d.x)
        if head:                                        # unwrap
            h += 2 * math.pi * round((head[-1] - h) / (2 * math.pi))
        head.append(h)
    yaw = smooth(head)
    # body: floats over the road (height and pitch smoothed more) and leans a little into
    # curves (roll from turn rate, max ~1 deg); the wheels follow the road below (further down)
    pitch = smooth([key(cfc[("rotation_euler", 1)], f).co.y for f in fr], BODY_SMOOTH)
    zs = smooth([p.z for p in P], BODY_Z_SMOOTH)
    for i in range(n):
        P[i] = Vector((P[i].x, P[i].y, zs[i]))
    rate = [(yaw[min(i + 1, n - 1)] - yaw[max(i - 1, 0)]) / (min(i + 1, n - 1) - max(i - 1, 0)) * sc.render.fps
            for i in range(n)]                         # rad/s, + = turning left
    roll = smooth([max(-ROLL_MAX, min(ROLL_MAX, ROLL_PER_TURN * r)) for r in rate], 4.0)
    for i, f in enumerate(fr):
        key(cfc[("rotation_euler", 2)], f).co.y = yaw[i]
        key(cfc[("rotation_euler", 1)], f).co.y = pitch[i]
        key(cfc[("rotation_euler", 0)], f).co.y = roll[i]
        key(cfc[("location", 2)], f).co.y = zs[i]
    for c in (cfc[("rotation_euler", 0)], cfc[("rotation_euler", 1)], cfc[("rotation_euler", 2)], cfc[("location", 2)]):
        c.update()
    print(f"BODY {name}: roll {math.degrees(min(roll)):.2f}..{math.degrees(max(roll)):.2f} deg")
    # wheels: the long version's spin is far too slow here (spokes looked frozen), but true
    # road speed (115-141 deg/frame) strobes: the rim repeats every 60 deg (6 split spokes,
    # 6 lug nuts), so the pattern flicked back and forth. A steady 60*k + 15 deg per frame
    # reads as rolling forward for spokes, nuts and centre logo alike.
    for w in (o for o in D.objects if o.name.startswith("WheelPivot_")):
        wfc = next(fc for fc in fcurves(w.animation_data.action)
                   if fc.data_path == "rotation_euler" and fc.array_index == 0)
        a0 = key(wfc, fr[0]).co.y
        sign = 1.0 if key(wfc, fr[-1]).co.y >= a0 else -1.0
        for i, f in enumerate(fr):
            key(wfc, f).co.y = a0 + sign * math.radians(WHEEL_STEP_DEG) * i
        wfc.update()
    # suspension: each wheel follows the road surface under it (the body above is smoothed),
    # travel limited to +-TRAVEL of the radius; tyre sits slightly squashed (SQUASH)
    car_rot = [Euler((roll[i], pitch[i], yaw[i])).to_matrix().to_4x4() for i in range(n)]
    for w in wheels:
        rest_c, par_rel, rest_loc = wheel_rest[w.name]
        dzs = []
        for i in range(n):
            m_car = Matrix.Translation(P[i]) @ car_rot[i]
            c = (m_car @ rest_c)
            o = road_inv @ Vector((c.x, c.y, c.z + 0.5))
            hit, loc, _, _ = road.ray_cast(o, road_down)
            dz = ((road.matrix_world @ loc).z + WHEEL_R * (1 - SQUASH)) - c.z if hit else 0.0
            dzs.append(max(-TRAVEL * WHEEL_R, min(TRAVEL * WHEEL_R, dz)))
        dzs = smooth(dzs, 1.5)
        for i, f in enumerate(fr):
            par_w = Matrix.Translation(P[i]) @ car_rot[i] @ par_rel
            w.location = rest_loc + par_w.inverted().to_3x3() @ Vector((0.0, 0.0, dzs[i]))
            w.keyframe_insert("location", frame=f)
        for f in (st - 1, st + n):                      # back to rest outside the shot
            w.location = rest_loc
            w.keyframe_insert("location", frame=f)
        w.location = rest_loc
        for fc in fcurves(w.animation_data.action):
            if fc.data_path == "location":
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        travel.append(max(abs(x) for x in dzs) / WHEEL_R * 100)
    cam = D.objects[cam_name]
    rigs = [(o, (o.matrix_parent_inverse @ Matrix.Translation(o.location)).translation.copy())
            for o in (cam, cam.constraints[0].target)]
    for o, off in rigs:
        o.parent = None
        o.animation_data_clear()
        for i, f in enumerate(fr):
            rot = Euler((0.0, pitch[i] * 0.5, yaw[i])).to_matrix()
            o.location = P[i] + rot @ off
            o.keyframe_insert("location", frame=f)
        for fc in fcurves(o.animation_data.action):     # linear like the car, so blur matches
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    cam_off = rigs[0][1]
    for i in range(n):
        camw = P[i] + Euler((0.0, 0.0, yaw[i])).to_matrix() @ cam_off
        cu_ribbon.append((P[i].x, P[i].y, camw.x, camw.y, i == 0))
        cu_path.append((P[i].x, P[i].y))
    print(f"CLOSEUP {name}: heading smoothed, {cam_name} baked to the steady car")

print("SUSPENSION max wheel travel %", [round(t, 1) for t in travel])

# motion blur only during the close-ups: it can't be keyframed, so freeze_tree_visibility.py
# (which renders one camera per segment) turns it on for these cameras at render time
sc["motion_blur_cameras"] = list(CU_CAMS)
sc["motion_blur_shutter"] = 0.5

# clear trees and town lights off the close-up roadsides and between camera and car
CU_ROAD_KM, CU_SIGHT_KM = 0.050, 0.016
verts, faces, edges = [], [], []
for k, (cx, cy, mx, my, first) in enumerate(cu_ribbon):
    verts += [(cx, cy, 0.0), (mx, my, 0.0)]
    if not first:
        a = 2 * (k - 1)
        faces.append((a, a + 2, a + 3, a + 1))
for nm in ("CU_Sight", "CU_Road"):
    if nm in D.objects:
        D.objects.remove(D.objects[nm], do_unlink=True)
sight_me = D.meshes.new("CU_Sight"); sight_me.from_pydata(verts, [], faces)
road_v = [(x, y, 0.0) for x, y in cu_path]
road_e = [(i, i + 1) for i in range(len(road_v) - 1)
          if (Vector(road_v[i]) - Vector(road_v[i + 1])).length < 0.05]     # not across shot cuts
road_me = D.meshes.new("CU_Road"); road_me.from_pydata(road_v, road_e, [])
helpers = {}
for nm, me in (("CU_Sight", sight_me), ("CU_Road", road_me)):
    o = D.objects.new(nm, me); D.collections["Map"].objects.link(o)
    o.hide_render = o.hide_viewport = True; helpers[nm] = o

def add_clearing(g):
    N, L = g.nodes, g.links
    dele = N["Delete Geometry"]
    sel = dele.inputs["Selection"]
    prev = sel.links[0].from_socket if sel.is_linked else None
    pos = N.new("GeometryNodeInputPosition")
    flat = N.new("ShaderNodeVectorMath"); flat.operation = 'MULTIPLY'; flat.inputs[1].default_value = (1, 1, 0)
    L.new(pos.outputs[0], flat.inputs[0])
    out = prev
    for nm, dom, dist in (("CU_Sight", 'FACES', CU_SIGHT_KM), ("CU_Road", 'EDGES', CU_ROAD_KM)):
        info = N.new("GeometryNodeObjectInfo"); info.inputs["Object"].default_value = helpers[nm]
        info.transform_space = 'RELATIVE'
        prox = N.new("GeometryNodeProximity"); prox.target_element = dom
        L.new(info.outputs["Geometry"], prox.inputs[0]); L.new(flat.outputs[0], prox.inputs["Sample Position"])
        near = N.new("ShaderNodeMath"); near.operation = 'LESS_THAN'; near.inputs[1].default_value = dist
        L.new(prox.outputs["Distance"], near.inputs[0])
        if out is None:
            out = near.outputs[0]
        else:
            mx = N.new("ShaderNodeMath"); mx.operation = 'MAXIMUM'
            L.new(out, mx.inputs[0]); L.new(near.outputs[0], mx.inputs[1]); out = mx.outputs[0]
    L.new(out, sel)
    return dele.inputs["Geometry"].links[0].from_node.bl_idname if dele.inputs["Geometry"].is_linked else None

print("CLEARED trees, fed by", add_clearing(D.node_groups["TreeScatter"]))
tl = D.node_groups["TownLights"]
src = tl.nodes["Delete Geometry"].inputs["Geometry"].links[0].from_node.bl_idname
if src == "GeometryNodeDistributePointsOnFaces":
    add_clearing(tl); print("CLEARED town lights")
else:
    print("SKIPPED town lights: delete runs on", src)

# --- camera cuts ---
sc.timeline_markers.clear()
for (name, n, cam, *_), s in zip(SHOTS, starts):
    m = sc.timeline_markers.new(name, frame=s); m.camera = D.objects[cam]
sc.frame_start, sc.frame_end = 1, TOTAL
sc.frame_set(1)

# --- textures out of the temp folder into blender/assets ---
moved = 0
for im in D.images:
    p = bpy.path.abspath(im.filepath) if im.filepath else ""
    if p.startswith(("/private/tmp", "/tmp")) and os.path.exists(p):
        rel = p.split("/scratchpad/", 1)[-1]
        dst = os.path.join(ASSETS, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst):
            shutil.copy2(p, dst)
        im.filepath = dst
        moved += 1
print("TEXTURES moved to assets:", moved)

sc.render.filepath = os.path.join(RENDERS, "exr", "burrows30_")

# timing map for make_comp30.py (the comp's mist is keyed to the long timeline too)
import json
json.dump({"motion": motion_map, "light": light_map,
           "shots": [{"name": s[0], "start": st, "frames": s[1]} for s, st in zip(SHOTS, starts)]},
          open(os.path.join(HERE, "cut30_maps.json"), "w"))
bpy.ops.wm.save_as_mainfile(filepath=OUTFILE)
print("CUT30_OK", OUTFILE, "frames", TOTAL)
