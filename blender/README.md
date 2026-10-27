# Burrows route film (Blender + three.js)

The route film for Mark Burrows, NC House 119: the long route tour (`burrows_wnc_route_tour.blend`,
1718 frames) and the online spot, cut from it. The spot is 30 s of film (`burrows_30s.blend`, 720 frames)
plus an animated three.js end tag, delivered at 34 s.

## Pipeline

| Step | Command (from `blender/`) | Writes |
|---|---|---|
| Cycles plate, multipass EXR | `CUT=30 ./render_burrows.sh plate` (≈ 6–7 h; `STOP_AT=06:30` to pause) | `$RENDERS/cut30/exr/` |
| EEVEE overlays (labels, pins, trail) | `CUT=30 ./render_burrows.sh overlays` (≈ 11 min) | `$RENDERS/cut30/overlays/` |
| Comp + per-shot grade (`scripts/realism_grade.py`) | `CUT=30 ./render_burrows.sh comp` (≈ 40 min) | `$RENDERS/cut30/comp/frames/` |
| Photo collage (three.js, `photo3d/`) + end tag (`endcard/`, `scripts/render_endtag.sh`) + masters | `scripts/deliver_online.sh` | `NORTHBEND/Burrows 26/Deliver/cut34/` (or `$RENDERS/cut30/deliver/` without NORTHBEND) |

`$RENDERS` defaults to `/Volumes/HeleneOYOH/Burrows Campaign 26/renders`. Leave out `CUT=30` for the long film,
which renders to the top level of `$RENDERS`. Text for the end card and tag is in `endcard.json`; the
campaign photos are in `photos.json`. The first run of the end tag or photo collage does `npm ci` in
`endcard/` and `photo3d/`.

`scripts/build/` has the one-time scripts that built the terrain scene (see its README). The textures the
scenes link are in `assets/out/` (gitignored, keep them with the `.blend` files).

## Where output goes

Every render and review file goes outside the repo, so `blender/` only holds sources:

- **Render passes and deliverables:** the scripts above write to `$RENDERS/<cut>/…` and the Deliver folder.
- **Review files** (phone encodes, contact sheets, A/B stills, test MP4s): `$RENDERS/<cut>/review/<yyyy-mm-dd>_<topic>/`.
  Never the `blender/` folder or the Desktop.
- **Backups before re-rendering a shot:** `$RENDERS/<cut>/backups/<yyyy-mm-dd>_<topic>/`, with a `filelist.txt`
  of what was replaced. Not `~/Burrows Render Backups`.
- **`.blend` checkpoints** before a risky edit: `backups/<scene>.pre_<change>.blend` (gitignored), and move
  them to the archive once the change is approved.
- **Archive:** finished versions, plates and sources go to the NAS,
  `/Volumes/personal_folder/Burrows Campaign 26 Archive/`. Its `README.md` has the layout and the naming
  rule (`YYYY-MM-DD_<piece>_<vN>-<note>`), and a manifest per entry is kept in `_manifests/`.
