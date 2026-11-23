"""Render-time helper: freeze the per-cell tree visibility keyframes for one segment.

Each tree cell's 'Trees' modifier has keyframed render visibility. Blender re-runs any
modifier with animated settings on every frame, so every cell re-scatters its trees and
Cycles re-syncs them each frame (~15 s/frame), even though the value only changes at a
few frames in the film. Rendering in segments between those frames, with the keyframes
frozen, gives identical pixels without the rebuild. The .blend is never saved.

  Blender -b scene.blend --python freeze_tree_visibility.py -- list
      prints "SEGMENTS 1-114 115-119 ..." (one camera, constant tree visibility in each)
  Blender -b scene.blend --python freeze_tree_visibility.py -a -- START END
      sets the frame range, freezes visibility at START, then -a renders it
"""
import bpy, sys
D = bpy.data
sc = bpy.context.scene
PATH = 'modifiers["Trees"].show_render'
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def tree_curves():
    for o in D.objects:
        ad = o.animation_data
        if not (ad and ad.action):
            continue
        for layer in ad.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        if fc.data_path == PATH:
                            yield o, bag, fc


if args and args[0] == "list":
    # split at every camera cut too, so each shot can be re-rendered on its own
    cuts = {m.frame for m in sc.timeline_markers if m.camera and sc.frame_start < m.frame <= sc.frame_end}
    for _, _, fc in tree_curves():
        prev = None
        for f in range(sc.frame_start, sc.frame_end + 1):
            v = fc.evaluate(f) > 0.5
            if prev is not None and v != prev:
                cuts.add(f)
            prev = v
    starts = [sc.frame_start] + sorted(cuts)
    ends = [s - 1 for s in starts[1:]] + [sc.frame_end]
    print("SEGMENTS " + " ".join(f"{s}-{e}" for s, e in zip(starts, ends)))
else:
    start, end = int(args[0]), int(args[1])
    sc.frame_start, sc.frame_end = start, end
    n = 0
    for o, bag, fc in list(tree_curves()):
        o.modifiers["Trees"].show_render = fc.evaluate(start) > 0.5
        bag.fcurves.remove(fc)
        n += 1
    print(f"FROZE {n} tree cells for frames {start}-{end}")
    # motion blur for the cameras the scene lists (the 30s close-ups); segments never span a cut
    before = [m for m in sc.timeline_markers if m.camera and m.frame <= start]
    cam = max(before, key=lambda m: m.frame).camera if before else sc.camera
    if cam and cam.name in list(sc.get("motion_blur_cameras", [])):
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = float(sc.get("motion_blur_shutter", 0.5))
        print(f"MOTION BLUR on for {cam.name}, shutter {sc.render.motion_blur_shutter}")
        # blur samples part of a frame either side; past a cut the next shot's keys would smear
        # the car, so continue every per-frame curve straight on past this segment's ends
        def per_frame_curves(owner):
            ad = getattr(owner, "animation_data", None)
            if ad and ad.action:
                for layer in ad.action.layers:
                    for strip in layer.strips:
                        for bag in strip.channelbags:
                            yield from bag.fcurves
        n = 0
        for o in bpy.data.objects:
            for fc in per_frame_curves(o):
                if fc.data_path.endswith(("hide_render", "show_render", "hide_viewport", "show_viewport")):
                    continue
                kp = {round(k.co.x): k for k in fc.keyframe_points}
                for edge, inner, outer in ((start, start + 1, start - 1), (end, end - 1, end + 1)):
                    if edge in kp and inner in kp:
                        v = 2 * kp[edge].co.y - kp[inner].co.y
                        if outer in kp:
                            kp[outer].co.y = v
                        else:
                            fc.keyframe_points.insert(outer, v).interpolation = 'LINEAR'
                        n += 1
                fc.update()
        print(f"EXTENDED {n} curve ends past frames {start}-{end}")
    else:
        sc.render.use_motion_blur = False
