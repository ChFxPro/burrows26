// Shared pieces for the end-tag concepts: renderer, the Blender overview camera, brand fonts,
// text (flat and extruded), logo pieces, and the end lockup with the dates and disclaimer.
//
// Two scenes are drawn each frame:
//   world  - Blender map units (Z up), seen through CAM_Overview exactly as in the film, so lines
//            and pins sit on the rendered terrain.
//   hud    - 1920x1080 "pixel" units (origin top-left via px()/py()), seen by a perspective camera
//            whose z=0 plane maps 1:1 to the frame, so flat text is pixel-exact and 3D letters
//            still get real perspective when they turn.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import opentype from 'opentype';

export const NAVY = '#01295f', BLUE = '#6daedb', RED = '#bf0d19', WHITE = '#ffffff', NAVY_DEEP = '#001b42';
export const FW = 1920, FH = 1080;
export const px = x => x - FW / 2;
export const py = y => FH / 2 - y;

// ---------- timing helpers ----------
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = k => 1 - Math.pow(1 - k, 3);
export const easeInOut = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const easeOutBack = (k, s = 1.4) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
export const easeOutExpo = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);

const FONT_FILES = { 500: 'Rosales-Medium.otf', 700: 'Rosales-Bold.otf', 800: 'Rosales-ExtraBold.otf' };

export async function setup(W, H, startFilm) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const [cfg, outro, district, mountain, logoLetters] = await Promise.all(
    ['/cfg/endcard.json', '/data/outro_scene.json', '/data/district.json', '/data/mountain.json', '/data/logo_letters.json']
      .map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })));

  // fonts: opentype for extruded glyphs, FontFace for canvas text
  const fonts = {};
  await Promise.all(Object.entries(FONT_FILES).map(async ([w, file]) => {
    const buf = await fetch('/brand/Fonts/' + file).then(r => r.arrayBuffer());
    fonts[w] = opentype.parse(buf);
    const ff = new FontFace('Rosales', buf.slice(0), { weight: String(w) });
    await ff.load(); document.fonts.add(ff);
  }));

  // ---------- world scene: Blender overview camera ----------
  const world = new THREE.Scene();
  world.environment = env;
  const aspect = FW / FH;
  const hfov = 2 * Math.atan((outro.sensor / 2) / outro.lens);          // sensor fit AUTO -> horizontal
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI;
  const cam = new THREE.PerspectiveCamera(vfov, aspect, 0.1, 1500);
  cam.matrixAutoUpdate = false;
  const camMats = outro.cams.map(a => new THREE.Matrix4().fromArray(a));
  world.add(new THREE.HemisphereLight(0xdfefff, 0x1a2a40, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-40, -60, 120); world.add(sun);

  // ---------- hud scene: pixel-exact 1920x1080 plane at z=0 ----------
  const hud = new THREE.Scene();
  hud.environment = env;
  const HFOV = 30;
  const hudCam = new THREE.PerspectiveCamera(HFOV, aspect, 10, 20000);
  hudCam.position.set(0, 0, (FH / 2) / Math.tan(THREE.MathUtils.degToRad(HFOV / 2)));
  hud.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-400, 600, 1200); hud.add(key);

  const ctx = {
    THREE, renderer, world, hud, cam, hudCam, cfg, outro, district, mountain, logoLetters, fonts, env, W, H,
    startFilm, filmFrame: startFilm,
    frame(f) {
      ctx.filmFrame = startFilm + f;
      const i = Math.min(camMats.length - 1, Math.max(0, ctx.filmFrame - outro.first_frame));
      cam.matrix.copy(camMats[i]); cam.updateMatrixWorld(true);
    },
    render() {
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(world, cam);
      renderer.clearDepth();
      renderer.render(hud, hudCam);
    },
  };
  await loadLogo(ctx);
  return ctx;
}

// ---------- flat text: canvas texture on a plane, origin at (left, baseline) ----------
export function textPlane(ctx, str, { weight = 800, size = 92, color = WHITE, ls = 0, anchor = 'left' } = {}) {
  const s = 2;                                         // supersample, mipmapped down
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size * s}px Rosales`;
  g.font = font; g.letterSpacing = `${ls * s}px`;
  const m = g.measureText(str);
  const asc = Math.ceil(m.actualBoundingBoxAscent) + 2 * s, desc = Math.ceil(m.actualBoundingBoxDescent) + 2 * s;
  const pad = 4 * s;
  c.width = Math.ceil(m.width) + 2 * pad; c.height = asc + desc;
  g.font = font; g.letterSpacing = `${ls * s}px`; g.fillStyle = color; g.textBaseline = 'alphabetic';
  g.fillText(str, pad, asc);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const w = c.width / s, h = c.height / s;
  const geo = new THREE.PlaneGeometry(w, h);
  const ax = anchor === 'center' ? -w / 2 + pad / s : anchor === 'right' ? -w + pad / s : 0;
  geo.translate(w / 2 - pad / s + ax + (anchor === 'left' ? 0 : 0), h / 2 - desc / s, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { width: m.width / s, capH: m.actualBoundingBoxAscent / s, tex };
  return mesh;
}

export function rect(w, h, color, { opacity = 1, anchor = 'tl' } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  if (anchor === 'tl') geo.translate(w / 2, -h / 2, 0);
  if (anchor === 'l') geo.translate(w / 2, 0, 0);
  if (anchor === 'b') geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(geo, mat);
}

export function pill(w, h, color) {
  const r = h / 2, sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), mat);
}

// ---------- extruded text from the brand font, one mesh per letter ----------
// Each letter's pivot is its bottom-centre on the baseline, front face at z=0.
export function extrudeText(ctx, str, { weight = 800, size = 92, depth = 18, ls = 0, front, side } = {}) {
  const font = ctx.fonts[weight];
  front = front || new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.32, metalness: 0.1, transparent: true });
  side = side || new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.5, metalness: 0.05, transparent: true });
  const group = new THREE.Group(), letters = [];
  const glyphs = font.stringToGlyphs(str), scale = size / font.unitsPerEm;
  let x = 0;
  glyphs.forEach((gl, i) => {
    const p = gl.getPath(0, 0, size);
    if (p.commands.length) {
      const sp = new THREE.ShapePath();
      for (const c of p.commands) {
        if (c.type === 'M') sp.moveTo(c.x, -c.y);
        else if (c.type === 'L') sp.lineTo(c.x, -c.y);
        else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
        else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
      }
      let big = null, bigA = 0;
      for (const s of sp.subPaths) { const a = Math.abs(THREE.ShapeUtils.area(s.getPoints())); if (a > bigA) { bigA = a; big = s; } }
      const outerCW = THREE.ShapeUtils.isClockWise(big.getPoints());
      const shapes = sp.toShapes(!outerCW);
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth, bevelEnabled: true, bevelThickness: depth * 0.12, bevelSize: size * 0.006, bevelSegments: 2, curveSegments: 8 });
      geo.computeBoundingBox();
      const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
      geo.translate(-cx, 0, -depth - depth * 0.12);
      const mesh = new THREE.Mesh(geo, [front, side]);
      mesh.position.x = x + cx;
      mesh.userData.x0 = mesh.position.x;
      group.add(mesh); letters.push(mesh);
    }
    x += gl.advanceWidth * scale + ls;
    if (glyphs[i + 1]) x += font.getKerningValue(gl, glyphs[i + 1]) * scale;
  });
  group.userData.width = x - ls;
  return { group, letters, width: x - ls, front, side };
}

// ---------- light sweep: a soft white band that only lights the text pixels under it ----------
export function sweepOverlay(textMesh, { width = 0.08, tilt = 0.35 } = {}) {
  const tex = textMesh.material.map;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { map: { value: tex }, pos: { value: -1 }, width: { value: width }, strength: { value: 0 },
                aspect: { value: tex.image.width / tex.image.height }, tilt: { value: tilt } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float pos, width, strength, aspect, tilt; varying vec2 vUv;
      void main(){ float a = texture2D(map, vUv).a;
        float d = vUv.x - pos + (vUv.y - 0.5) * tilt / aspect;
        float k = exp(-d * d / (width * width)) * strength;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a * k * 0.85); }`,
  });
  const m = new THREE.Mesh(textMesh.geometry, mat);
  m.position.z = 0.5; textMesh.add(m);
  return mat.uniforms;
}

// ---------- the logo: the real artwork cut into its parts ----------
// Logo - Contrast.png is 1500x744: mountain+bar rows 0-255 (ELECT is the white inside them),
// BURROWS 300-501, red rule 542-575, NC HOUSE 119 626-744.
const LOGO_PARTS = { mountain: [0, 0, 1500, 255], elect: [0, 0, 700, 222], burrows: [0, 290, 1500, 220],
                     rule: [0, 540, 1500, 37], house: [0, 620, 1500, 124] };
async function loadLogo(ctx) {
  const img = new Image(); img.src = '/brand/Logo - Contrast.png'; await img.decode();
  const pieces = {};
  for (const [k, [x, y, w, h]] of Object.entries(LOGO_PARTS)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, x, y, w, h, 0, 0, w, h);
    if (k === 'mountain' || k === 'elect') {           // split ELECT (white) from the mountain (blue)
      const d = g.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const white = p[i] > 180 && p[i + 1] > 180 && p[i + 2] > 180 && p[i] > p[i + 2] - 30 && Math.abs(p[i] - p[i + 1]) < 30;
        const blueish = p[i + 2] - p[i] > 50;
        if (k === 'mountain' && white && !blueish) p[i + 3] = 0;
        if (k === 'elect' && (blueish || !white)) p[i + 3] = 0;
      }
      g.putImageData(d, 0, 0);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    pieces[k] = { tex, rect: [x, y, w, h] };
  }
  const full = new THREE.Texture(img); full.colorSpace = THREE.SRGBColorSpace; full.needsUpdate = true;
  ctx.logo = { pieces, full, W: 1500, H: 744 };
}

// a logo part as a plane; (x,y) top-left of the whole logo in px coords, s = px per logo unit
export function logoPart(ctx, k, s) {
  const { tex, rect: [x, y, w, h] } = ctx.logo.pieces[k];
  const geo = new THREE.PlaneGeometry(w * s, h * s);
  geo.translate(w * s / 2 + x * s, -h * s / 2 - y * s, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(geo, mat);
}
export function logoFull(ctx, s) {
  const geo = new THREE.PlaneGeometry(1500 * s, 744 * s); geo.translate(750 * s, -372 * s, 0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ctx.logo.full, transparent: true, depthWrite: false, toneMapped: false }));
}

// the logo mountain silhouette (top edge + bar) as a Shape, in logo units scaled by s, y up from bar bottom
export function mountainShape(ctx, s) {
  const prof = ctx.mountain.profile, sh = new THREE.Shape();
  sh.moveTo(0, 0);
  for (const [x, y] of prof) sh.lineTo(x * 1500 * s, y * 1500 * s);
  sh.lineTo(1500 * s, 0); sh.closePath();
  return sh;
}
export function mountainLine(ctx, s) {          // ridge line points (for a draw-on stroke)
  return ctx.mountain.profile.map(([x, y]) => new THREE.Vector3(x * 1500 * s, y * 1500 * s, 0));
}

// ---------- fat lines with draw-on ----------
export function fatLine(ctx, pts, { color = WHITE, width = 3, opacity = 1, depthTest = false } = {}) {
  const pos = []; for (const p of pts) pos.push(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2] ?? 0);
  const geo = new LineGeometry(); geo.setPositions(pos);
  const mat = new LineMaterial({ color, linewidth: width * ctx.W / FW, transparent: true, opacity, depthTest, depthWrite: false,
                                 toneMapped: false, worldUnits: false });
  mat.resolution.set(ctx.W, ctx.H);
  const line = new Line2(geo, mat); line.computeLineDistances();
  const n = pts.length - 1;
  line.userData = { n, pos, geo };
  line.setProgress = k => { geo.instanceCount = Math.max(0, Math.round(n * clamp01(k))); line.visible = k > 0.001; };
  line.setPoints = arr => { geo.setPositions(arr); };
  line.frustumCulled = false;
  return line;
}

// ---------- the end lockup: navy band, logo, tagline, dates, disclaimer ----------
// Layout matches make_endcard.py (band from y=630, disclaimer row inside 5% title-safe) but in Rosales.
export function buildBand(ctx) {
  const { cfg } = ctx, g = new THREE.Group(), L = {};
  const BAND_TOP = 630, DISC_TOP = FH - 54 - 76;
  L.band = rect(FW, FH - BAND_TOP, NAVY, { opacity: 0.97 }); L.band.position.set(px(0), py(BAND_TOP), -2);
  L.rule = rect(FW, 7, RED); L.rule.position.set(px(0), py(BAND_TOP), -1);
  L.discRow = rect(FW, FH - DISC_TOP, NAVY_DEEP, { opacity: 0.98 }); L.discRow.position.set(px(0), py(DISC_TOP), -1.5);
  const contentTop = BAND_TOP + 7, s = 230 / 744;
  L.logo = logoFull(ctx, s); const lx = 110, ly = contentTop + (DISC_TOP - contentTop - 230) / 2;
  L.logo.position.set(px(lx), py(ly), 0);
  const dx = lx + 1500 * s + 64;
  L.div = rect(4, DISC_TOP - contentTop - 88, BLUE); L.div.position.set(px(dx), py(contentTop + 46), 0);
  const tx = dx + 64;
  L.head = textPlane(ctx, cfg.headline, { weight: 800, size: 100, ls: 1 });
  L.head.position.set(px(tx), py(contentTop + 26 + 63), 0);
  L.sub = textPlane(ctx, cfg.subline, { weight: 700, size: 58, color: BLUE, ls: 1 });
  L.sub.position.set(px(tx), py(contentTop + 26 + 63 + 66), 0);
  const ctaT = textPlane(ctx, cfg.cta, { weight: 700, size: 42, ls: 1 });
  const pw = ctaT.userData.width + 64, ph = 64, pyTop = contentTop + 26 + 63 + 66 + 30;
  L.pill = pill(pw, ph, RED); L.pill.position.set(px(tx + pw / 2), py(pyTop + ph / 2), 0);
  ctaT.position.set(-ctaT.userData.width / 2, -ctaT.userData.capH / 2, 0.2); L.pill.add(ctaT);
  L.date = textPlane(ctx, cfg.cta2, { weight: 700, size: 42, ls: 1 });
  L.date.position.set(px(tx + pw + 34), py(pyTop + ph / 2 + L.date.userData.capH / 2), 0);
  L.disc = textPlane(ctx, cfg.disclaimer, { weight: 500, size: 46, anchor: 'center' });
  L.disc.position.set(0, py(DISC_TOP + 76 / 2 + 16), 0);
  for (const k in L) g.add(L[k]);
  ctx.hud.add(g);
  const right = Math.max(tx + L.head.userData.width, tx + L.sub.userData.width, tx + pw + 34 + L.date.userData.width);
  if (right > FW - 80) console.warn('band text runs to x=' + right.toFixed(0));
  return { group: g, L, tx, headY: contentTop + 26 + 63, BAND_TOP, DISC_TOP };
}

export function setOpacity(obj, a) {
  obj.traverse(o => { if (o.material) for (const m of [].concat(o.material)) { if (m.uniforms) continue;
    if (m.userData.base === undefined) m.userData.base = m.opacity; m.opacity = m.userData.base * a; m.transparent = true; } });
  obj.visible = a > 0.001;
}
