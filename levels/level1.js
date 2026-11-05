"use strict";
// ---------- the Alpha base: where the exit leads ----------
const BX = 300, BZ = 40, BRW = 16, BRD = 10, BRH = 3.2;
const BASE_BOXES = [];                       // [x0, z0, x1, z1] solids inside the base
const baseGroup = new THREE.Group(); baseGroup.visible = false; scene.add(baseGroup);
function baseCollide() {
  P.x = Math.max(BX + .5, Math.min(BX + BRW - .5, P.x)); P.z = Math.max(BZ + .5, Math.min(BZ + BRD - .5, P.z));
  for (const [a, b, c, d] of BASE_BOXES) pushOut(a, b, c, d);
}
function baseTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; }
let baseBuilt = false;
function buildBase() {                 // built on the first visit (or first map view), not at page load
  if (baseBuilt) return; baseBuilt = true;
  const concrete = baseTex(256, 256, (g, w, h) => { g.fillStyle = "#807f79"; g.fillRect(0, 0, w, h); noise(g, w, 9000, .22); });
  const concreteFloor = concrete.clone(); concreteFloor.needsUpdate = true;
  for (const [t, rx, ry] of [[concrete, 4, 1], [concreteFloor, 10, 6]]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }   // grain at a sensible scale
  const wallM = new THREE.MeshStandardMaterial({ map: concrete, roughness: 1 }), floorM = new THREE.MeshStandardMaterial({ map: concreteFloor, color: 0xbdbdb5, roughness: .9 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); baseGroup.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  add(new THREE.PlaneGeometry(BRW, BRD), floorM, BX + BRW / 2, 0, BZ + BRD / 2, -Math.PI / 2);
  add(new THREE.PlaneGeometry(BRW, BRD), floorM, BX + BRW / 2, BRH, BZ + BRD / 2, Math.PI / 2);
  box(BRW, BRH, .3, wallM, BX + BRW / 2, BRH / 2, BZ); box(BRW, BRH, .3, wallM, BX + BRW / 2, BRH / 2, BZ + BRD);
  box(.3, BRH, BRD, wallM, BX, BRH / 2, BZ + BRD / 2); box(.3, BRH, BRD, wallM, BX + BRW, BRH / 2, BZ + BRD / 2);
  const sign = (w, h, draw, x, y, z, ry) => add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: baseTex(512, Math.round(512 * h / w), draw) }), x, y, z, 0, ry);
  sign(6, 1.2, (g, w, h) => { g.fillStyle = "#1c2a3a"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8e2c0"; g.font = "bold 74px sans-serif"; g.textAlign = "center"; g.fillText("ALPHA BASE", w / 2, h * .52); g.font = "34px sans-serif"; g.fillText("阿爾法基地 · 後室倖存者營地", w / 2, h * .85); }, BX + 8, 2.3, BZ + .17, 0);
  sign(3.4, 2.2, (g, w, h) => {
    g.fillStyle = "#b8a77a"; g.fillRect(0, 0, w, h); g.fillStyle = "#222"; g.font = "bold 40px sans-serif"; g.textAlign = "left"; g.fillText("公告", 36, 62); g.font = "28px sans-serif";
    ["· 水與罐頭每人每日定量", "· 嚴禁啃食地毯纖維", "· 在 Level 0 時，同行也會走散", "· 遇到紅色的地方，立刻轉身", "· 無視牆後的刮擦聲與低語", "· 歡迎你，新來的流浪者"].forEach((s, k) => g.fillText(s, 36, 120 + k * 52));
  }, BX + .17, 1.8, BZ + 3.2, Math.PI / 2);
  sign(1.6, 2.3, (g, w, h) => { g.fillStyle = "#4b5258"; g.fillRect(0, 0, w, h); g.strokeStyle = "#2a2f33"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = "#f4d03f"; g.font = "bold 54px sans-serif"; g.textAlign = "center"; g.fillText("LEVEL 1", w / 2, h * .3); g.fillStyle = "#ddd"; g.font = "30px sans-serif"; g.fillText("鐵門 · 嚴禁單獨外出", w / 2, h * .42); }, BX + BRW - .17, 1.15, BZ + 5, -Math.PI / 2);
  const metal = flat(0x555a5e), mattress = flat(0x59623f), wood = flat(0x6f5a3c), water = new THREE.MeshStandardMaterial({ color: 0x3a78c2, roughness: .3 }), can = flat(0xb0a468);
  const bunk = (x, z) => {                   // a bunk bed against the south wall
    for (const dx of [-1, 1]) for (const dz of [-.45, .45]) box(.07, 2, .07, metal, x + dx, 1, z + dz);
    box(2.1, .12, 1, wood, x, .5, z); box(2.1, .12, 1, wood, x, 1.45, z); box(1.9, .12, .9, mattress, x, .62, z); box(1.9, .12, .9, mattress, x, 1.57, z);
    BASE_BOXES.push([x - 1.1, z - .55, x + 1.1, z + .55]);
  };
  bunk(BX + 3, BZ + BRD - 1); bunk(BX + 6, BZ + BRD - 1); bunk(BX + 9.2, BZ + BRD - 1);
  box(3.4, .1, 1.4, wood, BX + 8, .85, BZ + 4.5); for (const dx of [-1.5, 1.5]) for (const dz of [-.55, .55]) box(.08, .85, .08, metal, BX + 8 + dx, .42, BZ + 4.5 + dz);
  BASE_BOXES.push([BX + 6.2, BZ + 3.75, BX + 9.8, BZ + 5.25]);
  for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(.18, .18, .5, 16), water, BX + 7 + k * .5, 1.15, BZ + 4.3);
  for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(.06, .06, .11, 12), can, BX + 8.6 + (k % 3) * .2, .95, BZ + 4.6 + (k / 3 | 0) * .2);
  box(.8, .5, .6, crateMat, BX + 9.1, 1.15, BZ + 4.7);
  box(.6, 2, 3, wood, BX + .8, 1, BZ + 7.5); for (let k = 0; k < 4; k++) box(.5, .3, .7, crateMat, BX + .8, .4 + k * .5, BZ + 6.9 + (k % 2) * 1.2);   // supply shelf
  BASE_BOXES.push([BX + .5, BZ + 6, BX + 1.1, BZ + 9]);
  const lamp = (x) => { box(1.6, .05, .5, new THREE.MeshBasicMaterial({ color: 0xe6f0ff }), x, BRH - .03, BZ + 5); const l = new THREE.PointLight(0xe6f0ff, 22, 16, 1.6); l.position.set(x, BRH - .4, BZ + 5); baseGroup.add(l); };
  lamp(BX + 4); lamp(BX + 12);
  [["#4a5d7a", 4.2, 2.2], ["#7a5a3f", 12.6, 3.2], ["#4d6a4a", 11.5, 7.2], ["#6e4a5a", 4.5, 6.2]].forEach(([c, x, z]) => { const s = person(c, BX + x, BZ + z); baseGroup.add(s); });
}
function enterBase() {
  buildBase();
  mode = "base"; hemi.groundColor.set(0x8a8a8a); baseGroup.visible = true;   // no yellow bounce light down here
  floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsGroup.visible = false; tsFar(120);
  P.x = BX + 2.2; P.z = BZ + 5; P.y = 0; P.yaw = -Math.PI / 2; P.pitch = 0; dropY = 0; fallV = 0;
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 1 · ALPHA 基地 ——你與少數仍存活的人類匯合了。", 6000);
  setTimeout(() => say("跌跌撞撞衝進基地的流浪者，不少人因為誤食地毯纖維而死。你沒有。", 6000), 7000);
  setTimeout(() => say("（按 R 回到後室重新探索）", 8000), 14000);
}
const BASE_PLACES = [["阿爾法基地", BX + 8, BZ + 5], ["鐵門", BX + BRW - 1.5, BZ + 2], ["床位", BX + 6, BZ + BRD - 2.5], ["物資架", BX + 2.5, BZ + 7.5]];
// Level 1 · Alpha base: one room; its bunks, table and shelf are the same solids the collision uses
function buildBaseMap() {
  buildBase();
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), wh = 1.6, cx = BX + BRW / 2, cz = BZ + BRD / 2;
  inst(mapWorld, flatGeo, mat(0xc9c8c0), [[cx, 0, cz, 0, BRW, 1, BRD]]);
  inst(mapWorld, boxGeo, mat(0xfafafa), [[cx, wh / 2, BZ, 0, BRW, wh / H, .3], [cx, wh / 2, BZ + BRD, 0, BRW, wh / H, .3], [BX, wh / 2, cz, 0, .3, wh / H, BRD], [BX + BRW, wh / 2, cz, 0, .3, wh / H, BRD]]);
  inst(mapWorld, boxGeo, mat(0x9aa0a6), BASE_BOXES.map(([a, b, c, d]) => [(a + c) / 2, .45, (b + d) / 2, 0, c - a, .9 / H, d - b]));
}
const baseStand = (x, z) => x > BX + .5 && x < BX + BRW - .5 && z > BZ + .5 && z < BZ + BRD - .5 && !BASE_BOXES.some(([a, b, c, d]) => x > a - P.r && x < c + P.r && z > b - P.r && z < d + P.r);
