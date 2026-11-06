"use strict";
// ---------- Level 0.5「淵閉療舍」(Abyssal Infirmary) ----------
// Source: https://backrooms-wiki-cn.wikidot.com/level-0-5
// Author: FuneralBouncer (Discord: Bride Basher), translated by xuziqi (CC BY-SA 3.0).
// An isolated 96 m x 96 m sub-level:
// 1. 浸濡通道 (Flooded Hallways): Knee-deep toxic brown stagnant water, peeling sickly-cream wallpaper,
//    short blue rectangular lamps sparking overhead, loud echoing splashes, and a waterlogged floating diary.
// 2. 腐木過渡區 (Decayed Wood Corridor): Rotting wood walls full of wormholes, snack carts with provisions.
// 3. 廢棄醫院 (Abandoned Hospital): Dry raised platforms, distressed mint-beige walls, damp beds with mothball smell.
// 4. 實體「溺尸」(The Drowned Corpse): Relentless stalker ("immortal snail") tracking the player after sleeping in bed;
//    luring it back to touch the flooded corridor causes it to scream and dissolve into mush.
// 5. 終點出口：金屬格柵樓梯 (Watchtower Grate Stairs) descending to Level 1.

const HX = 3000, HZ = 40, HC = 4, HNX = 24, HNZ = 24, H_W = HNX * HC, H_D = HNZ * HC, HH = 3.2;
const INFIRMARY_ZT = 18;
const H_IN = HNX * HNZ, hk = (i, j) => j * HNX + i;
const H_BOXES = new Map();
const H_ACTS = [], H_BEDS = [], H_CARTS = [], H_BLUE_LAMPS = [];
const infirmaryGroup = new THREE.Group(); infirmaryGroup.visible = false; scene.add(infirmaryGroup);
AMB[INFIRMARY_ZT] = [0x162026, .028, 2.0, 0x7695a5];

const hCell = (i, j) => [HX + (i + .5) * HC, HZ + (j + .5) * HC];
const hAdd = (i, j, b) => {
  const k = hk(Math.max(0, Math.min(HNX - 1, i)), Math.max(0, Math.min(HNZ - 1, j)));
  (H_BOXES.get(k) || H_BOXES.set(k, []).get(k)).push(b);
};

// ---------- 歷史紀錄與調查文檔 (保留原文格式與授權) ----------
const hBx = (c, h) => `<div style="background:#fff;border-left:4px solid ${c};padding:12px 16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);">${h}</div>`;
const hDoc = (title, sub, body) => hBx("#2c4a52", `<b style="color:#1d3940;font-size:15px">${title}</b><br><span style="font-size:12.5px;color:#666">${sub}</span><div style="margin-top:8px;line-height:1.6;color:#333">${body}</div>`);

const INFIRMARY_DOCS = [
  ["漂浮於水中的發黑日記.txt", "浸濡通道中的遺留物",
    hDoc("【漂浮於浸濡通道水中的日記】", "發現狀態：浸透深棕色污水，字跡略有化開",
      `「我留在這兒太久了……我都快想念那該死的嗡鳴聲了，可現在刻在我腦子裡的，只有髒水那回盪的滴答聲，和我雙腿劈開水面時那響亮的水花聲。<br><br>我的下半身已經發黑，爛得透透的，哪怕只是輕輕蹭到什麼東西，皮就破了。我連歇口氣睡一覺都不行，因為我頭一低就會沉進水裡。<br><br>我從沒這麼無助過，也沒這麼累過，真的沒辦法休息。我就想要有個人來救我，可是這兒只有我……就我一個人被這走廊給吞了。」`)],

  ["Percy_Ghan_淵閉療舍生還評論.txt", "後室層級評論家檔案",
    hBx("#b91c1c", `<b style="color:#991b1b;font-size:14px">⚠️ 內容警告</b><br><span style="font-size:12px;color:#666">傷痛描寫 · 自殺意圖 · （明顯的）幽閉恐懼 · 自殘</span>`) +
    hDoc("Level 0.5 - “淵閉療舍” 生還總評", "發布日期：2026/07/28 ｜ 事件日期：2026/01/23 ｜ 評級：生存等級 3",
      `<b>資源：</b>2/5（食物少見） ｜ <b>逃離：</b>3/5（難以逃離）<br><b>環境：</b>4/5（極端環境風險） ｜ <b>實體：</b>2/5（少量敵意存在）<br><br>
      這是自 Level 0 熄燈區跌入的一個子層級，打死我也不想再回去了。走廊散發著發霉衣服與化學品氣味，水深齊膝，泛著油漬斑點。頭頂垂掛的藍色長方體燈時常迸出火花。<br><br>
      第 4 天牆壁轉為蟲蛀腐朽木板，出現了零食推車；第 5 天在走廊盡頭登上乾燥平台進入廢棄醫院，我終於在散發樟腦丸味的病床上睡著。<br><br>
      第 6 天，我遭遇了<b>『溺尸』</b>——像凝膠般的無骨泥質人形，以略高於步行的速度永不停歇地追逐我。最終我被逼回浸濡通道邊緣，跳入水中；而那傢伙跟著追進水裡時，身體一碰水便發出慘叫，溶成一團濃稠的沙狀泥漿。<br><br>
      第 9 天，我找到了一架金屬格柵樓梯，通向 Level 1。醫生說我的雙腿滿是積水膿皰與潰瘍，若再拖一天就會因敗血症喪命。`)],

  ["MEG_情報簡報_研究員通告.txt", "M.E.G. 官方調查與附錄",
    hDoc("M.E.G. Alpha 基地層級通告", "負責人：Alison Brown 博士 ｜ 檔號：MEG-A-005-SUB",
      `<b>關於 Level 0.5 的發現：</b><br>
      該層級於 2026/01/23 正式確認。Alison Brown 博士提出一項假說：這可能是新近誕生的一種層級動態生成現象。建議流浪者切勿刻意前往。<br><br>
      <b>其他生還者記錄：</b><br>
      • 特工 Michael Roberts：『它用安靜的嗡鳴聲與較低的濕度引誘人逃離熄燈區，但走廊裡令人發狂的迴聲遠比 Level 0 更加折磨。』<br>
      • 研究員 Bonnie McRae：『我在浸濡通道深處發現了一窪異常清澈溫暖、帶有氯氣味的水域。將頭埋進去後，我直接浮上抵達了 Level 37（泳池房）。』`)],

  ["授權與版權聲明.txt", "CC BY-SA 3.0",
    hBx("#555", `<b>作品資訊</b><br>
      條目：Level 0.5 - 「淵閉療舍」 (Abyssal Infirmary)<br>
      作者：FuneralBouncer（Discord: Bride Basher）<br>
      譯者：xuziqi，來自後室中文維基<br>
      許可協議：CC BY-SA 3.0<br><br>
      <b>參考相片來源（Wikimedia Commons）：</b><br>
      1. 《The Corridor》拍攝者：Aragonofdoros，CC BY-SA 3.0（浸濡通道原貌）<br>
      2. 《Slovakia, Komárno, hospital, abandoned building 3, 55》拍攝者：Christo，CC BY-SA 4.0（廢棄醫院）<br>
      3. 《Dülmen, Kirchspiel, Wachturm, Treppe》拍攝者：Dietmar Rabich，CC BY-SA 4.0（金屬格柵逃生梯）<br>
      （遊戲內材質皆為程序化生成與繪製，還原原作光影與氣質。）`)]
];

// ---------- 佈局生成：劃分 3 大區域 ----------
// 區域 1 (i: 0..12, j: 0..23): 浸濡通道 (齊膝污水、藍色吊燈、漂浮日記)
// 區域 2 (i: 13..16, j: 0..23): 腐木走廊 (蟲蛀木牆、零食推車、高台入口)
// 區域 3 (i: 17..23, j: 0..23): 廢棄醫院 (乾燥地磚、殘破病房、鐵架床、溺尸、格柵樓梯)

const H_WALLS_E = new Uint8Array(H_IN);
const H_WALLS_S = new Uint8Array(H_IN);
const H_FLOODED = new Uint8Array(H_IN);
const H_HOSPITAL = new Uint8Array(H_IN);
const H_WOOD = new Uint8Array(H_IN);

for (let j = 0; j < HNZ; j++) {
  for (let i = 0; i < HNX; i++) {
    const k = hk(i, j);
    if (i <= 12) H_FLOODED[k] = 1;
    else if (i <= 16) H_WOOD[k] = 1;
    else H_HOSPITAL[k] = 1;
  }
}

// 迷宮與通道雕刻
const HR = mulberry(505);
(function carveInfirmary() {
  // 默認全封閉，然後打通主要迴環走廊
  H_WALLS_E.fill(1); H_WALLS_S.fill(1);
  // 區域 1：浸濡通道迷宮
  for (let j = 0; j < HNZ; j++) {
    for (let i = 0; i <= 12; i++) {
      if (i < 12 && HR() < .65) H_WALLS_E[hk(i, j)] = 0;
      if (j < HNZ - 1 && HR() < .65) H_WALLS_S[hk(i, j)] = 0;
    }
  }
  // 保證浸濡區每格都連通：隨機牆可能切出孤島，把日記、水池或通往腐木區的開口封在外面
  // 每個鄰格附帶「要打開的牆」(陣列, 索引)；只動區域 1 內部的牆
  const nbrs = (i, j) => [[i + 1, j, H_WALLS_E, hk(i, j), i < 12], [i - 1, j, H_WALLS_E, hk(i - 1, j), i > 0],
    [i, j + 1, H_WALLS_S, hk(i, j), j < HNZ - 1], [i, j - 1, H_WALLS_S, hk(i, j - 1), j > 0]];
  const seen = new Set();
  const flood = (i0, j0) => {
    const q = [[i0, j0]]; seen.add(hk(i0, j0));
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h];
      for (const [a, b, w, wk, ok] of nbrs(i, j)) if (ok && !w[wk] && !seen.has(hk(a, b))) { seen.add(hk(a, b)); q.push([a, b]); }
    }
  };
  flood(0, 0);
  for (let grew = true; grew;) {
    grew = false;
    for (let j = 0; j < HNZ; j++) for (let i = 0; i <= 12; i++) {
      if (seen.has(hk(i, j))) continue;
      const hit = nbrs(i, j).find(([a, b, w, wk, ok]) => ok && seen.has(hk(a, b)));
      if (hit) { hit[2][hit[3]] = 0; flood(i, j); grew = true; }
    }
  }
  // 區域 2：腐木走廊（橫貫南北的幾條長走廊）
  for (let j = 0; j < HNZ; j++) {
    for (let i = 13; i <= 16; i++) {
      if (j < HNZ - 1) H_WALLS_S[hk(i, j)] = 0;
      if (i < 16 && HR() < .4) H_WALLS_E[hk(i, j)] = 0;
    }
  }
  // 打通浸濡通道到腐木走廊的開口
  H_WALLS_E[hk(12, 6)] = 0;
  H_WALLS_E[hk(12, 12)] = 0;
  H_WALLS_E[hk(12, 18)] = 0;

  // 區域 3：醫院（寬敞中廊 + 兩側病房）
  for (let j = 0; j < HNZ; j++) {
    // 中央走廊 i=19, 20 全通
    H_WALLS_S[hk(19, j)] = 0;
    H_WALLS_S[hk(20, j)] = 0;
    H_WALLS_E[hk(19, j)] = 0;
    // 平台前廳 (i=17) 與右側深處走廊 (i=22) 南北貫通，否則兩側房間彼此隔絕
    H_WALLS_S[hk(17, j)] = 0;
    H_WALLS_S[hk(22, j)] = 0;
    // 病房隔間門
    if (j % 4 === 1 || j % 4 === 2) {
      H_WALLS_E[hk(17, j)] = 0; // 前廳 -> 左側病房
      H_WALLS_E[hk(18, j)] = 0; // 左側病房 -> 中廊
      H_WALLS_E[hk(20, j)] = 0; // 中廊 -> 右側病房
      H_WALLS_E[hk(21, j)] = 0; // 右側病房 -> 深處走廊（通往出口樓梯）
    }
  }
  // 打通腐木區進入醫院高台的入口 (i=16 -> i=17)
  H_WALLS_E[hk(16, 8)] = 0;
  H_WALLS_E[hk(16, 16)] = 0;
})();

// 入口位置（西側下沉樓梯銜接處）
const H_ENTRANCE = [HX + 1.5 * HC, HZ + 12 * HC];
// 醫院高台階梯位置
const H_PLATFORM_X = HX + 17 * HC;
// 終點金屬格柵樓梯位置
const H_EXIT_STAIR = [HX + 22.5 * HC, HZ + 3.5 * HC];
// 漂浮日記位置
const H_DIARY_POS = [HX + 5.5 * HC, HZ + 14.5 * HC];
// 隱藏清澈氯水池位置 (Level 37 彩蛋)
const H_POOL_POS = [HX + 2.5 * HC, HZ + 3.5 * HC];
// M.E.G. 告示（入口旁）與床頭評論紙（病房 101）
const H_BOARD_POS = [H_ENTRANCE[0], H_ENTRANCE[1] + 2.6];
const H_REVIEW_POS = [HX + 18.5 * HC + 1.4, HZ + 6.5 * HC - 1.4];

// 地面高度：積水區 0.25（涉水下沉）、腐木區 0、平台前一段緩坡到醫院 0.6
const H_WATER_X = HX + 13 * HC;
const hFloorY = x => x >= H_PLATFORM_X ? .6 : x > H_PLATFORM_X - 1.2 ? .6 * (1 - (H_PLATFORM_X - x) / 1.2) : x < H_WATER_X ? .25 : 0;

// 格子圖：溺尸沿走廊追蹤，不穿牆
const hOpen = (i, j) => {
  const n = [];
  if (i < HNX - 1 && !H_WALLS_E[hk(i, j)]) n.push([i + 1, j]);
  if (i > 0 && !H_WALLS_E[hk(i - 1, j)]) n.push([i - 1, j]);
  if (j < HNZ - 1 && !H_WALLS_S[hk(i, j)]) n.push([i, j + 1]);
  if (j > 0 && !H_WALLS_S[hk(i, j - 1)]) n.push([i, j - 1]);
  return n;
};
const H_DIST = new Int16Array(H_IN);
const hCellOf = (x, z) => [Math.max(0, Math.min(HNX - 1, Math.floor((x - HX) / HC))), Math.max(0, Math.min(HNZ - 1, Math.floor((z - HZ) / HC)))];
function hFlow(pi, pj) {
  H_DIST.fill(-1); H_DIST[hk(pi, pj)] = 0;
  const q = [[pi, pj]];
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [a, b] of hOpen(i, j)) if (H_DIST[hk(a, b)] < 0) { H_DIST[hk(a, b)] = H_DIST[hk(i, j)] + 1; q.push([a, b]); }
  }
}

const INFIRMARY_PLACES = [
  ["西側下沉入口 · 往 Level 0", H_ENTRANCE[0], H_ENTRANCE[1]],
  ["浸濡通道 · 漂浮日記", H_DIARY_POS[0], H_DIARY_POS[1]],
  ["隱藏清澈氯水池 · Level 37 異象", H_POOL_POS[0], H_POOL_POS[1]],
  ["腐木走廊 · 補給手推車", HX + 15 * HC, HZ + 10 * HC],
  ["廢棄醫院 · 乾燥防水分隔高台", H_PLATFORM_X + 1.5, HZ + 12 * HC],
  ["醫院病房 101 · 鐵架病床", HX + 18.5 * HC, HZ + 6.5 * HC],
  ["醫院病房 102 · 舊病床", HX + 22.5 * HC, HZ + 10.5 * HC],
  ["醫院病房 103 · 醫療雜物", HX + 18.5 * HC, HZ + 18.5 * HC],
  ["金屬格柵逃生梯 · 往 Level 1", H_EXIT_STAIR[0], H_EXIT_STAIR[1]],
];

// ---------- 實體：「溺尸」(The Drowned Corpse) 狀態與模型 ----------
let drownedMesh = null, drownedActive = false, drownedAlive = true;
let drownedPos = new THREE.Vector3(0, 0, 0);
let drownedGurgleT = 3.5;
let drownedDissolveT = 0; // 融化動畫計時
let drownedFlowT = 0;     // 距離下次重算追蹤路線
const DROWNED_SPEED = 3.3; // 略高於玩家常規步行 (2.8)，小於奔跑 (5.2)

function createDrownedCorpse() {
  const g = new THREE.Group();
  const mat = getMat("drownedSlime");
  // 泥漿下肢滑動堆 (半熔融底座)
  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.45, 12), mat);
  baseMesh.position.y = 0.22; g.add(baseMesh);
  // 軀幹 (凝膠扭曲人形)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.38), mat);
  torso.position.set(0, 0.85, 0); torso.rotation.z = 0.08; g.add(torso);
  // 下垂的面部 (像中風般無力下垂)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), mat);
  head.scale.set(0.9, 1.35, 1.0); head.position.set(0.04, 1.48, 0.12); g.add(head);
  // 前伸的凝膠雙臂
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  armL.position.set(-0.35, 0.9, 0.35); armL.rotation.x = -1.1; g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), mat);
  armR.position.set(0.35, 0.85, 0.38); armR.rotation.x = -0.95; g.add(armR);

  // 滴落的水漬斑點
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.65, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x16241a, transparent: true, opacity: 0.6 }));
  puddle.position.y = 0.02; g.add(puddle);
  return g;
}

// ---------- 網格構建 ----------
let infirmaryBuilt = false;
let hWaterMesh = null;
const hSparks = [];

function buildInfirmary() {
  if (infirmaryBuilt) return;
  infirmaryBuilt = true;

  const matSoak = getMat("soakWall");
  const matWood = getMat("rottenWood");
  const matHospW = getMat("hospWall");
  const matHospF = getMat("hospTile");
  const matWater = getMat("murkyWater");
  const matGrate = getMat("metalGrate");
  const matBlue = getMat("lampBlue");
  const matFloorNorm = getMat("concreteFloor");
  const matCeilNorm = getMat("dropCeiling");

  const addP = (w, h, m, x, y, z, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); p.rotation.y = ry; infirmaryGroup.add(p);
  };
  const addBox = (w, h, d, m, x, y, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); infirmaryGroup.add(b);
  };

  // 1. 地面與天花板劃分
  // 浸濡通道：地面 y=0, 水面 y=0.35
  const waterGeo = new THREE.PlaneGeometry(13 * HC, HNZ * HC).rotateX(-Math.PI / 2);
  hWaterMesh = new THREE.Mesh(waterGeo, matWater);
  hWaterMesh.position.set(HX + 6.5 * HC, 0.35, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(hWaterMesh);

  // 通道地板與天花板
  const fGeo1 = new THREE.PlaneGeometry(13 * HC, HNZ * HC).rotateX(-Math.PI / 2);
  const fMesh1 = new THREE.Mesh(fGeo1, matFloorNorm);
  fMesh1.position.set(HX + 6.5 * HC, 0, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(fMesh1);

  const cGeo1 = new THREE.PlaneGeometry(13 * HC, HNZ * HC).rotateX(Math.PI / 2);
  const cMesh1 = new THREE.Mesh(cGeo1, matCeilNorm);
  cMesh1.position.set(HX + 6.5 * HC, HH, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(cMesh1);

  // 腐木走廊地板與天花板 (i: 13..16)
  const fGeo2 = new THREE.PlaneGeometry(4 * HC, HNZ * HC).rotateX(-Math.PI / 2);
  const fMesh2 = new THREE.Mesh(fGeo2, matFloorNorm);
  fMesh2.position.set(HX + 15 * HC, 0, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(fMesh2);

  const cGeo2 = new THREE.PlaneGeometry(4 * HC, HNZ * HC).rotateX(Math.PI / 2);
  const cMesh2 = new THREE.Mesh(cGeo2, matCeilNorm);
  cMesh2.position.set(HX + 15 * HC, HH, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(cMesh2);

  // 醫院高台地板 (y = 0.6) 與天花板 (i: 17..23)
  // 地板在螺旋梯井處挖洞 (2.4m 見方)，不然階梯會埋在地板下看不到
  const hx0 = H_PLATFORM_X, hx1 = HX + H_W, hz0 = HZ, hz1 = HZ + H_D;
  const hsx = H_EXIT_STAIR[0], hsz = H_EXIT_STAIR[1], hole = 1.2;
  const addFloor = (x0, x1, z0, z1) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), matHospF);
    f.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2); infirmaryGroup.add(f);
  };
  addFloor(hx0, hsx - hole, hz0, hz1);
  addFloor(hsx + hole, hx1, hz0, hz1);
  addFloor(hsx - hole, hsx + hole, hz0, hsz - hole);
  addFloor(hsx - hole, hsx + hole, hsz + hole, hz1);
  const shaftBottom = new THREE.Mesh(new THREE.PlaneGeometry(2 * hole, 2 * hole).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050607 }));
  shaftBottom.position.set(hsx, -2.9, hsz); infirmaryGroup.add(shaftBottom);

  // 醫院高台階梯與擋水擋板 (x = H_PLATFORM_X)
  for (let s = 0; s < 3; s++) {
    addBox(0.4, 0.2, HNZ * HC, matFloorNorm, H_PLATFORM_X - 0.2 - s * 0.4, 0.1 + s * 0.2, HZ + (HNZ / 2) * HC);
  }

  const cGeo3 = new THREE.PlaneGeometry(7 * HC, HNZ * HC).rotateX(Math.PI / 2);
  const cMesh3 = new THREE.Mesh(cGeo3, matCeilNorm);
  cMesh3.position.set(HX + 20.5 * HC, HH, HZ + (HNZ / 2) * HC);
  infirmaryGroup.add(cMesh3);

  // 2. 構建所有立面牆壁
  for (let j = 0; j < HNZ; j++) {
    for (let i = 0; i < HNX; i++) {
      const k = hk(i, j);
      const isF = H_FLOODED[k], isW = H_WOOD[k], isH = H_HOSPITAL[k];
      const mat = isF ? matSoak : isW ? matWood : matHospW;
      const [cx, cz] = hCell(i, j);
      const yBase = isH ? 0.6 : 0;
      const wallH = HH - yBase;

      // 外邊界封死
      if (i === 0) {
        addP(HC, wallH, mat, cx - HC / 2, yBase + wallH / 2, cz, Math.PI / 2);
        hAdd(i, j, [cx - HC / 2 - 0.15, cz - HC / 2, cx - HC / 2 + 0.15, cz + HC / 2]);
      }
      if (i === HNX - 1) {
        addP(HC, wallH, mat, cx + HC / 2, yBase + wallH / 2, cz, -Math.PI / 2);
        hAdd(i, j, [cx + HC / 2 - 0.15, cz - HC / 2, cx + HC / 2 + 0.15, cz + HC / 2]);
      }
      if (j === 0) {
        addP(HC, wallH, mat, cx, yBase + wallH / 2, cz - HC / 2, 0);
        hAdd(i, j, [cx - HC / 2, cz - HC / 2 - 0.15, cx + HC / 2, cz - HC / 2 + 0.15]);
      }
      if (j === HNZ - 1) {
        addP(HC, wallH, mat, cx, yBase + wallH / 2, cz + HC / 2, Math.PI);
        hAdd(i, j, [cx - HC / 2, cz + HC / 2 - 0.15, cx + HC / 2, cz + HC / 2 + 0.15]);
      }

      // 東側牆
      if (i < HNX - 1 && H_WALLS_E[k]) {
        addP(HC, wallH, mat, cx + HC / 2, yBase + wallH / 2, cz, -Math.PI / 2);
        addP(HC, wallH, mat, cx + HC / 2, yBase + wallH / 2, cz, Math.PI / 2);
        hAdd(i, j, [cx + HC / 2 - 0.15, cz - HC / 2, cx + HC / 2 + 0.15, cz + HC / 2]);
      }
      // 南側牆
      if (j < HNZ - 1 && H_WALLS_S[k]) {
        addP(HC, wallH, mat, cx, yBase + wallH / 2, cz + HC / 2, Math.PI);
        addP(HC, wallH, mat, cx, yBase + wallH / 2, cz + HC / 2, 0);
        hAdd(i, j, [cx - HC / 2, cz + HC / 2 - 0.15, cx + HC / 2, cz + HC / 2 + 0.15]);
      }
    }
  }

  // 3. 特殊燈具：浸濡通道懸垂藍色長方體燈 (短藍色長方體，從電線垂下，帶火花)
  let lampN = 0;
  for (let j = 1; j < HNZ; j += 3) {
    for (let i = 1; i <= 11; i += 3) {
      const [lx, lz] = hCell(i, j);
      // 懸吊電線
      addBox(0.02, 0.8, 0.02, getMat("steel"), lx, HH - 0.4, lz);
      // 藍色長方體發光燈具
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.75), matBlue);
      lamp.position.set(lx, HH - 0.88, lz);
      infirmaryGroup.add(lamp);
      // 點光源營造陰森藍調（每 3 盞燈只配 1 個真光源，32 個太吃效能）
      if (lampN++ % 3 === 0) {
        const pl = new THREE.PointLight(0x38bdf8, 1.4, 12, 1.8);
        pl.position.set(lx, HH - 0.95, lz);
        infirmaryGroup.add(pl);
        H_BLUE_LAMPS.push({ x: lx, z: lz, light: pl, sparkT: Math.random() * 5 });
      }
    }
  }

  // 4. 腐木走廊零食推車 (snackCart)
  const cart1 = makeProp("snackCart");
  placeAt(cart1, infirmaryGroup, HX + 15 * HC, 0, HZ + 9 * HC, Math.PI / 2);
  H_CARTS.push({ x: HX + 15 * HC, z: HZ + 9 * HC, used: false });

  const cart2 = makeProp("snackCart");
  placeAt(cart2, infirmaryGroup, HX + 14.5 * HC, 0, HZ + 16 * HC, 0);
  H_CARTS.push({ x: HX + 14.5 * HC, z: HZ + 16 * HC, used: false });

  // 5. 廢棄醫院病房道具 (hospBed, ivPole)
  const bedLocations = [
    [HX + 18.5 * HC, HZ + 6.5 * HC, 0],
    [HX + 22.2 * HC, HZ + 10.5 * HC, -Math.PI / 2],
    [HX + 18.5 * HC, HZ + 18.5 * HC, Math.PI / 2],
    [HX + 22.2 * HC, HZ + 20.5 * HC, Math.PI],
  ];
  bedLocations.forEach(([bx, bz, ry], idx) => {
    const bed = makeProp("hospBed");
    placeAt(bed, infirmaryGroup, bx, 0.6, bz, ry);
    const pole = makeProp("ivPole");
    placeAt(pole, infirmaryGroup, bx + 1.1, 0.6, bz + 0.4, ry);
    H_BEDS.push({ x: bx, z: bz, name: `病床 #${idx + 1}` });
  });

  // 6. 終點出口：冷軋鋼金屬格柵樓梯 (Watchtower Grate Stairs, image 3)
  const [sx, sz] = H_EXIT_STAIR;
  const stairG = new THREE.Group();
  stairG.position.set(sx, 0.6, sz);
  infirmaryGroup.add(stairG);
  // 螺旋格柵樓梯（原作圖 3）：中央立柱 + 繞柱下降的格柵踏板
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 10), getMat("steel"));
  pole.position.y = -1.3; stairG.add(pole);
  for (let st = 0; st < 16; st++) {
    const a = st * 0.45;
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.4), matGrate);
    stepMesh.position.set(Math.cos(a) * 0.55, -0.15 - st * 0.17, Math.sin(a) * 0.55);
    stepMesh.rotation.y = -a;
    stairG.add(stepMesh);
  }

  // 7. 溺尸實體初始化
  drownedMesh = createDrownedCorpse();
  drownedMesh.visible = false;
  infirmaryGroup.add(drownedMesh);

  // 8. 漂浮日記網格 (在浸濡通道)
  const diaryMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.48), getMat("clipboard"));
  diaryMesh.position.set(H_DIARY_POS[0], 0.38, H_DIARY_POS[1]);
  diaryMesh.rotation.y = 0.35;
  infirmaryGroup.add(diaryMesh);

  // 9. 隱藏清澈氯水池 (Level 37 彩蛋)
  const poolMesh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x4dd0e1, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }));
  poolMesh.position.set(H_POOL_POS[0], 0.21, H_POOL_POS[1]);
  infirmaryGroup.add(poolMesh);

  // 10. 入口旁的 M.E.G. 告示與病房 101 床頭的評論紙
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.7), getMat("clipboard"));
  boardMesh.position.set(H_BOARD_POS[0], 0.38, H_BOARD_POS[1]); boardMesh.rotation.y = -0.4;
  infirmaryGroup.add(boardMesh);
  const reviewMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.48), getMat("clipboard"));
  reviewMesh.position.set(H_REVIEW_POS[0], 0.64, H_REVIEW_POS[1]); reviewMesh.rotation.y = 0.5;
  infirmaryGroup.add(reviewMesh);

  // 交互註冊
  const readDoc = i => infirmaryReadDoc(INFIRMARY_DOCS[i][0], INFIRMARY_DOCS[i][2]);
  H_ACTS.push({
    x: H_DIARY_POS[0], z: H_DIARY_POS[1], r: 1.8,
    tip: "【按 E 閱讀】漂浮在污水中的發黑日記",
    act: () => readDoc(0)
  });
  H_ACTS.push({
    x: H_BOARD_POS[0], z: H_BOARD_POS[1], r: 1.4,
    tip: "【按 E 閱讀】浮在水面的 M.E.G. 通告與授權聲明",
    act: () => infirmaryReadDoc(INFIRMARY_DOCS[2][0], INFIRMARY_DOCS[2][2] + INFIRMARY_DOCS[3][2])
  });
  H_ACTS.push({
    x: H_REVIEW_POS[0], z: H_REVIEW_POS[1], r: 1.5,
    tip: "【按 E 閱讀】床頭的生還評論紙",
    act: () => readDoc(1)
  });

  H_ACTS.push({
    x: H_POOL_POS[0], z: H_POOL_POS[1], r: 2.2,
    tip: "【按 E 查看】異常清澈溫熱、帶有氯氣味的水池",
    act: () => infirmarySecretPool()
  });

  H_CARTS.forEach((c, idx) => {
    H_ACTS.push({
      x: c.x, z: c.z, r: 1.6,
      tip: "【按 E】翻找零食推車上的補給乾糧",
      act: () => infirmaryEatSnack(c)
    });
  });

  H_BEDS.forEach((b, idx) => {
    H_ACTS.push({
      x: b.x, z: b.z, r: 1.8,
      tip: `【按 E 休息】躺在${b.name}上小憩片刻`,
      act: () => infirmarySleepInBed(b)
    });
  });

  H_ACTS.push({
    x: sx, z: sz + 1.2, r: 2.0,
    tip: "【按 E 逃離】沿著金屬格柵階梯向下逃跑",
    act: () => leaveInfirmary("stairs")
  });

  H_ACTS.push({
    x: H_ENTRANCE[0], z: H_ENTRANCE[1], r: 2.0,
    tip: "【按 E】推開鐵門返回 Level 0",
    act: () => leaveInfirmary("door")
  });
}

// ---------- 玩家狀態與毒性感染機制 ----------
let infirmaryHP = 100;
let infirmaryInfection = 0; // 0..100 泡水時間引起的戰壕足與感染
let infirmarySlept = false;
let infirmarySaved = null;
let infirmaryT = 0;
let infirmarySayT = 0;
let infirmarySparksAudioT = 2.0;

function infirmaryHud() {
  const zoneName = P.x > H_PLATFORM_X ? "廢棄醫院" : P.x >= H_WATER_X ? "腐木走廊" : "浸濡通道 (積水)";
  const infText = infirmaryInfection > 40 ? ` · ⚠ 雙腿潰爛中 (${Math.floor(infirmaryInfection)}%)` : "";
  const monsterText = drownedActive && drownedAlive ? " · ⚠ 溺尸正在逼近！" : "";
  return `LEVEL 0.5 · 淵閉療舍 · ${zoneName} · 體力 ${Math.max(0, Math.ceil(infirmaryHP))}${infText}${monsterText} · E 互動`;
}

// ---------- 交互行為邏輯 ----------
function infirmaryReadDoc(file, html) {
  docBody.dataset.o ??= docBody.innerHTML;
  docBody.innerHTML = `<div style="font:12px monospace;color:#777;margin-bottom:8px">📄 ${file}</div>${html}`;
  toggleDoc(true);
}

function infirmaryEatSnack(cart) {
  if (cart.used) {
    say("這輛推車上的食物已經被拿光了，只剩下空包裝紙袋。", 3000);
    return;
  }
  cart.used = true;
  soundDrink();
  infirmaryHP = Math.min(100, infirmaryHP + 35);
  say("你撕開包裝吃了幾塊乾糧，喝下了罐裝水。體力與精神恢復了不少！", 4500);
}

function infirmarySleepInBed(bed) {
  if (state !== "play") return;
  state = "wait";
  fadeEl.innerHTML = "你疲憊不堪地倒在冰冷潮濕的病床上……<br><br><span style='font-size:16px;color:#cbd5e1'>『……你夢見了家鄉的蘋果樹，夢見了辦公桌前平靜的日光。<br>即便你知道這一切都是假的，你依然在夢中跟家人說著話，只為從這無邊的孤立中脫身……』</span>";
  fadeEl.style.opacity = 1;

  setTimeout(() => {
    fadeEl.style.opacity = 0;
    state = "play";
    infirmaryHP = 100;
    infirmaryInfection = Math.max(0, infirmaryInfection - 40);

    // 觸發「溺尸」事件！
    if (!infirmarySlept) {
      infirmarySlept = true;
      soundBang();
      say("【狂暴的撞擊聲】走廊外傳來房門瘋狂的震顫與排水孔咕嚕聲……有什麼東西來了！", 6500);
      spawnDrownedCorpse();
    } else {
      say("你小睡了一會兒，體力恢復了。", 3000);
    }
  }, 4200);
}

function infirmarySecretPool() {
  say("水溫異常暖和，帶著一股熟悉的氯氣味……據 M.E.G. 研究員 Bonnie McRae 說，把頭埋進去就能抵達 Level 37（泳池房）。（本遊戲尚未收錄該層級）", 7000);
}

// 實體追蹤與生成
function spawnDrownedCorpse() {
  drownedActive = true;
  drownedAlive = true;
  // 生成在醫院中央走廊入口
  drownedPos.set(HX + 19.5 * HC, 0.6, HZ + 12.5 * HC);
  drownedFlowT = 0; drownedDissolveT = 0;
  drownedMesh.scale.set(1, 1, 1);
  drownedMesh.position.copy(drownedPos);
  drownedMesh.visible = true;
}

// 擊殺/溶解溺尸
function dissolveDrownedCorpse() {
  drownedAlive = false;
  soundDissolve();
  say("【刺耳慘叫】溺尸的身體一碰到死水便發出狂怒的尖叫，像沙人融水般迅速化作一灘濃稠的灰泥！", 7000);
}

// ---------- 音效合成（Web Audio API） ----------
function soundBang() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(60, actx.currentTime);
  o.frequency.exponentialRampToValueAtTime(20, actx.currentTime + 0.35);
  g.gain.setValueAtTime(0.7, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.42);
  noiseBurst(180, 2, 0.4, 2, 0.15, 0.08);
}

function soundGurgle() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(140 + Math.random() * 60, actx.currentTime);
  o.frequency.exponentialRampToValueAtTime(80, actx.currentTime + 0.25);
  g.gain.setValueAtTime(0.2, actx.currentTime);
  g.gain.linearRampToValueAtTime(0, actx.currentTime + 0.28);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.3);
}

function soundDissolve() {
  if (!actx) return;
  // 慘叫與嘶嘶沸騰溶解音
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(650, actx.currentTime);
  o.frequency.exponentialRampToValueAtTime(90, actx.currentTime + 1.2);
  g.gain.setValueAtTime(0.5, actx.currentTime);
  g.gain.linearRampToValueAtTime(0, actx.currentTime + 1.3);
  o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 1.35);
  noiseBurst(1200, 4, 0.35, 4, 0.25, 0.12);
}

function soundSpark() {
  if (!actx) return;
  noiseBurst(4500, 6, 0.15, 2, 0.04, 0.03);
}

// ---------- 碰撞判定 ----------
function infirmaryCollide() {
  P.x = Math.max(HX + .4, Math.min(HX + H_W - .4, P.x));
  P.z = Math.max(HZ + .4, Math.min(HZ + H_D - .4, P.z));
  const pi = Math.floor((P.x - HX) / HC), pj = Math.floor((P.z - HZ) / HC);
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const boxes = H_BOXES.get(hk(pi + di, pj + dj));
      if (boxes) for (const b of boxes) pushOut(...b);
    }
  }
}

const infirmaryStand = (x, z) => {
  if (x < HX + .6 || x > HX + H_W - .6 || z < HZ + .6 || z > HZ + H_D - .6) return false;
  const i = Math.floor((x - HX) / HC), j = Math.floor((z - HZ) / HC);
  const boxes = H_BOXES.get(hk(i, j));
  if (boxes && boxes.some(([a, b, c, d]) => x > a - P.r && x < c + P.r && z > b - P.r && z < d + P.r)) return false;
  return true;
};

// ---------- 每幀運算 ----------
window.infirmaryInteract = {
  nearest() {
    let best = null, bd = 1e9;
    for (const a of H_ACTS) {
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      if (d < a.r && d < bd) { best = a; bd = d; }
    }
    return best;
  },
  onKeyE() {
    if (state === "play") this.nearest()?.act();
  },
  onTick(dt, t) {
    if (state !== "play") return;
    infirmaryT += dt;

    // 開場自白
    if (infirmarySayT === 0 && infirmaryT > 3) {
      infirmarySayT = 1;
      say("空氣中瀰漫著發霉衣服與化學品的刺鼻氣味。冰冷渾濁的污水沒過了小腿……", 6000);
    }
    if (infirmarySayT === 1 && infirmaryT > 25) {
      infirmarySayT = 2;
      say("頭頂的藍色燈管不時迸出火花……必須盡快找到高處乾燥的地方。", 5500);
    }

    // 1. 水位與感染判定：如果在浸濡通道 (x < H_PLATFORM_X)
    const inWater = P.x < H_WATER_X;
    P.y = hFloorY(P.x);
    if (inWater) {
      infirmaryInfection = Math.min(100, infirmaryInfection + 1.2 * dt);
      if (infirmaryInfection > 80) {
        infirmaryHP = Math.max(10, infirmaryHP - 1.5 * dt);
        if (Math.random() < 0.02) say("下半身已經發黑麻木，不能再在髒水裡泡著了！", 3500);
      }
    } else {
      infirmaryInfection = Math.max(0, infirmaryInfection - 2.5 * dt);
    }

    // 2. 藍燈電火花閃爍
    for (const lamp of H_BLUE_LAMPS) {
      lamp.sparkT -= dt;
      if (lamp.sparkT <= 0) {
        lamp.sparkT = 3 + Math.random() * 8;
        lamp.light.intensity = 0.2;
        setTimeout(() => { lamp.light.intensity = 2.4; }, 80);
        setTimeout(() => { lamp.light.intensity = 1.4; }, 160);
        if (Math.hypot(P.x - lamp.x, P.z - lamp.z) < 18) soundSpark();
      }
    }

    // 3. 實體「溺尸」AI 行為
    if (drownedActive) {
      if (drownedAlive) {
        // 追擊玩家：沿走廊格子逼近（永遠知道玩家在哪，但不穿牆）
        const dist = Math.hypot(P.x - drownedPos.x, P.z - drownedPos.z);
        let tx = P.x, tz = P.z;
        const [ci, cj] = hCellOf(drownedPos.x, drownedPos.z), [pi, pj] = hCellOf(P.x, P.z);
        if (ci !== pi || cj !== pj) {
          if ((drownedFlowT -= dt) <= 0) { drownedFlowT = .25; hFlow(pi, pj); }
          let best = H_DIST[hk(ci, cj)], bi = -1, bj = -1;
          for (const [a, b] of hOpen(ci, cj)) {
            const d = H_DIST[hk(a, b)];
            if (d >= 0 && (best < 0 || d < best)) { best = d; bi = a; bj = b; }
          }
          if (bi < 0) { tx = drownedPos.x; tz = drownedPos.z; }
          else [tx, tz] = hCell(bi, bj);
        }
        const dx = tx - drownedPos.x, dz = tz - drownedPos.z, dd = Math.hypot(dx, dz);
        if (dd > 0.15 && dist > 0.4) {
          drownedPos.x += (dx / dd) * DROWNED_SPEED * dt;
          drownedPos.z += (dz / dd) * DROWNED_SPEED * dt;
          drownedMesh.rotation.y = Math.atan2(dx, dz);
        }
        // 身體起伏呼吸動畫
        drownedMesh.scale.y = 1 + 0.08 * Math.sin(t * 4);
        drownedMesh.position.set(drownedPos.x, hFloorY(drownedPos.x) + (drownedPos.x < H_WATER_X ? .1 : 0), drownedPos.z);

        // 追逐音效
        drownedGurgleT -= dt;
        if (drownedGurgleT <= 0) {
          drownedGurgleT = 2.0 + Math.random() * 2.5;
          if (dist < 30) soundGurgle();
        }

        // 碰觸玩家受傷
        if (dist < 1.1) {
          infirmaryHP = Math.max(0, infirmaryHP - 25 * dt);
          if (infirmaryHP <= 0) return infirmaryGameOver();
        }

        // 致命弱點：被引誘進積水的浸濡通道就會溶解
        if (drownedPos.x < H_WATER_X - 0.3) {
          dissolveDrownedCorpse();
        }
      } else {
        // 溶解消散動畫
        drownedDissolveT += dt;
        drownedMesh.scale.y = Math.max(0.01, 1 - drownedDissolveT * 0.8);
        drownedMesh.scale.x = 1 + drownedDissolveT * 0.6;
        drownedMesh.scale.z = 1 + drownedDissolveT * 0.6;
        if (drownedDissolveT > 2.0) {
          drownedMesh.visible = false;
          drownedActive = false;
        }
      }
    }

    const a = this.nearest();
    if (a && !docOpen) say(a.tip, 1200);
  }
};

function infirmaryGameOver() {
  if (state !== "play") return;
  state = "wait";
  fadeEl.innerHTML = "你的雙腿被爛泥緊緊纏住，無力倒在走廊中……<br><br><span style='font-size:16px'>醒來時，你發現自己被水流沖回了入口高處。</span>";
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    P.x = H_ENTRANCE[0] + 1; P.z = H_ENTRANCE[1];
    infirmaryHP = 60; infirmaryInfection = 20; infirmarySlept = false;
    drownedActive = false; if (drownedMesh) drownedMesh.visible = false;
    fadeEl.style.opacity = 0; state = "play";
    say("你僥倖活了下來……小心別被它追上！", 4500);
  }, 3500);
}

// ---------- 進入與離開 ----------
function enterInfirmary() {
  buildInfirmary();
  infirmarySaved = mode === "map" ? [P.x, P.z, P.yaw] : [SPAWN[0], SPAWN[1], 0];
  infirmaryHP = 100;
  infirmaryInfection = 0;
  infirmarySlept = false;
  infirmaryT = 0;
  infirmarySayT = 0;
  drownedActive = false;
  drownedAlive = true;
  if (drownedMesh) { drownedMesh.visible = false; drownedMesh.scale.set(1, 1, 1); }

  mode = "infirmary";
  infirmaryGroup.visible = true;
  baseGroup.visible = tsGroup.visible = remodelGroup.visible = iceGroup.visible = false;
  floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsFar(160);

  const [fc, fd, hi, hc] = AMB[INFIRMARY_ZT];
  scene.fog.color.set(fc); scene.fog.density = fd; hemi.color.set(hc); hemi.intensity = hi;

  P.x = H_ENTRANCE[0] + 1.2; P.z = H_ENTRANCE[1];
  P.y = 0.25; P.yaw = 0; P.pitch = 0; dropY = fallV = 0;
  fadeEl.style.opacity = 0; state = "play";

  say("LEVEL 0.5 · 淵閉療舍 ——熟悉的嗡鳴聲沉寂了，膝蓋深的水花聲在死寂的走廊中迴盪。", 6500);
}

function leaveInfirmary(how) {
  if (state !== "play") return;
  state = "wait";
  fadeEl.innerHTML = how === "stairs"
    ? "你沿著金屬格柵階梯一路往下狂奔，推開沉重的防爆門……<br><b>眼前是一片寂靜冰冷的地下停車庫。你抵達了 LEVEL 1。</b>"
    : "你推開鐵門，涉水走上階梯……<br><b>熟悉的黃色隔間與嗡嗡聲再次將你包圍。</b>";
  fadeEl.style.opacity = 1;

  setTimeout(() => {
    if (how === "stairs") {
      enterBase();
      say("你成功逃離了淵閉療舍，被 M.E.G. 巡邏隊接應。", 5000);
    } else {
      enterMap();
      [P.x, P.z, P.yaw] = infirmarySaved || [SPAWN[0], SPAWN[1], 0];
      P.y = 0; dropY = fallV = 0;
      say("你回到了 Level 0。", 4000);
    }
  }, 2800);
}

// ---------- 3D 俯視地圖 (Google Maps 視角) ----------
function buildInfirmaryMap() {
  buildInfirmary();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const wh = 1.6, cx = HX + H_W / 2, cz = HZ + H_D / 2;

  // 1. 三大區域地板 (浸濡區深藍褐、腐木區暗赭石、醫院區淡灰綠)
  inst(mapWorld, flatGeo, mat(0x283b42), [[HX + 6.5 * HC, 0.02, cz, 0, 13 * HC, 1, H_D]]);
  inst(mapWorld, flatGeo, mat(0x4a3b2c), [[HX + 15 * HC, 0.03, cz, 0, 4 * HC, 1, H_D]]);
  inst(mapWorld, flatGeo, mat(0xa8b8b0), [[HX + 20.5 * HC, 0.06, cz, 0, 7 * HC, 1, H_D]]);

  // 2. 實體牆壁渲染
  const walls = [];
  const tr = ([a, b, c, d], h) => [(a + c) / 2, h / 2, (b + d) / 2, 0, Math.max(.3, c - a), h / H, Math.max(.3, d - b)];
  for (const l of H_BOXES.values()) {
    for (const b of l) walls.push(tr(b, wh));
  }
  inst(mapWorld, boxGeo, mat(0xd5cec0), walls);

  // 3. 地標標記色塊 (綠色床鋪、黃色補給車、紅色階梯、天藍色彩蛋水池)
  inst(mapWorld, flatGeo, mat(0x22c55e), H_BEDS.map(b => [b.x, 0.12, b.z, 0, 2.2, 1, 1.4]));
  inst(mapWorld, flatGeo, mat(0xfacc15), H_CARTS.map(c => [c.x, 0.12, c.z, 0, 1.4, 1, 1.0]));
  inst(mapWorld, flatGeo, mat(0xef4444), [[H_EXIT_STAIR[0], 0.14, H_EXIT_STAIR[1], 0, 2.4, 1, 2.4]]);
  inst(mapWorld, flatGeo, mat(0x06b6d4), [[H_POOL_POS[0], 0.08, H_POOL_POS[1], 0, 2.8, 1, 2.8]]);
}
