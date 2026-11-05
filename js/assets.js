"use strict";
// ---------- asset library: shared textures, materials and props for every level ----------
// Loaded before core.js. Nothing here builds anything at load: a material or prop is made on first use and then shared,
// so a level that is never visited costs nothing.
//   getMat("chrome")            a shared material by name; getMat("concrete", 4, 1) is the same look with its texture repeated 4 x 1
//   makeProp("bunkBed")         a new THREE.Group of the prop, standing on y = 0, its front facing +z
//   placeAt(obj, parent, x, y, z, ry)
//   PROP_PARTS.<name>           the same prop as data, for levels that instance many copies (Level 0's waiting-room chairs)
// Level 0's own surfaces (wallpaper sets, carpet, ceiling tiles, light panels, glow decals) stay in core.js: they are built
// at load and patched by its floor/ceiling shaders. The station's env-mapped materials stay in level0_1.js.

// ---------- procedural texture toolkit ----------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
}
// a tiling texture: draw(g, size); hgt for a non-square one
function tex(size, draw, repeat, hgt) {
  const t = canvasTex(size, hgt || size, draw);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat, repeat);
  return t;
}
const noise = (g, s, n, a) => { const w = g.canvas.width, h = g.canvas.height; for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,200"},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
// sickly yellow wallpaper, w x h px matching the wall's aspect so the motif isn't stretched;
// each call gets its own random stains, drips and grime, so walls built from different calls don't look cloned.
// peel: strips of paper curled away from the wall, showing blood-red underneath (the red room)
const YEL = { base: "#c9b44a", dk: "rgba(150,125,30,.35)", lt: "rgba(235,215,110,.25)", dot: "rgba(140,115,25,.22)" };
const PALE = { base: "#d9d29a", dk: "rgba(160,150,80,.28)", lt: "rgba(245,240,185,.3)", dot: "rgba(150,140,70,.16)" };                      // 台階長廊 and 中庭: pale cream
const WAITP = { base: "#cdd392", dk: "rgba(110,135,60,.3)", lt: "rgba(240,244,190,.28)", dot: "rgba(110,140,60,.32)", arrow: true };      // 等候室: pale green, small arrows
function paper(w, h, n, peel, pal = YEL) {
  return tex(w, (g) => {
    const p = w / n;                                   // stripe pitch in px
    g.fillStyle = pal.base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += p) { g.fillStyle = pal.dk; g.fillRect(x, 0, p * .09, h); g.fillStyle = pal.lt; g.fillRect(x + p * .12, 0, p * .05, h); }
    g.fillStyle = pal.dot;
    for (let y = p * .25; y < h; y += p * .75) for (let x = p * .5; x < w; x += p) {
      g.beginPath();
      if (pal.arrow) { const s = p * .16; g.moveTo(x, y - s); g.lineTo(x + s * .6, y + s * .3); g.lineTo(x + s * .2, y + s * .3); g.lineTo(x + s * .2, y + s); g.lineTo(x - s * .2, y + s); g.lineTo(x - s * .2, y + s * .3); g.lineTo(x - s * .6, y + s * .3); g.closePath(); }
      else g.arc(x, y, p * .09, 0, 7);
      g.fill();
    }
    for (let i = 0, k = 3 + Math.random() * 4; i < k; i++) {        // damp stains (same centre for both circles)
      const x = Math.random() * w, y = Math.random() * h, r = p * (.8 + Math.random() * 1.6), gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, "rgba(90,70,10,.2)"); gr.addColorStop(1, "rgba(90,70,10,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    for (let i = 0, k = Math.random() * 5; i < k; i++) {            // water drips from the ceiling
      const len = h * (.15 + Math.random() * .35), gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, "rgba(80,60,10,.25)"); gr.addColorStop(1, "rgba(80,60,10,0)");
      g.save(); g.translate(Math.random() * w, 0); g.fillStyle = gr; g.fillRect(0, 0, p * .08, len); g.restore();
    }
    if (peel) for (let k = 0; k < 6; k++) {
      const x = Math.random() * w * .9, sw = w * (.06 + Math.random() * .09), y0 = Math.random() * h * .3, len = h * (.3 + Math.random() * .55);
      g.beginPath(); g.moveTo(x, y0);
      for (let y = y0; y < y0 + len; y += 16) g.lineTo(x + sw + (Math.random() - .5) * 9, y);
      for (let y = y0 + len; y > y0; y -= 16) g.lineTo(x + (Math.random() - .5) * 9, y);
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, "#3d0404"); gr.addColorStop(1, "#8c1212");
      g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 3; g.stroke();
      g.fillStyle = pal.base; g.beginPath(); g.moveTo(x, y0 + len); g.lineTo(x + sw, y0 + len); g.lineTo(x + sw * .5, y0 + len - sw * 1.1); g.closePath(); g.fill(); g.stroke();   // the curled-off end
    }
    const b = g.createLinearGradient(0, h * .85, 0, h); b.addColorStop(0, "rgba(60,45,5,0)"); b.addColorStop(1, "rgba(60,45,5,.35)");
    g.fillStyle = b; g.fillRect(0, h * .85, w, h * .15);              // grime near the floor
    noise(g, w, 4000, .12);
    contactShade(g, w, h);
  }, 0, h);
}
// baked ambient occlusion: the texture spans the wall's full height, so its top and bottom edges are where it meets
// the ceiling and the floor, the creases the ambient-only lighting would otherwise leave flat
function contactShade(g, w, h) {
  for (const [y0, y1, a] of [[0, h * .07, .32], [h, h * .9, .4]]) {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(30,22,0,${a})`); gr.addColorStop(1, "rgba(30,22,0,0)");
    g.fillStyle = gr; g.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0));
  }
}
const flat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
const stdMat = (color, roughness, metalness = 0, extra) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const bright = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });   // above white, so it blooms

// ---------- textures, by name (each drawn once) ----------
// remodelled wall for a 3 m wall, 4 m wide: off-white paint, a maroon rail 0.5 m up; outlet: a power socket near the floor
const remodelWallDraw = outlet => (g, w, h) => {
  g.fillStyle = "#ece8dc"; g.fillRect(0, 0, w, h); noise(g, w, 5000, .05);
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,250,.08)"); grd.addColorStop(1, "rgba(90,80,60,.12)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const ry = h * (1 - .5 / 3); g.fillStyle = "#6c2622"; g.fillRect(0, ry - 5, w, 10); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, ry - 5, w, 2);
  if (outlet) {
    const ox = w * .7, oy = h * (1 - .3 / 3);
    g.fillStyle = "#e4e2d8"; g.fillRect(ox - 9, oy - 15, 18, 30); g.strokeStyle = "#8c8a80"; g.lineWidth = 1.5; g.strokeRect(ox - 9, oy - 15, 18, 30);
    g.fillStyle = "#2a2a2a"; for (const dy of [-7, 7]) { g.fillRect(ox - 5, oy + dy - 3, 2, 5); g.fillRect(ox + 3, oy + dy - 3, 2, 5); }
  }
};
const TEX = {
  concrete: () => tex(256, g => { g.fillStyle = "#807f79"; g.fillRect(0, 0, 256, 256); noise(g, 256, 9000, .22); }),
  remodelWall: () => canvasTex(512, 384, remodelWallDraw(false)),
  remodelWallOutlet: () => canvasTex(512, 384, remodelWallDraw(true)),
  redCarpet: () => tex(256, (g, w) => { g.fillStyle = "#5f2f2a"; g.fillRect(0, 0, w, w); noise(g, w, 9000, .16); g.fillStyle = "rgba(40,10,8,.18)"; for (let y = 0; y < w; y += 3) g.fillRect(0, y, w, 1); }),
  dropCeiling: () => tex(256, (g, w) => {      // 2 m of drop ceiling: 4 x 4 tiles of 50 cm
    g.fillStyle = "#efede6"; g.fillRect(0, 0, w, w);
    g.fillStyle = "rgba(120,115,100,.22)"; for (let n = 0; n < 2600; n++) g.fillRect(Math.random() * w, Math.random() * w, 1, 1);
    g.fillStyle = "#c9c6bc"; for (let k = 0; k <= 4; k++) { g.fillRect(k * w / 4 - 2, 0, 4, w); g.fillRect(0, k * w / 4 - 2, w, 4); }
  }),
  bathTile: () => tex(128, (g, w) => { g.fillStyle = "#e6ebec"; g.fillRect(0, 0, w, w); g.fillStyle = "#a9b5b8"; for (let k = 0; k <= 8; k++) { g.fillRect(k * w / 8 - 1, 0, 2, w); g.fillRect(0, k * w / 8 - 1, w, 2); } }),
};

// ---------- materials, by name ----------
const MAT = {
  // walls, floors, ceilings
  concrete: () => new THREE.MeshStandardMaterial({ map: getTex("concrete"), roughness: 1 }),
  concreteFloor: () => new THREE.MeshStandardMaterial({ map: getTex("concrete"), color: 0xbdbdb5, roughness: .9 }),
  remodelWall: () => new THREE.MeshStandardMaterial({ map: getTex("remodelWall"), roughness: .9 }),
  remodelWallOutlet: () => new THREE.MeshStandardMaterial({ map: getTex("remodelWallOutlet"), roughness: .9 }),
  redCarpet: () => new THREE.MeshStandardMaterial({ map: getTex("redCarpet"), roughness: 1 }),
  dropCeiling: () => new THREE.MeshStandardMaterial({ map: getTex("dropCeiling"), roughness: .9 }),
  bathTile: () => new THREE.MeshStandardMaterial({ map: getTex("bathTile"), roughness: .35 }),
  ceilingTile: () => flat(0xeceae2),
  // building guts: what a fallen wall or caved-in floor shows
  stud: () => flat(0xc8a06a), plywood: () => flat(0x9c7c52), joist: () => flat(0x6e5232), cavity: () => flat(0x2a2214), insulation: () => flat(0xbfa25a),
  subfloorPit: () => stdMat(0x3a2c1c, 1, 0, { side: THREE.DoubleSide }), holeDark: () => flat(0x1a1712),
  duct: () => stdMat(0xa09e94, .45, .6, { side: THREE.DoubleSide }),
  // wood and trim
  baseboard: () => flat(0x3d2f1a), doorFrame: () => flat(0x6a4e2c), doorLeaf: () => flat(0x7d5c33), doorWhite: () => flat(0xe6e1d4),
  wood: () => flat(0x6f5a3c), crate: () => flat(0xa8845a), railing: () => flat(0x2a2a28),
  // metal, ceramic, glass
  chrome: () => stdMat(0xa8a8a0, .35, .7), brass: () => stdMat(0xc9a040, .35, .8), steel: () => flat(0x555a5e),
  porcelain: () => stdMat(0xf4f4f0, .25), mirror: () => stdMat(0x9fb8c2, .05, .9), vent: () => flat(0x3a3a2c),
  // fabric and furniture
  waitChair: () => flat(0x6f7552), armyMattress: () => flat(0x59623f), rug: () => flat(0x8c4a2c), tableTop: () => flat(0xd8d4c8),
  coolerWhite: () => flat(0xe4e2d6), ladder: () => flat(0xb8b8b0), routerBlack: () => flat(0x1d1d1f), clipboard: () => flat(0x8a6238),
  // small things
  jugBlue: () => stdMat(0x5aa6e0, .2, 0, { transparent: true, opacity: .8 }), waterBlue: () => stdMat(0x3a78c2, .3), canTin: () => flat(0xb0a468),
  paintBucket: () => flat(0xdedcd4), paintMaroon: () => flat(0x6c2622), paintWhite: () => flat(0xece8dc), paperLitter: () => flat(0xe6e1cf),
  darkWater: () => stdMat(0x1a1810, .15, .3, { transparent: true, opacity: .85 }),
  // lights (unlit, brighter than white so they bloom)
  lampAmber: () => bright(0xffd890, 2.4), lampPanel: () => bright(0xfffcf2, 2.6), lampCool: () => new THREE.MeshBasicMaterial({ color: 0xe6f0ff }),
  ledGreen: () => new THREE.MeshBasicMaterial({ color: 0x40ff70 }),
};
const _texs = new Map(), _mats = new Map(), _geos = new Map();
function getTex(name) {
  if (!TEX[name]) throw new Error(`asset library: no texture "${name}"`);
  if (!_texs.has(name)) _texs.set(name, TEX[name]());
  return _texs.get(name);
}
// rx, ry: how many times the texture repeats across the surface (a repeat other than 1 x 1 gets its own texture copy, same image)
function getMat(name, rx = 1, ry = rx) {
  if (!MAT[name]) throw new Error(`asset library: no material "${name}"`);
  const key = `${name}|${rx}|${ry}`;
  if (!_mats.has(key)) {
    const m = MAT[name]();
    if (m.map && (rx !== 1 || ry !== 1)) { m.map = m.map.clone(); m.map.repeat.set(rx, ry); m.map.needsUpdate = true; }
    _mats.set(key, m);
  }
  return _mats.get(key);
}

// ---------- props, as parts ----------
// a part: [material, x, y, z, width, height, depth, tilt about x = 0, shape = box | "cyl"]: centred at (x, y, z) in the prop's
// own space, which stands on y = 0 with its front toward +z (its back against a wall at -z). A "cyl" is width across.
const legParts = (m, hx, hz, w, h, y = h / 2) => [-hx, hx].flatMap(x => [-hz, hz].map(z => [m, x, y, z, w, h, w]));
const PROP_PARTS = {
  // seating and beds
  waitChair: [["waitChair", 0, .46, 0, .46, .05, .46], ["waitChair", 0, .74, -.21, .46, .42, .05], ["chrome", -.2, .22, 0, .04, .44, .42], ["chrome", .2, .22, 0, .04, .44, .42]],
  bunkBed: [...legParts("steel", 1, .45, .07, 2), ["wood", 0, .5, 0, 2.1, .12, 1], ["wood", 0, 1.45, 0, 2.1, .12, 1], ["armyMattress", 0, .62, 0, 1.9, .12, .9], ["armyMattress", 0, 1.57, 0, 1.9, .12, .9]],
  // tables and storage (table tops: longTable .9 m, foldingTable .76 m)
  longTable: [["wood", 0, .85, 0, 3.4, .1, 1.4], ...legParts("steel", 1.5, .55, .08, .85, .42)],
  foldingTable: [["tableTop", 0, .74, 0, 1.8, .04, .8], ...legParts("chrome", .8, .32, .04, .72)],
  crate: [["crate", 0, .25, 0, .8, .5, .6]],
  supplyShelf: [["wood", 0, 1, 0, .6, 2, 3], ...[0, 1, 2, 3].map(k => ["crate", 0, .4 + k * .5, -.6 + (k % 2) * 1.2, .5, .3, .7])],
  stepladder: [["ladder", 0, 1, .3, .5, 2.1, .05, .17], ["ladder", 0, 1, -.3, .5, 2.1, .05, -.17]],
  // bathroom
  toilet: [["porcelain", 0, .21, 0, .42, .42, .62], ["porcelain", 0, .62, -.27, .46, .5, .2], ["porcelain", 0, .44, .05, .44, .04, .5]],
  pedestalSink: [["porcelain", 0, .39, 0, .15, .78, .15], ["porcelain", 0, .84, .05, .55, .14, .42], ["chrome", 0, .98, -.1, .03, .2, .03, 0, "cyl"]],
  // small things
  waterCooler: [["coolerWhite", 0, .5, 0, .36, 1, .36], ["jugBlue", 0, 1.2, 0, .34, .42, .34, 0, "cyl"]],
  waterBottle: [["waterBlue", 0, .25, 0, .36, .5, .36, 0, "cyl"]],
  tinCan: [["canTin", 0, .055, 0, .12, .11, .12, 0, "cyl"]],
  paintCan: [["paintBucket", 0, .18, 0, .3, .36, .3, 0, "cyl"], ["paintWhite", 0, .37, 0, .304, .02, .304, 0, "cyl"]],
  paintCanMaroon: [["paintBucket", 0, .18, 0, .3, .36, .3, 0, "cyl"], ["paintMaroon", 0, .37, 0, .304, .02, .304, 0, "cyl"]],
  // on walls and ceilings: origin at the mounting point
  wifiRouter: [["routerBlack", 0, 0, 0, .26, .18, .04], ["routerBlack", -.1, .18, 0, .015, .2, .015], ["routerBlack", .1, .18, 0, .015, .2, .015],
    ["ledGreen", -.06, -.04, .025, .02, .02, .01], ["ledGreen", 0, -.04, .025, .02, .02, .01]],
  ceilingPanel: [["lampCool", 0, -.03, 0, 1.6, .05, .5]],      // add a PointLight under it for real light
};
function makeProp(name) {
  if (!PROP_PARTS[name]) throw new Error(`asset library: no prop "${name}"`);
  const g = new THREE.Group(); g.name = name;
  for (const [m, x, y, z, w, h, d, rx = 0, shape] of PROP_PARTS[name]) {
    const key = `${shape}|${w}|${h}|${d}`;
    if (!_geos.has(key)) _geos.set(key, shape === "cyl" ? new THREE.CylinderGeometry(w / 2, w / 2, h, 14) : new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(_geos.get(key), getMat(m)); mesh.position.set(x, y, z); mesh.rotation.x = rx; g.add(mesh);
  }
  return g;
}
const placeAt = (o, parent, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };

// people-shaped sprites: the unconfirmed dark figure, the wanderers in the Manila Room, the survivors at the base
function person(color, x, z) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d"); g.fillStyle = color;
  g.beginPath(); g.arc(32, 14, 11, 0, 7); g.fill(); g.fillRect(22, 26, 20, 50); g.fillRect(12, 28, 8, 48); g.fillRect(44, 28, 8, 48);
  g.fillRect(23, 76, 8, 50); g.fillRect(33, 76, 8, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  s.scale.set(.95, 1.9, 1); s.position.set(x, .95, z); scene.add(s); return s;
}
