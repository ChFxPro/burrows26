"""Draw the vehicle marker badge (replaces the red balloon that follows the car on the map).

  python3 scripts/make_marker_badge.py      -> assets/marker_badge.png (RGBA)

Navy panel with the white Burrows logo, a red rule under it and a pointer at the bottom
centre that points down at the car. The pointer tip is the bottom edge of the image, which is
where make_cut30.py puts the badge's origin. Colours match the end card (logo artwork).
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(HERE, "..", "nc119-dashboard", "src", "imgs", "logo-white.png")
OUT = os.path.join(HERE, "assets", "marker_badge.png")
# panel navy is lifted: the overlay goes through AgX, which pushed the end card navy to near-black
NAVY = tuple(int(x) for x in os.environ.get("BADGE_NAVY", "48,84,146").split(","))
RED, WHITE = (191, 13, 25), (255, 255, 255)

SS = 2                                             # supersample for smooth edges
W, PANEL_H, POINT_H = 1200 * SS, 720 * SS, 200 * SS
H = PANEL_H + POINT_H
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r = 90 * SS
border = 14 * SS
d.rounded_rectangle((0, 0, W - 1, PANEL_H - 1), radius=r, fill=WHITE + (255,))           # white rim
d.rounded_rectangle((border, border, W - 1 - border, PANEL_H - 1 - border), radius=r - border, fill=NAVY + (255,))
pw = 300 * SS                                       # pointer: white rim, navy inside
d.polygon([(W / 2 - pw / 2, PANEL_H - 2 * SS), (W / 2 + pw / 2, PANEL_H - 2 * SS), (W / 2, H - 1)], fill=WHITE + (255,))
inset = border * 1.8
d.polygon([(W / 2 - pw / 2 + inset, PANEL_H - border - 2 * SS), (W / 2 + pw / 2 - inset, PANEL_H - border - 2 * SS),
           (W / 2, H - 1 - inset * 1.6)], fill=NAVY + (255,))

logo = Image.open(LOGO).convert("RGBA")
logo = logo.crop(logo.getbbox())
lw = int(W * 0.80); lh = round(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
ly = (PANEL_H - lh) // 2 - 20 * SS
img.alpha_composite(logo, ((W - lw) // 2, ly))

img = img.resize((W // SS, H // SS), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT)
print("BADGE", OUT, img.size, "aspect", round(img.width / img.height, 4))
