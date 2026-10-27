import bpy, sys
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.eevee.taa_render_samples = 12
im = sc.render.image_settings
try: im.media_type = 'VIDEO'
except Exception: pass
im.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'; sc.render.ffmpeg.constant_rate_factor = 'MEDIUM'
sc.render.filepath = sys.argv[-1]
bpy.ops.render.render(animation=True)
