"use strict";
// Level 0.7「憶域」. Adapted from T-Dragon's article, translated by
// jiaoyanerlan2 / KkKkK_1234 / owl4513, CC BY-SA 3.0.
// Complete, locally archived text and individual image credits: assets/level0_7/archive/.
// Layout, survival numbers, placement and failure recovery are game adaptations.
const Memory07 = (() => {
  const X0 = 4000, Z0 = 40, C = 6, COLS = 72, ROWS = 10, PER = 12;
  const WIDTH = COLS * C, DEPTH = ROWS * C, GATE_Z = 5.5 * S;
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const entryMark = new THREE.Group(); scene.add(entryMark);
  const eras = [
    { name: "現代區", years: "1950 — 至今", wall: "#c8bd79", floor: "#857253", h: 3.2, fog: 0x91854c, density: .022, ambient: 2.5, light: 0xfff2bf, relic: "印有年份的塑膠識別牌" },
    { name: "早期電氣區", years: "1800 — 1950", wall: "#b5a675", floor: "#66503a", h: 3.8, fog: 0x3a3020, density: .023, ambient: 1.1, light: 0xffc879, relic: "黃銅懷錶" },
    { name: "華麗高廳區", years: "1400 — 1800", wall: "#a69759", floor: "#645038", h: 7, fog: 0x272014, density: .014, ambient: 1.05, light: 0xffce83, relic: "磨損的掛毯織片" },
    { name: "中世紀區", years: "500 — 1400", wall: "#82775b", floor: "#665e4b", h: 4.6, fog: 0x151710, density: .035, ambient: .72, light: 0xffa34e, relic: "鏽蝕劍柄" },
    { name: "羅馬區", years: "前 500 — 500", wall: "#b3ac8f", floor: "#9e967d", h: 9, fog: 0x39372a, density: .009, ambient: 1.45, light: 0xffdfa3, relic: "大理石小雕像" },
    { name: "埃及區", years: "前 4000 — 前 500", wall: "#b08a43", floor: "#8d703b", h: 5.5, fog: 0x32210c, density: .025, ambient: 1.1, light: 0xffb547, relic: "聖甲蟲石雕" },
  ];
  eras.forEach((e, i) => { e.zt = 19 + i; AMB[e.zt] = [e.fog, e.density, e.ambient, e.light]; });
  const east = new Uint8Array(COLS * ROWS), south = new Uint8Array(COLS * ROWS);
  const solids = [], cells = [], actions = [], lamps = [], fires = [], shelters = [], creatures = [];
  const read = new Set(), visited = new Set(), pages = [
    { id: "discovery", name: "M.E.G.｜發現前哨站與 N.T.G. 澄清", era: 0 },
    { id: "records", name: "N.T.G.｜1972／1981 完整層級檔案與 James 的故事", era: 2 },
    { id: "verified", name: "M.E.G.｜Mark L. Corlain 的調查結尾", era: 5 },
    ...eras.map((e, i) => ({ id: "era-" + i, name: "區段檔案｜" + e.name, era: i })),
    { id: "era-6", name: "未證實的前人類時代理論", era: 5 },
  ];
  try { for (const id of JSON.parse(localStorage.getItem("backrooms.memory07.read") || "[]")) if (pages.some(p => p.id === id)) read.add(id); } catch { /* local storage is optional */ }
  let built = false, entryBuilt = false, water = 100, fatigue = 8, health = 100, relic = -1;
  let elapsed = 0, prevEra = -1, warned = 0, lastSound = 0, transition = null, token = 0, saved = null;
  let reader = null, audio = null, actionTip = "", fireLife = 0, originalOverlay = null, lastPage = "discovery";
  const found = new Set(["discovery", ...read]);
  const k = (i, j) => j * COLS + i;
  const eraAt = x => Math.max(0, Math.min(5, Math.floor((x - X0) / (C * PER))));
  const center = (i, j) => [X0 + (i + .5) * C, Z0 + (j + .5) * C];
  const cellOf = (x, z) => [Math.floor((x - X0) / C), Math.floor((z - Z0) / C)];
  const inside = (i, j) => i >= 0 && i < COLS && j >= 0 && j < ROWS;
  const room = (i, j) => { const e = Math.floor(i / PER), u = i % PER; return e === 0 ? u >= 3 && u <= 7 && j >= 3 && j <= 6 : e === 1 ? u >= 4 && u <= 7 && j >= 3 && j <= 6 : e === 2 ? u >= 3 && u <= 8 && j >= 2 && j <= 7 : e === 3 ? u >= 3 && u <= 8 && j >= 4 && j <= 5 : e === 4 ? u >= 2 && u <= 9 && j >= 1 && j <= 8 : u >= 4 && u <= 8 && j >= 3 && j <= 7; };
  const height = (i, j) => room(i, j) ? [3.2, 4.2, 20, 5.2, 96, 9][Math.floor(i / PER)] : eras[Math.floor(i / PER)].h;
  // Six independently carved plans with hand-cleared landmark rooms and three inter-era passages.
  for (let e = 0; e < 6; e++) {
    const rnd = mulberry(707 + e * 91), seen = new Set(), stack = [[e * PER, 5]];
    seen.add(k(...stack[0]));
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[i+1,j],[i-1,j],[i,j+1],[i,j-1]].filter(([a,b]) => a >= e*PER && a < (e+1)*PER && b >= 0 && b < ROWS && !seen.has(k(a,b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a,b] = nb[rnd()*nb.length|0];
      if (a !== i) east[k(Math.min(a,i),j)] = 1; else south[k(i,Math.min(j,b))] = 1;
      seen.add(k(a,b)); stack.push([a,b]);
    }
    for (let j=0;j<ROWS;j++) for (let u=0;u<PER;u++) {
      const i=e*PER+u;
      if (u<PER-1 && (room(i,j)&&room(i+1,j) || rnd()<.15 || j===5)) east[k(i,j)] = 1;
      if (j<ROWS-1 && (room(i,j)&&room(i,j+1) || rnd()<.14)) south[k(i,j)] = 1;
    }
    if (e<5) for (const j of [2,5,7]) east[k((e+1)*PER-1,j)] = 1;
  }
  // These exact rectangles drive meshes, the player, AI sight lines and the map.
  const solid = (a,b,c,d,e,kind="wall",h=3) => solids.push({a,b,c,d,e,kind,h});
  for (let j=0;j<ROWS;j++) for (let i=0;i<COLS;i++) {
    const e=Math.floor(i/PER), x=X0+i*C, z=Z0+j*C, h=height(i,j);
    cells.push({i,j,e,x:x+C/2,z:z+C/2,h});
    if (!east[k(i,j)] || i===COLS-1) solid(x+C-.18,z,x+C+.18,z+C,e,"wall",Math.max(h,i<COLS-1?height(i+1,j):h));
    if (!south[k(i,j)] || j===ROWS-1) solid(x,z+C-.18,x+C,z+C+.18,e,"wall",Math.max(h,j<ROWS-1?height(i,j+1):h));
    if (j===0) solid(x,z-.18,x+C,z+.18,e,"wall",h);
    if (i===0 && j!==5) solid(x-.18,z,x+.18,z+C,e,"wall",h);
  }
  // Thick arch piers in open passages; openings remain > player diameter.
  const arches=[];
  for (let j=0;j<ROWS;j++) for (let i=0;i<COLS-1;i++) {
    const e=Math.floor(i/PER);
    if (e<2 || !east[k(i,j)] || room(i,j)&&room(i+1,j) || hash(i,j,707)>.42) continue;
    const [x,z]=center(i,j), hw=e===3?1.6:2.1;
    arches.push({x:x+C/2,z,e,hw,h:Math.min(height(i,j),height(i+1,j))});
    solid(x+C/2-.22,z-C/2,x+C/2+.22,z-hw,e,"arch",3);
    solid(x+C/2-.22,z+hw,x+C/2+.22,z+C/2,e,"arch",3);
  }
  const romanColumns=[];
  for (const u of [3,6,9]) for (const j of [2,4,7]) {
    const [x,z]=center(4*PER+u,j); romanColumns.push([x,z]); solid(x-.72,z-.72,x+.72,z+.72,4,"column",76);
  }
  const places = eras.map((e,n) => [e.name, ...center(n*PER+5,5)]).concat([["返回 Level 0", ...center(0,5)],["N.T.G. 檔案", ...center(2*PER+4,3)],["巨柱廳", ...center(4*PER+5,5)]]);
  const clear = (x,z,r=.36) => x>X0-.5 && x<X0+WIDTH-.4 && z>Z0+.4 && z<Z0+DEPTH-.4 && !solids.some(b=>x>b.a-r&&x<b.c+r&&z>b.b-r&&z<b.d+r);
  const lineClear = (x,z,tx,tz,r=.12) => { const n=Math.ceil(Math.hypot(tx-x,tz-z)/.32); for(let s=1;s<=n;s++) if(!clear(x+(tx-x)*s/n,z+(tz-z)*s/n,r)) return false; return true; };
  const neighbors = a => { const i=a%COLS,j=a/COLS|0; return [i<COLS-1&&east[a]?a+1:-1,i>0&&east[a-1]?a-1:-1,j<ROWS-1&&south[a]?a+COLS:-1,j>0&&south[a-COLS]?a-COLS:-1].filter(n=>n>=0); };
  const pointInCell = (i,j) => {
    for(const [dx,dz] of [[0,0],[-1.8,0],[1.8,0],[0,1.8],[0,-1.8],[-1.5,-1.5],[1.5,1.5]]) {
      const [x,z]=center(i,j); if(clear(x+dx,z+dz,.7)) return [x+dx,z+dz];
    }
    return null;
  };
  // Deterministic texture paint, not borrowed photographs: relief, stone courses and worn ornament.
  function surface(e, floorSurface=false) {
    const rnd=mulberry(770+e+(floorSurface?100:0));
    const map=canvasTex(512,512,(g,w,h)=>{
      g.fillStyle=floorSurface?eras[e].floor:eras[e].wall; g.fillRect(0,0,w,h);
      for(let n=0;n<11000;n++){ g.fillStyle=`rgba(${rnd()<.5?"0,0,0":"255,248,205"},${rnd()*.14})`;g.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1+rnd()*2); }
      if(e<3&&!floorSurface){
        for(let x=0;x<w;x+=64){g.fillStyle="rgba(60,40,15,.13)";g.fillRect(x,0,3,h);}
        for(let y=20;y<h;y+=64)for(let x=32;x<w;x+=64){
          g.strokeStyle="rgba(77,64,23,.38)";g.lineWidth=e===2?2:1;g.beginPath();g.moveTo(x,y-17);g.bezierCurveTo(x+20,y-8,x+18,y+7,x,y+19);g.bezierCurveTo(x-18,y+7,x-20,y-8,x,y-17);g.stroke();
          if(e>0){g.beginPath();g.ellipse(x,y,6,10,0,0,7);g.stroke();}
        }
      } else if(e===3||e===5||floorSurface&&e>=3){
        const rh=e===5?128:85;
        for(let y=0;y<h;y+=rh)for(let x=-128;x<w;x+=128){const xx=x+(Math.round(y/rh)%2)*64,chip=e===3&&!floorSurface?rnd()*5:0;
          g.fillStyle=`rgba(${rnd()<.5?"25,21,12":"230,212,171"},${rnd()*.12})`;g.fillRect(xx+3,y+3,122,rh-6);
          g.strokeStyle="rgba(24,20,12,.37)";g.lineWidth=3;g.strokeRect(xx+chip,y,128-chip,rh);g.strokeStyle="rgba(242,220,159,.17)";g.lineWidth=1;g.strokeRect(xx+4,y+4,120,rh-8);
        }
      } else if(e===4){
        for(let n=0;n<15;n++){g.strokeStyle="rgba(58,54,43,.13)";g.lineWidth=1+rnd()*3;g.beginPath();let x=rnd()*w;g.moveTo(x,0);for(let y=20;y<=h;y+=20){x+=(rnd()-.5)*40;g.lineTo(x,y);}g.stroke();}
        if(floorSurface){g.strokeStyle="rgba(30,28,19,.38)";g.lineWidth=3;g.strokeRect(0,0,w,h);}
      }
      if(e===5&&!floorSurface){
        for(let y=28;y<h-20;y+=66)for(let x=25;x<w-20;x+=55){
          g.save();g.translate(x,y);g.strokeStyle="#624317";g.lineWidth=2.4;g.lineCap="round";g.beginPath();
          const glyph=(Math.round(x/55)+Math.round(y/66)*3)%8;
          if(glyph===0){g.moveTo(-19,0);g.quadraticCurveTo(0,-20,19,0);g.quadraticCurveTo(0,17,-19,0);g.moveTo(0,-6);g.lineTo(0,7);g.moveTo(-9,8);g.lineTo(-15,17);}
          if(glyph===1){g.ellipse(0,-10,7,9,0,0,7);g.moveTo(0,0);g.lineTo(0,22);g.moveTo(-13,7);g.lineTo(13,7);}
          if(glyph===2){g.moveTo(-14,16);g.lineTo(-7,-2);g.quadraticCurveTo(-11,-17,0,-16);g.lineTo(12,-9);g.lineTo(2,-7);g.lineTo(13,7);g.lineTo(-7,8);g.moveTo(-3,9);g.lineTo(-3,20);g.lineTo(6,20);}
          if(glyph===3){g.ellipse(0,0,10,15,0,0,7);g.moveTo(0,-13);g.lineTo(0,13);for(const side of [-1,1])for(let n=-1;n<=1;n++){g.moveTo(side*9,n*7);g.lineTo(side*18,n*11);}}
          if(glyph===4){for(const dx of [-10,0,10]){g.moveTo(dx,20);g.lineTo(dx,-10);g.quadraticCurveTo(dx-10,-19,dx,-22);g.quadraticCurveTo(dx+10,-19,dx,-10);}}
          if(glyph===5){g.moveTo(-18,17);g.bezierCurveTo(24,19,-21,-10,9,-16);g.lineTo(18,-13);g.lineTo(7,-8);g.moveTo(9,-16);g.lineTo(6,-22);}
          if(glyph===6){g.ellipse(0,-15,5,6,0,0,7);g.moveTo(0,-9);g.lineTo(-2,7);g.lineTo(-14,21);g.moveTo(-2,7);g.lineTo(12,21);g.moveTo(-1,-1);g.lineTo(-16,4);g.moveTo(-1,-1);g.lineTo(13,-10);}
          if(glyph===7){g.ellipse(0,-4,12,12,0,0,7);g.moveTo(-19,14);g.lineTo(19,14);g.moveTo(-19,20);g.lineTo(19,20);}
          g.stroke();g.strokeStyle="rgba(255,221,126,.35)";g.lineWidth=.8;g.translate(.8,1.1);g.stroke();g.restore();
        }
      }
      const shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,"rgba(0,0,0,.2)");shade.addColorStop(.25,"rgba(0,0,0,0)");shade.addColorStop(.8,"rgba(0,0,0,0)");shade.addColorStop(1,"rgba(21,15,4,.25)");g.fillStyle=shade;g.fillRect(0,0,w,h);
    });
    return new THREE.MeshStandardMaterial({map,roughness:e===4?.45:.94,metalness:0,bumpMap:map,bumpScale:e>=3?.075:.012});
  }
  const unit=new THREE.BoxGeometry(1,1,1), plane=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const stoneMat=new THREE.MeshStandardMaterial({color:0xaaa082,roughness:.78});
  const woodMat=new THREE.MeshStandardMaterial({color:0x3e2c19,roughness:.8});
  const brassMat=new THREE.MeshStandardMaterial({color:0x8e7138,metalness:.55,roughness:.5});
  const whiteMat=new THREE.MeshStandardMaterial({color:0xc4b88f,roughness:.9});
  let floorMats=[], wallMats=[], glowMat, glyphMat, lampLights=[], smokeTex, mapMats=null;
  function batch(parent,geo,mat,list) {if(!list.length)return;const m=new THREE.InstancedMesh(geo,mat,list.length),o=new THREE.Object3D();list.forEach(([x,y,z,w,h,d,ry=0],n)=>{o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.set(0,ry,0);o.updateMatrix();m.setMatrixAt(n,o.matrix);});m.computeBoundingSphere();parent.add(m);return m;}
  function mesh(parent,geo,mat,x,y,z,ry=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=ry;parent.add(m);return m;}
  const box=(p,mat,x,y,z,w,h,d,ry=0)=>{const m=mesh(p,unit,mat,x,y,z,ry);m.scale.set(w,h,d);return m;};
  function archGeometry(hw,h){const sh=new THREE.Shape(),sp=2.1;sh.moveTo(-3,0);sh.lineTo(-hw,0);sh.lineTo(-hw,sp);sh.absarc(0,sp,hw,Math.PI,0,true);sh.lineTo(hw,0);sh.lineTo(3,0);sh.lineTo(3,h);sh.lineTo(-3,h);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:.38,bevelEnabled:false,curveSegments:14});g.translate(0,0,-.19);return g;}
  function label(text,w,h){return new THREE.MeshBasicMaterial({map:canvasTex(512,Math.round(512*h/w),(g,cw,ch)=>{g.fillStyle="#d4c79e";g.fillRect(0,0,cw,ch);g.strokeStyle="#81704b";g.lineWidth=8;g.strokeRect(8,8,cw-16,ch-16);g.fillStyle="#40361f";g.textAlign="center";g.textBaseline="middle";g.font=`${Math.round(ch*.29)}px 'Segoe UI',sans-serif`;g.fillText(text,cw/2,ch/2,cw-30);})});}
  function lamp(parent,x,z,e,y,kind="torch"){
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    const flameMat=new THREE.MeshBasicMaterial({color:e===0?0xfff5d8:0xffca76});
    if(kind==="panel")box(g,flameMat,0,0,0,1.6,.05,.65);
    else if(kind==="bulb"){
      box(g,woodMat,0,.35,0,.025,.7,.025);mesh(g,new THREE.SphereGeometry(.11,8,6),flameMat,0,-.04,0);box(g,brassMat,0,.08,0,.09,.14,.09);
    }else{
      box(g,brassMat,0,-.27,0,.12,.6,.12);const flame=mesh(g,new THREE.ConeGeometry(.12,.4,8),flameMat,0,.12,0);flame.rotation.z=.1;
    }
    const pool=mesh(parent,plane,glowMat,x,.023,z);pool.scale.set(5.4,1,5.4);
    lamps.push({x,z,y,e,g,flameMat});return g;
  }
  function chandelier(parent,x,z,y,r=2){
    box(parent,brassMat,x,(y+20)/2,z,.04,20-y,.04);
    const ring=mesh(parent,new THREE.TorusGeometry(r,.055,6,32),brassMat,x,y,z);ring.rotation.x=Math.PI/2;
    for(let a=0;a<8;a++){const ang=a*Math.PI/4,xx=x+Math.cos(ang)*r,zz=z+Math.sin(ang)*r;lamp(parent,xx,zz,2,y+.25,"torch");const bead=mesh(parent,new THREE.OctahedronGeometry(.14),whiteMat,xx,y-.6,zz);bead.scale.y=2;}
  }
  function archiveObject(parent,x,z,e,id,title){
    box(parent,woodMat,x,.68,z,1.4,.1,.7);for(const dx of [-.55,.55])box(parent,woodMat,x+dx,.32,z,.08,.64,.55);
    box(parent,whiteMat,x,.76,z,.48,.045,.34,.15);box(parent,brassMat,x-.24,.79,z,.03,.025,.34);
    const m=mesh(parent,new THREE.PlaneGeometry(.7,.15),label("N.T.G. · ARCHIVE",.7,.15),x,.9,z-.2);m.rotation.x=-.5;
    solid(x-.72,z-.37,x+.72,z+.37,e,"prop",.8);
    actions.push({x,z,e,r:2.2,tip:`E 閱讀｜${title}`,run:()=>openReader(id)});
  }
  function shelterObject(parent,e){
    const [x,z]=pointInCell(e*PER+1,1);shelters.push({x,z,e});
    box(parent,woodMat,x,2.2,z,3.6,.18,3.1);
    for(const dx of [-1.7,1.7])for(const dz of [-1.4,1.4]){box(parent,woodMat,x+dx,1.1,z+dz,.12,2.2,.12);solid(x+dx-.08,z+dz-.08,x+dx+.08,z+dz+.08,e,"prop",2.2);}
    box(parent,new THREE.MeshStandardMaterial({color:0x655d42,roughness:1}),x,.08,z,1.15,.16,2.1);
    const board=mesh(parent,new THREE.PlaneGeometry(1.5,.25),label("遮蔽休息處 · E",1.5,.25),x,1.9,z+1.5);
    actions.push({x,z,e,r:1.8,tip:"E 在遮蔽物下休息｜疲勞下降；水量不會恢復",run:()=>sleep(true)});
  }
  function relicObject(parent,e){
    const [x,z]=pointInCell(e*PER+9,8),g=new THREE.Group();g.position.set(x,.85,z);parent.add(g);
    box(parent,stoneMat,x,.38,z,.9,.76,.9);solid(x-.45,z-.45,x+.45,z+.45,e,"prop",.8);
    if(e===1){const disc=mesh(g,new THREE.CylinderGeometry(.2,.2,.05,16),brassMat,0,0,0);disc.rotation.x=Math.PI/2;}
    else if(e===3){box(g,brassMat,0,.12,0,.06,.5,.06);box(g,brassMat,0,0,0,.35,.055,.06);}
    else if(e===5){const b=mesh(g,new THREE.SphereGeometry(.15,10,6),brassMat,0,0,0);b.scale.set(1,.6,1.4);for(const side of [-1,1])for(let n=0;n<3;n++)box(g,brassMat,side*.18,0,(n-1)*.1,.15,.025,.025);}
    else mesh(g,new THREE.OctahedronGeometry(.18),e===0?whiteMat:stoneMat,0,0,0);
    actions.push({x,z,e,r:1.8,tip:`E 攜帶｜${eras[e].relic}（影響睡眠，不能保證落點）`,run:()=>{relic=e;say(`你帶上了${eras[e].relic}。年代物件會影響夢境，但不保證安全。`,4500);}});
  }
  function makeCreature(kind){
    const g=new THREE.Group(),body=new THREE.Group();g.add(body);
    const skinMap=canvasTex(256,512,(p,w,h)=>{p.fillStyle="#8a8067";p.fillRect(0,0,w,h);const rnd=mulberry(kind.length*93);for(let n=0;n<3500;n++){p.fillStyle=`rgba(${n%2?"29,26,20":"210,191,151"},${rnd()*.22})`;p.fillRect(rnd()*w,rnd()*h,1+rnd()*5,2+rnd()*10);}p.strokeStyle="rgba(31,29,21,.16)";p.lineWidth=1;for(let n=0;n<22;n++){let x=rnd()*w;p.beginPath();p.moveTo(x,0);for(let y=15;y<h;y+=15){x+=(rnd()-.5)*13;p.lineTo(x,y);}p.stroke();}});
    const skin=new THREE.MeshStandardMaterial({color:kind==="hound"?0x777064:kind==="faceling"?0xb5aa90:0x8b7d65,map:skinMap,bumpMap:skinMap,bumpScale:.035,roughness:.92});
    const dark=new THREE.MeshStandardMaterial({color:0x111009,roughness:1});
    const eyes=new THREE.MeshBasicMaterial({color:0xeee3a0});const limbs=[];
    const ball=(x,y,z,w,h,d,mat=skin)=>{const b=mesh(body,new THREE.SphereGeometry(1,10,7),mat,x,y,z);b.scale.set(w,h,d);return b;};
    const limb=(x,y,z,len,angle)=>{const pivot=new THREE.Group();pivot.position.set(x,y,z);pivot.rotation.z=angle;body.add(pivot);const bone=mesh(pivot,new THREE.CylinderGeometry(.065,.042,len*.53,9),skin,0,-len*.265,0);const joint=mesh(pivot,new THREE.SphereGeometry(.065,9,6),skin,0,-len*.53,0);const lower=new THREE.Group();lower.position.y=-len*.53;lower.rotation.x=kind==="faceling"?.24:-.3;pivot.add(lower);mesh(lower,new THREE.CylinderGeometry(.045,.025,len*.47,8),skin,0,-len*.235,0);const hand=mesh(lower,new THREE.SphereGeometry(.06,8,6),skin,0,-len*.48,0);hand.scale.set(kind==="faceling"?.7:1.3,.55,1.35);if(kind==="faceling"&&len>1)for(let f=0;f<4;f++){const finger=mesh(lower,new THREE.CylinderGeometry(.012,.006,.16+f*.012,5),skin,(f-1.5)*.023,-len*.48-.09,.025);finger.rotation.z=(f-1.5)*.1;}limbs.push({pivot,base:angle});return bone;};
    if(kind==="growler"){
      // The photograph does not establish a solid body: leave an indistinct dark
      // presence, with actual slit pupils and differently sized upper/lower teeth.
      const shadow=new THREE.MeshBasicMaterial({color:0x080805,transparent:true,opacity:.08,depthWrite:false});
      ball(0,1.4,.04,.38,.43,.06,shadow);ball(0,1.27,-.1,.25,.16,.05,dark);
      const iris=new THREE.MeshBasicMaterial({color:0xa9b478});
      for(const side of [-1,1]){
        ball(side*.2,1.63,-.16,.065,.037,.017,iris);ball(side*.2,1.63,-.18,.01,.031,.009,dark);
        for(let n=0;n<4;n++){
          const fang=n===3?.21:.07+n*.017,x=side*(.045+n*.047);
          const upper=mesh(body,new THREE.ConeGeometry(n===3?.035:.023,fang,8),whiteMat,x,1.38-fang/2,-.175);upper.rotation.z=Math.PI+side*.16;
          const lower=mesh(body,new THREE.ConeGeometry(.018,.055+n*.012,7),whiteMat,x,1.16+(n*.007),-.18);lower.rotation.z=-side*.12;
        }
      }
    }else if(kind==="hound"){
      ball(0,.75,.12,.32,.3,.68);ball(0,.91,-.6,.27,.28,.23);ball(0,.84,-.79,.2,.13,.08,dark);
      for(const x of [-.26,.26])for(const z of [-.32,.52])limb(x,.7,z,.6,x<0?.12:-.12);
      for(const x of [-.12,.12])ball(x,1,-.81,.045,.035,.025,eyes);
    }else if(kind==="faceling"){
      ball(0,1.1,0,.22,.63,.15);
      const skull=new THREE.SphereGeometry(1,28,18),pos=skull.attributes.position;
      for(let n=0;n<pos.count;n++){const x=pos.getX(n),y=pos.getY(n),z=pos.getZ(n);if(z<-.2){const d=Math.min(Math.hypot(x-.38,y-.26),Math.hypot(x+.38,y-.26));if(d<.3)pos.setZ(n,z+(.3-d)*1.3);}}
      skull.computeVertexNormals();const head=mesh(body,skull,skin,.09,1.9,0);head.scale.set(.19,.28,.17);head.rotation.z=-.08;
      for(const x of [-.074,.074])ball(x+.09,1.972,-.124,.026,.044,.016,dark);
      limb(-.06,.7,0,.8,.2);limb(.16,.7,.05,.8,-.15);limb(-.18,1.12,-.1,1.1,.8);limb(.2,1.82,0,1.2,-.6);
    }else{
      ball(0,.85,0,.29,.42,.45);ball(0,1.28,-.3,.22,.25,.2);
      for(const side of [-1,1])for(const z of [-.2,.32])limb(side*.24,.8,z,.76,side*.5);
      // A folded, human-shaped outer silhouette over an animal posture.
      box(body,skin,0,.78,.1,.63,.35,.7);ball(0,1.24,-.48,.14,.12,.025,dark);
    }
    g.userData={body,limbs};return g;
  }
  function build(){
    if(built)return;built=true;
    glowMat=new THREE.MeshBasicMaterial({map:canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,"rgba(255,198,91,.22)");gr.addColorStop(1,"rgba(255,180,50,0)");g.fillStyle=gr;g.fillRect(0,0,w,h);}),transparent:true,depthWrite:false});
    smokeTex=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,"rgba(120,112,91,.55)");gr.addColorStop(1,"rgba(120,112,91,0)");g.fillStyle=gr;g.fillRect(0,0,w,h);});
    const ceilingM=new THREE.MeshStandardMaterial({color:0x8f8868,roughness:1,side:THREE.DoubleSide});
    for(let e=0;e<6;e++){
      const p=new THREE.Group();p.userData.era=e;group.add(p);
      const wm=surface(e),fm=surface(e,true);wallMats.push(wm);floorMats.push(fm);
      batch(p,plane,fm,cells.filter(c=>c.e===e).map(c=>[c.x,0,c.z,C,1,C]));
      batch(p,plane,ceilingM,cells.filter(c=>c.e===e).map(c=>[c.x,c.h,c.z,C,1,C]));
      batch(p,unit,wm,solids.filter(b=>b.e===e&&b.kind==="wall").map(b=>[(b.a+b.c)/2,b.h/2,(b.b+b.d)/2,b.c-b.a,b.h,b.d-b.b]));
      // Low, dark plinths ground every wall instead of a flat solid-colour maze.
      batch(p,unit,e<3?woodMat:stoneMat,solids.filter(b=>b.e===e&&b.kind==="wall").map(b=>[(b.a+b.c)/2,.15,(b.b+b.d)/2,b.c-b.a+.035,.3,b.d-b.b+.035]));
      for(const a of arches.filter(a=>a.e===e))mesh(p,archGeometry(a.hw,a.h),wm,a.x,0,a.z,Math.PI/2);
      if(e<3){
        batch(p,unit,woodMat,solids.filter(b=>b.e===e&&b.kind==="wall").map(b=>[(b.a+b.c)/2,1.05,(b.b+b.d)/2,b.c-b.a+.04,.06,b.d-b.b+.04]));
      }
      for(const c of cells.filter(c=>c.e===e&&((c.i+c.j*2)%4===0)&&!room(c.i,c.j)))lamp(p,c.x,c.z,e,c.h-.22,e===0?"panel":e===1&&c.i%PER<7?"bulb":"torch");
      const cx=X0+(e*PER+6)*C,cz=Z0+5*C;
      if(e===0||e===1)for(const dz of [-6,6])for(const dx of [-9,3,15])lamp(p,cx+dx,cz+dz,e,e===0?3:3.7,e===0?"panel":"bulb");
      if(e===2){
        // Layered cornices and repeating pilasters give the high hall its own architectural rhythm.
        const ornament=[];
        for(const xx of [cx-18,cx+18])for(const zz of [cz-15,cz-3,cz+9,cz+15]){
          ornament.push([xx,4,zz,.48,8,.85],[xx,8.2,zz,.8,.3,1.15],[xx,.32,zz,.8,.64,1.15]);
        }
        for(const xx of [cx-18,cx+18])for(const yy of [7.7,8.5,18.8])ornament.push([xx,yy,cz,.65,.18,35.8]);
        for(const zz of [cz-18,cz+18])for(const yy of [7.7,8.5,18.8])ornament.push([cx,yy,zz,35.8,.18,.65]);
        batch(p,unit,brassMat,ornament);
        for(const dx of [-10,10])chandelier(p,cx+dx,cz,12);
        for(const x of [cx-17.5,cx+17.5])for(const z of [cz-12,cz,cz+12]){
          box(p,woodMat,x,3,z,.3,6,2.8);box(p,brassMat,x,5.9,z,.4,.12,3);
          const tapestry=new THREE.MeshStandardMaterial({map:canvasTex(256,512,(g,w,h)=>{g.fillStyle="#463b29";g.fillRect(0,0,w,h);for(let q=0;q<5000;q++){g.fillStyle=q%2?"rgba(220,196,126,.09)":"rgba(0,0,0,.12)";g.fillRect((q*23)%w,(q*67)%h,1,3);}g.strokeStyle="#95804c";g.lineWidth=8;g.strokeRect(12,12,w-24,h-24);for(let y=35;y<490;y+=30){g.beginPath();g.moveTo(18,y);g.lineTo(29,y+10);g.lineTo(18,y+20);g.stroke();g.beginPath();g.moveTo(238,y);g.lineTo(227,y+10);g.lineTo(238,y+20);g.stroke();}g.fillStyle="#aa9565";g.beginPath();g.ellipse(117,120,24,35,0,0,7);g.fill();g.beginPath();g.moveTo(108,150);g.lineTo(88,225);g.lineTo(73,328);g.lineTo(155,328);g.lineTo(137,213);g.lineTo(129,150);g.fill();g.strokeStyle="#b7a374";g.lineWidth=12;g.beginPath();g.moveTo(105,321);g.lineTo(82,426);g.moveTo(135,321);g.lineTo(157,426);g.moveTo(104,187);g.lineTo(65,245);g.lineTo(162,268);g.moveTo(132,188);g.lineTo(175,232);g.lineTo(176,277);g.stroke();g.strokeStyle="#d0b66f";g.lineWidth=3;g.beginPath();g.ellipse(178,284,21,31,0,0,7);g.moveTo(178,257);g.lineTo(195,180);g.stroke();for(let a=0;a<4;a++){g.beginPath();g.moveTo(166+a*7,261);g.lineTo(190+a*2,184);g.stroke();}g.fillStyle="#2b281f";g.fillRect(109,112,7,7);g.fillRect(126,112,7,7);}),roughness:1,side:THREE.DoubleSide});
          const m=mesh(p,new THREE.PlaneGeometry(2.3,4.6),tapestry,x+(x<cx?.17:-.17),3,z);m.rotation.y=x<cx?Math.PI/2:-Math.PI/2;
        }
      }
      if(e===3){for(const u of [3,6,9]){const [x,z]=center(e*PER+u,5);mesh(p,archGeometry(2.5,5.2),wm,x,0,z,Math.PI/2);lamp(p,x,z-2.6,e,2.5);}}
      if(e===4){
        const cyl=new THREE.CylinderGeometry(.6,.74,1,32),bands=[],flutes=[];
        for(const [x,z]of romanColumns){mesh(p,cyl,wm,x,38,z).scale.set(1,76,1);for(const y of [.25,1,75.4,76.1])bands.push([x,y,z,1.8,.35,1.8]);}
        batch(p,unit,stoneMat,bands);
        for(const [x,z]of romanColumns){for(let a=0;a<12;a++){const ang=a*Math.PI/6;flutes.push([x+Math.cos(ang)*.66,38,z+Math.sin(ang)*.66,.045,73,.045]);}for(const y of [.48,.75,1.15,74.8,75.15]){const ring=mesh(p,new THREE.CylinderGeometry(.82,.86,.13,24),stoneMat,x,y,z);}}
        batch(p,unit,stoneMat,flutes);
        for(const dz of [-18,18])for(const dx of [-15,3,15])lamp(p,cx+dx,cz+dz,e,5.5);
        // Abstract and distorted statues, raised on proper stone plinths.
        for(const dz of [-15,15]){
          const x=cx-20,z=cz+dz;box(p,stoneMat,x,.5,z,2,1,2);solid(x-1,z-1,x+1,z+1,e,"prop",1);
          const statue=mesh(p,new THREE.TorusKnotGeometry(.7,.22,40,6),stoneMat,x,2.2,z);statue.scale.set(1,1.7,.6);
        }
      }
      if(e===5){for(const u of [4,7]){const [x,z]=center(e*PER+u,4);mesh(p,new THREE.CylinderGeometry(.95,1.05,9,8),wm,x,4.5,z);solid(x-1.05,z-1.05,x+1.05,z+1.05,e,"prop",9);box(p,stoneMat,x,8.6,z,2.4,.45,2.4);lamp(p,x+1.4,z,e,2.5);}}
      shelterObject(p,e);relicObject(p,e);
      const [ax,az]=pointInCell(e*PER+4,3);archiveObject(p,ax,az,e,"era-"+e,eras[e].name+"區段檔案");
      for(const pg of pages.filter(pg=>pg.era===e&&!pg.id.startsWith("era-"))){const [qx,qz]=pointInCell(e*PER+8,6);archiveObject(p,qx,qz,e,pg.id,pg.name);}
      if(e===5){const [qx,qz]=pointInCell(e*PER+10,2);archiveObject(p,qx,qz,e,"era-6","未證實的前人類時代理論");}
      // Visible no-signal barriers occupy solid walls, not usable teleport doors.
      const [bx,bz]=center(e*PER+11,9);
      const barrierMat=new THREE.ShaderMaterial({uniforms:{t:{value:0}},vertexShader:"varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform float t;varying vec2 v;void main(){float n=fract(sin(dot(floor(v*120.)+floor(t*9.),vec2(12.9898,78.233)))*43758.54);vec3 c=.2+.45*cos(vec3(0.,2.,4.)+n*6.+floor(v.y*13.));gl_FragColor=vec4(c*(.65+.2*sin(v.y*500.)),1.);}"});
      mesh(p,new THREE.PlaneGeometry(2.1,2.7),barrierMat,bx,1.35,bz+C/2-.2,Math.PI);p.userData.barrier=barrierMat;
      actions.push({x:bx,z:bz+1.3,e,r:2,tip:"E 調查｜被無訊號般的物質封住的出口",run:()=>say("彩色雜訊不是光。你伸手觸碰，只摸到無法穿越的實體。檔案提過爆破實驗，但你沒有這種裝備。",6000)});
      if(e===1||e===2){
        const [fx,fz]=pointInCell(e*PER+8,8),f={x:fx,z:fz,e,t:0,active:false,puffs:[],g:new THREE.Group()};p.add(f.g);f.g.position.set(fx,0,fz);
        box(f.g,woodMat,0,.4,0,.5,.8,.5);lamp(f.g,0,0,e,1.1);
        solid(fx-.25,fz-.25,fx+.25,fz+.25,e,"prop",.8);
        const flames=[];for(let n=0;n<8;n++){const m=mesh(f.g,new THREE.ConeGeometry(.15,.8,7),new THREE.MeshBasicMaterial({color:n%2?0xffc066:0xd85516}),Math.sin(n)*.5,.6,Math.cos(n)*.5);m.visible=false;flames.push(m);}f.flames=flames;
        for(let n=0;n<10;n++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:0}));f.g.add(s);f.puffs.push(s);}
        fires.push(f);actions.push({x:fx,z:fz,e,r:2,tip:"E 挪動燭台｜警告：附近織物可能起火",run:()=>{if(!f.active){f.active=true;f.t=0;say("燭台傾倒，火舌舔上乾燥的織物。退開，繞過煙霧！",5000);}}});
      }
    }
    for(let n=0;n<4;n++){const l=new THREE.PointLight(0xffcb7a,0,17,1.5);group.add(l);lampLights.push(l);}
    const specs=[["hound",2,9,7],["faceling",3,8,2],["skin",4,10,8],["growler",5,9,4]];
    for(const [kind,e,u,j]of specs){const pt=pointInCell(e*PER+u,j),g=makeCreature(kind);g.position.set(pt[0],0,pt[1]);group.add(g);creatures.push({kind,e,g,home:pt,x:pt[0],z:pt[1],alert:0,active:false,path:[],repath:0,noise:0});}
    // Make archive click handlers once; only known file IDs can ever be loaded.
    createReader();
  }
  function buildEntry(){
    if(entryBuilt)return;entryBuilt=true;
    const mat=new THREE.MeshBasicMaterial({map:canvasTex(256,256,(g,w,h)=>{g.fillStyle="#a79b75";g.fillRect(0,0,w,h);g.fillStyle="#403a27";g.font="26px monospace";["N.T.G.","1972","LEVEL 0.7","←"].forEach((s,n)=>g.fillText(s,25,45+n*47));})});
    const paper=mesh(entryMark,new THREE.PlaneGeometry(.5,.5),mat,.8,.025,GATE_Z);paper.rotation.x=-Math.PI/2;
  }
  function createReader(){
    if(reader)return;reader=document.createElement("div");reader.id="memoryReader";reader.hidden=true;
    reader.innerHTML='<section class="mr-shell" role="dialog" aria-modal="true" aria-label="憶域檔案"><header><div><small>N.T.G. / M.E.G. RECORDS</small><strong>憶域 · 檔案閱讀器</strong></div><button type="button" data-close>返回探索　Esc</button></header><div class="mr-content"><nav aria-label="檔案目錄"></nav><iframe title="完整原文檔案" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"></iframe></div><footer>閱讀時世界暫停 · 原文分頁與摺疊已展開 · 作者、譯者及圖像授權保留於檔案中</footer></section>';
    document.body.appendChild(reader);reader.querySelector('[data-close]').onclick=closeReader;
    const nav=reader.querySelector("nav");
    for(const pg of pages){const b=document.createElement("button");b.type="button";b.dataset.page=pg.id;b.textContent=pg.name;b.onclick=()=>selectPage(pg.id);nav.appendChild(b);}
  }
  function selectPage(id){
    const pg=pages.find(p=>p.id===id);if(!pg||!found.has(id))return;
    lastPage=id;
    read.add(id);try{localStorage.setItem("backrooms.memory07.read",JSON.stringify([...read]));}catch{}
    reader.querySelector("iframe").src="assets/level0_7/archive/"+pg.id+".html";
    for(const b of reader.querySelectorAll("nav button")){b.disabled=!found.has(b.dataset.page);b.classList.toggle("selected",b.dataset.page===id);b.classList.toggle("read",read.has(b.dataset.page));b.setAttribute("aria-current",String(b.dataset.page===id));b.title=b.disabled?"在探索中找到這份檔案後即可閱讀":"";}
  }
  function openReader(id=null){
    build();if(mode!=="memory"||state!=="play")return;
    if(id&&pages.some(p=>p.id===id))found.add(id);
    docOpen=true;reader.hidden=false;for(const code in keys)keys[code]=false;document.exitPointerLock();audio?.ctx.suspend();selectPage(id||lastPage);reader.querySelector('[data-close]').focus();
  }
  function closeReader(){
    if(!reader||reader.hidden)return;reader.hidden=true;docOpen=false;
    if(mode==="memory"&&!mapOpen&&state==="play")renderer.domElement.requestPointerLock()?.catch?.(()=>{});
  }
  function resetTrip(){
    token++;transition=null;water=100;fatigue=8;health=100;relic=-1;elapsed=0;prevEra=-1;warned=0;fireLife=0;visited.clear();
    fires.forEach(f=>{f.active=false;f.t=0;f.flames.forEach(m=>m.visible=false);f.puffs.forEach(m=>m.material.opacity=0);});
    creatures.forEach(c=>{c.x=c.home[0];c.z=c.home[1];c.alert=0;c.path=[];c.repath=0;c.noise=0;});
  }
  function enter(options={}){
    build();const from=mode;
    saved=from==="map"?[Math.max(.65,P.x),P.z,P.yaw]:[.75,GATE_Z,-Math.PI/2];
    resetTrip();mode="memory";group.visible=true;entryMark.visible=false;
    if(originalOverlay===null)originalOverlay=ov.innerHTML;
    ov.innerHTML='<h1>LEVEL 0.7</h1><h2>憶域 · THE REMINISCENCE DISTRICT</h2><p>燈具愈來愈古老，走廊卻仍泛著熟悉的黃色。</p><p>辨認年代，尋找紀錄，為返回留下一點水。</p><p class="tip">點擊繼續 · WASD 移動 · Shift 奔跑 · E 互動<br>J 檔案 · F 露宿 · M 地圖 · Esc 暫停<br>有遮蔽物的休息處更安全；睡眠不會補充水量。</p>';
    baseGroup.visible=tsGroup.visible=remodelGroup.visible=iceGroup.visible=false;
    if(typeof infirmaryGroup!=="undefined")infirmaryGroup.visible=false;
    floor.visible=ceil.visible=false;fig.visible=false;clearExit();tsFar(240);hemi.groundColor.set(0x4e4129);
    const pt=pointInCell(0,5);P.x=X0+.9;P.z=pt[1];P.y=0;P.yaw=options.walk?saved[2]+Math.PI:-Math.PI/2;P.pitch=0;dropY=fallV=0;state="play";fadeEl.style.opacity=0;
    const a=eras[0];scene.fog.color.set(a.fog);scene.fog.density=a.density;scene.background.set(a.fog);hemi.intensity=a.ambient;hemi.color.set(a.light);
    if(!options.walk)say("LEVEL 0.7 · 憶域｜沿走廊深入，或回頭返回 Level 0。E 互動 · J 檔案 · F 露宿",6500);
    updateVisuals(0,0);
  }
  function leave(){
    token++;transition=null;group.visible=false;audio?.ctx.suspend();enterMap();
    const back=saved||[.75,GATE_Z,Math.PI/2];P.x=Math.max(.7,back[0]);P.z=back[1];P.yaw=back[2]+Math.PI;P.pitch=0;P.y=0;dropY=fallV=0;state="play";fadeEl.style.opacity=0;
    say("日光燈的嗡鳴又熟悉了。你回到了 Level 0。",4500);
  }
  function collideMemory(){
    P.x=Math.max(X0-.4,Math.min(X0+WIDTH-.45,P.x));P.z=Math.max(Z0+.45,Math.min(Z0+DEPTH-.45,P.z));
    for(const b of solids)if(Math.abs(P.x-(b.a+b.c)/2)<(b.c-b.a)/2+1&&Math.abs(P.z-(b.b+b.d)/2)<(b.d-b.b)/2+1)pushOut(b.a,b.b,b.c,b.d);
  }
  function beginTransition(kind,duration,target){
    if(state!=="play")return;state="wait";transition={kind,t:0,duration,target,switched:false,token};
    for(const code in keys)keys[code]=false;
    fadeEl.innerHTML=kind==="failure"?"你已經無法繼續前進……<br><span style='font-size:14px'>本趟探查結束，已讀紀錄保留。</span>":"閉上眼後，嗡鳴彷彿來自另一個方向……";fadeEl.style.opacity=1;
  }
  function sleep(covered){
    if(mode!=="memory"||state!=="play"||docOpen||mapOpen)return;
    covered=covered||shelters.some(s=>Math.hypot(P.x-s.x,P.z-s.z)<1.4);
    let target=eraAt(P.x),changed=false;
    const chance=covered?(relic===target?.12:.3):.84;
    if(Math.random()<chance){target=Math.random()<.65&&relic>=0?relic:Math.random()*6|0;changed=true;}
    let pt=[P.x,P.z];
    if(changed){const options=shelters.filter(s=>s.e===target);pt=options.length?[options[0].x,options[0].z]:pointInCell(target*PER+1,1);}
    beginTransition("sleep",3.2,{point:pt,era:target,covered,changed});
  }
  function advanceTransition(dt){
    if(!transition||transition.token!==token)return;const q=transition;q.t+=dt;
    if(q.t>q.duration*.58&&!q.switched){q.switched=true;
      if(q.kind==="failure"){const oldToken=token;resetTrip();q.token=token;transition=q;P.x=X0+1;P.z=center(0,5)[1];P.yaw=-Math.PI/2;P.pitch=0;}
      else{const pt=q.target.point;if(clear(...pt,.4)){P.x=pt[0];P.z=pt[1];}fatigue=Math.max(0,fatigue-55);water=Math.max(0,water-2);creatures.forEach(c=>{c.alert=0;c.path=[];});}
      dropY=fallV=0;P.y=0;fadeEl.style.opacity=0;
    }
    if(q.t>=q.duration){transition=null;state="play";say(q.kind==="failure"?"你回到本趟探查起點。補給已重新準備；檔案閱讀進度仍在。":q.target.changed?"醒來時，周圍已經不是原來的走廊。辨認燈具，尋找通往現代的方向。":"你仍在同一處醒來。疲勞消退了，但水不會因睡眠而增加。",6000);}
  }
  function nearest(){let best=null,dist=Infinity;for(const a of actions){const dx=a.x-P.x,dz=a.z-P.z,d=Math.hypot(dx,dz),f=Math.max(0,(d-.85)/(d||1));if(d<a.r&&d<dist&&lineClear(P.x,P.z,P.x+dx*f,P.z+dz*f,0)){best=a;dist=d;}}return best;}
  function pathTo(c,tx,tz){
    const [si,sj]=cellOf(c.x,c.z),[ti,tj]=cellOf(tx,tz);if(!inside(si,sj)||!inside(ti,tj))return[];
    const start=k(si,sj),end=k(ti,tj),prev=new Int16Array(COLS*ROWS).fill(-1),q=[start];prev[start]=start;
    for(let n=0;n<q.length&&prev[end]<0;n++)for(const next of neighbors(q[n]))if(prev[next]<0){prev[next]=q[n];q.push(next);}
    if(prev[end]<0)return[];const result=[];for(let a=end;a!==start;a=prev[a]){const pt=pointInCell(a%COLS,a/COLS|0);if(pt)result.push(pt);}return result.reverse();
  }
  function moveCreature(c,tx,tz,dt,speed){
    const dx=tx-c.x,dz=tz-c.z,d=Math.hypot(dx,dz);if(d<.15)return;
    const step=Math.min(d,speed*dt),nx=c.x+dx/d*step,nz=c.z+dz/d*step;
    if(clear(nx,c.z,.27))c.x=nx;if(clear(c.x,nz,.27))c.z=nz;
    c.g.rotation.y=Math.atan2(-dx,-dz);
  }
  function entityTick(dt,t,e){
    for(const c of creatures){
      const d=Math.hypot(P.x-c.x,P.z-c.z),territory=Math.hypot(P.x-c.home[0],P.z-c.home[1]);c.active=Math.abs(e-c.e)<=1&&d<62;c.g.visible=c.active;
      if(!c.active)continue;
      const sees=d<(c.kind==="growler"?16:12)&&lineClear(c.x,c.z,P.x,P.z,.05),allowed=territory<(c.kind==="hound"?21:32);
      if(sees&&allowed)c.alert=Math.min(8,c.alert+dt*3);else c.alert=Math.max(0,c.alert-dt);
      const chase=c.alert>.5;
      if(chase){
        c.repath-=dt;if(c.repath<=0){c.path=pathTo(c,P.x,P.z);c.repath=1.1;}
        if(sees)moveCreature(c,P.x,P.z,dt,c.kind==="growler"?3.8:c.kind==="hound"?3.65:2.7);
        else if(c.path.length){const pt=c.path[0];moveCreature(c,...pt,dt,3);if(Math.hypot(c.x-pt[0],c.z-pt[1])<.5)c.path.shift();}
        if((c.noise-=dt)<=0){c.noise=3.4;directionalSound(c.x,c.z,c.kind==="growler"?80:170,.12,.65);}
        if(d<1.15&&sees){health-=dt*23;say("身後的腳步近了！轉過拐角，離開牠的領地。",1300);}
      }else if(Math.hypot(c.x-c.home[0],c.z-c.home[1])>1){
        c.repath-=dt;if(c.repath<=0){c.path=pathTo(c,...c.home);c.repath=2;}
        if(c.path.length){const pt=c.path[0];moveCreature(c,...pt,dt,1.4);if(Math.hypot(c.x-pt[0],c.z-pt[1])<.5)c.path.shift();}
      }
      c.g.position.set(c.x,0,c.z);c.g.userData.body.position.y=Math.sin(t*(chase?11:3))*(c.kind==="growler"?.07:.025);
      c.g.userData.limbs.forEach(({pivot,base},n)=>pivot.rotation.x=Math.sin(t*(chase?11:3)+n%2*Math.PI)*(chase?.45:.08));
    }
  }
  function directionalSound(x,z,freq,volume,duration){
    if(!actx||actx.state!=="running")return;const d=Math.hypot(x-P.x,z-P.z),src=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain(),pan=actx.createStereoPanner();
    src.buffer=noiseBuf;src.loop=true;f.type="bandpass";f.frequency.value=freq;f.Q.value=2;
    pan.pan.value=Math.max(-1,Math.min(1,((x-P.x)*Math.cos(P.yaw)-(z-P.z)*Math.sin(P.yaw))/(d||1)));
    const now=actx.currentTime;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume*Math.max(.08,1-d/38),now+.08);g.gain.exponentialRampToValueAtTime(.001,now+duration);
    src.connect(f);f.connect(g);g.connect(pan);pan.connect(actx.destination);src.start();src.stop(now+duration+.02);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();pan.disconnect();};
  }
  function startAmbience(){
    if(audio||!actx)return;
    const ctx=actx,gain=ctx.createGain(),filter=ctx.createBiquadFilter(),src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;filter.type="bandpass";filter.frequency.value=180;filter.Q.value=2;
    gain.gain.value=0;src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);src.start();audio={ctx,gain,filter};
  }
  function fireTick(dt,t){
    for(const f of fires){
      if(!f.active)continue;f.t+=dt;const strength=Math.min(1,f.t/4)*Math.max(0,Math.min(1,(45-f.t)/8));
      f.flames.forEach((m,n)=>{m.visible=strength>0;m.position.y=.7+Math.sin(t*9+n)*.12;m.scale.set(1,Math.max(.1,strength*(1+.3*Math.sin(t*13+n))),1);});
      f.puffs.forEach((s,n)=>{const a=(t*.25+n/10)%1;s.position.set(Math.sin(n*3)*a*1.8,1+a*3,Math.cos(n*2)*a*1.8);s.scale.setScalar(1+a*3);s.material.opacity=strength*.45*Math.sin(a*Math.PI);});
      const dx=f.x-P.x,dz=f.z-P.z,d=Math.hypot(dx,dz),edge=Math.max(0,(d-.4)/(d||1));
      if(d<2.4&&strength>.1&&lineClear(P.x,P.z,P.x+dx*edge,P.z+dz*edge,0)){health-=dt*9*strength;say("煙嗆進了喉嚨。離開火源，從另一條走廊繞過去。",1500);}
      if(f.t>=45){f.active=false;f.flames.forEach(m=>m.visible=false);f.puffs.forEach(m=>m.material.opacity=0);}
    }
  }
  function updateVisuals(dt,t){
    const e=eraAt(P.x);
    for(const child of group.children)if(Number.isInteger(child.userData.era))child.visible=Math.abs(e-child.userData.era)<=1;
    const near=lamps.filter(l=>l.e===e||Math.abs(l.x-P.x)<12).map(l=>({l,d:Math.hypot(P.x-l.x,P.z-l.z)})).sort((a,b)=>a.d-b.d).slice(0,4);
    lampLights.forEach((light,n)=>{const a=near[n];if(!a){light.intensity=0;return;}const l=a.l;light.position.set(l.x,l.y-.15,l.z);light.color.set(eras[l.e].light);light.distance=l.e===4?32:17;light.intensity=(l.e===0?14:l.e===4?45:21)*(l.e>1?1+.06*Math.sin(t*7+n*2):1);});
    for(const child of group.children)if(child.userData.barrier)child.userData.barrier.uniforms.t.value=t;
    entryMark.visible=mode==="map";
  }
  function tick(dt,t){
    if(mode!=="memory")return;
    if(docOpen||mapOpen||document.pointerLockElement!==renderer.domElement)return;
    if(state==="wait"){advanceTransition(dt);return;}
    if(state!=="play")return;
    elapsed+=dt;const e=eraAt(P.x);visited.add(e);
    if(e!==prevEra){prevEra=e;say(`${eras[e].name} · ${eras[e].years}${e===3?" · 約 15°C":""}｜${["燈管還在響。入口就在身後。","燈泡愈來愈少，燭火開始接替。","頭頂的廳堂向黑暗裡升高。遠處好像有人。","火炬照不到的側室裡，傳來拖行聲。","柱子消失在高處的黑暗裡。腳步的回聲慢了半拍。","嗡鳴變成翅膀振動的聲音。別驚動黑暗裡的東西。"][e]}`,6500);}
    const moving=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.ArrowUp||keys.ArrowDown||keys.ArrowLeft||keys.ArrowRight,run=moving&&(keys.ShiftLeft||keys.ShiftRight);
    water=Math.max(0,water-dt*(run?.095:moving?.055:.028));fatigue=Math.min(100,fatigue+dt*(run?.1:moving?.043:.02));
    if(water<20&&!(warned&1)){warned|=1;say("水瓶已經輕了許多。往燈具更新的方向走，考慮返回 Level 0。",6500);}
    if(fatigue>75&&!(warned&2)){warned|=2;say("你開始不自覺地閉眼。尋找有頂棚的休息處；F 可以露宿，但醒來的位置未必相同。",6500);}
    if(water<=0)health-=dt*.7;
    if(fatigue>=100)sleep(false);
    entityTick(dt,t,e);fireTick(dt,t);
    if(health<=0)beginTransition("failure",3.5,null);
    actionTip=nearest()?.tip||"";if(actionTip&&!fires.some(f=>f.active&&Math.hypot(P.x-f.x,P.z-f.z)<3))say(actionTip,1000);
    if(P.x<X0+.22&&Math.abs(P.z-center(0,5)[1])<C/2-.3){leave();return;}
    if(t-lastSound>12){lastSound=t;const source=creatures.find(c=>c.e===e);if(source)directionalSound(source.x,source.z,e===5?900:220,.08,1.2);}
    startAmbience();if(audio){audio.filter.frequency.value=e===5?1900:120+e*27;audio.gain.gain.setTargetAtTime(e===5?.024:.009,actx.currentTime,.8);}
    updateVisuals(dt,t);
  }
  function sync(){
    const active=mode==="memory";group.visible=active;entryMark.visible=mode==="map";
    if(audio&&(!active||docOpen||mapOpen||document.pointerLockElement!==renderer.domElement))audio.gain.gain.value=0;
    if(!active&&transition){transition=null;token++;}
    if(!active&&originalOverlay!==null){ov.innerHTML=originalOverlay;originalOverlay=null;}
  }
  function mapBuild(){
    build();
    if(!mapMats)mapMats={floor:new THREE.MeshLambertMaterial({color:0xc6b46c}),wall:new THREE.MeshLambertMaterial({color:0xf5edce}),props:new THREE.MeshLambertMaterial({color:0x8b7c5b}),eras:[0xe1ce7a,0xb9a579,0xc3a467,0x7d806b,0xc8c3aa,0xd1a953].map(color=>new THREE.MeshLambertMaterial({color}))};
    const fm=mapMats.floor,wm=mapMats.wall,propM=mapMats.props;
    batch(mapWorld,plane,fm,cells.map(c=>[c.x,0,c.z,C,1,C]));
    batch(mapWorld,unit,wm,solids.filter(b=>b.kind==="wall"||b.kind==="arch").map(b=>[(b.a+b.c)/2,.7,(b.b+b.d)/2,b.c-b.a,1.4,b.d-b.b]));
    batch(mapWorld,unit,propM,solids.filter(b=>b.kind!=="wall"&&b.kind!=="arch").map(b=>[(b.a+b.c)/2,.5,(b.b+b.d)/2,b.c-b.a,1,b.d-b.b]));
    for(let e=0;e<6;e++){
      const m=mapMats.eras[e];
      batch(mapWorld,plane,m,cells.filter(c=>c.e===e).map(c=>[c.x,.02,c.z,C-.12,1,C-.12]));
    }
  }
  function onTeleport(){
    if(mode!=="memory")return;transition=null;token++;state="play";fadeEl.style.opacity=0;creatures.forEach(c=>{c.alert=0;c.path=[];});prevEra=-1;updateVisuals(0,elapsed);
  }
  // Read-only snapshots support deterministic tests without adding controls to the player's UI.
  const inspect=()=>({mode,era:eraAt(P.x),water,fatigue,health,relic,read:[...read],visited:[...visited],transition:transition?.kind||null,position:[P.x,P.z],built,creatures:creatures.map(c=>({kind:c.kind,x:c.x,z:c.z,alert:c.alert})),fireCount:fires.filter(f=>f.active).length});
  buildEntry();
  return {enter,leave,collide:collideMemory,tick,sync,build,mapBuild,stand:clear,places,eraAt,eras,
    zone:()=>eras[eraAt(P.x)].zt,hud:()=>`LEVEL 0.7 · ${eras[eraAt(P.x)].name} · 水 ${Math.ceil(water)}% · 疲勞 ${Math.floor(fatigue)}% · 生命 ${Math.ceil(health)}% · ${relic<0?"未攜帶年代物件":eras[relic].relic} · E 互動 / J 檔案 / F 露宿`,
    key:code=>{if(reader&&!reader.hidden){if(["Escape","KeyE","KeyJ"].includes(code)){closeReader();return true;}return ["KeyW","KeyA","KeyS","KeyD","KeyF","KeyM","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(code);}if(state!=="play"&&["KeyJ","KeyF","KeyE"].includes(code))return true;if(code==="KeyJ"){openReader();return true;}if(code==="KeyF"){sleep(false);return true;}if(code==="KeyE"){nearest()?.run();return true;}return false;},
    openReader,closeReader,onTeleport,inspect,
    speed:()=>fatigue>80?.78:1,gate:()=>P.x<.12&&Math.abs(P.z-GATE_Z)<1.65,
    layout:{X0,Z0,C,COLS,ROWS,PER,WIDTH,DEPTH,east,south,solids,cells,arches,neighbors,pointInCell,clear,center,shelters,actions,pages},
  };
})();
