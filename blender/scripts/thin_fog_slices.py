"""Headless: halve the valley fog slices (18 -> 9) for ~30% faster fog shots.

Keeps every other slice (z 0.1, 0.3 ... 1.7) and makes each one denser so it covers
like the two it replaces:  a' = 1 - (1 - a)^2 = a * (2 - a).
A/B tested on frames 100 and 1680: 28-35% faster, near-identical look.

Run after add_valley_fog.py (which builds 18 slices). Safe to re-run: does nothing
if the slices are already thinned.
"""
import bpy
D = bpy.data
COMP = "FOG9_TwoLayer"

col = D.collections["Valley_Fog"]
slices = sorted(col.all_objects, key=lambda o: o.location.z)
nt = D.materials["MAT_FogSlice"].node_tree

if COMP in nt.nodes:
    print("FOG9_OK already thinned:", len(slices), "slices")
else:
    if len(slices) != 18:
        raise SystemExit(f"expected 18 fog slices, found {len(slices)}")
    for o in slices[1::2]:
        D.objects.remove(o, do_unlink=True)
    src = nt.nodes["Math.027"]                     # per-slice opacity (capped at 0.9)
    targets = [l.to_socket for l in src.outputs[0].links]
    two_minus = nt.nodes.new("ShaderNodeMath"); two_minus.operation = 'SUBTRACT'
    two_minus.name = two_minus.label = "FOG9_TwoMinus"; two_minus.inputs[0].default_value = 2.0
    comp = nt.nodes.new("ShaderNodeMath"); comp.operation = 'MULTIPLY'; comp.name = comp.label = COMP
    two_minus.location = (src.location.x + 200, src.location.y - 150)
    comp.location = (src.location.x + 400, src.location.y)
    nt.links.new(src.outputs[0], two_minus.inputs[1])
    nt.links.new(src.outputs[0], comp.inputs[0]); nt.links.new(two_minus.outputs[0], comp.inputs[1])
    for t in targets:
        nt.links.new(comp.outputs[0], t)
    bpy.ops.wm.save_mainfile()
    print("FOG9_OK thinned to", len(col.all_objects), "slices")
