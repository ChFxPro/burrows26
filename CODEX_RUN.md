# The Codex run

Open Codex in `/Users/jeffbannister/Code/burrows26` and paste the block below.

It runs the cheap pass first and stops for your eyes before spending anything real. That's the whole
economic idea: drafting six concepts costs a few cents, and only the ones you actually like get
re-rendered at a price worth caring about.

---

## Paste this

```
You are working in /Users/jeffbannister/Code/burrows26 on the Mark Burrows NC House 119
campaign graphics pipeline. Read AGENTS.md first and follow it — especially the rule about
never altering the candidate's face.

Do this in order and stop where I've told you to stop.

STEP 1 — Verify before spending
- Confirm OPENAI_API_KEY is available (environment or .env at the repo root).
- Install scripts/requirements.txt if the openai package isn't present.
- Check the model names in config.json against the current OpenAI image generation docs.
  gpt-image-1 is scheduled to deprecate 2026-10-23, so if config.json points at anything
  deprecated or renamed, update config.json — do not hardcode a model in the script.
- Run: python scripts/generate.py --dry-run
  Show me the estimated cost and confirm the prompt reads correctly for one concept.

STEP 2 — Cheap draft pass
- Run: python scripts/generate.py --tier draft --variants 2
- This generates two options for every concept marked "ready" in content/concepts.json,
  at the cheapest model and quality. It should cost well under a dollar in total.
- The "half-a-day" concept is deliberately held at status "verify-first" — leave it held.

STEP 3 — Report back and STOP
Give me a short table: concept id, files written, model and quality used, actual number of
images, and the estimated spend. Then stop and wait. Do not run the final tier on your own
initiative — I need to look at the drafts first, because the checks that matter are visual
and I have to make them myself.

STEP 4 — Only after I name the winners
When I tell you which concept ids to promote, run:
  python scripts/generate.py --tier final --only <ids>
Then report the output paths and the spend.

Ground rules for the whole run:
- Never edit the prompt text inside scripts/generate.py to make an output "better." If a
  result is wrong, tell me what's wrong and propose a change — the prompt is the standard
  and it changes deliberately, not opportunistically.
- Never substitute a different headshot than the one named in concepts.json.
- Never use a previously generated image as the reference. brand/00_REFERENCE_standard.png
  is the only reference.
- If a generation fails, report the actual error rather than retrying silently. Repeated
  silent retries on a paid API is how a few cents becomes a real bill.
- Do not commit anything to git unless I ask.
```

---

## What it costs

Six concepts, two variants each, cheapest tier: **twelve images for roughly seven cents.**

Promoting three winners to the high-quality mini tier: **about sixteen cents.** Promoting them to
the flagship model instead: about sixty.

So the entire week of graphics lands somewhere between a quarter and a dollar. The expensive thing
was never the generation — it was the deciding, and that part is still yours.

## Adding next week's topics

Append to `content/concepts.json`. Each needs a two-word headline, a quote that is genuinely Mark's
own words, the phrase to highlight, a headshot filename from `brand/headshots/`, and a `source`
naming where the quote came from. Set `status` to `"ready"` only when the source is real and any
factual claim in it has been checked.

Then run the same Codex prompt again. Nothing else changes.
