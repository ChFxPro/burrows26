// Entry point. The page never animates on its own: render.mjs calls TAG.render(frame) for each
// frame, so every frame is a pure function of its number (no wall clock, no requestAnimationFrame).
import { setup } from './common.js';
import { concepts } from './concepts.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920, H = +q.get('h') || 1080;
const name = q.get('concept') || 'A';
const startFilm = +q.get('start') || 613;          // film frame where tag frame 0 sits

try {
  const ctx = await setup(W, H, startFilm);
  const c = await concepts[name](ctx);
  window.TAG = {
    fps: 24, frames: c.frames,
    render(f) {
      ctx.frame(f);
      c.update(f / 24, f);
      ctx.render();
      return ctx.renderer.domElement.toDataURL('image/png');
    },
  };
  window.TAG_READY = true;
} catch (e) {
  console.error('TAG setup failed', e && e.stack || e);
  window.TAG_ERROR = String(e && e.stack || e);
}
