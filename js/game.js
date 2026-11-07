"use strict";
// ---------- input ----------
const keys = {}, ov = document.getElementById("ov"), fadeEl = document.getElementById("fade"), msgEl = document.getElementById("msg"), redv = document.getElementById("redv");
const docViewerEl = document.getElementById("docViewer"), docBody = document.getElementById("docBody");
let docOpen = false;
function toggleDoc(on = !docOpen) {
  docOpen = on;
  if (!on && docBody.dataset.o) { docBody.innerHTML = docBody.dataset.o; delete docBody.dataset.o; }   // Level 0.3 swaps in its own papers
  docViewerEl.style.display = on ? "flex" : "none";
  if (on) { document.exitPointerLock(); }
  else if (!mapOpen && state === "play") { renderer.domElement.requestPointerLock()?.catch?.(() => {}); }
}
document.getElementById("docClose").onclick = () => toggleDoc(false);
addEventListener("keydown", e => {
  if (mode === "memory" && e.repeat && ["KeyE", "KeyJ", "KeyF"].includes(e.code)) { e.preventDefault(); return; }
  if (mode === "memory" && !e.repeat && Memory07.key(e.code)) { e.preventDefault(); return; }
  keys[e.code] = true;
  if (e.code === "KeyR" && (mode === "base" || mode === "remodel" || mode === "ice" || mode === "infirmary")) location.reload();
  if (e.code === "KeyE") {
    if (docOpen) { toggleDoc(false); }
    else if (mode === "remodel") remodelInteract.onKeyE();
    else if (mode === "ice") iceInteract.onKeyE();
    else if (mode === "infirmary") infirmaryInteract.onKeyE();
  }
  if (e.code === "Escape" && docOpen) { toggleDoc(false); }
});
addEventListener("keyup", e => keys[e.code] = false);
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });   // alt-tab swallows keyup: don't keep walking
// Chrome rejects a relock within ~1s of Esc; the overlay stays up, the next click works
ov.addEventListener("click", () => { renderer.domElement.requestPointerLock()?.catch?.(() => {}); startAudio(); });
document.addEventListener("pointerlockchange", () => {
  const on = document.pointerLockElement === renderer.domElement;
  ov.style.display = on || mapOpen ? "none" : "flex";
  if (actx) on ? actx.resume() : actx.suspend();                                  // pause silences the world too
  if (on) { const t = document.getElementById("title"); t.style.opacity = mode === "map" ? 1 : 0; setTimeout(() => t.style.opacity = 0, 4500); }
  if (!on) for (const k in keys) keys[k] = false;
});
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  P.yaw -= e.movementX * .0022; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * .0022));
});
let msgTimer;
function say(text, ms = 4000) {
  msgEl.textContent = text; msgEl.style.opacity = 1; clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.style.opacity = 0, ms);
}

// ---------- audio: fluctuating fluorescent hum, whispers, scratching behind walls ----------
let actx, humGain, noiseBuf, exitGain, exitPan, bus, farBus, exitF, breathGain;
let verbIn, verbTone, verbWet, verbNow = null, verbKey = "", toneF, toneGain;
// how each place sounds: reverb length (s), how bright the echo is (Hz), how much of it; the floor underfoot;
// the room tone that never stops (band-pass noise: Hz, Q, volume, slow wobble); and what is heard rooms away
const ROOMS = {
  map:       { grade: [1, 1, 1, 1], verb: 1.8, tone: 4200, wet: .32, floor: "carpet", room: [120, .7, .012, .2], ev: ["whisper", "scratch", "farSteps", "farSlam"], evT: 1 },
  hall:      { grade: [1, 1, 1, 1], verb: 2.6, tone: 3600, wet: .38, floor: "carpet", room: [120, .7, .014, .2], ev: ["whisper", "scratch", "farSteps", "farSlam"], evT: 1 },
  atrium:    { grade: [.98, .98, 1, .95], verb: 4.2, tone: 2600, wet: .5, floor: "carpet", room: [70, .6, .022, .4], ev: ["farSteps", "farSlam", "whisper"], evT: 1 },
  dark:      { grade: [.94, .96, 1.02, .8], verb: 1.2, tone: 2200, wet: .28, floor: "water", room: [90, .8, .01, .3], ev: ["whisper", "scratch", "drip"], evT: .8 },
  station:   { grade: [.97, 1, 1.04, .85], verb: 3.4, tone: 3000, wet: .42, floor: "metal", room: [55, .5, .03, .25], ev: ["train", "chime", "farSlam", "farSteps"], evT: 1.2 },
  remodel:   { grade: [1, 1, .99, .9], verb: 1.1, tone: 6000, wet: .24, floor: "tile", room: [240, .8, .008, .1], ev: ["farSteps", "rattle", "farSlam"], evT: 1.3 },
  ice:       { grade: [.92, .98, 1.08, .78], verb: 2.4, tone: 7000, wet: .4, floor: "ice", room: [520, .5, .02, .6], ev: ["crack", "rattle", "gust"], evT: 1 },
  infirmary: { grade: [.95, 1.03, .96, .8], verb: 1.6, tone: 2800, wet: .36, floor: "tile", room: [50, 1.2, .02, .15], ev: ["drip", "knock", "farSteps", "whisper"], evT: .9 },
  memory:    { grade: [1.03, 1, .95, .9], verb: 2.0, tone: 3400, wet: .3, floor: "carpet", room: [150, .7, .006, .2], ev: ["farSteps", "drip"], evT: 2.2 },
  base:      { grade: [1, 1, 1, 1], verb: 3.0, tone: 3200, wet: .36, floor: "concrete", room: null, ev: null },   // Level 1 runs its own sounds
};
const roomOf = zt => mode !== "map" ? ROOMS[mode] ? mode : "map" : zt === ATRIUM ? "atrium" : zt === PIL ? "hall" : zt === DARK ? "dark" : "map";
const irCache = {};
function makeIR(sec) {                       // decaying stereo noise; a longer tail is a bigger room
  if (irCache[sec]) return irCache[sec];
  const ir = actx.createBuffer(2, Math.floor(actx.sampleRate * sec), actx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.5); }
  return irCache[sec] = ir;
}
// a convolver's buffer can be set only once, so a new room gets a new convolver, crossfaded in over a second
function setRoom(key) {
  if (!actx || key === verbKey) return; verbKey = key; const R = ROOMS[key], t0 = actx.currentTime;
  const v = actx.createConvolver(), g = actx.createGain(); v.buffer = makeIR(R.verb); g.gain.value = 0;
  verbIn.connect(v); v.connect(g); g.connect(verbTone); g.gain.setTargetAtTime(1, t0, .35);
  if (verbNow) { const o = verbNow; o.g.gain.setTargetAtTime(0, t0, .35); setTimeout(() => { o.v.disconnect(); o.g.disconnect(); }, 2500); }
  verbNow = { v, g };
  verbTone.frequency.setTargetAtTime(R.tone, t0, .4); verbWet.gain.setTargetAtTime(R.wet, t0, .4);
  const r = R.room || [100, 1, 0, 0]; toneF.frequency.setTargetAtTime(r[0], t0, .5); toneF.Q.setTargetAtTime(r[1], t0, .5);
}
function startAudio() {
  if (actx) return; actx = new AudioContext();
  // every sound goes through one bus with a room reverb: generated decaying-noise impulses, so no audio files
  bus = actx.createGain(); bus.connect(actx.destination);
  verbIn = actx.createGain(); verbTone = actx.createBiquadFilter(); verbTone.type = "lowpass"; verbWet = actx.createGain();
  verbTone.connect(verbWet); verbWet.connect(actx.destination); bus.connect(verbIn);
  const verb = verbIn;
  // far-off sounds: mostly reverb, a little dry, so they seem to come from rooms away
  farBus = actx.createGain(); const farDry = actx.createGain(); farDry.gain.value = .25; farBus.connect(farDry); farDry.connect(actx.destination); farBus.connect(verb);
  // room tone: no real place is ever silent; ventilation, pipes, wind
  const rt = actx.createBufferSource(); toneF = actx.createBiquadFilter(); toneF.type = "bandpass"; toneGain = actx.createGain(); toneGain.gain.value = 0;
  rt.loop = true; rt.connect(toneF); toneF.connect(toneGain); toneGain.connect(bus);
  const out = actx.createGain(); out.gain.value = .12; out.connect(bus); humGain = out;
  [60, 120, 180, 240].forEach((f, n) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = n ? "sine" : "sawtooth"; o.frequency.value = f; g.gain.value = n ? .25 / n : .08; o.connect(g); g.connect(out); o.start();
  });
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  rt.buffer = noiseBuf; rt.start(); setRoom(roomOf(prevT));
  const n = actx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3500; f.Q.value = 3;
  const g = actx.createGain(); g.gain.value = .05; n.connect(f); f.connect(g); g.connect(out); n.start();
  // the flickering wall buzzes, louder the closer it is
  const eo = actx.createOscillator(), ef = actx.createBiquadFilter(); eo.type = "sawtooth"; eo.frequency.value = 97; ef.type = "lowpass"; ef.frequency.value = 600; exitF = ef;
  exitGain = actx.createGain(); exitGain.gain.value = 0; exitPan = actx.createStereoPanner(); eo.connect(ef); ef.connect(exitGain); exitGain.connect(exitPan); exitPan.connect(bus); eo.start();
  // breathing: a looped breath-band noise whose gain the loop shapes into inhales and exhales as you tire
  const bs = actx.createBufferSource(), bf = actx.createBiquadFilter(); bs.buffer = noiseBuf; bs.loop = true; bf.type = "bandpass"; bf.frequency.value = 1000; bf.Q.value = .6;
  breathGain = actx.createGain(); breathGain.gain.value = 0; bs.connect(bf); bf.connect(breathGain); breathGain.connect(bus); bs.start();
}
// footing: heel thump (Hz, volume), scuff (Hz, Q, volume, length), and how the gait changes (step rate, bob size)
const FLOORS = {
  carpet:   { thump: [65, .2], scuff: [600, .8, .08, .09], rate: 1, bob: 1 },
  water:    { thump: [55, .16], scuff: [420, 1.2, .2, .2], rate: .85, bob: .8 },
  tile:     { thump: [85, .22], scuff: [2200, 1.5, .12, .06], rate: 1, bob: 1 },
  metal:    { thump: [110, .2], scuff: [1700, 2, .1, .05], ring: 640, rate: 1, bob: 1 },
  concrete: { thump: [75, .22], scuff: [1500, 1.2, .1, .07], rate: 1, bob: 1 },
  ice:      { thump: [90, .14], scuff: [3600, 1, .07, .04], crunch: true, rate: .8, bob: .7 },
};
let floorNow = FLOORS.carpet;
function footstep(f) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime, v = .8 + Math.random() * .4;
  o.frequency.value = f.thump[0] * (.85 + Math.random() * .3); g.gain.setValueAtTime(f.thump[1] * v, t0);
  g.gain.exponentialRampToValueAtTime(.001, t0 + .12);
  o.connect(g); g.connect(bus); o.start(); o.stop(t0 + .13);
  const [sf, sq, sv, sl] = f.scuff;
  noiseBurst(sf * (.8 + Math.random() * .4), sq, sv * v, 1, sl * (.8 + Math.random() * .5), 0, 0);
  if (f.crunch) noiseBurst(2400 + Math.random() * 1500, 2, .05 * v, 3, .025, .03, 0);   // ice crust giving way
  if (f.ring) {                              // a metal deck rings faintly under the heel
    const r = actx.createOscillator(), rg = actx.createGain(); r.frequency.value = f.ring * (.95 + Math.random() * .1);
    rg.gain.setValueAtTime(.025 * v, t0); rg.gain.exponentialRampToValueAtTime(.0005, t0 + .35); r.connect(rg); rg.connect(bus); r.start(); r.stop(t0 + .36);
  }
}
// rooms-away sounds for the other levels
function tone(f0, f1, vol, len, dest = bus, side = Math.random() * 2 - 1) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), pan = actx.createStereoPanner(), t0 = actx.currentTime; pan.pan.value = side;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + len);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .01); g.gain.exponentialRampToValueAtTime(.0005, t0 + len);
  o.connect(g); g.connect(pan); pan.connect(dest); o.start(t0); o.stop(t0 + len + .02);
}
// pulses of band-passed noise from a random side: freq/Q set the character, pulses x gap the rhythm
function noiseBurst(freq, q, vol, pulses, len, gap, side = Math.random() * 2 - 1, dest = bus) {
  if (!actx) return;
  const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(), pan = actx.createStereoPanner(); pan.pan.value = side;
  const t0 = actx.currentTime; g.gain.setValueAtTime(0, t0);
  for (let k = 0; k < pulses; k++) { const t = t0 + k * gap; g.gain.linearRampToValueAtTime(vol, t + len * .3); g.gain.linearRampToValueAtTime(0, t + len); }
  src.connect(f); f.connect(g); g.connect(pan); pan.connect(dest);
  src.start(t0); src.stop(t0 + pulses * gap + len);
}
const whisper = () => noiseBurst(1100 + Math.random() * 600, 7, .1, 5 + Math.floor(Math.random() * 4), .3, .35);
const scratch = () => noiseBurst(2600, 2, .16, 3 + Math.floor(Math.random() * 3), .12, .2);
// rooms away: a door slamming, or someone else's footsteps passing and fading; low, dull, and mostly echo
const farSlam = () => noiseBurst(160 + Math.random() * 80, .9, .5, 1, .18, 0, Math.random() * 2 - 1, farBus);
const farSteps = () => noiseBurst(220, 1.2, .22, 5 + Math.floor(Math.random() * 6), .08, .48 + Math.random() * .15, Math.random() * 2 - 1, farBus);
// what each level's far-off events sound like; the startle number is how hard a loud one makes you flinch
const EVENTS = {
  whisper, scratch, farSteps,
  farSlam: () => { farSlam(); startle(.5); },
  drip: () => { const n = 1 + Math.floor(Math.random() * 3), s = Math.random() * 2 - 1; for (let k = 0; k < n; k++) setTimeout(() => tone(1500 + Math.random() * 500, 600, .05, .09, bus, s), k * (300 + Math.random() * 500)); },
  knock: () => { noiseBurst(140, 2, .3, 3 + Math.floor(Math.random() * 3), .07, .22, Math.random() * 2 - 1, farBus); startle(.35); },   // pipes knocking
  train: () => noiseBurst(70 + Math.random() * 30, .6, .35, 1, 7, 0, Math.random() * 2 - 1, farBus),                                  // a train passing decks away
  chime: () => { const s = Math.random() * 2 - 1; tone(660, 655, .07, 1.4, farBus, s); setTimeout(() => tone(523, 520, .07, 1.8, farBus, s), 450); },   // a PA chime, nobody speaks after it
  rattle: () => noiseBurst(900 + Math.random() * 400, 5, .07, 6 + Math.floor(Math.random() * 6), .05, .08, Math.random() * 2 - 1, farBus),   // a vent cover shaking
  crack: () => { noiseBurst(3200, .9, .3, 2, .04, .06); noiseBurst(400, 1, .12, 1, .5, 0, 0, farBus); startle(.45); },               // ice splitting somewhere near
  gust: () => noiseBurst(450 + Math.random() * 200, .5, .12, 1, 3.5, 0, Math.random() * 2 - 1, farBus),
};
// a sudden noise: the head flinches, the eyes widen, and a loud enough one sets the heart going for a few beats
let shake = 0, scareBeats = 0, scareBeatT = 0, dipY = 0, dipV = 0;
function startle(k) { shake = Math.max(shake, k); dipV -= .25 * k; if (k >= .45) { scareBeats = 3; scareBeatT = .3; } expo = Math.min(1.5, expo + .12 * k); }
// solid walls crossed on the straight line between two points in Level 0, for muffling sounds behind them
function wallsBetween(x0, z0, x1, z1) {
  const m = (v, M) => ((v % M) + M) % M, steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .5);
  let n = 0, pi = Math.floor(x0 / S), pj = Math.floor(z0 / S);
  for (let k = 1; k <= steps; k++) {
    const i = Math.floor((x0 + (x1 - x0) * k / steps) / S), j = Math.floor((z0 + (z1 - z0) * k / steps) / S);
    if (i !== pi && edgeKind("E", m(Math.min(i, pi), W), m(pj, D)) === 1) n++;
    if (j !== pj && edgeKind("S", m(i, W), m(Math.min(j, pj), D)) === 1) n++;
    pi = i; pj = j;
  }
  return n;
}
function heartbeat() {                       // lub-dub, for the red room
  if (!actx) return;
  [0, .22].forEach((dt, n) => { const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + dt; o.frequency.value = 55 - n * 8; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.45 - n * .15, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + .18); o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + .2); });
}
function soundDrink() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime;
  o.type = "sine"; o.frequency.setValueAtTime(320, t0); o.frequency.exponentialRampToValueAtTime(160, t0 + .28);
  g.gain.setValueAtTime(.25, t0); g.gain.linearRampToValueAtTime(0, t0 + .3);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + .32);
}
function soundClick() {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime;
  o.type = "square"; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(80, t0 + .06);
  g.gain.setValueAtTime(.3, t0); g.gain.linearRampToValueAtTime(0, t0 + .08);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + .09);
}
function soundFlush() {
  if (!actx) return;
  noiseBurst(450, 1.8, .22, 1, .7, 0);
  noiseBurst(220, 2.2, .18, 1, .9, .4);
}

// ---------- the unconfirmed dark figure (person() is in js/assets.js) ----------
const fig = person("#000", 0, 0); fig.visible = false;
let figT = 35 + Math.random() * 40, figSeen = 0;
// other wanderers, standing still: the only place where people can see each other
[["#39455a", 14.6, 19.5], ["#5a4a39", 15.4, 19.4], ["#3b4a3b", 15.6, 20.6]].forEach(([c, i, j]) => person(c, i * S, j * S));

// ---------- game state ----------
let state = "play", redEntry = null, prevT = N, eventT = 15, humLevel = 1, humT = 3, zoneHum = 1, redK = 0, beatT = 0;
let pt = 0, pitT = 100, exitT = 75, exitLife = 0, exitTick = 0;       // pt: seconds spent in Level 0; more of it means more anomalies
const told = new Set();
const TELL = {
  [ARCH]: "拱形房間。這裡似乎比較穩定，有助於辨認方向。", [PIL]: "柱廳。保持方向，左手貼牆。",
  [PIT]: "地面出現網格狀的深坑，黑得看不見底。", [DARK]: "熄燈區。沒有嗡鳴聲，腳下的液體淹過了腳踝……奔向第一縷微光。",
  [MAN]: "狹小房間：你看見了其他流浪者。但他們似乎沒有注意到你。", [STAIR]: "樓梯間。階梯通向上方的平台。",
  [WAIT]: "等候室。椅子排得整整齊齊，像是在等一個不會被叫到的號碼。", [LEDGE]: "地面開始一階一階地起伏，長廊裡橫著高低不一的平台。",
  [ATRIUM]: "挑高中庭。腳下是看不見底的垂直空間，一層層樓板懸在黑暗裡。",
};
function respawn(text, wait) {
  state = "wait"; fadeEl.innerHTML = text; fadeEl.style.opacity = 1; glitch = 1.4;
  setTimeout(() => { if (mode === "station") tsLevel = TS_START; const home = mode === "station" ? TS_HOME : pickSpawn(); P.x = home[0]; P.z = home[1]; if (mode !== "station") P.yaw = Math.random() * Math.PI * 2; P.y = mode === "station" ? tsLevel * TS_FH : 0; dropY = 0; fallV = 0; fadeEl.style.opacity = 0; state = "play"; }, wait);
}
function ending() {
  const ts = exitKind === "ts", r02 = exitKind === "r02", ice = exitKind === "ice", sub05 = exitKind === "sub05";
  state = "wait"; glitch = 1.6;
  fadeEl.innerHTML = ts
    ? "金屬滑門無聲地打開，你走了進去……<br><b>LEVEL 0.1 · 天頂站</b>"
    : r02
    ? "燈管的嗡鳴忽然平息，腳下的地毯變得乾燥……你推開一扇嶄新的白色木門。<br><b>LEVEL 0.2 · 重塑的混亂</b>"
    : ice
    ? "牆上的光變得蒼白，空氣刺骨……你呼出的氣息結成白霧。<br><b>LEVEL 0.3 · 冰室</b>"
    : sub05
    ? "發霉衣物的刺鼻氣味撲面而來，冰冷的水花在腳下濺起……<br><b>LEVEL 0.5 · 淵閉療舍</b>"
    : "你縱身躍入閃爍的牆壁……<br><b>LEVEL 1</b>";
  fadeEl.style.opacity = 1;
  setTimeout(ts ? enterStation : r02 ? enterRemodel : ice ? enterIce : sub05 ? enterInfirmary : enterBase, 3200);
}
window.bk = { P, PITS, cellType, BLOCKS, carve, rebuild, wallE, wallS, edgeKind, floorH, pickSpawn, scene, camera, enterBase, enterStation, enterRemodel, leaveRemodel, enterIce, leaveIce, enterInfirmary, leaveInfirmary, setLevel: l => { tsLevel = l; }, tsS, tsP, tsCollide, tsStand, tsTick, TS_DOOR, spawnExit, spawnPit, get exitEdge() { return exitEdge; } };    // handle for debugging in the console

// ---------- 地圖: a Google-Maps-style 3D overview; drag the pegman onto a cell to drop in there ----------
const MAP_COL = { [N]: 0xf1e7a8, [ARCH]: 0xead3b0, [PIL]: 0xd3e2bd, [PIT]: 0xc9c9c9, [DARK]: 0x9aa3b5, [RED]: 0xe9a3a0, [MAN]: 0xdcc6ec, [STAIR]: 0xb4d3ea, [WAIT]: 0xf0e08a, [LEDGE]: 0xd7e0c3, [ATRIUM]: 0xf4c98f };
const MAP_NAME = { [N]: "大廳", [ARCH]: "拱門房間", [PIL]: "柱廳", [PIT]: "深坑區", [DARK]: "熄燈區", [RED]: "紅室", [WAIT]: "等候室", [LEDGE]: "台階長廊", [ATRIUM]: "挑高中庭" };
const PLACES = BLOCKS.filter(b => b !== blockOf(MAN_X, MAN_Y) && b !== blockOf(ST_I, ST_J)).map(b => [MAP_NAME[b.t], (b.bx + .5) * BW * S, (b.by + .5) * BH * S])
  .concat([["狹小房間", (MAN_X + 1) * S, (MAN_Y + 1) * S], ["樓梯間", STX + 6, STZ + 6]]);
const MAP_WALL = .6;                          // walls are drawn at 60% height so the floor plan stays readable when tilted
const PEG_SVG = '<svg viewBox="0 0 24 32"><circle cx="12" cy="6" r="4.5" fill="#f9ab00"/><path d="M5 30l3-14a4 4 0 0 1 8 0l3 14z" fill="#f9ab00" stroke="#fff" stroke-width="1.2"/></svg>';
const $ = id => document.getElementById(id);
PLACES.push(["憶域通路", .8, 5.5 * S]);
window.bk.memory07 = Memory07;
const mapEl = $("map"), mapScene = new THREE.Scene(), mapWorld = new THREE.Group(), mapCam = new THREE.PerspectiveCamera(45, 1, 1, 1500);
mapScene.background = new THREE.Color(0xe8eaed); mapScene.add(mapWorld);
mapScene.add(new THREE.HemisphereLight(0xffffff, 0xb8bcc8, .8));
const sun = new THREE.DirectionalLight(0xffffff, .5); sun.position.set(-40, 80, 30); mapScene.add(sun);
const mapCtl = new OrbitControls(mapCam, renderer.domElement);
Object.assign(mapCtl, { enabled: false, screenSpacePanning: false, enableDamping: true, minDistance: 10, maxDistance: 220, maxPolarAngle: 1.35 });
mapCtl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
mapCtl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
// "you are here": a blue dot with a heading cone and a pulsing ring
const mapMark = new THREE.Group(), markRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a73e8, transparent: true, opacity: .6 }));
const markMat = new THREE.MeshBasicMaterial({ color: 0x1a73e8 }), markDot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), markMat), markCone = new THREE.Mesh(new THREE.ConeGeometry(.9, 2.6, 16).rotateX(-Math.PI / 2), markMat);
markDot.position.y = 1.2; markCone.position.set(0, 1.2, -1.9); markRing.position.y = .1;
mapMark.add(markRing, markDot, markCone); mapScene.add(mapMark);
const hoverTile = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: .6, depthWrite: false }));
hoverTile.position.y = .12; hoverTile.visible = false; mapScene.add(hoverTile);
function mkLabels(list, w) {                  // place names, white-haloed like map labels
  const grp = new THREE.Group(); mapScene.add(grp);
  for (const [name, x, z] of list) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
    g.font = "bold 34px 'Segoe UI','Noto Sans TC',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 7; g.strokeStyle = "#fff"; g.strokeText(name, 128, 32); g.fillStyle = "#3c4043"; g.fillText(name, 128, 32);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    s.scale.set(w, w / 4, 1); s.position.set(x, 3, z); s.renderOrder = 10; grp.add(s);
  }
  return grp;
}
const l0Labels = mkLabels(PLACES, 16), tsLabels = mkLabels(TS_PLACES, 30), baseLabels = mkLabels(BASE_PLACES, 5), remodelLabels = mkLabels(REMODEL_PLACES, 8), iceLabels = mkLabels(ICE_PLACES, 8), infirmaryLabels = mkLabels(INFIRMARY_PLACES, 8);
const MAP_LISTS = { map: PLACES, station: TS_PLACES, base: BASE_PLACES, remodel: REMODEL_PLACES, ice: ICE_PLACES, infirmary: INFIRMARY_PLACES };
MAP_LISTS.memory = Memory07.places;
const memoryLabels = mkLabels(Memory07.places, 11);
const memoryLevelButton = document.createElement("button");
memoryLevelButton.dataset.m = "memory"; memoryLevelButton.title = "憶域"; memoryLevelButton.textContent = "Level 0.7";
$("mapLevels").insertBefore(memoryLevelButton, $("mapLevels").querySelector('[data-m="base"]'));
$("mapPl").innerHTML = [...new Set(PLACES.map(p => p[0]))].map(n => `<option value="${n}">`).join("");
$("peg").innerHTML = PEG_SVG; $("pegGhost").innerHTML = PEG_SVG;

// the floor plan is rebuilt on every open: districts get re-carved while you play
function buildMap() {
  mapWorld.traverse(o => o.isInstancedMesh && o.dispose());
  mapWorld.clear();
  memoryLabels.visible = mapMode === "memory";
  l0Labels.visible = mapMode === "map"; tsLabels.visible = mapMode === "station"; baseLabels.visible = mapMode === "base"; remodelLabels.visible = mapMode === "remodel"; iceLabels.visible = mapMode === "ice"; infirmaryLabels.visible = mapMode === "infirmary"; decks.style.display = mapMode === "station" ? "flex" : "none";
  if (mapMode === "station") return buildStationMap();
  if (mapMode === "base") return buildBaseMap();
  if (mapMode === "remodel") return buildRemodelMap();
  if (mapMode === "ice") return buildIceMap();
  if (mapMode === "infirmary") return buildInfirmaryMap();
  if (mapMode === "memory") return Memory07.mapBuild();
  const col = new THREE.Color(), floors = new THREE.InstancedMesh(flatGeo, new THREE.MeshLambertMaterial(), W * D), walls = [], pillars = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    const k = j * W + i;
    floors.setMatrixAt(k, _m.compose(_p.set((i + .5) * S, 0, (j + .5) * S), _q.identity(), _s.set(S, 1, S))); floors.setColorAt(k, col.set(MAP_COL[cellType(i, j)]));
    for (const d of ['E', 'S']) {
      const kind = edgeKind(d, i, j); if (!kind) continue;
      const E = d === 'E', X = E ? (i + 1) * S : (j + 1) * S, c = ((E ? j : i) + .5) * S, a0 = c - S / 2 - T / 2, a1 = c + S / 2 + T / 2, hw = kind === 1 ? 0 : kind === 4 ? HWD : HW;
      for (const [p, q] of hw ? [[a0, c - hw], [c + hw, a1]] : [[a0, a1]])
        walls.push(E ? [X, H * MAP_WALL / 2, (p + q) / 2, 0, T, MAP_WALL, q - p] : [(p + q) / 2, H * MAP_WALL / 2, X, Math.PI / 2, T, MAP_WALL, q - p]);
    }
    const pl = pillarAt(i, j); if (pl) pillars.push([pl[0], H * MAP_WALL / 2, pl[1], 0, 1, MAP_WALL, 1]);
  }
  mapWorld.add(floors);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const holes = PITS.concat(pitRects.slice(EX0).filter(r => r.z).map(r => [(r.x + r.z) / 2, (r.y + r.w) / 2])).map(([x, z]) => [x, .05, z, 0, PIT_HALF * 2, 1, PIT_HALF * 2]);
  holes.push([(VOID[0] + VOID[2]) / 2, .05, (VOID[1] + VOID[3]) / 2, 0, VOID[2] - VOID[0], 1, VOID[3] - VOID[1]]);                    // the atrium's opening
  inst(mapWorld, boxGeo, mat(0x8ab4d8), [[(GAL[0] + GAL[2]) / 2, .3, (GAL[1] + GAL[3]) / 2, 0, GAL[2] - GAL[0], .6 / H, GAL[3] - GAL[1]], [(AST[0] + AST[2]) / 2, .15, (AST[1] + AST[3]) / 2, 0, AST[2] - AST[0], .3 / H, AST[3] - AST[1]]]);   // its gallery and stair
  const steps = Array.from({ length: 15 }, (_, k) => [STX + 3 + (k + .5) * .3, (k + 1) * .1, STZ + 10.5, 0, .3, (k + 1) * .2 / H, 3]);
  inst(mapWorld, boxGeo, mat(0xfafafa), walls); inst(mapWorld, boxGeo, mat(0xbfc4cc), pillars); inst(mapWorld, flatGeo, mat(0x202124), holes);
  inst(mapWorld, boxGeo, mat(0x8ab4d8), steps.concat([[STX + 9.75, 1.5, STZ + 6, 0, 4.5, 1, 12]]));
}

let mapOpen = false, mapMode = "map", mapDeck = 0;   // mapMode: which level the map shows; mapDeck: the station deck on view
const decks = $("mapDecks"), syncDecks = () => decks.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.d === mapDeck));
decks.innerHTML = Array.from({ length: TS_N }, (_, k) => TS_N - k).map(n => `<button data-d="${n - 1}" aria-label="第 ${n} 層甲板">${n}</button>`).join("");
decks.onclick = e => { const d = e.target.dataset.d; if (d == null) return; mapDeck = +d; buildMap(); syncDecks(); };
const MAP_VIEW = {                            // how each level's map is framed to fit, and how big its marker and drop tile are
  memory: { x: Memory07.layout.X0 + Memory07.layout.WIDTH / 2, z: Memory07.layout.Z0 + Memory07.layout.DEPTH / 2, up: 330, back: 190, max: 700, min: 10, mark: 1, tile: .8 },
  map: { x: WS / 2, z: DS / 2, up: DS, back: DS * .9, max: 320, min: 10, mark: 1, tile: 1 },
  station: { x: CX, z: CZ, up: 380, back: 360, max: 800, min: 10, mark: 3, tile: .5 },
  base: { x: BX + BRW / 2, z: BZ + BRD / 2, up: 16, back: 14, max: 60, min: 5, mark: .4, tile: .3 },
  remodel: { x: RX + RW / 2, z: RZ + RD / 2, up: 110, back: 95, max: 280, min: 10, mark: .8, tile: .6 },
  ice: { x: IX + IW / 2, z: IZ + ID / 2, up: 105, back: 90, max: 280, min: 10, mark: .8, tile: .6 },
  infirmary: { x: HX + H_W / 2, z: HZ + H_D / 2, up: 95, back: 80, max: 280, min: 10, mark: .8, tile: .6 },
};
const levelBtns = $("mapLevels");
function setMapLevel(m) {
  mapMode = m; const v = MAP_VIEW[m];
  buildMap(); syncDecks(); levelBtns.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("mapPl").innerHTML = [...new Set(MAP_LISTS[m].map(p => p[0]))].map(n => `<option value="${n}">`).join("");
  Object.assign(mapCtl, { maxDistance: v.max, minDistance: v.min }); mapMark.scale.setScalar(v.mark); hoverTile.scale.setScalar(v.tile); $("map3d").textContent = "2D";
  mapCtl.target.set(v.x, 0, v.z); mapCam.position.set(v.x, v.up, v.z + v.back); mapCtl.update();
}
levelBtns.onclick = e => { const m = e.target.dataset.m; if (m && m !== mapMode) setMapLevel(m); };
function toggleMap(on = !mapOpen) {
  if (on === mapOpen) return;
  if (on && state !== "play") return;
  mapOpen = mapCtl.enabled = on; mapEl.style.display = on ? "block" : "none";
  if (on) {
    mapDeck = tsLevel; document.exitPointerLock(); ov.style.display = "none"; setMapLevel(mode);   // opens on the level you are in
  } else if (document.pointerLockElement !== renderer.domElement) ov.style.display = "flex";
}
function flyTo(x, z) { const off = mapCam.position.clone().sub(mapCtl.target); mapCtl.target.set(x, 0, z); mapCam.position.copy(mapCtl.target).add(off); mapCtl.update(); }
function setView(az, polar) {
  const d = mapCam.position.distanceTo(mapCtl.target);
  mapCam.position.set(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(d).add(mapCtl.target); mapCtl.update();
}
const zoomMap = f => { mapCam.position.sub(mapCtl.target).multiplyScalar(f).add(mapCtl.target); mapCtl.update(); };
$("mapX").onclick = () => toggleMap(false);
$("mapMe").onclick = () => { if (mapMode !== mode) { mapDeck = tsLevel; setMapLevel(mode); } flyTo(P.x, P.z); };
$("mapIn").onclick = () => zoomMap(.75); $("mapOut").onclick = () => zoomMap(1.33);
$("mapCompass").onclick = () => setView(0, mapCtl.getPolarAngle());
$("map3d").onclick = () => { const flat = mapCtl.getPolarAngle() > .2; setView(mapCtl.getAzimuthalAngle(), flat ? .001 : .85); $("map3d").textContent = flat ? "3D" : "2D"; };
$("mapQ").addEventListener("keydown", e => { if (e.key !== "Enter") return; const p = MAP_LISTS[mapMode].find(p => p[0].includes(e.target.value.trim())); if (p) flyTo(p[1], p[2]); });
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  if (docOpen) return;
  if (e.code === "KeyM" && !e.repeat) toggleMap(); else if (e.code === "Escape" && mapOpen) toggleMap(false);
});

// the pegman: drag it from the corner onto a cell; the tile under the cursor shows green where you can stand
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gp = new THREE.Vector3(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function cellAt(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, mapCam);
  if (!ray.ray.intersectPlane(groundPlane, gp)) return null;
  if (mapMode !== "map") return { x: gp.x, z: gp.z };               // the station and the base are not grids: you land exactly where you drop
  const i = Math.floor(gp.x / S), j = Math.floor(gp.z / S);
  return inMap(i, j) ? { x: (i + .5) * S, z: (j + .5) * S, i, j } : null;
}
function tsStand(x, z) {                      // on a deck's floor, between the hull and the glass, and clear of every collision box
  const [s, u] = tsS(x, z); let ok = u > .4 && u < 19.8;
  if (ok) tsCands(s, (r, w) => { const p = s - w; if (p > r[0] - P.r && p < r[2] + P.r && u > r[1] - P.r && u < r[3] + P.r) ok = false; });
  return ok;
}
const canStand = c => mapMode === "memory" ? Memory07.stand(c.x, c.z) : mapMode === "station" ? tsStand(c.x, c.z) : mapMode === "base" ? baseStand(c.x, c.z) : mapMode === "remodel" ? remodelStand(c.x, c.z) : mapMode === "ice" ? iceStand(c.x, c.z) : mapMode === "infirmary" ? infirmaryStand(c.x, c.z) : cellType(c.i, c.j) !== STAIR && !pitHit(c.x, c.z);   // Level 0 skips the stairwell: its landing is solid, not ground
const peg = $("peg"), ghost = $("pegGhost");
let pegDrag = false;
function pegMove(e) {
  if (!pegDrag) return;
  ghost.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-100%)`;
  const c = cellAt(e.clientX, e.clientY);
  hoverTile.visible = !!c;
  if (c) { hoverTile.position.set(c.x, .12, c.z); hoverTile.material.color.set(canStand(c) ? 0x34a853 : 0xea4335); }
}
function pegEnd() { pegDrag = false; peg.classList.remove("drag"); ghost.style.display = "none"; hoverTile.visible = false; }
peg.addEventListener("pointerdown", e => { peg.setPointerCapture(e.pointerId); pegDrag = true; peg.classList.add("drag"); ghost.style.display = "block"; pegMove(e); });
peg.addEventListener("pointermove", pegMove);
peg.addEventListener("pointercancel", pegEnd);
peg.addEventListener("pointerup", e => {
  if (!pegDrag) return;
  const c = cellAt(e.clientX, e.clientY); pegEnd();
  if (!c || !canStand(c)) return;
  if (mapMode !== mode) (mapMode === "memory" ? Memory07.enter : mapMode === "station" ? enterStation : mapMode === "base" ? enterBase : mapMode === "remodel" ? enterRemodel : mapMode === "ice" ? enterIce : mapMode === "infirmary" ? enterInfirmary : enterMap)();   // dropping onto another level's map moves you there
  if (mapMode === "station") tsLevel = mapDeck;
  P.x = c.x; P.z = c.z; P.yaw = mapCtl.getAzimuthalAngle(); P.pitch = 0; P.y = floorH(P.x, P.z); dropY = fallV = 0; redEntry = [P.x, P.z]; fig.visible = false;
  if (mode === "memory") Memory07.onTeleport();
  toggleMap(false); startAudio(); renderer.domElement.requestPointerLock()?.catch?.(() => {});
});
function mapFrame() {
  mapCam.aspect = innerWidth / innerHeight; mapCam.updateProjectionMatrix(); mapCtl.update();
  mapMark.visible = mapMode === mode && (mapMode !== "station" || mapDeck === tsLevel);     // you show only on your own level, and on the station only on your own deck
  mapMark.position.set(P.x, 0, P.z); mapMark.rotation.y = P.yaw; markRing.scale.setScalar(1 + .25 * Math.sin(performance.now() / 300));
  $("mapCompass").style.transform = `rotate(${mapCtl.getAzimuthalAngle()}rad)`;
  renderer.toneMapping = THREE.NoToneMapping;   // the map is a flat UI, drawn straight to the screen as authored
  renderer.render(mapScene, mapCam);
}

// ---------- loop ----------
const clock = new THREE.Clock(), hud = document.getElementById("hud");
let bob = 0, lastStep = 0;
let runK = 0, roll = 0, camYaw = P.yaw, camPitch = P.pitch, expo = 1, runNow = false, strafe = 0, dipT = 0, exert = 0, breathPh = 0, vhs = false;
let velX = 0, velZ = 0, bumpT = 0, moveK = 0, lastFloorY = 0, glitch = 0, lastMode = mode;
const _tint = new THREE.Vector3();
let hudShow = 5; hud.style.transition = "opacity 1.5s";
addEventListener("keydown", e => { if (e.code === "Tab" && document.pointerLockElement === renderer.domElement) e.preventDefault(); });   // in play Tab shows the status line; in menus it still moves focus
// the tape counter only runs while recording, and is kept between sessions: it is the same tape every time
let tapeSec = 0; try { tapeSec = +localStorage.getItem("bk-tape") || 0; } catch {}
let tapeSaved = 0;
// C: camcorder look, with a REC stamp in the corner
const recEl = document.createElement("div"); recEl.style.cssText = "position:fixed;top:14px;left:16px;font:15px monospace;color:#fff;text-shadow:0 0 3px #000;z-index:1;pointer-events:none;display:none"; document.body.appendChild(recEl);
addEventListener("keydown", e => { if (e.code === "KeyC" && !e.repeat && !docOpen && !mapOpen && e.target.tagName !== "INPUT") { vhs = !vhs; recEl.style.display = vhs ? "block" : "none"; } });
// dust drifting in the light: a box of points that wraps around the camera, so it is everywhere without being many
const DUST = 260, DB = 10, dustPos = new Float32Array(DUST * 3).map(() => Math.random() * DB);
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ color: 0xfff4c8, size: .018, transparent: true, opacity: .45, depthWrite: false });
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
function dustTick(dt, t) {
  for (let i = 0; i < DUST; i++) {
    const k = i * 3; dustPos[k] += Math.sin(t * .3 + i) * dt * .05; dustPos[k + 1] += (Math.sin(t * .2 + i * 1.7) * .03 - .012) * dt; dustPos[k + 2] += Math.cos(t * .25 + i) * dt * .05;
  }
  // wrap each mote into the box centred on the camera
  const c = camera.position, o = [c.x - DB / 2, c.y - DB / 2, c.z - DB / 2];
  for (let i = 0; i < DUST * 3; i++) dustPos[i] = o[i % 3] + ((((dustPos[i] - o[i % 3]) % DB) + DB) % DB);
  dustGeo.attributes.position.needsUpdate = true;
  dustMat.opacity = .45 * Math.min(1, zoneHum + .15);   // nearly gone where the lights are off
}
renderer.setAnimationLoop(() => {
  Memory07.sync();
  if (mapOpen) return mapFrame();
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  const zt = mode === "memory" ? Memory07.zone() : mode === "base" ? 8 : mode === "station" ? 9 + tsZoneNow() : mode === "remodel" ? REMODEL_ZT : mode === "ice" ? ICE_ZT : mode === "infirmary" ? INFIRMARY_ZT : cellType(Math.floor(P.x / S), Math.floor(P.z / S));
  if (zt !== prevT && mode === "map") {
    if (zt === RED) { redEntry = [P.x, P.z]; say("色調轉紅，地毯變得厚重黏稠，牆紙剝落露出血紅色……應立即轉身離開。", 5500); }
    else if (TELL[zt] && !told.has(zt)) { told.add(zt); say(TELL[zt], 5000); }
  }
  if (zt !== prevT && mode === "station" && TS_TELL[zt]) say(TS_TELL[zt], 4500);
  // eyes adjusting: stepping into a brighter district over-exposes for a moment, a darker one under-exposes
  if (zt !== prevT && AMB[zt] && AMB[prevT]) expo = Math.max(.6, Math.min(1.5, expo + (AMB[zt][2] - AMB[prevT][2]) * .2));
  prevT = zt; runNow = false; strafe = 0;
  const live = document.pointerLockElement === renderer.domElement;   // unlocked = paused: no timers, events or figure
  const anom = Math.min(1, pt / 540);                                 // 0..1: how strange the level has become
  if (live && state === "play") {
    const run = keys.ShiftLeft || keys.ShiftRight, sp = (run ? 5.2 : 2.8) * (zt === RED ? .6 : 1) * (zt === DARK ? .85 : 1) * (mode === "memory" ? Memory07.speed() : 1);
    const fx = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const sx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const len = Math.hypot(fx, sx) || 1, s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    // a body has weight: speed builds up and runs out over a few frames (longer on ice) instead of jumping
    const acc = Math.min(1, dt * (floorNow === FLOORS.ice ? 3.5 : 11));
    velX += ((-s * fx + c * sx) / len * sp - velX) * acc; velZ += ((-c * fx - s * sx) / len * sp - velZ) * acc;
    const vx = velX * dt, vz = velZ * dt, x0 = P.x, z0 = P.z;
    // small steps so fast movement never tunnels through a wall
    const steps = Math.ceil(Math.hypot(vx, vz) / .1) || 1;
    for (let i = 0; i < steps; i++) { P.x += vx / steps; P.z += vz / steps; collide(); }
    // what the walls let through is the real speed; walking straight into one stops you, with a small knock of the head
    const want = Math.hypot(vx, vz), got = Math.hypot(P.x - x0, P.z - z0);
    if (want > 1e-4) { velX *= Math.min(1, got / want + .05); velZ *= Math.min(1, got / want + .05); }
    if (want > 2.4 * dt && got < want * .3 && t - bumpT > .7) { bumpT = t; dipV -= .5; shake = Math.max(shake, .25); noiseBurst(110, 1, .12, 1, .08, 0, 0); }
    moveK = sp > 0 ? Math.min(1.2, got / dt / 2.8) : 0;
    if (mode === "map") {                    // the outer doorways wrap around: leave on one side, arrive on the other
      if (Memory07.gate()) Memory07.enter({ walk: true });
      if (mode === "map") {
        if (P.x < 0) P.x += WS; else if (P.x > WS) P.x -= WS;
        if (P.z < 0) P.z += DS; else if (P.z > DS) P.z -= DS;
      }
    }
    runNow = run && !!(fx || sx) && moveK > .5; strafe = sx;
    const wet = (mode === "map" && P.y < -.1) || (mode === "infirmary" && P.x < H_WATER_X);
    floorNow = wet ? FLOORS.water : FLOORS[ROOMS[roomOf(zt)].floor];
    if (moveK > .15) { bob += dt * (run ? 12 : 8) * floorNow.rate * Math.min(1, moveK); if (Math.sin(bob) < -.95 && t - lastStep > .25) { footstep(floorNow); lastStep = t; } }
    if (mode === "ice") iceInteract.onTick(dt, t);
    if (mode === "infirmary") infirmaryInteract.onTick(dt, t);
    if (mode === "remodel") {
      remodelInteract.onTick(dt, t);
      if (actx && live) {
        remodelCreakT -= dt;
        if (remodelCreakT <= 0) {
          remodelCreakT = 12 + Math.random() * 18;
          noiseBurst(460 + Math.random() * 180, 4, .05, 1, .15, .1);
        }
      }
    }
    if (mode === "map") {
      pt += dt;
      if (zt === RED && redEntry && Math.hypot(P.x - redEntry[0], P.z - redEntry[1]) > 26) {   // 紅室: no way forward, only a loop
        P.x = redEntry[0]; P.z = redEntry[1]; say("……這條路，你似乎走過了。", 3000);
      }
      const ph = pitHit(P.x, P.z);
      if (ph) { state = "fall"; shaft = ph; say("", 0); }
      else if (onExit()) ending();
      shiftWorld(dt, t, anom);
      // anomalies pile up with time: new pits, and the flickering wall, which you have to wait for
      if (pt >= pitT) { spawnPit(); pitT = pt + 90 - 55 * anom; }
      if (!exitEdge) { exitT -= dt; exitTick -= dt; if (exitT <= 0 && exitTick <= 0) { exitTick = .5; if (spawnExit()) { exitLife = 70; if (exitKind !== "ts") say("遠處傳來電流般的嗡嗡聲……", 4500); } } }
      else if ((exitLife -= dt) <= 0) { clearExit(); exitT = 30 + Math.random() * 50; }
    } else if (mode === "station") tsTick(dt);
  } else velX = velZ = moveK = 0;   // paused, falling or between levels: no momentum carried over
  if (mode === "memory") Memory07.tick(dt, t);
  if (state === "fall") fall(dt);
  P.y += (floorH(P.x, P.z) - P.y) * Math.min(1, dt * 14);
  // the red room: tunnel vision, a wavering field of view, a pounding heart
  redK += ((zt === RED ? 1 : 0) - redK) * Math.min(1, dt * 1.5);
  runK += ((runNow ? 1 : 0) - runK) * Math.min(1, dt * 4);
  const fov = 75 - 12 * redK + Math.sin(t * 1.7) * 2.2 * redK + 5 * runK;   // running widens the view a little
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  redv.style.opacity = redK * (.8 + .2 * Math.sin(t * 6));
  // ambient events: whispers, scratching behind walls, hum surging
  if (actx && live) {
    const R = ROOMS[roomOf(zt)]; setRoom(roomOf(zt));
    if (R.ev) { eventT -= dt; if (eventT <= 0) { eventT = (14 + Math.random() * 25) * R.evT * (mode === "map" ? 1 - .55 * anom : 1); EVENTS[R.ev[Math.floor(Math.random() ** 1.4 * R.ev.length)]](); } }   // the first in each list is the commonest
    const rm = R.room; toneGain.gain.value = rm ? rm[2] * (1 + rm[3] * Math.sin(t * .23) * Math.sin(t * .37 + 2)) : 0;
    humT -= dt; if (humT <= 0) { humT = 2 + Math.random() * 6; humLevel = Math.random() < .12 ? 2.8 : .7 + Math.random() * .7; if (humLevel > 2) dipT = .12 + Math.random() * .15; }   // rare ear-splitting surge
    zoneHum += ((mode === "memory" ? (Memory07.eraAt(P.x) === 0 ? .5 : .08) : zt === DARK ? 0 : mode === "base" ? .12 : mode === "ice" ? .2 : mode === "infirmary" ? .1 : (mode === "station" || mode === "remodel") ? 0 : 1) - zoneHum) * Math.min(1, dt * 3);                                // 熄燈區: hum goes silent
    humGain.gain.value = .12 * humLevel * zoneHum;
    if (redK > .3) { beatT -= dt; if (beatT <= 0) { heartbeat(); beatT = .95 - .45 * redK; } }
    else if (scareBeats > 0 && (scareBeatT -= dt) <= 0) { heartbeat(); scareBeats--; scareBeatT = .55; }
    const ex = exitEdge ? exitEdge.x - P.x : 0, ez = exitEdge ? exitEdge.z - P.z : 0, ed = Math.hypot(ex, ez) || 1;
    const walls = exitEdge && mode === "map" ? wallsBetween(P.x, P.z, exitEdge.x, exitEdge.z) : 0;   // behind walls the buzz goes dull and quiet
    exitF.frequency.value = 600 / (1 + 1.5 * walls);
    exitGain.gain.value = exitEdge && exitKind !== "ts" ? Math.max(0, 1 - ed / 36) * .22 / (1 + .4 * walls) : 0;
    exitPan.pan.value = (ex * Math.cos(P.yaw) - ez * Math.sin(P.yaw)) / ed;   // right-hand vector of the camera is (cos, -sin)
  }
  // the figure: vanishes if looked at for a moment or approached
  if (!live || mode === "memory" || mode === "base" || mode === "remodel" || mode === "ice" || mode === "infirmary") { /* paused */ }
  else if (!fig.visible) {
    figT -= dt;
    if (figT <= 0 && state === "play") { const a = P.yaw + (Math.random() - .5) * 2.4; fig.position.set(P.x - Math.sin(a) * 16, .95, P.z - Math.cos(a) * 16); fig.visible = true; figSeen = 0; }
  } else {
    const dx = fig.position.x - P.x, dz = fig.position.z - P.z, d = Math.hypot(dx, dz);
    if ((dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw)) / d > .9) figSeen += dt;
    if (figSeen > 1.2 || d < 7) { fig.visible = false; figT = (40 + Math.random() * 60) * (1 - .6 * anom); }
  }
  // a head, not a tripod: side-to-side sway at half the step rate, a slight lean into strafes, and the view trailing the mouse by a few ms
  // the knees take a step up or a drop: the head dips and springs back (a big jump is a teleport, not a step)
  const fy = P.y - lastFloorY; lastFloorY = P.y; if (Math.abs(fy) > .03 && Math.abs(fy) < .6) dipV -= Math.abs(fy) * 3;
  dipV += (-60 * dipY - 11 * dipV) * dt; dipY += dipV * dt; dipY = Math.max(-.12, Math.min(.06, dipY));
  const tired = .6 + .4 * exert, gb = floorNow.bob * Math.min(1, moveK);   // winded: the head swings more
  const sway = Math.cos(bob * .5) * (.025 + .02 * runK) * tired * gb;
  camera.position.set(P.x + Math.cos(P.yaw) * sway, P.y + 1.65 + dropY + dipY + Math.sin(bob) * (.04 + .02 * runK) * gb, P.z - Math.sin(P.yaw) * sway);
  roll += (-strafe * .025 - sway * .15 - roll) * Math.min(1, dt * 6);
  const lag = Math.min(1, dt * 28);
  const turnX = camYaw, turnY = camPitch;
  if (Math.abs(P.yaw - camYaw) > 1) camYaw = P.yaw; else camYaw += (P.yaw - camYaw) * lag;   // a teleport or respawn snaps instead of swinging
  camPitch += (P.pitch - camPitch) * lag;
  shake = Math.max(0, shake - dt * 1.6); const sh = shake * shake * .03;   // a flinch: a quick jitter that dies out
  camera.rotation.set(camPitch + (Math.random() - .5) * sh, camYaw + (Math.random() - .5) * sh, roll + (Math.random() - .5) * sh * .5, "YXZ");
  dustTick(dt, t);
  // a fast turn smears the frame sideways (yaw) or vertically (pitch), like a shutter that's a bit too slow
  grade.uniforms.uMotion.value.set(THREE.MathUtils.clamp((camYaw - turnX) * .35, -.012, .012), THREE.MathUtils.clamp((turnY - camPitch) * .35, -.012, .012));
  lampPool(P.x, P.z, dt, mode === "map");
  // breathing: you get winded while running and settle slowly; inhale louder than exhale
  exert = Math.max(0, Math.min(1, exert + (runNow ? dt * .12 : -dt * .05)));
  breathPh += dt * (1.4 + 2.5 * exert);
  if (breathGain) { const sn = Math.sin(breathPh); breathGain.gain.value = live ? exert * (.07 * Math.max(0, sn) ** 2 + .035 * Math.max(0, -sn) ** 2) : 0; }
  grade.uniforms.uVHS.value = vhs ? 1 : 0;
  const gr = ROOMS[roomOf(zt)].grade, gk = Math.min(1, dt * 1.5);
  grade.uniforms.uTint.value.lerp(_tint.set(gr[0], gr[1], gr[2]), gk); grade.uniforms.uSat.value += (gr[3] - grade.uniforms.uSat.value) * gk;
  grade.uniforms.uVig.value = .35 + .25 * exert;   // winded: the edges of the view close in
  if (mode !== lastMode) { lastMode = mode; glitch = Math.max(glitch, 1); }   // arriving somewhere new: the tape tears for a moment
  glitch = Math.max(0, glitch - dt * .7); grade.uniforms.uGlitch.value = Math.min(1, glitch) ** 2;
  focusTick(dt);
  if (vhs) {
    if (live) tapeSec += dt;
    if (Math.abs(tapeSec - tapeSaved) > 5) { tapeSaved = tapeSec; try { localStorage.setItem("bk-tape", tapeSec.toFixed(1)); } catch {} }
    const s = Math.floor(tapeSec), p2 = n => String(n).padStart(2, "0"), now = new Date();
    const stamp = `${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][now.getMonth()]}.${p2(now.getDate())} 1996  ${p2(now.getHours())}:${p2(now.getMinutes())}`;   // the camcorder's clock was never set past 1996
    recEl.innerHTML = `${live ? (Math.floor(t * 2) % 2 ? "●" : "○") + " REC" : "❚❚ PAUSE"}  ${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}<br>${stamp}`;
  }
  floor.position.set(Math.round(P.x / FL) * FL, 0, Math.round(P.z / FL) * FL);
  ceil.position.x = Math.round(P.x / S) * S; ceil.position.z = Math.round(P.z / S) * S;
  const fl = .65 + .35 * Math.sin(t * 2.2) * Math.sin(t * 1.3 + 1);   // slow pulse, not a strobe
  exitKind === "ts" ? exitMat.color.setRGB(.42, .48, .54) : exitKind === "r02" ? exitMat.color.setRGB(.96, .92, .88) : exitKind === "ice" ? exitMat.color.setRGB(.74, .9, 1) : exitKind === "sub05" ? exitMat.color.setRGB(.22, .75, .95) : exitMat.color.setScalar(fl * 2.2); exitLight.intensity = exitEdge && exitKind !== "ts" ? 9 * fl : 0;                     // the flickering wall
  updateAmbience(zt, dt, t);
  const hudText = mode === "memory" ? Memory07.hud() : mode === "base" ? "LEVEL 1 · ALPHA 基地 · R 重新開始" : mode === "station" ? `LEVEL 0.1 · 天頂站 · ${tsLevel + 1}F · ${[21, -41, 63, 18][zt - 9]}°C` : mode === "remodel" ? remodelHud() : mode === "ice" ? iceHud() : mode === "infirmary" ? infirmaryHud() : "LEVEL 0";
  // the status line shows when something on it changes (or while Tab is held), then fades: the screen stays the view
  if (hudText !== hud.textContent) { hud.textContent = hudText; hudShow = 5; }
  hudShow -= dt; hud.style.opacity = keys.Tab || hudShow > 0 || !live ? .55 : 0;
  renderer.toneMapping = THREE.NeutralToneMapping;
  expo += (1 - expo) * Math.min(1, dt * .9);
  // the tubes stutter with the hum: a hum surge dips the light in uneven blinks, otherwise a faint unsteady shimmer
  dipT -= dt;   // one short dip per surge, never a strobe
  const flick = dipT > 0 ? .62 : 1 + (Math.random() - .5) * .012 * zoneHum;
  renderer.toneMappingExposure = expo * (zoneHum > .3 ? flick : 1);
  gtao.blendMaterial.uniforms.uFog.value = scene.fog.density;
  grade.uniforms.uTime.value = t; grade.uniforms.uGrain.value = .05 + .05 * anom + .04 * redK; grade.uniforms.uAberr.value = .0015 + .004 * redK;
  composer.render();
  adaptResolution();
});
// dynamic resolution: drop the pixel ratio when frames run long, creep back up when they're quick again.
// Every drop doubles the wait before the next rise, so a machine on the edge settles instead of see-sawing.
let prNow = MAX_PR, frameAvg = 1 / 60, lastFrame = performance.now(), goodFor = 0, badFor = 0, strikes = 0;
function adaptResolution() {
  const now = performance.now(), ft = (now - lastFrame) / 1000; lastFrame = now;
  if (ft > .2 || document.hidden) return;   // a hidden tab, a hitch or the map: no evidence about render cost
  frameAvg += (ft - frameAvg) * .05;
  if (frameAvg > 1 / 45) { badFor += ft; goodFor = 0; } else if (frameAvg < 1 / 57) { goodFor += ft; badFor = 0; } else goodFor = badFor = 0;
  let next = prNow;
  if (badFor > 1 && prNow > .75) { next = Math.max(.75, prNow - .25); strikes++; }
  else if (goodFor > 6 * 2 ** Math.min(strikes, 4) && prNow < MAX_PR) next = Math.min(MAX_PR, prNow + .25);
  if (next !== prNow) { prNow = next; setPR(prNow); goodFor = badFor = 0; frameAvg = 1 / 60; }
}
