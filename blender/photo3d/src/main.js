// Campaign photos as real prints dropped onto the film: a constant build. Each print lands large
// (its "hero" pose), holds, then lifts and tucks into its collage "slot" and stays. Layout and
// timing come from blender/photos.json; textures from assets/photos/prints (make_photo_prints.py).
//
// The page never animates on its own: render.mjs calls PH.render(frame) per film frame, so every
// frame is a pure function of its number. Output is a transparent layer: prints plus their
// shadows (shadow maps onto a shadow-catcher "table" = the film, and onto each other) and a soft
// contact-occlusion pad under each card.
import * as THREE from 'three';

const W = 1920, H = 1080, FPS = 24;
const cfg = await (await fetch('/photos.json', { cache: 'no-store' })).json();
const B = cfg.build;
const LAND = B.land_frames, MOVE = B.move_frames;

// ---------- renderer / camera: world units are film pixels, z toward the camera --------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
const SS = 2;                                     // supersample: render 2x, filter down
renderer.setPixelRatio(SS);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;           // soft penumbra; contact edge comes from the pad
document.body.appendChild(renderer.domElement);

const D = 2600;                                    // camera distance: z = 0 maps 1:1 onto the frame
const camera = new THREE.PerspectiveCamera(2 * Math.atan(H / 2 / D) * 180 / Math.PI, W / H, 10, 20000);
camera.position.set(0, 0, D);
const scene = new THREE.Scene();
const sx = x => x - W / 2, sy = y => H / 2 - y;  // film px -> world

// ---------- light: soft key from upper-left-front, sky fill, and the table that catches shadows -
const LIGHT = cfg.build.light || {};
const hemi = new THREE.HemisphereLight(0xf4f6ff, 0x8a8170, LIGHT.fill ?? 1.15);
hemi.position.set(0, 0.35, 1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff3e4, LIGHT.key ?? 1.45);
const KEYDIR = new THREE.Vector3(-0.42, 0.55, 1).normalize();
key.position.copy(KEYDIR).multiplyScalar(4000);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1400, right: 1400, top: 900, bottom: -900, near: 100, far: 9000 });
key.shadow.radius = 14; key.shadow.blurSamples = 24;
key.shadow.bias = -0.0004;
scene.add(key, key.target);

const table = new THREE.Mesh(new THREE.PlaneGeometry(6000, 4000),
  new THREE.ShadowMaterial({ opacity: LIGHT.shadow ?? 0.38, color: 0x0b0d08 }));
table.receiveShadow = true;
scene.add(table);

// ---------- contact occlusion pad: a blurred card silhouette right under each print -----------
function padTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(4px)'; g.fillStyle = '#fff';            // card footprint with a soft rim
  g.beginPath(); g.roundRect(8, 8, 240, 240, 5); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
const PAD = padTexture();

// ---------- prints ---------------------------------------------------------------------------
const loader = new THREE.TextureLoader();
const SEG = 18;
const prints = await Promise.all(cfg.prints.map(async (p, i) => {
  const tex = await loader.loadAsync(`/assets/photos/prints/${p.name}.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const aspect = tex.image.height / tex.image.width;
  const geo = new THREE.PlaneGeometry(1, aspect, SEG, SEG);
  const base = geo.attributes.position.array.slice();
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, side: THREE.DoubleSide,
    roughness: 0.62, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.32,   // photo-paper sheen
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  // the print PNG carries a transparent band on top for the tape (make_photo_prints.py: 0.075 x
  // width); the occlusion pad covers only the card itself
  const tapeBand = 0.075, cardH = aspect - tapeBand;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.025, cardH + 0.025),
    new THREE.MeshBasicMaterial({ color: 0x050604, alphaMap: PAD, transparent: true, depthWrite: false }));
  pad.userData.y = -tapeBand / 2;
  const g = new THREE.Group(); g.add(pad, mesh);
  scene.add(g);
  return { p, i, g, mesh, pad, geo, base, aspect, side: p.from === 'right' ? 1 : -1, zSlot: 4 + i * 2.2 };
}));

// ---------- animation ------------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);       // smootherstep: zero velocity both ends
const rad = d => d * Math.PI / 180;
const Z_HERO = 70;

function pose(P, f) {
  const p = P.p, [hx, hy, hw, hr] = p.hero, [tx, ty, tw, tr] = p.slot, s = P.side;
  if (f < p.in) return null;
  let o;
  if (f < p.in + LAND) {
    // tossed onto the table: it glides in and decelerates, the leading edge touches first, then
    // the tilt and curl relax a beat after it lands (no overshoot, nothing bounces)
    const t = (f - p.in) / LAND, e = easeOutQuint(t), r = easeOut(clamp(t * 1.08));
    o = { x: lerp(hx + s * 520, hx, e), y: lerp(hy - 150, hy, e), z: lerp(330, Z_HERO, easeOut(t)), w: hw,
          rz: lerp(hr + s * 12, hr, r), rx: lerp(-20, 0, r), ry: lerp(s * 16, 0, r), curl: lerp(0.16, 0.02, r),
          alpha: clamp((f - p.in + 1) / 3) };
  } else if (f < p.settle) {                                     // hero: perfectly still while it's read
    o = { x: hx, y: hy, z: Z_HERO, w: hw, rz: hr, rx: 0, ry: 0, curl: 0.02, alpha: 1 };
  } else {                                                        // lift gently and tuck into its slot
    const t = clamp((f - p.settle) / MOVE), e = smoother(t), arc = Math.sin(Math.PI * t);
    o = { x: lerp(hx, tx, e), y: lerp(hy, ty, e), z: lerp(Z_HERO, P.zSlot, e) + 80 * arc,
          w: lerp(hw, tw, e), rz: lerp(hr, tr, e), rx: -5 * arc, ry: -s * 4 * arc,
          curl: 0.02 + 0.05 * arc, alpha: 1 };
  }
  if (B.clear != null && f >= B.clear) {                         // optional sweep-off at the end
    const t = clamp((f - B.clear - P.i * (B.clear_stagger ?? 1)) / (B.clear_frames ?? 12)), e = t * t;
    o.x += s * 1500 * e; o.z += 160 * Math.sin(Math.PI * t); o.rz += s * 10 * e; o.rx += -10 * Math.sin(Math.PI * t);
  }
  return o;
}

function bend(P, curl) {               // paper curl: the long edges lift, like a print off a stack
  const a = P.geo.attributes.position, arr = a.array, b = P.base;
  for (let k = 0; k < arr.length; k += 3) {
    const x = b[k], y = b[k + 1] / P.aspect;
    arr[k + 2] = curl * (x * x * 0.9 + 0.25 * y * y);
  }
  a.needsUpdate = true;
  P.geo.computeVertexNormals();
}

function frame(f) {
  for (const P of prints) {
    const o = pose(P, f);
    P.g.visible = !!o;
    if (!o) continue;
    P.g.position.set(sx(o.x), sy(o.y), o.z);
    P.g.rotation.set(rad(o.rx), rad(o.ry), rad(-o.rz), 'ZXY');
    P.g.scale.setScalar(o.w);
    bend(P, o.curl);
    P.mesh.material.opacity = o.alpha;
    // contact occlusion: only where the card touches down; gone once it is a few px off the table
    const lift = clamp((o.z - P.zSlot) / 30);
    P.pad.position.set(0, P.pad.userData.y, -1.5 / o.w);                         // just under the card, follows its curl
    P.pad.scale.setScalar(1 + lift * 0.06);
    P.pad.material.opacity = 0.32 * (1 - lift) * o.alpha;
  }
}

const outCanvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
const out = outCanvas.getContext('2d');
out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high';

window.PH = {
  fps: FPS,
  render(f) {
    frame(f); renderer.render(scene, camera);
    out.clearRect(0, 0, W, H); out.drawImage(renderer.domElement, 0, 0, W, H);   // 2x -> 1x, filtered
    return outCanvas.toDataURL('image/png');
  },
};
window.PH_READY = true;
