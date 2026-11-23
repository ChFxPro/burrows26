"""Turn campaign photos into physical-looking prints (RGBA PNGs) for the photo layer.

  python3 scripts/make_photo_prints.py          -> assets/photos/prints/<name>.png

Each entry in photos.json: crop -> "printed photo" colour (clean lab print: auto levels, light warmth,
gentle vignette, sharpened for the downscale) -> white border with a deeper bottom edge and a handwritten
caption -> paper grain, a faint gloss sweep, a slightly soft edge and a strip of tape on top. Shadow and motion are
added per frame by make_photo_layer.py (they depend on rotation and the drop).
"""
import json, os, random, zlib
from PIL import Image, ImageOps, ImageEnhance, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(HERE, "photos.json")))
SRC = os.path.join(HERE, "assets", "photos", "src")
OUT = os.path.join(HERE, "assets", "photos", "prints"); os.makedirs(OUT, exist_ok=True)
# Sharpie-style caption; falls back to Apple's Marker Felt where Grock Marker isn't installed
FONT = next(f for f in (os.path.expanduser("~/Library/Fonts/Grock Marker.otf"), "/Library/Fonts/Grock Marker.otf",
                        "/System/Library/Fonts/Supplemental/MarkerFelt.ttc") if os.path.exists(f))
INK = (24, 24, 30)                               # black permanent marker
TAPE = (236, 230, 208)                           # matte masking tape, a little translucent

PHOTO_W = 1400                                   # photo area width in the print (px)
BORDER, BOTTOM = 0.05, 0.21                     # as fractions of photo width
PAPER = (246, 243, 236)                          # warm white print paper


def print_look(im):
    # a good lab print, not a faded snapshot: faces have to read in ~3 s at a fraction of the frame
    im = ImageOps.autocontrast(im, cutoff=(0.4, 0.2), preserve_tone=True)
    im = ImageEnhance.Color(im).enhance(0.97)
    im = ImageEnhance.Contrast(im).enhance(1.04)
    r, g, b = im.split()                         # a whisper of warmth, blacks barely lifted
    lut = lambda lift, gain: [min(255, int(lift + v * gain)) for v in range(256)]
    im = Image.merge("RGB", (r.point(lut(6, 0.98)), g.point(lut(5, 0.97)), b.point(lut(4, 0.95))))
    w, h = im.size                               # gentle vignette keeps the eye on the faces
    v = Image.new("L", (w, h), 0); ImageDraw.Draw(v).ellipse((-w * 0.25, -h * 0.25, w * 1.25, h * 1.25), fill=255)
    v = v.filter(ImageFilter.GaussianBlur(w * 0.12))
    im = Image.composite(im, ImageEnhance.Brightness(im).enhance(0.88), v)
    return im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=55, threshold=2))   # survives the downscale


def grain(size, amount, seed):
    random.seed(seed)
    n = Image.effect_noise(size, 40).filter(ImageFilter.GaussianBlur(0.6))
    return n.point(lambda p: 128 + (p - 128) * amount)


for p in CFG["prints"]:
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, p["src"]))).convert("RGB")
    l, t, r, b = p["crop"]
    im = im.crop((int(l * im.width), int(t * im.height), int(r * im.width), int(b * im.height)))
    ph = round(PHOTO_W * im.height / im.width)
    im = print_look(im.resize((PHOTO_W, ph), Image.LANCZOS))

    bw, bb = round(PHOTO_W * BORDER), round(PHOTO_W * BOTTOM)
    W, H = PHOTO_W + 2 * bw, ph + bw + bb
    card = Image.new("RGB", (W, H), PAPER)
    card.paste(im, (bw, bw))
    d = ImageDraw.Draw(card)
    d.rectangle((bw - 1, bw - 1, bw + PHOTO_W, bw + ph), outline=(222, 218, 210), width=2)   # print edge
    if p.get("caption"):                         # written by hand: a little tilt, ink slightly soft
        size = round(bb * 0.48)
        f = ImageFont.truetype(FONT, size)
        while d.textlength(p["caption"], font=f) > W * 0.86:
            size -= 2; f = ImageFont.truetype(FONT, size)
        ink = Image.new("L", (W, bb), 0)
        ImageDraw.Draw(ink).text((W / 2, bb * 0.50), p["caption"], font=f, fill=235, anchor="mm")
        tilt = -1.2 if zlib.crc32(p["name"].encode()) & 1 else 1.0
        ink = ink.rotate(tilt, resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.7))
        card.paste(Image.new("RGB", (W, bb), INK), (0, bw + ph), ink)

    # paper grain over everything, a faint diagonal gloss, slightly darker toward the edges
    g = grain((W, H), 0.10, zlib.crc32(p["name"].encode()) & 0xFFFF).convert("RGB")
    card = ImageChops.overlay(card, g)
    gloss = Image.new("L", (W, H), 0)
    ImageDraw.Draw(gloss).polygon([(W * 0.15, 0), (W * 0.45, 0), (W * 0.05, H), (-W * 0.25, H)], fill=26)
    gloss = gloss.filter(ImageFilter.GaussianBlur(W * 0.06))
    card = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), card, gloss)
    edge = Image.new("L", (W, H), 255); ImageDraw.Draw(edge).rectangle((0, 0, W - 1, H - 1), outline=0, width=6)
    edge = edge.filter(ImageFilter.GaussianBlur(5))
    card = Image.composite(card, ImageEnhance.Brightness(card).enhance(0.93), edge)

    alpha = Image.new("L", (W, H), 0)               # very slightly rounded corners
    ImageDraw.Draw(alpha).rounded_rectangle((0, 0, W - 1, H - 1), radius=8, fill=255)
    card.putalpha(alpha)

    # a strip of tape holding the print, half on / half off the top edge, slightly crooked
    rnd = random.Random(zlib.crc32(p["name"].encode()))
    tw, th = round(W * 0.30), round(W * 0.075)
    pad = th
    out = Image.new("RGBA", (W, H + pad), (0, 0, 0, 0)); out.alpha_composite(card, (0, pad))
    tape = Image.new("RGBA", (tw, th), TAPE + (0,))
    ta = Image.new("L", (tw, th), 0); td = ImageDraw.Draw(ta)
    teeth = lambda x0, sgn: [(x0 + sgn * rnd.uniform(0, th * 0.12), y) for y in range(0, th + 1, max(2, th // 9))]
    left, right = teeth(0, 1), teeth(tw - 1, -1)
    td.polygon(left + right[::-1], fill=200)                  # torn ends
    ta = ta.filter(ImageFilter.GaussianBlur(0.8))
    tape.putalpha(ta)
    tg = grain((tw, th), 0.18, rnd.randrange(1 << 16)).convert("L")
    tape = Image.merge("RGBA", (*[ImageChops.multiply(c, tg.point(lambda v: 205 + v // 5)) for c in tape.split()[:3]], tape.getchannel("A")))
    tape = tape.rotate(rnd.uniform(-5, 5), resample=Image.BICUBIC, expand=True)
    out.alpha_composite(tape, (round(W / 2 - tape.width / 2 + rnd.uniform(-W * 0.08, W * 0.08)), round(pad + 2 - tape.height / 2)))
    card = out
    card.save(os.path.join(OUT, p["name"] + ".png"))
    print("PRINT", p["name"], card.size)
