"""Animate the campaign prints over the 30s spot as a transparent layer (RGBA PNG per frame).

  python3 scripts/make_photo_layer.py [OUT_DIR] [FIRST LAST]
      default OUT_DIR: <renders>/cut30/photos  -> ph_0001.png ... ph_0720.png

Each print in photos.json drops onto the frame like a photo landing on a table (scale and tilt
settle, the shadow tightens as it lands), drifts slowly while it holds, then slides off the side
it came from. Optional per-print "land" / "exit" (frames) override the defaults; exit 0 means it
holds until the cut. Prints come from make_photo_prints.py. deliver_online.sh / render_burrows.sh
composite this layer over the graded film, under the end card.
"""
import json, math, os, sys
# RETIRED (Oct 25): the photo layer is now the three.js build in photo3d/ (node photo3d/render.mjs),
# and photos.json uses hero/slot poses this 2D version doesn't read. Kept for reference.
sys.exit("make_photo_layer.py is retired: use  node photo3d/render.mjs OUT_DIR")
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(HERE, "photos.json")))
PRINTS = os.path.join(HERE, "assets", "photos", "prints")
RENDERS = os.environ.get("RENDERS", "/Volumes/HeleneOYOH/Burrows Campaign 26/renders")
args = sys.argv[1:]
OUT = args[0] if args else os.path.join(RENDERS, "cut30", "photos")
FIRST, LAST = (int(args[1]), int(args[2])) if len(args) > 2 else (1, 720)
W, H = 1920, 1080
LAND, EXIT = 10, 8                                  # frames

os.makedirs(OUT, exist_ok=True)
cache = {}
def art(p):
    if p["name"] not in cache:
        im = Image.open(os.path.join(PRINTS, p["name"] + ".png")).convert("RGBA")
        cache[p["name"]] = im.resize((p["width"], round(p["width"] * im.height / im.width)), Image.LANCZOS)
    return cache[p["name"]]

ease_out = lambda t: 1 - (1 - t) ** 3
ease_in = lambda t: t ** 2.2
lerp = lambda a, b, t: a + (b - a) * t

def state(p, f):
    """pose of print p at frame f, or None when it is off screen"""
    a, b = p["in"], p["out"]
    if f < a or f > b:
        return None
    side = 1 if p.get("from", "right") == "right" else -1
    land, exit_ = p.get("land", LAND), p.get("exit", EXIT)
    hold = max(1, b - a - land - exit_)
    drift = min(1.0, max(0.0, (f - a - land) / hold))
    s = dict(x=p["x"] + side * 12 * drift, y=p["y"] - 6 * drift, scale=1.0 + 0.025 * drift, rot=p["rot"],
             sh_dx=10, sh_dy=16, sh_blur=9, sh_a=0.55, alpha=1.0)
    if f < a + land:                                 # landing
        t = ease_out((f - a) / land)
        s.update(x=lerp(p["x"] + side * 260, p["x"], t), y=lerp(p["y"] - 90, p["y"], t),
                 scale=lerp(1.22, 1.0, t), rot=lerp(p["rot"] + side * 11, p["rot"], t),
                 sh_dx=lerp(46, 10, t), sh_dy=lerp(64, 16, t), sh_blur=lerp(34, 9, t), sh_a=lerp(0.22, 0.55, t),
                 alpha=min(1.0, (f - a + 1) / 3))
    elif exit_ and f > b - exit_:                    # sliding off
        t = ease_in((f - (b - exit_)) / exit_)
        s.update(x=s["x"] + side * t * 1300, rot=s["rot"] + side * 6 * t)
    return s

def comp(frame, layer, x, y):
    """alpha_composite that tolerates negative / off-frame offsets"""
    cx, cy = max(0, -x), max(0, -y)
    if cx >= layer.width or cy >= layer.height or x >= W or y >= H:
        return
    frame.alpha_composite(layer.crop((cx, cy, layer.width, layer.height)), (max(0, x), max(0, y)))

def draw(frame, p, s):
    im = art(p)
    w, h = round(im.width * s["scale"]), round(im.height * s["scale"])
    im = im.resize((w, h), Image.BICUBIC).rotate(s["rot"], resample=Image.BICUBIC, expand=True)
    if s["alpha"] < 1:
        im.putalpha(im.getchannel("A").point(lambda v: int(v * s["alpha"])))
    pad = int(s["sh_blur"] * 3)
    sh = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    a = im.getchannel("A").point(lambda v: int(v * s["sh_a"]))
    sh.paste(Image.new("RGBA", im.size, (8, 10, 6, 255)), (pad, pad), a)
    sh = sh.filter(ImageFilter.GaussianBlur(s["sh_blur"]))
    x, y = round(s["x"] - im.width / 2), round(s["y"] - im.height / 2)
    comp(frame, sh, x - pad + round(s["sh_dx"]), y - pad + round(s["sh_dy"]))
    k = s["sh_blur"] / 9                               # 1 when landed, larger mid-drop
    cp = 8
    ct = Image.new("RGBA", (im.width + 2 * cp, im.height + 2 * cp), (0, 0, 0, 0))
    ct.paste(Image.new("RGBA", im.size, (4, 5, 3, 255)), (cp, cp), im.getchannel("A").point(lambda v: int(v * 0.42 / k)))
    ct = ct.filter(ImageFilter.GaussianBlur(2.5 * k))
    comp(frame, ct, x - cp + round(2 * k), y - cp + round(4 * k))
    comp(frame, im, x, y)

empty = Image.new("RGBA", (W, H), (0, 0, 0, 0))
order = sorted(CFG["prints"], key=lambda p: p["in"])   # later prints land on top
n_drawn = 0
for f in range(FIRST, LAST + 1):
    live = [(p, s) for p in order if (s := state(p, f))]
    frame = empty.copy()
    for p, s in live:
        draw(frame, p, s)
    frame.save(os.path.join(OUT, f"ph_{f:04d}.png"), compress_level=1 if live else 9)
    n_drawn += bool(live)
print("PHOTO_LAYER", OUT, f"{FIRST}-{LAST}", "frames with prints:", n_drawn)
