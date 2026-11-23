"""Satellite base texture, hi-res corridor cells with graded roadbed, and road geometry."""
import sys, os, json, math
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from geo import *

D, OUT = sys.argv[1], sys.argv[2]
CD = f"{OUT}/cells"; os.makedirs(CD, exist_ok=True)
vec = json.load(open(f"{OUT}/vectors.json"))
EMIN = vec["map"]["emin"]
ROAD_W = 0.032        # hyperreal route width (km)
HWY_W = 0.020
GRADE_IN, GRADE_OUT = ROAD_W / 2 + 0.014, ROAD_W / 2 + 0.05
CELL_N = 101          # verts per cell side (20 m)
TEX = 1024

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

# ---------- base height grid (same as current Blender terrain) ----------
HB = np.load(f"{OUT}/height_mesh.npy"); BNY, BNX = HB.shape
def bil(G, x, y):
    ny, nx = G.shape
    px = np.clip((np.asarray(x) + WKM / 2) / WKM * (nx - 1), 0, nx - 1.001)
    py = np.clip((HKM / 2 - np.asarray(y)) / HKM * (ny - 1), 0, ny - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = px - x0; fy = py - y0
    return G[y0, x0] * (1 - fx) * (1 - fy) + G[y0, x0 + 1] * fx * (1 - fy) + G[y0 + 1, x0] * (1 - fx) * fy + G[y0 + 1, x0 + 1] * fx * fy

# ---------- route (true alignment, 5 m spacing) ----------
def resample(p, step):
    p = np.asarray(p, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    t = np.linspace(0, d[-1], int(d[-1] / step) + 1)
    return np.stack([np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])], -1)
def smooth1(a, k):
    return np.convolve(np.pad(a, (k // 2, k // 2), mode='edge'), np.ones(k) / k, 'valid')
rt = resample(vec["route"], 0.005)
# remove tiny zig-zags but stay on the real road (15 m window), then resample evenly
rt = np.stack([smooth1(rt[:, 0], 5), smooth1(rt[:, 1], 5)], -1)
rt = resample(rt, 0.005)
tree = cKDTree(rt)

# ---------- hi-res DEM sampler (terrarium z15) ----------
dem = {}
for f in os.listdir(f"{D}/dem15"):
    if f.endswith(".png"):
        x, y = map(int, f[:-4].split("_"))
        a = np.asarray(Image.open(f"{D}/dem15/{f}").convert("RGB"), np.float32)
        dem[(x, y)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
def sample_tiles(store, z, lon, lat, size=256, ch=None):
    tx, ty = merc(lon, lat, z)
    px = tx * size - 0.5; py = ty * size - 0.5
    x0 = np.floor(px).astype(np.int64); y0 = np.floor(py).astype(np.int64)
    fx = px - x0; fy = py - y0
    def get(xx, yy):
        out = np.zeros(xx.shape + ((ch,) if ch else ()), np.float32)
        kx = xx // size; ky = yy // size
        keys = set(zip(kx.ravel().tolist(), ky.ravel().tolist()))
        for k in keys:
            m = (kx == k[0]) & (ky == k[1])
            t = store.get(k)
            if t is None: continue
            out[m] = t[yy[m] - k[1] * size, xx[m] - k[0] * size]
        return out
    a = get(x0, y0); b = get(x0 + 1, y0); c = get(x0, y0 + 1); d = get(x0 + 1, y0 + 1)
    if ch: fx = fx[..., None]; fy = fy[..., None]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
def hires_z(x, y):
    lon, lat = to_ll(x, y)
    return (sample_tiles(dem, 15, lon, lat) - EMIN) / 1000 * VEX

# road vertical profile: DEM along the centreline, smoothed (~150 m)
zr = hires_z(rt[:, 0], rt[:, 1])
zr = smooth1(zr, 31)
print("route pts", len(rt), "km", len(rt) * 0.005)

# ---------- base terrain lowered under the corridor ----------
bx = np.linspace(-WKM / 2, WKM / 2, BNX); by = np.linspace(HKM / 2, -HKM / 2, BNY)
BX, BY = np.meshgrid(bx, by)
bd, _ = tree.query(np.c_[BX.ravel(), BY.ravel()], distance_upper_bound=1.0)
bd = np.minimum(bd, 1.0).reshape(BNY, BNX)
HL = (HB - 0.15 * smoothstep(0.88, 0.5, bd)).astype(np.float32)
np.save(f"{OUT}/height_mesh_lowered.npy", HL)

# ---------- county mask for dimming outside the three counties ----------
mask = np.asarray(Image.open(f"{OUT}/county_mask.png").filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
MH, MW = mask.shape
def mask_at(x, y):
    px = np.clip((np.asarray(x) + WKM / 2) / WKM * (MW - 1), 0, MW - 1).astype(int)
    py = np.clip((HKM / 2 - np.asarray(y)) / HKM * (MH - 1), 0, MH - 1).astype(int)
    return mask[py, px]
def grade(rgb, m):
    """Satellite colour grade; dim + desaturate outside the counties."""
    rgb = np.clip((rgb / 255.0 - 0.5) * 1.12 + 0.5, 0, 1) ** 1.05
    g = rgb.mean(-1, keepdims=True)
    rgb = g + (rgb - g) * 1.15
    out = g * 0.45 + rgb * 0.2 + np.array([0.0, 0.01, 0.03])
    m = m[..., None]
    return np.clip(rgb * m + out * (1 - m), 0, 1)

# ---------- base satellite texture (z13, ~16 m/px) ----------
img13 = {}
for f in os.listdir(f"{D}/img13"):
    if f.endswith(".jpg"):
        x, y = map(int, f[:-4].split("_"))
        img13[(x, y)] = np.asarray(Image.open(f"{D}/img13/{f}").convert("RGB"), np.float32)
BW = 8192; BH = int(BW * HKM / WKM)
gx, gy = np.meshgrid(np.linspace(-WKM / 2, WKM / 2, BW, dtype=np.float32), np.linspace(HKM / 2, -HKM / 2, BH, dtype=np.float32))
rows = []
for r0 in range(0, BH, 512):
    sx, sy = gx[r0:r0 + 512], gy[r0:r0 + 512]
    lon, lat = to_ll(sx, sy)
    rgb = sample_tiles(img13, 13, lon, lat, ch=3)
    rows.append(grade(rgb, mask_at(sx, sy)))
base = np.concatenate(rows)
Image.fromarray((base * 255).astype(np.uint8)).save(f"{OUT}/base_sat.jpg", quality=92)
del base, rows, gx, gy, img13
print("base texture", BW, BH)

# ---------- corridor cells ----------
img16 = {}
def load16(keys):
    for k in keys:
        if k not in img16:
            p = f"{D}/img16/{k[0]}_{k[1]}.jpg"
            img16[k] = np.asarray(Image.open(p).convert("RGB"), np.float32) if os.path.exists(p) else None
cs = cells(OUT)
cell_meta = []
cgrids = {}
for (i, j, x0, y0, x1, y1) in cs:
    xs = np.linspace(x0, x1, CELL_N); ys = np.linspace(y1, y0, CELL_N)   # row 0 = north
    X, Y = np.meshgrid(xs, ys)
    zh = hires_z(X, Y)
    d, idx = tree.query(np.c_[X.ravel(), Y.ravel()])
    d = d.reshape(X.shape); idx = idx.reshape(X.shape)
    # graded roadbed
    wr = smoothstep(GRADE_OUT, GRADE_IN, d)
    z = zh * (1 - wr) + (zr[idx] - 0.0015) * wr
    # fade to the base surface away from the route, never dipping below it
    zb = bil(HL, X, Y) + 0.004
    wb = smoothstep(CORE, FADE, d)
    z = z * (1 - wb) + zb * wb
    z = np.where(d > 0.25, np.maximum(z, zb), z)
    cgrids[(i, j)] = z.astype(np.float32)
    np.save(f"{CD}/z_{i}_{j}.npy", z.astype(np.float32))
    # texture
    tx_ = np.linspace(x0, x1, TEX, dtype=np.float32); ty_ = np.linspace(y1, y0, TEX, dtype=np.float32)
    TX, TY = np.meshgrid(tx_, ty_)
    lon, lat = to_ll(TX, TY)
    mx, my = merc(lon, lat, 16)
    need = {(a, b) for a in range(int(mx.min()) - 1, int(mx.max()) + 2) for b in range(int(my.min()) - 1, int(my.max()) + 2)}
    load16(need)
    store = {k: v for k, v in img16.items() if v is not None}
    rgb = sample_tiles(store, 16, lon, lat, ch=3)
    rgb = grade(rgb, mask_at(TX, TY))
    Image.fromarray((rgb * 255).astype(np.uint8)).save(f"{CD}/tex_{i}_{j}.jpg", quality=90)
    cell_meta.append({"i": i, "j": j, "box": [x0, y0, x1, y1]})
    if len(img16) > 900: img16.clear()
json.dump({"cells": cell_meta, "n": CELL_N}, open(f"{CD}/cells.json", "w"))
print("cells", len(cell_meta))

# ---------- surface height lookup (corridor cells first, else base) ----------
def surf(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    z = bil(HB, x, y)
    ci = np.floor((x + WKM / 2) / CELL).astype(int); cj = np.floor((HKM / 2 - y) / CELL).astype(int)
    for (i, j), G in cgrids.items():
        m = (ci == i) & (cj == j)
        if not m.any(): continue
        x0 = -WKM / 2 + i * CELL; y1 = HKM / 2 - j * CELL
        px = np.clip((x[m] - x0) / CELL * (CELL_N - 1), 0, CELL_N - 1.001); py = np.clip((y1 - y[m]) / CELL * (CELL_N - 1), 0, CELL_N - 1.001)
        a0 = np.floor(px).astype(int); b0 = np.floor(py).astype(int); fx = px - a0; fy = py - b0
        z[m] = G[b0, a0] * (1 - fx) * (1 - fy) + G[b0, a0 + 1] * fx * (1 - fy) + G[b0 + 1, a0] * (1 - fx) * fy + G[b0 + 1, a0 + 1] * fx * fy
    return z

# ---------- route road geometry ----------
t = np.gradient(rt, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True)
n = np.stack([-t[:, 1], t[:, 0]], -1)
offs = np.array([-ROAD_W / 2 - 0.004, -ROAD_W / 2, ROAD_W / 2, ROAD_W / 2 + 0.004])
lifts = np.array([0.0004, 0.0015, 0.0015, 0.0004])
V = np.zeros((len(rt), 4, 3), np.float32)
for k, (o, l) in enumerate(zip(offs, lifts)):
    V[:, k, :2] = rt + n * o
    V[:, k, 2] = zr + l
np.save(f"{OUT}/route_road_verts.npy", V)
np.save(f"{OUT}/route_center.npy", np.c_[rt, zr + 0.0015].astype(np.float32))

# ---------- other highways: drape on the surface, skip parts overlapping the route ----------
hw = []
for r in vec["roads"]:
    if r["cls"] not in ("motorway", "trunk", "primary"): continue
    p = resample(r["pts"], 0.01) if len(r["pts"]) > 1 else None
    if p is None or len(p) < 2: continue
    dd, _ = tree.query(p)
    keep = dd > ROAD_W
    # split into runs
    runs, cur = [], []
    for q, k in zip(p, keep):
        if k: cur.append(q)
        elif len(cur) > 1: runs.append(np.array(cur)); cur = []
        else: cur = []
    if len(cur) > 1: runs.append(np.array(cur))
    for run in runs:
        tt = np.gradient(run, axis=0); tt /= np.linalg.norm(tt, axis=1, keepdims=True) + 1e-9
        nn = np.stack([-tt[:, 1], tt[:, 0]], -1)
        L = run + nn * HWY_W / 2; R = run - nn * HWY_W / 2
        zc = surf(run[:, 0], run[:, 1])
        zl = np.maximum(surf(L[:, 0], L[:, 1]), zc) + 0.0025
        zR = np.maximum(surf(R[:, 0], R[:, 1]), zc) + 0.0025
        hw.append(np.stack([np.c_[L, zl], np.c_[R, zR]], 1).astype(np.float32))
np.save(f"{OUT}/highways.npy", np.array(hw, dtype=object), allow_pickle=True)
print("highway runs", len(hw))
