"""Draw the end card (transparent 1920x1080 PNG) from blender/endcard.json.

  python3 scripts/make_endcard.py [out.png] [preview_background.png]

Edit endcard.json (tagline, vote date, "Paid for by" line, timing) and re-run; the render
script lays the PNG over the end of the film when it encodes the MP4. With a background
image it also writes <out>_preview.jpg so you can check the layout without rendering.
Colours come from the Burrows logo (white, light blue, red) and the sign's navy.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(HERE, "endcard.json")))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "endcard", "endcard.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
LOGO = os.path.join(HERE, "..", "nc119-dashboard", "src", "imgs", "logo-white.png")

W, H = 1920, 1080
NAVY, WHITE, BLUE, RED = (20, 40, 75), (255, 255, 255), (109, 174, 219), (191, 13, 25)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
HEAVY, BOLD, DEMI = 8, 0, 2                      # font indexes inside Avenir Next.ttc
font = lambda size, idx: ImageFont.truetype(AVENIR, size, index=idx)

card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(card)

# navy band across the lower third, red rule on top
BAND_TOP = 630                                    # raised so the disclaimer clears title-safe
d.rectangle((0, BAND_TOP, W, H), fill=NAVY + (250,))   # near-opaque: map labels showed through
d.rectangle((0, BAND_TOP, W, BAND_TOP + 7), fill=RED + (255,))

# logo on the left, vertically centred in the band above the disclaimer row
DISC_H = 76                                       # disclaimer row
SAFE_B = 54                                       # title-safe bottom (5%): online players put controls/captions here
DISC_TOP = H - SAFE_B - DISC_H
content_top, content_bot = BAND_TOP + 7, DISC_TOP
logo = Image.open(LOGO).convert("RGBA")
lh = 230; lw = round(logo.width * lh / logo.height)
logo = logo.resize((lw, lh), Image.LANCZOS)
lx = 110; ly = content_top + (content_bot - content_top - lh) // 2
card.alpha_composite(logo, (lx, ly))

# divider
dx = lx + lw + 70
d.rectangle((dx, content_top + 48, dx + 4, content_bot - 40), fill=BLUE + (255,))

# tagline + call to action on the right
tx = dx + 70
f1, f2, f3 = font(92, HEAVY), font(56, BOLD), font(42, BOLD)
y = content_top + 22
d.text((tx, y), cfg["headline"], font=f1, fill=WHITE + (255,))
y += f1.getbbox(cfg["headline"])[3] + 6
d.text((tx, y), cfg["subline"], font=f2, fill=BLUE + (255,))
y += f2.getbbox(cfg["subline"])[3] + 20
bx0, by0, bx1, by1 = d.textbbox((0, 0), cfg["cta"], font=f3)
pad_x, pad_y = 30, 14
pill = (tx, y, tx + (bx1 - bx0) + 2 * pad_x, y + (by1 - by0) + 2 * pad_y)
d.rounded_rectangle(pill, radius=(pill[3] - pill[1]) // 2, fill=RED + (255,))
d.text((tx + pad_x - bx0, y + pad_y - by0), cfg["cta"], font=f3, fill=WHITE + (255,))
cta2_end = pill[2]
if cfg.get("cta2"):                               # optional second date, beside the button
    c2x = pill[2] + 34
    d.text((c2x, (pill[1] + pill[3]) // 2), cfg["cta2"], font=f3, fill=WHITE + (255,), anchor="lm")
    cta2_end = c2x + f3.getlength(cfg["cta2"])

# disclaimer: own row inside title-safe, ~4% of frame height, high contrast (readable on phones)
fd = font(46, DEMI)
dy = DISC_TOP + (DISC_H - (fd.getbbox(cfg["disclaimer"])[3])) // 2 - 4
d.rectangle((0, DISC_TOP, W, H), fill=(10, 22, 44, 245))
d.text((W // 2, dy), cfg["disclaimer"], font=fd, fill=WHITE + (255,), anchor="mt")

right_edge = max(tx + f1.getlength(cfg["headline"]), tx + f2.getlength(cfg["subline"]), cta2_end)
if right_edge > W - 80:
    print(f"WARNING: text runs to x={right_edge:.0f}, past the safe margin ({W - 80}); shorten it")
if pill[3] > DISC_TOP - 24:
    print(f"WARNING: the vote button ends at y={pill[3]}, crowding the disclaimer row; shorten the text")
card.save(out)
print("ENDCARD", out)

if len(sys.argv) > 2:                             # preview over a frame of the film
    bg = Image.open(sys.argv[2]).convert("RGBA").resize((W, H))
    bg.alpha_composite(card)
    prev = os.path.splitext(out)[0] + "_preview.jpg"
    bg.convert("RGB").save(prev, quality=90)
    print("PREVIEW", prev)
