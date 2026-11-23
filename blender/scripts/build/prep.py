"""Build heightmap, map texture and local-coordinate vector data for the Blender scene."""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = sys.argv[1]            # data dir
OUT = sys.argv[2]          # output dir
os.makedirs(OUT, exist_ok=True)

Z = 12
X0, X1, Y0, Y1 = 1092, 1108, 1612, 1622
W, E, S, N = -84.0, -82.53, 34.97, 35.73
LAT0, LON0 = (S + N) / 2, (W + E) / 2
KX = 111.32 * math.cos(math.radians(LAT0))
KY = 110.57
VEX = 2.0  # vertical exaggeration

def to_km(lon, lat):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)

# ---- mosaic (web mercator) ----
mos = np.zeros(((Y1 - Y0 + 1) * 256, (X1 - X0 + 1) * 256), np.float32)
for x in range(X0, X1 + 1):
    for y in range(Y0, Y1 + 1):
        a = np.asarray(Image.open(f"{D}/tiles/{Z}_{x}_{y}.png").convert("RGB"), np.float32)
        h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        mos[(y - Y0) * 256:(y - Y0 + 1) * 256, (x - X0) * 256:(x - X0 + 1) * 256] = h

def merc_px(lon, lat):
    n = 2 ** Z
    px = ((lon + 180) / 360 * n - X0) * 256
    r = np.radians(lat)
    py = ((1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n - Y0) * 256
    return px, py

def bilinear(img, px, py):
    px = np.clip(px, 0, img.shape[1] - 1.001); py = np.clip(py, 0, img.shape[0] - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int)
    fx = px - x0; fy = py - y0
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy)
            + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)

def sample_grid(nx, ny):
    lons = np.linspace(W, E, nx); lats = np.linspace(N, S, ny)  # row 0 = north
    LON, LAT = np.meshgrid(lons, lats)
    px, py = merc_px(LON, LAT)
    return bilinear(mos, px, py)

WKM, HKM = (E - W) * KX, (N - S) * KY
print("map km", WKM, HKM)

# texture-resolution height (~30 m)
TW = 4400; TH = int(TW * HKM / WKM)
hi = sample_grid(TW, TH)
hi = np.maximum(hi, 0)
# mesh-resolution height (~85 m)
MW = 1560; MH = int(MW * HKM / WKM)
lo = sample_grid(MW, MH)
EMIN = float(np.percentile(lo, 0.1))
print("elev", lo.min(), lo.max(), "base", EMIN, "mesh", MW, MH, "tex", TW, TH)
np.save(f"{OUT}/height_mesh.npy", ((lo - EMIN) / 1000 * VEX).astype(np.float32))
# also full-res height for sampling road elevations
np.save(f"{OUT}/height_hi.npy", ((hi - EMIN) / 1000 * VEX).astype(np.float32))

# ---- vectors ----
osm = json.load(open(f"{D}/osm.json"))
def geom_km(g):
    return [to_km(p["lon"], p["lat"]) for p in g]

counties = {}
for e in osm["elements"]:
    if e["type"] == "relation" and e["tags"].get("boundary") == "administrative":
        # stitch outer ways into rings
        segs = [[(p["lon"], p["lat"]) for p in m["geometry"]] for m in e["members"]
                if m["type"] == "way" and m.get("role") in ("outer", "") and "geometry" in m]
        rings = []
        while segs:
            ring = segs.pop(0)
            changed = True
            while changed and ring[0] != ring[-1]:
                changed = False
                for i, s in enumerate(segs):
                    if s[0] == ring[-1]: ring += s[1:]
                    elif s[-1] == ring[-1]: ring += s[::-1][1:]
                    elif s[-1] == ring[0]: ring = s[:-1] + ring
                    elif s[0] == ring[0]: ring = s[::-1][:-1] + ring
                    else: continue
                    segs.pop(i); changed = True; break
            rings.append(ring)
        rings.sort(key=len, reverse=True)
        counties[e["tags"]["name"].replace(" County", "")] = rings[0]

roads = []; rivers = []; lakes = []; places = []; peaks = []
for e in osm["elements"]:
    t = e.get("tags", {})
    if e["type"] == "way" and "highway" in t:
        roads.append({"cls": t["highway"], "ref": t.get("ref", ""), "name": t.get("name", ""),
                      "pts": [(p["lon"], p["lat"]) for p in e["geometry"]]})
    elif e["type"] == "way" and t.get("waterway") == "river":
        rivers.append({"name": t.get("name", ""), "pts": [(p["lon"], p["lat"]) for p in e["geometry"]]})
    elif t.get("natural") == "water":
        if e["type"] == "way":
            lakes.append({"name": t.get("name", ""), "rings": [[(p["lon"], p["lat"]) for p in e["geometry"]]]})
        else:
            rs = [[(p["lon"], p["lat"]) for p in m["geometry"]] for m in e["members"]
                  if m["type"] == "way" and m.get("role") == "outer" and "geometry" in m]
            lakes.append({"name": t.get("name", ""), "rings": rs, "multi": True})
    elif e["type"] == "node" and "place" in t:
        places.append({"name": t["name"].split(";")[0], "kind": t["place"], "ll": (e["lon"], e["lat"])})
    elif e["type"] == "node" and t.get("natural") == "peak":
        try: ele = float(str(t["ele"]).split()[0])
        except ValueError: continue
        peaks.append({"name": t["name"], "ele": ele, "ll": (e["lon"], e["lat"])})
places.append({"name": "Cashiers", "kind": "village", "ll": (-83.0960, 35.1112)})
places.append({"name": "Lake Toxaway", "kind": "village", "ll": (-82.9300, 35.1290)})
places.append({"name": "Western Carolina University", "kind": "campus", "ll": (-83.1857, 35.3087)})

route = json.load(open(f"{D}/route.json"))["routes"][0]["geometry"]["coordinates"]

# ---- point in polygon (county mask) ----
def tex_xy(lon, lat):
    return ((lon - W) / (E - W) * TW, (N - lat) / (N - S) * TH)

mask = Image.new("L", (TW, TH), 0)
md = ImageDraw.Draw(mask)
for name, ring in counties.items():
    md.polygon([tex_xy(*p) for p in ring], fill=255)
mask_soft = np.asarray(mask.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255

# ---- texture ----
cell = WKM * 1000 / TW
gy, gx = np.gradient(hi, cell)
# hillshade, sun from NW at 40 deg, slight exaggeration
az, alt = math.radians(315), math.radians(40)
slope = np.arctan(1.6 * np.hypot(gx, gy))
aspect = np.arctan2(-gx, gy)
hs = (np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect))
hs = np.clip(hs, 0, 1)

stops = [  # elevation m -> color (forested Appalachian palette)
    (400, (0.36, 0.50, 0.30)), (700, (0.30, 0.46, 0.26)), (1000, (0.27, 0.42, 0.24)),
    (1300, (0.33, 0.42, 0.27)), (1600, (0.45, 0.45, 0.33)), (1850, (0.58, 0.55, 0.45)),
    (2050, (0.80, 0.78, 0.74))]
col = np.zeros(hi.shape + (3,), np.float32)
el = np.clip(hi, stops[0][0], stops[-1][0])
for (e0, c0), (e1, c1) in zip(stops[:-1], stops[1:]):
    m = (el >= e0) & (el <= e1)
    f = ((el - e0) / (e1 - e0))[m][:, None]
    col[m] = np.array(c0) * (1 - f) + np.array(c1) * f
# subtle procedural canopy noise
rng = np.random.default_rng(7)
noise = np.asarray(Image.fromarray((rng.random((TH // 4, TW // 4)) * 255).astype(np.uint8))
                   .resize((TW, TH), Image.BICUBIC), np.float32) / 255
col *= (0.92 + 0.16 * noise)[..., None]
shade = 0.35 + 0.85 * hs
col *= shade[..., None]
# outside counties: desaturate + darken + cool tint
grey = col.mean(-1, keepdims=True)
outside = grey * 0.55 + col * 0.25 + np.array([0.02, 0.03, 0.05])
col = col * mask_soft[..., None] + outside * (1 - mask_soft[..., None])
img = Image.fromarray((np.clip(col, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8))

dr = ImageDraw.Draw(img, "RGBA")
WATER = (70, 130, 175, 255)
for lk in lakes:
    for r in lk["rings"]:
        if len(r) > 2: dr.polygon([tex_xy(*p) for p in r], fill=WATER)
for rv in rivers:
    w = 5 if rv["name"] in ("Tuckasegee River", "Little Tennessee River", "French Broad River", "Oconaluftee River") else 3
    dr.line([tex_xy(*p) for p in rv["pts"]], fill=WATER, width=w, joint="curve")
for rd in roads:
    if rd["cls"] == "secondary":
        dr.line([tex_xy(*p) for p in rd["pts"]], fill=(225, 215, 190, 200), width=3, joint="curve")
img.save(f"{OUT}/map_color.png")
mask.save(f"{OUT}/county_mask.png")

# ---- export vectors in km ----
def km_list(pts): return [list(to_km(*p)) for p in pts]
peaks.sort(key=lambda p: -p["ele"])
inside = lambda ll: mask.getpixel(tuple(int(v) for v in tex_xy(*ll))) > 0 if 0 <= tex_xy(*ll)[0] < TW and 0 <= tex_xy(*ll)[1] < TH else False
vec = {
    "map": {"w": WKM, "h": HKM, "mesh": [MW, MH], "hi": [TW, TH], "vex": VEX, "emin": EMIN},
    "counties": {k: km_list(v) for k, v in counties.items()},
    "roads": [{"cls": r["cls"], "ref": r["ref"], "pts": km_list(r["pts"])} for r in roads if r["cls"] != "secondary"],
    "places": [{"name": p["name"], "kind": p["kind"], "xy": to_km(*p["ll"]), "in": inside(p["ll"])} for p in places],
    "peaks": [{"name": p["name"], "ele": p["ele"], "xy": to_km(*p["ll"])} for p in peaks if inside(p["ll"])][:12],
    "route": km_list(route),
}
json.dump(vec, open(f"{OUT}/vectors.json", "w"))
print({k: len(v) for k, v in vec.items() if isinstance(v, (list, dict))})
print("peaks", [(p["name"], p["ele"]) for p in vec["peaks"]])
