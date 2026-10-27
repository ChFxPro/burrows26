"""Drive timing, vehicle bake, progress trail, chase/overview cameras, shot-dependent visibility."""
import bpy, json, math, os
import numpy as np
D = bpy.data; sc = bpy.context.scene
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "source", "out")  # build data (scripts/build/prep*.py write it)
FPS = 24
CAR_SCALE = 0.0072            # metres -> km at 7.2x hyperreal
LANE_OFFSET = -0.0075         # drive in the right-hand lane
V_SLOW, V_FAST, SIGMA = 0.30, 3.2, 1.1     # km/s, km/s, km
INTRO, OUTRO = 120, 160       # overview frames before/after the drive
SLOW_STOPS = ["Brevard", "Cashiers", "Cullowhee", "Sylva", "Cherokee", "Bryson City"]

vec = json.load(open(f"{OUT}/vectors.json"))
WKM, HKM = vec["map"]["w"], vec["map"]["h"]
rc = np.load(f"{OUT}/route_center.npy").astype(float)
seg = np.hypot(*np.diff(rc[:, :2], axis=0).T); dist = np.r_[0, np.cumsum(seg)]; LR = dist[-1]

# ---------- surface height (max of base and corridor cells) for camera clearance ----------
HB = np.load(f"{OUT}/height_mesh.npy")
def bil(G, x, y, x0, y1, w, h):
    ny, nx = G.shape
    px = np.clip((x - x0) / w * (nx - 1), 0, nx - 1.001); py = np.clip((y1 - y) / h * (ny - 1), 0, ny - 1.001)
    a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = px - a; fy = py - b
    return G[b, a] * (1 - fx) * (1 - fy) + G[b, a + 1] * fx * (1 - fy) + G[b + 1, a] * (1 - fx) * fy + G[b + 1, a + 1] * fx * fy
cmeta = json.load(open(f"{OUT}/cells/cells.json"))["cells"]
cgrid = {(c["i"], c["j"]): (np.load(f"{OUT}/cells/z_{c['i']}_{c['j']}.npy"), c["box"]) for c in cmeta}
def surf(x, y):
    x = np.atleast_1d(np.asarray(x, float)); y = np.atleast_1d(np.asarray(y, float))
    z = bil(HB, x, y, -WKM / 2, HKM / 2, WKM, HKM)
    ci = np.floor((x + WKM / 2) / 2.0).astype(int); cj = np.floor((HKM / 2 - y) / 2.0).astype(int)
    for k in set(zip(ci.tolist(), cj.tolist())):
        if k in cgrid:
            G, (x0, y0, x1, y1) = cgrid[k]; m = (ci == k[0]) & (cj == k[1])
            z[m] = np.maximum(z[m], bil(G, x[m], y[m], x0, y1, 2.0, 2.0))
    return z + 0.03   # tree canopy allowance

def at(s, arr):
    return np.stack([np.interp(s, dist, arr[:, i]) for i in range(arr.shape[1])], -1)
def smooth(a, k):
    a = np.asarray(a, float)
    if a.ndim == 1: return np.convolve(np.pad(a, (k // 2, k // 2), mode='edge'), np.ones(k) / k, 'valid')
    return np.stack([smooth(a[:, i], k) for i in range(a.shape[1])], -1)

# ---------- speed profile ----------
places = {p["name"]: p["xy"] for p in vec["places"]}
stop_s = []
for nm in SLOW_STOPS:
    x, y = places[nm]; stop_s.append(dist[int(np.argmin(np.hypot(rc[:, 0] - x, rc[:, 1] - y)))])
stop_s = np.array(stop_s)
def v_of(s):
    w = np.max(np.exp(-((s - stop_s) / SIGMA) ** 2))
    return V_FAST - (V_FAST - V_SLOW) * w
s_list = [0.0]; v_list = [0.0]
ramp = 36  # frames to accelerate from rest
f = 0
while s_list[-1] < LR:
    f += 1
    v = v_of(s_list[-1]) * min(1.0, (f / ramp) ** 2 + 0.02)
    # ease into the final stop
    rem = LR - s_list[-1]
    v = min(v, max(0.02, rem * 1.6))
    s_list.append(min(LR, s_list[-1] + v / FPS)); v_list.append(v)
    if rem < 0.003: break
DRIVE = len(s_list)
F0 = INTRO - 30                      # car starts moving shortly before the cut to chase
F_END = F0 + DRIVE + OUTRO
frames = np.arange(1, F_END + 1)
s_f = np.concatenate([np.zeros(F0 - 1), s_list, np.full(F_END - (F0 - 1) - DRIVE, LR)])[:F_END]
v_f = np.concatenate([np.zeros(F0 - 1), v_list, np.zeros(F_END - (F0 - 1) - DRIVE)])[:F_END]
v_s = smooth(v_f, 25)
CHASE0, CHASE1 = INTRO, F0 + DRIVE + 24
sc.frame_start, sc.frame_end, sc.render.fps = 1, F_END, FPS

# ---------- vehicle ----------
car = D.objects["Burrows_Vehicle"]; car.animation_data_clear(); car.constraints.clear()
D.objects["Vehicle_Scale"].scale = (CAR_SCALE,) * 3
rs = smooth(rc, 7)
tang = np.gradient(rs[:, :2], axis=0); tang /= np.linalg.norm(tang, axis=1, keepdims=True)
nrm = np.stack([-tang[:, 1], tang[:, 0]], -1)
lane = rc.copy(); lane[:, :2] += nrm * LANE_OFFSET
p = at(s_f, lane)
ah = at(np.minimum(s_f + 0.012, LR), rs); bh = at(np.maximum(s_f - 0.012, 0), rs)
d = ah - bh
yaw = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
pitch = -np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1]))
for i, fr in enumerate(frames):
    car.location = p[i]; car.rotation_euler = (0, pitch[i], yaw[i])
    car.keyframe_insert("location", frame=int(fr)); car.keyframe_insert("rotation_euler", frame=int(fr))
# wheel spin follows distance travelled
wr = 0.4 * CAR_SCALE
spin = s_f / wr
for i in range(4):
    for nm in (f"Wheel_{i}", f"Rim_{i}"):
        o = D.objects.get(nm)
        if not o: continue
        o.driver_remove("rotation_euler", 1)
        o.animation_data_clear() if o.animation_data and o.animation_data.action else None
        for k in range(0, len(frames), 2):
            o.rotation_euler[1] = -spin[k] % (2 * math.pi) if False else -spin[k]
            o.keyframe_insert("rotation_euler", index=1, frame=int(frames[k]))

# ---------- progress trail ----------
tr_old = D.objects.get("Route_Trail")
if tr_old: D.objects.remove(tr_old, do_unlink=True)
tc = D.curves.new("RouteTrail", 'CURVE'); tc.dimensions = '3D'
spl = tc.splines.new('POLY'); spl.points.add(len(rc) - 1)
spl.points.foreach_set("co", np.c_[rc[:, :2], rc[:, 2] + 0.0035, np.ones(len(rc))].ravel())
tc.bevel_depth = 0.004; tc.bevel_resolution = 2; tc.bevel_factor_mapping_end = 'SPLINE'
tm = D.materials["MAT_RouteTrail"]; tc.materials.append(tm)
trail = D.objects.new("Route_Trail", tc); D.collections["Route"].objects.link(trail)
for i in range(0, len(frames), 2):
    tc.bevel_factor_end = float(s_f[i] / LR); tc.keyframe_insert("bevel_factor_end", frame=int(frames[i]))
for fr, v in ((1, 0.22), (CHASE0 - 1, 0.22), (CHASE0, 0.0035), (CHASE1 - 1, 0.0035), (CHASE1, 0.22)):
    tc.bevel_depth = v; tc.keyframe_insert("bevel_depth", frame=fr)

# ---------- chase camera ----------
cam = D.objects.get("CAM_Chase")
cam.animation_data_clear(); cam.constraints.clear(); cam.data.lens = 32; cam.data.clip_start = 0.004; cam.data.clip_end = 400
Rsm = smooth(rc, 161)                       # very smooth guide line (~0.8 km)
h = 0.12 + 0.72 * v_s                       # height above car grows with speed
lag = 0.22 + 0.48 * v_s
side = 0.06 + 0.12 * v_s
cs = np.maximum(s_f - lag, 0)
cp = at(cs, Rsm)
cd = at(np.minimum(cs + 0.3, LR), Rsm) - cp
cd[:, :2] /= np.linalg.norm(cd[:, :2], axis=1, keepdims=True) + 1e-9
cp[:, :2] += np.stack([cd[:, 1], -cd[:, 0]], -1) * side[:, None]
cp[:, 2] = p[:, 2] + h
# clearance along the line of sight to the car
ts = np.linspace(0, 1, 18)
for i in range(len(cp)):
    q = cp[i, :2][None] * (1 - ts[:, None]) + p[i, :2][None] * ts[:, None]
    zl = cp[i, 2] * (1 - ts) + (p[i, 2] + 0.01) * ts
    need = np.max(surf(q[:, 0], q[:, 1])[:-2] - zl[:-2]) if len(ts) > 2 else 0
    if need > 0: cp[i, 2] += need + 0.04
cp[:, 2] = np.maximum(cp[:, 2], surf(cp[:, 0], cp[:, 1]) + 0.06)
cp = smooth(cp, 37)
tg = D.objects.get("CAM_Chase_Target") or D.objects.new("CAM_Chase_Target", None)
if tg.name not in sc.collection.objects: sc.collection.objects.link(tg)
tg.animation_data_clear()
look = at(np.minimum(s_f + 0.03 + 0.25 * v_s, LR), rs)
look = smooth(look * 0.5 + p * 0.5, 13)
for i, fr in enumerate(frames):
    cam.location = cp[i]; cam.keyframe_insert("location", frame=int(fr))
    tg.location = look[i]; tg.keyframe_insert("location", frame=int(fr))
c = cam.constraints.new('TRACK_TO'); c.target = tg; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

# ---------- overview camera ----------
ov = D.objects["CAM_Overview"]; ov.animation_data_clear()
for fr, loc in ((1, (26, -96, 70)), (CHASE0, (20, -84, 60)), (CHASE1, (-2, -88, 66)), (F_END, (-6, -80, 58))):
    ov.location = loc; ov.keyframe_insert("location", frame=fr)
sc.timeline_markers.clear()
for fr, cm in ((1, ov), (CHASE0, cam), (CHASE1, ov)):
    m = sc.timeline_markers.new(f"cut_{cm.name}", frame=fr); m.camera = cm
sc.camera = ov

# ---------- shot-dependent sizes ----------
def keyset(obj, path, pairs, const=True):
    for fr, val in pairs:
        setattr(obj, path, val); obj.keyframe_insert(path, frame=fr)
    if const and obj.animation_data and obj.animation_data.action:
        act = obj.animation_data.action
        fcs = act.fcurves if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]
        for fc in fcs:
            if fc.data_path == path:
                for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
cuts = lambda big, small: ((1, big), (CHASE0, small), (CHASE1, big))
for o in D.collections["Town_Pins"].objects:
    if o.name.startswith("Pin_"):
        o.animation_data_clear(); keyset(o, "scale", cuts((2.0,) * 3, (0.12,) * 3))
for o in D.collections["Labels"].objects:
    o.animation_data_clear(); keyset(o, "scale", cuts((1.0,) * 3, (0.0,) * 3))
bc = D.objects.get("Vehicle_Beacon")
if bc: bc.animation_data_clear(); keyset(bc, "scale", cuts((1.0,) * 3, (0.0,) * 3))
for o in D.objects:
    if o.name.startswith("TownLabel_") and len(o.constraints) > 1:
        c2 = o.constraints["Face_Overview"]
        if o.animation_data: o.animation_data_clear()
        for fr, v in cuts(1.0, 0.0):
            c2.influence = v; c2.keyframe_insert("influence", frame=fr)

# ---------- trees only near the action (memory) ----------
ccent = {o.name: (o.data.vertices[0].co.x + 1.0, o.data.vertices[0].co.y - 1.0) for o in D.collections["Corridor_HiRes"].objects}
step = 6
for o in D.collections["Corridor_HiRes"].objects:
    m = o.modifiers["Trees"]
    if o.animation_data: o.animation_data_clear()
    cx, cy = ccent[o.name]
    dd = np.minimum(np.hypot(p[:, 0] - cx, p[:, 1] - cy), np.hypot(cp[:, 0] - cx, cp[:, 1] - cy))
    on = (dd < 3.2 + 0.6 * v_s) & (frames >= CHASE0) & (frames < CHASE1)
    prev = None
    for k in range(0, len(frames), step):
        val = bool(on[max(0, k - step):k + step].any())
        if val != prev:
            m.show_render = val; m.keyframe_insert("show_render", frame=int(frames[k])); prev = val
INFO = {"frames": int(F_END), "seconds": round(F_END / FPS, 1), "drive_frames": DRIVE, "route_km": round(LR, 1),
        "chase": [int(CHASE0), int(CHASE1)], "stops_km": [round(x, 1) for x in stop_s]}
