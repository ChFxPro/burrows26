import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
ct = bpy.data.node_groups.new("p", 'CompositorNodeTree')
for t in ("CompositorNodeDenoise", "CompositorNodeVecBlur", "CompositorNodeAlphaOver", "CompositorNodeExposure", "CompositorNodeColorBalance",
          "CompositorNodeEllipseMask", "CompositorNodeBlur", "CompositorNodeCombineColor", "CompositorNodeImage", "CompositorNodeViewer"):
    try:
        n = ct.nodes.new(t); print(t, "IN", [(s.name, s.type) for s in n.inputs], "OUT", [s.name for s in n.outputs])
    except Exception as e: print(t, "ERR", e)
img = bpy.data.images.load(a[0]); n = ct.nodes.new("CompositorNodeImage"); n.image = img
print("LAYERPROP", [p.identifier for p in n.bl_rna.properties if 'layer' in p.identifier.lower()])
try:
    print("LAYERS", [i.identifier for i in n.bl_rna.properties['layer'].enum_items])
except Exception as e: print("nolayer", e)
print("IMGOUT", [s.name for s in n.outputs])
