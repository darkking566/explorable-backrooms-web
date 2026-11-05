"use strict";
// ---------- Level 0.3「冰室」: Level 0 under ice, and the wreck of 後室裝修公司's task force 104-CX ----------
// Source: https://backrooms-wiki-cn.wikidot.com/level-0-3 (CursedSliver, translated by Ambersight, CC BY-SA 3.0).
// A 128 m x 128 m maze of 4 m cells, frosted yellow wallpaper, dead-end rooms packed with ice, vents that blow cold mist and
// never stay where they were. Nine camps (wool carpet, green lamp, folding table) hold the crew's mails and reports in
// order of distance from the entrance; they are also the only warm places. Warmth drains in the open and faster near a vent.
// The Part3 brick shaft is a second way out. Layout is pure data made at load (the map and its labels need it); meshes on first entry.

const IX = 2000, IZ = 40, IC = 4, INX = 32, INZ = 32, IW = INX * IC, ID = INZ * IC, IH = 3;
const ICE_ZT = 17, ICE_CAMP_R = 4.2, ICE_NV = 6;
const IN = INX * INZ, ik = (i, j) => j * INX + i;
const ICE_BOXES = new Map();                // cell -> solid [x0, z0, x1, z1] boxes it owns (walls, ice, shaft)
const ICE_BLOCKS = [], ICE_PARTIAL = [];    // ice-filled dead ends [cx, cz]; lone ice lumps [x, z, w, h]
const ICE_ACTS = [], ICE_CAMPS = [], ICE_SLOTS = [];
const iceGroup = new THREE.Group(); iceGroup.visible = false; scene.add(iceGroup);
AMB[ICE_ZT] = [0x8fa9bb, .022, 2.7, 0xdceeff];

const ICE_DOORS = [{ i: 0, j: 16, nx: -1, nz: 0, name: "西側鐵門" }, { i: 31, j: 5, nx: 1, nz: 0, name: "東側鐵門" }, { i: 20, j: 31, nx: 0, nz: 1, name: "南側鐵門" }];
for (const d of ICE_DOORS) { d.x = IX + (d.i + .5 + d.nx * .5) * IC; d.z = IZ + (d.j + .5 + d.nz * .5) * IC; }
const icCell = (i, j) => [IX + (i + .5) * IC, IZ + (j + .5) * IC];
const icAdd = (i, j, b) => { const k = ik(Math.max(0, Math.min(INX - 1, i)), Math.max(0, Math.min(INZ - 1, j))); (ICE_BOXES.get(k) || ICE_BOXES.set(k, []).get(k)).push(b); };

// ---------- 文件：維基頁上的九份紀錄（刪除線保留；越到後來越不像是同一個人在寫） ----------
const X = t => `<s style="color:#999">${t}</s>`;
const bx = (c, h) => `<div style="background:#fff;border-left:4px solid ${c};padding:12px 16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);">${h}</div>`;
const mail = (to, from, date, title, body) => bx("#3b3866", `<div style="font-size:12.5px;color:#555;line-height:1.5;margin-bottom:6px"><b>發往：</b>${to}<br><b>來自：</b>${from}<br><b>日期：</b>${date}<br><b>標題：</b>${title}</div>${body}`);
const rep = (title, sub, body) => bx("#d3ae00", `<b style="color:#8a6f00;font-size:15px">${title}</b><br><b>${sub}</b><br>${body}`);
const PL = "Planes（特遣部隊104-CX）", BOSS = "主要負責人";
const ICE_DOCS = [
  ["郵件日誌_2019_09_02.txt", "任務指派", mail(PL, BOSS, "2019/09/02", "重建任務指派 - 解凍冰室", "嗨，<br>如果你收到了這封郵件，就代表你已被指派為冰室的改造者。更多有關這項任務的信息可在附件中查看。<br>祝你好運！") +
    bx("#3b3866", `<u>附件（2）：</u><br><b>重建任務指派 - Level 0.3</b><br>目標：Level 0.3<br>部門：A891-01<br>目的：解凍，B類重建<br>特遣部隊：104-CX<br>特遣部隊成員：Planes、Chris、Havec、Evie<br>開始日期：2019/09/02<br>預計終止日期：2019/12/31<br>額外裝備：噴槍x2<br>備註：在重建Level 0時發生的那場災難之後，我依舊信任你們每個人，你們一定可以帶來一些乾淨、整潔、舒適、溫暖的房間！所以，你們工作的時候最好用上我們提供的工具！明白嗎？<br>真誠的，<br>${BOSS}`)],
  ["重建報告2019_09_09.txt", "九月報告", rep("我們正在很努力地重建Level 0.3！", "概要", "不得不說，冰室裡真是一團糟，但是請放心，我們修復它的進程非常順利！看看這些沾滿冰霜的噁心地毯，簡直和沙礫一樣粗糙，對吧？我們只花了一眨眼的時間就把它們換掉了。看看這些裸露的牆皮，外面還黏著幾片凍得發白的牆紙，誰能在一瞬間就把它們都撕下來？我們依據我們的改進方案覆蓋了它們。看看這些房間裡的大冰塊，都快把整個房間填滿了，不是嗎？噴槍會完美地解決它們的。Havec正在加把勁兒給它們抽氣！<br><i>真是亂七八糟……誰能想到牆皮也會得凍瘡呢？</i>")],
  ["郵件日誌_2019_10_29.txt", "求援（一）", mail(BOSS, PL, "2019/10/29", "回覆：重建任務指派 - 解凍冰室", `能給點補給嗎？這裡的冰比我們最開始預想的還要多……<br>謝謝。<br>${X("Planes")}特遣部隊104-CX`) +
    mail(PL, BOSS, "2019/10/29", "回覆：回覆：重建任務指派 - 解凍冰室", "啊，馬上派遣特遣部隊105-CX！")],
  ["重建報告2019_11_01.txt", "十一月報告", rep(`重建進展順利！我們已經搞定了所有的牆、牆紙和地毯。${X("反正我覺得是搞定了")}`, "概要", `我們已經用這些柔軟舒適的羊毛毯代替了舊地毯，擦乾淨了牆，撤下了這些噁心的牆紙，換上了怎麼說都更好看的牆紙。我們現在正在幹其他次要的活兒！不幸的是，我們的噴槍已經不能用了，不過沒關係，我們還是能夠很快解決的，我們有整整${X("四")}六個人呢。<br>如果一定要說有什麼問題的話，那就是這兒的通風口了……這些玩意兒不停地往外吹冷氣，想把${X("一切")}大部分東西都毀掉！我們努力地試過把它堵住了，但是不怎麼管用。呃啊，我保證我很快就會搞定它們的！<br>我們也在${X("充滿希望地")}翻新這些過時的老頑固。`)],
  ["郵件日誌_2019_11_30.txt", "求援（二）", mail(BOSS, PL, "2019/11/30", "解凍工作：需要支援", "已經過了一個月了，請問能不能再派幾個人手？<br>謝謝。<br>Planes（特遣部隊104-CX）") +
    mail(PL, BOSS, "2019/11/30", "回覆：解凍工作：需要支援", "啥？我們不是派過了嗎？別告訴我你們又全都在偷懶。") +
    mail(BOSS, PL, "2019/11/30", "回覆：回覆：解凍工作：需要支援", `不是！絕對不是！我們都在搞那些通風口，${X("因為霧氣")}因為我們精益求精！就是這樣！${X("太對了")}`) +
    mail(PL, BOSS, "2019/11/30", "回覆：回覆：回覆：解凍工作：需要支援", "行吧……我們很快就會再派出一支特遣部隊。")],
  ["重建報告2019_11_31.txt", "通氣管", rep("我們已經確定一切都完美了！", "概要", `呃，我們剛才正在改善通風口，一切都在步入正軌！這裡的地毯${X("幾乎不能堅持")}棒極了！這裡的牆紙${X("又剝落")}是極好的！我們正在收拾這些有幾百年歷史的通氣管，它們馬上就會嶄嶄新！當然了，這個比較困難……它們老在周圍跳來跳去，不會一直待在一個地方，而且${X("我們還是沒法堵住霧")}不用擔心，它們${X("當然")}絕對會在我們${X("探索")}清理好通風口之後變好的！無需多慮！<br>看看這些鐵鏽！${X("還不止這點兒呢")}`)],
  ["郵件日誌_2019_12_29.txt", "工期倒數", mail(PL, BOSS, "2019/12/29", "解凍任務檢查", "情況怎麼樣？希望你沒忘記，離工期結束只剩兩天了！") +
    mail(BOSS, PL, "2019/12/29", "回覆：解凍任務檢查", `${X("我")}我們知道工期馬上到了，但我們也差不多，就差一點就好了！能不能給${X("我")}我們再派一個特遣隊，或者隨便什麼能幫${X("我")}我們搞定這些的東西？我的意思是，幫${X("我")}我們進一步把這裡變得更完美？${X("求求")}`) +
    mail(PL, BOSS, "2019/12/29", "回覆：回覆：解凍任務檢查", "在收到這封郵件的時候，特遣部隊108-CX應該也到了吧，我猜。對他們好點！")],
  ["重建報告2019_12_31.txt", "最後一份報告", rep("煥然一新的房間！", "描述", `${X("我覺得")}我們已經${X("成功地")}翻新了Level 0.3……我們更換了地毯、重貼了牆紙，我覺得還改善了照明，還有呃呃呃${X("通風口")}所有別的東西！我們也搞定了這些大冰塊${X("差不多吧")}而且，呃，${X("我們")}這些房間終於完`)],
  ["郵件日誌_2020_01_01.txt", "你們人呢？", mail(PL, BOSS, "2020/01/01", "我已經到達了你們重建的地點，Level 0.3", "你們人呢？<br>還有，特遣部隊105-CX、107-CX和108-CX是怎麼回事？？？")],
];
const ICE_CREDITS = ["生成日期_2022_4_28.txt", bx("#555", `<b>圖像／作者</b><br>作者：CursedSliver<br>特別鳴謝：JamiMyst（創造了這個div文字框）、CutTheBirch（綠燈！）<br>譯者：Ambersight<br><br><b>圖片</b><br>「客廳考古」拍攝者 Erich Ferdinand，CC BY 2.0，經過二次加工。<br>「一組排氣口」拍攝者 George Terezakis，CC BY-SA 2.0，經過二次加工。<br>「地下探險」拍攝者 darkday，CC BY 2.0。<br>（遊戲內貼圖皆為程序繪製，只借鑒構圖，沒有嵌入原照片。）<br><br><span style="font-size:12px;color:#666">Level 0.3 - 「冰室」，作者 CursedSliver，來自後室英文維基（backrooms-wiki.wikidot.com/level-0-3）。譯者 Ambersight，來自後室中文維基（backrooms-wiki-cn.wikidot.com/level-0-3）。遵循 CC BY-SA 3.0 協議。</span>`)];

// ---------- 佈局：迷宮、營地、豎井、冰塊（純資料） ----------
const openE = new Uint8Array(IN), openS = new Uint8Array(IN);   // passage to the east / south neighbour
const IR = mulberry(303);
(function carve() {
  const seen = new Uint8Array(IN), st = [ik(0, 16)]; seen[st[0]] = 1;
  const link = (a, b) => { if (b === a + 1) openE[a] = 1; else if (b === a - 1) openE[b] = 1; else if (b === a + INX) openS[a] = 1; else openS[b] = 1; };
  while (st.length) {
    const a = st[st.length - 1], i = a % INX, j = a / INX | 0;
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < INX && y < INZ && !seen[ik(x, y)]);
    if (!nb.length) { st.pop(); continue; }
    const [x, y] = nb[IR() * nb.length | 0], b = ik(x, y); link(a, b); seen[b] = 1; st.push(b);
  }
  for (let j = 0; j < INZ; j++) for (let i = 0; i < INX; i++) {   // loops: knock some walls through
    if (i < INX - 1 && !openE[ik(i, j)] && IR() < .13) openE[ik(i, j)] = 1;
    if (j < INZ - 1 && !openS[ik(i, j)] && IR() < .13) openS[ik(i, j)] = 1;
  }
})();
const iceOpenN = (i, j) => [i < INX - 1 && openE[ik(i, j)] ? [1, 0] : null, i > 0 && openE[ik(i - 1, j)] ? [-1, 0] : null, j < INZ - 1 && openS[ik(i, j)] ? [0, 1] : null, j > 0 && openS[ik(i, j - 1)] ? [0, -1] : null].filter(Boolean);
const iceDist = new Int16Array(IN).fill(-1);
(function bfs() {
  const q = [ik(0, 16)]; iceDist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) { const a = q[h], i = a % INX, j = a / INX | 0; for (const [dx, dz] of iceOpenN(i, j)) { const b = ik(i + dx, j + dz); if (iceDist[b] < 0) { iceDist[b] = iceDist[a] + 1; q.push(b); } } }
})();
const iceMaxD = Math.max(...iceDist);
const iceSpecial = new Set(ICE_DOORS.map(d => ik(d.i, d.j)));
const icePick = (target, wantDead, minGap) => {   // a dead end (or corridor) whose distance from the entrance is nearest target
  let best = -1, bs = 1e9;
  for (let a = 0; a < IN; a++) {
    const i = a % INX, j = a / INX | 0, n = iceOpenN(i, j).length;
    if (iceDist[a] < 0 || n > 2 || iceSpecial.has(a)) continue;
    if ([...iceSpecial].some(s => Math.abs((s % INX) - i) + Math.abs((s / INX | 0) - j) < minGap)) continue;
    const sc = Math.abs(iceDist[a] - target) + (wantDead && n > 1 ? 7 : 0) + IR();
    if (sc < bs) { bs = sc; best = a; }
  }
  iceSpecial.add(best); return best;
};
const ICE_CAMP_CELLS = [];
for (let k = 0; k < 9; k++) ICE_CAMP_CELLS.push(icePick(k === 8 ? iceMaxD : iceMaxD * (.06 + .8 * k / 8), true, 5));
const ICE_SHAFT = icePick(iceMaxD * .62, true, 5);
const iceShaftDir = iceOpenN(ICE_SHAFT % INX, ICE_SHAFT / INX | 0)[0];
for (let a = 0; a < IN; a++) {                    // ice packs dead ends and drops lumps in rooms; never a camp, door or the shaft
  const i = a % INX, j = a / INX | 0;
  if (iceSpecial.has(a) || iceDist[a] < 0 || ICE_DOORS.some(d => Math.abs(d.i - i) + Math.abs(d.j - j) < 3)) continue;
  const [cx, cz] = icCell(i, j);
  if (iceOpenN(i, j).length === 1) { if (IR() < .8) { ICE_BLOCKS.push([cx, cz]); icAdd(i, j, [cx - 1.85, cz - 1.85, cx + 1.85, cz + 1.85]); } }
  else if (IR() < .09) { const w = 1.4 + IR() * .4, h = 1.2 + IR() * 1.4, ox = (IR() < .5 ? -1 : 1) * 1.1, oz = (IR() < .5 ? -1 : 1) * 1.1; ICE_PARTIAL.push([cx + ox, cz + oz, w, h]); icAdd(i, j, [cx + ox - w / 2, cz + oz - w / 2, cx + ox + w / 2, cz + oz + w / 2]); }
}
const ICE_NAMES = ICE_DOCS.map(d => d[1]);
const ICE_PLACES = [
  ...ICE_DOORS.map(d => [d.name + " · 回 Level 0", d.x - d.nx * 3.5, d.z - d.nz * 3.5]),
  ...ICE_CAMP_CELLS.map((a, k) => { const [x, z] = icCell(a % INX, a / INX | 0); return [`營地 ${k + 1} · ${ICE_NAMES[k]}`, x, z]; }),
  ["磚砌豎井 · 鐵梯", ...icCell(ICE_SHAFT % INX, ICE_SHAFT / INX | 0)],
];

// ---------- 碰撞與站立 ----------
const iceNear = (x, z, f) => { const ci = Math.floor((x - IX) / IC), cj = Math.floor((z - IZ) / IC); for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const b of ICE_BOXES.get(ik(Math.max(0, Math.min(INX - 1, i)), Math.max(0, Math.min(INZ - 1, j)))) || []) f(b); };
function iceCollide() {
  P.x = Math.max(IX + .4, Math.min(IX + IW - .4, P.x)); P.z = Math.max(IZ + .4, Math.min(IZ + ID - .4, P.z));
  iceNear(P.x, P.z, b => pushOut(...b));
}
const iceStand = (x, z) => { let ok = x > IX + .6 && x < IX + IW - .6 && z > IZ + .6 && z < IZ + ID - .6; if (ok) iceNear(x, z, b => { if (x > b[0] - P.r && x < b[2] + P.r && z > b[1] - P.r && z < b[3] + P.r) ok = false; }); return ok; };

// ---------- 運行時狀態 ----------
let iceW = 100, iceRead = new Set(), iceCheck = null, iceSaved = null, iceT = 0, iceWindT = 3, iceSay = 0, iceVents = [], icePuffs = [], iceBuilt = false;
const iceTemp = () => (28 + iceW * .085).toFixed(1);
const iceHud = () => `LEVEL 0.3 · 冰室 · 體溫 ${iceTemp()}°C${iceW < 30 ? " ⚠ 失溫" : ""} · 紀錄 ${iceRead.size}/9 · E 互動`;

// ---------- 建構 ----------
function buildIce() {
  if (iceBuilt) return; iceBuilt = true;
  const add = (geo, mat, x, y, z, ry = 0, parent = iceGroup) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = iceGroup) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const put = (name, x, y, z, ry = 0) => placeAt(makeProp(name), iceGroup, x, y, z, ry);
  const plane = (w, h, mat, x, y, z, ry = 0, parent = iceGroup) => add(new THREE.PlaneGeometry(w, h), mat, x, y, z, ry, parent);
  const act = (x, z, r, tip, fn) => ICE_ACTS.push({ x, z, r, tip, act: fn });
  const sc = [IX + IW / 2, IZ + ID / 2];

  // floor and ceiling (the ceiling has a hole over the shaft)
  add(new THREE.PlaneGeometry(IW, ID).rotateX(-Math.PI / 2), getMat("iceFloor", IW / 2, ID / 2), sc[0], 0, sc[1]);
  const [scx, scz] = icCell(ICE_SHAFT % INX, ICE_SHAFT / INX | 0), sh = new THREE.Shape([[0, 0], [IW, 0], [IW, ID], [0, ID]].map(p => new THREE.Vector2(...p)));
  const hole = new THREE.Path([[scx - IX - 1.2, scz - IZ - 1.2], [scx - IX - 1.2, scz - IZ + 1.2], [scx - IX + 1.2, scz - IZ + 1.2], [scx - IX + 1.2, scz - IZ - 1.2]].map(p => new THREE.Vector2(...p))); sh.holes.push(hole);
  add(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), getMat("iceCeil", .5, .5), IX, IH, IZ);

  // walls: frosted paper, some with rust showing; every other passage gets a doorway
  const wr = mulberry(41), A = [], B = [], J = [], L = [], slots = [];
  const edge = (E, i, j, kind) => {            // kind: 1 closed, 2 doorway
    if (!kind) return;
    const x = E ? IX + (i + 1) * IC : IX + (i + .5) * IC, z = E ? IZ + (j + .5) * IC : IZ + (j + 1) * IC, ry = E ? Math.PI / 2 : 0, tgt = wr() < .24 ? B : A;
    const bx0 = (cx, cz, len) => E ? [cx - T / 2, cz - len / 2, cx + T / 2, cz + len / 2] : [cx - len / 2, cz - T / 2, cx + len / 2, cz + T / 2];
    if (kind === 1) { tgt.push([x, IH / 2, z, ry, IC + T, IH, T]); icAdd(i, j, bx0(x, z, IC + T)); slots.push({ x, z, v: E }); return; }
    for (const s of [-1, 1]) { const px = E ? x : x + s * 1.3, pz = E ? z + s * 1.3 : z; J.push([px, IH / 2, pz, ry, 1.4, IH, T]); icAdd(i, j, bx0(px, pz, 1.4)); }
    L.push([x, 2.1 + (IH - 2.1) / 2, z, ry, 1.2, IH - 2.1, T]);
  };
  for (let j = 0; j < INZ; j++) for (let i = -1; i < INX; i++) { const door = ICE_DOORS.some(d => d.nx && d.i === (d.nx < 0 ? 0 : INX - 1) && d.j === j && i === (d.nx < 0 ? -1 : INX - 1)); edge(true, i, j, door ? 2 : i < 0 || i === INX - 1 ? 1 : openE[ik(i, j)] ? (wr() < .45 ? 2 : 0) : 1); }
  for (let j = -1; j < INZ; j++) for (let i = 0; i < INX; i++) { const door = ICE_DOORS.some(d => d.nz && d.i === i && j === INZ - 1); edge(false, i, j, door ? 2 : j < 0 || j === INZ - 1 ? 1 : openS[ik(i, j)] ? (wr() < .45 ? 2 : 0) : 1); }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  inst(iceGroup, unit, getMat("iceWall"), A); inst(iceGroup, unit, getMat("iceWallRust"), B); inst(iceGroup, unit, getMat("iceWall"), J.concat(L));
  ICE_SLOTS.push(...slots.filter(s => s.x > IX + 1 && s.x < IX + IW - 1 && s.z > IZ + 1 && s.z < IZ + ID - 1));

  // ice: dead ends packed solid (with a darker heart), lumps in rooms, icicles
  const iceM = getMat("iceBlock"), coreM = getMat("iceCore"), bh = IH - .25;
  inst(iceGroup, unit, iceM, ICE_BLOCKS.map(([x, z]) => [x, bh / 2, z, 0, IC - .3, bh, IC - .3]));
  inst(iceGroup, unit, coreM, ICE_BLOCKS.map(([x, z]) => [x, bh / 2, z, 0, IC - 1.2, bh - .5, IC - 1.2]));
  inst(iceGroup, unit, iceM, ICE_PARTIAL.map(([x, z, w, h]) => [x, h / 2, z, 0, w, h, w]));
  inst(iceGroup, unit, coreM, ICE_PARTIAL.map(([x, z, w, h]) => [x, h / 2, z, 0, w * .55, h * .8, w * .55]));
  const ir = mulberry(7), cones = [];
  for (let n = 0; n < 160; n++) cones.push([IX + 1 + ir() * (IW - 2), IH - .4, IZ + 1 + ir() * (ID - 2), 0, .5 + ir() * .7, .6 + ir() * .9, .5 + ir() * .7]);
  inst(iceGroup, new THREE.ConeGeometry(.12, .9, 6).rotateX(Math.PI), iceM, cones);

  // ceiling panels, some dead; a cold pool of light under each live one
  const lights = [], dead = [], pools = [];
  for (let j = 1; j < INZ; j += 2) for (let i = (j / 2 | 0) % 2; i < INX; i += 2) { const [x, z] = icCell(i, j), r = ir(); if (r < .22) dead.push([x, IH - .02, z, 0, 1.2, 1, .6]); else if (r < .85) { lights.push([x, IH - .02, z, 0, 1.2, 1, .6]); pools.push([x, .03, z, 0, 4, 1, 4]); } }
  const pg = new THREE.BoxGeometry(1, .04, 1);
  inst(iceGroup, pg, getMat("lampCool"), lights); inst(iceGroup, pg, getMat("routerBlack"), dead);
  const poolM = glow(0xcfe8ff); poolM.opacity = .3; inst(iceGroup, flatGeo, poolM, pools);

  // doors back to Level 0: a frosted frame with a green lamp over it, the yellow beyond
  const vestM = wallMats[0].map(m => { const c = m.clone(); c.side = THREE.BackSide; return c; }), frameM = getMat("doorFrame");
  for (const d of ICE_DOORS) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = Math.atan2(d.nx, d.nz); iceGroup.add(g);
    box(.1, 2.1, .3, frameM, -.6, 1.05, 0, 0, g); box(.1, 2.1, .3, frameM, .6, 1.05, 0, 0, g); box(1.3, .1, .3, frameM, 0, 2.1, 0, 0, g);
    box(.3, .06, .1, getMat("lampGreen"), 0, 2.25, 0, 0, g);
    add(new THREE.BoxGeometry(2.8, IH, 3.2), vestM, 0, IH / 2, 1.8, 0, g);
    plane(2.4, 2.4, glow(0xffe890), 0, 1.4, 3.2, Math.PI, g).material.opacity = .5;
    act(d.x - d.nx * .8, d.z - d.nz * .8, 2.2, `【按 E 或走進門】推開${d.name}，回到 Level 0`, () => leaveIce());
  }

  // camps: wool carpet, green lamp, a folding table with the paper on it; a camp is warm
  const greenGlow = glow(0x60ff90), warmGlow = glow(0xffc070); greenGlow.opacity = .3; warmGlow.opacity = .25;
  const hat = (x, y, z, c) => add(new THREE.SphereGeometry(.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), getMat("hardHat"), x, y, z);
  ICE_CAMP_CELLS.forEach((a, k) => {
    const [cx, cz] = icCell(a % INX, a / INX | 0), r = mulberry(100 + k), ry = r() * Math.PI;
    ICE_CAMPS.push({ x: cx, z: cz, k });
    plane(3.6, 3.6, getMat("woolCarpet", 3, 3), cx, .014, cz).rotation.x = -Math.PI / 2;
    box(1.2, .04, .6, getMat("lampGreen"), cx, IH - .02, cz);
    const gp = plane(4, 4, greenGlow, cx, .03, cz); gp.rotation.x = -Math.PI / 2; const wp = plane(5.5, 5.5, warmGlow, cx, .035, cz); wp.rotation.x = -Math.PI / 2;
    put("foldingTable", cx, 0, cz, ry); box(.34, .012, .24, getMat("paperLitter"), cx, .765, cz, ry + .3);
    put("crate", cx + 1.3, 0, cz - 1.2, r()); put("paintCan", cx - 1.2, 0, cz + 1.3, r());
    if (k === 1 || k === 4) {                  // the two flame guns, dead
      const fg = new THREE.Group(); fg.position.set(cx - 1.2, 0, cz - 1.1); fg.rotation.y = r() * 3; iceGroup.add(fg);
      box(.22, .22, .7, getMat("steel"), 0, .12, 0, 0, fg); box(.06, .06, .9, getMat("rust"), 0, .1, .75, 0, fg);
      act(cx - 1.2, cz - 1.1, 1.4, "【按 E】檢查噴槍", () => say("噴槍已經結了冰，扳機卡死了。喷口裡塞滿了白霜，沒有任何反應。", 5000));
    }
    const [file, , html] = ICE_DOCS[k];
    act(cx, cz, 1.6, `【按 E】翻閱 ${file}`, () => iceReadDoc(file, html, k));
  });
  // the last camp: four hard hats in a row, the mission board, nobody
  const [fx, fz] = icCell(ICE_CAMP_CELLS[8] % INX, ICE_CAMP_CELLS[8] / INX | 0);
  ["Planes", "Chris", "Havec", "Evie"].forEach((n, k) => { hat(fx - 1.2 + k * .8, .1, fz + 1.5); });
  act(fx, fz + 1.5, 1.6, "【按 E】查看安全帽", () => say("四頂安全帽整整齊齊擺在地上：Planes、Chris、Havec、Evie。帽子是冰的，沒有人。", 6500));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ map: canvasTex(512, 312, (g, w, h) => {
    g.fillStyle = "#e9eef0"; g.fillRect(0, 0, w, h); g.fillStyle = "#1c1a30"; g.font = "bold 30px sans-serif"; g.fillText("任務看板 · Level 0.3", 24, 44);
    g.font = "24px monospace"; [["104-CX", "—— 無回應"], ["105-CX", "—— 無回應"], ["107-CX", "—— 無回應"], ["108-CX", "—— 無回應"]].forEach(([a, b], n) => { g.fillStyle = "#222"; g.fillText(a, 28, 100 + n * 46); g.fillStyle = "#b91c1c"; g.fillText(b, 190, 100 + n * 46); });
  }) }));
  board.position.set(fx, 1.5, fz - 1.8); iceGroup.add(board);

  // the shaft: a brick closet, open toward its one passage, climbing into the light
  const sd = iceShaftDir || [1, 0], g = new THREE.Group(); g.position.set(scx, 0, scz); g.rotation.y = Math.atan2(sd[0], sd[1]); iceGroup.add(g);
  const brickM = getMat("brick", 2, 9);
  plane(2.4, 11, brickM, 0, 5.5, -1.2, 0, g); plane(2.4, 11, brickM, -1.2, 5.5, 0, Math.PI / 2, g); plane(2.4, 11, brickM, 1.2, 5.5, 0, Math.PI / 2, g);
  add(new THREE.PlaneGeometry(2.4, 2.4).rotateX(Math.PI / 2), getMat("lampCool"), 0, 10.95, 0, 0, g);
  for (let y = .6; y < 10.4; y += .5) box(.5, .05, .06, getMat("rust"), 0, y, -1.12, 0, g);
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ax !== sd[0] || az !== sd[1]) icAdd(ICE_SHAFT % INX, ICE_SHAFT / INX | 0, [scx + ax * 1.2 - (ax ? .06 : 1.25), scz + az * 1.2 - (az ? .06 : 1.25), scx + ax * 1.2 + (ax ? .06 : 1.25), scz + az * 1.2 + (az ? .06 : 1.25)]);
  act(scx - sd[0] * .9, scz - sd[1] * .9, 1.3, "【按 E】沿鐵梯往上爬", () => leaveIce("ladder"));
  act(scx + sd[0] * .2 - sd[1] * .9, scz + sd[1] * .2 + sd[0] * .9, 1.3, "【按 E】牆上釘著一份發黃的紙", () => iceReadDoc(ICE_CREDITS[0], ICE_CREDITS[1], -1));

  // vents: three hatches on a pale wall; they roam when nobody is looking
  const ventG = new THREE.PlaneGeometry(1.5, .75), ventM = getMat("ventPlate");
  for (let n = 0; n < ICE_NV; n++) { const m = new THREE.Mesh(ventG, ventM); iceGroup.add(m); iceVents.push({ m, x: 0, z: 0, nx: 0, nz: 1, t: 0, e: 0 }); }
  for (let n = 0; n < 70; n++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdff0ff, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; iceGroup.add(s); icePuffs.push({ s, t: 9, life: 4, vx: 0, vz: 0 }); }
}

// a vent hops to a wall slot 6-24 m away that is not in front of the player
function ventMove(v, first) {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  for (let n = 0; n < 40; n++) {
    const s = ICE_SLOTS[Math.random() * ICE_SLOTS.length | 0], dx = s.x - P.x, dz = s.z - P.z, d = Math.hypot(dx, dz);
    if (d < (first ? 10 : 6) || d > (first ? 45 : 24) || (!first && (dx * fx + dz * fz) / d > .1)) continue;
    const side = Math.random() < .5 ? 1 : -1, nx = s.v ? side : 0, nz = s.v ? 0 : side, off = (Math.random() - .5) * 2;
    v.x = s.x + (s.v ? 0 : off) + nx * (T / 2 + .02); v.z = s.z + (s.v ? off : 0) + nz * (T / 2 + .02); v.nx = nx; v.nz = nz;
    v.m.position.set(v.x, 1.35, v.z); v.m.rotation.y = Math.atan2(nx, nz); v.t = 8 + Math.random() * 8; return;
  }
}
const ventSeen = v => { const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz) || 1; return d < 30 && (dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw)) / d > .3; };

// ---------- 讀文件 ----------
function iceReadDoc(file, html, k) {
  docBody.dataset.o ??= docBody.innerHTML;
  docBody.innerHTML = `<div style="font:12px monospace;color:#777;margin-bottom:8px">📄 ${file}</div>${html}`;
  toggleDoc(true);
  if (k >= 0 && !iceRead.has(k)) {
    iceRead.add(k);
    if (iceRead.size === 9) setTimeout(() => say("九份紀錄都讀完了。最後那封信的收件人是 Planes，可是 Planes 不在這裡。", 7000), 800);
  }
}

// ---------- 每幀 ----------
window.iceInteract = {
  nearest() { let best = null, bd = 1e9; for (const a of ICE_ACTS) { const d = Math.hypot(P.x - a.x, P.z - a.z); if (d < a.r && d < bd) { best = a; bd = d; } } return best; },
  onKeyE() { if (state === "play") this.nearest()?.act(); },
  onTick(dt, t) {
    if (state !== "play") return;
    iceT += dt;
    if (iceSay === 0 && iceT > 6) { iceSay = 1; say("吐出的氣息立刻變成白霧。牆紙結著霜，地毯硬得像砂礫。這裡的燈還亮著。", 6500); }
    if (iceSay === 1 && iceT > 40) { iceSay = 2; say("遠處的綠燈下有一點暖意。冷的時候，先去找綠燈。", 5500); }
    // vents: hop out of sight; breathe mist
    for (const v of iceVents) {
      if (v.x === 0) { ventMove(v, true); continue; }
      v.t -= dt; if (v.t <= 0 && !ventSeen(v)) ventMove(v);
      if ((v.e -= dt) <= 0 && Math.hypot(v.x - P.x, v.z - P.z) < 40) {
        v.e = .35 + Math.random() * .2; const p = icePuffs.find(q => q.t >= q.life);
        if (p) { p.t = 0; p.life = 3.5 + Math.random() * 2; const sp = .8 + Math.random() * .7; p.vx = v.nx * sp + (Math.random() - .5) * .3; p.vz = v.nz * sp + (Math.random() - .5) * .3; p.s.position.set(v.x + v.nx * .15, 1.0 + Math.random() * .6, v.z + v.nz * .15); p.s.visible = true; }
      }
    }
    for (const p of icePuffs) {
      if (p.t >= p.life) continue; p.t += dt; const a = p.t / p.life;
      if (a >= 1) { p.s.visible = false; continue; }
      p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.scale.setScalar(.6 + 2.2 * a); p.s.material.opacity = .42 * Math.sin(Math.PI * Math.min(1, a * 1.4)) * (1 - a);
    }
    // warmth: drains in the open, faster in a vent's breath, comes back in a camp
    let warm = false, chill = 0, nv = 1e9;
    for (const c of ICE_CAMPS) if (Math.hypot(P.x - c.x, P.z - c.z) < ICE_CAMP_R) { warm = true; iceCheck = [c.x + 1.8, c.z]; }
    for (const v of iceVents) { const d = Math.hypot(v.x - P.x, v.z - P.z); nv = Math.min(nv, d); if (d < 8) chill += (1 - d / 8) * 5.5; }
    const run = keys.ShiftLeft || keys.ShiftRight;
    iceW = warm ? Math.min(100, iceW + 16 * dt) : iceW - (1.1 + (run ? .6 : 0) + chill) * dt;
    if (warm && iceW < 99.5 && !iceSaidWarm) { iceSaidWarm = true; say("綠燈下面暖了起來。手指慢慢有了知覺。", 3500); }
    if (!warm) iceSaidWarm = false;
    if (iceW < 30 && (iceSayCold -= dt) <= 0) { iceSayCold = 12; say("睫毛上結了霜，手指快不聽使喚了……去找綠燈。", 3500); }
    if (iceW <= 0) return iceKnockout();
    AMB[ICE_ZT][1] = .02 + (1 - iceW / 100) * .014;
    dropY = Math.sin(t * 55) * .014 * Math.max(0, (35 - iceW) / 35);
    // wind in the pipes: louder near a vent
    if (actx && (iceWindT -= dt) <= 0) { iceWindT = 2.5 + Math.random() * 3.5; noiseBurst(170 + Math.random() * 170, 1.4, .04 + Math.max(0, 1 - nv / 14) * .09, 1, 1.3, 0); }
    const a = this.nearest(); if (a && !docOpen) say(a.tip, 1200);
    for (const d of ICE_DOORS) if (Math.hypot(P.x - d.x, P.z - d.z) < .9) return leaveIce();
  },
};
let iceSaidWarm = false, iceSayCold = 0;
function iceKnockout() {
  if (state !== "play") return;
  iceW = 0; state = "wait"; fadeEl.innerHTML = "睫毛結了霜，手指不再聽使喚……<br>醒來時，你躺在最近的那盞綠燈下。"; fadeEl.style.opacity = 1;
  setTimeout(() => { const c = iceCheck || [ICE_DOORS[0].x + 2, ICE_DOORS[0].z]; P.x = c[0]; P.z = c[1]; P.y = 0; dropY = 0; iceW = 55; fadeEl.style.opacity = 0; state = "play"; say("你還活著。別再離綠燈太遠。", 4000); }, 3200);
}

// ---------- 進入與離開 ----------
function iceBack() { enterMap(); [P.x, P.z, P.yaw] = iceSaved || [SPAWN[0], SPAWN[1], 0]; P.y = 0; P.pitch = 0; dropY = 0; fallV = 0; }
function enterIce() {
  buildIce();
  iceSaved = mode === "map" ? [P.x, P.z, P.yaw] : [SPAWN[0], SPAWN[1], 0];
  iceW = 100; iceRead.clear(); iceCheck = null; iceT = 0; iceSay = 0; iceWindT = 3; iceSaidWarm = false; iceSayCold = 0;
  for (const p of icePuffs) { p.t = p.life = 9; p.s.visible = false; } for (const v of iceVents) { v.x = 0; v.t = 0; v.e = 0; }
  mode = "ice"; hemi.groundColor.set(0xaec4d2); iceGroup.visible = true;
  baseGroup.visible = tsGroup.visible = remodelGroup.visible = false; floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsFar(180);
  const [fc, fd, hi, hc] = AMB[ICE_ZT]; scene.fog.color.set(fc); scene.fog.density = fd; hemi.color.set(hc); hemi.intensity = hi;
  const d = ICE_DOORS[0]; P.x = d.x + 2; P.z = d.z; P.y = 0; P.yaw = -Math.PI / 2; P.pitch = 0; dropY = 0; fallV = 0;
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 0.3 · 冰室 ——和 Level 0 幾乎一模一樣，只是到處都是冰。而且，真他媽冷。", 6500);
}
function leaveIce(how) {
  if (state !== "play") return;
  state = "wait";
  fadeEl.innerHTML = how === "ladder" ? "你沿著結霜的鐵梯一直往上爬，推開頂端的鐵蓋……<br>熟悉的黃色走廊又回來了。" : "你推開鐵門，身後的寒氣漸漸散去……<br>熟悉的黃色走廊又回來了。";
  fadeEl.style.opacity = 1;
  setTimeout(() => { iceBack(); say("你回到了 Level 0。", 4000); }, 2200);
}

// ---------- 3D 俯視地圖 ----------
function buildIceMap() {
  buildIce();
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), wh = 1.6, cx = IX + IW / 2, cz = IZ + ID / 2, boxes = [], ice = [...ICE_BLOCKS.map(([x, z]) => [x - 1.85, z - 1.85, x + 1.85, z + 1.85]), ...ICE_PARTIAL.map(([x, z, w]) => [x - w / 2, z - w / 2, x + w / 2, z + w / 2])];
  for (const l of ICE_BOXES.values()) boxes.push(...l);
  const ib = new Set(ice.map(b => b.join()));
  const tr = ([a, b, c, d], h) => [(a + c) / 2, h / 2, (b + d) / 2, 0, Math.max(.3, c - a), h / H, Math.max(.3, d - b)];
  inst(mapWorld, flatGeo, mat(0x6f7d86), [[cx, 0, cz, 0, IW, 1, ID]]);
  inst(mapWorld, boxGeo, mat(0xe8e4d0), boxes.filter(b => !ib.has(b.join())).map(b => tr(b, wh)));
  inst(mapWorld, boxGeo, mat(0x9fd4ec), ice.map(b => tr(b, wh * .9)));
  inst(mapWorld, flatGeo, mat(0x3fcf6e), ICE_CAMPS.map(c => [c.x, .04, c.z, 0, 3.4, 1, 3.4]));
  inst(mapWorld, flatGeo, mat(0xfacc15), ICE_DOORS.map(d => [d.x + d.nx * 1.2, .04, d.z + d.nz * 1.2, 0, d.nx ? 2.5 : 3, 1, d.nx ? 3 : 2.5]));
  inst(mapWorld, flatGeo, mat(0x8d4a38), [[scx0(), .05, scz0(), 0, 2.4, 1, 2.4]]);
}
const scx0 = () => icCell(ICE_SHAFT % INX, ICE_SHAFT / INX | 0)[0], scz0 = () => icCell(ICE_SHAFT % INX, ICE_SHAFT / INX | 0)[1];
