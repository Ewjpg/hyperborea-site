// Spatial fears are built from solid geometry; every scene has its own silhouette and motion.
const TAU=Math.PI*2;
const count=(k,normal,low)=>k.detail==='low'?low:normal;
function materials(k,accent){return{stone:k.mat('#25282d',{roughness:.84,metalness:.13}),dark:k.mat('#080b10',{roughness:.74,metalness:.26}),edge:k.mat('#5d666e',{roughness:.42,metalness:.45}),light:k.mat(accent,{emissive:accent,emissiveIntensity:.38,roughness:.36}),fog:k.mat('#62717d',{transparent:true,opacity:.1,roughness:.9,depthWrite:false})};}
function doorway(k,g,m,w=2.8,h=4,d=.24){k.box(.18,h,d,-w/2,h/2,0,m,g);k.box(.18,h,d,w/2,h/2,0,m,g);k.box(w+.18,.2,d,0,h,0,m,g);}
function human(k,x,y,z,m,s=.5,parent=k.root){const g=k.group(x,y,z,parent);k.sphere(.2*s,0,1.54*s,0,m,1,1,1,g);k.cylinder(.17*s,.22*s,.75*s,0,.96*s,0,m,g);k.link([-.1*s,.6*s,0],[-.17*s,0,0],.055*s,m,g);k.link([.1*s,.6*s,0],[.17*s,0,.04*s],.055*s,m,g);return g;}
function shard(k,x,y,z,m,size=.2,parent=k.root){const o=k.mesh(new k.T.TetrahedronGeometry(size),m,parent);o.position.set(x,y,z);return o;}

export const spatialFears=[
  {id:'acrophobia',title:'Акрофобия',subtitle:'Тонкая грань над городом',accent:'#a4b5bf',build(k){
    const m=materials(k,'#a4b5bf'),bridge=k.group(0,-.5,0);bridge.rotation.y=-.28;bridge.rotation.x=.1;
    k.box(1.05,.14,6.9,0,0,-1.1,m.stone,bridge);
    for(const side of[-1,1]){k.link([side*.56,.05,2.1],[side*.56,.8,-4.5],.018,m.edge,bridge);for(let j=0;j<5;j++)k.link([side*.56,0,2-j*1.4],[side*.56,.33,2-j*1.4],.018,m.edge,bridge);}
    const n=count(k,18,10),buildings=[];
    for(let i=0;i<n;i++){const side=i%2?1:-1,x=side*(1.4+k.rng()*3.3),z=-5+k.rng()*7,h=1.3+k.rng()*5;const b=k.box(.48+k.rng()*.72,h,.55+k.rng(),x,-4-h*.16,z,m.dark);buildings.push(b);k.box(.035,.04,.035,x,-4+h*.34,z,m.light);}
    const dust=[];for(let i=0;i<count(k,16,9);i++){const s=shard(k,(k.rng()-.5)*7,k.rng()*6-3,k.rng()*6-4,m.edge,.04+k.rng()*.08);dust.push({o:s,x:s.position.x,y:s.position.y,z:s.position.z,s:.25+k.rng()*.8});}
    const person=human(k,0,-.43,-1.6,m.light,.32,bridge);
    k.onTick((t,dt,p,pulse)=>{bridge.rotation.z=Math.sin(t*.8)*(.009+pulse*.022);person.position.z=-1.6+Math.sin(t*.19)*.3;for(const d of dust){d.o.position.y=3-((t*d.s+d.y+8)%8);d.o.rotation.x=t*d.s;d.o.position.x=d.x+Math.sin(t*.3+d.z)*.1;}bridge.position.y=-.5+Math.sin(t*.4)*.03;});
  }},
  {id:'bathophobia',title:'Батофобия',subtitle:'Глубина не отвечает',accent:'#7c9da9',build(k){
    const m=materials(k,'#7c9da9'),shaft=k.group(0,.05,-.3);shaft.rotation.x=.11;shaft.rotation.y=-.08;
    const levels=count(k,12,8),rings=[];
    for(let i=0;i<levels;i++){const g=k.group(0,0,-i*.92,shaft);const r=2.55+i*.035;const ring=k.ring(r,.075,0,0,0,m.stone,g);ring.scale.y=.87;for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){const x=Math.cos(a)*r,y=Math.sin(a)*r*.87;k.box(.13,.13,.86,x,y,-.43,m.edge,g);}rings.push(g);}
    for(const side of[-1,1]){k.link([side*.3,-1.7,1],[side*.3,-1.7,-11],.025,m.edge,shaft);for(let i=0;i<14;i++)k.link([-.3,-1.7,-i*.74],[.3,-1.7,-i*.74],.025,m.edge,shaft);}
    const beacon=k.sphere(.1,0,-.1,-10.2,m.light);k.ring(.28,.02,0,-.1,-10.15,m.light);
    const falling=[];for(let i=0;i<count(k,18,10);i++){const a=k.rng()*TAU,r=.3+k.rng()*1.6,o=shard(k,Math.cos(a)*r,Math.sin(a)*r,-k.rng()*10,m.stone,.06+k.rng()*.13,shaft);falling.push({o,a,r,z:k.rng()*11});}
    k.onTick((t,dt,p,pulse)=>{shaft.rotation.z=Math.sin(t*.19)*.045;beacon.scale.setScalar(1+Math.sin(t*1.2)*.1);for(const d of falling){d.o.position.z=1-((d.z+t*(.65+pulse))%12);d.o.rotation.x=t*.3;d.o.rotation.y=t*.18;}for(let i=0;i<rings.length;i++)rings[i].rotation.z=Math.sin(t*.18+i*.2)*.018;});
  }},
  {id:'thalassophobia',title:'Талассофобия',subtitle:'Под поверхностью кто-то есть',accent:'#508c99',build(k){
    const m=materials(k,'#508c99');
    const surface=k.box(10,.04,9,0,2.45,-2,k.mat('#325965',{transparent:true,opacity:.18,roughness:.3,metalness:.7,depthWrite:false}));
    const creature=k.group(0,.35,-4.7);k.sphere(1,0,0,0,m.dark,4.15,1.2,.65,creature);k.sphere(.11,-2.35,.23,.59,m.light,1,.35,.4,creature);
    const fin=new k.T.Shape();fin.moveTo(-.2,-.3);fin.lineTo(.55,1.8);fin.lineTo(1.55,-.3);fin.closePath();const f=k.mesh(new k.T.ExtrudeGeometry(fin,{depth:.16,bevelEnabled:false}),m.dark,creature);f.position.set(-.8,.65,-.12);
    const tail=k.mesh(new k.T.ConeGeometry(1.18,1.45,3),m.dark,creature);tail.rotation.z=Math.PI/2;tail.scale.z=.2;tail.position.set(4.05,0,0);
    const wreck=k.group(.2,-2.0,.4);wreck.rotation.z=-.35;for(let i=0;i<7;i++){const rib=k.ring(1.4-i*.06,.04,0,0,-i*.46,m.stone,wreck);rib.rotation.y=.08;}k.box(.13,3.6,.13,0,.9,-.2,m.edge,wreck);k.box(2.7,.12,.16,0,2.1,-.2,m.edge,wreck);
    const bubbles=[];for(let i=0;i<count(k,24,12);i++){const o=k.sphere(.025+k.rng()*.045,(k.rng()-.5)*7,k.rng()*5-2.5,k.rng()*6-3,m.fog);bubbles.push({o,x:o.position.x,y:k.rng()*5,z:o.position.z});}
    k.onTick((t,dt,p,pulse)=>{creature.position.x=Math.sin(t*.12)*.75;creature.position.y=.35+Math.sin(t*.25)*.12;tail.rotation.y=Math.sin(t*.9)*.17;surface.position.y=2.45+Math.sin(t*.42)*.08;for(const b of bubbles){b.o.position.y=-2.5+(b.y+t*.22)%5;b.o.position.x=b.x+Math.sin(t*.5+b.z)*.08;}wreck.rotation.z=-.35+Math.sin(t*.15)*.025;});
  }},
  {id:'agoraphobia',title:'Агорафобия',subtitle:'Слишком далеко до края',accent:'#92969e',build(k){
    const m=materials(k,'#92969e');k.box(11,.15,11,0,-1.8,-2,m.stone);
    const lines=k.mat('#41464e',{roughness:.95});for(let i=-5;i<=5;i++){k.box(.015,.007,10,i,-1.719,-2,lines);k.box(10,.007,.015,0,-1.719,i-2,lines);}
    const plinth=k.cylinder(1.05,1.16,.23,0,-1.6,-3,m.dark);k.box(.24,3.6,.24,0,.3,-3,m.edge);k.sphere(.22,0,2.26,-3,m.light);
    const figures=[];for(let i=0;i<count(k,10,6);i++){const a=i*TAU/count(k,10,6),r=2.2+k.rng()*1.2,g=human(k,Math.cos(a)*r,-1.71,Math.sin(a)*r-2,m.dark,.36);figures.push({g,a,r});}
    for(const x of[-4.9,4.9])for(let i=0;i<5;i++){k.box(.5,3.3,.6,x,-.12,-5+i*1.8,m.dark);k.box(.53,.08,.68,x,1.56,-5+i*1.8,m.edge);}
    k.onTick((t,dt,p,pulse)=>{for(let i=0;i<figures.length;i++){const f=figures[i],a=f.a+t*.013;f.g.position.x=Math.cos(a)*f.r;f.g.position.z=Math.sin(a)*f.r-2;f.g.rotation.y=-a+Math.PI*.5;}plinth.rotation.y=t*.02;});
  }},
  {id:'claustrophobia',title:'Клаустрофобия',subtitle:'Стены делают вдох',accent:'#a99a93',build(k){
    const m=materials(k,'#a99a93'),left=k.group(-2.05,0,-1),right=k.group(2.05,0,-1);
    for(const [g,side]of[[left,-1],[right,1]]){k.box(1.5,6.5,7.3,side*.75,0,0,m.stone,g);for(let i=0;i<5;i++){k.box(.04,5.9,.08,-side*.035,0,2.8-i*1.35,m.edge,g);k.box(.12,.035,.65,-side*.05,1.3-i*.64,.9-i*.63,m.dark,g);}}
    k.box(4.7,.28,7.3,0,-2.3,-1,m.dark);const ceiling=k.box(4.7,.5,7.3,0,2.8,-1,m.stone);const door=k.group(0,-2.15,-4.4);doorway(k,door,m.edge,1.1,2.4,.13);k.box(.96,2.22,.1,0,1.13,-.06,m.dark,door);k.box(.02,.03,.03,.32,1.2,.02,m.light,door);
    const dust=[];for(let i=0;i<count(k,15,8);i++){const o=shard(k,(k.rng()-.5)*2,k.rng()*4-2,k.rng()*6-4,m.edge,.035);dust.push({o,y:k.rng()*4});}
    k.onTick((t,dt,p,pulse)=>{const breath=(Math.sin(t*.55)+1)*.5,space=2.05-breath*.82-pulse*.12;left.position.x=-space;right.position.x=space;ceiling.position.y=2.8-breath*.35;for(const d of dust)d.o.position.y=2-((d.y+t*.2)%4);});
  }},
  {id:'nyctophobia',title:'Никтофобия',subtitle:'Темнота смотрит в ответ',accent:'#c3cbd0',build(k){
    const m=materials(k,'#c3cbd0'),corridor=k.group(0,0,-1);k.box(8,.13,9,0,-2,-2,m.dark,corridor);
    for(const side of[-1,1])for(let i=0;i<7;i++){const pole=k.box(.2,5.2,.25,side*(2.8+i*.07),.6,1-i*1.2,m.stone,corridor);pole.rotation.z=side*(.06+k.rng()*.14);}
    const eyes=[];for(let i=0;i<count(k,8,5);i++){const g=k.group((k.rng()-.5)*5,k.rng()*3.7-1,-k.rng()*7,corridor),emat=k.mat('#b6c2c8',{emissive:'#b6c2c8',emissiveIntensity:.4,roughness:.4});for(const side of[-1,1]){k.sphere(.115,side*.23,0,0,emat,1.5,.48,.7,g);k.sphere(.043,side*.23,.002,.068,m.dark,.55,1,1,g);}eyes.push({g,emat,phase:k.rng()*TAU});}
    const door=k.group(0,-2,-7.5,corridor);doorway(k,door,m.edge,1.15,2.6,.13);k.box(.025,2.5,.03,-.51,1.3,.08,m.light,door);
    const beam=k.mesh(new k.T.ConeGeometry(1.4,6,14,1,true),k.mat('#b3bcc8',{transparent:true,opacity:.035,side:k.T.DoubleSide,depthWrite:false}));beam.rotation.x=-Math.PI/2;beam.position.set(.3,-.2,0);
    k.onTick((t,dt,p,pulse)=>{for(const e of eyes){const blink=Math.pow(Math.max(0,Math.sin(t*.63+e.phase)),22);e.g.scale.y=.15+.85*(1-blink);e.emat.emissiveIntensity=.18+Math.max(0,Math.sin(t*.35+e.phase))*.35+pulse*.3;}beam.rotation.z=Math.sin(t*.16)*.2;beam.position.x=Math.sin(t*.13)*.35;});
  }},
  {id:'kenophobia',title:'Кенофобия',subtitle:'Ни одна дверь не ведёт наружу',accent:'#a0acb7',build(k){
    const m=materials(k,'#a0acb7'),frames=[];
    for(let i=0;i<count(k,10,7);i++){const g=k.group(0,-2,-i*1.15);doorway(k,g,i%3?m.stone:m.edge,3.9,4.9,.11);frames.push(g);}
    k.box(4,.1,12,0,-2.05,-4,m.dark);
    const slabs=[];for(let i=0;i<5;i++){const side=i%2?1:-1,g=k.group(side*2.8,-1.8,-i*1.7);const s=k.box(1.65,3.4,.12,0,1.7,0,m.stone,g);g.rotation.y=-side*.65;slabs.push({g,side,a:g.rotation.y});k.sphere(.048,-side*.64,1.66,.09,m.light,1,1,1,g);}
    k.onTick((t,dt,p,pulse)=>{for(let i=0;i<frames.length;i++){frames[i].position.x=Math.sin(t*.14+i*.35)*.07;frames[i].rotation.z=Math.sin(t*.11+i*.3)*.012;}for(const s of slabs)s.g.rotation.y=s.a+Math.sin(t*.24+s.g.position.z)*.09;});
  }},
  {id:'apeirophobia',title:'Апейрофобия',subtitle:'Последней комнаты нет',accent:'#9da5be',build(k){
    const m=materials(k,'#9da5be'),portals=[],n=count(k,17,11);
    for(let i=0;i<n;i++){const g=k.group(0,0,-i*.7),s=2.45;for(const side of[-1,1]){k.box(.09,s*2,.12,side*s,0,0,i%4?m.stone:m.light,g);k.box(s*2,.09,.12,0,side*s,0,i%4?m.stone:m.light,g);}g.rotation.z=i*.105;portals.push(g);}
    const orb=k.mesh(new k.T.IcosahedronGeometry(.34,1),m.edge);orb.position.z=-7.5;
    k.onTick((t,dt,p,pulse)=>{for(let i=0;i<portals.length;i++){portals[i].rotation.z=i*.105+t*.035*Math.cos(i*.07);const s=1+Math.sin(t*.32-i*.23)*.012;portals[i].scale.setScalar(s);}orb.rotation.x=t*.18;orb.rotation.y=t*.13;});
  }},
  {id:'megalophobia',title:'Мегалофобия',subtitle:'Ты меньше его тени',accent:'#9ba6ac',build(k){
    const m=materials(k,'#9ba6ac'),monolith=k.group(.25,.55,-2.3);monolith.rotation.y=-.26;
    const giant=k.box(3.2,8.7,2.1,0,.9,0,m.dark,monolith);k.box(.022,7.8,.026,-1.605,.9,1.055,m.light,monolith);k.box(2.85,.035,.04,0,3.25,1.07,m.stone,monolith);
    for(let i=0;i<7;i++)k.box(.9,.035,.02,.3,2.4-i*.58,1.06,m.stone,monolith);
    k.box(10,.17,10,0,-2.75,-2,m.stone);const person=human(k,-1.35,-2.65,1.7,m.light,.34);
    const satellites=[];for(let i=0;i<count(k,9,5);i++){const b=k.box(.2+k.rng()*.45,.4+k.rng()*.85,.18+k.rng()*.35,(k.rng()-.5)*6,1+k.rng()*4,-2-k.rng()*4,m.stone);satellites.push({o:b,y:b.position.y,a:k.rng()*TAU});}
    const shadow=k.box(2.5,.007,6,-.6,-2.657,.65,k.mat('#030507',{transparent:true,opacity:.86}));shadow.rotation.y=-.38;
    k.onTick((t,dt,p,pulse)=>{monolith.position.y=.55+Math.sin(t*.15)*.045;for(const s of satellites){s.o.position.y=s.y+Math.sin(t*.24+s.a)*.13;s.o.rotation.y=t*.035+s.a;}person.rotation.y=Math.sin(t*.12)*.05;});
  }},
  {id:'gephyrophobia',title:'Гефирофобия',subtitle:'Следующая доска может не выдержать',accent:'#a69d91',build(k){
    const m=materials(k,'#a69d91'),g=k.group(0,-.3,0);g.rotation.y=-.25;const boards=[];
    for(let i=0;i<13;i++){if(i===5||i===9)continue;const z=2-i*.53,y=-Math.sin(i/12*Math.PI)*.38,o=k.box(1.6,.12,.4,0,y,z,m.stone,g);o.rotation.z=(k.rng()-.5)*.12;boards.push({o,y,z,a:i});}
    for(const side of[-1,1]){k.tube([[side*.95,1,2.5],[side*.83,.15,-1],[side*.95,1,-5]],.045,m.edge,g);k.tube([[side*.85,0,2.5],[side*.83,-.48,-1],[side*.85,0,-5]],.035,m.edge,g);for(let i=0;i<7;i++)k.link([side*.85,-Math.sin(i/6*Math.PI)*.4,2-i*1.06],[side*.9,.87-Math.sin(i/6*Math.PI)*.7,2-i*1.06],.025,m.edge,g);}
    for(const z of[2.7,-5.2])for(const side of[-1,1])k.cylinder(.09,.14,3,side*1.05,-.3,z,m.dark,g);
    const falling=shard(k,.18,-1.5,-.7,m.stone,.35,g);falling.scale.set(2,.2,1);
    k.onTick((t,dt,p,pulse)=>{for(const b of boards){b.o.position.y=b.y+Math.sin(t*1.1+b.a*.4)*(.025+pulse*.055);b.o.rotation.x=Math.sin(t*.8+b.a)*.035;}g.rotation.z=Math.sin(t*.43)*.025;falling.position.y=-.7-(t*.36%3.3);falling.rotation.z=t*.34;});
  }},
  {id:'aquaphobia',title:'Аквафобия',subtitle:'Вода поднимается без звука',accent:'#5a8996',build(k){
    const m=materials(k,'#5a8996'),room=k.group(0,0,-.8);room.rotation.y=-.25;
    k.box(5.5,.2,5.5,0,-2.4,-.7,m.stone,room);k.box(.18,5.8,5.5,-2.75,.4,-.7,m.stone,room);k.box(5.5,5.8,.18,0,.4,-3.45,m.stone,room);
    const window=k.group(.7,-.1,-3.3,room);for(const x of[-1,0,1])k.box(.045,1.8,.09,x,0,0,m.edge,window);for(const y of[-.9,0,.9])k.box(2.1,.045,.09,0,y,0,m.edge,window);
    const waterMat=k.mat('#3d6470',{transparent:true,opacity:.48,roughness:.17,metalness:.58,depthWrite:false}),water=k.box(5.25,.07,5.25,0,-.8,-.65,waterMat,room);
    const chair=k.group(-.7,-1.3,.3,room);k.box(.95,.12,.88,0,0,0,m.dark,chair);k.box(.95,1.2,.12,0,.56,-.4,m.edge,chair);for(const x of[-.4,.4])for(const z of[-.35,.35])k.box(.08,.8,.08,x,-.4,z,m.edge,chair);chair.rotation.z=.3;chair.rotation.y=.4;
    const ripples=[];for(let i=0;i<4;i++){const o=k.ring(.3+i*.4,.018,.4,-.73,-.3,m.light,room);o.rotation.x=-Math.PI/2;ripples.push(o);}
    const bubbles=[];for(let i=0;i<count(k,17,8);i++){const o=k.sphere(.02+k.rng()*.045,(k.rng()-.5)*4,-1+k.rng()*3,-2+k.rng()*4,m.fog,1,1,1,room);bubbles.push({o,y:k.rng()*4});}
    k.onTick((t,dt,p,pulse)=>{const level=-.8+Math.sin(t*.18)*.4;water.position.y=level;chair.position.y=-1.3+Math.sin(t*.35)*.08;chair.rotation.z=.3+Math.sin(t*.24)*.045;for(let i=0;i<ripples.length;i++){const s=.55+(t*.18+i*.24)%1;ripples[i].scale.setScalar(s);ripples[i].position.y=level+.045;}for(const b of bubbles)b.o.position.y=-2.2+(b.y+t*.2)%3.6;});
  }},
  {id:'trypophobia',title:'Трипофобия',subtitle:'У пустоты слишком много отверстий',accent:'#aaa096',build(k){
    const m=materials(k,'#aaa096'),cluster=k.group(0,.1,-.8);cluster.rotation.y=-.22;const cells=[],n=count(k,35,22),golden=Math.PI*(3-Math.sqrt(5));
    // Annular cylinders have real empty centres, dark inner walls and visible thickness.
    for(let i=0;i<n;i++){const a=i*golden,r=.35+Math.sqrt(i/n)*2.05,x=Math.cos(a)*r,y=Math.sin(a)*r*.93,z=-.35-(x*x+y*y)*.14,size=.16+k.rng()*.18;
      const g=k.group(x,y,z,cluster),shape=new k.T.Shape();shape.absarc(0,0,size,0,TAU,false);const hole=new k.T.Path();hole.absarc(0,0,size*.64,0,TAU,true);shape.holes.push(hole);
      const tube=k.mesh(new k.T.ExtrudeGeometry(shape,{depth:.38+k.rng()*.4,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:10}),i%5===0?m.edge:m.stone,g);g.rotation.x=y*.12;g.rotation.y=-x*.12;const rim=k.ring(size*.81,.025,0,0,.69,m.edge,g);cells.push({g,z,a,size,rim});
    }
    const centre=k.ring(.36,.075,0,0,.3,m.dark,cluster);centre.scale.y=1.15;
    k.onTick((t,dt,p,pulse)=>{cluster.rotation.y=-.22+Math.sin(t*.14)*.1;cluster.rotation.z=Math.sin(t*.1)*.035;for(const c of cells){c.g.position.z=c.z+Math.sin(t*.55+c.a)*(.035+pulse*.07);const s=1+Math.sin(t*.7+c.a)*.035;c.g.scale.set(s,s,1);}centre.rotation.z=t*.025;});
  }}
];
