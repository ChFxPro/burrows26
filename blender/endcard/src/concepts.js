// The three end-tag concepts. Each returns { frames, update(t) } where t is seconds from tag
// frame 0 (film frame ctx.startFilm). All of them land on a lockup that holds, fully legible,
// to the last frame, and the "Paid for by" row stays up from its first appearance to the end.
import * as THREE from 'three';
import { NAVY, BLUE, RED, WHITE, NAVY_DEEP, FW, FH, px, py, seg, lerp, clamp01, easeOut, easeInOut, easeOutBack,
         easeOutExpo, textPlane, rect, pill, extrudeText, sweepOverlay, logoPart, mountainShape, mountainLine,
         fatLine, buildBand, setOpacity } from './common.js';

const FRAMES = 204;                                     // 8.5 s: film 25.5 s -> 34.0 s

// ---------- shared: band lockup animation (A and C) ----------
function bandAnimator(ctx, t0) {
  const B = buildBand(ctx), { L } = B;
  const slide = [L.band, L.rule, L.discRow];
  slide.forEach(o => o.userData.y0 = o.position.y);
  // 3D headline that flips up letter by letter, then hands over to the flat (crisper) headline
  const front = new THREE.MeshStandardMaterial({ color: WHITE, emissive: WHITE, emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.15, transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: '#3f86bd', emissive: '#1d4f7d', emissiveIntensity: 0.4, roughness: 0.45, transparent: true });
  const H3 = extrudeText(ctx, ctx.cfg.headline, { weight: 800, size: 100, depth: 22, ls: 1, front, side });
  H3.group.position.set(px(B.tx), py(B.headY), 0);
  ctx.hud.add(H3.group);
  const sweepLight = new THREE.PointLight(0xffffff, 0, 900, 1.2); ctx.hud.add(sweepLight);
  const sweep = sweepOverlay(L.head, { width: 0.07 });
  return (t) => {
    const k = easeOutExpo(seg(t, t0, t0 + 0.55));
    slide.forEach(o => { o.position.y = o.userData.y0 - (FH - B.BAND_TOP + 10) * (1 - k); });
    slide.forEach(o => o.visible = k > 0);
    const kl = easeOut(seg(t, t0 + 0.3, t0 + 0.8));
    setOpacity(L.logo, kl); L.logo.position.x = px(110) - 50 * (1 - kl);
    L.div.scale.y = easeOut(seg(t, t0 + 0.4, t0 + 0.8)); L.div.visible = L.div.scale.y > 0.001;
    H3.letters.forEach((m, i) => {
      const a = t0 + 0.45 + i * 0.035, kk = seg(t, a, a + 0.5);
      m.visible = kk > 0.08;
      m.rotation.x = -Math.PI / 2 * (1 - easeOutBack(kk, 1.2));
      m.position.z = -80 * (1 - easeOut(kk));
    });
    const hand = seg(t, t0 + 1.35, t0 + 1.6);           // 3D -> flat headline
    front.opacity = side.opacity = 1 - hand; H3.group.visible = hand < 1;
    setOpacity(L.head, hand);
    const ks = easeOut(seg(t, t0 + 0.9, t0 + 1.3));
    setOpacity(L.sub, ks); L.sub.position.y = py(B.headY + 66) - 18 * (1 - ks);
    const kp = seg(t, t0 + 1.1, t0 + 1.45);
    setOpacity(L.pill, clamp01(kp * 3)); L.pill.scale.setScalar(lerp(0.6, 1, easeOutBack(kp, 2)));
    const kd = easeOut(seg(t, t0 + 1.3, t0 + 1.7));
    setOpacity(L.date, kd); L.date.userData.x0 ??= L.date.position.x; L.date.position.x = L.date.userData.x0 - 30 * (1 - kd);
    setOpacity(L.disc, easeOut(seg(t, t0 + 0.35, t0 + 0.65)));
    // light sweep over the finished headline
    const ksw = seg(t, t0 + 2.1, t0 + 2.9);
    sweep.pos.value = lerp(-0.15, 1.15, easeInOut(ksw)); sweep.strength.value = ksw > 0 && ksw < 1 ? 1 : 0;
    sweepLight.intensity = 0;
  };
}

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(220,240,255,0.9)');
  gr.addColorStop(0.6, 'rgba(109,174,219,0.35)'); gr.addColorStop(1, 'rgba(109,174,219,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function cumulative(pts) {
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  return d;
}
function atDist(pts, cum, s) {                          // point and index at arc length s
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const k = clamp01((s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1));
  return { i, p: pts[i - 1].map((v, j) => lerp(v, pts[i][j], k)) };
}

export const concepts = {
  // ===== A: the district rises out of the map =====
  // County lines trace on, then extrude upward as walls of light while the land outside the
  // district dims, so the three counties stand up out of the terrain.
  A: async (ctx) => {
    const { outro, district, world } = ctx;
    const names = ['Swain', 'Jackson', 'Transylvania'];
    const WALL = 5.5;
    // dim everything outside the district: a big plane with the three counties cut out
    const outside = new THREE.Shape([[-400, -300], [400, -300], [400, 300], [-400, 300]].map(p => new THREE.Vector2(...p)));
    for (const n of names) outside.holes.push(new THREE.Path(district.counties[n].map(([x, y]) => new THREE.Vector2(x, y))));
    const dim = new THREE.Mesh(new THREE.ShapeGeometry(outside), new THREE.MeshBasicMaterial({ color: '#000c22', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
    dim.position.z = 1.2; dim.renderOrder = 1; world.add(dim);
    const wallMat = (color) => new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 0 } },
      vertexShader: 'attribute float h; varying float vh; void main(){ vh=h; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vh;
        void main(){ float a = pow(1.0 - vh, 1.3) * 0.42 + smoothstep(0.9, 1.0, vh) * 0.4;
          gl_FragColor = vec4(mix(color, vec3(1.0), pow(1.0 - vh, 8.0) * 0.25), a * opacity); }`,
    });
    const C = names.map((n, i) => {
      const b = outro.borders[n], N = b.length;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 2 * 3), h = new Float32Array(N * 2), idx = [];
      for (let j = 0; j < N; j++) { h[j * 2] = 0; h[j * 2 + 1] = 1; if (j < N - 1) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('h', new THREE.BufferAttribute(h, 1)); geo.setIndex(idx);
      const wall = new THREE.Mesh(geo, wallMat(BLUE)); wall.frustumCulled = false; wall.renderOrder = 2;
      const glow = fatLine(ctx, b, { color: BLUE, width: 10, opacity: 0.45 });
      const core = fatLine(ctx, b, { color: WHITE, width: 3 });
      const top = fatLine(ctx, b, { color: WHITE, width: 2.2, opacity: 0.9 });
      glow.renderOrder = 3; core.renderOrder = 4; top.renderOrder = 5;
      world.add(wall, glow, core, top);
      return { b, N, geo, pos, wall, glow, core, top, i };
    });
    const band = bandAnimator(ctx, 2.3);
    return { frames: FRAMES, update(t) {
      dim.material.opacity = 0.42 * easeInOut(seg(t, 0.6, 1.8));
      for (const c of C) {
        const d = c.i * 0.15;
        const draw = easeInOut(seg(t, 0.0 + d, 1.15 + d));
        const rise = easeOutBack(seg(t, 0.95 + d, 2.2 + d), 1.2);
        const H = WALL * rise, n = Math.max(2, Math.round(c.N * draw));
        const tp = [];
        for (let j = 0; j < c.N; j++) {
          const [x, y, z] = c.b[j], k = j * 6;
          c.pos[k] = x; c.pos[k + 1] = y; c.pos[k + 2] = z + 0.1;
          c.pos[k + 3] = x; c.pos[k + 4] = y; c.pos[k + 5] = z + 0.1 + H;
          tp.push(x, y, z + 0.1 + H);
        }
        c.geo.attributes.position.needsUpdate = true;
        c.geo.setDrawRange(0, (n - 1) * 6);
        c.wall.material.uniforms.opacity.value = clamp01(rise * 1.5);
        c.top.setPoints(tp); c.top.setProgress(draw); c.top.visible = rise > 0.02;
        for (const l of [c.glow, c.core]) l.setProgress(draw);
        c.glow.material.opacity = 0.45 + 0.35 * Math.max(0, 1 - Math.abs(t - 1.1 - d) * 2);
      }
      band(t);
    } };
  },

  // ===== B: the mountain mark builds itself on a brand plate =====
  B: async (ctx) => {
    const { hud, cfg } = ctx;
    // two mountain-edged plates rise over the map: light blue leads, navy follows (mirrored ridge)
    const RS = 2300 / 1500, prof = ctx.mountain.profile, PEAK = Math.max(...prof.map(p => p[1])) * 1500 * RS;
    const plateShape = (mirror) => {
      const s = new THREE.Shape(); s.moveTo(-1150, -1700);
      const pts = prof.map(([x, y]) => [(mirror ? 1 - x : x) * 2300 - 1150, y * 1500 * RS]);
      if (mirror) pts.reverse();
      s.lineTo(pts[0][0], pts[0][1]); for (const p of pts) s.lineTo(p[0], p[1]); s.lineTo(1150, -1700); s.closePath(); return s;
    };
    const mk = (color, mirror, z) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(plateShape(mirror), 2),
      new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true })); m.position.z = z; hud.add(m); return m; };
    const plateBlue = mk(BLUE, false, -30), plateNavy = mk(NAVY, true, -20);
    const yStart = -FH / 2 - PEAK - 20, yEnd = FH / 2 + 30;
    // faint ridge texture low on the final plate, for depth
    const ridge = new THREE.Mesh(new THREE.ShapeGeometry(plateShape(false), 2), new THREE.MeshBasicMaterial({ color: '#0b3a78', toneMapped: false, transparent: true }));
    ridge.scale.set(0.95, 0.5, 1); ridge.position.set(60, py(800), -15); hud.add(ridge);
    const DISC_TOP = FH - 54 - 76;
    const discRow = rect(FW, FH - DISC_TOP, NAVY_DEEP); discRow.position.set(px(0), py(DISC_TOP), -10); hud.add(discRow);
    const disc = textPlane(ctx, cfg.disclaimer, { weight: 500, size: 46, anchor: 'center' }); disc.position.set(0, py(DISC_TOP + 54), 0); hud.add(disc);

    // logo, built in logo pixel units (1500 x 744), origin top-left, y down = negative
    const logo = new THREE.Group(); hud.add(logo);
    // fronts: emissive brand colour on a black base, so the face reads as the exact logo colour and
    // lights only add a specular glint (the sweep); sides are lit for depth
    const mFront = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: BLUE, emissiveIntensity: 1, roughness: 0.3, metalness: 0, envMapIntensity: 0.15, transparent: true });
    const mSide = new THREE.MeshStandardMaterial({ color: '#2f6f9f', emissive: '#1d4f7d', emissiveIntensity: 0.5, roughness: 0.5, transparent: true });
    const mtn = new THREE.Mesh(new THREE.ExtrudeGeometry(mountainShape(ctx, 1), { depth: 60, bevelEnabled: true, bevelThickness: 6, bevelSize: 3, bevelSegments: 2 }), [mFront, mSide]);
    mtn.geometry.translate(0, 0, -66); mtn.position.set(0, -254, 0); logo.add(mtn);
    const ridgeLine = fatLine(ctx, mountainLine(ctx, 1), { color: WHITE, width: 4 }); ridgeLine.position.set(0, -254, 2); logo.add(ridgeLine);
    const flatM = logoPart(ctx, 'mountain', 1), elect = logoPart(ctx, 'elect', 1), rule = logoPart(ctx, 'rule', 1),
          house = logoPart(ctx, 'house', 1), flatB = logoPart(ctx, 'burrows', 1);
    flatM.position.z = flatB.position.z = 1;             // just in front of the 3D faces they replace
    logo.add(flatM, elect, rule, house, flatB);
    const bFront = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: WHITE, emissiveIntensity: 1, roughness: 0.3, metalness: 0, envMapIntensity: 0.15, transparent: true });
    const bSide = new THREE.MeshStandardMaterial({ color: '#3f86bd', emissive: '#1d4f7d', emissiveIntensity: 0.45, roughness: 0.45, transparent: true });
    const capH = ctx.fonts[800].tables.os2.sCapHeight / ctx.fonts[800].unitsPerEm;
    const BW = extrudeText(ctx, 'BURROWS', { weight: 800, size: 201 / capH, depth: 50, front: bFront, side: bSide });
    // fit each 3D letter to that letter's box in the logo artwork, so the handover is invisible
    BW.letters.forEach((m, i) => {
      const [x0, x1, y0, y1] = ctx.logoLetters.letters[i];
      m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox;
      const sx = (x1 + 1 - x0) / (bb.max.x - bb.min.x), sy = (y1 + 1 - y0) / (bb.max.y - bb.min.y);
      m.scale.set(sx, sy, 1);
      m.position.x = x0 - bb.min.x * sx;
      m.userData.y0 = -(y1 + 1) - bb.min.y * sy; m.position.y = m.userData.y0;
    });
    logo.add(BW.group);
    const sweepLight = new THREE.PointLight(0xffffff, 0, 1400, 1.0); hud.add(sweepLight);

    // final text block, centred under the logo
    const head = textPlane(ctx, cfg.headline, { weight: 800, size: 100, ls: 1, anchor: 'center' }); head.position.set(0, py(600), 0);
    const sub = textPlane(ctx, cfg.subline, { weight: 700, size: 58, color: BLUE, ls: 1, anchor: 'center' }); sub.position.set(0, py(672), 0);
    const ctaT = textPlane(ctx, cfg.cta, { weight: 700, size: 42, ls: 1 });
    const date = textPlane(ctx, cfg.cta2, { weight: 700, size: 42, ls: 1 });
    const pw = ctaT.userData.width + 64, rowW = pw + 34 + date.userData.width, rx = (FW - rowW) / 2;
    const pl = pill(pw, 64, RED); pl.position.set(px(rx + pw / 2), py(712 + 32), 0); hud.add(pl);
    ctaT.position.set(-ctaT.userData.width / 2, -ctaT.userData.capH / 2, 0.2); pl.add(ctaT);
    date.position.set(px(rx + pw + 34), py(744 + date.userData.capH / 2), 0); hud.add(date);
    hud.add(head, sub);
    const sweep = sweepOverlay(head, { width: 0.07 });

    const S0 = 0.6, S1 = 0.4, T0 = 205, T1 = 92;           // logo scale/top: build size -> lockup size
    return { frames: FRAMES, update(t) {
      plateBlue.position.y = lerp(yStart, yEnd, easeInOut(seg(t, 0.0, 1.0)));
      plateNavy.position.y = lerp(yStart, yEnd, easeInOut(seg(t, 0.14, 1.15)));
      setOpacity(ridge, easeOut(seg(t, 1.0, 1.6)) * 0.55);
      ridge.position.y = py(800) - 40 * (1 - easeOut(seg(t, 1.0, 1.8)));
      const kdisc = easeOut(seg(t, 1.0, 1.3)); setOpacity(discRow, kdisc); setOpacity(disc, kdisc);

      const km = easeInOut(seg(t, 3.0, 3.6)), s = lerp(S0, S1, km), top = lerp(T0, T1, km);
      logo.scale.setScalar(s); logo.position.set(px(FW / 2 - 750 * s), py(top), 0);
      logo.rotation.y = lerp(-0.38, 0, easeInOut(seg(t, 0.8, 2.7)));
      logo.rotation.x = lerp(0.12, 0, easeInOut(seg(t, 0.8, 2.7)));
      logo.visible = t > 0.8;
      ridgeLine.setProgress(easeInOut(seg(t, 0.85, 1.6)));
      setOpacity(ridgeLine, 1 - seg(t, 2.0, 2.4));
      const grow = seg(t, 1.25, 2.0);
      mtn.scale.set(1, Math.max(0.001, easeOutBack(grow, 1.3)), Math.max(0.001, easeOut(seg(t, 1.25, 1.8))));
      mtn.visible = grow > 0;
      rule.scale.x = Math.max(0.001, easeOutExpo(seg(t, 1.35, 1.85)));
      BW.letters.forEach((m, i) => {
        const a = 1.5 + i * 0.06, kk = seg(t, a, a + 0.5);
        m.visible = kk > 0; m.rotation.x = -Math.PI / 2 * (1 - easeOutBack(kk, 1.2)); m.position.y = m.userData.y0 - 60 * (1 - easeOut(kk));
      });
      const ke = easeOut(seg(t, 1.8, 2.25)); setOpacity(elect, ke); elect.position.x = -40 * (1 - ke);
      const kh = easeOut(seg(t, 2.0, 2.45)); setOpacity(house, kh); house.position.y = -20 * (1 - kh);
      // light sweep across the 3D mark, then hand over to the exact logo artwork
      const ksw = seg(t, 2.2, 2.9);
      sweepLight.intensity = ksw > 0 && ksw < 1 ? 450 * Math.sin(Math.PI * ksw) : 0;
      sweepLight.position.set(lerp(-900, 900, easeInOut(ksw)), py(300), 260);
      const hand = seg(t, 2.88, 3.0);
      // the logo art fades in over solid 3D faces (no see-through dip); only the 3D sides fade out
      mSide.opacity = bSide.opacity = 1 - hand; mFront.opacity = bFront.opacity = 1;
      mtn.visible = mtn.visible && hand < 1; BW.group.visible = hand < 1;
      setOpacity(flatM, hand); setOpacity(flatB, hand);
      // text block
      const kt = easeOut(seg(t, 3.25, 3.7)); setOpacity(head, kt); head.position.y = py(600) - 24 * (1 - kt);
      const ks = easeOut(seg(t, 3.5, 3.9)); setOpacity(sub, ks); sub.position.y = py(672) - 18 * (1 - ks);
      const kp = seg(t, 3.7, 4.05); setOpacity(pl, clamp01(kp * 3)); pl.scale.setScalar(lerp(0.6, 1, easeOutBack(kp, 2)));
      setOpacity(date, easeOut(seg(t, 3.9, 4.3)));
      const ksw2 = seg(t, 4.8, 5.6);
      sweep.pos.value = lerp(-0.15, 1.15, easeInOut(ksw2)); sweep.strength.value = ksw2 > 0 && ksw2 < 1 ? 1 : 0;
    } };
  },

  // ===== C: the route draws across the district, Brevard to Bryson City =====
  C: async (ctx) => {
    const { outro, world } = ctx;
    const route = outro.route.map(p => [p[0], p[1], p[2] + 0.25]), cum = cumulative(route), total = cum[cum.length - 1];
    const borders = ['Swain', 'Jackson', 'Transylvania'].map(n => fatLine(ctx, outro.borders[n], { color: WHITE, width: 2, opacity: 0.0 }));
    borders.forEach(b => world.add(b));
    const glow = fatLine(ctx, route, { color: BLUE, width: 14, opacity: 0.5 });
    const core = fatLine(ctx, route, { color: WHITE, width: 4.5 });
    world.add(glow, core);
    const tex = ringTexture();
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    head.scale.setScalar(3.2); world.add(head);
    // towns along the way pulse as the line reaches them
    const towns = ['Brevard', 'Rosman', 'Lake Toxaway', 'Cashiers', 'Cullowhee', 'Sylva', 'Dillsboro', 'Bryson City'];
    const pulses = towns.map(n => {
      const p = outro.pins[n]; let best = 0, bd = 1e9;
      route.forEach((r, i) => { const d = Math.hypot(r[0] - p[0], r[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, depthTest: false, toneMapped: false }));
      ring.position.set(p[0], p[1], p[2] - 2.3);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
      dot.position.set(p[0], p[1], p[2] - 2.2); dot.scale.setScalar(2.2);
      world.add(ring, dot);
      return { ring, dot, s: cum[best] / total, last: n === 'Bryson City' };
    });
    const DRAW0 = 0.1, DRAW1 = 2.7;
    const band = bandAnimator(ctx, 2.6);
    return { frames: FRAMES, update(t) {
      borders.forEach(b => { b.material.opacity = 0.4 * easeOut(seg(t, 0, 0.6)); b.visible = t > 0; });
      const k = easeInOut(seg(t, DRAW0, DRAW1));
      const { i, p } = atDist(route, cum, k * total);
      const prog = (i - 1 + 0.999) / (route.length - 1);
      for (const l of [glow, core]) l.setProgress(k <= 0 ? 0 : prog);
      head.position.set(...p); head.visible = k > 0 && k < 1;
      for (const q of pulses) {
        const tHit = DRAW0 + (DRAW1 - DRAW0) * invEase(q.s);
        const kk = seg(t, tHit, tHit + (q.last ? 1.0 : 0.7));
        q.ring.visible = kk > 0 && kk < 1;
        q.ring.scale.setScalar(lerp(1, q.last ? 7 : 4, easeOut(kk)));
        q.ring.material.opacity = 1 - kk;
        q.dot.visible = t >= tHit; q.dot.scale.setScalar((q.last ? 3 : 2.0) * (1 + 0.6 * Math.max(0, 1 - (t - tHit) * 3)));
      }
      glow.material.opacity = 0.5 + 0.3 * Math.max(0, 1 - Math.abs(t - DRAW1 - 0.1) * 2.5);
      band(t);
    } };
  },
};

function invEase(y) {                                   // inverse of easeInOut by bisection
  let a = 0, b = 1; for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if (easeInOut(m) < y) a = m; else b = m; } return (a + b) / 2;
}
