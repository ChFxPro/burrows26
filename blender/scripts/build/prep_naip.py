"""NAIP re-texture: base map (~14 m), corridor cells (~2 m), 0.6 m roadside strips + strip meshes,
and per-cell distance-to-any-road for tree placement."""
import sys, os, json, math, glob
import numpy as np
from PIL import Image, ImageFilter
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from geo import *
Image.MAX_IMAGE_PIXELS = None
D, OUT = sys.argv[1], sys.argv[2]
NA = f"{D}/naip"
SD = f"{OUT}/strips"; os.makedirs(SD, exist_ok=True)
vec = json.load(open(f"{OUT}/vectors.json"))

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

# ---------- county mask + shared colour treatment ----------
mask = np.asarray(Image.open(f"{OUT}/county_mask.png").filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
MH, MW = mask.shape
def sample_map(G, x, y):
    h, w = G.shape[:2]
    px = np.clip((np.asarray(x) + WKM / 2) / WKM * (w - 1), 0, w - 1.001); py = np.clip((HKM / 2 - np.asarray(y)) / HKM * (h - 1), 0, h - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = px - x0; fy = py - y0
    if G.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    return G[y0, x0] * (1 - fx) * (1 - fy) + G[y0, x0 + 1] * fx * (1 - fy) + G[y0 + 1, x0] * (1 - fx) * fy + G[y0 + 1, x0 + 1] * fx * fy

def grade(rgb, x, y, ratio):
    """rgb 0..255 float. Patch flattening (smooth ratio field), mild contrast, dim outside counties."""
    rgb = rgb * sample_map(ratio, x, y)
    rgb = np.clip(rgb / 255.0, 0, 1)
    rgb = np.clip((rgb - 0.5) * 1.08 + 0.5, 0, 1)
    g = rgb.mean(-1, keepdims=True)
    rgb = g + (rgb - g) * 1.1
    out = g * 0.45 + rgb * 0.2 + np.array([0.0, 0.01, 0.03])
    m = sample_map(mask, x, y)[..., None]
    return np.clip(rgb * m + out * (1 - m), 0, 1)

# ---------- base mosaic from 0.1° tiles ----------
lons = np.arange(W, E, 0.1); lats = np.arange(S, N, 0.1)
TP = 640
mos = np.zeros((len(lats) * TP, len(lons) * TP, 3), np.float32)
for a in range(len(lons)):
    for b in range(len(lats)):
        p = f"{NA}/base/b_{a}_{b}.jpg"
        if os.path.exists(p):
            t = np.asarray(Image.open(p).convert("RGB").resize((TP, TP)), np.float32)
            r0 = (len(lats) - 1 - b) * TP
            mos[r0:r0 + TP, a * TP:(a + 1) * TP] = t
lon_max = lons[0] + len(lons) * 0.1; lat_max = lats[0] + len(lats) * 0.1
def mos_sample(lon, lat):
    px = (lon - lons[0]) / (lon_max - lons[0]) * mos.shape[1] - 0.5
    py = (lat_max - lat) / (lat_max - lats[0]) * mos.shape[0] - 0.5
    px = np.clip(px, 0, mos.shape[1] - 1.001); py = np.clip(py, 0, mos.shape[0] - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
    return mos[y0, x0] * (1 - fx) * (1 - fy) + mos[y0, x0 + 1] * fx * (1 - fy) + mos[y0 + 1, x0] * (1 - fx) * fy + mos[y0 + 1, x0 + 1] * fx * fy
BW = 8192; BH = int(BW * HKM / WKM)
xs = np.linspace(-WKM / 2, WKM / 2, BW, dtype=np.float32); ys = np.linspace(HKM / 2, -HKM / 2, BH, dtype=np.float32)
raw = np.zeros((BH, BW, 3), np.float32)
for r0 in range(0, BH, 512):
    X, Y = np.meshgrid(xs, ys[r0:r0 + 512]); lo, la = to_ll(X, Y)
    raw[r0:r0 + 512] = mos_sample(lo, la)
# smooth correction field (~2 km scale) evening out flight-line differences
small = Image.fromarray(np.clip(raw, 0, 255).astype(np.uint8)).resize((BW // 8, BH // 8), Image.BILINEAR)
blur = np.asarray(small.filter(ImageFilter.GaussianBlur(14)), np.float32)
msk = np.asarray(Image.open(f"{OUT}/county_mask.png").resize(small.size), np.float32)[..., None] / 255
inside = (blur * msk).sum((0, 1)) / max(msk.sum(), 1); outside = (blur * (1 - msk)).sum((0, 1)) / max((1 - msk).sum(), 1)
target = 0.45 * blur + 0.55 * (inside * msk + outside * (1 - msk))
ratio = np.clip(target / np.maximum(blur, 1), 0.6, 1.7).astype(np.float32)
np.save(f"{OUT}/naip_ratio.npy", ratio)
rows = []
for r0 in range(0, BH, 512):
    X, Y = np.meshgrid(xs, ys[r0:r0 + 512])
    rows.append(grade(raw[r0:r0 + 512], X, Y, ratio))
Image.fromarray((np.concatenate(rows) * 255).astype(np.uint8)).save(f"{OUT}/base_sat.jpg", quality=92)
del raw, rows, mos
print("base done")

# ---------- corridor cells (NAIP is lon/lat aligned, same as our km grid) ----------
meta = json.load(open(f"{OUT}/cells/cells.json"))
for c in meta["cells"]:
    p = f"{NA}/cells/c_{c['i']}_{c['j']}.jpg"
    if not os.path.exists(p): continue
    im = np.asarray(Image.open(p).convert("RGB").resize((1024, 1024), Image.LANCZOS), np.float32)
    x0, y0, x1, y1 = c["box"]
    X, Y = np.meshgrid(np.linspace(x0, x1, 1024), np.linspace(y1, y0, 1024))
    Image.fromarray((grade(im, X, Y, ratio) * 255).astype(np.uint8)).save(f"{OUT}/cells/tex_{c['i']}_{c['j']}.jpg", quality=90)
print("cells done")

# ---------- surface heights from corridor cells (for strip meshes) ----------
HB = np.load(f"{OUT}/height_mesh.npy")
cg = {}
for c in meta["cells"]:
    cg[(c["i"], c["j"])] = (np.load(f"{OUT}/cells/z_{c['i']}_{c['j']}.npy"), c["box"])
def surf(x, y):
    z = sample_map(HB, x, y)
    ci = np.floor((x + WKM / 2) / CELL).astype(int); cj = np.floor((HKM / 2 - y) / CELL).astype(int)
    for k in set(zip(ci.ravel().tolist(), cj.ravel().tolist())):
        if k not in cg: continue
        G, (x0, y0, x1, y1) = cg[k]; m = (ci == k[0]) & (cj == k[1]); n = G.shape[0]
        px = np.clip((x[m] - x0) / CELL * (n - 1), 0, n - 1.001); py = np.clip((y1 - y[m]) / CELL * (n - 1), 0, n - 1.001)
        a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = px - a; fy = py - b
        z[m] = G[b, a] * (1 - fx) * (1 - fy) + G[b, a + 1] * fx * (1 - fy) + G[b + 1, a] * (1 - fx) * fy + G[b + 1, a + 1] * fx * fy
    return z

# ---------- 0.6 m roadside strips ----------
BAND = 0.15; CH = 2.4; TU, TV = 4096, 512
boxes = {(b["i"], b["j"]): b for b in json.load(open(f"{NA}/boxes/boxes.json"))}
bimg = {}
def box_img(k):
    if k not in bimg:
        p = f"{NA}/boxes/n_{k[0]}_{k[1]}.jpg"
        bimg[k] = np.asarray(Image.open(p).convert("RGB"), np.float32) if os.path.exists(p) else None
        if len(bimg) > 40: bimg.pop(next(iter(bimg)))
    return bimg[k]
def naip_at(x, y):
    out = np.zeros(x.shape + (3,), np.float32); have = np.zeros(x.shape, bool)
    bi = np.floor((x + WKM / 2) / 1.2).astype(int); bj = np.floor((HKM / 2 - y) / 1.2).astype(int)
    for k in set(zip(bi.ravel().tolist(), bj.ravel().tolist())):
        im = box_img(k) if k in boxes else None
        if im is None: continue
        m = (bi == k[0]) & (bj == k[1]); x0, y0, x1, y1 = boxes[k]["km"]; n = im.shape[0]
        px = np.clip((x[m] - x0) / 1.2 * n - 0.5, 0, n - 1.001); py = np.clip((y1 - y[m]) / 1.2 * n - 0.5, 0, n - 1.001)
        a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = (px - a)[:, None]; fy = (py - b)[:, None]
        out[m] = im[b, a] * (1 - fx) * (1 - fy) + im[b, a + 1] * fx * (1 - fy) + im[b + 1, a] * (1 - fx) * fy + im[b + 1, a + 1] * fx * fy
        have[m] = True
    return out, have

rc = np.load(f"{OUT}/route_center.npy").astype(float)
dist = np.r_[0, np.cumsum(np.hypot(*np.diff(rc[:, :2], axis=0).T))]; L = dist[-1]
def smooth(a, k):
    return np.stack([np.convolve(np.pad(a[:, i], (k // 2, k // 2), mode='edge'), np.ones(k) / k, 'valid') for i in range(a.shape[1])], -1)
rsm = smooth(rc[:, :2], 9)
tang = np.gradient(rsm, axis=0); tang /= np.linalg.norm(tang, axis=1, keepdims=True)
nrm = np.stack([-tang[:, 1], tang[:, 0]], -1)
def frame_at(s):
    p = np.stack([np.interp(s, dist, rc[:, 0]), np.interp(s, dist, rc[:, 1])], -1)
    nn = np.stack([np.interp(s, dist, nrm[:, 0]), np.interp(s, dist, nrm[:, 1])], -1)
    nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    return p, nn
strips = []
k = 0
for s0 in np.arange(0, L, CH):
    s1 = min(L, s0 + CH)
    # texture
    sv = np.linspace(s0, s1, TU); ov = np.linspace(-BAND, BAND, TV)
    P, NN = frame_at(sv)
    X = P[None, :, 0] + NN[None, :, 0] * ov[:, None]; Y = P[None, :, 1] + NN[None, :, 1] * ov[:, None]
    rgb, have = naip_at(X, Y)
    if have.mean() < 0.5: k += 1; continue
    img = grade(rgb, X, Y, ratio)
    a = have.astype(np.float32)
    Image.fromarray((np.dstack([img, a[..., None]]) * 255).astype(np.uint8), "RGBA").save(f"{SD}/strip_{k:03d}.png")
    # mesh: 10 m along, 9 across
    sm = np.linspace(s0, s1, max(2, int((s1 - s0) / 0.01) + 1)); om = np.linspace(-BAND, BAND, 9)
    P, NN = frame_at(sm)
    MX = P[:, None, 0] + NN[:, None, 0] * om[None]; MY = P[:, None, 1] + NN[:, None, 1] * om[None]
    MZ = surf(MX.ravel(), MY.ravel()).reshape(MX.shape) + 0.0012
    U = np.broadcast_to(((sm - s0) / (s1 - s0))[:, None], MX.shape); V = np.broadcast_to(((om + BAND) / (2 * BAND))[None], MX.shape)
    np.savez_compressed(f"{SD}/strip_{k:03d}.npz", xyz=np.stack([MX, MY, MZ], -1).astype(np.float32), uv=np.stack([U, V], -1).astype(np.float32))
    strips.append(k); k += 1
json.dump({"strips": strips}, open(f"{SD}/strips.json", "w"))
print("strips", len(strips))

# ---------- distance to any road (route + highways + secondary) per cell vertex ----------
osm = json.load(open(f"{D}/osm.json"))
pts = [rc[:, :2]]
for e in osm["elements"]:
    if e["type"] == "way" and e.get("tags", {}).get("highway") in ("motorway", "trunk", "primary", "secondary", "tertiary"):
        q = np.array([[p["lon"], p["lat"]] for p in e["geometry"]])
        x, y = to_km(q[:, 0], q[:, 1]); pq = np.c_[x, y]
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(pq, axis=0).T))]
        if d[-1] < 1e-6: continue
        t = np.arange(0, d[-1], 0.008)
        pts.append(np.c_[np.interp(t, d, pq[:, 0]), np.interp(t, d, pq[:, 1])])
allroad = cKDTree(np.concatenate(pts))
for c in meta["cells"]:
    x0, y0, x1, y1 = c["box"]; n = 101
    X, Y = np.meshgrid(np.linspace(x0, x1, n), np.linspace(y1, y0, n))
    d, _ = allroad.query(np.c_[X.ravel(), Y.ravel()])
    np.save(f"{OUT}/cells/roadall_{c['i']}_{c['j']}.npy", d.astype(np.float32))
print("road distances done")
