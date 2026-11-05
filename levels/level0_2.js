"use strict";
// ---------- Level 0.2「重塑的混亂」: 被後室裝修公司翻新過的 Level 0 ----------
// 乍看是整修好的 Level 0：乾燥的紅地毯、白牆、通電的插座、WiFi、偶爾的洗手間。待一陣子後天花板掉落、
// 牆壁倒塌、地板塌陷，露出底下未完工的房屋；揚起的灰塵也會傷人。崩塌在通往 Level 0 的門邊停止，重新進來時一切復原。
const RX = 1200, RZ = 40, RC = 4, NX = 24, NZ = 18, RW = NX * RC, RD = NZ * RC, RH = 3;
const RM_CALM = 30, RM_SAFE = 7, RM_SINK = .55;   // quiet seconds before the collapse, collapse-free radius around each door, sunken floor depth
const REMODEL_BOXES = [];                          // the intact layout (walls + props): map and pegman landing
const remodelGroup = new THREE.Group(); remodelGroup.visible = false; scene.add(remodelGroup);
let remodelCreakT = 14;

// ---------- layout: a braided maze of partitions on a 4 m grid, generated once (the same every visit) ----------
const rmE = new Uint8Array(NX * NZ).fill(1), rmS = new Uint8Array(NX * NZ).fill(1);   // wall on a cell's east / south edge
const rmId = (i, j) => j * NX + i;
const RM_START = [0, 8], RM_REST = [[5, 2], [15, 13], [20, 6]], RM_DESK = [11, 9];
const RM_DOORS = [{ i: 0, j: 8, nx: -1, nz: 0 }, { i: NX - 1, j: 3, nx: 1, nz: 0 }, { i: 13, j: NZ - 1, nx: 0, nz: 1 }];   // the ways back to Level 0
for (const d of RM_DOORS) { d.x = RX + (d.i + .5 + d.nx * .5) * RC; d.z = RZ + (d.j + .5 + d.nz * .5) * RC; }
const rmCell = (i, j) => [RX + (i + .5) * RC, RZ + (j + .5) * RC];
const rmSafe = (x, z) => RM_DOORS.some(d => Math.hypot(x - d.x, z - d.z) < RM_SAFE);
{
  const rnd = mulberry(20702), DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], inG = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ;
  const open = (i, j, a, b) => a ? (rmE[rmId(a > 0 ? i : i - 1, j)] = 0) : (rmS[rmId(i, b > 0 ? j : j - 1)] = 0);
  const shut = (i, j, a, b) => a ? rmE[rmId(a > 0 ? i : i - 1, j)] : rmS[rmId(i, b > 0 ? j : j - 1)];
  const seen = new Uint8Array(NX * NZ), st = [RM_START]; seen[rmId(...RM_START)] = 1;
  while (st.length) {
    const [i, j] = st[st.length - 1], nb = DIRS.filter(([a, b]) => inG(i + a, j + b) && !seen[rmId(i + a, j + b)]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[Math.floor(rnd() * nb.length)]; open(i, j, a, b); seen[rmId(i + a, j + b)] = 1; st.push([i + a, j + b]);
  }
  for (let k = 0; k < NX * NZ; k++) { if (rnd() < .55) rmE[k] = 0; if (rnd() < .55) rmS[k] = 0; }   // braid: Level 0 is far more open than a maze
  for (const [i, j] of RM_REST) { rmE[rmId(i, j)] = rmE[rmId(i - 1, j)] = rmS[rmId(i, j - 1)] = 1; rmS[rmId(i, j)] = 0; }   // restrooms: walled in but for a south doorway
  for (;;) {                                  // reopen anything the restrooms cut off
    const r = new Uint8Array(NX * NZ), q = [RM_START]; r[rmId(...RM_START)] = 1;
    while (q.length) { const [i, j] = q.pop(); for (const [a, b] of DIRS) if (inG(i + a, j + b) && !r[rmId(i + a, j + b)] && !shut(i, j, a, b)) { r[rmId(i + a, j + b)] = 1; q.push([i + a, j + b]); } }
    let fixed = false;
    for (let k = 0; k < NX * NZ && !fixed; k++) if (r[k]) for (const [a, b] of DIRS) { const i = k % NX, j = (k - i) / NX; if (inG(i + a, j + b) && !r[rmId(i + a, j + b)]) { open(i, j, a, b); fixed = true; break; } }
    if (!fixed) break;
  }
}
// interior partitions: these can fall. state 0 intact, 1 bare studs, 2 gone, 3 old Level 0 wallpaper, 4 about to fall
const RM_WALLS = [], RM_PERIM = [], RM_PROPS = [];
{
  const wr = mulberry(77);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (i < NX - 1 && rmE[rmId(i, j)]) RM_WALLS.push({ x: RX + (i + 1) * RC, z: RZ + (j + .5) * RC, v: true });
    if (j < NZ - 1 && rmS[rmId(i, j)]) RM_WALLS.push({ x: RX + (i + .5) * RC, z: RZ + (j + 1) * RC, v: false });
  }
  for (const w of RM_WALLS) {
    const hx = w.v ? .1 : RC / 2 + .1, hz = w.v ? RC / 2 + .1 : .1;
    w.box = [w.x - hx, w.z - hz, w.x + hx, w.z + hz]; w.outlet = wr() < .22; w.state = 0; REMODEL_BOXES.push(w.box);
  }
  const door = (d, i, j) => RM_DOORS.some(o => o.i === i && o.j === j && o.nx === d[0] && o.nz === d[1]);
  for (let i = 0; i < NX; i++) {
    if (!door([0, -1], i, 0)) RM_PERIM.push({ x: RX + (i + .5) * RC, z: RZ, v: false });
    if (!door([0, 1], i, NZ - 1)) RM_PERIM.push({ x: RX + (i + .5) * RC, z: RZ + RD, v: false });
  }
  for (let j = 0; j < NZ; j++) {
    if (!door([-1, 0], 0, j)) RM_PERIM.push({ x: RX, z: RZ + (j + .5) * RC, v: true });
    if (!door([1, 0], NX - 1, j)) RM_PERIM.push({ x: RX + RW, z: RZ + (j + .5) * RC, v: true });
  }
  for (const [i, j] of RM_REST) { const [cx, cz] = rmCell(i, j); RM_PROPS.push([cx - 1.25, cz - 2, cx - .55, cz - 1.15], [cx + 1.55, cz - .95, cx + 2, cz - .25]); }   // toilet, sink
  const [dx, dz] = rmCell(...RM_DESK); RM_PROPS.push([dx - .95, dz - .45, dx + .95, dz + .45]);                                                                       // the site desk
  REMODEL_BOXES.push(...RM_PROPS);
}
const RM_ROUTERS = [[RX + 30, RZ + .13, 0], [RX + 74, RZ + .13, 0], [RX + 22, RZ + RD - .13, Math.PI]];
const RM_ACTS = [
  ...RM_DOORS.map(d => ({ x: d.x - d.nx * .5, z: d.z - d.nz * .5, r: 2, tip: "【按 E 或走進門】推開這扇門，回到 Level 0", act: () => leaveRemodel() })),
  { x: rmCell(...RM_DESK)[0], z: rmCell(...RM_DESK)[1], r: 1.9, tip: "【按 E】翻看施工桌上的工務夾板", act: () => toggleDoc(true) },
  ...RM_ROUTERS.map(([x, z]) => ({ x, z, r: 1.8, tip: "【按 E】連上牆上的 WiFi 路由器", act: () => say("「BRC-Remodel_5G」訊號滿格。可是只打得開一個頁面：後室裝修公司的首頁，橫幅寫著——真正的整潔來自於裝潢。", 6500) })),
  ...RM_REST.map(([i, j]) => { const [cx, cz] = rmCell(i, j); return { x: cx + 1.4, z: cz - .6, r: 1.4, tip: "【按 E】打開水龍頭", act: () => { if (typeof soundDrink === "function") soundDrink(); say("清水嘩嘩地流出來，冰涼乾淨。在 Level 0 可找不到能用的洗手台。", 4500); } }; }),
];
const REMODEL_PLACES = [
  ["入口門 · 回 Level 0", RM_DOORS[0].x + 4, RM_DOORS[0].z], ["東側門 · 回 Level 0", RM_DOORS[1].x - 5, RM_DOORS[1].z], ["南側門 · 回 Level 0", RM_DOORS[2].x, RM_DOORS[2].z - 3],
  ...RM_REST.map(([i, j]) => ["洗手間", ...rmCell(i, j)]),
  ["施工桌 · 工務夾板", ...rmCell(...RM_DESK)],
  ["WiFi 路由器", RM_ROUTERS[0][0], RM_ROUTERS[0][1] + 2],
];

function remodelCollide() {
  P.x = Math.max(RX + .4, Math.min(RX + RW - .4, P.x));
  P.z = Math.max(RZ + .4, Math.min(RZ + RD - .4, P.z));
  for (const w of RM_WALLS) if (w.state !== 2 && Math.abs(w.x - P.x) < 3 && Math.abs(w.z - P.z) < 3) pushOut(...w.box);
  for (const b of RM_PROPS) pushOut(...b);
}
const remodelStand = (x, z) => x > RX + .6 && x < RX + RW - .6 && z > RZ + .6 && z < RZ + RD - .6 && !REMODEL_BOXES.some(([a, b, c, d]) => x > a - P.r && x < c + P.r && z > b - P.r && z < d + P.r);

// ---------- live state: everything the collapse changes, put back by resetRemodel() on every entry ----------
const rmSunk = new Set(), rmHoles = new Set(), rmAnims = [], rmPuffs = [];
let rmHP = 100, rmHurtT = 99, rmShake = 0, rmDust = 0, rmCoughT = 0, rmT = 0, rmNextEv = 0, rmStory = 0, rmSafeTold = false, rmSaved = null;
const remodelFloorH = (x, z) => rmSunk.has(rmId(Math.floor((x - RX) / RC), Math.floor((z - RZ) / RC))) ? -RM_SINK : 0;
const remodelHud = () => `LEVEL 0.2 · 重塑的混亂 · 體力 ${Math.max(0, Math.ceil(rmHP))}${rmT > RM_CALM ? " · ⚠ 結構正在崩塌" : ""} · E 互動`;

let RMB = null;   // meshes and materials, made on first entry
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _up4 = new THREE.Vector3(0, 1, 0);
const rmSet = (im, k, x, y, z, ry, sx = 1, sy = 1, sz = 1) => { _p4.set(x, y, z); _q4.setFromAxisAngle(_up4, ry); _s4.set(sx, sy, sz); im.setMatrixAt(k, _m4.compose(_p4, _q4, _s4)); im.instanceMatrix.needsUpdate = true; };

function buildRemodel() {
  if (RMB) return;
  // ---- textures (a 4 m wall face is 512 px wide; the maroon rail sits 0.5 m up, like the photos) ----
  const wallDraw = outlet => (g, w, h) => {
    g.fillStyle = "#ece8dc"; g.fillRect(0, 0, w, h); noise(g, w, 5000, .05);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,250,.08)"); grd.addColorStop(1, "rgba(90,80,60,.12)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const ry = h * (1 - .5 / RH); g.fillStyle = "#6c2622"; g.fillRect(0, ry - 5, w, 10); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, ry - 5, w, 2);
    if (outlet) {
      const ox = w * .7, oy = h * (1 - .3 / RH);
      g.fillStyle = "#e4e2d8"; g.fillRect(ox - 9, oy - 15, 18, 30); g.strokeStyle = "#8c8a80"; g.lineWidth = 1.5; g.strokeRect(ox - 9, oy - 15, 18, 30);
      g.fillStyle = "#2a2a2a"; for (const dy of [-7, 7]) { g.fillRect(ox - 5, oy + dy - 3, 2, 5); g.fillRect(ox + 3, oy + dy - 3, 2, 5); }
    }
  };
  const wallT = baseTex(512, 384, wallDraw(false)), outT = baseTex(512, 384, wallDraw(true));
  const carpetT = baseTex(256, 256, (g, w, h) => {
    g.fillStyle = "#5f2f2a"; g.fillRect(0, 0, w, h); noise(g, w, 9000, .16);
    g.fillStyle = "rgba(40,10,8,.18)"; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping; carpetT.repeat.set(3, 3);
  const ceilT = baseTex(256, 256, (g, w, h) => {      // 2 m of drop ceiling: 4 x 4 tiles of 50 cm
    g.fillStyle = "#efede6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,115,100,.22)"; for (let n = 0; n < 2600; n++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    g.fillStyle = "#c9c6bc"; for (let k = 0; k <= 4; k++) { g.fillRect(k * w / 4 - 2, 0, 4, h); g.fillRect(0, k * h / 4 - 2, w, 4); }
  });
  ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping; ceilT.repeat.set(RW / 2, RD / 2);
  const tileT = baseTex(128, 128, (g, w, h) => {
    g.fillStyle = "#e6ebec"; g.fillRect(0, 0, w, h); g.fillStyle = "#a9b5b8";
    for (let k = 0; k <= 8; k++) { g.fillRect(k * w / 8 - 1, 0, 2, h); g.fillRect(0, k * h / 8 - 1, w, 2); }
  });
  tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping; tileT.repeat.set(3, 3);
  const signT = baseTex(256, 80, (g, w, h) => {
    g.fillStyle = "#24476b"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 34px sans-serif"; g.textAlign = "center";
    g.fillText("洗手間 WC", w / 2, 52);
  });
  const clipT = baseTex(128, 160, (g, w, h) => {
    g.fillStyle = "#f6f4ea"; g.fillRect(0, 0, w, h); g.fillStyle = "#3b3866"; g.fillRect(0, 0, w, 26);
    g.fillStyle = "#d3ae00"; g.font = "bold 12px sans-serif"; g.fillText("BACKROOMS REMODELING", 6, 17);
    g.fillStyle = "#555"; for (let y = 40; y < h - 8; y += 11) g.fillRect(8, y, 40 + Math.random() * 70, 3);
  });
  // ---- materials ----
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: .9 }), outM = new THREE.MeshStandardMaterial({ map: outT, roughness: .9 });
  const carpetM = new THREE.MeshStandardMaterial({ map: carpetT, roughness: 1 });
  const ceilM = new THREE.MeshStandardMaterial({ map: ceilT, roughness: .9 }), ceilTileM = flat(0xeceae2);
  const lightM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfffcf2).multiplyScalar(2.6) });
  const decalM = glow(0xfff4e0); decalM.opacity = .28;
  const studM = flat(0xc8a06a), plyM = flat(0x9c7c52), joistM = flat(0x6e5232), pitM = new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 1, side: THREE.DoubleSide });
  const holeM = flat(0x1a1712), porcelainM = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .25 }), chromeM = new THREE.MeshStandardMaterial({ color: 0xb0b0aa, roughness: .3, metalness: .8 });
  const doorM = flat(0xe6e1d4), brassM = new THREE.MeshStandardMaterial({ color: 0xc9a040, roughness: .35, metalness: .8 });
  const vestM = wallMats[0].map(m => { const c = m.clone(); c.side = THREE.BackSide; return c; });   // beyond each door: the yellow of Level 0
  const ledM = new THREE.MeshBasicMaterial({ color: 0x40ff70 });
  const G = {
    wall: new THREE.BoxGeometry(RC + .2, RH, .2), panel: new THREE.BoxGeometry(RC, RH, .1), stud: new THREE.BoxGeometry(.05, RH - .1, .1), plate: new THREE.BoxGeometry(RC, .05, .1),
    tile: new THREE.BoxGeometry(.5, .02, .5), hole: new THREE.PlaneGeometry(.5, .5).rotateX(Math.PI / 2), sub: new THREE.PlaneGeometry(RC, RC).rotateX(-Math.PI / 2),
    pitSide: new THREE.PlaneGeometry(RC, RM_SINK), joist: new THREE.BoxGeometry(.08, .2, RC), rag: new THREE.PlaneGeometry(RC * .8, RC * .7).rotateX(-Math.PI / 2),
  };
  const add = (geo, mat, x, y, z, ry = 0, parent = remodelGroup) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);

  // ---- walls: instanced; a fallen one is hidden and replaced by what was behind it ----
  const nOut = RM_WALLS.filter(w => w.outlet).length;
  const wallsPlain = new THREE.InstancedMesh(G.wall, wallM, RM_WALLS.length - nOut + RM_PERIM.length), wallsOut = new THREE.InstancedMesh(G.wall, outM, Math.max(1, nOut));
  remodelGroup.add(wallsPlain, wallsOut);
  let kp = 0, ko = 0;
  for (const w of RM_WALLS) { w.im = w.outlet ? wallsOut : wallsPlain; w.k = w.outlet ? ko++ : kp++; }
  for (const w of RM_PERIM) rmSet(wallsPlain, kp++, w.x, RH / 2, w.z, w.v ? Math.PI / 2 : 0);

  // ---- floor (one carpet square per cell, so a cell can cave in) and ceiling ----
  const carpet = new THREE.InstancedMesh(flatGeo, carpetM, NX * NZ); remodelGroup.add(carpet);
  add(new THREE.PlaneGeometry(RW, RD).rotateX(Math.PI / 2), ceilM, RX + RW / 2, RH, RZ + RD / 2);
  const lit = [], lr = mulberry(311);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (lr() > .28) lit.push([i, j]);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .03, .5), lightM, lit.length), decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), decalM, lit.length);
  const decalOf = new Map();
  lit.forEach(([i, j], k) => { const [x, z] = rmCell(i, j); rmSet(lights, k, x, RH - .015, z + .25, 0); decalOf.set(rmId(i, j), k); });
  remodelGroup.add(lights, decals);

  // ---- doors back to Level 0: a fresh white door, ajar, and the yellow of Level 0 behind it ----
  for (const d of RM_DOORS) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = Math.atan2(d.nx, d.nz); remodelGroup.add(g);
    for (const s of [-1, 1]) { box(1.55, RH, .2, wallM, s * 1.325, RH / 2, 0, 0, g); box(.08, 2.2, .26, frameMat, s * .59, 1.1, 0, 0, g); }
    box(1.1, RH - 2.2, .2, wallM, 0, (RH + 2.2) / 2, 0, 0, g); box(1.26, .08, .26, frameMat, 0, 2.24, 0, 0, g);
    const hinge = new THREE.Group(); hinge.position.set(-.55, 0, .12); hinge.rotation.y = -1.15; g.add(hinge);
    box(1.04, 2.15, .05, doorM, .52, 1.075, 0, 0, hinge); box(.06, .06, .12, brassM, .92, 1.0, 0, 0, hinge);
    add(new THREE.BoxGeometry(2.6, RH, 2.4), vestM, 0, RH / 2, 1.3, 0, g);
    const gl = add(new THREE.PlaneGeometry(3, 3), glow(0xffe890), 0, 1.4, 2.4, Math.PI, g); gl.material.opacity = .45;
  }

  // ---- restrooms: tiled floor, toilet, sink, mirror, a sign over the doorway ----
  for (const [i, j] of RM_REST) {
    const [cx, cz] = rmCell(i, j);
    add(new THREE.PlaneGeometry(RC - .2, RC - .2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tileT, roughness: .35 }), cx, .008, cz);
    box(.42, .42, .62, porcelainM, cx - .9, .21, cz - 1.55); box(.46, .5, .2, porcelainM, cx - .9, .62, cz - 1.82); box(.44, .04, .5, porcelainM, cx - .9, .44, cz - 1.5);
    box(.15, .78, .15, porcelainM, cx + 1.8, .39, cz - .6); box(.42, .14, .55, porcelainM, cx + 1.75, .84, cz - .6); add(new THREE.CylinderGeometry(.015, .015, .2, 6), chromeM, cx + 1.9, .98, cz - .6);
    add(new THREE.PlaneGeometry(.7, .9), new THREE.MeshStandardMaterial({ color: 0x9fb8c2, roughness: .05, metalness: .9 }), cx + RC / 2 - .11, 1.55, cz - .6, -Math.PI / 2);
    add(new THREE.PlaneGeometry(1, .31), new THREE.MeshBasicMaterial({ map: signT }), cx, 2.7, cz + RC / 2 + .02);
  }

  // ---- the site desk: a folding table with the work crew's clipboard, paint, a stepladder ----
  {
    const [cx, cz] = rmCell(...RM_DESK);
    box(1.8, .04, .8, flat(0xd8d4c8), cx, .74, cz); for (const a of [-.8, .8]) for (const b of [-.32, .32]) box(.04, .72, .04, chromeM, cx + a, .36, cz + b);
    box(.24, .015, .32, flat(0x8a6238), cx - .2, .77, cz); add(new THREE.PlaneGeometry(.22, .28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: clipT }), cx - .2, .779, cz + .01);
    box(.1, .025, .04, chromeM, cx - .2, .785, cz - .14);
    RMB_hint = add(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), glow(0xffe08a), cx - .2, .785, cz);
    for (let k = 0; k < 3; k++) { add(new THREE.CylinderGeometry(.15, .15, .36, 14), flat(0xdedcd4), cx + .5 + k * .34, .18, cz + .75); add(new THREE.CylinderGeometry(.152, .152, .02, 14), flat(k ? 0xece8dc : 0x6c2622), cx + .5 + k * .34, .37, cz + .75); }
    for (const s of [-1, 1]) { const l = box(.5, 2.1, .05, flat(0xb8b8b0), cx - 1.6, 1.0, cz + s * .3); l.rotation.x = s * .17; }
  }

  // ---- WiFi routers ----
  const leds = [];
  for (const [x, z, ry] of RM_ROUTERS) {
    const g = new THREE.Group(); g.position.set(x, 2.1, z); g.rotation.y = ry; remodelGroup.add(g);
    box(.26, .18, .04, flat(0x1d1d1f), 0, 0, 0, 0, g); for (const s of [-1, 1]) box(.015, .2, .015, flat(0x1d1d1f), s * .1, .18, 0, 0, g);
    leds.push(box(.02, .02, .01, ledM, -.06, -.04, .025, 0, g), box(.02, .02, .01, ledM, 0, -.04, .025, 0, g));
  }

  const dyn = new THREE.Group(); remodelGroup.add(dyn);
  RMB = { G, wallM, ceilTileM, studM, plyM, joistM, pitM, holeM, carpetM, wallsPlain, wallsOut, carpet, decals, decalOf, lit, leds, dyn };
}
let RMB_hint = null;

// ---------- reset: re-entering finds Level 0.2 whole again, as if nothing had happened ----------
function resetRemodel() {
  const { dyn, carpet, decals, lit } = RMB;
  for (const c of [...dyn.children]) { c.traverse(o => o.isSprite && o.material.dispose()); dyn.remove(c); }
  for (const w of RM_WALLS) { w.state = 0; rmSet(w.im, w.k, w.x, RH / 2, w.z, w.v ? Math.PI / 2 : 0); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const [x, z] = rmCell(i, j); rmSet(carpet, rmId(i, j), x, 0, z, 0, RC, 1, RC); }
  lit.forEach(([i, j], k) => { const [x, z] = rmCell(i, j); rmSet(decals, k, x, .012, z, 0); });
  rmSunk.clear(); rmHoles.clear(); rmAnims.length = 0; rmPuffs.length = 0;
  rmHP = 100; rmHurtT = 99; rmShake = 0; rmDust = 0; rmT = 0; rmNextEv = 0; rmStory = 0; rmSafeTold = false;
  AMB[REMODEL_ZT][1] = .011; AMB[REMODEL_ZT][2] = 3.2;
}

// ---------- the collapse ----------
const rmVol = (x, z) => Math.max(.12, 1 - Math.hypot(P.x - x, P.z - z) / 30);
const rmCrash = (x, z, k) => { const v = k * rmVol(x, z); noiseBurst(150, .7, .55 * v, 1, .8, 0); noiseBurst(1300, 1.2, .2 * v, 3, .12, .09); };
const rmCreak = (x, z) => noiseBurst(420 + Math.random() * 220, 9, .14 * rmVol(x, z), 3, .14, .17);
function rmHurt(n, text) {
  if (state !== "play") return;
  rmHP -= n; rmHurtT = 0; rmShake = .5; redK = Math.max(redK, .75); say(text, 3200);
  if (rmHP <= 0) rmKnockout();
}
function rmKnockout() {
  if (state !== "play") return;   // a panel and the dust can both finish you in one frame
  rmHP = 0; state = "wait"; fadeEl.innerHTML = "石膏板與灰塵把你整個埋了進去……<br>醒來時，你躺在 Level 0 潮濕的地毯上。"; fadeEl.style.opacity = 1;
  setTimeout(() => { rmBack(); say("你回到了 Level 0。渾身都是白色的石膏粉。", 5000); }, 3500);
}
function dustSprite(x, y, z, sc, op) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdedad0, transparent: true, opacity: op, depthWrite: false }));
  s.position.set(x, y, z); s.scale.setScalar(sc); return s;
}
function puff(x, z, size) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let k = 0; k < 5; k++) { const s = dustSprite((Math.random() - .5) * size, .3 + Math.random() * size, (Math.random() - .5) * size, size, .6); s.userData.base = .8 + Math.random() * .6; g.add(s); }
  RMB.dyn.add(g); rmPuffs.push({ g, x, z, size, t: 0 });
}
// a ceiling tile sags, dust trickles out, then it drops: stand under it and it hits you
function dropTile(x, z, delay) {
  let lx = x - RX, lz = z - RZ;
  if (Math.abs(lx % RC - 2) < .6 && Math.abs(lz % RC - 2.25) < .4) lx += 1;   // not where a light panel hangs
  x = RX + (Math.floor(lx / .5) + .5) * .5; z = RZ + (Math.floor(lz / .5) + .5) * .5;
  const key = Math.round(x * 2) * 10000 + Math.round(z * 2);
  if (rmHoles.has(key) || x < RX || x > RX + RW || z < RZ || z > RZ + RD) return;
  rmHoles.add(key); rmCreak(x, z);
  const { dyn, G } = RMB, tile = new THREE.Mesh(G.tile, RMB.ceilTileM), warn = dustSprite(x, RH - .4, z, .6, 0);
  tile.position.set(x, RH - .02, z); dyn.add(tile, warn);
  let t = 0, y = RH - .02, vy = 0;
  rmAnims.push(dt => {
    t += dt;
    if (t < delay) { const k = t / delay; tile.position.y = RH - .02 - .08 * k; tile.rotation.z = .12 * k; warn.material.opacity = .5 * k; warn.position.y = RH - .4 - .6 * k; warn.scale.setScalar(.6 + k); return true; }
    if (warn.parent) { dyn.remove(warn); warn.material.dispose(); const h = new THREE.Mesh(G.hole, RMB.holeM); h.position.set(x, RH - .012, z); dyn.add(h); y = tile.position.y; }
    vy += 9.8 * dt; y -= vy * dt; tile.rotation.x += dt * 2.5; tile.rotation.z += dt * 1.4;
    const fy = remodelFloorH(x, z) + .02;
    if (y > fy) { tile.position.y = y; return true; }
    tile.position.y = fy; tile.rotation.set(0, Math.random() * 3, 0); rmCrash(x, z, .45); puff(x, z, 1);
    if (Math.hypot(P.x - x, P.z - z) < .75) rmHurt(28, "一塊天花板正砸在你頭上！");
    return false;
  });
}
// a partition shudders, then topples like a felled tree, showing what was behind the drywall
function collapseWall(w) {
  w.state = 4; rmSet(w.im, w.k, 0, -50, 0, 0, 0, 0, 0); rmCreak(w.x, w.z);
  const { dyn, G } = RMB, ry = w.v ? Math.PI / 2 : 0, r = Math.random();
  const reveal = r < .45 ? 1 : r < .7 ? 3 : 2;
  const back = new THREE.Group(); back.position.set(w.x, 0, w.z); back.rotation.y = ry; dyn.add(back);
  if (reveal === 3) { const m = new THREE.Mesh(G.wall, wallMats[Math.floor(Math.random() * wallMats.length)]); m.position.y = RH / 2; back.add(m); }
  else {
    for (const y of [.025, RH - .025]) { if (reveal === 2 && y > 1) continue; const m = new THREE.Mesh(G.plate, RMB.studM); m.position.y = y; back.add(m); }
    for (let k = 0; k <= 5; k++) {
      if (reveal === 2 && k % 3) continue;
      const m = new THREE.Mesh(G.stud, RMB.studM), u = -RC / 2 + .05 + k * (RC - .1) / 5; m.position.set(u, RH / 2, 0);
      if (reveal === 2) { m.scale.y = .25 + Math.random() * .3; m.position.y = (RH - .1) * m.scale.y / 2; m.rotation.z = (Math.random() - .5) * .5; }   // splintered stumps
      back.add(m);
    }
  }
  const pivot = new THREE.Group(); pivot.position.set(w.x, .05, w.z); pivot.rotation.order = "YXZ"; pivot.rotation.y = ry; dyn.add(pivot);
  const panel = new THREE.Mesh(G.panel, RMB.wallM); panel.position.y = RH / 2; pivot.add(panel);
  const side = Math.random() < .5 ? 1 : -1; let t = 0, ang = .03, av = 0;
  rmAnims.push(dt => {
    t += dt;
    if (t < 1.2) { pivot.rotation.x = side * .035 * Math.sin(t * 38) * (t / 1.2); return true; }
    av += 1.5 * 9.8 / RH * Math.sin(ang) * dt; ang += av * dt;
    if (ang < Math.PI / 2) { pivot.rotation.x = side * ang; return true; }
    pivot.rotation.x = side * Math.PI / 2; w.state = reveal; rmShake = Math.max(rmShake, .25);
    const nx = w.v ? side : 0, nz = w.v ? 0 : side;   // where the panel landed, as a world direction
    rmCrash(w.x, w.z, 1); for (const k of [.5, 1.6, 2.6]) puff(w.x + nx * k, w.z + nz * k, 1.5);
    const dx = P.x - w.x, dz = P.z - w.z, along = w.v ? dz : dx, perp = (w.v ? dx : dz) * side;
    if (Math.abs(along) < RC / 2 && perp > 0 && perp < RH + .2) rmHurt(40, "整面隔間牆朝你倒了下來！");
    return false;
  });
  for (let k = 0; k < 2; k++) { const a = (Math.random() - .5) * RC; dropTile(w.x + (w.v ? 0 : a), w.z + (w.v ? a : 0), 1.4 + Math.random()); }   // the ceiling grid it held up goes with it
}
// a cell of floor caves in onto the joists of the unfinished house below
function sinkCell(i, j) {
  const id = rmId(i, j), [x, z] = rmCell(i, j), { dyn, G } = RMB;
  rmSunk.add(id); rmSet(RMB.carpet, id, 0, -50, 0, 0, 0, 0, 0);
  const k = RMB.decalOf.get(id); if (k !== undefined) rmSet(RMB.decals, k, 0, -50, 0, 0, 0, 0, 0);
  const g = new THREE.Group(); g.position.set(x, 0, z); dyn.add(g);
  const sub = new THREE.Mesh(G.sub, RMB.plyM); sub.position.y = -RM_SINK; g.add(sub);
  for (const a of [-1.3, 0, 1.3]) { const jm = new THREE.Mesh(G.joist, RMB.joistM); jm.position.set(a, -RM_SINK + .1, 0); g.add(jm); }
  for (let s = 0; s < 4; s++) { const p = new THREE.Mesh(G.pitSide, RMB.pitM), a = s * Math.PI / 2; p.position.set(Math.sin(a) * RC / 2, -RM_SINK / 2, Math.cos(a) * RC / 2); p.rotation.y = a; g.add(p); }
  const rag = new THREE.Mesh(G.rag, RMB.carpetM); rag.position.y = -.02; g.add(rag);
  let t = 0;
  rmAnims.push(dt => { t += dt; const kk = Math.min(1, t / .45); rag.position.y = -.02 - (RM_SINK - .2) * kk * kk; rag.rotation.z = .12 * kk; rag.rotation.x = -.08 * kk; return kk < 1; });
  rmCrash(x, z, .9); puff(x, z, 2);
  if (Math.floor((P.x - RX) / RC) === i && Math.floor((P.z - RZ) / RC) === j) rmHurt(15, "腳下的地板突然塌了下去！");
}
function rmTarget(near) {
  for (let n = 0; n < 8; n++) {
    const a = Math.random() * Math.PI * 2, r = near ? Math.random() * 1.1 : 3 + Math.random() * 12, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
    if (x > RX + 1 && x < RX + RW - 1 && z > RZ + 1 && z < RZ + RD - 1 && !rmSafe(x, z)) return [x, z];
  }
  return null;
}
function rmEvent() {
  const r = Math.random(), p = rmTarget(false);
  if (r < .12 && p) {
    const i = Math.floor((p[0] - RX) / RC), j = Math.floor((p[1] - RZ) / RC), id = rmId(i, j), [cx, cz] = rmCell(i, j);
    if (!rmSunk.has(id) && !RM_REST.some(c => c[0] === i && c[1] === j) && !(RM_DESK[0] === i && RM_DESK[1] === j) && !rmSafe(cx, cz)) return sinkCell(i, j);
  }
  if (r < .42 && p) {
    let best = null, bd = 9;
    for (const w of RM_WALLS) { const d = Math.hypot(w.x - p[0], w.z - p[1]); if (w.state === 0 && d < bd && !rmSafe(w.x, w.z)) { best = w; bd = d; } }
    if (best) return collapseWall(best);
  }
  const near = Math.random() < .3, q = near ? rmTarget(true) : p;
  if (q) dropTile(q[0], q[1], near ? 1.3 : .8);
  if (Math.random() < .5) { const s = rmTarget(false); if (s) dropTile(s[0], s[1], 1 + Math.random()); }
}

// ---------- per-frame: the collapse, dust, injuries, prompts ----------
window.remodelInteract = {
  nearest() {
    let best = null, bd = 1e9;
    for (const a of RM_ACTS) { const d = Math.hypot(P.x - a.x, P.z - a.z); if (d < a.r && d < bd) { best = a; bd = d; } }
    return best;
  },
  onKeyE() { if (state === "play") this.nearest()?.act(); },
  onTick(dt, t) {
    if (state !== "play") return;
    rmT += dt;
    if (rmStory === 0 && rmT > 10) { rmStory = 1; say("空氣裡飄著新油漆和石膏粉的味道。燈管的嗡鳴比 Level 0 輕得多，插座裡甚至有電。", 6000); }
    if (rmStory === 1 && rmT > RM_CALM) { rmStory = 2; rmCreak(P.x, P.z); say("頭頂傳來「咔」的一聲脆響——吊頂的龍骨正在變形。", 5000); }
    if (rmT > RM_CALM) {
      rmNextEv -= dt;
      if (rmNextEv <= 0) { rmEvent(); rmNextEv = Math.max(.8, 5 - (rmT - RM_CALM) * .04) * (.6 + Math.random() * .8); }
      if (!rmSafeTold && rmSafe(P.x, P.z)) { rmSafeTold = true; say("門邊出奇地安靜。崩塌似乎不會蔓延到通往 Level 0 的門口。", 5000); }
    }
    for (let k = rmAnims.length; k--;) if (!rmAnims[k](dt)) rmAnims.splice(k, 1);
    let exp = 0;
    for (let k = rmPuffs.length; k--;) {
      const f = rmPuffs[k]; f.t += dt; const a = f.t / 9;
      if (a >= 1) { f.g.traverse(o => o.isSprite && o.material.dispose()); RMB.dyn.remove(f.g); rmPuffs.splice(k, 1); continue; }
      f.g.position.y += dt * .06;
      for (const s of f.g.children) { s.scale.setScalar(f.size * s.userData.base * (1.2 + 3 * a)); s.material.opacity = .6 * (1 - a) ** 1.5; }
      exp += Math.max(0, 1 - Math.hypot(P.x - f.x, P.z - f.z) / (f.size * 2.4)) * (1 - a);
    }
    rmDust += (Math.min(1, exp) - rmDust) * Math.min(1, dt * 1.5);
    AMB[REMODEL_ZT][1] = .011 + Math.min(.012, Math.max(0, rmT - RM_CALM) * .0001) + rmDust * .09;   // the haze thickens as the place comes down
    AMB[REMODEL_ZT][2] = 3.2 - rmDust * .8;
    if (state !== "play") return;
    if (rmDust > .35) {
      rmHP -= dt * 10 * rmDust; rmHurtT = 0;
      if ((rmCoughT -= dt) <= 0) { rmCoughT = 1.8 + Math.random() * 1.5; noiseBurst(650, 1.4, .2, 2, .14, .2); say("嗆人的石膏粉塵灌進喉嚨……快離開這團灰！", 2000); }
      if (rmHP <= 0) return rmKnockout();
    }
    if ((rmHurtT += dt) > 5) rmHP = Math.min(100, rmHP + dt * 5);
    rmShake = Math.max(0, rmShake - dt); dropY = Math.sin(t * 70) * .08 * rmShake;
    for (const [k, l] of RMB.leds.entries()) l.visible = Math.sin(t * (7 + k * 3)) > -.3;
    if (RMB_hint) RMB_hint.material.opacity = .25 + .2 * Math.sin(t * 3);
    const a = this.nearest();
    if (a && !docOpen) say(a.tip, 1200);
    for (const d of RM_DOORS) if (Math.hypot(P.x - d.x, P.z - d.z) < .7) return leaveRemodel();
  }
};

function rmBack() {
  enterMap(); [P.x, P.z, P.yaw] = rmSaved || [SPAWN[0], SPAWN[1], 0]; P.y = 0; P.pitch = 0; dropY = 0; fallV = 0;
}
function enterRemodel() {
  buildRemodel(); resetRemodel();
  rmSaved = mode === "map" ? [P.x, P.z, P.yaw] : [SPAWN[0], SPAWN[1], 0];
  mode = "remodel"; hemi.groundColor.set(0xd9d4ca); remodelGroup.visible = true;
  baseGroup.visible = tsGroup.visible = false; floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsFar(120);
  const [fc, fd, hi, hc] = AMB[REMODEL_ZT]; scene.fog.color.set(fc); scene.fog.density = fd; hemi.color.set(hc); hemi.intensity = hi;
  const d = RM_DOORS[0]; P.x = d.x + 1.6; P.z = d.z; P.y = 0; P.yaw = -Math.PI / 2; P.pitch = 0; dropY = 0; fallV = 0;
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 0.2 · 重塑的混亂 ——像是被徹底翻新過的 Level 0：地毯是乾的，牆刷成了白色。", 6000);
}
function leaveRemodel() {
  if (state !== "play") return;
  state = "wait"; fadeEl.innerHTML = "你推開門，身後的崩塌聲戛然而止……<br>熟悉的黃色走廊又回來了。"; fadeEl.style.opacity = 1;
  setTimeout(() => { rmBack(); say("你回到了 Level 0。", 4000); }, 2200);
}

function buildRemodelMap() {
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), wh = 1.6, cx = RX + RW / 2, cz = RZ + RD / 2;
  inst(mapWorld, flatGeo, mat(0x7a2a24), [[cx, 0, cz, 0, RW, 1, RD]]);
  inst(mapWorld, boxGeo, mat(0xf5f4ef), RM_PERIM.map(w => [w.x, wh / 2, w.z, 0, w.v ? .3 : RC, wh / H, w.v ? RC : .3]));
  inst(mapWorld, boxGeo, mat(0xdcdad2), REMODEL_BOXES.map(([a, b, c, d]) => [(a + c) / 2, wh / 2, (b + d) / 2, 0, c - a, wh / H, d - b]));
  inst(mapWorld, flatGeo, mat(0xc9b44a), RM_DOORS.map(d => [d.x + d.nx * 1.2, .02, d.z + d.nz * 1.2, 0, d.nx ? 2.4 : 2.6, 1, d.nx ? 2.6 : 2.4]));
}
