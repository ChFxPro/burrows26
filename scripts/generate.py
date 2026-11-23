#!/usr/bin/env python3
"""
Burrows NC119 — batch graphic generator.

Reads content/concepts.json, composes a prompt per concept from the brand rules, and calls the
OpenAI Images API with the approved reference standard AND the chosen headshot as input images.

Cost control is the point: draft everything cheap, look at it, then re-render only the winners.

    python scripts/generate.py --tier draft                  # every ready concept, cheapest tier
    python scripts/generate.py --tier draft --variants 2     # two options each
    python scripts/generate.py --tier final --only tax-shift rebuilding
    python scripts/generate.py --dry-run                     # print prompts + cost, call nothing

Requires OPENAI_API_KEY in the environment (or a .env file next to this repo).
"""

import argparse, base64, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(p):
    return json.loads((ROOT / p).read_text())


def load_env():
    """Minimal .env reader so this works without extra deps."""
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def build_prompt(c, brand):
    p = brand["palette"]
    a = brand["attribution"]
    w1, w2 = c["headline"]
    return f"""Attached are two images: my approved campaign graphic (the reference standard) and a
photograph of the same man, Mark Burrows.

Build a new graphic in exactly the same visual system as the reference. This is one piece in an
ongoing series and it must look like it came from the same designer on the same afternoon — same
flat navy field, same heavy condensed all-caps display type at the same enormous scale, same
full-width red rule, same quote treatment with one phrase in light blue, same attribution block,
same logo lockup position, same proportions.

Palette — these four values and no others:
  navy field {p['navy']}
  off-white type {p['offwhite']}
  sky, for one phrase of the quote only {p['sky']}
  signal red, for the rule and the attribution bar only {p['red']}

Change only these four things:

1. HEADLINE, stacked on two lines:
   {w1}
   {w2}

2. QUOTE, below the red rule:
   "{c['quote']}"

3. SKY BLUE PHRASE — set only this part in {p['sky']}:
   "{c['highlight']}"

4. PHOTOGRAPH — replace the man in the reference with the newly attached photograph of him. Cut him
   out of his original background, place him on the right against the flat navy, and scale him large
   so he fills roughly the right half of the canvas and crops off the bottom edge. Hard cut edge.
   No glow, no feathering, no drop shadow.

THE PHOTOGRAPH IS NOT TO BE ALTERED. Do not retouch, smooth, beautify, slim, age, restyle or
regenerate his face, glasses, hair or expression. Composite the attached photograph exactly as it
was shot. If you cannot composite the actual attached image and would instead generate a new person
who resembles him, stop and say so rather than producing a lookalike.

Keep the attribution exactly as: {a['name']} / {a['line1']} / {a['line2']}.
Keep the campaign logo lockup top right. Add no other text — no website, no date, no hashtag,
no call to action.

Do not add: glow, bloom, lens flare, bokeh, gradients, glassmorphism, floating cards, drop shadows
on text, faux-3D, bevels, decorative flourishes, a second typeface, or any words not specified above."""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", default=None, help="draft | final | flagship")
    ap.add_argument("--only", nargs="*", default=None, help="concept ids")
    ap.add_argument("--variants", type=int, default=1)
    ap.add_argument("--model", default=None, help="override the tier's model")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--include-held", action="store_true",
                    help="also run concepts whose status is not 'ready'")
    args = ap.parse_args()

    cfg = load("config.json")
    brand = load("brand/brand.json")
    concepts = load("content/concepts.json")["concepts"]

    tier_name = args.tier or cfg["default_tier"]
    if tier_name not in cfg["tiers"]:
        sys.exit(f"Unknown tier '{tier_name}'. Options: {', '.join(cfg['tiers'])}")
    tier = dict(cfg["tiers"][tier_name])
    if args.model:
        tier["model"] = args.model

    if args.only:
        concepts = [c for c in concepts if c["id"] in args.only]
        missing = set(args.only) - {c["id"] for c in concepts}
        if missing:
            sys.exit(f"No such concept id: {', '.join(sorted(missing))}")
    if not args.include_held:
        held = [c["id"] for c in concepts if c.get("status") != "ready"]
        concepts = [c for c in concepts if c.get("status") == "ready"]
        for h in held:
            print(f"  skipping '{h}' — status is not 'ready' (use --include-held to force)")
    if not concepts:
        sys.exit("Nothing to generate.")

    n = len(concepts) * args.variants
    est = n * tier.get("approx_cost_usd", 0)
    outdir = ROOT / cfg["out_dir"] / ("finals" if tier_name != "draft" else "drafts")
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"\ntier      {tier_name}  ({tier['model']}, quality={tier['quality']}, size={tier['size']})")
    print(f"concepts  {len(concepts)} x {args.variants} variant(s) = {n} image(s)")
    print(f"estimate  ~${est:.2f}  (approximate — verify against current API pricing)")
    print(f"output    {outdir}\n")

    if args.dry_run:
        for c in concepts:
            print("=" * 72)
            print(f"{c['id']}   headshot: {c['headshot']}")
            print("=" * 72)
            print(build_prompt(c, brand))
            print()
        print("dry run — nothing was generated, nothing was billed.")
        return

    load_env()
    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY is not set. Put it in the environment or in a .env file at the repo root.")

    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("pip install -r scripts/requirements.txt")

    client = OpenAI()
    ref = ROOT / cfg["reference"]
    if not ref.exists():
        sys.exit(f"Missing reference standard at {ref}")

    manifest = []
    for c in concepts:
        shot = ROOT / cfg["headshot_dir"] / c["headshot"]
        if not shot.exists():
            print(f"  !! {c['id']}: headshot not found — {shot}")
            continue
        prompt = build_prompt(c, brand)

        for v in range(1, args.variants + 1):
            stamp = time.strftime("%Y%m%d-%H%M%S")
            name = f"{c['id']}_{tier_name}_v{v}_{stamp}.png"
            print(f"  generating {c['id']}  variant {v}/{args.variants} ...", flush=True)
            try:
                with open(ref, "rb") as f_ref, open(shot, "rb") as f_shot:
                    resp = client.images.edit(
                        model=tier["model"],
                        image=[f_ref, f_shot],
                        prompt=prompt,
                        size=tier["size"],
                        quality=tier["quality"],
                    )
                data = base64.b64decode(resp.data[0].b64_json)
                (outdir / name).write_bytes(data)
                print(f"     -> {name}")
                manifest.append({
                    "concept": c["id"], "file": name, "tier": tier_name,
                    "model": tier["model"], "quality": tier["quality"],
                    "headshot": c["headshot"], "source": c.get("source"),
                    "generated_at": stamp,
                })
            except Exception as e:
                print(f"     !! failed: {e}")
                print("     If this is a model-name error, check config.json against the current API docs.")

    if manifest:
        mf = outdir / "manifest.json"
        prev = json.loads(mf.read_text()) if mf.exists() else []
        mf.write_text(json.dumps(prev + manifest, indent=2))
        print(f"\ndone — {len(manifest)} image(s). Manifest: {mf}")
        print("\nBefore anything publishes:")
        print("  1. Zoom in on his face. Glasses, smile lines, moustache. Anything moved -> discard.")
        print("  2. Read every character of the text.")
        print("  3. If it reads as AI, the tell is softness — re-run asking for harder edges, flatter colour.")


if __name__ == "__main__":
    main()
