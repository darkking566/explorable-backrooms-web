"use strict";
// ---------- Level 0.1「天頂站」: a hollow sphere of a station, swallowed whole by Level 0; reached through a plain steel door ----------
// What you walk is a belt of nine decks round the sphere's equator, each one closed ring. Plans, collision and zones live in a
// "straight" space (s along the ring, 0..TS_L and wrapping; u in from the outer hull); tsP() bends a point onto the circle, so the
// plan stays plain boxes while every wall follows the curve. Across the ring from the hull in: rooms (10 m) whose windows look out
// on Level 0, a wall with a door per room, a hall (10 m), then glass onto the central void, the empty bubble where the wormhole
// should have opened. Every deck has the same plan, so collision is built once and shared; only lights, hazards and robots differ.
const CX = 5000, CZ = 5000;                  // world position of the sphere's centre (metres); far enough that Level 0 and the base lie beyond the far plane
const TS_N = 9, TS_H = 4, TS_FH = 4.4, TS_START = 4, TS_RO = 170, TS_L = 1000, TS_RR = TS_L / (2 * Math.PI);   // decks, ceiling height, deck pitch, arrival deck, hull radius, ring length (true length at radius TS_RR)
const TS_MID = TS_N * TS_FH / 2, TS_LOBBY = [0, 25, 50, 75];   // room slots (10 m each) that are lift lobbies; slot 0 also holds the door back to Level 0
const tsP = (s, u) => { const a = s / TS_RR, r = TS_RO - u; return [CX + r * Math.cos(a), CZ + r * Math.sin(a)]; };   // straight -> world
const tsS = (x, z) => { const dx = x - CX, dz = z - CZ; let a = Math.atan2(dz, dx); if (a < 0) a += 2 * Math.PI; return [a * TS_RR, TS_RO - Math.hypot(dx, dz)]; };   // world -> straight
const tsBend = ([s, y, u, r, sx, sy, sz]) => { const a = s / TS_RR, [x, z] = tsP(s, u); return [x, y, z, r - a - Math.PI / 2, sx * (TS_RO - u) / TS_RR, sy, sz]; };   // instance entry straight -> world: +s turns to the tangent, +u to the centre
const tsSlot = s => ((Math.floor(s / 10) % 100) + 100) % 100;
const TS_HOME = tsP(10, 14);              // in the hall between two columns, in front of lobby 0
const tsGroup = new THREE.Group(); tsGroup.visible = false; scene.add(tsGroup);
// 0 normal, 1 freezing, 2 scorching, 3 dark: one value per room (10 m) or hall stretch (20 m), different on every deck
const tsZoneOf = (s, u, lv) => {
  const i = u < 10 ? tsSlot(s) : 100 + (tsSlot(s) >> 1);
  if (i === 100 || TS_LOBBY.includes(i)) return 0;   // the lobbies and the arrival hall stay safe
  const r = hash(i, lv, 61); return r < .07 ? 1 : r < .14 ? 2 : r < .27 ? 3 : 0;
};
let tsLevel = TS_START, tsBuilt = false, tsT = 0, tsCut = 0, tsExp = 0, tsSaved = null, tsC = 0, tsAlarmT = 0, tsFx = null, tsRideT = 0, tsInLift = false, tsSndBot = 0, tsSndZone = 0;
const tsZoneNow = () => { const [s, u] = tsS(P.x, P.z); return tsZoneOf(s, u, tsLevel); };
const tsFar = f => { camera.far = f; camera.updateProjectionMatrix(); };          // the void is 300 m across and Level 0 lies further out
const TS_WALLS = [], TS_LINTELS = [], TS_PROPS = [], TS_COLS = [], TS_PANELS = [], TS_SCREENS = [], TS_BOTS = [], TS_BUCKET = new Map();
const TS_DOOR_C = [], TS_DOOR = [], TS_LAMPS = [];   // door centres along s; per deck {m, open, stuck}; the pooled room lights
const tsDoorSet = (D, n) => {                // two leaves slide apart into the door wall, open 0..1
  const c = TS_DOOR_C[n], o = D.open[n];
  for (const k of [0, 1]) { const [x, y, z, r, sx, sy, sz] = tsBend([c + (k ? 1 : -1) * (.75 + 1.45 * o), 1.6, 10, 0, 1.5, 3.2 / H, .06]); D.m.setMatrixAt(2 * n + k, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_u, r), _s.set(sx, sy, sz))); }
  D.m.instanceMatrix.needsUpdate = true;
};
const tsCands = (s, f) => { const a = Math.floor(s / 10); for (let i = a - 1; i <= a + 1; i++) for (const r of TS_BUCKET.get(((i % 100) + 100) % 100) || []) f(r, TS_L * Math.round((s - (r[0] + r[2]) / 2) / TS_L)); };   // boxes near s, with the shift that brings each to s's side of the seam
(function tsPlan() {
  const bucket = (s, u, ls, lu) => {         // collision boxes [s0, u0, s1, u1] in a 10 m hash along s that wraps with the ring
    const b = [s - ls / 2, u - lu / 2, s + ls / 2, u + lu / 2];
    for (let a = Math.floor(b[0] / 10); a <= Math.floor(b[2] / 10); a++) { const k = ((a % 100) + 100) % 100; if (!TS_BUCKET.has(k)) TS_BUCKET.set(k, []); TS_BUCKET.get(k).push(b); }
  };
  const wall = (s, u, ls, lu) => { TS_WALLS.push([s, u, ls, lu]); bucket(s, u, ls, lu); };
  const prop = (s, u, ls, lu, h, m) => { TS_PROPS.push([s, u, ls, lu, h, m]); bucket(s, u, ls, lu); };
  for (let i = 0; i < 100; i++) {
    const s0 = i * 10, c = s0 + 5;
    bucket(c, .2, 10, .4);                   // the hull, drawn in tsBuildAll as wall, sill and lintel around the windows
    wall(s0, 5.2, .3, 9.6);                  // partition between rooms
    TS_PANELS.push([c, 5]);
    if (TS_LOBBY.includes(i)) continue;      // a lift lobby: open onto the hall
    const t = Math.floor(hash(i, 0, 55) * 6), pr = (s, u, ls, lu, h, m) => prop(s0 + s, u, ls, lu, h, m);
    wall((s0 + c - 1.5) / 2, 10, c - 1.5 - s0, .3); wall((c + 1.5 + s0 + 10) / 2, 10, s0 + 10 - c - 1.5, .3);   // the wall onto the hall, a 3 m door at each room's middle
    TS_LINTELS.push([c, 10, 3, .3]); TS_DOOR_C.push(c);
    if (t === 0) { pr(2, 1.7, 1, 2.1, .5, "bed"); pr(8, 1.7, 1, 2.1, .5, "bed"); pr(5, 5, 2.4, 1.2, .8, "table"); }                // bedroom
    else if (t === 1) { pr(5, 1, 8, 1, .9, "counter"); pr(5, 5.5, 3, 1.2, .8, "table"); }                                       // kitchen
    else if (t === 2) { pr(5, 3, 7, 1.4, .6, "planter"); pr(5, 7, 7, 1.4, .6, "planter"); }                                    // hydroponic greenhouse, long dried out
    else if (t === 3) { pr(3, 4, 3, .6, .45, "iron"); pr(8, 2, 1.2, 1.2, 1.4, "iron"); }                                         // gym
    else if (t === 4) { pr(2, 2, 1.6, 1.6, 1.2, "crate"); pr(8, 2, 1.6, 1.6, 1.2, "crate"); pr(8, 6, 1.4, 1.4, .9, "crate"); }   // storage
    else { pr(1.1, 5, 1, 5, .75, "desk"); pr(6, 5, 2.4, 1.4, .75, "desk"); TS_SCREENS.push([s0 + .2, 5]); }                    // lab: desks under a bank of monitors that still glow
  }
  for (let k = 0; k < 100; k++) {
    const s = k * 10 + 5; TS_COLS.push([s, 16.5, .7, .7]); bucket(s, 16.5, .7, .7); TS_PANELS.push([s, 15]);
    bucket(s, 20, 10, .3);                   // the glass onto the void
    if (k % 4 === 1) prop(s + 5, 18.6, 4, .6, .45, "iron");   // benches facing the glass
  }
})();
function tsBuildAll() {
  const tile = (base, n, line, lw) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, 6000, .1); g.strokeStyle = line; g.lineWidth = lw;
    for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * w / n, 0); g.lineTo(k * w / n, h); g.moveTo(0, k * h / n); g.lineTo(w, k * h / n); g.stroke(); }
  });
  // after the photo of a station room: off-white wall panels over a grey skirting, a pale tiled floor, a white drop ceiling
  const floorT = tile("#b9bcb8", 2, "rgba(70,75,80,.55)", 3), ceilT = tile("#eeeee8", 4, "rgba(150,150,140,.6)", 2);
  // three wall variants so the panels stop repeating: plain, with a vent and a label plate, and water-stained
  // 3 and 4 are the hazard zones: frost creeping in from skirting and ceiling, soot plumes rising off the floor
  const wallTs = [0, 1, 2, 3, 4].map(v => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#dcddd6"; g.fillRect(0, 0, w, h); noise(g, w, 5000, .1); g.fillStyle = "#9da3a7"; g.fillRect(0, h * .9, w, h * .1);
    g.strokeStyle = "rgba(105,110,115,.55)"; g.lineWidth = 3; g.beginPath();
    for (let k = 0; k <= 4; k++) { g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h * .9); }
    g.moveTo(0, h * .35); g.lineTo(w, h * .35); g.stroke();
    if (v === 1) {
      g.fillStyle = "#b9bcb6"; g.fillRect(w * .56, h * .08, w * .14, h * .18); g.fillStyle = "#6f757a";
      for (let k = 0; k < 6; k++) g.fillRect(w * .575, h * (.1 + k * .027), w * .11, h * .012);
      g.fillStyle = "#e8c23a"; g.fillRect(w * .09, h * .45, w * .1, h * .05); g.fillStyle = "#2a2a2a"; g.fillRect(w * .1, h * .465, w * .08, h * .02);
    }
    if (v === 2) for (let k = 0; k < 5; k++) {
      const x = Math.random() * w, y0 = Math.random() * h * .3, len = h * (.3 + Math.random() * .5), gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, "rgba(120,105,70,.35)"); gr.addColorStop(1, "rgba(120,105,70,0)"); g.fillStyle = gr; g.fillRect(x, y0, 4 + Math.random() * 10, len);
    }
    if (v === 3) {
      for (const [y0, y1] of [[h, h * .55], [0, h * .22]]) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, "rgba(232,246,255,.9)"); gr.addColorStop(1, "rgba(232,246,255,0)"); g.fillStyle = gr; g.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0)); }
      g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 1;
      for (let k = 0; k < 70; k++) { let x = Math.random() * w, y = h * (.65 + Math.random() * .35); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (Math.random() - .5) * 16; y -= Math.random() * 10; g.lineTo(x, y); } g.stroke(); }
    }
    if (v === 4) {
      for (let k = 0; k < 4; k++) { const x = Math.random() * w, r = 40 + Math.random() * 50, gr = g.createRadialGradient(x, h, 0, x, h * .55, r * 2); gr.addColorStop(0, "rgba(25,18,12,.9)"); gr.addColorStop(.5, "rgba(70,45,25,.5)"); gr.addColorStop(1, "rgba(70,45,25,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      const gr = g.createLinearGradient(0, 0, 0, h * .3); gr.addColorStop(0, "rgba(40,30,20,.6)"); gr.addColorStop(1, "rgba(40,30,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h * .3);
    }
  }));
  // finger smudges and edge grime on the glass; its alpha also carries the reflection, so it never goes fully clear
  const glassT = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 14; k++) { const x = Math.random() * w, y = h * (.3 + Math.random() * .6), r = 8 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    const e = g.createLinearGradient(0, 0, 0, h); e.addColorStop(0, "rgba(90,95,90,.5)"); e.addColorStop(.08, "rgba(90,95,90,0)"); e.addColorStop(.9, "rgba(90,95,90,0)"); e.addColorStop(1, "rgba(90,95,90,.6)"); g.fillStyle = e; g.fillRect(0, 0, w, h);
  });
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;   // something for steel, tiles and glass to reflect
  const hexT = canvasTex(128, 128, g => {      // hexagonal grating standing in for a missing pane (alpha test: see-through)
    g.strokeStyle = "#0a0806"; g.lineWidth = 5; const r = 12, dx = r * 1.732;
    for (let row = 0; row < 12; row++) for (let col = 0; col < 8; col++) { const cx = col * dx + (row % 2) * dx / 2, cy = row * r * 1.5; g.beginPath(); for (let s = 0; s < 6; s++) { const a = Math.PI / 6 + s * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); }
  });
  floorT.wrapS = floorT.wrapT = ceilT.wrapS = ceilT.wrapT = hexT.wrapS = hexT.wrapT = THREE.RepeatWrapping; hexT.repeat.set(4, 3);
  const std = o => new THREE.MeshStandardMaterial({ envMap: env, ...o });
  // walls take their texture coordinates from size and height, not per box face: one tile per 5 m x the deck's 4 m, so a long
  // partition and a 1 m sill show the paper at the same scale, and sill + lintel line up with the full-height walls around them
  const wallUv = sh => { sh.vertexShader = sh.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
    #ifdef USE_INSTANCING
    { vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)), lp = position * sc, an = abs(normal);
      float along = an.x > .5 ? lp.z + sc.z * .5 : lp.x + sc.x * .5;
      vMapUv = an.y > .5 ? lp.xz / 5.0 : vec2(along / 5.0, (lp.y + instanceMatrix[3].y) / ${TS_H.toFixed(1)}); }
    #endif`); };
  wallTs.forEach(t => t.wrapS = t.wrapT = THREE.RepeatWrapping);
  const wallMs = wallTs.map(map => { const m = std({ map, roughness: .6, envMapIntensity: .25 }); m.onBeforeCompile = wallUv; return m; }), wallM = wallMs[0], ceilM = std({ map: ceilT, roughness: .8, envMapIntensity: .15 });
  const floorMs = [0xffffff, 0x9fc4e0, 0xe09a70, 0x303030].map(c => std({ map: floorT, color: c, roughness: .4, envMapIntensity: .3 }));
  const steelM = std({ color: 0x8a9096, roughness: .3, metalness: .85 }), frameM = std({ color: 0x5d656c, roughness: .45, metalness: .6 }), cableMat = flat(0x15171a), railM = std({ color: 0xd4a830, roughness: .35, metalness: .3 }), panelM = new THREE.MeshBasicMaterial({ color: 0xf2f6ff }), screenM = new THREE.MeshBasicMaterial({ color: 0x8ff0f2 });
  const glassM = std({ map: glassT, color: 0xc4dce6, roughness: .05, metalness: 0, envMapIntensity: 1.4, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const hexM = new THREE.MeshBasicMaterial({ map: hexT, alphaTest: .5, side: THREE.DoubleSide, fog: false });
  const props = { frame: steelM, mattress: flat(0xd6d4ca), pillow: flat(0xf0efe8), blanket: flat(0x5f7d8f), wood: flat(0x8a7a62), top: std({ color: 0xe6e6e0, roughness: .35, envMapIntensity: .4 }), cab: flat(0xa9b0b5),
    tub: flat(0x8d928b), soil: flat(0x3b2f24), dead: flat(0x8c7c4c), leaf: flat(0x56622e), iron: flat(0x30353b), pad: flat(0x6e2a24), plate: flat(0x1c1f22), crate: flat(0xa8845a), band: flat(0x5d4a30), kbd: flat(0x2a2e33) };
  const TYPES = ["臥室", "廚房", "溫室", "健身房", "倉儲", "實驗室"];   // tsPlan picks a room's type with hash(i, 0, 55)
  const sign = (a, b) => new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d8efe0"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a3a2a"; g.textAlign = "center"; g.font = "bold 40px sans-serif"; g.fillText(a, w / 2, h * .45); g.font = "28px sans-serif"; g.fillText(b, w / 2, h * .62);
  }) });
  const doorM = sign("LEVEL 0", "出口 · 自動門"), liftM = sign("電梯", "E ▲ 上樓 · Q ▼ 下樓");
  // seven-legged cleaning robot: a flat shell on legs hung from its rim, a blue status strip on top
  const botBody = new THREE.SphereGeometry(.5, 20, 10).scale(1, .32, .62), botLeg = new THREE.BoxGeometry(.04, .32, .04).translate(0, -.16, 0);
  const botM = std({ color: 0x8d98a2, roughness: .35, metalness: .6 }), botLegM = std({ color: 0x4a525a, roughness: .5, metalness: .7 }), botLedM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a8fd0).multiplyScalar(2) });
  const cleaner = () => {
    const b = new THREE.Group(), legs = [];
    b.add(new THREE.Mesh(botBody, botM).translateY(.44)); b.add(new THREE.Mesh(new THREE.BoxGeometry(.22, .03, .06), botLedM).translateY(.6));
    for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(botLeg, botLegM); l.position.set(-.39 + k * .13, .34, k % 2 ? .24 : -.24); b.add(l); legs.push(l); }
    b.userData.legs = legs; return b;
  };
  // sliding door leaves: brushed panel with a narrow wired-glass slot
  const leafT = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = "#c6cac7"; c.fillRect(0, 0, w, h); noise(c, w, 1500, .08); c.strokeStyle = "#8a9094"; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
    c.fillStyle = "#3a4650"; c.fillRect(w * .55, h * .18, w * .22, h * .32); c.fillStyle = "#d4a830"; c.fillRect(0, h * .9, w, h * .03);
  });
  const leafM = std({ map: leafT, roughness: .4, metalness: .4, envMapIntensity: .6 });
  // floors and ceilings are bent corner by corner, so neighbouring tiles share their edges exactly (bent instances would leave slits)
  const sheet = (quads, y, down) => {
    const pos = [], uv = [];
    for (const [s0, u0, s1, u1] of quads) {
      const c = [[s0, u0], [s1, u0], [s1, u1], [s0, u1]].map(([s, u]) => [...tsP(s, u), s / 5, u / 5]);
      for (const k of down ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { pos.push(c[k][0], y, c[k][1]); uv.push(c[k][2], c[k][3]); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals(); return geo;
  };
  const place = (m, s, y, u) => { const e = tsBend([s, y, u, 0, 1, 1, 1]); m.position.set(e[0], e[1], e[2]); m.rotation.y = e[3]; return m; };   // a plane facing the centre
  for (let lv = 0; lv < TS_N; lv++) {
    const g = new THREE.Group(); g.position.y = lv * TS_FH; tsGroup.add(g);
    const L = { walls: [], lint: [], cols: [], rails: [], panels: [], frame: [], cables: [], screens: [], glass: [], oglass: [], hex: [] }, pl = {}, floors = [[], [], [], []], ceil = [];
    const bx = (l, s, y, u, ls, h, lu) => l.push(tsBend([s, y, u, 0, ls, h / H, lu]));   // y is the box centre, h its height
    L.frost = []; L.scorch = [];
    const wl = (s, y, u, ls, h, lu) => { let z = tsZoneOf(s, Math.min(u, 9.8), lv); if (u > 9 && z !== 1 && z !== 2) z = tsZoneOf(s, 10.2, lv); bx(z === 1 ? L.frost : z === 2 ? L.scorch : L.walls, s, y, u, ls, h, lu); };   // the door wall (u 10) frosts or scorches if either the room or the hall in front of it does
    TS_WALLS.forEach(([s, u, ls, lu]) => wl(s, TS_H / 2, u, ls, TS_H, lu));
    TS_LINTELS.forEach(([s, u, ls, lu]) => bx(L.lint, s, 3.6, u, ls, .8, lu));
    TS_COLS.forEach(([s, u, ls, lu]) => { bx(L.cols, s, TS_H / 2, u, ls, TS_H, lu); bx(L.rails, s, 1.3, u - .37, .1, 1.4, .05); bx(L.rails, s, 1.3, u + .37, .1, 1.4, .05); });   // yellow grab rails, as in the photo
    // furniture: the collision box from tsPlan stays one block, the drawing is built from a few parts
    TS_PROPS.forEach(([s, u, ls, lu, h, m]) => {
      const b = (k, ds, y, du, a, hh, c) => bx(pl[k] ||= [], s + ds, y + hh / 2, u + du, a, hh, c);   // y is the part's bottom
      const legs = (k, hh, i) => { for (const a of [-1, 1]) for (const c of [-1, 1]) b(k, a * (ls / 2 - i), 0, c * (lu / 2 - i), .06, hh, .06); };
      const long = ls > lu, r = k => hash(Math.round(s * 10) + k, Math.round(u * 10), 66);
      if (m === "bed") { b("frame", 0, 0, 0, ls, .28, lu); b("mattress", 0, .28, 0, ls - .08, .16, lu - .08); b("pillow", 0, .44, -lu / 2 + .3, ls - .3, .1, .35); b("blanket", 0, .44, lu * .15, ls - .04, .05, lu * .62); }
      else if (m === "table" || m === "desk") {
        b(m === "desk" ? "top" : "wood", 0, h - .05, 0, ls, .05, lu); legs("frame", h - .05, .08);
        if (m === "desk") for (let k = .6; k < (long ? ls : lu); k += 1.2) b("kbd", long ? k - ls / 2 : -.2, h, long ? -.2 : k - lu / 2, long ? .45 : .18, .03, long ? .18 : .45);
      }
      else if (m === "counter") { b("cab", 0, 0, 0, ls, h - .04, lu - .05); b("top", 0, h - .04, 0, ls, .04, lu); b("frame", ls * .25, h - .01, 0, .6, .02, .4); }
      else if (m === "planter") {
        b("tub", 0, 0, 0, ls, h - .05, lu); b("soil", 0, h - .05, 0, ls - .1, .04, lu - .1);
        for (let k = 0; k < (long ? ls : lu) / .45 - 1; k++) { const o = (k + .5) * .45 - (long ? ls : lu) / 2 + .2, side = (r(k) - .5) * (long ? lu : ls) * .6; b(r(k + 50) < .8 ? "dead" : "leaf", long ? o : side, h - .02, long ? side : o, .07, .15 + r(k + 99) * .6, .07); }   // dried stalks, a few still green
      }
      else if (m === "iron" && h < .6) { b(u > 15 ? "iron" : "pad", 0, h - .08, 0, ls, .08, lu); for (const a of [-1, 1]) b("iron", long ? a * (ls / 2 - .2) : 0, 0, long ? 0 : a * (lu / 2 - .2), long ? .08 : ls - .1, h - .08, long ? lu - .1 : .08); }   // bench
      else if (m === "iron") { b("iron", 0, 0, 0, ls, .04, lu); legs("iron", h, .05); b("frame", 0, 1.1, 0, .04, .04, lu + .4); for (const a of [-1, 1]) b("plate", 0, .88, a * (lu / 2 + .12), .45, .45, .06); }   // squat rack with a loaded bar
      else { b("crate", 0, 0, 0, ls, h, lu); for (const y of [.3, .75]) b("band", 0, h * y, 0, ls + .02, .06, lu + .02); if (r(7) < .5) b("crate", .1, h, -.1, ls * .6, h * .5, lu * .6); }
    });
    TS_SCREENS.forEach(([s, u]) => { if (tsZoneOf(s + 1, u, lv) !== 3) bx(L.screens, s, 2.1, u, .06, .9, 3.6); });
    TS_PANELS.forEach(([s, u]) => {
      const zn = tsZoneOf(s, u, lv), rs = Math.round(s), ru = Math.round(u);
      if (zn !== 3 && hash(rs, ru, 77 + lv) < (zn === 2 ? .3 : .75)) L.panels.push(tsBend([s, TS_H - .03, u, hash(rs, ru, 78) < .5 ? Math.PI / 2 : 0, 1, 1, 1]));
    });
    for (let s = 0; s < TS_L; s += 5) for (let u = 0; u < 20; u += 5) {
      const zn = tsZoneOf(s + 2.5, u + 2.5, lv), rs = Math.round(s), ru = Math.round(u);
      floors[zn].push([s, u, s + 5, u + 5]); ceil.push([s, u, s + 5, u + 5]);
      if (zn === 3 && hash(rs, ru, 79 + lv) < .4) bx(L.cables, s + 2.5 + (hash(rs, ru, 80) - .5) * 3, TS_H - .6, u + 2.5 + (hash(rs, ru, 81) - .5) * 3, .05, 1.2, .05);   // torn-down cables in the dark stretches
    }
    for (let k = 0; k < TS_L / 5; k++) {
      const s = k * 5, sc = s + 2.5;
      // the hull: solid in the lobbies, elsewhere a sill and a lintel round a window strip onto Level 0
      if (TS_LOBBY.includes(tsSlot(sc))) wl(sc, TS_H / 2, .2, 5, TS_H, .4);
      else { wl(sc, .5, .2, 5, 1, .4); wl(sc, 3.3, .2, 5, 1.4, .4); bx(L.frame, s, 1.8, .2, .15, 1.6, .45); L.oglass.push(tsBend([sc, 1.8, .05, 0, 4.85, 1.6, 1])); }
      // the inner glass: sill, rail, slab rim, mullions every 5 m, and a pane per bay (some torn out and replaced by grating)
      bx(L.frame, sc, .4, 19.9, 5, .8, .3); bx(L.frame, sc, 3.9, 19.9, 5, .2, .3); bx(L.frame, sc, TS_H + .2, 20.05, 5, .4, .5); bx(L.frame, s, 2.4, 19.95, .15, 3.2, .15);
      (hash(k, lv, 62) < .12 ? L.hex : L.glass).push(tsBend([sc, 2.4, 20, 0, 4.85, 3.2, 1]));
    }
    const W = [[], [], [], L.frost, L.scorch]; L.walls.forEach((e, i) => W[Math.floor(hash(i, lv, 64) * 3)].push(e)); W.forEach((l, k) => inst(g, boxGeo, wallMs[k], l)); inst(g, boxGeo, wallM, L.lint); inst(g, boxGeo, steelM, L.cols); inst(g, boxGeo, railM, L.rails); inst(g, boxGeo, frameM, L.frame); inst(g, boxGeo, cableMat, L.cables); inst(g, boxGeo, screenM, L.screens);
    Object.entries(pl).forEach(([m, l]) => inst(g, boxGeo, props[m], l));
    floors.forEach((q, k) => q.length && g.add(new THREE.Mesh(sheet(q, 0, false), floorMs[k]))); g.add(new THREE.Mesh(sheet(ceil, TS_H, true), ceilM));
    inst(g, panelGeo, panelM, L.panels); inst(g, sideGeo, glassM, L.glass); inst(g, sideGeo, glassM, L.oglass); inst(g, sideGeo, hexM, L.hex);
    g.add(place(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), doorM), 2.5, 1.2, .45));   // the way back to Level 0, in lobby 0
    for (const i of TS_LOBBY) g.add(place(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), liftM), i * 10 + 7.5, 1.2, .45));
    // room plates beside each door, hall side: deck + room number and the room's type, all from one atlas per deck
    const plateT = canvasTex(1024, 512, (c, w, h) => {
      c.textAlign = "center";
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * w / 10, y = Math.floor(i / 10) * h / 10;
        c.fillStyle = "#e4e8e6"; c.fillRect(x, y, w / 10, h / 10); c.fillStyle = "#2a6f8a"; c.fillRect(x, y, 8, h / 10); c.fillStyle = "#1d2a30";
        c.font = "bold 26px sans-serif"; c.fillText(`${lv + 1}${String(i).padStart(2, "0")}`, x + w / 20 + 4, y + 27); c.font = "14px sans-serif"; c.fillText(TYPES[Math.floor(hash(i, 0, 55) * 6)], x + w / 20 + 4, y + 45);
      }
    });
    const pp = [], pt = [];
    for (let i = 0; i < 100; i++) {
      if (TS_LOBBY.includes(i)) continue;
      const sa = i * 10 + 6.8, cu = (i % 10) / 10, cv = 1 - (Math.floor(i / 10) + 1) / 10;   // seen from the hall, growing s runs to the right
      const q = [[sa, 1.85, cu, cv], [sa + .6, 1.85, cu + .1, cv], [sa + .6, 2.15, cu + .1, cv + .1], [sa, 2.15, cu, cv + .1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { const [x, z] = tsP(q[k][0], 10.17); pp.push(x, q[k][1], z); pt.push(q[k][2], q[k][3]); }
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute("uv", new THREE.Float32BufferAttribute(pt, 2)); pg.computeVertexNormals();
    g.add(new THREE.Mesh(pg, std({ map: plateT, roughness: .5, envMapIntensity: .3, side: THREE.DoubleSide })));
    const s0 = hash(lv, 2, 63) * TS_L, cl = cleaner();     // a cleaner still sweeping the hall
    g.add(cl); TS_BOTS.push([cl, s0, 14, 12, .5, lv]);
    // the doors: leaves in the dark stretches are jammed part-open, the rest open as you come near
    const D = { m: new THREE.InstancedMesh(boxGeo, leafM, TS_DOOR_C.length * 2), open: new Float32Array(TS_DOOR_C.length), stuck: TS_DOOR_C.map((c, n) => tsZoneOf(c, 10.2, lv) === 3 || tsZoneOf(c, 5, lv) === 3 ? .45 + .35 * hash(n, lv, 91) : -1) };
    D.m.frustumCulled = false; TS_DOOR_C.forEach((c, n) => { D.open[n] = Math.max(0, D.stuck[n]); tsDoorSet(D, n); }); g.add(D.m); TS_DOOR[lv] = D;
    for (let k = 0; k < 2; k++) { const [x, z] = tsP(hash(lv, k + 5, 63) * TS_L, 18.2); g.add(person(k ? "#6c7882" : "#7a8690", x, z)); }   // robots that stopped for good
  }
  // shortcut: six lights follow the player (four rooms, two hall bays) instead of one per panel (9 decks x ~200 would kill the frame rate)
  for (let k = 0; k < 6; k++) { const l = new THREE.PointLight(0xfff0d8, 0, 11, 1.5); tsGroup.add(l); TS_LAMPS.push(l); }
  tsFx = buildVoid();
}
// The central void: a white shell, a bubble big enough for a small country in the story, here 300 m across. The decks are its
// equator; above and below, the shell carries on as two caps painted with the window bands of decks nobody reaches. Dust hangs
// in it, and at the zenith a broken lamp flares (the starburst in the photo taken from Level 0). Outside the hull, past the room
// windows, Level 0 itself: identical storeys stacked without end, two cylinders so the near pillars slide over the far rooms.
function buildVoid() {
  const RV = Math.hypot(TS_RO - 20, TS_MID), cap = Math.acos(TS_MID / RV);   // the caps meet the inner glass exactly at the top and bottom decks
  const shellT = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#cfcabd"; g.fillRect(0, 0, w, h); noise(g, w, 9000, .12);
    for (let r = 0; r < 16; r++) {
      const y = r * 32; g.fillStyle = "#8d8a80"; g.fillRect(0, y, w, 4);
      for (let c = 0; c < 32; c++) { const v = Math.random(); g.fillStyle = v < .2 ? "#2a2724" : v < .32 ? "#9c9587" : "#fff1cf"; g.fillRect(c * 16 + 2, y + 12, 12, 10); }
    }
    g.fillStyle = "rgba(120,116,104,.6)"; for (let c = 0; c < 8; c++) g.fillRect(c * 64, 0, 3, h);
    for (let k = 0; k < 6; k++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(20,16,12,.85)"); gr.addColorStop(1, "rgba(20,16,12,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }   // burnt-out patches
  });
  shellT.wrapS = shellT.wrapT = THREE.RepeatWrapping; shellT.repeat.set(6, 3);
  const shellM = new THREE.MeshBasicMaterial({ map: shellT, side: THREE.BackSide });
  for (const t0 of [0, Math.PI - cap]) { const m = new THREE.Mesh(new THREE.SphereGeometry(RV, 96, 24, 0, 2 * Math.PI, t0, cap), shellM); m.position.set(CX, TS_MID, CZ); tsGroup.add(m); }
  const fx = new THREE.Group(); fx.position.set(CX, TS_MID, CZ); tsGroup.add(fx);
  const dust = new THREE.Group(); fx.add(dust);
  for (let k = 0; k < 16; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8a7356, transparent: true, opacity: .45, depthWrite: false, fog: false }));
    const a = hash(k, 1, 96) * 6.2832, r = hash(k, 2, 96) * 110; s.position.set(Math.cos(a) * r, (hash(k, 3, 96) - .5) * 170, Math.sin(a) * r); s.scale.setScalar(90 + hash(k, 4, 96) * 120); dust.add(s);
  }
  const burst = canvasTex(256, 256, g => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, "rgba(255,235,190,1)"); r.addColorStop(.12, "rgba(255,190,100,.8)"); r.addColorStop(.5, "rgba(255,140,50,.18)"); r.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); g.lineCap = "round";
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + hash(k, 1, 95) * .3, len = 70 + hash(k, 2, 95) * 56; g.strokeStyle = "rgba(255,190,110,.65)"; g.lineWidth = 1 + hash(k, 3, 95) * 2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * len, 128 + Math.sin(a) * len); g.stroke(); }
    g.fillStyle = "#150d07"; for (let k = 0; k < 4; k++) { const x = 114 + k * 9, y = 116 + (k % 2) * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 22); g.lineTo(x - 3, y + 22); g.fill(); }   // the lamp's broken spindles
  });
  const lamp = new THREE.Group(); lamp.position.y = RV - 8; fx.add(lamp);
  const spr = (map, color, sx, sy, add) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, fog: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); s.scale.set(sx, sy, 1); lamp.add(s); return s; };
  spr(burst, 0xffffff, 70, 70, false); spr(glowTex, 0xffc070, 260, 2.5, true); spr(glowTex, 0x9a6a30, 160, 160, true);
  const l0 = (cut) => canvasTex(512, 256, (g, w, h) => {   // two storeys of Level 0, 16 m wide; cut: leave the rooms between the pillars see-through
    for (let f = 0; f < 2; f++) {
      const y = f * 128;
      if (!cut) {
        g.fillStyle = "#a08c3c"; g.fillRect(0, y, w, 128);
        g.fillStyle = "rgba(60,50,18,.5)"; for (let x = 0; x < w; x += 12) g.fillRect(x, y + 22, 4, 96);           // wallpaper stripes
        g.fillStyle = "#2a2310"; for (let x = 40; x < w; x += 170) g.fillRect(x, y + 50, 30, 68);               // doorways deeper in
        for (let x = 64; x < w; x += 128) { const gr = g.createRadialGradient(x, y + 24, 0, x, y + 24, 70); gr.addColorStop(0, "rgba(255,240,150,.35)"); gr.addColorStop(1, "rgba(255,240,150,0)"); g.fillStyle = gr; g.fillRect(x - 70, y + 22, 140, 96); }
      }
      g.fillStyle = "#17130a"; g.fillRect(0, y, w, 10);                                                         // slab
      g.fillStyle = "#8f8146"; g.fillRect(0, y + 10, w, 12);                                                    // ceiling tiles
      g.fillStyle = "#fff3b0"; for (let x = 20; x < w; x += 64) g.fillRect(x, y + 13, 26, 6);                  // light panels
      g.fillStyle = "#5c4c26"; g.fillRect(0, y + 116, w, 12);                                                   // carpet edge
      if (cut) { g.fillStyle = "#9c8a40"; for (let x = 0; x < w; x += 128) g.fillRect(x, y + 22, 18, 94); }    // pillars
    }
  });
  for (const [r, cut, dim] of [[300, false, 0xa8a8a8], [200, true, 0xd0d0d0]]) {
    const t = l0(cut), hgt = r * 3; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.round(2 * Math.PI * r / 16), Math.round(hgt / 6.8));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 128, 1, true), new THREE.MeshBasicMaterial({ map: t, color: dim, side: THREE.BackSide, alphaTest: cut ? .5 : 0, transparent: false, fog: false }));
    m.position.set(CX, TS_MID, CZ); tsGroup.add(m);
  }
  return { dust, lamp };
}
function tsAlarm() {                         // the station's automated voice
  say("【廣播】偵測到空間異常，請所有人員保持冷靜。", 5000);
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance("偵測到空間異常。請所有人員保持冷靜。"); u.lang = "zh-CN"; u.rate = .9; speechSynthesis.speak(u); } catch (e) {}
}
const TS_TELL = { 10: "冷庫般的低溫，呼出的氣瞬間結霜。不宜久留。", 11: "熱得嗆人，水培溫室裡的植物早已乾枯。", 12: "這一段幾乎全黑，裸露的電纜在牆邊噼啪作響。" };
function tsCollide() {                       // in straight space (pushOut works on P), then bent back onto the ring
  [P.x, P.z] = tsS(P.x, P.z);
  tsCands(P.x, (r, w) => { P.x -= w; pushOut(r[0], r[1], r[2], r[3]); P.x += w; });
  [P.x, P.z] = tsP(P.x, P.z);
}
function enterStation() {
  tsSaved = mode === "map" ? [P.x, P.z, P.yaw] : [SPAWN[0], SPAWN[1], 0]; clearExit();   // arriving from the base (map pegman): the way back leads to Level 0's start exitT = 60 + Math.random() * 60;
  if (!tsBuilt) { tsBuilt = true; tsBuildAll(); }
  mode = "station"; tsLevel = TS_START; tsT = tsExp = 0; tsAlarmT = 7; tsCut = 150 + Math.random() * 120; tsFar(700);
  const [fc, fd, hi, hc] = AMB[9]; hemi.groundColor.set(0xd0d0c8); scene.fog.color.set(fc); scene.fog.density = fd; hemi.color.set(hc); hemi.intensity = hi;   // snap the atmosphere: easing from Level 0's yellow would tint the void for seconds
  tsGroup.visible = true; floor.visible = ceil.visible = false; fig.visible = false;
  P.x = TS_HOME[0]; P.z = TS_HOME[1]; P.y = TS_START * TS_FH; P.yaw = Math.atan2(P.x - CX, P.z - CZ); P.pitch = 0; dropY = 0; fallV = 0;   // facing the glass and the void
  fadeEl.style.opacity = 0; state = "play";
  say("LEVEL 0.1 · 天頂站 ——一座被 Level 0 整個吞進去的球形空間站。", 6000);
  setTimeout(() => mode === "station" && say("玻璃後面是中央空泡：蟲洞本該在那裡打開，如今什麼也沒有。", 6000), 13000);
}
function enterMap() {                         // back into Level 0 from the station or the base, where you land is up to the caller
  mode = "map"; baseGroup.visible = tsGroup.visible = remodelGroup.visible = false; tsFar(120); hemi.groundColor.set(0xa08a3a); floor.visible = ceil.visible = true;
  fadeEl.style.opacity = 0; state = "play";
}
function leaveStation(text) {
  mode = "map"; tsFar(120); tsGroup.visible = false; hemi.groundColor.set(0xa08a3a); floor.visible = ceil.visible = true;
  [P.x, P.z, P.yaw] = tsSaved; P.y = 0; P.pitch = 0; fadeEl.style.opacity = 0; state = "play"; say(text, 5000);
}
// 切出: the space slips and drops you somewhere else, usually Level 1
function tsCutOut() {
  state = "wait"; fadeEl.innerHTML = "眼前一黑，空間忽然錯位……"; fadeEl.style.opacity = 1;
  setTimeout(() => Math.random() < .7 ? enterBase() : leaveStation("你回到了 Level 0。"), 2500);
}
function tsRide(d) {                         // the lifts in the corner halls
  const lv = tsLevel + d; if (lv < 0 || lv >= TS_N) { say("電梯到頭了。", 2000); tsRideT = 1.5; return; }
  tsRideT = 2; state = "wait"; fadeEl.innerHTML = ""; fadeEl.style.opacity = 1;
  setTimeout(() => { tsLevel = lv; P.y = lv * TS_FH; fadeEl.style.opacity = 0; state = "play"; say(`第 ${lv + 1} 層甲板`, 1800); }, 700);
}
function tsTick(dt) {
  tsC += dt; tsRideT -= dt;
  for (const [b, s0, u0, a, sp, lv] of TS_BOTS) if (lv === tsLevel) {
    const bs = s0 + a * Math.sin(tsC * sp), back = Math.cos(tsC * sp) < 0;
    [b.position.x, b.position.z] = tsP(bs, u0); b.rotation.y = -bs / TS_RR - Math.PI / 2 + (back ? Math.PI : 0);
    b.userData.legs.forEach((l, k) => l.rotation.z = Math.sin(tsC * 9 + k * 1.7) * .35);
  }
  tsFx.dust.rotation.y += dt * .004; tsFx.lamp.children[0].material.opacity = Math.random() < .03 ? .3 : .95;   // the dust drifts; the broken lamp stutters
  if ((tsAlarmT -= dt) <= 0) { tsAlarmT = 70; tsAlarm(); }
  const [s, u] = tsS(P.x, P.z), slot = tsSlot(s), zn = tsZoneOf(s, u, tsLevel);
  const D = TS_DOOR[tsLevel];
  TS_DOOR_C.forEach((c, n) => {
    const ds = Math.abs(((s - c) % TS_L + TS_L * 1.5) % TS_L - TS_L / 2), want = D.stuck[n] >= 0 ? D.stuck[n] : ds < 2.6 && Math.abs(u - 10) < 3.2 ? 1 : 0, o = D.open[n];
    if (o !== want) {
      if (o === 0 || o === 1) noiseBurst(650, .9, o ? .07 : .13, 1, o ? .7 : .45, .5);   // the pneumatic hiss as a leaf starts to move
      D.open[n] = want > o ? Math.min(want, o + dt * 2.2) : Math.max(want, o - dt * 1.4); tsDoorSet(D, n);
    }
  });
  // sound: the cleaner's legs tick on the tiles when it's close; the cold zones moan with wind, the hot ones crackle
  const bot = TS_BOTS.find(b => b[5] === tsLevel)[0], bd = Math.hypot(bot.position.x - P.x, bot.position.z - P.z);
  if (bd < 14 && (tsSndBot -= dt) <= 0) { tsSndBot = .16; noiseBurst(3400, 5, .12 * (1 - bd / 14), 1, .03, .03); }
  if ((tsSndZone -= dt) <= 0) {
    if (zn === 1) { tsSndZone = 2 + Math.random() * 2; noiseBurst(260 + Math.random() * 120, .8, .1, 1, 3, 3); }
    else if (zn === 2) { tsSndZone = .3 + Math.random() * .8; noiseBurst(1800 + Math.random() * 1500, 1.5, .09, 2 + Math.floor(Math.random() * 4), .03, .07); }
    else tsSndZone = .5;
  }
  // the room lights: the four room centres nearest the player, dark stretches left unlit, some tubes failing
  const rooms = [], bays = [];
  for (let i = slot - 2; i <= slot + 2; i++) {
    const k = ((i % 100) + 100) % 100, c = i * 10 + 5;
    if (!TS_LOBBY.includes(k) && tsZoneOf(c, 5, tsLevel) !== 3) rooms.push([Math.abs(c - s), k, 5]);
    if (tsZoneOf(c, 15, tsLevel) !== 3) bays.push([Math.abs(c - s), k, 15]);
  }
  rooms.sort((a, b) => a[0] - b[0]); bays.sort((a, b) => a[0] - b[0]);
  const lit = [...rooms.slice(0, 4), ...bays.slice(0, 2)];
  TS_LAMPS.forEach((l, j) => {
    const [, k, lu] = lit[j] || []; if (k === undefined) { l.intensity = 0; return; }
    [l.position.x, l.position.z] = tsP(k * 10 + 5, lu); l.position.y = tsLevel * TS_FH + TS_H - 1;   // hung lower than the panel, or the ceiling right above it burns white
    const on = lu === 5 ? 20 : 16;
    l.intensity = hash(k, tsLevel + lu, 90) < .25 ? (Math.sin(tsC * 23 + k) > .6 || Math.random() < .04 ? on * .1 : on) : on;
  });
  if (slot === 0 && Math.abs(s - 2.5) < 1.3 && u < 1.2) { leaveStation("你穿過自動門，走回了 Level 0。"); return; }
  const lift = TS_LOBBY.includes(slot) && Math.abs(s - slot * 10 - 7.5) < 1.8 && u < 2.5;
  if (lift && !tsInLift) say("電梯：E 上樓　Q 下樓", 3500);
  tsInLift = lift;
  if (lift && tsRideT <= 0 && (keys.KeyE || keys.KeyQ)) tsRide(keys.KeyE ? 1 : -1);
  tsExp = zn === 1 || zn === 2 ? tsExp + dt : Math.max(0, tsExp - dt * 2);
  if (tsExp > 8 && tsExp - dt <= 8) say("你的身體開始失去知覺，該離開這裡了。", 3500);
  if (tsExp > 15) { tsExp = 0; respawn(zn === 1 ? "寒氣鑽進骨頭裡，你失去了意識……" : "高溫讓你眼前發白，你失去了意識……", 3000); }
  else if ((tsT += dt) > tsCut) tsCutOut();
}
const TS_PLACES = [["中央空泡", CX, CZ], ...TS_LOBBY.map(i => [i ? "電梯" : "電梯 · 出口", ...tsP(i * 10 + 5, 5)]), ...TS_LOBBY.map(i => ["環廊", ...tsP(i * 10 + 130, 15)])];
const TS_ZCOL = [0xdfe3e8, 0xa9d4f0, 0xf2b48a, 0x6b7280];   // station floor by zone: normal, freezing, scorching, dark
// 天頂站: the ring plan is the same on every deck, so only the floor colours (hazard zones) change with the selected deck
function buildStationMap() {
  const col = new THREE.Color(), tiles = [], h = H * MAP_WALL;
  for (let s = 2.5; s < TS_L; s += 5) for (let u = 2.5; u < 20; u += 5) tiles.push([...tsBend([s, 0, u, 0, 5, 1, 5]), tsZoneOf(s, u, mapDeck)]);
  const floors = new THREE.InstancedMesh(flatGeo, new THREE.MeshLambertMaterial(), tiles.length);
  tiles.forEach(([x, y, z, r, sx, sy, sz, zn], n) => { floors.setMatrixAt(n, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_u, r), _s.set(sx, sy, sz))); floors.setColorAt(n, col.set(TS_ZCOL[zn])); });
  mapWorld.add(floors);
  const mat = c => new THREE.MeshLambertMaterial({ color: c }), box = (list, hh) => list.map(([s, u, ls, lu]) => tsBend([s, hh / 2, u, 0, ls, hh / H, lu]));
  const ring = u => Array.from({ length: 100 }, (_, k) => [k * 10 + 5, u, 10, .4]);   // the hull and the glass, in 10 m pieces
  inst(mapWorld, boxGeo, mat(0xfafafa), box(TS_WALLS.concat(ring(.2)), h)); inst(mapWorld, boxGeo, mat(0xbfc4cc), box(TS_COLS, h));
  inst(mapWorld, boxGeo, mat(0x9aa0a6), TS_PROPS.map(([s, u, ls, lu, ph]) => tsBend([s, ph / 2, u, 0, ls, ph / H, lu])));
  inst(mapWorld, boxGeo, mat(0x8ab4d8), box(ring(20), h));   // the glass wall onto the central void
}
