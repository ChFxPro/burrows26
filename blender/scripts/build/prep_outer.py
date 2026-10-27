"""Outer terrain ring (~400 x 300 km) so the map never ends in view: heights blended into the main map at its border."""
import sys, os, math, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from geo import *
D, OUT = sys.argv[1], sys.argv[2]
vec = json.load(open(f"{OUT}/vectors.json")); EMIN = vec["map"]["emin"]
RX, RY = 200.0, 150.0
STEP = 0.4
HB = np.load(f"{OUT}/height_mesh.npy")

def load_tiles(folder, z, ext, dem):
    t = {}
    for f in os.listdir(folder):
        if not f.endswith(ext): continue
        x, y = map(int, f[:-len(ext)].split("_"))
        a = np.asarray(Image.open(f"{folder}/{f}").convert("RGB"), np.float32)
        t[(x, y)] = (a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768) if dem else a
    return t
def sample(store, z, lon, lat, ch):
    tx, ty = merc(lon, lat, z); px = tx * 256 - 0.5; py = ty * 256 - 0.5
    x0 = np.floor(px).astype(np.int64); y0 = np.floor(py).astype(np.int64); fx = px - x0; fy = py - y0
    def get(xx, yy):
        out = np.zeros(xx.shape + ((3,) if ch else ()), np.float32)
        kx, ky = xx // 256, yy // 256
        for k in set(zip(kx.ravel().tolist(), ky.ravel().tolist())):
            if k not in store: continue
            mm = (kx == k[0]) & (ky == k[1]); out[mm] = store[k][yy[mm] - k[1] * 256, xx[mm] - k[0] * 256]
        return out
    a, b, c, d = get(x0, y0), get(x0 + 1, y0), get(x0, y0 + 1), get(x0 + 1, y0 + 1)
    if ch: fx, fy = fx[..., None], fy[..., None]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
def bil_inner(x, y):
    ny, nx = HB.shape
    px = np.clip((x + WKM / 2) / WKM * (nx - 1), 0, nx - 1.001); py = np.clip((HKM / 2 - y) / HKM * (ny - 1), 0, ny - 1.001)
    a = np.floor(px).astype(int); b = np.floor(py).astype(int); fx = px - a; fy = py - b
    return HB[b, a] * (1 - fx) * (1 - fy) + HB[b, a + 1] * fx * (1 - fy) + HB[b + 1, a] * (1 - fx) * fy + HB[b + 1, a + 1] * fx * fy

dem = load_tiles(f"{D}/outer_dem", 9, ".png", True)
xs = np.arange(-RX, RX + 1e-6, STEP); ys = np.arange(RY, -RY - 1e-6, -STEP)
X, Y = np.meshgrid(xs, ys)
lon, lat = to_ll(X, Y)
Z = (sample(dem, 9, lon, lat, False) - EMIN) / 1000 * VEX
# distance outside the main map rectangle (0 inside)
ox = np.maximum(np.abs(X) - WKM / 2, 0); oy = np.maximum(np.abs(Y) - HKM / 2, 0)
dout = np.hypot(ox, oy)
inside = (np.abs(X) < WKM / 2) & (np.abs(Y) < HKM / 2)
zin = bil_inner(np.clip(X, -WKM / 2, WKM / 2), np.clip(Y, -HKM / 2, HKM / 2))
w = np.clip(1 - dout / 3.0, 0, 1); w = w * w * (3 - 2 * w)
Z = Z * (1 - w) + zin * w
Z = np.where(inside, zin - 0.12, Z)            # tucked under the main map
np.save(f"{OUT}/outer_z.npy", Z.astype(np.float32))
print("outer grid", Z.shape, float(Z.min()), float(Z.max()))

img = load_tiles(f"{D}/outer_img", 10, ".jpg", False)
TW, TH = 4096, int(4096 * RY / RX)
tx = np.linspace(-RX, RX, TW, dtype=np.float32); ty = np.linspace(RY, -RY, TH, dtype=np.float32)
rows = []
for r0 in range(0, TH, 256):
    TX, TY = np.meshgrid(tx, ty[r0:r0 + 256]); lo, la = to_ll(TX, TY)
    rgb = np.clip(sample(img, 10, lo, la, True) / 255.0, 0, 1)
    rgb = np.clip((rgb - 0.5) * 1.08 + 0.5, 0, 1)
    g = rgb.mean(-1, keepdims=True)
    rows.append(g * 0.45 + rgb * 0.2 + np.array([0.0, 0.01, 0.03]))   # same treatment as the dimmed area outside the counties
Image.fromarray((np.clip(np.concatenate(rows), 0, 1) * 255).astype(np.uint8)).save(f"{OUT}/outer_tex.jpg", quality=90)
json.dump({"RX": RX, "RY": RY, "STEP": STEP, "shape": list(Z.shape)}, open(f"{OUT}/outer_meta.json", "w"))
print("outer tex", TW, TH)
