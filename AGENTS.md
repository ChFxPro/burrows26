# AGENTS.md — Burrows NC119 graphics repo

Operating rules for any coding agent working in this folder. Read this before touching anything.

## What this repo is

A batch generator for campaign topic graphics. It takes an approved reference design plus a real
photograph of the candidate and produces new graphics in the same visual system by calling the
OpenAI Images API. The work is cost-tiered: generate everything cheap, review, then re-render only
the approved ones at full quality.

## The one rule that matters more than the others

**Mark Burrows is a real candidate on a real ballot.** His face must never be altered, retouched,
smoothed, restyled or regenerated. The prompt in `scripts/generate.py` says so explicitly and at
length. Do not soften that language, shorten it, or "clean it up." If an output comes back with a
changed likeness it gets discarded, not shipped.

## Layout

```
brand/
  00_REFERENCE_standard.png   the approved design. The standard. Do not replace casually.
  brand.json                  the four colours and the attribution block
  STYLE_GUIDE.md              written spec — structure, rules, photo library, the hat rule
  headshots/                  15 photos, pre-cropped 4:5, named by what they're for
content/
  concepts.json               one object per graphic — headline, quote, highlight, headshot, source
scripts/
  generate.py                 the batch generator
config.json                   model + quality + size per cost tier
out/drafts/  out/finals/      generated images plus a manifest
```

## Commands

```bash
pip install -r scripts/requirements.txt
export OPENAI_API_KEY=...            # or put it in .env at the repo root

python scripts/generate.py --dry-run                      # prints prompts + cost, calls nothing
python scripts/generate.py --tier draft                   # all ready concepts, cheapest
python scripts/generate.py --tier draft --variants 3      # three options each
python scripts/generate.py --tier final --only tax-shift  # one concept, full quality
```

## Rules for editing content

- **Headlines are exactly two words.** The design depends on the display type being enormous.
  A third word forces it smaller and the whole thing collapses. If a topic needs three words,
  find the two-word version of it instead.
- **Every quote must be Mark's own words**, with a `source` field naming the file and timecode or
  the post and date. Never a paraphrase. Never something written for him. If there is no source,
  the concept is not ready.
- **One highlighted phrase per graphic.** Two highlights is none.
- **`status` gates generation.** Only `"ready"` concepts run by default. Anything needing a fact
  checked stays at `"verify-first"` with a note explaining what to check.
- **Append, don't rewrite.** Approved concepts stay as they are so past output stays reproducible.

## Rules for editing the design

- `brand.json` holds four colours. There is no fifth. Do not add one.
- Do not use a previous generation as the new reference. Drift compounds — after a month you end up
  with a palette nobody chose. `00_REFERENCE_standard.png` is the standard until a human
  deliberately replaces it, and when they do, it changes everywhere at once.

## Model names and cost

`config.json` carries the model per tier. **Model strings change and `gpt-image-1` is scheduled to
deprecate on 2026-10-23** — mid-campaign. Before any large run, confirm the current model names
against the OpenAI image generation docs and update `config.json` rather than hardcoding anything
in the script.

Approximate per-image cost at time of writing: mini/low around half a cent, mini/high around five
cents, flagship/high around twenty cents. Draft passes are effectively free; only finals cost
anything worth counting.

## What "done" looks like

An image is not done when it renders. It is done when a human has:

1. Zoomed in on the face — glasses frames, smile lines, moustache — and confirmed nothing moved.
2. Read every character of the text. Image models drop and swap letters in ways the eye skips over.
3. Judged whether it looks human-made. If it reads as AI, the tell is almost always softness;
   re-run asking for harder edges and flatter colour.
