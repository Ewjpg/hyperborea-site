// Procedural creatures for FEAR's dossier. Every element is geometry; no remote assets.
const TAU = Math.PI * 2;
function palette(k, accent) {
  return {
    skin:k.mat('#24272b',{roughness:.56,metalness:.28}),
    black:k.mat('#080b0f',{roughness:.4,metalness:.32}),
    shell:k.mat('#464b50',{roughness:.35,metalness:.54}),
    bone:k.mat('#bdc1bd',{roughness:.63}),
    thread:k.mat('#6c747b',{roughness:.68,transparent:true,opacity:.43}),
    eye:k.mat(accent,{emissive:accent,emissiveIntensity:.8,roughness:.24})
  };
}
function shapeGeometry(k, points, depth=.075) {
  const s=new k.T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  return new k.T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
}
function cone(k,r,h,x,y,z,m,parent=k.root) {
  const mesh=k.mesh(new k.T.ConeGeometry(r,h,7),m,parent);mesh.position.set(x,y,z);return mesh;
}
function eyes(k,p,m,spread=.19,y=.12,z=.46,r=.055) {
  [-1,1].forEach(side=>k.sphere(r,side*spread,y,z,m,1,.7,.65,p));
}

function spider(k,p,m,size=1) {
  const body=k.group(0,0,0,p);body.scale.setScalar(size);
  k.sphere(.47,0,.08,-.27,m.black,1,1.1,1.22,body);
  k.sphere(.31,0,0,.33,m.skin,1,.8,1,body);
  const legs=[];
  for(const side of[-1,1])for(let i=0;i<4;i++){
    const g=k.group(side*.17,.02,.29-i*.2,body);
    const reach=1.05+Math.sin(i/3*Math.PI)*.35;
    const z=.75-i*.47;
    k.tube([[0,0,0],[side*.55,.36,z*.45],[side*reach,.12,z],[side*(reach+.13),-.46,z*.94]],.036,m.shell,g);
    legs.push({g,base:i*.06,side,i});
  }
  for(const side of[-1,1]){
    k.sphere(.055,side*.12,.14,.59,m.eye,1,1,.8,body);
    k.sphere(.035,side*.23,.11,.52,m.eye,1,1,.8,body);
    k.tube([[side*.1,-.12,.54],[side*.17,-.25,.73],[side*.05,-.31,.71]],.045,m.skin,body);
  }
  return {body,legs};
}
function arachnophobia(k) {
  const m=palette(k,'#ac777d'),web=k.group(0,1.1,-3.8);web.rotation.z=.15;
  const spokes=k.detail==='low'?8:11;
  for(let i=0;i<spokes;i++){
    const a=i/spokes*TAU;k.link([0,0,0],[Math.cos(a)*5,Math.sin(a)*4.5,0],.008,m.thread,web);
  }
  for(let j=1;j<=5;j++){
    const pts=[];for(let i=0;i<=spokes;i++){const a=i/spokes*TAU;pts.push([Math.cos(a)*j*.85,Math.sin(a)*j*.75,Math.sin(a*2)*.06]);}
    k.tube(pts,.009,m.thread,web);
  }
  const actors=[],count=k.detail==='low'?3:5;
  for(let i=0;i<count;i++){
    const x=i===0?.1:(i%2?1:-1)*(1.8+k.rng()*1.5),y=i===0?.2:1.6+k.rng()*1.6,z=i===0?.55:-2-k.rng()*3;
    const anchor=k.group(x,y,z);anchor.rotation.x=.42;
    const a=spider(k,anchor,m,i===0?1.65:.46+k.rng()*.35);
    k.link([x,y+5,z],[x,y,z],.007,m.thread);
    actors.push({...a,anchor,x,y,z,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>actors.forEach((a,j)=>{
    a.anchor.position.y=a.y+Math.sin(t*.51+a.phase)*.3-pulse*.16;
    a.anchor.rotation.z=Math.sin(t*.29+a.phase)*.12;
    a.body.rotation.y=Math.sin(t*.33+a.phase)*.18+p.x*.12;
    a.legs.forEach(l=>{l.g.rotation.y=Math.sin(t*(j?2.5:1.1)+l.i*.7+l.side)*.075;l.g.rotation.x=Math.cos(t*1.3+l.i)*.05;});
  }));
}

function ophidiophobia(k) {
  const m=palette(k,'#b1b486'),snakes=[];
  for(let i=0;i<(k.detail==='low'?3:5);i++){
    const g=k.group((i-1)*1.1,-1.85,-i*1.1);g.rotation.y=(i-1)*.31;
    const points=[];for(let j=0;j<=48;j++){const u=j/48,a=u*TAU*1.75,r=1.4*(1-u)+.2;points.push([Math.cos(a)*r,u*3.3,Math.sin(a)*r]);}
    k.tube(points,.12,m.skin,g);
    const tip=points.at(-1),head=k.group(...tip,g);head.rotation.x=-.2;
    k.sphere(.23,0,.08,.14,m.shell,1.3,.67,1.7,head);eyes(k,head,m.eye,.22,.14,.22,.035);
    k.tube([[0,.01,.43],[0,-.03,.7],[-.09,-.06,.82]],.009,m.eye,head);
    k.link([0,-.03,.7],[.08,-.06,.82],.009,m.eye,head);
    snakes.push({g,head,y:-1.85,phase:i*.9});
  }
  k.onTick((t,dt,p,pulse)=>snakes.forEach((a,i)=>{
    a.g.rotation.y=(i-1)*.31+Math.sin(t*.45+a.phase)*.16;
    a.g.position.y=a.y+Math.sin(t*.7+a.phase)*.13;
    a.head.rotation.y=Math.sin(t*.85+a.phase)*.24+p.x*.2;
    a.head.scale.setScalar(1+pulse*.12);
  }));
}

function beetle(k,m,g,size=1) {
  g.scale.setScalar(size);k.sphere(.38,0,0,0,m.black,1,.62,1.45,g);
  for(const side of[-1,1]){
    k.sphere(.31,side*.17,.12,-.05,m.shell,.7,.47,1.5,g);
    for(let i=0;i<3;i++)k.tube([[side*.2,-.05,.4-i*.36],[side*.64,-.08,.55-i*.46],[side*.86,-.29,.64-i*.53]],.026,m.skin,g);
    k.tube([[side*.13,.1,.48],[side*.3,.26,.78],[side*.41,.23,.86]],.018,m.shell,g);
  }
  k.sphere(.2,0,.04,.49,m.skin,1,.7,1,g);eyes(k,g,m.eye,.13,.12,.64,.035);
}
function entomophobia(k) {
  const m=palette(k,'#8aafa1'),actors=[];
  const n=k.detail==='low'?6:10;
  for(let i=0;i<n;i++){
    const g=k.group((k.rng()-.5)*7,(k.rng()-.5)*4,-k.rng()*6+.5),y=g.position.y,x=g.position.x,z=g.position.z;
    beetle(k,m,g,i===0?1.8:.45+k.rng()*.6);g.rotation.x=.4;g.rotation.y=k.rng()*TAU;
    actors.push({g,x,y,z,phase:k.rng()*TAU});
  }
  for(let i=0;i<8;i++){
    const b=k.box(.17,5.5,.18,-4.2+i*1.2,.2,-6.7,m.black);b.rotation.z=.25;
  }
  k.onTick((t,dt,p,pulse)=>actors.forEach((a,i)=>{
    a.g.position.x=a.x+Math.sin(t*.45+a.phase)*.5;
    a.g.position.y=a.y+Math.sin(t*.65+a.phase)*.25;
    a.g.position.z=a.z+Math.cos(t*.45+a.phase)*.25;
    a.g.rotation.y=a.phase+Math.sin(t*.6+a.phase)*.7;
    a.g.rotation.z=Math.sin(t*7+a.phase)*.035+pulse*.1;
  }));
}

function apiphobia(k) {
  const m=palette(k,'#c0ad73'),honey=k.group(0,.2,-3.5);
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
    const cell=k.mesh(new k.T.CylinderGeometry(.55,.55,.55,6,1,true),m.shell,honey);
    cell.rotation.x=Math.PI/2;cell.position.set((col-2)*1.02+(row%2)*.5,(row-1.5)*.9,-k.rng()*.45);
  }
  const actors=[];
  for(let i=0;i<(k.detail==='low'?5:9);i++){
    const g=k.group(),s=.7+k.rng()*.55;g.scale.setScalar(s);
    k.sphere(.25,0,0,0,m.shell,.7,.8,1.45,g);k.sphere(.18,0,.03,.4,m.skin,1,.8,1,g);
    for(let j=0;j<3;j++){const band=k.ring(.2-j*.025,.035,0,0,-.1-j*.1,m.black,g);band.scale.y=.85;}
    cone(k,.07,.55,0,0,-.55,m.bone,g).rotation.x=-Math.PI/2;
    const wings=[];for(const side of[-1,1]){const w=k.sphere(.33,side*.35,.16,-.03,m.thread,1.35,.04,.7,g);wings.push(w);}
    eyes(k,g,m.eye,.1,.1,.54,.035);actors.push({g,wings,phase:k.rng()*TAU,z:-k.rng()*4});
  }
  k.onTick((t,dt,p,pulse)=>actors.forEach((a,i)=>{
    const a0=a.phase+t*.35;a.g.position.set(Math.cos(a0)*(1.2+i*.24),Math.sin(a0*1.7)*1.5,a.z+Math.sin(a0)*1.3);
    a.g.rotation.y=-a0;a.g.rotation.z=Math.sin(t*2+a.phase)*.22;
    a.wings.forEach((w,j)=>w.rotation.z=(j?1:-1)*(.25+Math.sin(t*39+i)*.8));
  }));
}

function mothWing(k) {
  return shapeGeometry(k,[[.05,.2],[.4,.92],[1.08,1.08],[1.42,.62],[1.1,.05],[.77,-.55],[.36,-.71],[.08,-.26]],.045);
}
function mottephobia(k) {
  const m=palette(k,'#b9b0a1'),wingGeo=mothWing(k),actors=[];
  for(let i=0;i<(k.detail==='low'?7:12);i++){
    const g=k.group(),size=i===0?1.35:.25+k.rng()*.4;g.scale.setScalar(size);
    k.sphere(.21,0,0,0,m.skin,.55,2.1,.7,g);eyes(k,g,m.eye,.07,.31,.12,.025);
    const wings=[];
    for(const side of[-1,1]){
      const w=k.mesh(wingGeo,i===0?m.shell:m.black,g);w.scale.x=side;wings.push(w);
      k.tube([[side*.07,.32,0],[side*.21,.65,0],[side*.4,.72,0]],.016,m.bone,g);
      k.sphere(.14,side*.76,.44,.09,m.black,1,1,.2,g);
      k.sphere(.04,side*.76,.44,.13,m.eye,1,1,.3,g);
    }
    actors.push({g,wings,i,x:(k.rng()-.5)*7,y:(k.rng()-.5)*4,z:i===0?.2:-1-k.rng()*6,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>actors.forEach(a=>{
    a.g.position.set(a.i===0?Math.sin(t*.3)*.3:a.x+Math.sin(t*.5+a.phase)*.7,a.i===0?.7+Math.sin(t*.7)*.2:a.y+Math.cos(t*.7+a.phase)*.5,a.z);
    a.g.rotation.z=Math.sin(t*.5+a.phase)*.18;
    a.wings.forEach((w,j)=>w.rotation.y=(j?1:-1)*Math.sin(t*(a.i===0?4:7)+a.phase)*(.7+pulse*.25));
  }));
}

function scoleciphobia(k) {
  const m=palette(k,'#b69b93'),worms=[];
  const soil=k.box(9,.35,6,0,-2.1,-2,m.black);soil.rotation.x=.08;
  for(let i=0;i<(k.detail==='low'?9:15);i++){
    const x=(k.rng()-.5)*7,z=-k.rng()*5+.5,g=k.group(x,-1.8,z),h=.9+k.rng()*2.5,phase=k.rng()*TAU;
    const points=[];for(let j=0;j<18;j++){const u=j/17;points.push([Math.sin(u*4+phase)*.35*u,u*h,Math.cos(u*5+phase)*.45*u]);}
    k.tube(points,.12+i%3*.025,i%2?m.skin:m.shell,g);
    k.ring(.25,.045,x,-1.85,z,m.shell).rotation.x=Math.PI/2;
    const tip=points.at(-1);k.sphere(.15,...tip,m.skin,1,1.12,1,g);
    worms.push({g,x,z,h,phase});
  }
  k.onTick((t,dt,p,pulse)=>worms.forEach((a,i)=>{
    a.g.rotation.z=Math.sin(t*.72+a.phase)*.18;
    a.g.rotation.x=Math.cos(t*.58+a.phase)*.17;
    a.g.scale.y=.86+Math.sin(t*.8+a.phase)*.14+pulse*.08;
  }));
}

function ant(k,m,g,size) {
  g.scale.setScalar(size);
  k.sphere(.24,0,0,-.37,m.black,.8,1,1.5,g);k.sphere(.14,0,.01,0,m.skin,1,1,1.25,g);k.sphere(.2,0,.01,.34,m.shell,1,.85,1,g);
  for(const side of[-1,1]){
    for(let j=0;j<3;j++)k.tube([[0,0,.16-j*.13],[side*.36,-.03,.37-j*.32],[side*.57,-.23,.48-j*.43]],.017,m.skin,g);
    k.tube([[side*.08,.05,.47],[side*.16,.3,.63],[side*.31,.31,.76]],.015,m.shell,g);
  }
  eyes(k,g,m.eye,.12,.09,.47,.025);
}
function myrmecophobia(k) {
  const m=palette(k,'#b3a4a0'),ants=[];
  const path=k.ring(2.65,.13,0,-.7,-1.8,m.shell);path.rotation.x=Math.PI/2;
  for(let i=0;i<(k.detail==='low'?7:12);i++){
    const g=k.group();ant(k,m,g,i===0?1.9:.52+k.rng()*.35);
    ants.push({g,phase:i/12*TAU,r:i===0?1:2.4+k.rng()*.6,z:-1.6-k.rng()*2,hero:i===0});
  }
  k.onTick((t,dt,p,pulse)=>ants.forEach((a,i)=>{
    if(a.hero){a.g.position.set(Math.sin(t*.25)*.25,-.3,.8);a.g.rotation.y=Math.sin(t*.4)*.24;return;}
    const q=a.phase+t*.16;a.g.position.set(Math.cos(q)*a.r,Math.sin(q)*1.4-.2,a.z+Math.sin(q)*1.3);
    a.g.rotation.set(.3,-q-Math.PI/2,Math.sin(t*13+i)*.025);
  }));
}

function musophobia(k) {
  const m=palette(k,'#b2949c'),rats=[];
  for(let i=0;i<(k.detail==='low'?4:7);i++){
    const g=k.group((k.rng()-.5)*6,-1.1,-k.rng()*5);g.scale.setScalar(i===0?1.65:.65+k.rng()*.5);
    k.sphere(.5,0,.05,-.1,m.skin,.85,.7,1.5,g);
    k.sphere(.3,0,.16,.57,m.shell,.9,.9,1.4,g);
    k.sphere(.12,0,.12,.91,m.black,1,.8,1,g);eyes(k,g,m.eye,.21,.29,.75,.04);
    for(const side of[-1,1]){
      k.sphere(.17,side*.24,.42,.4,m.skin,1,1.3,.3,g);
      for(let j=0;j<2;j++)k.link([side*.09,.1,.87],[side*(.6+j*.12),.08+j*.1,.74-j*.15],.006,m.bone,g);
    }
    k.tube([[0,-.08,-.7],[.3,-.27,-1.1],[.8,-.32,-1.4],[1.1,-.27,-1.13]],.045,m.shell,g);
    rats.push({g,x:g.position.x,y:g.position.y,z:g.position.z,phase:k.rng()*TAU});
  }
  for(let i=0;i<9;i++)k.cylinder(.13,.13,6,(i-4)*.9,.2,-5.4,m.black);
  k.onTick((t,dt,p,pulse)=>rats.forEach((a,i)=>{
    a.g.position.x=a.x+Math.sin(t*.35+a.phase)*.4;a.g.position.z=a.z+Math.cos(t*.35+a.phase)*.35;
    a.g.position.y=a.y+Math.sin(t*3+a.phase)*.03;a.g.rotation.y=Math.sin(t*.5+a.phase)*.35;
    if(i===0)a.g.rotation.y+=p.x*.2;
  }));
}

function canine(k,m,g) {
  k.sphere(.85,0,.15,-.3,m.black,1,1.1,.75,g);
  k.sphere(.55,0,-.15,.44,m.skin,1,.75,1.3,g);
  for(const side of[-1,1]){
    const e=cone(k,.33,.9,side*.58,.95,-.16,m.skin,g);e.rotation.z=side*-.24;
    const brow=k.box(.52,.12,.18,side*.38,.38,.44,m.shell,g);brow.rotation.z=side*.19;
    k.sphere(.07,side*.37,.31,.55,m.eye,1.4,.45,.65,g);
  }
  k.sphere(.27,0,.02,.92,m.black,1.1,.63,.6,g);
  const jaw=k.group(0,-.47,.25,g);k.sphere(.46,0,0,.25,m.skin,1,.45,1.3,jaw);
  for(const side of[-1,1])for(let j=0;j<4;j++){
    cone(k,.055,j===0?.4:.21,side*(.25+j*.025),-.08,.59-j*.2,m.bone,g).rotation.x=Math.PI;
    cone(k,.045,.2,side*(.26+j*.02),.04,.6-j*.2,m.bone,jaw);
  }
  return jaw;
}
function cynophobia(k) {
  const m=palette(k,'#be8882'),actors=[];
  for(let i=0;i<3;i++){
    const g=k.group((i-1)*2.4,i===1?.35:-.1,i===1?.4:-2.9);g.scale.setScalar(i===1?1.2:.8);
    const jaw=canine(k,m,g);actors.push({g,jaw,phase:i*1.6,y:g.position.y});
  }
  k.onTick((t,dt,p,pulse)=>actors.forEach((a,i)=>{
    a.g.position.y=a.y+Math.sin(t*.8+a.phase)*.055;
    a.g.rotation.y=Math.sin(t*.32+a.phase)*.12+p.x*.15;
    a.jaw.rotation.x=.12+Math.sin(t*1.1+a.phase)*.08+pulse*.16;
  }));
}

function birdWing(k) {
  return shapeGeometry(k,[[0,0],[.5,.46],[1.3,.75],[1.77,.61],[1.27,.22],[1.52,.18],[.93,-.14],[1.02,-.24],[.47,-.36]],.065);
}
function ornithophobia(k) {
  const m=palette(k,'#b3b9c2'),geo=birdWing(k),birds=[];
  for(let i=0;i<(k.detail==='low'?8:15);i++){
    const g=k.group(),size=i===0?1.1:.22+k.rng()*.45;g.scale.setScalar(size);
    k.sphere(.28,0,0,.02,m.black,.85,.65,1.6,g);k.sphere(.2,0,.17,.37,m.skin,1,.9,1,g);
    const beak=cone(k,.12,.5,0,.12,.67,m.shell,g);beak.rotation.x=Math.PI/2;
    const wings=[];for(const side of[-1,1]){const w=k.mesh(geo,m.skin,g);w.scale.x=side;wings.push(w);}
    eyes(k,g,m.eye,.16,.22,.47,.025);
    birds.push({g,wings,phase:k.rng()*TAU,x:(k.rng()-.5)*7,y:(k.rng()-.5)*3.8,z:i===0?.2:-2-k.rng()*5,hero:i===0});
  }
  k.onTick((t,dt,p,pulse)=>birds.forEach((a,i)=>{
    a.g.position.set(a.hero?Math.sin(t*.28)*.25:a.x+Math.sin(t*.35+a.phase)*.8,a.hero?.65+Math.sin(t*.8)*.1:a.y+Math.cos(t*.7+a.phase)*.25,a.z);
    a.g.rotation.y=Math.sin(t*.4+a.phase)*.24;
    a.wings.forEach((w,j)=>w.rotation.z=(j?1:-1)*(.1+Math.sin(t*(a.hero?2:4)+a.phase)*.45));
  }));
}

function batWing(k) {
  return shapeGeometry(k,[[0,.17],[.44,.72],[1.37,1.02],[1.86,.64],[1.43,.4],[1.44,-.05],[.99,.16],[.88,-.4],[.48,-.18],[.2,-.59],[0,-.15]],.05);
}
function chiropterophobia(k) {
  const m=palette(k,'#aaa1b6'),geo=batWing(k),bats=[];
  for(let i=0;i<(k.detail==='low'?7:12);i++){
    const g=k.group(),scale=i===0?1.2:.24+k.rng()*.35;g.scale.setScalar(scale);
    k.sphere(.23,0,0,0,m.black,.7,1.5,.75,g);
    for(const side of[-1,1]){cone(k,.09,.36,side*.13,.37,0,m.skin,g).rotation.z=side*-.2;}
    eyes(k,g,m.eye,.11,.2,.15,.03);
    const wings=[];for(const side of[-1,1]){const w=k.mesh(geo,m.skin,g);w.scale.x=side;wings.push(w);}
    bats.push({g,wings,phase:k.rng()*TAU,x:(k.rng()-.5)*7,y:(k.rng()-.5)*3.6,z:i===0?-.1:-2-k.rng()*5,hero:i===0});
  }
  const arch=k.ring(3.3,.34,0,.9,-5,m.black);arch.scale.y=1.4;
  k.onTick((t,dt,p,pulse)=>bats.forEach((a,i)=>{
    a.g.position.set(a.hero?Math.sin(t*.4)*.3:a.x+Math.sin(t*.7+a.phase)*.65,a.hero?.6+Math.sin(t*.9)*.18:a.y+Math.cos(t*.6+a.phase)*.65,a.z);
    a.g.rotation.z=Math.sin(t*.7+a.phase)*.16;
    a.wings.forEach((w,j)=>{w.rotation.y=(j?1:-1)*(Math.sin(t*(a.hero?3:5)+a.phase)*.7);w.rotation.z=(j?1:-1)*Math.cos(t*3+a.phase)*.1;});
  }));
}

function selachophobia(k) {
  const m=palette(k,'#8eaebd'),jaw=k.group(0,.3,-.2),lower=k.group(0,-.25,0,jaw);
  const top=k.ring(1.7,.19,0,0,-.1,m.skin,jaw);top.scale.y=.78;
  const bottom=k.ring(1.38,.17,0,-.37,.02,m.shell,lower);bottom.scale.y=.6;
  const n=k.detail==='low'?18:28;
  for(let i=0;i<n;i++){
    const a=i/n*TAU,x=Math.cos(a)*1.51,y=Math.sin(a)*1.12;
    const tooth=cone(k,.13,.62,x,y,.04,m.bone,i<n/2?jaw:lower);
    tooth.rotation.z=a+Math.PI/2;tooth.rotation.x=.18;
  }
  k.sphere(1.9,0,.27,-1.7,m.black,1.1,.8,1.8);eyes(k,k.root,m.eye,1.6,.7,-.5,.08);
  const finGeo=shapeGeometry(k,[[0,0],[.15,1.4],[.55,1.8],[.5,.7],[1.16,0]],.18),fins=[];
  for(let i=0;i<5;i++){
    const g=k.group(-3+i*1.6,-1.8,-3.5-i*.55),fin=k.mesh(finGeo,m.skin,g);fin.rotation.y=.2+i*.4;
    const wake=k.ring(.8,.015,0,-.02,0,m.thread,g);wake.rotation.x=Math.PI/2;wake.scale.x=1.8;fins.push({g,x:g.position.x,z:g.position.z,phase:i});
  }
  k.onTick((t,dt,p,pulse)=>{
    jaw.rotation.y=Math.sin(t*.27)*.12+p.x*.13;lower.position.y=-.25-Math.sin(t*.55)*.07-pulse*.16;
    fins.forEach(a=>{a.g.position.x=a.x+Math.sin(t*.3+a.phase)*.6;a.g.position.z=a.z+Math.cos(t*.3+a.phase)*.4;});
  });
}

export const organicFears = [
  {id:'arachnophobia',title:'Арахнофобия',subtitle:'Пауки · нити над головой',accent:'#ac777d',build:arachnophobia},
  {id:'ophidiophobia',title:'Офидиофобия',subtitle:'Змеи · шевелящиеся кольца',accent:'#b1b486',build:ophidiophobia},
  {id:'entomophobia',title:'Энтомофобия',subtitle:'Насекомые · движение под панцирем',accent:'#8aafa1',build:entomophobia},
  {id:'apiphobia',title:'Апифобия',subtitle:'Осы · пустые соты',accent:'#c0ad73',build:apiphobia},
  {id:'mottephobia',title:'Моттефобия',subtitle:'Мотыльки · шелест крыльев',accent:'#b9b0a1',build:mottephobia},
  {id:'scoleciphobia',title:'Сколецифобия',subtitle:'Черви · живая земля',accent:'#b69b93',build:scoleciphobia},
  {id:'myrmecophobia',title:'Мирмекофобия',subtitle:'Муравьи · бесконечная колонна',accent:'#b3a4a0',build:myrmecophobia},
  {id:'musophobia',title:'Мусофобия',subtitle:'Крысы · за решёткой',accent:'#b2949c',build:musophobia},
  {id:'cynophobia',title:'Кинофобия',subtitle:'Собаки · пасть в темноте',accent:'#be8882',build:cynophobia},
  {id:'ornithophobia',title:'Орнитофобия',subtitle:'Птицы · надвигающаяся стая',accent:'#b3b9c2',build:ornithophobia},
  {id:'chiropterophobia',title:'Хироптерофобия',subtitle:'Летучие мыши · под сводом',accent:'#aaa1b6',build:chiropterophobia},
  {id:'selachophobia',title:'Селахофобия',subtitle:'Акулы · челюсти под водой',accent:'#8eaebd',build:selachophobia}
];
