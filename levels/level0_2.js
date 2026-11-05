"use strict";
// ---------- Level 0.2「重塑的混亂」: 後室裝修公司翻新過的 Level 0 — 示範展廳與豆腐渣工程 ----------
// 一座 128 m × 96 m 的企業樣板展廳：酒紅地毯、白牆、現代客廳、豪華廚房、純金馬桶、通電插座、WiFi 與杏仁水飲水機。
// 背地裡全是偷工減料：裂開的石膏板後面是 Level 0 的黃壁紙，還有裸露的木龍骨、塌陷的地板、無底衣櫃、釘死的假門。
// 待上一陣子後（RM_CALM 秒）天花板瓷磚開始掉落、隔間牆倒塌、地板塌陷，揚起的石膏粉塵會傷人；
// 崩塌在通往 Level 0 的門邊停止（RM_SAFE），四扇出口門隨時可回 Level 0，重新進來時一切復原。
// 座標：展廳左上角在 (RX, RZ)；3 × 3 個展區，欄 x 0..40 / 40..84 / 84..128，列 z 0..28 / 28..64 / 64..96（相對 RX, RZ）。

const RX = 1200, RZ = 40, RC = 4, NX = 32, NZ = 24, RW = NX * RC, RD = NZ * RC, RH = 3.4;
const RM_CALM = 60, RM_SAFE = 7, RM_SINK = .55;   // quiet seconds before the collapse, collapse-free radius round each door, sunken floor depth
const REMODEL_BOXES = [];                          // the intact layout (walls + furniture): the map and pegman landing
const RM_SOLID = [];                               // what never falls: perimeter, furniture, display walls
const RM_WALLS = [];                               // interior partitions, ≤4 m panels that can fall: {x, z, v, len, mesh, box, state}
const remodelGroup = new THREE.Group(); remodelGroup.visible = false; scene.add(remodelGroup);
let remodelCreakT = 14;

// ---------- 4 處通往 Level 0 的返回大門 ----------
const RM_DOORS = [
  { i: 0, j: 3, nx: -1, nz: 0, name: "西側主入口大廳大門" },
  { i: 31, j: 11, nx: 1, nz: 0, name: "東側物流維護大門" },
  { i: 17, j: 23, nx: 0, nz: 1, name: "南側工業捲門旁應急門" },
  { i: 9, j: 0, nx: 0, nz: -1, name: "北側樣板行政走廊門" },
];
for (const d of RM_DOORS) { d.x = RX + (d.i + .5 + d.nx * .5) * RC; d.z = RZ + (d.j + .5 + d.nz * .5) * RC; }
const rmId = (i, j) => j * NX + i;
const rmCell = (i, j) => [RX + (i + .5) * RC, RZ + (j + .5) * RC];
const rmSafe = (x, z) => RM_DOORS.some(d => Math.hypot(x - d.x, z - d.z) < RM_SAFE);
const RM_PIT = [[1, 19], [2, 19], [3, 19], [1, 20], [2, 20], [3, 20], [1, 21], [2, 21], [3, 21]];   // 豆腐渣區: caved in before you arrive

// ---------- 互動點 (RM_ACTS, filled by buildRemodel) 與 3D 地圖景點標籤 ----------
const RM_ACTS = [];
const REMODEL_PLACES = [
  ["西側主入口 · 回 Level 0", RM_DOORS[0].x + 3.5, RM_DOORS[0].z],
  ["東側維護門 · 回 Level 0", RM_DOORS[1].x - 3.5, RM_DOORS[1].z],
  ["南側應急門 · 回 Level 0", RM_DOORS[2].x, RM_DOORS[2].z - 3.5],
  ["北側走廊門 · 回 Level 0", RM_DOORS[3].x, RM_DOORS[3].z + 3.5],
  ["迎賓接待總台", RX + 16, RZ + 14],
  ["桶裝杏仁水飲水機", RX + 24, RZ + 6],
  ["企業榮譽展示櫃", RX + 6, RZ + 2],
  ["現代客廳與家庭劇院", RX + 60, RZ + 12],
  ["仿真炭火壁爐", RX + 74, RZ + 2],
  ["歐式奢華廚房中島", RX + 104, RZ + 14],
  ["雙門不鏽鋼大冰箱", RX + 122, RZ + 2],
  ["總監工辦公室 · 工務夾板", RX + 16, RZ + 44],
  ["施工總配電箱", RX + 2, RZ + 36],
  ["工務指揮會議白板", RX + 30, RZ + 51],
  ["主臥套房豪華大床", RX + 56, RZ + 44],
  ["神秘虛空大衣櫃", RX + 72, RZ + 56],
  ["豪華衛浴展示大廳", RX + 100, RZ + 38],
  ["純金馬桶展示台", RX + 112, RZ + 52],
  ["豆腐渣工程崩塌區", RX + 10, RZ + 82],
  ["穿幫黃壁紙裂口", RX + 12, RZ + 74],
  ["2x4 木龍骨框架走廊", RX + 28, RZ + 80],
  ["假門長廊試驗區", RX + 58, RZ + 72],
  ["塗料色卡選色牆", RX + 72, RZ + 72],
  ["建材物流倉儲中心", RX + 106, RZ + 80],
  ["木工鋸馬與工具台", RX + 118, RZ + 70],
  ["移動式鋁合金鷹架", RX + 96, RZ + 88],
];

// ---------- 碰撞與站立判定 ----------
const rmNear = ([a, b, c, d], m) => P.x > a - m && P.x < c + m && P.z > b - m && P.z < d + m;
function remodelCollide() {
  P.x = Math.max(RX + .4, Math.min(RX + RW - .4, P.x));
  P.z = Math.max(RZ + .4, Math.min(RZ + RD - .4, P.z));
  for (const b of RM_SOLID) if (rmNear(b, 1)) pushOut(...b);
  for (const w of RM_WALLS) if (w.state !== 2 && rmNear(w.box, 1)) pushOut(...w.box);
}
const remodelStand = (x, z) => x > RX + .6 && x < RX + RW - .6 && z > RZ + .6 && z < RZ + RD - .6 &&
  !REMODEL_BOXES.some(([a, b, c, d]) => x > a - P.r && x < c + P.r && z > b - P.r && z < d + P.r);

// ---------- 運行時狀態：崩塌改變的一切，每次進入由 resetRemodel() 還原 ----------
const rmSunk = new Set(), rmHoles = new Set(), rmAnims = [], rmPuffs = [];
let rmHP = 100, rmHurtT = 99, rmShake = 0, rmDust = 0, rmCoughT = 0, rmT = 0, rmNextEv = 0, rmStory = 0, rmSafeTold = false, rmSaved = null, rmPowerOn = true;
const remodelFloorH = (x, z) => rmSunk.has(rmId(Math.floor((x - RX) / RC), Math.floor((z - RZ) / RC))) ? -RM_SINK : 0;
const remodelHud = () => `LEVEL 0.2 · 重塑的混亂 · 體力 ${Math.max(0, Math.ceil(rmHP))}${rmT > RM_CALM ? " · ⚠ 結構正在崩塌" : ""}${rmPowerOn ? "" : " · 總電閘已拉下"} · E 互動`;

let RMB = null;   // meshes and materials, made on first entry (or first map view)
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _up4 = new THREE.Vector3(0, 1, 0);
const rmSet = (im, k, x, y, z, ry, sx = 1, sy = 1, sz = 1) => { _p4.set(x, y, z); _q4.setFromAxisAngle(_up4, ry); _s4.set(sx, sy, sz); im.setMatrixAt(k, _m4.compose(_p4, _q4, _s4)); im.instanceMatrix.needsUpdate = true; };
const _rmGeos = new Map();
const rmGeo = (key, make) => { if (!_rmGeos.has(key)) _rmGeos.set(key, make()); return _rmGeos.get(key); };
const rmWallMat = (len, outlet) => getMat(outlet ? "remodelWallOutlet" : "remodelWall", Math.max(1, Math.round(len / 4)), 1);

// ---------- 建構展廳 ----------
function buildRemodel() {
  if (RMB) return;
  const add = (geo, mat, x, y, z, ry = 0, parent = remodelGroup) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = remodelGroup) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const solidBox = (b) => { RM_SOLID.push(b); REMODEL_BOXES.push(b); };
  const addSolid = (w, h, d, mat, x, y, z, ry = 0) => {
    const m = box(w, h, d, mat, x, y, z, ry), q = Math.abs(Math.sin(ry)) > .5, hx = q ? d / 2 : w / 2, hz = q ? w / 2 : d / 2;
    solidBox([x - hx, z - hz, x + hx, z + hz]); return m;
  };
  const put = (name, x, y, z, ry = 0) => placeAt(makeProp(name), remodelGroup, x, y, z, ry);
  const sign = (tex, w, h, x, y, z, ry = 0) => add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x, y, z, ry);
  const act = (x, z, r, tip, fn) => RM_ACTS.push({ x, z, r, tip, act: fn });

  // ---- 材質 ----
  const wallM = getMat("remodelWall"), carpetM = getMat("redCarpet", 2);   // 2 x 2 per 4 m carpet cell
  const ceilM = getMat("dropCeiling", RW / 2, RD / 2), lightM = getMat("lampPanel"), offM = getMat("routerBlack");
  const woodM = getMat("wood"), chromeM = getMat("chrome"), brassM = getMat("brass"), doorM = getMat("doorWhite"), frameM = getMat("doorFrame");
  const studM = getMat("stud"), plyM = getMat("plywood"), joistM = getMat("joist"), pitM = getMat("subfloorPit"), holeM = getMat("holeDark");
  const whiteM = getMat("coolerWhite"), topM = getMat("tableTop");
  const vestM = wallMats[0].map(m => { const c = m.clone(); c.side = THREE.BackSide; return c; });   // beyond each door: the yellow of Level 0
  const G = {
    stud: new THREE.BoxGeometry(.05, RH - .1, .1), tile: new THREE.BoxGeometry(.5, .02, .5), hole: new THREE.PlaneGeometry(.5, .5).rotateX(Math.PI / 2),
    sub: new THREE.PlaneGeometry(RC, RC).rotateX(-Math.PI / 2), pitSide: new THREE.PlaneGeometry(RC, RM_SINK), joist: new THREE.BoxGeometry(.08, .2, RC),
    rag: new THREE.PlaneGeometry(RC * .8, RC * .7).rotateX(-Math.PI / 2),
  };

  // ---- 畫布紋理 ----
  const bannerTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#2a1845"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e6b800"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#e6b800"; g.font = "bold 28px sans-serif"; g.textAlign = "center";
    g.fillText("BACKROOMS REMODELING CO.", w / 2, 44);
    g.fillStyle = "#ffffff"; g.font = "bold 18px sans-serif";
    g.fillText("「真正的整潔來自於裝潢 · 真正的秩序由家具傳達」", w / 2, 84);
    g.fillStyle = "#a899c7"; g.font = "13px sans-serif";
    g.fillText("後室裝修公司示範展廳 · A 級重塑工程樣板", w / 2, 110);
  });
  const tvTex = canvasTex(256, 192, (g, w, h) => {
    const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"], bw = w / bars.length;
    bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw, h * .75); });
    g.fillStyle = "#000820"; g.fillRect(0, h * .75, w, h * .25);
    g.fillStyle = "#40ff70"; g.font = "bold 16px monospace"; g.fillText("BRC-AV TEST SIGNAL", 20, h * .9);
  });
  const corkTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#8a633a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#faf3d7"; g.fillRect(20, 20, 160, 210);
    g.strokeStyle = "#4070a0"; g.lineWidth = 2; g.strokeRect(30, 40, 140, 170);
    g.fillStyle = "#222"; g.font = "bold 13px sans-serif"; g.fillText("Level 0.2 平面圖", 35, 36);
    g.strokeStyle = "#c02020"; g.lineWidth = 3; g.strokeRect(40, 140, 120, 50);
    g.fillStyle = "#c02020"; g.font = "bold 15px sans-serif"; g.fillText("已延遲 427 天", 48, 172);
    g.fillStyle = "#fff8b0"; g.fillRect(210, 30, 260, 90);
    g.fillStyle = "#901010"; g.font = "bold 13px sans-serif"; g.fillText("【主管 Major Took 親筆】", 220, 54);
    g.fillStyle = "#222"; g.font = "12px sans-serif"; g.fillText("「四位工務員聽好了！再有客訴，", 220, 76); g.fillText("全員扣發杏仁水配額！」", 220, 98);
    g.fillStyle = "#fdf2f2"; g.fillRect(210, 135, 260, 95);
    g.fillStyle = "#b91c1c"; g.font = "bold 12px sans-serif"; g.fillText("【現場安全通報 #049】", 220, 158);
    g.fillStyle = "#444"; g.font = "11px sans-serif"; g.fillText("「若遇隔間牆晃動或粉塵掉落，請", 220, 180); g.fillText("引導訪客至門口安全區，切勿慌亂。」", 220, 200);
  });
  const whiteboardTex = canvasTex(512, 256, (g) => {
    g.fillStyle = "#f7f9fa"; g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#1e3a8a"; g.font = "bold 20px sans-serif"; g.fillText("後室裝修公司 · 每日晨會指示", 24, 38);
    g.fillStyle = "#b91c1c"; g.font = "bold 15px sans-serif"; g.fillText("1. 嚴禁向訪客承認牆壁後面是黃色壁紙！", 24, 80);
    g.fillStyle = "#333333"; g.font = "14px sans-serif";
    g.fillText("2. 任何水滴聲與木材抓撓聲，一律回答「建材自然沉降」。", 24, 115);
    g.fillText("3. 龍骨間距放寬至 80cm，背面無須封板以節約預算。", 24, 150);
    g.fillText("4. 吊頂瓷磚靠重力自然壓合，嚴禁浪費鋼絲綁紮。", 24, 185);
    g.fillStyle = "#047857"; g.font = "bold 14px sans-serif"; g.fillText("今日目標：實現 0 天無重大工安事故（已達標）", 24, 225);
  });
  const swatchTex = canvasTex(512, 128, (g, w) => {
    g.fillStyle = "#e2e2d8"; g.fillRect(0, 0, w, 128);
    const colors = [["#f8f6f0", "01 批土白"], ["#c9b44a", "02 原版黃"], ["#5f2f2a", "03 地毯紅"], ["#2a1845", "04 企業紫"],
      ["#718096", "05 石膏灰"], ["#1a202c", "06 虛空黑"], ["#b45309", "07 龍骨棕"], ["#0f766e", "08 磁磚青"]], sw = w / colors.length;
    colors.forEach(([col, name], k) => {
      g.fillStyle = col; g.fillRect(k * sw + 4, 10, sw - 8, 70);
      g.fillStyle = "#222"; g.font = "10px sans-serif"; g.textAlign = "center"; g.fillText(name, k * sw + sw / 2, 105);
    });
  });

  // ---- 1. 地板（每格 4 m 一塊地毯，才能單獨塌陷）與天花板 ----
  const carpet = new THREE.InstancedMesh(flatGeo, carpetM, NX * NZ); remodelGroup.add(carpet);
  add(new THREE.PlaneGeometry(44, 28).rotateX(-Math.PI / 2), getMat("bathTile", 22, 14), RX + 106, .006, RZ + 14);         // 廚房
  add(new THREE.PlaneGeometry(44, 36).rotateX(-Math.PI / 2), getMat("bathTile", 22, 18), RX + 106, .006, RZ + 46);         // 衛浴
  add(new THREE.PlaneGeometry(44, 32).rotateX(-Math.PI / 2), getMat("concreteFloor", 11, 8), RX + 106, .006, RZ + 80);     // 倉儲
  add(new THREE.PlaneGeometry(RW, RD).rotateX(Math.PI / 2), ceilM, RX + RW / 2, RH, RZ + RD / 2);

  // ---- 2. 外牆：每扇出口門留 1.2 m 門洞 ----
  const perim = (horiz, fixed, from, to, gaps) => {
    let a = from;
    for (const g of [...gaps.sort((p, q) => p - q), to + .6]) {
      const b = g - .6, len = b - a;
      if (len > .01) { const c = (a + b) / 2; horiz ? addSolid(len, RH, .4, rmWallMat(len), c, RH / 2, fixed) : addSolid(.4, RH, len, rmWallMat(len), fixed, RH / 2, c); }
      a = g + .6;
    }
  };
  perim(true, RZ, RX, RX + RW, RM_DOORS.filter(d => d.nz < 0).map(d => d.x));
  perim(true, RZ + RD, RX, RX + RW, RM_DOORS.filter(d => d.nz > 0).map(d => d.x));
  perim(false, RX, RZ, RZ + RD, RM_DOORS.filter(d => d.nx < 0).map(d => d.z));
  perim(false, RX + RW, RZ, RZ + RD, RM_DOORS.filter(d => d.nx > 0).map(d => d.z));

  // ---- 3. 隔間牆（切成 ≤4 m 的面板，崩塌時一片片倒） ----
  const wr = mulberry(77);
  const wallRun = (x0, z0, x1, z1) => {
    const v = x0 === x1, L = v ? z1 - z0 : x1 - x0, n = Math.ceil(L / RC), seg = L / n;
    for (let k = 0; k < n; k++) {
      const x = v ? x0 : x0 + (k + .5) * seg, z = v ? z0 + (k + .5) * seg : z0, outlet = wr() < .22;
      const mesh = add(rmGeo(`w${seg.toFixed(2)}`, () => new THREE.BoxGeometry(seg, RH, .3)), rmWallMat(seg, outlet), x, RH / 2, z, v ? Math.PI / 2 : 0);
      const hx = v ? .15 : seg / 2, hz = v ? seg / 2 : .15, w = { x, z, v, len: seg, mesh, box: [x - hx, z - hz, x + hx, z + hz], state: 0 };
      RM_WALLS.push(w); REMODEL_BOXES.push(w.box);
    }
  };
  wallRun(RX + 40, RZ + 4, RX + 40, RZ + 24); wallRun(RX + 40, RZ + 37, RX + 40, RZ + 59); wallRun(RX + 40, RZ + 68, RX + 40, RZ + 92);   // 西欄 | 中欄
  wallRun(RX + 84, RZ + 4, RX + 84, RZ + 26); wallRun(RX + 84, RZ + 36, RX + 84, RZ + 60); wallRun(RX + 84, RZ + 68, RX + 84, RZ + 92);   // 中欄 | 東欄
  wallRun(RX + 2, RZ + 28, RX + 30, RZ + 28); wallRun(RX + 47, RZ + 28, RX + 77, RZ + 28); wallRun(RX + 93, RZ + 28, RX + 123, RZ + 28);  // 北列 | 中列
  wallRun(RX + 2, RZ + 64, RX + 30, RZ + 64); wallRun(RX + 47, RZ + 64, RX + 77, RZ + 64); wallRun(RX + 93, RZ + 64, RX + 123, RZ + 64);  // 中列 | 南列

  // ---- 4. 出口門：半開的白色新門，門後是 Level 0 的黃色 ----
  for (const d of RM_DOORS) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = Math.atan2(d.nx, d.nz); remodelGroup.add(g);
    box(1.2, RH - 2.35, .4, wallM, 0, (RH + 2.35) / 2, 0, 0, g);                       // 門楣上方的牆
    box(.1, 2.35, .44, frameM, -.6, 1.175, 0, 0, g); box(.1, 2.35, .44, frameM, .6, 1.175, 0, 0, g); box(1.3, .1, .44, frameM, 0, 2.35, 0, 0, g);
    const hinge = new THREE.Group(); hinge.position.set(-.55, 0, .12); hinge.rotation.y = -1.2; g.add(hinge);
    box(1.08, 2.2, .05, doorM, .54, 1.1, 0, 0, hinge); box(.06, .06, .12, brassM, .95, 1.05, 0, 0, hinge);
    add(new THREE.BoxGeometry(2.8, RH, 3.2), vestM, 0, RH / 2, 1.8, 0, g);
    const gl = add(new THREE.PlaneGeometry(2.6, 2.6), glow(0xffe890), 0, 1.5, 3.2, Math.PI, g); gl.material.opacity = .55;
    act(d.x - d.nx * .8, d.z - d.nz * .8, 2.2, `【按 E 或走進門】推開${d.name}，返回 Level 0`, () => leaveRemodel());
  }

  // ---- 5. 頂燈（總電閘可切斷） ----
  const ceilingLights = [];
  for (let ix = 2; ix < NX - 2; ix += 3) for (let jz = 2; jz < NZ - 2; jz += 3) {
    const [lx, lz] = rmCell(ix, jz); ceilingLights.push(box(1.2, .04, .6, lightM, lx, RH - .02, lz));
  }

  // ===== 展區 1：企業接待與選料展廳 (x 0..40, z 0..28) =====
  sign(bannerTex, 8.4, 2.1, RX + 20, 2.2, RZ + .22);
  addSolid(6, 1.05, .9, woodM, RX + 16, .525, RZ + 14); addSolid(.9, 1.05, 3.2, woodM, RX + 13.5, .525, RZ + 16.05);   // L 型接待台
  box(6.2, .08, 1.05, topM, RX + 16, 1.09, RZ + 14); box(1.05, .08, 3.4, topM, RX + 13.5, 1.09, RZ + 16.05);
  box(.38, .32, .35, whiteM, RX + 16, 1.29, RZ + 14); box(.3, .24, .02, bright(0x40ff70, 1.8), RX + 16, 1.29, RZ + 14.18);  // CRT 終端
  box(.26, .02, .36, getMat("clipboard"), RX + 17.5, 1.14, RZ + 14);                                                   // 簽到簿
  act(RX + 16, RZ + 15.4, 2, "【按 E】翻看前台的訪客簽到簿", () => say("簽到簿上密密麻麻全是同一個簽名，每一行的離場時間都是空白的。", 5000));
  addSolid(2.4, .8, .9, getMat("waitChair"), RX + 26, .4, RZ + 16); addSolid(1.1, .8, .9, getMat("waitChair"), RX + 23.5, .4, RZ + 18, Math.PI / 2);
  box(1.2, .42, .7, chromeM, RX + 26, .21, RZ + 18.2); box(1.22, .03, .72, getMat("mirror"), RX + 26, .435, RZ + 18.2);   // 玻璃茶几
  box(.45, .5, .45, getMat("porcelain"), RX + 21, .25, RZ + 12); box(.15, .9, .15, getMat("armyMattress"), RX + 21, .95, RZ + 12);   // 虎尾蘭
  addSolid(2.2, 2.2, .6, topM, RX + 6, 1.1, RZ + .5);                                                                  // 榮譽展示櫃，靠北牆
  for (let k = -1; k <= 1; k++) box(.18, .45, .18, brassM, RX + 6 + k * .6, 2.45, RZ + .5);
  act(RX + 6, RZ + 2, 2.2, "【按 E】瞻仰企業榮譽展示櫃", () => say("展示櫃裡擺著『後室最速交屋金獎』與『連續 0 天無重大工安意外』鍍金獎牌。看來這家公司很懂得自我安慰。", 5500));
  put("waterCooler", RX + 24, 0, RZ + 6); solidBox([RX + 23.8, RZ + 5.8, RX + 24.2, RZ + 6.2]);
  add(new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2), glow(0x66ccff), RX + 24, .015, RZ + 6).material.opacity = .4;
  act(RX + 24, RZ + 6.8, 2, "【按 E】飲用冰鎮桶裝杏仁水", () => {
    if (typeof soundDrink === "function") soundDrink();
    rmHP = 100; rmHurtT = 99;
    say("咕嚕咕嚕……甘甜冰涼的桶裝杏仁水順喉而下！體力完全恢復。", 4500);
  });

  // ===== 展區 2：現代客廳與家庭劇院 (x 40..84, z 0..28) =====
  add(new THREE.PlaneGeometry(16, 12).rotateX(-Math.PI / 2), getMat("rug"), RX + 62, .008, RZ + 14);
  addSolid(4.6, .85, 1.1, getMat("waitChair"), RX + 60, .425, RZ + 11); addSolid(1.1, .85, 3.4, getMat("waitChair"), RX + 57.5, .425, RZ + 13.25);   // L 型沙發
  addSolid(2, .42, 1, woodM, RX + 61, .21, RZ + 14.5);                                                                  // 茶几
  addSolid(4.2, .55, .6, woodM, RX + 61, .275, RZ + .5);                                                                // 電視櫃，靠北牆
  sign(tvTex, 3.6, 2, RX + 61, 1.75, RZ + .22);
  add(new THREE.PlaneGeometry(4.4, 2.6), glow(0x66aaff), RX + 61, 1.75, RZ + .26).material.opacity = .35;
  act(RX + 61, RZ + 2.5, 2.2, "【按 E】按下電視遙控器", () => say("不管轉到哪一台，都是同一組彩色校正條。遙控器背面的電池槽是空的。", 4500));
  box(.06, 2.7, .06, brassM, RX + 65, 1.35, RZ + 9);                                                                    // 釣魚燈
  box(1.8, .06, .06, brassM, RX + 64.4, 2.7, RZ + 9.6, Math.PI / 4); box(.5, .3, .5, bright(0xffe890, 2), RX + 63.8, 2.5, RZ + 10.2);
  addSolid(2.8, 1.4, .6, whiteM, RX + 74, .7, RZ + .5); box(1.6, .7, .1, bright(0xff4411, 2.2), RX + 74, .45, RZ + .82);   // 仿真壁爐
  act(RX + 74, RZ + 2.4, 2.2, "【按 E】檢查仿真電壁爐", () => say("這是一座純裝飾性的仿真炭火壁爐，紅光在假木炭上跳躍，卻絲毫沒有半點溫度。", 4500));
  addSolid(3.6, 2.6, .5, woodM, RX + 45, 1.3, RZ + .45);                                                                // 書架
  act(RX + 45, RZ + 2.2, 2.2, "【按 E】查看客廳書架上的書籍", () => say("書架上擺滿了整齊的精裝書，但拿起來一看——全都是只印了封面的實心塑膠泡沫模型！", 5000));

  // ===== 展區 3：歐陸奢華廚房 (x 84..128, z 0..28) =====
  addSolid(7.2, .95, .9, topM, RX + 104, .475, RZ + .65); addSolid(.9, .95, 5.4, topM, RX + 107.25, .475, RZ + 3.8);   // L 型櫥櫃
  box(.8, .05, .5, chromeM, RX + 103, .97, RZ + .65); box(.05, .42, .05, chromeM, RX + 103, 1.18, RZ + .4);           // 水槽與龍頭
  act(RX + 103, RZ + 2, 1.8, "【按 E】轉開廚房水龍頭", () => { if (typeof soundDrink === "function") soundDrink(); say("清水嘩嘩地流出來，冰涼乾淨。在 Level 0 可找不到能用的水龍頭。", 4500); });
  addSolid(1.4, 2.2, 1, chromeM, RX + 122, 1.1, RZ + .7);                                                               // 雙門冰箱
  act(RX + 122, RZ + 2.4, 2.2, "【按 E】拉開雙門不鏽鋼大冰箱", () => {
    if (typeof soundClick === "function") soundClick();
    say("你拉開了雙門冰箱，一股冷氣撲面而來，裡面整整齊齊碼著十幾排杏仁水罐頭——全是印在紙板上的照片。", 5500);
  });
  addSolid(3.6, 1.05, 1.4, topM, RX + 104, .525, RZ + 14);                                                              // 中島
  for (let s = -1; s <= 1; s++) box(.4, .8, .4, chromeM, RX + 104 + s * 1.1, .4, RZ + 15.6);
  addSolid(4.2, .78, 1.6, woodM, RX + 116, .39, RZ + 20);                                                               // 餐桌
  for (let c = -1; c <= 1; c++) { box(.5, .85, .5, getMat("waitChair"), RX + 116 + c * 1.3, .425, RZ + 18.6); box(.5, .85, .5, getMat("waitChair"), RX + 116 + c * 1.3, .425, RZ + 21.4); }
  box(.12, .45, .3, brassM, RX + 116, 1, RZ + 20);
  act(RX + 116, RZ + 17.4, 2.2, "【按 E】檢查奢華餐桌擺設", () => say("餐桌上的高腳杯、瓷盤和刀叉全都用強力膠牢牢固定在桌面上，根本拿不起來！", 5000));

  // ===== 展區 5：總監工辦公室 (x 0..40, z 28..64) =====
  addSolid(3.6, .82, 1.8, woodM, RX + 16, .41, RZ + 44);
  box(.85, 1.35, .85, offM, RX + 16, .675, RZ + 42.2);                                                                  // 老闆椅
  box(.2, .38, .15, brassM, RX + 14.5, .98, RZ + 44); box(.24, .12, .16, bright(0x34d399, 2.2), RX + 14.5, 1.12, RZ + 44);   // 銀行家檯燈
  box(.26, .02, .34, getMat("clipboard"), RX + 16, .84, RZ + 44);
  const clipGlow = add(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), glow(0xffe08a), RX + 16, .845, RZ + 44);
  act(RX + 16, RZ + 45.4, 2, "【按 E】翻閱總監工辦公桌上的工務調查夾板", () => toggleDoc(true));
  addSolid(.2, 1.2, .9, whiteM, RX + .3, 1.6, RZ + 36); box(.08, .25, .08, offM, RX + .44, 1.6, RZ + 36);             // 總配電箱，掛西牆
  act(RX + 1.4, RZ + 36, 2, "【按 E】扳動施工總配電箱電閘", () => {
    if (typeof soundClick === "function") soundClick();
    rmSetPower(!rmPowerOn);
    say(rmPowerOn ? "嘎噠！電閘合上，全場展廳頂燈重新亮起。" : "啪嚓！你拉下了總電閘，全場展廳陷入昏暗的備用應急微光。", 4500);
  });
  sign(corkTex, 4.8, 2.2, RX + 16, 2, RZ + 28.17);                                                                      // 軟木告示板，掛在北隔牆上
  addSolid(1.1, 1.8, .8, getMat("steel"), RX + 6, .9, RZ + 38); addSolid(1.1, 1.8, .8, getMat("steel"), RX + 6, .9, RZ + 40);
  act(RX + 7.2, RZ + 39, 2, "【按 E】查閱金屬檔案櫃", () => say("檔案櫃抽屜貼滿標籤：『未核准追加預算』、『工務員失蹤名單』、『客戶索賠封口紀錄』……", 6000));
  addSolid(4.8, .78, 1.6, topM, RX + 30, .39, RZ + 54);                                                                 // 會議桌
  for (let k = -1.6; k <= 1.6; k += 1) { box(.45, .75, .45, chromeM, RX + 30 + k, .375, RZ + 52.8); box(.45, .75, .45, chromeM, RX + 30 + k, .375, RZ + 55.2); }
  addSolid(4.4, 2.2, .08, whiteM, RX + 30, 1.9, RZ + 48.2); sign(whiteboardTex, 4.2, 2, RX + 30, 1.9, RZ + 48.25);       // 白板（立架）
  box(.06, .8, .5, chromeM, RX + 28, .4, RZ + 48.2); box(.06, .8, .5, chromeM, RX + 32, .4, RZ + 48.2);
  act(RX + 30, RZ + 49.8, 2.2, "【按 E】閱讀晨會白板", () => say("白板最上面寫著：『嚴禁向訪客承認牆壁後面是黃色壁紙！』底下有人用很小的字補了一句：『但它一直在長回來。』", 6000));

  // ===== 展區 6：主臥套房 (x 40..84, z 28..64) =====
  addSolid(2.4, .65, 2.2, woodM, RX + 56, .325, RZ + 44.1);
  box(2.6, 1.3, .2, getMat("waitChair"), RX + 56, .65, RZ + 42.9);
  box(2.2, .22, 1.8, whiteM, RX + 56, .72, RZ + 44.4); box(.7, .15, .45, whiteM, RX + 55.2, .86, RZ + 43.4); box(.7, .15, .45, whiteM, RX + 56.8, .86, RZ + 43.4);
  addSolid(.7, .55, .6, woodM, RX + 54.2, .275, RZ + 43.1); box(.2, .3, .2, bright(0xffecd0, 2), RX + 54.2, .7, RZ + 43.1);
  addSolid(.7, .55, .6, woodM, RX + 57.8, .275, RZ + 43.1); box(.2, .3, .2, bright(0xffecd0, 2), RX + 57.8, .7, RZ + 43.1);
  act(RX + 56, RZ + 46, 2.2, "【按 E】坐上豪華大床", () => say("床墊硬得像一塊實心板——掀開床單，底下是一整片沒拆封的石膏板。", 4500));
  addSolid(1.6, .75, .6, woodM, RX + 66, .375, RZ + 43); box(1.2, .9, .05, getMat("mirror"), RX + 66, 1.3, RZ + 42.75);
  addSolid(2.4, 2.6, 1, woodM, RX + 72, 1.3, RZ + 56);                                                                  // 虛空衣櫃
  box(2.1, 2.3, .02, holeM, RX + 72, 1.3, RZ + 56.51);                                                                 // 敞開的櫃門內，一片漆黑
  box(2.3, .08, .02, bright(0xfacc15, 1.5), RX + 72, 1.4, RZ + 56.53);
  act(RX + 72, RZ + 57.6, 2.2, "【按 E】探頭往衣櫃深處的虛空看去", () => say("衣櫃裡沒有底板，只有無邊無際的幽暗深空，隱約傳來冰冷的氣流呼嘯聲。封條上寫著：『空間塌陷施工中，嚴禁鑽入』。", 6500));

  // ===== 展區 4：七星級衛浴展廳 (x 84..128, z 28..64) =====
  addSolid(2.2, .75, 1.1, getMat("porcelain"), RX + 96, .375, RZ + 38); box(.06, 1.1, .06, chromeM, RX + 96, .55, RZ + 37.2);
  addSolid(3.4, .85, .8, topM, RX + 106, .425, RZ + 28.6); box(3.2, 1.2, .05, getMat("mirror"), RX + 106, 1.6, RZ + 28.2);   // 雙人洗手台，靠北隔牆
  act(RX + 106, RZ + 30, 2, "【按 E】打開洗手台水龍頭", () => { if (typeof soundDrink === "function") soundDrink(); say("清水嘩嘩地流出來。鏡子裡的你身後，牆角有一小塊白漆正在起泡，透出底下的黃色。", 5000); });
  for (let k = 0; k <= 3; k++) addSolid(3.4, 2.2, .1, whiteM, RX + 126.3, 1.1, RZ + 54 + k * 2.2);                      // 3 間廁所隔間，靠東牆（避開東門）
  for (let k = 0; k < 3; k++) { const tz = RZ + 55.1 + k * 2.2; put("toilet", RX + 127.3, 0, tz, -Math.PI / 2); solidBox([RX + 126.9, tz - .25, RX + 127.8, tz + .25]); }
  act(RX + 125, RZ + 57.3, 2, "【按 E】按下隔間馬桶的沖水鈕", () => { if (typeof soundFlush === "function") soundFlush(); say("嘩啦——沖水聲正常得令人不安。", 3500); });
  addSolid(2.4, .35, 2.4, offM, RX + 112, .175, RZ + 52);                                                               // 純金馬桶展示台
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(.08, .9, .08, brassM, RX + 112 + dx, .8, RZ + 52 + dz);
  box(.46, .44, .65, brassM, RX + 112, .57, RZ + 52); box(.5, .55, .22, brassM, RX + 112, .95, RZ + 51.7);
  add(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), glow(0xfde047), RX + 112, .36, RZ + 52).material.opacity = .5;
  act(RX + 112, RZ + 53.8, 2.2, "【按 E】敬畏地按下純金馬桶沖水鈕", () => {
    if (typeof soundFlush === "function") soundFlush(); else if (typeof soundDrink === "function") soundDrink();
    say("嘩啦——！金色的沖水聲在衛浴大廳久久迴盪……展牌上標註：『尊榮非賣品 · 嚴禁如廁』。", 6000);
  });

  // ===== 展區 7：建材物流倉儲 (x 84..128, z 64..96) =====
  for (let k = 0; k < 3; k++) { const pz = RZ + 76 + k * 4.2; addSolid(2.6, 1.2, 1.6, plyM, RX + 106, .6, pz); box(2.7, .12, 1.7, getMat("crate"), RX + 106, .06, pz); }
  addSolid(4.2, 1.6, 1.8, studM, RX + 120, .8, RZ + 78);                                                                // 2x4 角材堆
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) put((i + j) % 2 ? "paintCan" : "paintCanMaroon", RX + 116 + i * .45, 0, RZ + 90 + j * .45);
  solidBox([RX + 115.8, RZ + 89.8, RX + 117.6, RZ + 91.1]);
  addSolid(2.8, .9, 1.2, plyM, RX + 118, .45, RZ + 70);                                                                 // 鋸馬工作台
  box(.4, .22, .25, chromeM, RX + 117.5, 1.01, RZ + 70); box(.28, .02, .28, chromeM, RX + 118.6, .91, RZ + 70);
  act(RX + 118, RZ + 71.5, 2, "【按 E】檢查木工鋸馬工作台", () => say("工作台上散落著捲尺、鐵錘與一把生鏽的圓鋸。旁邊的草稿紙上記錄著偷工減料的木材切割清單。", 5000));
  put("stepladder", RX + 98, 0, RZ + 88);
  for (const dx of [-.7, .7]) for (const dz of [-.7, .7]) box(.06, 2.8, .06, chromeM, RX + 96 + dx, 1.4, RZ + 88 + dz);   // 鷹架
  box(1.5, .06, 1.5, plyM, RX + 96, 1.4, RZ + 88); box(1.5, .06, 1.5, plyM, RX + 96, 2.75, RZ + 88);
  solidBox([RX + 95.3, RZ + 87.3, RX + 96.7, RZ + 88.7]);

  // ===== 展區 8：豆腐渣工程崩塌區 (x 0..40, z 64..96) =====
  addSolid(7.2, RH, .3, wallMats[0], RX + 12, RH / 2, RZ + 74);                                                         // 石膏板剝光，露出 Level 0 黃壁紙
  for (const [dx, h] of [[-3.75, 1.4], [3.75, 2.2]]) box(.3, h, .32, whiteM, RX + 12 + dx, h / 2, RZ + 74);            // 殘留的白色批土邊
  for (let k = 0; k < 5; k++) box(.4 + Math.random() * .5, .02, .3 + Math.random() * .4, whiteM, RX + 9 + k * 1.4, .01, RZ + 74.6 + Math.random() * .6, Math.random() * 3);   // 剝落的石膏碎片
  act(RX + 12, RZ + 75.6, 2.2, "【按 E】細看崩裂的石膏板牆壁", () => say("厚厚的白色批土剝落了一大塊，底下赫然露出了原版 Level 0 那熟悉的潮濕黃色壁紙！果然是蓋在原建築上的遮羞布。", 6000));
  for (let k = 0; k < 12; k++) for (const x of [24, 32]) box(.08, RH, .12, studM, RX + x, RH / 2, RZ + 70 + k * 1.8);    // 沒封板的龍骨走廊
  for (const x of [24, 32]) { box(.1, .06, 20, studM, RX + x, .03, RZ + 80); box(.1, .06, 20, studM, RX + x, RH - .03, RZ + 80); solidBox([RX + x - .1, RZ + 70, RX + x + .1, RZ + 90]); }
  for (let d = 0; d < 8; d++) box(.5, .02, .5, getMat("ceilingTile"), RX + 16.4 + (d % 3) * .8, .02 + (d % 2) * .02, RZ + 79 + Math.floor(d / 3) * .9, d * .7);   // 掉下的天花板瓷磚
  for (let d = 0; d < 8; d++) add(G.hole, holeM, RX + 16.25 + (d % 3) * .5, RH - .012, RZ + 79.25 + Math.floor(d / 3) * .5);   // 頭頂對應的破洞
  const duct = box(1.2, .8, 9.6, getMat("duct"), RX + 18, RH - .9, RZ + 86, .2); duct.rotation.x = .08;                // 歪斜懸掛的風管
  act(RX + 18, RZ + 86, 2.5, "【按 E】抬頭看懸掛的鐵皮風管", () => say("一截鍍鋅風管只靠一根鐵絲吊著，另一頭直接插進了天花板的破洞裡，裡面有東西在緩慢地滴水。", 5000));
  act(RX + 10, RZ + 82, 3, "【按 E】低頭看塌陷的地面", () => say("地毯底下根本沒有樓板，只有幾根木擱柵，和一棟尚未完工的房屋框架。", 5000));

  // ===== 展區 9：假門長廊與樣品試驗區 (x 40..84, z 64..96) =====
  addSolid(32, RH, .3, rmWallMat(32), RX + 64, RH / 2, RZ + 70);                                                        // 展示牆
  sign(swatchTex, 8.4, 2.2, RX + 72, 1.8, RZ + 70.17);
  act(RX + 72, RZ + 71.8, 2.2, "【按 E】查看塗料工程色卡牆", () => say("牆上標記著施工隊的專用色號：『01 批土白』、『02 原版黃（待覆蓋）』……旁邊還有一行鉛筆字：『別買太貴的』。", 5500));
  for (let d = 0; d < 6; d++) {
    const dx = RX + 50 + d * 3;
    box(1.24, 2.3, .03, frameM, dx, 1.15, RZ + 70.16); box(1.1, 2.2, .06, d % 2 ? doorM : getMat("doorLeaf"), dx, 1.1, RZ + 70.18);
    box(.06, .06, .1, brassM, dx + .45, 1.05, RZ + 70.24);
    act(dx, RZ + 71.4, 1.4, `【按 E】推開樣板木門 #${d + 1}`, () => {
      if (typeof soundClick === "function") soundClick();
      say("你握住門把用力拉了拉——這扇門直接被四顆長鋼釘釘死在實心石膏牆上，根本沒有門洞！", 4500);
    });
  }
  box(.12, .2, .03, getMat("porcelain"), RX + 79, 2.85, RZ + 70.16);                                                   // 倒裝的高空插座：接地孔朝下
  for (const dx of [-.03, .03]) box(.012, .045, .01, offM, RX + 79 + dx, 2.87, RZ + 70.18);
  box(.02, .02, .01, offM, RX + 79, 2.8, RZ + 70.18);
  act(RX + 79, RZ + 72, 2, "【按 E】抬頭端詳倒裝的高空插座", () => say("這個三孔插座被倒著安裝在距離地面 2.8 米的高空，緊貼著吊頂龍骨……到底誰能把插頭插上去？", 5000));
  put("toilet", RX + 66, 0, RZ + 84); solidBox([RX + 65.75, RZ + 83.65, RX + 66.25, RZ + 84.35]);
  act(RX + 66, RZ + 85.3, 2, "【按 E】端詳走廊中央的孤獨馬桶", () => say("一個光潔如新的白瓷馬桶孤零零立在走廊正中央，四周沒有任何隔板或水管，旁邊甚至貼心附贈了一卷衛生紙。", 5500));

  // ---- WiFi 路由器（掛北牆） ----
  const leds = [];
  for (const rx of [RX + 18, RX + 70, RX + 118]) {
    leds.push(...put("wifiRouter", rx, 2.4, RZ + .22).children.filter(c => c.material === getMat("ledGreen")));
    act(rx, RZ + 1.8, 2, "【按 E】連線後室裝修公司 Wi-Fi 路由器", () => say("『BRC-Remodel_5G』信號滿格。但瀏覽器只能打開一個頁面：後室裝修公司的企業官網，橫幅閃爍著標語——真正的整潔來自於裝潢。", 6000));
  }

  const dyn = new THREE.Group(); remodelGroup.add(dyn);
  RMB = { G, studM, plyM, joistM, pitM, holeM, carpetM, ceilTileM: getMat("ceilingTile"), lightM, offM, carpet, ceilingLights, leds, clipGlow, dyn, duct };
}

function rmSetPower(on) {
  rmPowerOn = on;
  for (const lp of RMB.ceilingLights) lp.material = on ? RMB.lightM : RMB.offM;
}

// ---------- 重置：重新進來時展廳完好如初 ----------
function resetRemodel() {
  const { dyn, carpet } = RMB;
  for (const c of [...dyn.children]) { c.traverse(o => o.isSprite && o.material.dispose()); dyn.remove(c); }
  for (const w of RM_WALLS) { w.state = 0; w.mesh.visible = true; }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const [x, z] = rmCell(i, j); rmSet(carpet, rmId(i, j), x, 0, z, 0, RC, 1, RC); }
  rmSunk.clear(); rmHoles.clear(); rmAnims.length = 0; rmPuffs.length = 0;
  for (const [i, j] of RM_PIT) sinkCell(i, j, true);
  rmHP = 100; rmHurtT = 99; rmShake = 0; rmDust = 0; rmT = 0; rmNextEv = 0; rmStory = 0; rmSafeTold = false; rmCoughT = 0;
  rmSetPower(true);
  AMB[REMODEL_ZT][1] = .011; AMB[REMODEL_ZT][2] = 3.2;
}

// ---------- 崩塌 ----------
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
  if (RMB.ceilingLights.some(l => Math.abs(l.position.x - x) < .9 && Math.abs(l.position.z - z) < .6)) x += 1.2;   // not where a light panel hangs
  x = RX + (Math.floor((x - RX) / .5) + .5) * .5; z = RZ + (Math.floor((z - RZ) / .5) + .5) * .5;
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
  w.state = 4; w.mesh.visible = false; rmCreak(w.x, w.z);
  const { dyn, G } = RMB, ry = w.v ? Math.PI / 2 : 0, r = Math.random(), L = w.len;
  const reveal = r < .45 ? 1 : r < .7 ? 3 : 2;   // 1 bare studs, 3 Level 0 wallpaper, 2 gone (splintered stumps)
  const back = new THREE.Group(); back.position.set(w.x, 0, w.z); back.rotation.y = ry; dyn.add(back);
  if (reveal === 3) { const m = new THREE.Mesh(rmGeo(`y${L.toFixed(2)}`, () => new THREE.BoxGeometry(L, RH, .2)), wallMats[Math.floor(Math.random() * wallMats.length)]); m.position.y = RH / 2; back.add(m); }
  else {
    const plate = rmGeo(`p${L.toFixed(2)}`, () => new THREE.BoxGeometry(L, .05, .1));
    for (const y of [.025, RH - .025]) { if (reveal === 2 && y > 1) continue; const m = new THREE.Mesh(plate, RMB.studM); m.position.y = y; back.add(m); }
    const n = Math.max(2, Math.round(L / .8));
    for (let k = 0; k <= n; k++) {
      if (reveal === 2 && k % 3) continue;
      const m = new THREE.Mesh(G.stud, RMB.studM), u = -L / 2 + .05 + k * (L - .1) / n; m.position.set(u, RH / 2, 0);
      if (reveal === 2) { m.scale.y = .25 + Math.random() * .3; m.position.y = (RH - .1) * m.scale.y / 2; m.rotation.z = (Math.random() - .5) * .5; }
      back.add(m);
    }
  }
  const pivot = new THREE.Group(); pivot.position.set(w.x, .05, w.z); pivot.rotation.order = "YXZ"; pivot.rotation.y = ry; dyn.add(pivot);
  const panel = new THREE.Mesh(rmGeo(`f${L.toFixed(2)}`, () => new THREE.BoxGeometry(L, RH, .1)), rmWallMat(L)); panel.position.y = RH / 2; pivot.add(panel);
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
    if (Math.abs(along) < L / 2 && perp > 0 && perp < RH + .2) rmHurt(40, "整面隔間牆朝你倒了下來！");
    return false;
  });
  for (let k = 0; k < 2; k++) { const a = (Math.random() - .5) * L; dropTile(w.x + (w.v ? 0 : a), w.z + (w.v ? a : 0), 1.4 + Math.random()); }   // the ceiling grid it held up goes with it
}
// a cell of floor caves in onto the joists of the unfinished house below (quiet: already caved in when you arrive)
function sinkCell(i, j, quiet) {
  const id = rmId(i, j), [x, z] = rmCell(i, j), { dyn, G } = RMB;
  rmSunk.add(id); rmSet(RMB.carpet, id, 0, -50, 0, 0, 0, 0, 0);
  const g = new THREE.Group(); g.position.set(x, 0, z); dyn.add(g);
  const sub = new THREE.Mesh(G.sub, RMB.plyM); sub.position.y = -RM_SINK; g.add(sub);
  for (const a of [-1.3, 0, 1.3]) { const jm = new THREE.Mesh(G.joist, RMB.joistM); jm.position.set(a, -RM_SINK + .1, 0); g.add(jm); }
  for (let s = 0; s < 4; s++) { const p = new THREE.Mesh(G.pitSide, RMB.pitM), a = s * Math.PI / 2; p.position.set(Math.sin(a) * RC / 2, -RM_SINK / 2, Math.cos(a) * RC / 2); p.rotation.y = a; g.add(p); }
  const rag = new THREE.Mesh(G.rag, RMB.carpetM); g.add(rag);
  if (quiet) { rag.position.y = -RM_SINK + .2; rag.rotation.set(-.08, 0, .12); return; }
  let t = 0; rag.position.y = -.02;
  rmAnims.push(dt => { t += dt; const kk = Math.min(1, t / .45); rag.position.y = -.02 - (RM_SINK - .2) * kk * kk; rag.rotation.z = .12 * kk; rag.rotation.x = -.08 * kk; return kk < 1; });
  rmCrash(x, z, .9); puff(x, z, 2);
  if (Math.floor((P.x - RX) / RC) === i && Math.floor((P.z - RZ) / RC) === j) rmHurt(15, "腳下的地板突然塌了下去！");
}
// a cell may cave in only on carpet (the tiled east wing sits on a slab), clear of the doors, furniture, rug and anything you can use
function rmCanSink(i, j) {
  if (i < 0 || j < 0 || i >= 21 || j >= NZ || rmSunk.has(rmId(i, j))) return false;
  const x0 = RX + i * RC, z0 = RZ + j * RC, x1 = x0 + RC, z1 = z0 + RC, [cx, cz] = rmCell(i, j), hit = ([a, b, c, d]) => a < x1 && c > x0 && b < z1 && d > z0;
  if (rmSafe(cx, cz) || RM_SOLID.some(hit) || hit([RX + 54, RZ + 8, RX + 70, RZ + 20])) return false;
  return !RM_ACTS.some(a => a.x > x0 && a.x < x1 && a.z > z0 && a.z < z1);
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
    const i = Math.floor((p[0] - RX) / RC), j = Math.floor((p[1] - RZ) / RC);
    if (rmCanSink(i, j)) return sinkCell(i, j);
  }
  if (r < .42 && p) {
    let best = null, bd = 12;   // the showrooms are big: look a little further for a partition
    for (const w of RM_WALLS) { const d = Math.hypot(w.x - p[0], w.z - p[1]); if (w.state === 0 && d < bd && !rmSafe(w.x, w.z)) { best = w; bd = d; } }
    if (best) return collapseWall(best);
  }
  const near = Math.random() < .3, q = near ? rmTarget(true) : p;
  if (q) dropTile(q[0], q[1], near ? 1.3 : .8);
  if (Math.random() < .5) { const s = rmTarget(false); if (s) dropTile(s[0], s[1], 1 + Math.random()); }
}

// ---------- 每幀：崩塌、粉塵、受傷、提示 ----------
const rmInTofu = () => P.x < RX + 40 && P.z > RZ + 64;
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
    if (rmStory === 0 && rmT > 8) { rmStory = 1; say("空氣中瀰漫著剛粉刷的油漆味與石膏粉。燈管的嗡鳴比 Level 0 輕得多，插座裡甚至有電。", 6000); }
    if (rmStory === 1 && rmT > RM_CALM * .6) { rmStory = 2; rmCreak(P.x, P.z); say("牆壁深處傳來一聲悶響，像是木頭被慢慢壓彎。", 4000); }
    if (rmStory === 2 && rmT > RM_CALM) { rmStory = 3; rmCreak(P.x, P.z); say("頭頂傳來「咔」的一聲脆響——吊頂的龍骨正在變形。", 5000); }
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
    AMB[REMODEL_ZT][2] = (rmPowerOn ? 3.2 : 1.1) - rmDust * .8;                                        // breaker pulled: only the emergency glow
    if (state !== "play") return;
    if (rmDust > .35) {
      rmHP -= dt * 10 * rmDust; rmHurtT = 0;
      if ((rmCoughT -= dt) <= 0) { rmCoughT = 1.8 + Math.random() * 1.5; noiseBurst(650, 1.4, .2, 2, .14, .2); say("嗆人的石膏粉塵灌進喉嚨……快離開這團灰！", 2000); }
      if (rmHP <= 0) return rmKnockout();
    } else if (rmInTofu() && (rmCoughT -= dt) <= 0) {
      rmCoughT = 14 + Math.random() * 8; say("咳咳……這片半成品施工區的空氣裡漂浮著細微的石膏乾粉。", 3500);
    }
    if ((rmHurtT += dt) > 5) rmHP = Math.min(100, rmHP + dt * 5);
    rmShake = Math.max(0, rmShake - dt); dropY = Math.sin(t * 70) * .08 * rmShake;
    for (const [k, l] of RMB.leds.entries()) l.visible = rmPowerOn && Math.sin(t * (7 + k * 3)) > -.3;
    RMB.clipGlow.material.opacity = .25 + .2 * Math.sin(t * 3);
    RMB.duct.rotation.z = .03 * Math.sin(t * .7);                                                      // the duct sways on its one wire
    const a = this.nearest();
    if (a && !docOpen) say(a.tip, 1200);
    for (const d of RM_DOORS) if (Math.hypot(P.x - d.x, P.z - d.z) < .9) return leaveRemodel();
  }
};

// ---------- 進入與離開 ----------
function rmBack() {
  enterMap(); [P.x, P.z, P.yaw] = rmSaved || [SPAWN[0], SPAWN[1], 0]; P.y = 0; P.pitch = 0; dropY = 0; fallV = 0;
}
function enterRemodel() {
  buildRemodel(); resetRemodel();
  rmSaved = mode === "map" ? [P.x, P.z, P.yaw] : [SPAWN[0], SPAWN[1], 0];
  mode = "remodel"; hemi.groundColor.set(0xd9d4ca); remodelGroup.visible = true;
  baseGroup.visible = tsGroup.visible = iceGroup.visible = false; floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsFar(180);
  const [fc, fd, hi, hc] = AMB[REMODEL_ZT]; scene.fog.color.set(fc); scene.fog.density = fd; hemi.color.set(hc); hemi.intensity = hi;
  const d = RM_DOORS[0]; P.x = d.x + 2; P.z = d.z; P.y = 0; P.yaw = -Math.PI / 2; P.pitch = 0; dropY = 0; fallV = 0;
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 0.2 · 重塑的混亂 ——後室裝修公司的樣板展廳：地毯是乾的，牆刷成了白色。四周的出口門隨時能回 Level 0。", 6500);
}
function leaveRemodel() {
  if (state !== "play") return;
  state = "wait";
  fadeEl.innerHTML = rmT > RM_CALM ? "你推開門，身後的崩塌聲戛然而止……<br>熟悉的黃色走廊又回來了。" : "你推開出口大門，身後氣派的樣板間漸漸遠去……<br>熟悉的黃色走廊又回來了。";
  fadeEl.style.opacity = 1;
  setTimeout(() => { rmBack(); say("你回到了 Level 0。", 4000); }, 2200);
}

// ---------- 3D 俯視地圖 ----------
function buildRemodelMap() {
  buildRemodel();   // the layout is made with the meshes, so the map works before you ever visit
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), wh = 1.6, cx = RX + RW / 2, cz = RZ + RD / 2;
  inst(mapWorld, flatGeo, mat(0x7a2a24), [[cx, 0, cz, 0, RW, 1, RD]]);
  inst(mapWorld, flatGeo, mat(0x4a7c85), [[RX + 106, .02, RZ + 14, 0, 44, 1, 28]]);
  inst(mapWorld, flatGeo, mat(0x386b75), [[RX + 106, .02, RZ + 46, 0, 44, 1, 36]]);
  inst(mapWorld, flatGeo, mat(0x555550), [[RX + 106, .02, RZ + 80, 0, 44, 1, 32]]);
  inst(mapWorld, flatGeo, mat(0x3a2c1c), RM_PIT.map(([i, j]) => { const [x, z] = rmCell(i, j); return [x, .03, z, 0, RC, 1, RC]; }));
  inst(mapWorld, boxGeo, mat(0xf5f4ef), REMODEL_BOXES.map(([a, b, c, d]) => [(a + c) / 2, wh / 2, (b + d) / 2, 0, Math.max(.3, c - a), wh / H, Math.max(.3, d - b)]));
  inst(mapWorld, flatGeo, mat(0xfacc15), RM_DOORS.map(d => [d.x + d.nx * 1.2, .04, d.z + d.nz * 1.2, 0, d.nx ? 2.5 : 3, 1, d.nx ? 3 : 2.5]));
}
