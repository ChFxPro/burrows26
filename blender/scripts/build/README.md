# Scene build scripts (one-time)

These built `burrows_wnc_route_tour.blend` on Oct 22. The film doesn't need them to re-render: the
terrain, trees, car and cameras are saved in the `.blend` files, and the textures they link are in
`blender/assets/out/`. Keep them so the scene can be rebuilt or extended, e.g. for a new route.

They were recovered on Oct 27 from the build session's transcript, after the temp folder they ran in was
cleared. Heredoc-written files hold their last written version, so a later in-place `sed` edit may be
missing. Treat them as a faithful starting point, not a tested pipeline.

## Data

The source data was lost with the temp folder. The scripts download it again from public sources:

| Script | Writes | Source |
|---|---|---|
| `tiles.py OUT` | terrain tiles (zoom 12) | AWS Terrarium elevation tiles |
| `naip_list.py`, `naip_fetch.sh S`, `naip_fetch2.sh` | NAIP aerial imagery | USDA NAIP `exportImage` |
| (OSM and counties were fetched inline in the session) | `osm.json`, `counties.json` | OpenStreetMap / Census |

Put the data in `blender/assets/source/data/` and the prepared outputs in `blender/assets/source/out/`
(gitignored). `add_outer_world.py`, `add_valley_fog.py` and the `blender_*.py` scripts read from
`assets/source/out`.

## Order

1. `prep.py DATA OUT`: heightmap, map texture, vector data (`vectors.json`)
2. `prep2.py DATA OUT`: satellite base, corridor cells, road geometry
3. `prep_naip.py DATA OUT`, `colorfix.py`: NAIP re-texture (`cells/`, `strips/`, `base_sat.jpg`)
4. `prep_outer.py DATA OUT`: outer terrain ring (`outer_z.npy`, `outer_meta.json`, `outer_tex.jpg`)
5. In Blender: `blender_corridor.py`, `blender_trees.py`, `blender_subaru.py`, `blender_detail.py`,
   `blender_atmos.py`, `blender_anim.py`
6. Render setup: `setup_passes.py`, `slim_passes.py`, `fix_cycles1.py`, `fix_cycles2.py`, `fix_decal_shadow.py`
7. Comp: `extract_comp_keys.py`, `build_comp.py` (now `../make_comp30.py` for the 30 s cut)

`geo.py` holds the shared projection and corridor-cell definitions. `preview_render*.py`, `render_frames.py`,
`probe_comp.py`, `crypto2.py` and `set_output.py` are small helpers.
