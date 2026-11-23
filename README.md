# Burrows NC119 — campaign graphics

Batch-generates topic graphics in the approved visual system, from the approved reference design
plus real photographs of the candidate.

**Start here:** `CODEX_RUN.md` — the orchestration prompt to paste into Codex.
**Rules:** `AGENTS.md` — read before changing anything.
**Design spec:** `brand/STYLE_GUIDE.md`

Quick version:

    pip install -r scripts/requirements.txt
    export OPENAI_API_KEY=...
    python scripts/generate.py --dry-run          # free, prints prompts and cost
    python scripts/generate.py --tier draft       # cheap pass
    python scripts/generate.py --tier final --only tax-shift rebuilding

Two-word headlines. Mark's own words, always sourced. Never alter his face.
