"""Realism / finishing grade for the 30-second comp (used by make_comp30.py).

The shots came out of the render unmatched: the map shots milky (lifted blacks, ~5% saturation),
Cullowhee and Bryson crushed (10% of pixels at black), Dillsboro dark, Cashiers bright. Each
shot gets an exposure + Color Correction (scene-linear, before AgX) keyed per frame, so they
share one black level, midtone and saturation; then a touch of lens dispersion over everything.

  SHOTS[name] = dict(exposure=stops, offset=dehaze (-) / lift (+), contrast, gamma, saturation,
                     shadow_sat=saturation in the shadows only)
"""

SHOTS = {
    "intro":                  dict(exposure=0.35, offset=-0.020, contrast=1.12, gamma=1.00, saturation=1.35, shadow_sat=1.0),
    "brevard_drone":          dict(exposure=0.00, offset=0.000, contrast=1.04, gamma=1.00, saturation=1.10, shadow_sat=1.0),
    "cashiers_cu_side":       dict(exposure=-0.25, offset=0.000, contrast=1.05, gamma=1.00, saturation=1.08, shadow_sat=1.0),
    "ridge_drone":            dict(exposure=-0.10, offset=-0.050, contrast=1.12, gamma=1.00, saturation=1.10, shadow_sat=1.0),
    "cullowhee_cu_front":     dict(exposure=0.30, offset=0.0007, contrast=1.00, gamma=1.08, saturation=1.00, shadow_sat=1.0),
    "dillsboro_drone_golden": dict(exposure=0.40, offset=0.000, contrast=1.00, gamma=1.00, saturation=1.05, shadow_sat=1.0),
    "bryson_cu_arrival":      dict(exposure=0.10, offset=0.0007, contrast=1.03, gamma=1.05, saturation=1.05, shadow_sat=1.0),
    "outro":                  dict(exposure=-0.10, offset=-0.040, contrast=1.12, gamma=1.00, saturation=1.40, shadow_sat=1.0),
}
# offset is very sensitive (AgX lifts small linear values a lot): +0.004 washed Cullowhee out
LENS_DISPERSION = 0.006          # faint colour fringing toward the frame edges, like a real lens

CC = {"saturation": "Master Saturation", "contrast": "Master Contrast", "gamma": "Master Gamma",
      "offset": "Master Offset", "shadow_sat": "Shadows Saturation"}


def apply(nt, maps, shots=SHOTS):
    N, L = nt.nodes, nt.links
    for nm in ("CU_Contrast", "CU_Saturation", "RG_Exposure", "RG_Correct", "RG_Lens"):
        if nm in N:
            N.remove(N[nm])
    cb, mix = N["Color Balance"], N["Mix.012"]
    ex = N.new("CompositorNodeExposure"); ex.name = ex.label = "RG_Exposure"
    cc = N.new("CompositorNodeColorCorrection"); cc.name = cc.label = "RG_Correct"
    L.new(cb.outputs[0], ex.inputs[0]); L.new(ex.outputs[0], cc.inputs[0]); L.new(cc.outputs[0], mix.inputs["A"])
    lens = N.new("CompositorNodeLensdist"); lens.name = lens.label = "RG_Lens"
    lens.inputs["Dispersion"].default_value = LENS_DISPERSION; lens.inputs["Fit"].default_value = True
    targets = [l.to_socket for l in mix.outputs[0].links]
    for s in targets:
        for l in list(s.links):
            L.remove(l)
    L.new(mix.outputs[0], lens.inputs[0])
    for s in targets:
        L.new(lens.outputs[0], s)

    sock = {k: next(i for i in cc.inputs if i.identifier == ident) for k, ident in CC.items()}
    sock["exposure"] = ex.inputs["Exposure"]
    total = len(maps["motion"])
    for f in range(1, total + 1):
        shot = next(s for s in maps["shots"] if s["start"] <= f < s["start"] + s["frames"])
        p = shots[shot["name"]]
        for k, s in sock.items():
            s.default_value = p[k]
            s.keyframe_insert("default_value", frame=f)
    for layer in nt.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    if "RG_" in fc.data_path:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'CONSTANT'
    return sorted(shots)
