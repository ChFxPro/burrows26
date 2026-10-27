"""Realism / finishing grade for the 30-second comp (used by make_comp30.py).

The shots came out of the render unmatched: the map shots milky (lifted blacks, ~5% saturation),
Cullowhee and Bryson crushed (10% of pixels at black), Dillsboro dark, Cashiers bright. Each
shot gets an exposure + Color Correction (scene-linear, before AgX) keyed per frame, so they
share one black level, midtone and saturation; then a touch of lens dispersion over everything.

  SHOTS[name] = dict(exposure=stops, offset=dehaze (-) / lift (+), contrast, gamma, saturation,
                     shadow_sat=saturation in the shadows only, hi_gain=highlights gain (<1 pulls
                     back near-clipped areas), glare=bloom strength, glare_thresh=bloom threshold,
                     outer=0..1 neutralise the orange land outside the district (hue key),
                     sign=0..1 lift on the car's roof sign (Cryptomatte))
"""

DEFAULTS = dict(shadow_sat=1.0, hi_gain=1.0, glare=0.30, glare_thresh=2.5, outer=0.0, sign=0.0)
SHOTS = {
    "intro":                  dict(exposure=0.35, offset=-0.020, contrast=1.12, gamma=1.00, saturation=1.35, outer=1.0),
    "brevard_drone":          dict(exposure=0.00, offset=0.000, contrast=1.04, gamma=1.00, saturation=1.10),
    # bloom off the glossy paint and windows hazed the door logo: almost no glare, softer top end
    "cashiers_cu_side":       dict(exposure=-0.25, offset=0.000, contrast=1.05, gamma=1.00, saturation=1.08,
                                   hi_gain=0.90, glare=0.05, glare_thresh=6.0),
    # overhead in full sun clipped: down ~half a stop, highlights rolled off, less dehaze crush
    "ridge_drone":            dict(exposure=-0.75, offset=-0.030, contrast=1.06, gamma=1.00, saturation=1.12,
                                   hi_gain=0.75, glare=0.10, glare_thresh=4.0),
    # roof sign is back-lit (sun behind the car), so it reads near-black: lift it alone
    "cullowhee_cu_front":     dict(exposure=0.30, offset=0.0007, contrast=1.00, gamma=1.08, saturation=1.00, sign=1.0),
    "dillsboro_drone_golden": dict(exposure=0.40, offset=0.000, contrast=1.00, gamma=1.00, saturation=1.05),
    "bryson_cu_arrival":      dict(exposure=0.10, offset=0.0007, contrast=1.03, gamma=1.05, saturation=1.05),
    "outro":                  dict(exposure=-0.10, offset=-0.040, contrast=1.12, gamma=1.00, saturation=1.40),
}
for _p in SHOTS.values():
    for _k, _v in DEFAULTS.items():
        _p.setdefault(_k, _v)
# offset is very sensitive (AgX lifts small linear values a lot): +0.004 washed Cullowhee out
LENS_DISPERSION = 0.006          # faint colour fringing toward the frame edges, like a real lens

# Intro map: the land outside the three counties read rust-orange. It shares one object with the
# county highlight (Terrain_WNC) and the haze above it is volume (no Cryptomatte), so it is keyed by
# hue instead: the orange band (~20-40 deg) is desaturated and darkened a touch, the county
# yellow/green (50 deg and up) and the pure-red city pins (< 8 deg) are left alone.
#   (hue 0..1, curve value; 0.5 = unchanged)
OUTER_SAT_CURVE = [(0.0, 0.5), (0.014, 0.5), (0.036, 0.20), (0.105, 0.20), (0.135, 0.5), (1.0, 0.5)]
OUTER_VAL_CURVE = [(0.0, 0.5), (0.014, 0.5), (0.036, 0.44), (0.105, 0.44), (0.135, 0.5), (1.0, 0.5)]
# Cullowhee: the roof sign (sun behind it) went near-black; lift it alone, soft matte edge
SIGN_OBJECTS = "Burrows_Sign_Board,Burrows_Sign_LogoFront,Burrows_Sign_Stripe"
SIGN_STOPS = 1.1
SIGN_SOFTEN = 5                   # px blur on the matte (the sign is out of focus; raw matte speckles)
SIGN_ERODE = 4                    # px pulled in first, so the soft edge doesn't lift the sky around it

CC = {"saturation": "Master Saturation", "contrast": "Master Contrast", "gamma": "Master Gamma",
      "offset": "Master Offset", "shadow_sat": "Shadows Saturation", "hi_gain": "Highlights Gain"}
RG_NODES = ("CU_Contrast", "CU_Saturation", "RG_Exposure", "RG_Correct", "RG_Lens",
            "RG_OuterHue", "RG_OuterAmt", "RG_OuterMix",
            "RG_SignMatte", "RG_SignErode", "RG_SignSoft", "RG_SignAmt", "RG_SignFac", "RG_SignLift", "RG_SignMix")


def _masked(N, L, src, name, fix_nodes, plate=None, objects=None, soften=0):
    """src -> fix chain, blended back over src by keyed amount (x Cryptomatte matte if objects)."""
    amt = N.new("ShaderNodeValue"); amt.name = amt.label = f"RG_{name}Amt"
    fac = amt
    if objects:
        m = N.new("CompositorNodeCryptomatte"); m.name = m.label = f"RG_{name}Matte"
        m.matte_id = objects
        L.new(plate.outputs["CryptoObject00"], m.inputs["Crypto 00"])
        matte = m.outputs["Matte"]
        if soften:
            e = N.new("CompositorNodeDilateErode"); e.name = e.label = f"RG_{name}Erode"
            next(i for i in e.inputs if i.type in ('INT', 'VALUE') and i.name in ("Size", "Distance")).default_value = -SIGN_ERODE
            L.new(matte, e.inputs[0]); matte = e.outputs[0]
            b = N.new("CompositorNodeBlur"); b.name = b.label = f"RG_{name}Soft"
            b.inputs["Size"].default_value = (soften, soften)
            L.new(matte, b.inputs[0]); matte = b.outputs[0]
        fac = N.new("ShaderNodeMath"); fac.name = fac.label = f"RG_{name}Fac"; fac.operation = 'MULTIPLY'
        L.new(matte, fac.inputs[0]); L.new(amt.outputs[0], fac.inputs[1])
    prev = src
    for n in fix_nodes:
        L.new(prev, n.inputs[0]); prev = n.outputs[0]
    mix = N.new("ShaderNodeMix")
    mix.data_type = 'RGBA'; mix.name = mix.label = f"RG_{name}Mix"
    L.new(fac.outputs[0], mix.inputs["Factor"])
    L.new(src, mix.inputs[6]); L.new(prev, mix.inputs[7])          # A, B (colour sockets)
    return mix.outputs[2], amt.outputs[0]


def apply(nt, maps, shots=SHOTS):
    N, L = nt.nodes, nt.links
    for nm in RG_NODES:
        if nm in N:
            N.remove(N[nm])
    cb, mix = N["Color Balance"], N["Mix.012"]
    plate = next(n for n in N if n.type == 'IMAGE' and "CryptoObject00" in n.outputs)
    ex = N.new("CompositorNodeExposure"); ex.name = ex.label = "RG_Exposure"
    cc = N.new("CompositorNodeColorCorrection"); cc.name = cc.label = "RG_Correct"
    L.new(cb.outputs[0], ex.inputs[0]); L.new(ex.outputs[0], cc.inputs[0])

    hc = N.new("CompositorNodeHueCorrect"); hc.name = hc.label = "RG_OuterHue"
    for curve, pts in ((hc.mapping.curves[1], OUTER_SAT_CURVE), (hc.mapping.curves[2], OUTER_VAL_CURVE)):
        while len(curve.points) > 2:
            curve.points.remove(curve.points[-1])
        curve.points[0].location, curve.points[1].location = pts[0], pts[-1]
        for x, y in pts[1:-1]:
            curve.points.new(x, y)
    hc.mapping.update()
    out, outer_amt = _masked(N, L, cc.outputs[0], "Outer", [hc])

    lift = N.new("CompositorNodeExposure"); lift.name = lift.label = "RG_SignLift"
    lift.inputs["Exposure"].default_value = SIGN_STOPS
    out, sign_amt = _masked(N, L, out, "Sign", [lift], plate, SIGN_OBJECTS, SIGN_SOFTEN)
    L.new(out, mix.inputs["A"])

    lens = N.new("CompositorNodeLensdist"); lens.name = lens.label = "RG_Lens"
    lens.inputs["Dispersion"].default_value = LENS_DISPERSION; lens.inputs["Fit"].default_value = True
    targets = [l.to_socket for l in mix.outputs[0].links]
    for s in targets:
        for l in list(s.links):
            L.remove(l)
    L.new(mix.outputs[0], lens.inputs[0])
    for s in targets:
        L.new(lens.outputs[0], s)

    glare = N["Glare"]
    sock = {k: next(i for i in cc.inputs if i.identifier == ident) for k, ident in CC.items()}
    sock["exposure"] = ex.inputs["Exposure"]
    sock["outer"], sock["sign"] = outer_amt, sign_amt
    sock["glare"] = glare.inputs["Strength"]
    sock["glare_thresh"] = next(i for i in glare.inputs if i.identifier == "Highlights Threshold")
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
                    if "RG_" in fc.data_path or 'nodes["Glare"]' in fc.data_path:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'CONSTANT'
    return sorted(shots)
