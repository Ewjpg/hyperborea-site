// Twelve self-contained fear tableaux. Rendering, lights and resource ownership belong to the host.
const TAU=Math.PI*2;
const count=(k,normal,low)=>k.detail==='low'?low:normal;
const mix=(a,b,t)=>a+(b-a)*t;
function base(k,width=7,depth=6){
 const m=k.mat('#121316',{roughness:.92});
 return k.box(width,.16,depth,0,-2.45,-.8,m);
}
function mannequin(k,x,y,z,scale=1,material){
 const g=k.group(x,y,z),m=material||k.mat('#31343a',{roughness:.73});
 k.sphere(.31,0,1.15,0,m,.8,1.14,.85,g);
 k.sphere(.52,0,.35,0,m,.6,1.3,.4,g);
 k.link([-.16,-.23,0],[-.29,-1.1,.08],.095,m,g);
 k.link([.16,-.23,0],[.31,-1.1,.08],.095,m,g);
 k.link([-.26,.75,0],[-.62,.1,.02],.075,m,g);
 k.link([-.62,.1,.02],[-.46,-.55,.12],.062,m,g);
 k.link([.26,.75,0],[.62,.1,.02],.075,m,g);
 k.link([.62,.1,.02],[.46,-.55,.12],.062,m,g);
 g.scale.setScalar(scale);return g;
}
function blade(k,start,end,r,material,parent=k.root){
 const a=new k.T.Vector3(...start),b=new k.T.Vector3(...end);
 const mesh=k.cylinder(0,r,a.distanceTo(b),0,0,0,material,parent);
 mesh.position.copy(a).add(b).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new k.T.Vector3(0,1,0),b.sub(a).normalize());return mesh;
}
export const uncannyFears=[
 {id:'scopophobia',title:'Скопофобия',subtitle:'Каждый взгляд обращён к тебе',accent:'#b4b6ae',build(k){
  const porcelain=k.mat('#9c9d95',{roughness:.25,metalness:.18}),ink=k.mat('#020305',{roughness:.22}),iris=k.mat('#464c48',{roughness:.35,metalness:.3});
  const eyes=[];const n=count(k,9,6);
  for(let i=0;i<n;i++){
   const angle=i/n*TAU,g=k.group(Math.cos(angle)*(i?2.7:0),Math.sin(angle)*1.9+.3,-.4-(i%3)*1.5);
   const size=i===0?1.28:.53+k.rng()*.22;g.scale.setScalar(size);
   k.sphere(.76,0,0,0,porcelain,1,.66,.58,g);
   const pupil=k.group(0,0,.4,g);k.sphere(.33,0,0,0,iris,1,1,.22,pupil);k.sphere(.15,0,0,.07,ink,1,1,.25,pupil);
   k.sphere(.045,-.09,.11,.12,k.mat('#c3c5bd',{emissive:'#a9afa2',emissiveIntensity:.3}),1,1,.5,pupil);
   const lid=k.mat('#1a1b1d',{roughness:.7});
   k.tube([[-.76,0,0],[-.35,.5,.23],[.34,.5,.23],[.76,0,0]],.07,lid,g);
   k.tube([[-.76,0,0],[-.35,-.49,.23],[.34,-.49,.23],[.76,0,0]],.07,lid,g);
   eyes.push({g,pupil,y:g.position.y,size,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{for(const e of eyes){e.g.position.y=e.y+Math.sin(t*.37+e.phase)*.14;e.pupil.position.x=p.x*.15;e.pupil.position.y=-p.y*.1;const blink=Math.pow(Math.max(0,Math.cos(t*.25+e.phase)),42);e.g.scale.y=e.size*(1-blink*.86);e.g.rotation.y=Math.sin(t*.13+e.phase)*.15+ p.x*.05;e.g.position.z+=0;}});
 }},
 {id:'spectrophobia',title:'Спектрофобия',subtitle:'Отражение двигается позже',accent:'#8396ab',build(k){
  const frame=k.mat('#444a52',{metalness:.82,roughness:.24}),glass=k.mat('#263441',{metalness:.96,roughness:.12,emissive:'#273648',emissiveIntensity:.15});
  const shade=k.mat('#06080b',{roughness:.85}),mirrors=[];base(k,8,6);
  const n=count(k,7,5);
  for(let i=0;i<n;i++){
   const x=(i-(n-1)/2)*1.15,g=k.group(x,.1,-1.5-Math.abs(x)*.5);
   const height=3.2+k.rng()*.9;
   k.box(.95,height,.09,0,0,0,glass,g);
   for(const s of[-1,1]){k.box(.055,height+.1,.2,s*.51,0,.02,frame,g);k.box(1.08,.055,.2,0,s*height*.5,.02,frame,g);}
   const reflection=k.group(0,-.28,.08,g);
   k.sphere(.21,0,.76,0,shade,.85,1.1,.15,reflection);
   k.sphere(.5,0,-.14,0,shade,.7,1.5,.13,reflection);
   g.rotation.y=-x*.11;mirrors.push({g,reflection,x,phase:k.rng()*TAU});
  }
  const shards=[];for(let i=0;i<count(k,16,9);i++){
   const geometry=new k.T.ConeGeometry(.15+k.rng()*.17,.5+k.rng()*.4,3,1);
   const m=k.mesh(geometry,glass);m.position.set((k.rng()-.5)*6,-2.28,k.rng()*3-1);m.rotation.set(k.rng()*2,k.rng()*TAU,k.rng()*2);shards.push(m);
  }
  k.onTick((t,dt,p,pulse)=>{for(const v of mirrors){v.g.rotation.y=-v.x*.11+Math.sin(t*.22+v.phase)*.09;v.reflection.position.x=Math.sin(t*.6+v.phase)*.17-p.x*.16;v.reflection.rotation.z=Math.sin(t*.37+v.phase)*.045;}for(let i=0;i<shards.length;i++)shards[i].position.y=-2.28+Math.sin(t*.5+i)*.03;});
 }},
 {id:'automatonophobia',title:'Аутоматонофобия',subtitle:'Они почти похожи на людей',accent:'#a9a69c',build(k){
  const ceramic=k.mat('#62625d',{roughness:.38,metalness:.08}),far=k.mat('#25272b',{roughness:.67});base(k,8,7);
  const figures=[],n=count(k,13,8);
  for(let i=0;i<n;i++){
   const row=Math.floor(i/4),x=(i%4-1.5)*1.5+(row%2)*.4,z=-row*1.7;
   const g=mannequin(k,x,-.8,z,i===5?1.2:.8+k.rng()*.22,i<4?ceramic:far);
   const armAngle=k.rng()*.2;g.rotation.y=(k.rng()-.5)*.5;
   figures.push({g,x,y:g.position.y,angle:g.rotation.y,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{for(let i=0;i<figures.length;i++){const v=figures[i];v.g.rotation.y=v.angle+Math.sin(t*.13+v.phase)*.08+(i%3===0?-p.x*.17:0);v.g.rotation.z=Math.sin(t*.21+v.phase)*.027;v.g.position.y=v.y+Math.sin(t*.31+v.phase)*.035;}});
 }},
 {id:'coulrophobia',title:'Коулрофобия',subtitle:'Улыбка не исчезает',accent:'#9f777e',build(k){
  const T=k.T,porcelain=k.mat('#a8a39b',{roughness:.32,metalness:.1}),black=k.mat('#08080b',{roughness:.55}),red=k.mat('#6a303f',{roughness:.46});
  const face=k.group(0,.4,-.2),shape=new T.Shape();
  shape.moveTo(0,2);shape.bezierCurveTo(1.8,2.1,1.9,-.4,.9,-1.4);shape.bezierCurveTo(.55,-2.1,-.55,-2.1,-.9,-1.4);shape.bezierCurveTo(-1.9,-.4,-1.8,2.1,0,2);
  for(const x of[-.65,.65]){const hole=new T.Path();hole.absellipse(x,.45,.36,.25,0,TAU,true);shape.holes.push(hole);}
  const mask=k.mesh(new T.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.08,bevelThickness:.08,curveSegments:18}),porcelain,face);
  for(const x of[-.65,.65]){
   k.sphere(.39,x,.45,-.06,black,1,.72,.24,face);
   k.tube([[x-.3,.87,.3],[x,.98,.37],[x+.26,.86,.3]],.055,black,face);
   const tear=k.mesh(new T.ConeGeometry(.12,.7,3),red,face);tear.position.set(x,-.05,.31);tear.rotation.z=Math.PI;
  }
  k.sphere(.28,0,.02,.52,red,1,.9,.8,face);
  k.tube([[-.95,-.6,.3],[-.64,-1,.39],[0,-1.15,.49],[.64,-1,.39],[.95,-.6,.3]],.13,black,face);
  for(let i=0;i<11;i++){const x=(i-5)*.13,y=-1.12+Math.pow(x,2)*.4;k.box(.092,.15,.09,x,y,.55,porcelain,face);}
  for(const s of[-1,1])for(let i=0;i<4;i++){
   const hair=k.mesh(new T.ConeGeometry(.28,1.3,5),black,face);hair.position.set(s*(1.35+i*.07),.85-i*.45,0);hair.rotation.z=s*(-.6-i*.17);
  }
  const thread=k.mat('#353338',{roughness:.65});for(const s of[-1,1])k.link([s*1.25,1.25,-.1],[s*2.7,5,-1],.015,thread,face);
  k.onTick((t,dt,p,pulse)=>{face.rotation.y=Math.sin(t*.24)*.16+p.x*.1;face.rotation.z=Math.sin(t*.19)*.075;face.position.y=.4+Math.sin(t*.43)*.12;face.position.z=-.2+pulse*.2;});
 }},
 {id:'chronophobia',title:'Хронофобия',subtitle:'Время стекает в темноту',accent:'#9b9788',build(k){
  const brass=k.mat('#6a6659',{metalness:.8,roughness:.32}),dial=k.mat('#303136',{roughness:.85}),hands=k.mat('#bab6a6',{metalness:.35,roughness:.4});
  const clocks=[];for(let j=0;j<count(k,4,2);j++){
   const g=k.group((j%2?1:-1)*(1.3+j*.3),.75-Math.floor(j/2)*1.7,-j*.7),r=j===0?1.25:.8;
   const face=k.cylinder(r,r,.1,0,0,0,dial,g);face.rotation.x=Math.PI/2;
   k.ring(r,.055,0,0,.08,brass,g);
   for(let i=0;i<12;i++){const a=i/12*TAU,b=k.box(.025,i%3===0?.15:.08,.04,Math.sin(a)*r*.85,Math.cos(a)*r*.85,.1,hands,g);b.rotation.z=-a;}
   const minute=k.group(0,0,.14,g),hour=k.group(0,0,.18,g);
   k.box(.035,r*.8,.025,0,r*.36,0,hands,minute);k.box(.055,r*.55,.025,0,r*.23,0,hands,hour);k.sphere(.07,0,0,.19,brass,1,1,.5,g);
   clocks.push({g,minute,hour,phase:k.rng()*TAU,speed:.08+j*.06});
  }
  const pendulums=[];for(let i=0;i<count(k,5,3);i++){
   const g=k.group((i-2)*1.25,3.5,-2.2-i*.4);k.link([0,0,0],[0,-4,0],.02,brass,g);k.sphere(.32,0,-4,0,brass,1,1,.35,g);pendulums.push({g,phase:i*.7});
  }
  k.onTick((t,dt,p,pulse)=>{for(const c of clocks){c.minute.rotation.z=-t*c.speed+c.phase;c.hour.rotation.z=-t*c.speed*.12;c.g.rotation.y=Math.sin(t*.2+c.phase)*.1;}for(const v of pendulums)v.g.rotation.z=Math.sin(t*.85+v.phase)*.32;});
 }},
 {id:'thanatophobia',title:'Танатофобия',subtitle:'Последние крупинки света',accent:'#9e9382',build(k){
  const iron=k.mat('#25272b',{metalness:.64,roughness:.47}),sand=k.mat('#8f8777',{roughness:1}),glass=k.mat('#343b43',{transparent:true,opacity:.19,metalness:.15,roughness:.18,depthWrite:false});base(k,7,5);
  const hourglass=k.group(0,.4,0);
  for(const s of[-1,1]){
   k.cylinder(1.05,1.05,.13,0,s*1.65,0,iron,hourglass);
   const cone=k.cylinder(s>0?1:.07,s>0?.07:1,1.5,0,s*.8,0,glass,hourglass);
   k.cylinder(s>0?.73:.02,s>0?.03:.82,.85,0,s*.7,0,sand,hourglass);
  }
  for(let i=0;i<4;i++){const a=i/4*TAU;k.link([Math.cos(a)*.91,-1.65,Math.sin(a)*.91],[Math.cos(a)*.91,1.65,Math.sin(a)*.91],.035,iron,hourglass);}
  const stream=k.cylinder(.012,.018,.7,0,-.12,0,sand,hourglass);
  const flames=[];for(let i=0;i<count(k,9,6);i++){
   const a=i/9*TAU,x=Math.cos(a)*(2+k.rng()*.4),z=Math.sin(a)*1.5-.5,h=.35+k.rng()*.65;
   const wax=k.mat('#4e4c45',{roughness:.85});k.cylinder(.12,.14,h,x,-2.3+h*.5,z,wax);
   const flame=k.sphere(.1,x,-2.2+h,z,k.mat('#d2bf99',{emissive:'#a08a62',emissiveIntensity:1.1,transparent:true,opacity:.75}),.5,1.5,.5);flames.push({flame,h,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{hourglass.rotation.y=Math.sin(t*.13)*.22+p.x*.05;stream.scale.x=.7+Math.sin(t*5)*.2;for(const v of flames){const breath=.5+.5*Math.sin(t*.3+v.phase);v.flame.scale.y=(.8+Math.sin(t*3+v.phase)*.2)*breath;v.flame.material.opacity=.25+breath*.5;}});
 }},
 {id:'aichmophobia',title:'Айхмофобия',subtitle:'Острия обращены внутрь',accent:'#a2abb0',build(k){
  const steel=k.mat('#727b82',{metalness:.9,roughness:.26}),baseMat=k.mat('#252a2e',{roughness:.7,metalness:.5}),spikes=[];
  const n=count(k,42,28);for(let i=0;i<n;i++){
   const a=i/n*TAU,r=2.6+k.rng()*.9,z=(k.rng()-.5)*3-1,g=k.group(Math.cos(a)*r,Math.sin(a)*r,z);
   const len=.8+k.rng()*1.2,tip=[-Math.cos(a)*len,-Math.sin(a)*len,.5];
   blade(k,[0,0,0],tip,.08+k.rng()*.05,steel,g);k.sphere(.13,0,0,0,baseMat,1,1,1,g);
   spikes.push({g,x:g.position.x,y:g.position.y,z,phase:k.rng()*TAU});
  }
  const cage=k.ring(3.5,.045,0,0,-2,baseMat);cage.rotation.y=.3;
  k.onTick((t,dt,p,pulse)=>{for(const s of spikes){const press=1-.045*Math.sin(t*.48+s.phase)-pulse*.055;s.g.position.x=s.x*press;s.g.position.y=s.y*press;s.g.position.z=s.z+Math.sin(t*.35+s.phase)*.12;}cage.rotation.z=t*.015;});
 }},
 {id:'pyrophobia',title:'Пирофобия',subtitle:'Огонь поглощает контуры',accent:'#aa7862',build(k){
  const char=k.mat('#161719',{roughness:.98}),fire=k.mat('#866452',{emissive:'#6f3522',emissiveIntensity:.6,transparent:true,opacity:.65,depthWrite:false});base(k,7,5);
  for(let i=0;i<9;i++){const log=k.cylinder(.12,.2,2.7,(k.rng()-.5)*2,-2.15,(k.rng()-.5)*1.5,char);log.rotation.set(0,k.rng()*TAU,Math.PI/2);}
  const flames=[];for(let i=0;i<count(k,31,20);i++){
   const x=(k.rng()-.5)*3,z=(k.rng()-.5)*2,h=.8+k.rng()*2.8,g=k.group(x,-2.15,z);
   const geometry=new k.T.ConeGeometry(.16+k.rng()*.22,h,5,2),f=k.mesh(geometry,fire,g);f.position.y=h*.5;g.rotation.z=(k.rng()-.5)*.25;
   flames.push({g,f,h,phase:k.rng()*TAU,scale:.65+k.rng()*.4});
  }
  const ash=k.mat('#706961',{emissive:'#7b4934',emissiveIntensity:.25});const embers=[];
  for(let i=0;i<count(k,35,20);i++){const m=k.sphere(.015+k.rng()*.02,(k.rng()-.5)*3,-1+k.rng()*5,(k.rng()-.5)*3,ash);embers.push({m,x:m.position.x,y:m.position.y,phase:k.rng()*TAU});}
  k.onTick((t,dt,p,pulse)=>{for(const v of flames){v.g.scale.y=v.scale+Math.sin(t*1.7+v.phase)*.2;v.g.rotation.z=Math.sin(t*1.2+v.phase)*.1;v.g.rotation.y=t*.12+v.phase;}for(const v of embers){v.m.position.y=-2.1+((t*.48+v.y+6)%6);v.m.position.x=v.x+Math.sin(t*.6+v.phase)*.25;}});
 }},
 {id:'astraphobia',title:'Астрафобия',subtitle:'Небо нависает над тобой',accent:'#8f9dac',build(k){
  const cloud=k.mat('#30353d',{roughness:1}),lightning=k.mat('#a6b3c4',{emissive:'#6f8aac',emissiveIntensity:.65,roughness:.3}),rain=k.mat('#515c6a',{transparent:true,opacity:.35,roughness:.5});
  const clouds=[];for(let i=0;i<count(k,16,10);i++){
   const x=(k.rng()-.5)*6,y=2.3+k.rng()*.8,z=(k.rng()-.5)*4-1,m=k.sphere(.5+k.rng()*.6,x,y,z,cloud,1.6,.65,1);clouds.push({m,x,phase:k.rng()*TAU});
  }
  const bolts=[];for(let i=0;i<3;i++){
   const x=(i-1)*1.9,g=k.group(x,1.9,-1-i*.8);
   k.tube([[0,0,0],[-.3,-.6,0],[.1,-.67,.1],[-.7,-1.7,0],[-.36,-1.72,0],[-.9,-3.15,.1]],.035,lightning,g);
   k.tube([[-.7,-1.7,0],[-1.2,-1.7,0],[-1.35,-2.35,-.1]],.016,lightning,g);bolts.push({g,phase:i*2});
  }
  const drops=[];for(let i=0;i<count(k,46,28);i++){const x=(k.rng()-.5)*7,y=k.rng()*5-2.4,z=(k.rng()-.5)*5,m=k.link([x,y,z],[x-.04,y-.2,z],.006,rain);drops.push({m,y});}
  k.onTick((t,dt,p,pulse)=>{for(const c of clouds)c.m.position.x=c.x+Math.sin(t*.16+c.phase)*.2;for(const b of bolts)b.g.scale.y=.88+Math.sin(t*.4+b.phase)*.08;for(const v of drops)v.m.position.y=-2.5+((v.y-t*1.6+100)%5);lightning.emissiveIntensity=.45+Math.sin(t*.5)*.15;});
 }},
 {id:'ataxophobia',title:'Атаксофобия',subtitle:'Порядок распадается на части',accent:'#97939f',build(k){
  const pale=k.mat('#6f7078',{roughness:.6,metalness:.35}),dark=k.mat('#2d3038',{roughness:.8}),pieces=[];
  const n=k.detail==='low'?4:5;for(let x=0;x<n;x++)for(let y=0;y<n;y++){
   const px=(x-(n-1)/2)*.86,py=(y-(n-1)/2)*.86,g=k.group(px,py,-.5-(x+y)%3*.2);
   k.box(.72,.72,.21,0,0,0,(x+y)%2?pale:dark,g);
   const line=k.mat('#81818a',{emissive:'#4b485b',emissiveIntensity:.1});k.box(.48,.015,.02,0,0,.115,line,g);
   pieces.push({g,x:px,y:py,z:g.position.z,dx:(k.rng()-.5)*2,dy:(k.rng()-.5)*2,dz:(k.rng()-.5)*3,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{const chaos=(Math.sin(t*.23)+1)*.5;for(const v of pieces){v.g.position.set(v.x+v.dx*chaos,v.y+v.dy*chaos,v.z+v.dz*chaos);v.g.rotation.set(Math.sin(t*.35+v.phase)*chaos,.4*chaos*Math.cos(v.phase),Math.sin(t*.3+v.phase)*chaos*.6);}});
 }},
 {id:'monophobia',title:'Монофобия',subtitle:'Остальные уже ушли',accent:'#82939d',build(k){
  const dark=k.mat('#1c2228',{roughness:.9}),pale=k.mat('#747c80',{roughness:.7});base(k,9,9);
  const lone=mannequin(k,0,-1.1,0,1,pale);lone.rotation.y=.18;
  const portalMat=k.mat('#303945',{metalness:.6,roughness:.4});
  for(let i=0;i<5;i++){
   const z=-1.5-i*1.3,w=2.7+i*.45;
   k.box(.07,4.9,.12,-w,0,z,portalMat);k.box(.07,4.9,.12,w,0,z,portalMat);k.box(w*2,.07,.12,0,2.45,z,portalMat);
  }
  const shadows=[];for(let i=0;i<count(k,8,5);i++){
   const g=mannequin(k,(i%2?1:-1)*(1.5+k.rng()),-.8,-1-i*.7,.8,dark);
   shadows.push({g,z:g.position.z,x:g.position.x,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{lone.rotation.z=Math.sin(t*.37)*.015;for(const s of shadows){const retreat=(Math.sin(t*.15+s.phase)+1)*.5;s.g.position.z=s.z-retreat*2;s.g.position.x=s.x+Math.sign(s.x)*retreat*.4;s.g.rotation.y=Math.PI+Math.sin(t*.11+s.phase)*.2;}});
 }},
 {id:'phobophobia',title:'Фобофобия',subtitle:'Страх замыкается на себе',accent:'#a191aa',build(k){
  const obsidian=k.mat('#35313d',{metalness:.74,roughness:.28}),edge=k.mat('#8f819b',{emissive:'#51415f',emissiveIntensity:.18,metalness:.55,roughness:.4});
  const knot=k.group(0,.1,0);
  k.mesh(new k.T.TorusKnotGeometry(1.5,.22,k.detail==='low'?80:144,8,3,5),obsidian,knot);
  const rings=[];for(let i=0;i<count(k,7,5);i++){
   const g=k.group(0,0,0,knot),r=k.ring(1.9+i*.19,.017,0,0,0,edge,g);g.rotation.set(i*.44,i*.57,i*.24);rings.push({g,phase:i*.7});
  }
  const thorns=[];for(let i=0;i<count(k,30,18);i++){
   const a=i/30*TAU,b=k.rng()*Math.PI,r=2.7+k.rng()*.5,start=[Math.cos(a)*Math.sin(b)*r,Math.cos(b)*r,Math.sin(a)*Math.sin(b)*r];
   const tip=start.map(v=>v*.75);const m=blade(k,start,tip,.075,obsidian);thorns.push({m,phase:k.rng()*TAU});
  }
  k.onTick((t,dt,p,pulse)=>{knot.rotation.y=t*.09+p.x*.05;knot.rotation.x=Math.sin(t*.13)*.15;const squeeze=1+Math.sin(t*.5)*.05-pulse*.04;knot.scale.setScalar(squeeze);for(const r of rings){r.g.rotation.z=t*.07+r.phase;r.g.rotation.y=Math.sin(t*.16+r.phase)*.6;}for(const s of thorns)s.m.scale.setScalar(1+Math.sin(t*.45+s.phase)*.06);});
 }}
];
