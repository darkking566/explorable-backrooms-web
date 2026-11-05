"use strict";
// ---------- the diorama: a hand-planned 4x4 grid of districts, 10x8 cells each ----------
const S = 4, H = 3, T = 0.2;               // cell size, wall height, wall thickness (metres)
const NBX = 4, NBY = 4, BW = 10, BH = 8, W = BW * NBX, D = BH * NBY, WS = W * S, DS = D * S;
const RED_H = 2.3, TALL = 6.4, ATR_H = 9, BASIN = .3;   // red room, stairwell and atrium ceilings, depth of the 熄燈區 puddles
const hash = (x, y, k) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// District types: normal, 拱門, 柱廳, 深坑, 熄燈區, 紅室, 狹小房間 (Manila Room), 樓梯間, 等候室, 台階長廊, 挑高中庭
const N = 0, ARCH = 1, PIL = 2, PIT = 3, DARK = 4, RED = 5, MAN = 6, STAIR = 7, WAIT = 13, LEDGE = 14, ATRIUM = 15;   // 8-12 are the Alpha base and the station's zones
//   lobby           | arch rooms          | waiting rooms | lobby + stairwell
//   pit field       | pillar hall         | red room      | ledge corridors
//   dark zone       | lobby + Manila room | atrium        | waiting rooms
//   ledge corridors | arch rooms          | lobby         | pillar hall
const BLOCKS = [N, ARCH, WAIT, N, PIT, PIL, RED, LEDGE, DARK, N, ATRIUM, WAIT, LEDGE, ARCH, N, PIL]
  .map((t, id) => ({ t, id, bx: id % NBX, by: id / NBX | 0, ver: 0, last: 0, groups: [], mirrors: [], props: new Map() }));
const blockOf = (i, j) => BLOCKS[Math.floor(j / BH) * NBX + Math.floor(i / BW)];
const MAN_BLK = 9, STAIR_BLK = 3;
const MAN_X = 14, MAN_Y = 19;               // top-left cell of the 2x2 Manila Room
const isMan = (i, j) => i >= MAN_X && i <= MAN_X + 1 && j >= MAN_Y && j <= MAN_Y + 1;
const ST_I = 34, ST_J = 2, STX = ST_I * S, STZ = ST_J * S;   // 3x3-cell stairwell hall, double height
const isStair = (i, j) => i >= ST_I && i <= ST_I + 2 && j >= ST_J && j <= ST_J + 2;
// the atrium: a 24 x 16 m opening in the floor with stacked floors cut away down its walls, a raised gallery along the
// north wall, and a long stair against that wall up to it (all as [x0, z0, x1, z1] in metres)
const AT = BLOCKS.find(b => b.t === ATRIUM), AX = AT.bx * BW * S, AZ = AT.by * BH * S;
const ATR_LV = 15, ATR_PITCH = 3.4, ATR_RD = 5;   // atrium: storeys below the rim, storey height, room depth behind the cut
const VOID = [AX + 8, AZ + 8, AX + 32, AZ + 24], VOID_DEPTH = ATR_LV * ATR_PITCH + 5;
const GAL = [AX + 10, AZ, AX + 40, AZ + 8], GAL_H = 4.2, AST = [AX + 4, AZ, AX + 10, AZ + 4], AST_N = 21;
const LV = .3;                               // 台階長廊: the floor steps up and down in 30cm risers
const OUT_E = [5, 18, 26], OUT_S = [7, 22, 33];   // doorways in the outer wall: walk out of one side, come in on the other

const inMap = (i, j) => i >= 0 && i < W && j >= 0 && j < D;
const eW = new Uint8Array(W * D).fill(1), sW = new Uint8Array(W * D).fill(1);   // wall on a cell's east / south edge
const cType = new Uint8Array(W * D);
for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) cType[j * W + i] = isMan(i, j) ? MAN : isStair(i, j) ? STAIR : blockOf(i, j).t;
const cellType = (i, j) => inMap(i, j) ? cType[j * W + i] : N;
const isVoid = (i, j) => cellType(i, j) === ATRIUM && (i + .5) * S > VOID[0] && (i + .5) * S < VOID[2] && (j + .5) * S > VOID[1] && (j + .5) * S < VOID[3];
const ceilH = (i, j) => { const t = cellType(i, j); return t === RED ? RED_H : t === STAIR ? TALL : t === ATRIUM ? ATR_H : H; };
const ledgeH = (i, j) => { const b = blockOf(i, j); return Math.round(1 + Math.sin((i - b.bx * BW) * .62 + (j - b.by * BH) * .31 + b.id)) * LV; };
const wallE = (i, j) => i === -1 ? j >= 0 && j < D && !OUT_E.includes(j) : inMap(i, j) && !!eW[j * W + i];
const wallS = (i, j) => j === -1 ? i >= 0 && i < W && !OUT_S.includes(i) : inMap(i, j) && !!sW[j * W + i];
const HW = .7, HWD = .5;                     // half-width of an arch opening / of a office doorway
let exitEdge = null;                         // the flickering wall, once it has appeared: {d, i, j}
// What a wall segment is: 0 none, 1 plain, 2 arch doorway, 3 arch alcove (a niche you can step into), 4 office doorway
function edgeKind(d, i, j) {
  if (!(d === 'E' ? wallE(i, j) : wallS(i, j))) return 0;
  const ni = d === 'E' ? i + 1 : i, nj = d === 'E' ? j : j + 1;
  if (!inMap(ni, nj) || !inMap(i, j)) return 1;
  const a = cellType(i, j), b = cellType(ni, nj), r = hash(i, j, d === 'E' ? 6 : 7), lg = a === LEDGE;
  if (a === b && (a === ARCH || lg)) return r < (lg ? .22 : .5) ? 2 : r < (lg ? .36 : .72) ? 3 : 1;
  if (a === N && b === N && hash(i, j, d === 'E' ? 27 : 37) < .12) return 4;
  return 1;
}
// 柱廳: columns on a grid or a checkerboard, and every rearrangement makes them less regular (gaps, wobble)
function pillarAt(i, j) {
  if (cellType(i, j) !== PIL) return null;
  const v = blockOf(i, j).ver;
  if (v % 2 === 1 && (i + j) % 2) return null;
  if (hash(i, j, 8 + v * 101) < Math.min(.4, .12 + v * .07)) return null;
  const amp = v ? Math.min(.7, .25 * v) : 0;
  return [(i + .5) * S + (hash(i, j, 31 + v) - .5) * 2 * amp, (j + .5) * S + (hash(i, j, 33 + v) - .5) * 2 * amp];
}
// storage boxes stacked in the corners of ordinary rooms: a back-of-house feel
function crateAt(i, j) {
  if (cellType(i, j) !== N || hash(i, j, 28) >= .07) return null;
  return [(i + .5) * S + (hash(i, j, 29) < .5 ? -1.4 : 1.4), (j + .5) * S + (hash(i, j, 30) < .5 ? -1.4 : 1.4)];
}
const pit = (i, j) => cellType(i, j) === PIT && hash(i, j, 12) < .4 && !PIT_SAFE.some(([a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1);
const basin = (i, j) => cellType(i, j) === DARK && hash(i, j, 15) < .45;      // 熄燈區: sunken, ankle-deep in liquid
const lit = (i, j) => {
  const t = cellType(i, j);
  if (!inMap(i, j) || t === DARK || t === STAIR) return false;
  if (t === MAN) return i === MAN_X && j === MAN_Y;
  return hash(i, j, 3 + blockOf(i, j).ver * 11) < (t === PIL ? .35 : t === WAIT ? .75 : .5);
};
const panelPos = (i, j) => { const t = cellType(i, j); return t === PIL ? [i * S, j * S] : t === MAN ? [(MAN_X + 1) * S, (MAN_Y + 1) * S] : [(i + .5) * S, (j + .5) * S]; };

// Doors between districts: two on every shared border, picked once (a fixed seed) so the plan is the same every run.
// Cells that are the foot of the atrium stair or its gallery never get one.
const doorOK = (i, j) => inMap(i, j) && !isMan(i, j) && !isStair(i, j) && !isVoid(i, j) && !(cellType(i, j) === ATRIUM && (i + .5) * S > AST[0] && (j + .5) * S < GAL[3]);
const DOORS = [], drnd = mulberry(1987);
function addDoors(d, a) {
  const E = d === 'E', cand = [];
  for (let k = 0; k < (E ? BH : BW); k++) {
    const i = E ? (a.bx + 1) * BW - 1 : a.bx * BW + k, j = E ? a.by * BH + k : (a.by + 1) * BH - 1;
    if (doorOK(i, j) && doorOK(E ? i + 1 : i, E ? j : j + 1)) cand.push([i, j, k]);
  }
  for (let n = 0; n < 2 && cand.length; n++) {
    const [i, j, k] = cand.splice(Math.floor(drnd() * cand.length), 1)[0];
    DOORS.push([d, i, j]);
    for (let q = cand.length - 1; q >= 0; q--) if (Math.abs(cand[q][2] - k) < 3) cand.splice(q, 1);   // keep the pair apart
  }
}
BLOCKS.forEach(b => { if (b.bx < NBX - 1) addDoors('E', b); if (b.by < NBY - 1) addDoors('S', b); });
const PIT_SAFE = [];                         // pits keep clear of every doorway into the pit field
const nearDoor = (i, j) => { if (cellType(i, j) === PIT) PIT_SAFE.push([i, j]); };
DOORS.forEach(([d, i, j]) => { nearDoor(i, j); nearDoor(d === 'E' ? i + 1 : i, d === 'E' ? j : j + 1); });
OUT_E.forEach(j => { nearDoor(W - 1, j); nearDoor(0, j); }); OUT_S.forEach(i => { nearDoor(i, D - 1); nearDoor(i, 0); });

// carve a district's inner walls: a maze plus loops and open halls, so it reads as segmented rooms and corridors
function carve(b) {
  const x0 = b.bx * BW, y0 = b.by * BH, x1 = x0 + BW - 1, y1 = y0 + BH - 1, rnd = mulberry(b.id * 7919 + b.ver * 104729 + 1);
  const inb = (i, j) => i >= x0 && i <= x1 && j >= y0 && j <= y1 && !isMan(i, j) && !isStair(i, j);
  const setE = (i, j, v) => eW[j * W + i] = v, setS = (i, j, v) => sW[j * W + i] = v;
  const open = b.t === PIL || b.t === PIT || b.t === ATRIUM;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { if (i < x1) setE(i, j, open ? 0 : 1); if (j < y1) setS(i, j, open ? 0 : 1); }
  if (open) return;
  let si, sj; do { si = x0 + Math.floor(rnd() * BW); sj = y0 + Math.floor(rnd() * BH); } while (!inb(si, sj));
  const seen = new Set([si + "," + sj]), stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = [[i + 1, j, 'E'], [i - 1, j, 'W'], [i, j + 1, 'S'], [i, j - 1, 'N']].filter(([a, c]) => inb(a, c) && !seen.has(a + "," + c));
    if (!nb.length) { stack.pop(); continue; }
    const [a, c, d] = nb[Math.floor(rnd() * nb.length)];
    if (d === 'E') setE(i, j, 0); else if (d === 'W') setE(a, c, 0); else if (d === 'S') setS(i, j, 0); else setS(a, c, 0);
    seen.add(a + "," + c); stack.push([a, c]);
  }
  // the red room stays a tight tangle of narrow passages, the ledge corridors long ones, the waiting rooms big open rooms
  const q = b.t === DARK ? .22 : b.t === RED ? .07 : b.t === LEDGE ? .1 : b.t === WAIT ? .45 : .3;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (inb(i, j) && inb(i + 1, j) && eW[j * W + i] && rnd() < q) setE(i, j, 0);
    if (inb(i, j) && inb(i, j + 1) && sW[j * W + i] && rnd() < q) setS(i, j, 0);
  }
  for (let k = 0; k < (b.t === RED ? 0 : b.t === LEDGE ? 1 : 3); k++) {            // a few open halls
    const rw = 2 + Math.floor(rnd() * 2), rh = 2 + Math.floor(rnd() * 2), rx = x0 + Math.floor(rnd() * (BW - rw)), ry = y0 + Math.floor(rnd() * (BH - rh));
    for (let i = rx; i < rx + rw; i++) for (let j = ry; j < ry + rh; j++) {
      if (i < rx + rw - 1 && inb(i, j) && inb(i + 1, j)) setE(i, j, 0);
      if (j < ry + rh - 1 && inb(i, j) && inb(i, j + 1)) setS(i, j, 0);
    }
  }
  if (b.id === MAN_BLK) {                    // Manila Room: one open room with a single door on its south side
    setE(MAN_X, MAN_Y, 0); setE(MAN_X, MAN_Y + 1, 0); setS(MAN_X, MAN_Y, 0); setS(MAN_X + 1, MAN_Y, 0); setS(MAN_X, MAN_Y + 1, 0);
  }
  if (b.id === STAIR_BLK) {                  // stairwell hall: open inside, one door on its west side
    for (let i = ST_I; i <= ST_I + 2; i++) for (let j = ST_J; j <= ST_J + 2; j++) { if (i < ST_I + 2) setE(i, j, 0); if (j < ST_J + 2) setS(i, j, 0); }
    setE(ST_I - 1, ST_J + 1, 0);
  }
}
const applyDoors = () => {
  DOORS.forEach(([d, i, j]) => (d === 'E' ? eW : sW)[j * W + i] = 0);
  OUT_E.forEach(j => eW[j * W + W - 1] = 0); OUT_S.forEach(i => sW[(D - 1) * W + i] = 0);
};
const PITS = [];                            // pit cells never change, so the floor holes are fixed
for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) if (pit(i, j)) PITS.push([(i + .5) * S, (j + .5) * S]);
const PIT_HALF = 1.2, PIT_DEPTH = 14, EXTRA_PITS = 8;
BLOCKS.forEach(carve); applyDoors();

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });   // antialias only serves the map view; the game view gets MSAA from the composer's target
const MAX_PR = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(MAX_PR);
renderer.setSize(innerWidth, innerHeight);
// Neutral keeps the wallpaper's sickly yellow yellow (AgX would bleach it) while rolling off the lit panels and glow pools
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
const ANISO = renderer.capabilities.getMaxAnisotropy();
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb5a13a);
scene.fog = new THREE.FogExp2(0xb5a13a, 0.028);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);   // near 0.1: finer depth precision
scene.add(camera);
// ---------- post-processing ----------
// render (MSAA, half-float so lit panels can go above 1) -> AO -> bloom -> tone map + sRGB -> found-footage grade
// no MSAA at pixel ratio 2: the supersampling already smooths edges there, and 4x MSAA on top costs a lot of memory
const msaa = pr => pr >= 2 ? 0 : 4;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: msaa(MAX_PR) }));
function setPR(pr) {
  const n = msaa(pr);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== n) { rt.samples = n; rt.dispose(); }   // dispose: reallocated at the new sample count on next use
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
}
// ambient occlusion: the lighting is ambient only, so without it the creases between walls, floor and furniture read flat.
// Half resolution (the denoise pass hides it); fades out with the fog, or fogged far walls would get dark outlines.
const gtao = new GTAOPass(scene, camera, 1, 1, undefined, { radius: 1.5, distanceExponent: 1, thickness: 3, scale: 1.6, samples: 12 });   // tuned by eye: a smaller radius barely showed in the corners
const gtaoSize = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => gtaoSize(Math.ceil(w / 2), Math.ceil(h / 2));
const gtaoHide = gtao.overrideVisibility.bind(gtao);   // sprites, glow decals and glass don't occlude: leave them out of the depth/normal pass
gtao.overrideVisibility = () => { gtaoHide(); scene.traverse(o => { if (o.isSprite || (o.material && !Array.isArray(o.material) && o.material.transparent)) o.visible = false; }); };
Object.assign(gtao.blendMaterial.uniforms, { tDepth: { value: gtao.depthTexture }, uFog: { value: 0 }, uNear: { value: camera.near }, uFar: { value: camera.far } });
gtao.blendMaterial.fragmentShader = `uniform float intensity, uFog, uNear, uFar; uniform sampler2D tDiffuse, tDepth; varying vec2 vUv;
  void main() {
    float z = uNear * uFar / (uFar - texture2D(tDepth, vUv).x * (uFar - uNear));   // view depth, as FogExp2 measures it
    float k = intensity * exp(-uFog * uFog * z * z);
    gl_FragColor = vec4(mix(vec3(1.), texture2D(tDiffuse, vUv).rgb, k), 1.);
  }`;
gtao.blendMaterial.needsUpdate = true;
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .45, .5, 1.1);   // threshold above any lit wall: only panels and the exit glow
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: .05 }, uAberr: { value: .0015 }, uVig: { value: .35 } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uAberr, uVig; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - .5; float r2 = dot(d, d);
      vec2 o = d * uAberr * r2 * 4.;                                    // colour fringes grow toward the edges, none in the centre
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      c *= 1. - uVig * smoothstep(.1, .55, r2);
      c += (h(vUv * 1000. + fract(uTime * 7.3)) - .5) * uGrain * (1.2 - c);   // grain shows most in the shadows, like film
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(new RenderPass(scene, camera)); composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
composer.setPixelRatio(MAX_PR); composer.setSize(innerWidth, innerHeight);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------- procedural textures ----------
function tex(size, draw, repeat, hgt) {
  const c = document.createElement("canvas"); c.width = size; c.height = hgt || size;
  const g = c.getContext("2d"); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO; if (repeat) t.repeat.set(repeat, repeat);
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
// tightly woven berber carpet; really beige-brown, the yellow comes from the lights
const carpetTex = tex(256, (g, s) => {
  g.fillStyle = "#8b7b5a"; g.fillRect(0, 0, s, s); noise(g, s, 16000, .4);
  for (let y = 0; y < s; y += 4) { g.fillStyle = "rgba(0,0,0,.07)"; g.fillRect(0, y, s, 1); }
  const r = g.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s); r.addColorStop(0, "rgba(40,30,0,.2)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 1);
const ceilTex = tex(256, (g, s) => {
  g.fillStyle = "#c8c09a"; g.fillRect(0, 0, s, s); noise(g, s, 6000, .15);
  g.strokeStyle = "rgba(70,65,40,.7)"; g.lineWidth = 4; g.strokeRect(0, 0, s, s);
}, 1);
const plasterTex = tex(128, (g, s) => { g.fillStyle = "#e6e3d6"; g.fillRect(0, 0, s, s); noise(g, s, 1500, .12); contactShade(g, s, s); });
// coarse, pitted wall for 熄燈區: used as colour and as bump map, so it catches the little light there is
const roughTex = tex(256, (g, s) => {
  g.fillStyle = "#6a665a"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2200; i++) { const r = 1 + Math.random() * 7; g.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "200,195,170"},${.1 + Math.random() * .25})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill(); }
}, 0);
roughTex.repeat.set(3, 2);

const VAR = 5;                                           // wallpaper variants, picked per wall by hash
// A wall box gets its textured material on the two big faces and a plain colour on the 20cm end caps
// (the texture crushed into that sliver aliased into moire). BoxGeometry face order: +x, -x, +y, -y, +z, -z.
// soft light pools painted under every lit panel (floor) and around it (ceiling): no lights follow the player, so
// every district is lit the same wherever you stand
const glowTex = tex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.45, "rgba(255,255,255,.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const glow = c => new THREE.MeshBasicMaterial({ map: glowTex, color: c, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
const glowMat = glow(0xffe890), redGlowMat = glow(0xff3020);
const flat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
const wallSet = (m, cap) => [m, m, cap, cap, cap, cap];
const wallCap = flat(0xa8953a), redCap = flat(0x8a2a20), whiteCap = flat(0xdcd9cc), manilaCap = flat(0xc9a56a), darkCap = flat(0x1a1608);
const wallMats = Array.from({ length: VAR }, () => wallSet(new THREE.MeshStandardMaterial({ map: paper(640, 448, 8), roughness: .95 }), wallCap));
const redWallMats = Array.from({ length: VAR }, () => wallSet(new THREE.MeshStandardMaterial({ map: paper(640, 448, 8, true), color: 0xd04030, roughness: 1 }), redCap));
// 熄燈區 walls are dark in themselves (a dimmer ambient light would only darken them while the player is inside) and rough
const darkSet = wallSet(new THREE.MeshStandardMaterial({ map: roughTex, bumpMap: roughTex, bumpScale: 5, color: 0x5a5a52, roughness: 1 }), darkCap);
const palMats = pal => Array.from({ length: 3 }, () => wallSet(new THREE.MeshStandardMaterial({ map: paper(640, 448, 8, false, pal), roughness: .95 }), whiteCap));
const paleMats = palMats(PALE), waitMats = palMats(WAITP);
const pillarMat = new THREE.MeshStandardMaterial({ map: paper(192, 576, 3), roughness: .95 });
const whiteMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: .95 });   // 拱門 walls are white
const whiteSet = wallSet(whiteMat, whiteCap);
const manilaSet = wallSet(new THREE.MeshStandardMaterial({ map: plasterTex, color: 0xd9b878, roughness: .95 }), manilaCap);
const baseMat = flat(0x3d2f1a), frameMat = flat(0x6a4e2c), leafMat = flat(0x7d5c33), crateMat = flat(0xa8845a), railMat = flat(0x2a2a28);
const chairMat = flat(0x6f7552), coolerMat = flat(0xe4e2d6), ventMat = flat(0x3a3a2c);   // waiting-room chairs and cooler, ceiling vents
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xa8a8a0, roughness: .35, metalness: .7 }), jugMat = new THREE.MeshStandardMaterial({ color: 0x5aa6e0, roughness: .2, transparent: true, opacity: .8 });
const stairTex = carpetTex.clone(); stairTex.repeat.set(1.5, 1.5); stairTex.needsUpdate = true;
const stairMat = new THREE.MeshStandardMaterial({ map: stairTex, roughness: 1 });
const platSet = [whiteMat, whiteMat, stairMat, whiteMat, whiteMat, whiteMat];
const floorMat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 });
// Carpet colour per district is a tint baked into a W x D texture, sampled by the floor/ceiling shaders at the pixel's
// world position. Linear filtering blends neighbouring cells, so there is no hard seam, and the grain stays one scale.
// Stored as half the multiplier (8-bit can't exceed 1); the shader doubles it.
const TINT = { [N]: [1, 1, 1], [ARCH]: [.92, .8, .62], [PIL]: [1.12, 1.08, .95], [PIT]: [1, 1, 1], [DARK]: [.3, .3, .3], [RED]: [1.5, .38, .32], [MAN]: [1, .97, .9], [STAIR]: [1, 1, 1], [WAIT]: [1.35, 1.15, .55], [LEDGE]: [1.05, 1.02, .9], [ATRIUM]: [.95, .92, .82] };
const cellTexture = fn => {
  const d = new Uint8Array(W * D * 4);
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) { const c = fn(i, j), o = (j * W + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  return d;
};
const tintTex = new THREE.DataTexture(cellTexture((i, j) => TINT[cellType(i, j)].map(v => v * 127)), W, D);
tintTex.magFilter = tintTex.minFilter = THREE.LinearFilter; tintTex.wrapS = tintTex.wrapT = THREE.RepeatWrapping; tintTex.needsUpdate = true;
const holeTex = new THREE.DataTexture(cellTexture((i, j) => basin(i, j) ? [255, 0, 0] : [0, 0, 0]), W, D);   // 熄燈區 sunken cells: no floor
holeTex.magFilter = holeTex.minFilter = THREE.NearestFilter; holeTex.needsUpdate = true;
const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: .9 });
const ceilClone = (w, h) => { const t = ceilTex.clone(); t.repeat.set(w / S, h / S); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: .9 }); };
const redCeilMat = ceilClone(BW * S, BH * S), stairCeilMat = ceilClone(12, 12);
// lit panels are brighter than white (the composer is half-float) so they, and only they, bloom
const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfffbe0).multiplyScalar(3) });
const redPanelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6050).multiplyScalar(3) });
const exitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
// pit shaft: the inside of a tall box, its walls fading from dim carpet-brown at the rim to black far below
const shaftMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  map: tex(4, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "#3c321c"); gr.addColorStop(.25, "#0c0904"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); }, 0, 64),
});
shaftMat.map.wrapS = shaftMat.map.wrapT = THREE.ClampToEdgeWrapping;
// the atrium's shaft: the same idea, but a long fade and no fog, so the stacked floors going down read against black
const voidMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide, fog: false,
  map: tex(4, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "#5a4c26"); gr.addColorStop(.35, "#241d0e"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); }, 0, 64),
});
voidMat.map.wrapS = voidMat.map.wrapT = THREE.ClampToEdgeWrapping;
// the atrium's cut-away floors: carpet on top, raw wood at the cut, a dark cavity of joists, insulation and ducts, then a dropped ceiling
const cavityMat = flat(0x2a2214), insulMat = flat(0xbfa25a), rugMat = flat(0x8c4a2c), litterMat = flat(0xe6e1cf);
const ductMat = new THREE.MeshStandardMaterial({ color: 0xa09e94, roughness: .45, metalness: .6, side: THREE.DoubleSide });
const slabSet = [frameMat, frameMat, stairMat, cavityMat, frameMat, frameMat], tileSet = [whiteCap, whiteCap, whiteCap, ceilClone(8, 8), whiteCap, whiteCap];
const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(2.4) }), lampGlowMat = glow(0xffb860);
const liquidMat = new THREE.MeshStandardMaterial({ color: 0x1a1810, roughness: .15, metalness: .3, transparent: true, opacity: .85 });
const basinMat = new THREE.MeshStandardMaterial({ map: carpetTex, color: 0x2e2c24, roughness: .8 });
const basinSideMat = new THREE.MeshStandardMaterial({ map: carpetTex, color: 0x2e2c24, roughness: .8, side: THREE.DoubleSide });
// the colour textures double as bump maps (as darkSet already does): embossed wallpaper stripes, carpet pile, tile grooves
for (const [mats, scale] of [[[...wallMats, ...redWallMats, ...paleMats, ...waitMats].map(s => s[0]), .8], [[pillarMat, whiteMat, manilaSet[0]], .5],
  [[floorMat, stairMat, basinMat, basinSideMat], .6], [[ceilMat, redCeilMat, stairCeilMat], 1]]) for (const m of mats) { m.bumpMap = m.map; m.bumpScale = scale; }

// Floor and ceiling are single planes that follow the player; their shaders cut the holes (pit shafts, the sunken
// cells of 熄燈區, the red room's and the stairwell's separate ceilings) and tint the carpet/tiles per district.
// floor holes: every pit, then the atrium's opening, then the slots for the pits that open later
const EX0 = PITS.length + 1;
const pitRects = Array.from({ length: EX0 + EXTRA_PITS }, (_, k) => k < PITS.length
  ? new THREE.Vector4(PITS[k][0] - PIT_HALF, PITS[k][1] - PIT_HALF, PITS[k][0] + PIT_HALF, PITS[k][1] + PIT_HALF) : k === PITS.length ? new THREE.Vector4(...VOID) : new THREE.Vector4(0, 0, 0, 0));
const rectOf = b => new THREE.Vector4(b.bx * BW * S, b.by * BH * S, (b.bx + 1) * BW * S, (b.by + 1) * BH * S);
const ceilHoles = [rectOf(BLOCKS.find(b => b.t === RED)), new THREE.Vector4(STX, STZ, STX + 12, STZ + 12), rectOf(AT)];   // red room, stairwell and atrium each have a ceiling of their own
function patch(mat, key, { pits, holes, basinCut } = {}) {
  mat.customProgramCacheKey = () => key;      // the patched programs differ, but their onBeforeCompile source is the same
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTint = { value: tintTex };
    let decl = "varying vec3 vWP;\nuniform sampler2D uTint;", cut = `vec2 wp = mod(vWP.xz, vec2(${WS}.0, ${DS}.0));\n`;   // the world wraps, so the floor and ceiling do too
    const rects = (name, arr) => { sh.uniforms[name] = { value: arr }; decl += `\nuniform vec4 ${name}[${arr.length}];`; cut += `for (int i = 0; i < ${arr.length}; i++) { vec4 p = ${name}[i]; if (wp.x > p.x && wp.x < p.z && wp.y > p.y && wp.y < p.w) discard; }\n`; };
    if (pits) rects("uPits", pitRects);
    if (holes) rects("uHoles", ceilHoles);
    if (basinCut) { sh.uniforms.uHole = { value: holeTex }; decl += "\nuniform sampler2D uHole;"; cut += `if (texture2D(uHole, wp / vec2(${WS}.0, ${DS}.0)).r > 0.5) discard;\n`; }
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + decl)
      .replace("#include <map_fragment>", `#include <map_fragment>\n diffuseColor.rgb *= 2.0 * texture2D(uTint, wp / vec2(${WS}.0, ${DS}.0)).rgb;`)
      .replace("void main() {", "void main() {\n" + cut);
  };
}
patch(floorMat, "floor", { pits: true, basinCut: true }); patch(ceilMat, "ceil", { holes: true });
patch(redCeilMat, "tint"); patch(stairCeilMat, "tint");
// floor & ceiling follow player, snapped to texture period so they never swim
const BIG = 160, FL = 3;
carpetTex.repeat.set(BIG / FL, BIG / FL); ceilTex.repeat.set(BIG / S, BIG / S);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(BIG, BIG), floorMat);
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(BIG, BIG), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);

// ---------- geometry ----------
const boxGeo = new THREE.BoxGeometry(1, H, 1), panelGeo = new THREE.BoxGeometry(1.4, .04, .55);
const shaftGeo = new THREE.BoxGeometry(PIT_HALF * 2, PIT_DEPTH, PIT_HALF * 2);
const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), flatDownGeo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
const sideGeo = new THREE.PlaneGeometry(1, 1);                        // vertical, faces +z
// a wall with an opening cut into its outline, open at the bottom (a hole would leave a face at y=0 lying exactly in
// the floor's plane, and the two would z-fight). uv is rewritten to span the wall once, so wallpaper isn't tiled per metre.
function openingWall(hw, rect, springY) {
  const w = (S + T) / 2, sh = new THREE.Shape();
  sh.moveTo(-w, 0); sh.lineTo(-hw, 0); sh.lineTo(-hw, springY);
  if (rect) sh.lineTo(hw, springY); else sh.absarc(0, springY, hw, Math.PI, 0, true);
  sh.lineTo(hw, 0); sh.lineTo(w, 0); sh.lineTo(w, H); sh.lineTo(-w, H); sh.lineTo(-w, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false }).translate(0, 0, -T / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) + w) / (2 * w), p.getY(k) / H);
  return g;
}
const archGeo = openingWall(HW, false, 1.9), doorGeo = openingWall(HWD, true, 2.1), jugGeo = new THREE.CylinderGeometry(.17, .17, .42, 14);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0);
function inst(g, geo, mat, list) {
  if (!list.length) return;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach(([x, y, z, r, sx, sy, sz], n) => m.setMatrixAt(n, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_u, r), _s.set(sx, sy, sz))));
  g.add(m);                                  // frustum culling stays on: three computes the instances' bounding sphere
}

// tall walls (stairwell, atrium) get one wallpaper drawn at their full height: stacked 3m pieces showed every piece's
// floor grime and ceiling shade as dark bands across the wall. Shared by all blocks, keyed by palette, height and variant.
const tallMats = new Map();
function tallSet(pal, h, v) {
  const key = `${pal === PALE}|${h.toFixed(2)}|${v}`;
  if (!tallMats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ map: paper(640, Math.round(448 * h / H), 8, false, pal), roughness: .95 });
    m.bumpMap = m.map; m.bumpScale = .8;
    tallMats.set(key, wallSet(m, pal === PALE ? whiteCap : wallCap));
  }
  return tallMats.get(key);
}
// ---------- district meshes ----------
function buildBlock(b) {
  const tall = new Map(), addTall = (set, item) => (tall.get(set) || tall.set(set, []).get(set)).push(item);
  const g = new THREE.Group(), mk = () => Array.from({ length: VAR }, () => []);
  const plain = mk(), reds = mk(), doorWalls = mk(), darks = [], whites = [], manilas = [], arches = [], frames = [], leaves = [], crates = [], boards = [];
  const glowF = [], glowC = [], redGlowF = [], redGlowC = [], panels = [], redPanels = [], pillars = [], pits = [], basinF = [], basinS = [], liquid = [];
  const pales = [[], [], []], waits = [[], [], []], slabs = [], vents = [], L = { chSeat: [], chBack: [], chLeg: [], coolers: [], jugs: [] };
  b.props = new Map(); b.mirrors = [];
  const x0 = b.bx * BW, y0 = b.by * BH;
  for (let i = x0; i < x0 + BW; i++) for (let j = y0; j < y0 + BH; j++) {
    const t = cellType(i, j);
    // every wall gets its own thickness (5-30mm over T): walls overlap at joints, and equal thickness would put
    // their faces in the same plane, where the depth buffer flickers between them (z-fighting)
    const th = k => T + .005 * (1 + Math.floor(hash(i, j, k + 30) * 6));
    for (const d of ['E', 'S']) {
      const E = d === 'E', ni = E ? i + 1 : i, nj = E ? j : j + 1, nt = cellType(ni, nj);
      const x = E ? (i + 1) * S : (i + .5) * S, z = E ? (j + .5) * S : (j + 1) * S, rot = E ? 0 : Math.PI / 2, k = edgeKind(d, i, j);
      if (k === 0) {                         // open edge: close the gap where two districts have different ceilings
        if (inMap(ni, nj) && ceilH(i, j) !== ceilH(ni, nj)) {
          const lo = Math.min(ceilH(i, j), ceilH(ni, nj)), hi = Math.max(ceilH(i, j), ceilH(ni, nj));
          addTall(tallSet([t, nt].some(u => u === ATRIUM || u === LEDGE) ? PALE : YEL, hi - lo, 0), [x, (lo + hi) / 2, z, rot, T + .01, (hi - lo) / H, S]);
        }
        continue;
      }
      const dk = t === DARK || nt === DARK, lo = dk ? -BASIN : 0, hi = Math.max(ceilH(i, j), ceilH(ni, nj)), v = Math.floor(hash(i, j, (E ? 21 : 22) + b.ver * 101) * VAR);
      const tt = t === MAN || nt === MAN ? MAN : t === ATRIUM || nt === ATRIUM ? ATRIUM : t, thick = th(E ? 21 : 22);   // a wall on the atrium's border shows the atrium's paper
      if (k === 1) {                          // tall walls are stacked from 3m pieces, so the wallpaper isn't stretched
        const to = dk ? darks : tt === ARCH ? whites : tt === MAN ? manilas : tt === LEDGE || tt === ATRIUM ? pales[v % 3] : tt === WAIT ? waits[v % 3] : (tt === RED ? reds : plain)[v];
        const pal = to === plain[v] ? YEL : tt === LEDGE || tt === ATRIUM ? PALE : null;   // the other papers are never tall enough to stack
        if (pal && hi - lo > H + .01) addTall(tallSet(pal, hi - lo, v % 2), [x, (lo + hi) / 2, z, rot, thick, (hi - lo) / H, S + T]);
        else for (let ya = lo; ya < hi - .01; ya += H) { const yb = Math.min(hi, ya + H); to.push([x, (ya + yb) / 2, z, rot, thick, (yb - ya) / H, S + T]); }
        if (!dk) boards.push([x, .07, z, rot, thick + .06, .14 / H, S + T + .04]);
        if (t === WAIT && tt === WAIT && hash(i, j, E ? 47 : 48) < .05) {   // a wall mirror in a white frame (not part of the group: a Reflector can't be cloned)
          const off = (thick + .07) / 2 + .02, m = new Reflector(new THREE.PlaneGeometry(2.6, 1.3), { textureWidth: 512, textureHeight: 256, clipBias: .003, color: 0xc8d0c4, multisample: 2 });
          m.position.set(E ? x - off : x, 1.55, E ? z : z - off); m.rotation.y = E ? -Math.PI / 2 : Math.PI; scene.add(m); b.mirrors.push(m);
          whites.push([x, 1.55, z, rot, thick + .07, 1.5 / H, 2.8]);
        }
        continue;
      }
      const rotA = E ? Math.PI / 2 : 0;       // the opening geometry runs along x: turn it for walls that run along z
      if (k === 4) {                          // an office doorway: frame, and a door left ajar
        doorWalls[v].push([x, 0, z, rotA, 1, 1, thick / T]);
        const c = E ? z : x, fw = thick + .06, hinge = hash(i, j, 34) < .5 ? 1 : -1, phi = 1.2;
        const post = off => frames.push(E ? [x, 1.05, c + off, 0, fw, 2.1 / H, .08] : [c + off, 1.05, z, Math.PI / 2, fw, 2.1 / H, .08]);
        post(-HWD - .03); post(HWD + .03);   // 1cm into the opening: a jamb flush with the opening's side z-fought with it
        frames.push(E ? [x, 2.13, c, 0, fw, .08 / H, 2 * HWD + .16] : [c, 2.13, z, Math.PI / 2, fw, .08 / H, 2 * HWD + .16]);
        const hx = E ? x : c + hinge * HWD, hz = E ? c + hinge * HWD : z;                   // hinge post; the leaf swings 70 degrees off the wall
        const ax = E ? 0 : -hinge * Math.cos(phi), az = E ? -hinge * Math.cos(phi) : 0, nx = E ? Math.sin(phi) : 0, nz = E ? 0 : Math.sin(phi);
        const dx = ax + nx, dz = az + nz;
        leaves.push([hx + dx * .45, 1.03, hz + dz * .45, Math.atan2(dx, dz), .04, 2.05 / H, .9]);
        continue;
      }
      arches.push([x, 0, z, rotA, 1, 1, thick / T]);   // arch doorway (2) or alcove (3)
      if (k === 3) {                          // alcove: a recess 1.1m deep behind the arch, roofed and walled in
        const s = hash(i, j, 32) < .5 ? 1 : -1, dd = 1.1, c = E ? z : x, X = E ? x : z, xm = X + s * dd / 2, xe = X + s * dd, sc = HW + .05;
        const put = (a, y, al, ax, az2, ay) => whites.push(E ? [a, y, al, 0, ax, ay, az2] : [al, y, a, 0, az2, ay, ax]);
        put(xe, H / 2, c, .12, 1.7, 1); put(xm, H / 2, c + sc, dd, .1, 1); put(xm, H / 2, c - sc, dd, .1, 1); put(xm, 2.8, c, dd, 1.6, .4 / H);
      }
    }
    // ceiling panels and the glow painted under and around them
    const ch = ceilH(i, j), hh = t === LEDGE ? ledgeH(i, j) : 0, cx0 = (i + .5) * S, cz0 = (j + .5) * S;
    if (hh > 0) slabs.push([cx0, hh / 2, cz0, 0, S, hh / H, S]);        // 台階長廊: every raised cell is a slab
    if (t === LEDGE && hash(i, j, 44) < .18) vents.push([cx0 + (hash(i, j, 45) - .5) * 2, ch - .015, cz0 + (hash(i, j, 46) - .5) * 2, 0, 1.1, 1, .5]);
    if (t === WAIT) waitProps(b, i, j, L);
    if (lit(i, j)) {
      const [px, pz] = panelPos(i, j), red = t === RED;
      (red ? redPanels : panels).push([px, ch - .03, pz, hash(i, j, 4) < .5 ? Math.PI / 2 : 0, 1, 1, 1]);
      if (!pit(i, j) && !isVoid(i, j)) (red ? redGlowF : glowF).push([px, hh + .03, pz, 0, 6, 1, 6]);   // a floor glow would float over a pit
      (red ? redGlowC : glowC).push([px, ch - .02, pz, 0, 4, 1, 4]);
    }
    const pl = pillarAt(i, j); if (pl) pillars.push([pl[0], H / 2, pl[1], 0, 1, 1, 1]);
    const cr = crateAt(i, j); if (cr) { crates.push([cr[0], .25, cr[1], 0, .8, .5 / H, .8]); crates.push([cr[0] + .05, .72, cr[1] - .03, .3, .65, .44 / H, .65]); }
    if (pit(i, j)) pits.push([(i + .5) * S, -PIT_DEPTH / 2, (j + .5) * S, 0, 1, 1, 1]);
    if (basin(i, j)) {                        // sunken cell: its own floor, ankle-deep liquid, and rim faces wherever it meets the normal floor
      const cx = (i + .5) * S, cz = (j + .5) * S;
      basinF.push([cx, -BASIN, cz, 0, S, 1, S]); liquid.push([cx, -.1, cz, 0, S, 1, S]);
      [[1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, Math.PI], [0, -1, 0]].forEach(([dx, dz, r]) => {
        if (!basin(i + dx, j + dz)) basinS.push([cx + dx * S / 2, -BASIN / 2, cz + dz * S / 2, r, S, BASIN, 1]);
      });
    }
  }
  for (let v = 0; v < VAR; v++) { inst(g, boxGeo, wallMats[v], plain[v]); inst(g, boxGeo, redWallMats[v], reds[v]); inst(g, doorGeo, [wallMats[v][0], wallCap], doorWalls[v]); }
  inst(g, boxGeo, darkSet, darks); inst(g, boxGeo, whiteSet, whites); inst(g, boxGeo, manilaSet, manilas);
  inst(g, archGeo, whiteMat, arches); inst(g, boxGeo, baseMat, boards);
  for (const [set, list] of tall) inst(g, boxGeo, set, list);
  inst(g, boxGeo, frameMat, frames); inst(g, boxGeo, leafMat, leaves); inst(g, boxGeo, crateMat, crates);
  inst(g, panelGeo, panelMat, panels); inst(g, panelGeo, redPanelMat, redPanels);
  inst(g, flatGeo, glowMat, glowF); inst(g, flatDownGeo, glowMat, glowC); inst(g, flatGeo, redGlowMat, redGlowF); inst(g, flatDownGeo, redGlowMat, redGlowC);
  inst(g, boxGeo, pillarMat, pillars);
  inst(g, shaftGeo, shaftMat, pits);
  inst(g, flatGeo, basinMat, basinF); inst(g, sideGeo, basinSideMat, basinS); inst(g, flatGeo, liquidMat, liquid);
  if (b.id === STAIR_BLK) addStairs(g);
  if (b.t === ATRIUM) addAtrium(g, L);
  if (b.t === RED) {                         // the red room has a low ceiling of its own; the global one is cut away above it
    const m = new THREE.Mesh(flatDownGeo, redCeilMat); m.position.set((b.bx + .5) * BW * S, RED_H, (b.by + .5) * BH * S); m.scale.set(BW * S, 1, BH * S); g.add(m);
  }
  for (let v = 0; v < 3; v++) { inst(g, boxGeo, paleMats[v], pales[v]); inst(g, boxGeo, waitMats[v], waits[v]); }
  inst(g, boxGeo, platSet, slabs); inst(g, flatDownGeo, ventMat, vents);
  inst(g, boxGeo, chairMat, L.chSeat); inst(g, boxGeo, chairMat, L.chBack); inst(g, boxGeo, chromeMat, L.chLeg); inst(g, boxGeo, coolerMat, L.coolers); inst(g, jugGeo, jugMat, L.jugs);
  // the map wraps: districts on an edge are drawn once more a map-width over, so a doorway in the outer wall looks
  // onto exactly what you arrive in (the outer west and north walls come from these copies too)
  const xs = b.bx === 0 ? [0, WS] : b.bx === NBX - 1 ? [0, -WS] : [0], zs = b.by === 0 ? [0, DS] : b.by === NBY - 1 ? [0, -DS] : [0];
  b.groups = [];
  for (const x of xs) for (const z of zs) { const c = x || z ? g.clone() : g; c.position.set(x, 0, z); scene.add(c); b.groups.push(c); }
}
// the stairwell: 15 steps up (20cm each) to a 3m-high landing along the east wall, with a parapet and a handrail
function addStairs(g) {
  const steps = [], lamps = [];
  for (let k = 1; k <= 15; k++) steps.push([STX + 3 + (k - .5) * .3, k * .1, STZ + 10.5, 0, .3, k * .2 / H, 3]);
  inst(g, boxGeo, stairMat, steps);
  inst(g, boxGeo, platSet, [[STX + 9.75, 1.5, STZ + 6, 0, 4.5, 1, 12]]);
  inst(g, boxGeo, whiteMat, [[STX + 7.5, 3.5, STZ + 4.5, 0, .14, 1 / H, 9]]);
  const rail = new THREE.Mesh(boxGeo, railMat);          // sloped handrail along the open side of the stairs
  rail.position.set(STX + 5.7, 2.8, STZ + 9); rail.rotation.z = Math.atan2(2.4, 3.6); rail.scale.set(Math.hypot(3.6, 2.4), .05 / H, .05);
  g.add(rail);
  const ceilM = new THREE.Mesh(flatDownGeo, stairCeilMat); ceilM.position.set(STX + 6, TALL, STZ + 6); ceilM.scale.set(12, 1, 12); g.add(ceilM);
  inst(g, panelGeo, panelMat, [[STX + 3, TALL - .03, STZ + 6, 0, 1, 1, 1], [STX + 9, TALL - .03, STZ + 6, 0, 1, 1, 1]]);
  inst(g, flatDownGeo, glowMat, [[STX + 3, TALL - .02, STZ + 6, 0, 5, 1, 5], [STX + 9, TALL - .02, STZ + 6, 0, 5, 1, 5]]);
  inst(g, flatGeo, glowMat, [[STX + 3, .03, STZ + 6, 0, 7, 1, 7], [STX + 9.75, 3.03, STZ + 6, 0, 6, 1, 6]]);
}
// a row of three chairs (or a water cooler) against a plain wall of a waiting room; the boxes go to b.props for collision
function chair(L, px, y, pz, th) {          // th: the way the chair faces; its local x axis is (cos, -sin) in the world
  const ax = Math.cos(th), az = -Math.sin(th), fx = Math.sin(th), fz = Math.cos(th);
  const part = (lx, py, lz, sx, sy, sz, list) => list.push([px + ax * lx + fx * lz, y + py, pz + az * lx + fz * lz, th, sx, sy / H, sz]);
  part(0, .46, 0, .46, .05, .46, L.chSeat); part(0, .74, -.21, .46, .42, .05, L.chBack);
  part(-.2, .22, 0, .04, .44, .42, L.chLeg); part(.2, .22, 0, .04, .44, .42, L.chLeg);
}
function waitProps(b, i, j, L) {
  const r = hash(i, j, 41); if (r >= .22) return;
  const cx = (i + .5) * S, cz = (j + .5) * S, st = Math.floor(hash(i, j, 42) * 4);
  const dirs = [[1, 0, 'E', i, j], [-1, 0, 'E', i - 1, j], [0, 1, 'S', i, j], [0, -1, 'S', i, j - 1]];
  for (let n = 0; n < 4; n++) {
    const [dx, dz, d, ei, ej] = dirs[(st + n) % 4];
    if (edgeKind(d, ei, ej) !== 1) continue;                               // only against a plain wall
    const wx = cx + dx * 1.55, wz = cz + dz * 1.55;
    if (r < .16) {
      const th = Math.atan2(-dx, -dz), ax = Math.cos(th), az = -Math.sin(th);   // facing away from the wall
      for (const o of [-.62, 0, .62]) chair(L, wx + ax * o, 0, wz + az * o, th);
      const hw = dx ? .3 : .95, hd = dx ? .95 : .3;
      b.props.set(j * W + i, [[wx - hw, wz - hd, wx + hw, wz + hd]]);
    } else {
      const px = wx + dx * .15, pz = wz + dz * .15;
      L.coolers.push([px, .5, pz, 0, .36, 1 / H, .36]); L.jugs.push([px, 1.2, pz, 0, 1, 1, 1]);
      b.props.set(j * W + i, [[px - .22, pz - .22, px + .22, pz + .22]]);
    }
    return;
  }
}
// instances with a brightness each: [x, y, z, sx, sy, sz, shade, rx, ry, rz] (or a quaternion in place of rx)
const _e = new THREE.Euler(), _c2 = new THREE.Color();
function instC(g, geo, mat, list) {
  if (!list.length) return;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach(([x, y, z, sx, sy, sz, k, rx = 0, ry = 0, rz = 0], n) => {
    if (rx instanceof THREE.Quaternion) _q.copy(rx); else _q.setFromEuler(_e.set(rx, ry, rz));
    m.setMatrixAt(n, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))); m.setColorAt(n, _c2.setScalar(k));
  });
  g.add(m);
}
// the atrium: a building cut open around a deep shaft. Every storey is a full ring of floor plate (carpet, wooden joists, a cavity
// stuffed with insulation and ducts, a dropped ceiling) with rooms running back under the floor above: back walls, partitions lined
// up storey to storey, doors, lamps, rugs, cabinets, litter. Each room is lit by its own panel; everything darkens with depth.
// Above: a ceiling nine metres up, and the gallery with its long stair, a door in the wall above it and a chair at the edge.
function addAtrium(g, L) {
  const [x0, z0, x1, z1] = VOID, rnd = mulberry(77), Pt = ATR_PITCH, RD = ATR_RD, WH = Pt - .88;   // WH: floor to dropped ceiling
  const B = { slab: [], cav: [], tile: [], joist: [], wall: [[], [], []], frame: [], leaf: [], panel: [], glow: [], lamp: [], lampGlow: [], rug: [], litter: [], insul: [], duct: [] };
  const shaftM = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 2 * RD, VOID_DEPTH, z1 - z0 + 2 * RD), voidMat);
  shaftM.position.set((x0 + x1) / 2, -VOID_DEPTH / 2, (z0 + z1) / 2); g.add(shaftM);
  // start, along, inward, length; the north and south sides also take the corners
  const sides = [[x0 - RD, z0, 1, 0, 0, 1, x1 - x0 + 2 * RD, 1], [x0 - RD, z1, 1, 0, 0, -1, x1 - x0 + 2 * RD, 1], [x0, z0, 0, 1, 1, 0, z1 - z0, 0], [x1, z0, 0, 1, -1, 0, z1 - z0, 0]];
  const up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  for (const [ox, oz, ax, az, nx, nz, len, ns] of sides) {
    // this side's frame: u runs along the cut, v points into the shaft (v < 0 is behind the cut, under the floor above)
    const at = (u, v) => [ox + ax * u + nx * v, oz + az * u + nz * v];
    const box = (list, u0, u1, v0, v1, y0, y1, k, ...rot) => { const [x, z] = at((u0 + u1) / 2, (v0 + v1) / 2), du = u1 - u0, dv = v1 - v0; list.push([x, (y0 + y1) / 2, z, ax ? du : dv, (y1 - y0) / H, ax ? dv : du, k, ...rot]); };
    const flatAt = (list, u, v, du, dv, y, k, ry = 0) => { const [x, z] = at(u, v); list.push([x, y, z, ax ? du : dv, 1, ax ? dv : du, k, 0, ry, 0]); };
    const wall = (list, u, v, runU, l, y, k) => { const [x, z] = at(u, v); list.push([x, y + WH / 2, z, .16, WH / H, l, k, 0, (runU ? ax : nx) ? Math.PI / 2 : 0, 0]); };   // wallpaper on the big faces
    const pipe = (p, q, k) => { _d.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const l = _d.length(); B.duct.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, 1, l, 1, k, new THREE.Quaternion().setFromUnitVectors(up, _d.normalize())]); };
    const segs = [];                                                       // [u0, u1, corner]: 4m bays, the corner bays as deep as the rooms
    if (ns) { segs.push([0, RD, 1]); for (let u = RD; u < len - RD - .01; u += 4) segs.push([u, u + 4, 0]); segs.push([len - RD, len, 1]); }
    else for (let u = 0; u < len - .01; u += 4) segs.push([u, u + 4, u === 0 || u + 4 > len - .01 ? 1 : 0]);
    // partitions sit on the bay lines and repeat storey after storey (the ends of the north and south sides close the corner rooms)
    const parts = segs.map(([u0], n) => ns && n === 0 ? [u0, 1, 1] : [u0, rnd() < .75, rnd() < .6]);
    parts.push(ns ? [len, 1, 1] : [len, rnd() < .75, rnd() < .6]);
    let gone = segs.map(() => 0);
    for (let lv = 0; lv <= ATR_LV; lv++) {
      const y = -lv * Pt, k = Math.max(.02, Math.exp(-lv * .22)), kl = Math.max(.2, Math.exp(-lv * .11)), above = gone, lip0 = rnd() * .8;   // lip0: this storey's edge line
      gone = segs.map(([, , c]) => lv > 0 && !c && rnd() < .07);          // now and then a plate is missing: straight down into the room below
      segs.forEach(([u0, u1, c], si) => {
        const lip = lv && !c ? lip0 + (rnd() < .2 ? 1 + rnd() * 1.2 : 0) : 0, um = (u0 + u1) / 2;   // how far the plate juts past the line of the cut
        if (!gone[si]) {
          box(B.slab, u0, u1, -RD, lip, y - .12, lv ? y : y - .03, k);        // at the rim the plate stays under the floor itself
          box(B.cav, u0, u1, -RD, lip - .25, y - .8, y - .12, k);
          for (let u = u0 + .5; u < u1; u += 1) box(B.joist, u - .04, u + .04, -RD, lip - .06, y - .4, y - .12, k);
          box(B.tile, u0, u1, -RD, rnd() < .25 ? lip - .6 - rnd() * 1.5 : lip - .15, y - .88, y - .8, k);   // the dropped ceiling is sometimes torn back
          for (let n = rnd() < .2 ? 1 + Math.floor(rnd() * 2) : 0; n > 0; n--) {   // insulation sagging out of the cavity
            const u = u0 + .6 + rnd() * (u1 - u0 - 1.2), s = .4 + rnd() * .4;
            box(B.insul, u - s, u + s, lip - .7, lip + .05 + rnd() * .25, y - .95 - rnd() * .3, y - .6, k * .8, rnd() * .4 - .2, 0, rnd() * .4 - .2);
          }
          if (rnd() < .08 && lv < ATR_LV) {                                 // a flexible duct hanging out over the shaft
            const u = u0 + .5 + rnd() * (u1 - u0 - 1), pt = (v, yy) => { const [x, z] = at(u + (yy - y) * .15, v); return [x, yy, z]; };
            const a = pt(lip - .4, y - .5), b = pt(lip + .7, y - 1.3), d = pt(lip + 1.1, y - 2.2), e = pt(lip + .8, y - 2.9);
            pipe(a, b, k); pipe(b, d, k); pipe(d, e, k);
          }
        }
        if (!lv || gone[si]) return;
        // the room on this storey, under the plate above
        const v = Math.floor(rnd() * 3);
        wall(B.wall[v], um, -RD, 1, u1 - u0 + .16, y, k);
        if (!above[si] && rnd() > .15) {                                    // its ceiling panel (a few rooms are dark) and the light it throws
          const [px, pz] = at(um, -RD / 2);
          B.panel.push([px, y + WH - .03, pz, 1, 1, 1, kl, 0, ax ? 0 : Math.PI / 2, 0]);
          flatAt(B.glow, um, -RD / 2, 5, 5, y + .03, k);
        }
        if (rnd() < .3) {                                                   // a door in the back wall
          const d = um + (rnd() - .5) * 1.6, vv = -RD + .08;
          box(B.frame, d - .6, d - .52, vv, vv + .12, y, y + 2.1, k); box(B.frame, d + .52, d + .6, vv, vv + .12, y, y + 2.1, k); box(B.frame, d - .6, d + .6, vv, vv + .12, y + 2.1, y + 2.18, k);
          box(B.leaf, d - .52, d + .52, vv, vv + .05, y, y + 2.05, k);
        }
        const r = rnd(), pu = u0 + .8 + rnd() * (u1 - u0 - 1.6);
        if (r < .2) {                                                       // a lamp on a side table, warm against the wall
          box(B.leaf, pu - .22, pu + .22, -RD + .3, -RD + .74, y, y + .6, k);
          box(B.lamp, pu - .15, pu + .15, -RD + .37, -RD + .67, y + .62, y + .9, kl);
          flatAt(B.lampGlow, pu, -RD + 1, 3, 3, y + .035, kl);
        } else if (r < .35) box(B.leaf, pu - .55, pu + .55, -RD + .1, -RD + .6, y, y + 1.9, k);   // a cabinet
        else if (r < .5 && lv <= 3) { const [cx, cz] = at(pu, -RD + 1.5); chair(L, cx, y, cz, Math.atan2(nx, nz)); }   // a chair (chairs take no shade, so only near the rim)
        if (rnd() < .25) flatAt(B.rug, um, -RD / 2, 1.8, 2.4, y + .012, k);
        for (let n = rnd() < .25 ? 1 + Math.floor(rnd() * 2) : 0; n > 0; n--) flatAt(B.litter, u0 + .3 + rnd() * (u1 - u0 - .6), -RD + 1 + rnd() * (RD - 1 + lip - .4), .3, .4, y + .02 + n * .002, k, rnd() * 3);
      });
      if (lv) parts.forEach(([u, on, full]) => {                            // partitions between the rooms
        const si = segs.findIndex(([a, b]) => u >= a && u <= b);
        if (!on || gone[si] || rnd() < .12) return;
        const l = full ? RD - .3 : RD / 2;
        wall(B.wall[Math.floor(rnd() * 3)], u, -RD + l / 2, 0, l, y, k);
      });
    }
  }
  instC(g, boxGeo, slabSet, B.slab); instC(g, boxGeo, cavityMat, B.cav); instC(g, boxGeo, frameMat, B.joist); instC(g, boxGeo, tileSet, B.tile);
  for (let v = 0; v < 3; v++) instC(g, boxGeo, paleMats[v], B.wall[v]);
  instC(g, boxGeo, frameMat, B.frame); instC(g, boxGeo, leafMat, B.leaf); instC(g, boxGeo, insulMat, B.insul);
  instC(g, new THREE.CylinderGeometry(.2, .2, 1, 10, 1, true), ductMat, B.duct);
  instC(g, panelGeo, panelMat, B.panel); instC(g, flatGeo, glowMat, B.glow); instC(g, boxGeo, lampMat, B.lamp); instC(g, flatGeo, lampGlowMat, B.lampGlow);
  instC(g, flatGeo, rugMat, B.rug); instC(g, flatGeo, litterMat, B.litter);
  const ceilM = new THREE.Mesh(flatDownGeo, redCeilMat); ceilM.position.set(AX + BW * S / 2, ATR_H, AZ + BH * S / 2); ceilM.scale.set(BW * S, 1, BH * S); g.add(ceilM);
  inst(g, boxGeo, platSet, [[(GAL[0] + GAL[2]) / 2, GAL_H / 2, (GAL[1] + GAL[3]) / 2, 0, GAL[2] - GAL[0], GAL_H / H, GAL[3] - GAL[1]]]);
  const sw = (AST[2] - AST[0]) / AST_N, steps = [];
  for (let k = 1; k <= AST_N; k++) steps.push([AST[0] + (k - .5) * sw, k * .1, (AST[1] + AST[3]) / 2, 0, sw, k * .2 / H, AST[3] - AST[1]]);
  inst(g, boxGeo, stairMat, steps);
  const rail = new THREE.Mesh(boxGeo, railMat);                              // sloped handrail along the open side of the stair
  rail.position.set((AST[0] + AST[2]) / 2, GAL_H / 2 + 1, AST[3]); rail.rotation.z = Math.atan2(GAL_H, AST[2] - AST[0]); rail.scale.set(Math.hypot(GAL_H, AST[2] - AST[0]), .05 / H, .05);
  g.add(rail);
  const dx = (GAL[0] + GAL[2]) / 2 + 4, dz = GAL[1] + .14;                    // a door in the north wall, up on the gallery
  inst(g, boxGeo, frameMat, [[dx - .56, GAL_H + 1.05, dz, 0, .08, 2.1 / H, .1], [dx + .56, GAL_H + 1.05, dz, 0, .08, 2.1 / H, .1], [dx, GAL_H + 2.14, dz, 0, 1.2, .08 / H, .1]]);
  inst(g, boxGeo, leafMat, [[dx, GAL_H + 1.03, dz + .02, 0, 1.04, 2.05 / H, .05]]);
  chair(L, GAL[2] - 6, GAL_H, GAL[1] + 5.5, 0);
}
function rebuild(b) {
  b.groups.forEach(c => { scene.remove(c); c.children.forEach(m => m.dispose?.()); });
  b.mirrors.forEach(m => { scene.remove(m); m.geometry.dispose(); m.dispose?.(); });
  buildBlock(b);
}
BLOCKS.forEach(buildBlock);
// pits that open up later, once the level has had time to turn strange
const extraPitMeshes = Array.from({ length: EXTRA_PITS }, () => {   // each shaft is repeated across the wrap, like the floor holes
  const g = new THREE.Group(); g.visible = false;
  for (const a of [-1, 0, 1]) for (const c of [-1, 0, 1]) { const m = new THREE.Mesh(shaftGeo, shaftMat); m.position.set(a * WS, 0, c * DS); g.add(m); }
  scene.add(g); return g;
});
let extraPitN = 0;

// ---------- lighting ----------
const hemi = new THREE.HemisphereLight(0xfff2a0, 0xa08a3a, .55); scene.add(hemi);
// No lights that follow the player: every district is lit the same wherever you stand. The ambient light carries the
// walls, and each lit panel has its painted glow pool (see glowMat). Only the exit wall casts a real light.
const exitLight = new THREE.PointLight(0xffffff, 0, 30, 1.4); scene.add(exitLight);
// per-district atmosphere: fog colour, fog density, ambient level, ambient colour (the last row is the Alpha base)
const AMB = [
  [0xb5a13a, .028, 3.6, 0xfff2a0], [0xb5a13a, .028, 3.6, 0xfff2a0], [0xb5a13a, .021, 3.2, 0xfff2a0],
  [0xb5a13a, .03, 3.6, 0xfff2a0], [0x000000, .09, 3.6, 0xfff2a0], [0x8a1212, .06, 2.8, 0xff4030], [0xb5a13a, .03, 3.9, 0xfff2a0],
  [0xb5a13a, .02, 3.4, 0xfff2a0], [0x9aa0a8, .018, 2.6, 0xffffff],
  [0x6e6252, .005, 1.4, 0xfff6e8], [0x3a4a58, .006, 1.4, 0xcfe4ff], [0x4a2410, .006, 1.4, 0xffb070], [0x000000, .05, 1.0, 0x8090a0],   // Level 0.1: normal (the void's dust haze), freezing, scorching, dark; ambient kept low so the station's own lamps make pools
];
AMB[WAIT] = [0xb5a13a, .024, 3.9, 0xfff2b0]; AMB[LEDGE] = [0xb8ac55, .02, 3.5, 0xfff2a0]; AMB[ATRIUM] = [0x3e361c, .015, 3.6, 0xfff2a0]; const REMODEL_ZT = 16; AMB[REMODEL_ZT] = [0xe8e4dc, .011, 3.2, 0xfffcf0];   // waiting rooms, ledge corridors, atrium
const _c = new THREE.Color();
function updateAmbience(t, dt, time) {
  const [fc, fd, hi, hc] = AMB[t], k = 1 - Math.exp(-dt * 2);
  scene.fog.color.lerp(_c.set(fc), k); scene.background.set(mode === "station" ? 0x000004 : scene.fog.color);
  // 熄燈區: how far you can see keeps changing
  scene.fog.density += (fd + (t === DARK ? .04 * Math.sin(time * .35) * Math.sin(time * .21 + 1) : 0) - scene.fog.density) * k;
  hemi.intensity += (hi - hemi.intensity) * k; hemi.color.lerp(_c.set(hc), k);
}

// ---------- player & collision ----------
// a different start every run, and after every fall: a random ordinary room whose middle is clear of walls and props
const clearAt = (x, z) => {
  let ok = true; const ci = Math.floor(x / S), cj = Math.floor(z / S);
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) wallBoxes(i, j, (a, b, c, d) => { if (x > a - .7 && x < c + .7 && z > b - .7 && z < d + .7) ok = false; });
  return ok;
};
function pickSpawn() {
  for (let n = 0; n < 500; n++) {
    const i = Math.floor(Math.random() * W), j = Math.floor(Math.random() * D), x = (i + .5) * S, z = (j + .5) * S;
    if ([N, ARCH, PIL, WAIT, LEDGE].includes(cellType(i, j)) && clearAt(x, z)) return [x, z];
  }
  return [S * 2.5, S * 2.5];
}
const SPAWN = pickSpawn();
const P = { x: SPAWN[0], y: 0, z: SPAWN[1], yaw: Math.random() * Math.PI * 2, pitch: 0, r: .3 };
let mode = "map";                            // "map" (Level 0) or "base" (Alpha base, after the exit)
// ground height under (x, z): the stairwell, sunken 熄燈區 cells, and the thick carpet of the arch rooms
function floorH(x, z) {
  if (mode === "station") return tsLevel * TS_FH;
  if (mode === "remodel") return remodelFloorH(x, z);
  if (mode !== "map") return 0;
  if (x >= STX && x < STX + 12 && z >= STZ && z < STZ + 12) {
    const lx = x - STX, lz = z - STZ;
    if (lx >= 7.5) return 3;
    if (lz >= 9 && lx >= 3) return Math.ceil((lx - 3) / 4.5 * 15) * .2;
    return 0;
  }
  if (x >= GAL[0] && x < GAL[2] && z >= GAL[1] && z < GAL[3]) return GAL_H;                            // the atrium's gallery...
  if (x >= AST[0] && x < AST[2] && z >= AST[1] && z < AST[3]) return Math.ceil((x - AST[0]) / (AST[2] - AST[0]) * AST_N) * .2;   // ...and the stair up to it
  const i = Math.floor(x / S), j = Math.floor(z / S), t = cellType(i, j);
  return basin(i, j) ? -BASIN : t === ARCH ? .05 : t === LEDGE ? ledgeH(i, j) : 0;
}
function wallBoxes(i, j, add) {
  for (const d of ['E', 'S']) {
    const k = edgeKind(d, i, j);
    if (!k || (exitEdge && exitEdge.d === d && exitEdge.i === i && exitEdge.j === j)) continue;   // the flickering wall has no collision: it is the way out
    const E = d === 'E', X = E ? (i + 1) * S : (j + 1) * S, a0 = (E ? j : i) * S - T / 2, a1 = ((E ? j : i) + 1) * S + T / 2, c = ((E ? j : i) + .5) * S;
    const R = (p0, p1, q0, q1) => E ? add(q0, p0, q1, p1) : add(p0, q0, p1, q1);           // along-range x across-range
    if (k === 1) R(a0, a1, X - T / 2, X + T / 2);
    else {
      const hw = k === 4 ? HWD : HW;
      R(a0, c - hw, X - T / 2, X + T / 2); R(c + hw, a1, X - T / 2, X + T / 2);
      if (k === 3) {
        const s = hash(i, j, 32) < .5 ? 1 : -1, xe = X + s * 1.1, lo = Math.min(X, xe), hi = Math.max(X, xe);
        R(c - .85, c + .85, xe - .06, xe + .06); R(c + HW, c + HW + .1, lo, hi); R(c - HW - .1, c - HW, lo, hi);
      }
    }
  }
  const pl = pillarAt(i, j); if (pl) add(pl[0] - .5, pl[1] - .5, pl[0] + .5, pl[1] + .5);
  const cr = crateAt(i, j); if (cr) add(cr[0] - .42, cr[1] - .42, cr[0] + .42, cr[1] + .42);
  const pr = inMap(i, j) && blockOf(i, j).props.get(j * W + i); if (pr) pr.forEach(r => add(...r));    // waiting-room chairs and coolers
}
function pushOut(x0, z0, x1, z1) {
  const nx = Math.max(x0, Math.min(P.x, x1)), nz = Math.max(z0, Math.min(P.z, z1));
  const dx = P.x - nx, dz = P.z - nz, d2 = dx * dx + dz * dz;
  if (d2 < P.r * P.r) {
    if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (P.r - d) / d; P.x += dx * k; P.z += dz * k; }
    else P.x += P.r;
  }
}
function collide() {
  if (mode === "base") { baseCollide(); return; }
  if (mode === "station") { tsCollide(); return; }
  if (mode === "remodel") { remodelCollide(); return; }
  const ci = Math.floor(P.x / S), cj = Math.floor(P.z / S);
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) wallBoxes(i, j, pushOut);
  if (P.x > STX - 1 && P.x < STX + 13 && P.z > STZ - 1 && P.z < STZ + 13) {   // stairwell solids: the landing's face from below, its parapet from above, the stair rail
    if (P.y < 2.2) pushOut(STX + 7.5, STZ, STX + 12, STZ + 9); else pushOut(STX + 7.43, STZ, STX + 7.57, STZ + 9);
    pushOut(STX + 3.9, STZ + 8.95, STX + 7.5, STZ + 9.05);
  }
  if (P.x > AX && P.x < AX + BW * S && P.z > AZ && P.z < AZ + BH * S) {      // the atrium: the gallery is solid from below, the stair has a rail, and the gallery's west end a parapet
    if (P.y < GAL_H - .8) pushOut(GAL[0], GAL[1], GAL[2], GAL[3]);
    pushOut(AST[0], AST[3] - .05, AST[2], AST[3] + .05); pushOut(GAL[0] - .05, AST[3], GAL[0] + .05, GAL[3]);
  }
}
// the shaft under (x, z), as [x0, z0, x1, z1, depth]: a pit, a pit that opened later, or the atrium's opening
const pitHit = (x, z) => {
  const i = Math.floor(x / S), j = Math.floor(z / S), inside = r => x > r[0] + .1 && x < r[2] - .1 && z > r[1] + .1 && z < r[3] - .1;
  if (pit(i, j)) { const r = [(i + .5) * S - PIT_HALF, (j + .5) * S - PIT_HALF, (i + .5) * S + PIT_HALF, (j + .5) * S + PIT_HALF]; if (inside(r)) return [...r, PIT_DEPTH]; }
  for (let k = 0; k < extraPitN; k++) { const v = pitRects[EX0 + k], r = [v.x, v.y, v.z, v.w]; if (inside(r)) return [...r, PIT_DEPTH]; }
  return inside(VOID) ? [...VOID, VOID_DEPTH] : null;
};
// falling: gravity pulls the camera down the shaft, the walls keep the player inside it
let dropY = 0, fallV = 0, shaft = null;
function fall(dt) {
  fallV += 22 * dt; dropY -= fallV * dt;
  P.x = Math.max(shaft[0] + P.r, Math.min(shaft[2] - P.r, P.x));
  P.z = Math.max(shaft[1] + P.r, Math.min(shaft[3] - P.r, P.z));
  if (P.y + 1.65 + dropY < -shaft[4] + 3) respawn(shaft[4] > PIT_DEPTH
    ? "你墜入中庭的深處……<br><span style='font-size:14px'>一層又一層的樓板掠過眼前，直到什麼都看不見。</span>"
    : "你墜入漆黑的深坑……<br><span style='font-size:14px'>沒有人回報過墜入之後的事。</span>", 3800);
}

// ---------- the flickering wall: appears out of sight, once you have waited long enough ----------
const exitMesh = new THREE.Mesh(boxGeo, exitMat); exitMesh.visible = false; scene.add(exitMesh);
let exitKind = "l1";                         // what the flickering wall leads to: "l1" Level 1; "ts" Level 0.1, a plain steel sliding door with no light or sound, rare and simply walked into
function spawnExit() {
  for (let n = 0; n < 120; n++) {
    const i = 1 + Math.floor(Math.random() * (W - 2)), j = 1 + Math.floor(Math.random() * (D - 2)), d = Math.random() < .5 ? 'E' : 'S';
    if (cellType(i, j) !== N || edgeKind(d, i, j) !== 1) continue;
    const E = d === 'E', x = E ? (i + 1) * S : (i + .5) * S, z = E ? (j + .5) * S : (j + 1) * S, dx = x - P.x, dz = z - P.z, dist = Math.hypot(dx, dz);
    if (dist < 14 || dist > 45 || (dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw)) / dist > -.1) continue;   // behind you, so it never pops in view
    const rk = Math.random(); exitEdge = { d, i, j, x, z }; exitKind = rk < .18 ? "ts" : rk < .42 ? "r02" : "l1";
    exitMesh.position.set(x, H / 2, z); exitMesh.rotation.y = E ? 0 : Math.PI / 2; exitMesh.scale.set(T + .12, 1, S + T); exitMesh.visible = true;
    exitLight.position.set(x, 1.6, z);
    return true;
  }
  return false;
}
function clearExit() { exitEdge = null; exitMesh.visible = false; exitLight.intensity = 0; }
const onExit = () => exitEdge && (exitEdge.d === 'E' ? Math.abs(P.x - exitEdge.x) < .3 && Math.abs(P.z - exitEdge.z) < S / 2 : Math.abs(P.z - exitEdge.z) < .3 && Math.abs(P.x - exitEdge.x) < S / 2);

// pits open up in ordinary rooms, away from the player
function spawnPit() {
  for (let n = 0; n < 80; n++) {
    const i = Math.floor(Math.random() * W), j = Math.floor(Math.random() * D), x = (i + .5) * S, z = (j + .5) * S;
    if (cellType(i, j) !== N || Math.hypot(x - P.x, z - P.z) < 22 || DOORS.some(([, a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1) || crateAt(i, j)) continue;
    const slot = extraPitN < EXTRA_PITS ? extraPitN++ : Math.floor(Math.random() * EXTRA_PITS);
    pitRects[EX0 + slot].set(x - PIT_HALF, z - PIT_HALF, x + PIT_HALF, z + PIT_HALF);
    extraPitMeshes[slot].position.set(x, -PIT_DEPTH / 2, z); extraPitMeshes[slot].visible = true;
    return;
  }
}

// 邊緣位移: a maze district that is far out of sight may be re-carved, so a route walked earlier no longer holds.
// The arch rooms are the stable ones (they help you find your bearings) and the pit field never moves.
let shiftT = 0;
// distance from p to [lo, lo + len] on a ring of the given period: an edge district seen through a doorway counts as near
const ringD = (p, lo, len, per) => Math.min(...[-per, 0, per].map(k => Math.max(lo - p - k, 0, p + k - lo - len)));
function shiftWorld(dt, now, anom) {
  shiftT += dt; if (shiftT < 2) return; shiftT = 0;
  for (const b of BLOCKS) {
    if (b.t === ARCH || b.t === PIT || b.t === ATRIUM || now - b.last < 25 - 14 * anom) continue;
    const x0 = b.bx * BW * S, z0 = b.by * BH * S;
    if (Math.hypot(ringD(P.x, x0, BW * S, WS), ringD(P.z, z0, BH * S, DS)) > 40 - 10 * anom) { b.ver++; b.last = now; carve(b); applyDoors(); rebuild(b); }
  }
}

