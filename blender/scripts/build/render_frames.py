"""CLI: render specific frames.  args after --:  out_prefix  WxH  frame:name ..."""
import bpy, sys, time, json
a = sys.argv[sys.argv.index("--") + 1:]
out, res = a[0], a[1]; W, H = map(int, res.split("x"))
sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 100
im = sc.render.image_settings
try: im.media_type = 'IMAGE'
except Exception: pass
im.file_format = 'PNG'
log = {}
for item in a[2:]:
    f, name = item.split(":"); t = time.time()
    sc.frame_set(int(f)); sc.render.filepath = f"{out}{name}.png"; bpy.ops.render.render(write_still=True)
    log[name] = round(time.time() - t, 1); json.dump(log, open(f"{out}times.json", "w"))
