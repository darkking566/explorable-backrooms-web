"use strict";
// ---------- Level 0.2「重塑的世界」: Backrooms Remodeling Co. ----------
const RX = 1200, RZ = 40, RW = 48, RD = 36, RH = 3.2;
const REMODEL_BOXES = [];
const remodelGroup = new THREE.Group(); remodelGroup.visible = false; scene.add(remodelGroup);
let clipLight, remodelDust, remodelCreakT = 14;

function remodelCollide() {
  P.x = Math.max(RX + .6, Math.min(RX + RW - .6, P.x));
  P.z = Math.max(RZ + .6, Math.min(RZ + RD - .6, P.z));
  for (const [a, b, c, d] of REMODEL_BOXES) pushOut(a, b, c, d);
}

const remodelStand = (x, z) => x > RX + .6 && x < RX + RW - .6 && z > RZ + .6 && z < RZ + RD - .6 && !REMODEL_BOXES.some(([a, b, c, d]) => x > a - P.r && x < c + P.r && z > b - P.r && z < d + P.r);

let remodelBuilt = false;
function buildRemodel() {                 // built on the first visit (or first map view), not at page load
  if (remodelBuilt) return; remodelBuilt = true;
  const carpetT = baseTex(256, 256, (g, w, h) => {
    g.fillStyle = "#651818"; g.fillRect(0, 0, w, h);
    noise(g, w, 8000, .18);
    g.fillStyle = "rgba(45,10,10,.25)";
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.5);
    for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.5, h);
  });
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping; carpetT.repeat.set(16, 12);

  const wallT = baseTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f6f5ee"; g.fillRect(0, 0, w, h);
    noise(g, w, 3500, .06);
    g.fillStyle = "#581515"; g.fillRect(0, h * .86, w, h * .14);
    g.fillStyle = "#8a2020"; g.fillRect(0, h * .85, w, h * .015);
    g.strokeStyle = "rgba(180,175,165,.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(w * .5, 0); g.lineTo(w * .5, h * .85); g.stroke();
  });
  wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping; wallT.repeat.set(2, 1);

  const wallOutletT = baseTex(256, 256, (g, w, h) => {
    g.drawImage(wallT.image, 0, 0);
    const ox = w * .75, oy = h * .72, ow = 26, oh = 42;
    g.fillStyle = "#deded8"; g.fillRect(ox - ow / 2, oy - oh / 2, ow, oh);
    g.strokeStyle = "#888880"; g.lineWidth = 1.5; g.strokeRect(ox - ow / 2, oy - oh / 2, ow, oh);
    for (const dy of [-10, 10]) {
      g.fillStyle = "#333";
      g.fillRect(ox - 6, oy + dy - 4, 3, 8);
      g.fillRect(ox + 3, oy + dy - 4, 3, 8);
      g.beginPath(); g.arc(ox, oy + dy + 7, 2, 0, 7); g.fill();
    }
  });
  wallOutletT.wrapS = wallOutletT.wrapT = THREE.RepeatWrapping; wallOutletT.repeat.set(2, 1);

  const ceilT = baseTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, w, h);
    noise(g, w, 4000, .05);
    g.strokeStyle = "rgba(160,160,155,.55)"; g.lineWidth = 3;
    for (let k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h);
      g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke();
    }
  });
  ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping; ceilT.repeat.set(16, 12);

  const tileFloorT = baseTex(256, 256, (g, w, h) => {
    g.fillStyle = "#e0e6e8"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#9fb0b8"; g.lineWidth = 4;
    for (let k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h);
      g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke();
    }
  });
  tileFloorT.wrapS = tileFloorT.wrapT = THREE.RepeatWrapping; tileFloorT.repeat.set(3, 3);

  const carpetM = new THREE.MeshStandardMaterial({ map: carpetT, roughness: .9 });
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: .65 });
  const wallOutM = new THREE.MeshStandardMaterial({ map: wallOutletT, roughness: .65 });
  const ceilM = new THREE.MeshStandardMaterial({ map: ceilT, roughness: .8 });
  const tileM = new THREE.MeshStandardMaterial({ map: tileFloorT, roughness: .35 });
  const woodM = flat(0xb88d58), metalM = flat(0x666b70), studM = flat(0xc49c66), darkMat = flat(0x222225);

  const add = (geo, mat, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); remodelGroup.add(m); return m;
  };
  const box = (w, h, d, mat, x, y, z, rx = 0, ry = 0) => {
    const m = add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry); return m;
  };
  const rWall = (w, h, d, x, y, z, outlet = false) => {
    box(w, h, d, outlet ? wallOutM : wallM, x, y, z);
    REMODEL_BOXES.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
  };

  // Main floor & ceiling
  add(new THREE.PlaneGeometry(RW, RD), carpetM, RX + RW / 2, 0, RZ + RD / 2, -Math.PI / 2);
  add(new THREE.PlaneGeometry(RW, RD), ceilM, RX + RW / 2, RH, RZ + RD / 2, Math.PI / 2);

  // Outer walls (North & South)
  box(RW, RH, .3, wallM, RX + RW / 2, RH / 2, RZ);
  REMODEL_BOXES.push([RX, RZ - .15, RX + RW, RZ + .15]);
  box(RW, RH, .3, wallM, RX + RW / 2, RH / 2, RZ + RD);
  REMODEL_BOXES.push([RX, RZ + RD - .15, RX + RW, RZ + RD + .15]);

  // West outer wall (with doorway at Z = 55)
  box(.3, RH, 13.5, wallM, RX, RH / 2, RZ + 6.75);
  REMODEL_BOXES.push([RX - .15, RZ, RX + .15, 53.5]);
  box(.3, RH, 19.5, wallM, RX, RH / 2, RZ + 26.25);
  REMODEL_BOXES.push([RX - .15, 56.5, RX + .15, RZ + RD]);

  // East outer wall (with doorway at Z = 67)
  box(.3, RH, 25.5, wallM, RX + RW, RH / 2, RZ + 12.75);
  REMODEL_BOXES.push([RX + RW - .15, RZ, RX + RW + .15, 65.5]);
  box(.3, RH, 7.5, wallM, RX + RW, RH / 2, RZ + 32.25);
  REMODEL_BOXES.push([RX + RW - .15, 68.5, RX + RW + .15, RZ + RD]);

  // Interior dividing walls
  // Hallway North wall (Z = 52, X: 1200..1234, doors at 1206 and 1222)
  rWall(5, RH, .25, RX + 2.5, RH / 2, 52, true);
  rWall(12, RH, .25, RX + 14, RH / 2, 52);
  rWall(10, RH, .25, RX + 28, RH / 2, 52, true);

  // Hallway South wall (Z = 58, X: 1200..1234, doors at 1208 and 1224)
  rWall(7, RH, .25, RX + 3.5, RH / 2, 58);
  rWall(13, RH, .25, RX + 16.5, RH / 2, 58, true);
  rWall(8, RH, .25, RX + 29, RH / 2, 58);

  // North-wing dividing walls
  // Between Lobby & Office (X = 1216, Z: 40..52, door at Z = 46)
  rWall(.25, RH, 4.5, 1216, RH / 2, 42.25);
  rWall(.25, RH, 4.5, 1216, RH / 2, 49.75);

  // Between Office & Restroom (X = 1226, Z: 40..52, door at Z = 48)
  rWall(.25, RH, 6.5, 1226, RH / 2, 43.25);
  rWall(.25, RH, 2.5, 1226, RH / 2, 50.75);

  // South-wing dividing wall (X = 1216, Z: 58..76, door at Z = 67)
  rWall(.25, RH, 7.5, 1216, RH / 2, 61.75);
  rWall(.25, RH, 7.5, 1216, RH / 2, 72.25);

  // Eastern Wing - Unfinished / Damaged Zone (X: 1234..1248)
  // Dividing wall at X = 1234 (opening at Z: 52..58)
  rWall(.25, RH, 12, 1234, RH / 2, 46);
  rWall(.25, RH, 18, 1234, RH / 2, 67);

  // Broken partition inside East wing (Z = 58, X: 1234..1244)
  // Exposed 2x4 wooden studs
  for (let sx = 1235; sx <= 1243; sx += .8) {
    box(.08, RH, .1, studM, sx, RH / 2, 58);
  }
  // Fallen drywall boards
  box(2.2, .06, 1.2, wallM, 1237, .4, 58.3, .3, 0);
  box(2.4, .06, 1.4, wallM, 1241, .2, 57.6, -.2, .1);
  REMODEL_BOXES.push([1234.5, 57.5, 1243.5, 58.5]);

  // Restroom tile patch & fixtures
  add(new THREE.PlaneGeometry(7.5, 11), tileM, 1230, .01, 46, -Math.PI / 2);
  // Sink counter
  box(2.2, .85, .8, flat(0xe8ecee), 1230, .425, 40.5);
  REMODEL_BOXES.push([1228.8, 40.1, 1231.2, 41]);
  // Mirror
  add(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x90aab4, roughness: .1, metalness: .8 }), 1230, 1.7, 40.17);

  // Corporate Poster in Lobby (North wall of room 1)
  const coPosterTex = baseTex(512, 280, (g, w, h) => {
    g.fillStyle = "#3b3866"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d3ae00"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#d3ae00"; g.font = "bold 26px sans-serif"; g.textAlign = "center";
    g.fillText("BACKROOMS REMODELING CO.", w / 2, 50);
    g.fillStyle = "#ffffff"; g.font = "bold 34px sans-serif";
    g.fillText("后 室 装 修 公 司", w / 2, 100);
    g.fillStyle = "#f0ce31"; g.font = "italic 21px sans-serif";
    g.fillText("「真正的整洁来自于装潢 · 真正的秩序由家具传达」", w / 2, 146);
    g.fillStyle = "#dedef0"; g.font = "18px sans-serif";
    g.fillText("A 级重塑工程 ｜ 102-CX 工作组 ｜ 主管：Major Took", w / 2, 200);
    g.fillStyle = "#aaaac0"; g.font = "15px sans-serif";
    g.fillText("★ 严禁随意触碰施工中墙体 ★", w / 2, 240);
  });
  add(new THREE.PlaneGeometry(3.6, 2.0), new THREE.MeshBasicMaterial({ map: coPosterTex }), 1208, 1.8, 40.17);

  // EXIT signs & doors
  const exitSignTex = baseTex(256, 128, (g, w, h) => {
    g.fillStyle = "#1b7837"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#ffffff"; g.font = "bold 44px sans-serif"; g.textAlign = "center";
    g.fillText("EXIT 出口", w / 2, 56);
    g.font = "24px sans-serif";
    g.fillText("返回 LEVEL 0", w / 2, 98);
  });
  const exitSignM = new THREE.MeshBasicMaterial({ map: exitSignTex });

  // West Door (Start Door)
  box(.1, 2.4, 1.6, darkMat, RX + .05, 1.2, 55);
  add(new THREE.PlaneGeometry(1.4, .7), exitSignM, RX + .18, 2.7, 55, 0, Math.PI / 2);

  // East Door (Maintenance Door)
  box(.1, 2.4, 1.6, darkMat, RX + RW - .05, 1.2, 67);
  add(new THREE.PlaneGeometry(1.4, .7), exitSignM, RX + RW - .18, 2.7, 67, 0, -Math.PI / 2);

  // Office Work Station (X = 1220, Z = 46)
  // Table
  box(2.6, .08, 1.3, woodM, 1220, .76, 46);
  for (const dx of [-1.15, 1.15]) for (const dz of [-.5, .5]) box(.06, .76, .06, metalM, 1220 + dx, .38, 46 + dz);
  REMODEL_BOXES.push([1218.6, 45.3, 1221.4, 46.7]);

  // Chairs
  box(.6, .45, .6, metalM, 1218.5, .225, 46);
  box(.6, .45, .6, metalM, 1221.5, .225, 46);

  // Clipboard on table
  box(.32, .02, .44, flat(0x8a6238), 1220.2, .81, 46);
  box(.3, .01, .42, flat(0xf5f5ea), 1220.2, .825, 46); // paper
  box(.14, .03, .06, metalM, 1220.2, .84, 45.81);     // clip

  // Pulsing hint light above clipboard
  clipLight = new THREE.PointLight(0xffd700, 1.4, 4, 2);
  clipLight.position.set(1220.2, 1.3, 46);
  remodelGroup.add(clipLight);

  // Coffee cup & blueprint roll
  add(new THREE.CylinderGeometry(.05, .04, .1, 12), flat(0xffffff), 1219.4, .85, 45.8);
  add(new THREE.CylinderGeometry(.05, .05, .7, 12), flat(0x6a9ec0), 1219.5, .83, 46.3, 0, 0, Math.PI / 2);

  // Stepladder (木梯) near wall
  box(.05, 2.2, .05, woodM, 1217, 1.1, 41.5, .15, 0);
  box(.05, 2.2, .05, woodM, 1217.6, 1.1, 41.5, .15, 0);
  for (let k = 1; k <= 5; k++) box(.65, .04, .08, woodM, 1217.3, k * .38, 41.5 - k * .05);

  // Paint cans
  const canGeo = new THREE.CylinderGeometry(.14, .14, .36, 16);
  add(canGeo, flat(0xd5d5d0), 1217.2, .18, 43.5);
  add(new THREE.CylinderGeometry(.145, .145, .06, 16), flat(0xffffff), 1217.2, .34, 43.5); // white paint drip
  add(canGeo, flat(0xd5d5d0), 1217.6, .18, 43.4);
  add(new THREE.CylinderGeometry(.145, .145, .06, 16), flat(0x8a1c1c), 1217.6, .34, 43.4); // red paint drip

  // Floating dust particles in damaged zone
  remodelDust = new THREE.Group();
  for (let k = 0; k < 14; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd8d4c8, transparent: true, opacity: .3, depthWrite: false }));
    s.position.set(1235 + Math.random() * 11, .5 + Math.random() * 2.2, 50 + Math.random() * 22);
    s.scale.setScalar(.8 + Math.random() * 1.4);
    remodelDust.add(s);
  }
  remodelGroup.add(remodelDust);

  // Ceiling lamp panels (soft clean white emission)
  const lampPanelGeo = new THREE.BoxGeometry(1.6, .04, .8);
  const lampPanelMat = new THREE.MeshBasicMaterial({ color: 0xfdfdf5 });
  const lampPositions = [
    [1208, 46], [1220, 46], [1230, 46],
    [1208, 55], [1220, 55], [1232, 55],
    [1216, 67], [1240, 67]
  ];
  for (const [lx, lz] of lampPositions) {
    box(1.6, .04, .8, lampPanelMat, lx, RH - .02, lz);
    const pl = new THREE.PointLight(0xfff6ea, 16, 14, 1.8);
    pl.position.set(lx, RH - .3, lz);
    remodelGroup.add(pl);
  }
}
function enterRemodel() {
  buildRemodel();
  mode = "remodel"; hemi.groundColor.set(0x8a7060); remodelGroup.visible = true;
  baseGroup.visible = tsGroup.visible = false; floor.visible = ceil.visible = false; fig.visible = false; clearExit(); tsFar(120);
  P.x = RX + 5; P.z = 55; P.y = 0; P.yaw = 0; P.pitch = 0; dropY = 0; fallV = 0;
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 0.2 · 重塑的世界 ——由「後室裝修公司」改造的空間，空氣乾燥，異常安靜。", 6000);
}
function leaveRemodel() {
  state = "wait"; fadeEl.innerHTML = "你推開施工出口門，回到了 Level 0 熟悉的黃色走廊……"; fadeEl.style.opacity = 1;
  setTimeout(() => { enterMap(); say("你回到了 Level 0。", 4000); }, 2200);
}
const REMODEL_PLACES = [["接待大廳", RX + 8, 46], ["裝修工務桌", RX + 20, 46], ["展示長廊", RX + 18, 55], ["洗手間", RX + 30, 46], ["未完工木骨架區", RX + 41, 60], ["西出口門", RX + 1.5, 55], ["東出口門", RX + RW - 1.5, 67]];
function buildRemodelMap() {
  buildRemodel();
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), wh = 1.6, cx = RX + RW / 2, cz = RZ + RD / 2;
  inst(mapWorld, flatGeo, mat(0x7a2222), [[cx, 0, cz, 0, RW, 1, RD]]);
  const ow = [
    [cx, wh / 2, RZ, 0, RW, wh / H, .3],
    [cx, wh / 2, RZ + RD, 0, RW, wh / H, .3],
    [RX, wh / 2, cz, 0, .3, wh / H, RD],
    [RX + RW, wh / 2, cz, 0, .3, wh / H, RD]
  ];
  inst(mapWorld, boxGeo, mat(0xf5f4ef), ow);
  inst(mapWorld, boxGeo, mat(0xdcdad2), REMODEL_BOXES.map(([a, b, c, d]) => [(a + c) / 2, wh / 2, (b + d) / 2, 0, c - a, wh / H, d - b]));
}
