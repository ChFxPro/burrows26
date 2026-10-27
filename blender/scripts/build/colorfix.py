"""Even out large-scale colour patchwork in the satellite mosaic; apply the same smooth correction to corridor cells."""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from geo import *
OUT = sys.argv[1]
Image.MAX_IMAGE_PIXELS = None
src = f"{OUT}/base_sat_orig.jpg"
if not os.path.exists(src): os.rename(f"{OUT}/base_sat.jpg", src)
base = Image.open(src).convert("RGB")
BW, BH = base.size
small = base.resize((BW // 8, BH // 8), Image.BILINEAR)
s = np.asarray(small, np.float32)
blur = np.asarray(small.filter(ImageFilter.GaussianBlur(14)), np.float32)   # ~2 km scale
mask = np.asarray(Image.open(f"{OUT}/county_mask.png").resize(small.size).filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
inside_mean = (blur * mask).sum((0, 1)) / mask.sum()
outside_mean = (blur * (1 - mask)).sum((0, 1)) / (1 - mask).sum()
region_mean = inside_mean * mask + outside_mean * (1 - mask)
target = 0.3 * blur + 0.7 * region_mean
ratio = np.clip(target / np.maximum(blur, 1), 0.5, 2.0)          # smooth field
ratio_img = [Image.fromarray(ratio[..., c].astype(np.float32), mode="F") for c in range(3)]
def ratio_at(x, y):
    """Sample the smooth correction field at map km coords."""
    h, w = ratio.shape[:2]
    px = np.clip((x + WKM / 2) / WKM * (w - 1), 0, w - 1.001); py = np.clip((HKM / 2 - y) / HKM * (h - 1), 0, h - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
    R = ratio
    return R[y0, x0] * (1 - fx) * (1 - fy) + R[y0, x0 + 1] * fx * (1 - fy) + R[y0 + 1, x0] * (1 - fx) * fy + R[y0 + 1, x0 + 1] * fx * fy
# full-res base
rows = []
b = np.asarray(base, np.float32)
for r0 in range(0, BH, 512):
    yy = np.linspace(HKM / 2, -HKM / 2, BH)[r0:r0 + 512]; xx = np.linspace(-WKM / 2, WKM / 2, BW)
    X, Y = np.meshgrid(xx, yy)
    rows.append(np.clip(b[r0:r0 + 512] * ratio_at(X, Y), 0, 255))
Image.fromarray(np.concatenate(rows).astype(np.uint8)).save(f"{OUT}/base_sat.jpg", quality=92)
# cells
meta = json.load(open(f"{OUT}/cells/cells.json"))
for c in meta["cells"]:
    p = f"{OUT}/cells/tex_{c['i']}_{c['j']}.jpg"
    po = p.replace(".jpg", "_orig.jpg")
    if not os.path.exists(po): os.rename(p, po)
    im = np.asarray(Image.open(po).convert("RGB"), np.float32)
    x0, y0, x1, y1 = c["box"]
    X, Y = np.meshgrid(np.linspace(x0, x1, im.shape[1]), np.linspace(y1, y0, im.shape[0]))
    Image.fromarray(np.clip(im * ratio_at(X, Y), 0, 255).astype(np.uint8)).save(p, quality=90)
print("inside", inside_mean, "outside", outside_mean)
