"""Render-time only: quarter-res, low-sample Cycles review render with in-scene compositing -> MP4."""
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
sc = bpy.context.scene
sc.render.resolution_percentage = 33
sc.cycles.samples = 8; sc.cycles.adaptive_threshold = 0.1
sc.view_layers["Main"].cycles.denoising_store_passes = False
sc.render.use_compositing = True
sc.render.use_overwrite = True; sc.render.use_placeholder = False
sc.frame_step = 2; sc.render.fps = 12
im = sc.render.image_settings
try: im.media_type = 'VIDEO'
except Exception: pass
im.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'; sc.render.ffmpeg.constant_rate_factor = 'MEDIUM'
sc.render.filepath = a[0]
sc.world.mist_settings.depth = 400.0   # in-scene preview mist stays light; the real comp keys mist per shot
