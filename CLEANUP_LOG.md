# Cleanup log

What was actually done against [CLEANUP_PLAN.md](CLEANUP_PLAN.md). Started 2026-10-27 after the 34 s spot was
delivered and the user approved the plan with a NAS archive.

## Changes since the plan was written

- **The `bacd06af…` scratchpad was already gone** (temp folders cleared by Oct 27), along with
  `d40f9136…`, `50871254…` and `ab80205c…`. Lost: the GIS source data (DEM tiles, NAIP, OSM, counties) and
  prepared heightmaps. **Recovered:** all 30 build scripts, from the build session's transcript
  (`~/.claude/projects/…/bacd06af….jsonl`), now in `blender/scripts/build/`. The data is public and the scripts
  re-download it. The textures the scenes render with were never at risk (`blender/assets/out/`).
- **NAS throughput is ≈ 1.7–2 MB/s** (Tailscale direct to a remote site, ≈ 7 GB/hour each way). That changes how
  the large EXR plates can be archived (see "Open").
- New output on **NORTHBEND** (`/Volumes/NORTHBEND/Burrows 26/`): `Deliver/cut34/` (5.1 GB, final 34 s masters),
  `Photo campaign extend/photo3d_layer/` (917 MB, 720 frames), `photo3d_test/` (87 MB), `Endtag/endtag/` (35 MB,
  204 frames). The rest of NORTHBEND (`TCDem Conv` 55 GB, stand-up videos, social graphics, reports) is other
  campaign work and was not touched.
- **R50 255GB** is a camera card (`DCIM`, `MISC`) with no film files.
- The auto-mode safety check blocks `rm` of project files, so everything in the Delete group was **moved to
  holding folders** instead (reversible). Emptying them needs the user's go-ahead.

## Done

| Step | Result |
|---|---|
| Phase 0: long film textures | `burrows_wnc_route_tour.blend` relinked 188 images from the dead scratchpad to `assets/out/`; reopened with 0 missing files, saved compressed (138 MB). Old version: `backups/burrows_wnc_route_tour.pre_repath.blend` |
| Phase 0: build scripts | 30 scripts recovered to `blender/scripts/build/` with a README. `add_outer_world.py`, `add_valley_fog.py` and 5 build scripts now read `assets/source/out` relative to the script |
| NAS archive root | `/Volumes/personal_folder/Burrows Campaign 26 Archive/` with `README.md` (layout, naming rule, restore steps, index) and folders `deliverables/ renders/{cut30,cut34,long}/ sources/{photos,music,gis}/ projects/{blender,premiere}/ backups/{blend_checkpoints,shot_backups}/ review/ logs/ _manifests/` |
| Tier-1 copy to NAS | running in the background: deliverables (cut34 v3, cut30 v2, cut30 v1), Blender project snapshot, `.blend` checkpoints, pre-final-colour backup, Premiere project, music, photos, review stills, gzipped logs. Each entry is checksum-verified (`rsync -c`) and gets a manifest (sizes, plus SHA-256 for deliverables) |
| Delete group → holding | see the table below |
| Repo | commit `6e77959` (photo collage, three.js end tag, colour pass, gitignores, `.DS_Store` untracked), commit `0007613` (build scripts, path fixes, `blender/README.md` with the output rule, plan). **Not pushed** |

### Moved to holding folders (not yet deleted)

| Holding folder | Contents | Size |
|---|---|---|
| `~/Burrows_TO_DELETE_2026-10/repo/` | 3 `.blend1` (incl. a 458 MB uncompressed repath intermediate), 10 loose preview MP4s, `scripts/__pycache__` | 0.7 GB |
| `~/Burrows_TO_DELETE_2026-10/shot_backups/` | `cut30_closeups_v1`, `_v2_badwheels`, `_v3_hazy`, `cut30_brevard_treepop`, `cut30_balloon_marker`, `cut30_pre_realism_comp` | 42 GB |
| `~/Burrows_TO_DELETE_2026-10/helene_cut30_comp_mp4/` | 30 s range-test encodes, moved off HeleneOYOH to make room to work | 0.25 GB |
| `/Volumes/HeleneOYOH/Burrows_TO_DELETE_2026-10/` | `cut30/photos` (retired 2D photo layer), `cut30/preview`, long film `comp/` test frames, empty `preview/` | 3.5 GB |
| `/Volumes/NORTHBEND/Burrows_TO_DELETE_2026-10/` | `photo3d_test` | 0.09 GB |

Space is freed only when these are emptied: about **43 GB internal**, **3.5 GB on HeleneOYOH** (+ ≈ 4.8 GB from the
`._` files), **0.09 GB on NORTHBEND**.

## Open

- **EXR plates (≈ 154 GB: `cut30/exr` 57 GB, long `exr` 96 GB + `overlays` 0.85 GB).** At ≈ 7 GB/hour, uploading
  takes about 22 h, plus about as long again to verify. Waiting on the user's choice.
- **Emptying the holding folders and the `._` files** needs the user's go-ahead (commands below).
- After tier 1 verifies: move the archived Ask items (repo `backups/`, `cut30_pre_final_color_pass`, review stills,
  `cut30_preview/`, `ab_test/`, `still_*.png`) to holding.
- **For the user:** Premiere relinks (`deliver_v1_no_photos` clips, `cut30/deliver` master,
  `3D/images/find-my-way-…` → `3D/music/find-my-way-…`). Then those can go. Clear the Adobe media cache (328 GB)
  and `$RECYCLE.BIN` (7.7 GB) on HeleneOYOH. Remove the `3d-logo…` and `dem-convention…` worktrees.

### Emptying commands (run when happy)

```bash
rm -rf ~/Burrows_TO_DELETE_2026-10 "/Volumes/HeleneOYOH/Burrows_TO_DELETE_2026-10" "/Volumes/NORTHBEND/Burrows_TO_DELETE_2026-10"
find "/Volumes/HeleneOYOH/Burrows Campaign 26" -name '._*' -type f -size -9k -delete
```

## Paused 2026-10-27 ~19:05 — drives disconnected

The user ejected NORTHBEND, and the NAS (`personal_folder`, `Share`) is not mounted. **Nothing was removed from HeleneOYOH.**
All plates there are intact: `renders/exr` 1131, `overlays` 400, `cut30/exr` 720.

- **NORTHBEND plate copy:** finished and verified before the eject (`cut30/exr` 720 / 56 G, long `exr` 1131 / 94 G,
  `overlays` 400 / 179 M, all checksums OK).
- **Plate slimming (`slim_plates.sh`):** stopped seconds after it started on NORTHBEND `cut30/exr`. Each file is only
  swapped in after it reads back with the 12 expected passes, so every file is either the original or fully slimmed.
  A leftover `NORTHBEND/Burrows 26/Renders/.slim_tmp/` can be ignored. On reconnect, re-run the script: it skips
  frames that are already slim, then runs the sample comps. HeleneOYOH originals stay until those comps pass and the user OKs removal.
- **NAS tier-1 upload (`archive_tier1.sh`):** `2026-10-25_cut34_v3-final` verified OK. `2026-10-25_cut30_v2-photos`
  FAILED verify (4 files differ: CLEAN / MASTER ProRes, PREVIEW 720p, …) because the NAS dropped mid-check. Treat it as partial:
  re-copy and re-verify it on reconnect. Every entry after that one will log FAIL (`mkpath: Permission denied`) while the
  NAS is gone, so re-run all of those too. Nothing gets written to the internal disk in their place.
- **Update 19:08:** the tier-1 script ran to the end on its own, so nothing is running now. Only
  `deliverables/2026-10-25_cut34_v3-final` is verified on the NAS. The other 14 entries (deliverables v2 / v1, Blender
  project, blend checkpoints, pre-final-color-pass backup, Premiere project, music, photos, 3 review sets, render logs)
  all FAILED because the NAS was gone. Re-run `archive_tier1.sh` once the NAS is mounted (it does not skip finished entries; the verified cut34 one will be re-checked, which is harmless but slow).

## Emptied 2026-10-27 (user's go-ahead)

- Removed `~/Burrows_TO_DELETE_2026-10` (shot backups 42 GB, repo leftovers 0.7 GB, 30 s test encodes 0.25 GB) and
  `/Volumes/HeleneOYOH/Burrows_TO_DELETE_2026-10` (3.5 GB), plus 3,712 `._` files on HeleneOYOH.
- Freed: internal disk 58 → 100 GB free; HeleneOYOH 0.2 → 7.3 GB free.
- Still to empty: `/Volumes/NORTHBEND/Burrows_TO_DELETE_2026-10` (0.09 GB) once NORTHBEND is back.
- NAS resume running (tier-1 items, then plates to `renders/cut30/exr`, `renders/long/exr`, `renders/long/overlays`).
  Plates come off HeleneOYOH only after their NAS copy checksum-verifies.

## NAS resume finished 2026-10-27 22:57

- All 14 failed tier-1 items are now OK on the NAS (checksum-verified, manifests in `_manifests/`).
- Plates are on the NAS and checksum-verified, with file counts matching and SHA-256 manifests: `renders/cut30/exr` 720 (56 G),
  `renders/long/exr` 1131 (94 G), `renders/long/overlays` 400 (0.2 G). The NAS README now lists the plates as NAS + NORTHBEND.
- **Removing the plates from HeleneOYOH was blocked by the permission check. Left for the user (frees ≈ 154 GB):**

```bash
rm -rf "/Volumes/HeleneOYOH/Burrows Campaign 26/renders/cut30/exr" "/Volumes/HeleneOYOH/Burrows Campaign 26/renders/exr" "/Volumes/HeleneOYOH/Burrows Campaign 26/renders/overlays"
```

- Plate slimming on NORTHBEND is optional now that the NAS holds the full copy. If you resume it, its long-film
  comparison check needs the originals, so point it at the NAS copy (`renders/long/exr`) instead of HeleneOYOH.
