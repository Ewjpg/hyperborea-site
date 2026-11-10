import * as THREE from './vendor/three.module.min.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
function random(seed=109){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function texture(draw,width=512,height=width){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');draw(context,width,height);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function paperTexture(background,ink,kind=0){
 return texture((ctx,w,h)=>{
  const rng=random(381+kind);ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=ink;
  if(kind===0){
   for(let y=7;y<h;y+=12)for(let x=7;x<w;x+=12){const r=.6+2.7*(.5+.5*Math.sin(x*.012+y*.018));ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
  }else if(kind===1){
   ctx.save();ctx.translate(w*.5,h*.5);ctx.rotate(-.27);
   for(let i=0;i<7;i++){
    const x=-w*.55+i*w*.18,y=(i%2?1:-1)*h*.09;
    ctx.beginPath();ctx.moveTo(x-w*.12,y+h*.38);ctx.lineTo(x+w*.075,y-h*.37);ctx.lineTo(x+w*.16,y-h*.42);ctx.lineTo(x-w*.035,y+h*.32);ctx.closePath();ctx.fill();
   }
   ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(-w*.53,h*.17);ctx.lineTo(-w*.12,-h*.02);ctx.lineTo(w*.05,h*.13);ctx.lineTo(w*.52,-h*.17);ctx.strokeStyle=ink;ctx.stroke();ctx.restore();
   for(let i=0;i<20;i++)ctx.fillRect(rng()*w,rng()*h,20+rng()*180,1+rng()*4);
  }else{
   for(let i=0;i<12;i++){ctx.save();ctx.translate(rng()*w,rng()*h);ctx.rotate(-.55);ctx.fillRect(-w,-10,w*3,3+rng()*14);ctx.restore();}
  }
  for(let i=0;i<9000;i++){ctx.fillStyle=rng()>.5?'#ffffff24':'#00000022';const s=rng()*2+.5;ctx.fillRect(rng()*w,rng()*h,s,s);}
 });
}
function tornPanel(width,height,seed,fold=.08){
 const rng=random(seed),nx=20,ny=10,vertices=[],uv=[],indices=[];
 const left=Array.from({length:ny+1},()=>rng()*.13),right=Array.from({length:ny+1},()=>rng()*.15);
 const top=Array.from({length:nx+1},()=>rng()*.14),bottom=Array.from({length:nx+1},()=>rng()*.11);
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const u=x/nx,v=y/ny;
  let px=(u-.5)*width,py=(v-.5)*height;
  if(x===0)px+=left[y];if(x===nx)px-=right[y];if(y===0)py+=bottom[x];if(y===ny)py-=top[x];
  vertices.push(px,py,Math.sin(u*Math.PI*2)*fold+Math.abs(v-.5)*fold*.7);uv.push(u,v);
  if(x<nx&&y<ny){const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,a+1,b,a+1,b+1,b);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function rippedFrame(width,height,seed){
 const rng=random(seed),shape=new THREE.Shape();
 const points=[];
 for(let i=0;i<=14;i++)points.push([-width/2+i/14*width,-height/2+rng()*.16]);
 for(let i=1;i<=8;i++)points.push([width/2-rng()*.14,-height/2+i/8*height]);
 for(let i=1;i<=14;i++)points.push([width/2-i/14*width,height/2-rng()*.16]);
 for(let i=1;i<8;i++)points.push([-width/2+rng()*.13,height/2-i/8*height]);
 shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();
 const hole=new THREE.Path(),hw=width*.3,hh=height*.29;
 hole.moveTo(-hw,-hh);hole.lineTo(-hw,hh);hole.lineTo(hw,hh);hole.lineTo(hw,-hh);hole.closePath();shape.holes.push(hole);
 return new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelThickness:.022,bevelSize:.024,bevelSegments:1,steps:1});
}

/** Two visual identities, one paused, reusable WebGL surface. */
export function createNewPlayersCinematic(host){
 if(!(host instanceof HTMLElement))throw new Error('A transition host is required.');
 const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const canvas=renderer.domElement;canvas.className='new-players-cinematic-canvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none';
 host.append(canvas);host.classList.add('has-3d');host.hidden=true;
 let running=false,lost=false,frame=0,startTime=0,id='emiliano',direction='enter',width=1,height=1;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.08,120);
 const punk=new THREE.Group(),night=new THREE.Group();scene.add(punk,night);
 const ambient=new THREE.AmbientLight(0xffffff,1.6);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-4,8,12);scene.add(key);
 const fill=new THREE.DirectionalLight(0x43d9ec,1.4);fill.position.set(5,-3,1);scene.add(fill);

 const cream=paperTexture('#eae6df','#141019',0),printed=paperTexture('#9c70e8','#1a1025',1),lilac=paperTexture('#c4acf0','#251637',2),pink=paperTexture('#e75da5','#211421',0);
 const paperMaterials=[cream,printed,lilac,pink].map(map=>new THREE.MeshStandardMaterial({map,roughness:.91,metalness:0,side:THREE.DoubleSide}));
 const ink=new THREE.MeshStandardMaterial({color:0x111216,roughness:.8,side:THREE.DoubleSide});
 const violet=new THREE.MeshStandardMaterial({color:0x8652c7,roughness:.8,side:THREE.DoubleSide});
 const paleViolet=new THREE.MeshStandardMaterial({color:0xb7a0dc,roughness:.8,side:THREE.DoubleSide});
 const punkFrames=[];
 for(let i=0;i<3;i++){
  const group=new THREE.Group();group.position.set((i-1)*.18,(i%2-.5)*.22,-i*4.4);group.rotation.z=(i%2?1:-1)*(.055+i*.035);punk.add(group);
  const mesh=new THREE.Mesh(rippedFrame(13.5,9.4,50+i),[i===1?violet:i===2?paleViolet:paperMaterials[0],ink]);group.add(mesh);
  const print=new THREE.Mesh(tornPanel(8.5,1.7,213+i),paperMaterials[i===1?2:1]);print.position.set(i===1?-.6:.65,i%2?-3.6:3.5,.13);print.rotation.z=i%2?.08:-.1;group.add(print);
  punkFrames.push({group,x:group.position.x,y:group.position.y,z:group.position.z,angle:group.rotation.z});
 }
 const poster=new THREE.Mesh(tornPanel(13.8,10,198,.15),paperMaterials[1]);poster.position.set(0,0,-15.6);poster.rotation.z=-.065;punk.add(poster);
 const strips=[],stripSeeds=random(910);
 for(let i=0;i<14;i++){
  const panel=new THREE.Mesh(tornPanel(.6+stripSeeds()*2.5,.35+stripSeeds()*1.9,700+i,.24),paperMaterials[i===11?3:i%3]);
  const side=i%2?1:-1;panel.position.set(side*(2.4+stripSeeds()*4), (stripSeeds()-.5)*8.3,2-stripSeeds()*14);
  panel.rotation.set((stripSeeds()-.5)*.7,(stripSeeds()-.5)*.9,(stripSeeds()-.5)*1.8);punk.add(panel);
  strips.push({mesh:panel,x:panel.position.x,y:panel.position.y,z:panel.position.z,angle:panel.rotation.z,tilt:panel.rotation.y,pitch:panel.rotation.x,phase:stripSeeds()*TAU});
 }
 const printedDotMaterial=new THREE.MeshBasicMaterial({color:0x13151a});
 const dotGeometry=new THREE.CircleGeometry(.037,7),dots=new THREE.InstancedMesh(dotGeometry,printedDotMaterial,120);
 const dummy=new THREE.Object3D(),r=random(390);
 for(let i=0;i<120;i++){dummy.position.set((r()-.5)*15,(r()-.5)*11,-10-r()*4);dummy.updateMatrix();dots.setMatrixAt(i,dummy.matrix);}punk.add(dots);

 // Camera-facing paper cut-ins form three readable comic poses above the 3D fly-through.
 const comic=new THREE.Group();scene.add(comic);comic.visible=false;
 const cutoutMap=new THREE.TextureLoader().load(new URL('./assets/emiliano-cutout.png',import.meta.url).href);cutoutMap.colorSpace=THREE.SRGBColorSpace;
 const comicInk=new THREE.MeshBasicMaterial({color:0x100c17,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
 const comicPaper=paperMaterials.map(material=>{const copy=material.clone();copy.depthTest=false;copy.depthWrite=false;return copy;});
 const cutoutMaterial=new THREE.MeshBasicMaterial({map:cutoutMap,transparent:true,alphaTest:.035,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
 function comicPanel(w,h,crop,paperIndex,order,seed){
  const group=new THREE.Group(),border=new THREE.Mesh(tornPanel(w+.19,h+.19,seed,.035),comicInk);border.renderOrder=order;group.add(border);
  const paper=new THREE.Mesh(tornPanel(w,h,seed+1,.07),comicPaper[paperIndex]);paper.position.z=.06;paper.renderOrder=order+1;group.add(paper);
  const geometry=new THREE.PlaneGeometry(w*.965,h*.965),uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,mix(crop[0],crop[2],uv.getX(i)),mix(crop[1],crop[3],uv.getY(i)));uv.needsUpdate=true;
  const portrait=new THREE.Mesh(geometry,cutoutMaterial);portrait.position.z=.15;portrait.renderOrder=order+2;group.add(portrait);comic.add(group);return group;
 }
 const eyeCutin=comicPanel(10,3.9,[.16,.36,.84,.67],2,40,4001);
 const portraitCutin=comicPanel(4.6,6,[.1,.02,.9,.98],0,50,4011);
 const heroCutin=comicPanel(4.8,6.2,[.1,.02,.9,.98],1,60,4021);
 const burstVertices=[],burstRng=random(4194);
 for(let i=0;i<42;i++){
  const angle=i/42*TAU,inner=3+burstRng()*2,outer=13+burstRng()*6,spread=.006+burstRng()*.014;
  burstVertices.push(Math.cos(angle)*inner,Math.sin(angle)*inner,0,Math.cos(angle-spread)*outer,Math.sin(angle-spread)*outer,0,Math.cos(angle+spread)*outer,Math.sin(angle+spread)*outer,0);
 }
 const burstGeometry=new THREE.BufferGeometry();burstGeometry.setAttribute('position',new THREE.Float32BufferAttribute(burstVertices,3));
 const burst=new THREE.Mesh(burstGeometry,comicInk);burst.position.z=-11;burst.renderOrder=35;comic.add(burst);
 const gutters=[];
 for(let i=0;i<2;i++){
  const gutter=new THREE.Mesh(new THREE.PlaneGeometry(28,.095),comicInk);gutter.position.z=-7.4;gutter.renderOrder=45;comic.add(gutter);gutters.push(gutter);
 }

 const floor=new THREE.Mesh(new THREE.PlaneGeometry(44,100),new THREE.ShaderMaterial({
  uniforms:{time:{value:0}},
  vertexShader:'varying vec3 p;varying float depth;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;vec4 v=modelViewMatrix*vec4(position,1.);depth=-v.z;gl_Position=projectionMatrix*v;}',
  fragmentShader:'uniform float time;varying vec3 p;varying float depth;float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}void main(){float rip=sin(p.z*8.+p.x*14.+time*1.7)*.04+sin(p.z*23.-p.x*8.)*.02;float a=exp(-abs(p.x-3.3+rip)*8.);float b=exp(-abs(p.x+3.35+rip)*7.);float broken=.12+.6*pow(h(floor(p.xz*vec2(12.,3.))),4.);vec3 c=vec3(.013,.025,.055)+vec3(.11,.23,.42)*(a+b)*broken;float haze=1.-exp(-max(0.,depth)*.032);c=mix(c,vec3(.025,.039,.077),haze);gl_FragColor=vec4(c,1.);}'
 }));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.7,-24);night.add(floor);
 const buildings=new THREE.Group();night.add(buildings);
 const buildingMaterial=new THREE.MeshStandardMaterial({color:0x0b142c,roughness:.3,metalness:.64});
 const glassMaterial=new THREE.MeshStandardMaterial({color:0x304768,roughness:.16,metalness:.85,transparent:true,opacity:.57,side:THREE.DoubleSide});
 const blueLight=new THREE.MeshBasicMaterial({color:0x789fd2}),silverLight=new THREE.MeshBasicMaterial({color:0xc3d6ee});
 const buildingGeometry=new THREE.BoxGeometry(1,1,1),buildingInstances=new THREE.InstancedMesh(buildingGeometry,buildingMaterial,24);
 const cityRng=random(2390);
 for(let i=0;i<24;i++){
  const side=i%2?1:-1,h=5+cityRng()*9,w=1.8+cityRng()*3.8,z=7-Math.floor(i/2)*5.1;
  dummy.position.set(side*(4.2+cityRng()*3.8),h/2-.7,z);dummy.scale.set(w,h,2.4+cityRng()*2.3);dummy.rotation.set(0,0,0);dummy.updateMatrix();buildingInstances.setMatrixAt(i,dummy.matrix);
 }buildings.add(buildingInstances);
 const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(.025,.5),blueLight,220);
 for(let i=0;i<220;i++){
  const side=i%2?1:-1;dummy.position.set(side*(3.22+cityRng()*.08),.4+cityRng()*8.3,7-cityRng()*58);dummy.rotation.set(0,side>0?-Math.PI/2:Math.PI/2,0);dummy.scale.setScalar(.5+cityRng()*1.1);dummy.updateMatrix();windows.setMatrixAt(i,dummy.matrix);
 }night.add(windows);
 const nightPanels=[];
 for(let i=0;i<9;i++){
  const slab=new THREE.Mesh(new THREE.BoxGeometry(.07,3.1+cityRng()*3,1.6+cityRng()*2.5),glassMaterial);
  slab.position.set((i%2?1:-1)*(2.6+cityRng()*.9),1.9,3.5-i*4.5);slab.rotation.y=(cityRng()-.5)*.5;night.add(slab);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(.018,2.9,.025),i%2?blueLight:silverLight);edge.position.set(slab.position.x,slab.position.y,slab.position.z+.9);night.add(edge);
  nightPanels.push({mesh:slab,edge,x:slab.position.x,y:slab.position.y,z:slab.position.z,angle:slab.rotation.y,phase:cityRng()*TAU});
 }
 const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(600*6),rainData=[];
 for(let i=0;i<600;i++)rainData.push({x:(cityRng()-.5)*17,y:cityRng()*15,z:8-cityRng()*55,len:.12+cityRng()*.4});
 rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
 const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0x99b5d7,transparent:true,opacity:.27,depthWrite:false}));night.add(rain);
 const puddleMaterial=new THREE.MeshBasicMaterial({color:0x46638f,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});
 const puddles=new THREE.InstancedMesh(new THREE.CircleGeometry(1,30),puddleMaterial,14);
 for(let i=0;i<14;i++){dummy.position.set((cityRng()-.5)*5,-.684,3-cityRng()*35);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(.2+cityRng()*.5,.12+cityRng()*.2,1);dummy.updateMatrix();puddles.setMatrixAt(i,dummy.matrix);}night.add(puddles);
 const horizon=new THREE.PointLight(0x598fd4,95,40,2);horizon.position.set(0,3,-17);night.add(horizon);
 const rim=new THREE.DirectionalLight(0x5c84ca,2.1);rim.position.set(-1,5,-8);night.add(rim);

 // A translucent mental projection, not a supernatural/religious scene.
 const advisor=new THREE.Group();advisor.position.set(-1.35,1.3,-7);night.add(advisor);
 const thoughtMaterial=new THREE.MeshPhongMaterial({color:0xb7d6e9,emissive:0x284459,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,shininess:65});
 const advisorHead=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),thoughtMaterial);advisorHead.scale.set(.36,.49,.31);advisorHead.position.y=1.07;advisor.add(advisorHead);
 const profile=[new THREE.Vector2(.025,-1.2),new THREE.Vector2(.14,-.95),new THREE.Vector2(.31,-.6),new THREE.Vector2(.38,-.1),new THREE.Vector2(.52,.3),new THREE.Vector2(.46,.52),new THREE.Vector2(.18,.65)];
 const advisorBody=new THREE.Mesh(new THREE.LatheGeometry(profile,28),thoughtMaterial);advisor.add(advisorBody);
 const armCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.29,.45,0),new THREE.Vector3(.68,.2,.07),new THREE.Vector3(.99,.53,.1),new THREE.Vector3(1.19,.6,.11)]);
 advisor.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve,22,.055,7,false),thoughtMaterial));
 const eyeMaterial=new THREE.MeshBasicMaterial({color:0xd4eef8,transparent:true,opacity:.42,depthWrite:false});
 for(const x of[-.12,.12]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),eyeMaterial);eye.scale.y=.4;eye.position.set(x,1.12,.29);advisor.add(eye);}
 const predictionMaterial=new THREE.LineDashedMaterial({color:0xa8d2ed,transparent:true,opacity:.27,dashSize:.12,gapSize:.13,depthWrite:false});
 const prediction=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.18,.6,.11),new THREE.Vector3(2,.8,-1.5),new THREE.Vector3(.7,1,-4.5),new THREE.Vector3(-.3,.7,-7)]),predictionMaterial);prediction.computeLineDistances();advisor.add(prediction);
 const suggestion=new THREE.Mesh(new THREE.RingGeometry(.16,.18,32),new THREE.MeshBasicMaterial({color:0xb3d9ef,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));suggestion.position.set(2,.8,-1.5);advisor.add(suggestion);
 const predictions=[];
 for(let i=0;i<3;i++){
  const lane=i-1,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.35,.05,-6.9),new THREE.Vector3(-.8+lane*.7,.07,-10),new THREE.Vector3(lane*1.35,.12,-16),new THREE.Vector3(lane*.75,.1,-24)]);
  const material=new THREE.LineDashedMaterial({color:i===1?0xc3e0f2:0x7499bd,transparent:true,opacity:i===1?.25:.12,dashSize:.2,gapSize:.16,depthWrite:false});
  const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(44)),material);path.computeLineDistances();night.add(path);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xd0e6f3,transparent:true,opacity:.5,depthWrite:false}));night.add(marker);
  predictions.push({curve,marker,material});
 }
 function resize(){const rect=host.getBoundingClientRect();width=Math.max(1,rect.width||innerWidth);height=Math.max(1,rect.height||innerHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=camera.aspect<.8?56:48;camera.updateProjectionMatrix();}
 function render(now){
  if(!running||lost)return;
  const time=Math.max(0,(now-startTime)/1000),progress=smooth(time/(direction==='exit'?.9:1.8)),p=direction==='exit'?1-progress:progress;
  if(id==='emiliano'){
   const phase=direction==='exit'?1-clamp(time/.9):clamp(time/2.1),q=Math.floor(phase*25)/25,p=smooth(q),pose=q<.32?0:q<.64?1:2;
   const mobile=camera.aspect<.8,sway=mobile?.55:1,bank=Math.sin(p*Math.PI),sweep=Math.sin(p*TAU),poseTime=smooth(pose===0?q/.32:pose===1?(q-.32)/.32:(q-.64)/.36);
   punk.scale.x=mobile?.54:1;
   scene.background=new THREE.Color(0x17121e);scene.fog=null;ambient.color.setHex(0xe5daff);ambient.intensity=1.65;key.color.setHex(0xfff3e9);key.intensity=3;fill.color.setHex(0xa07aee);fill.intensity=1.9;
   if(pose===0){camera.position.set(mix(.7,.95,poseTime)*sway,mix(-.4,-.1,poseTime),mix(14.3,11.3,poseTime));camera.lookAt(-.2,0,-12.2);camera.rotation.z=-.075*sway;}
   else if(pose===1){camera.position.set(mix(-1.1,-.6,poseTime)*sway,mix(.55,.2,poseTime),mix(8.1,5.5,poseTime));camera.lookAt(.3,0,-12.2);camera.rotation.z=.115*sway;}
   else{camera.position.set(mix(.6,-.28,poseTime)*sway,mix(-.25,.24,poseTime),mix(4.8,2.3,poseTime));camera.lookAt(-.1,-.12,-12.2);camera.rotation.z=mix(-.065,.012,poseTime)*sway;}
   punkFrames.forEach((item,i)=>{
    const tear=smooth((p-.08-i*.11)/.75),side=i%2?1:-1;
    item.group.position.set(item.x+tear*side*(.7+i*.2),item.y+tear*side*.34,item.z+tear*(.65+i*.4));
    item.group.rotation.set(side*tear*.09,side*tear*.19,item.angle+tear*side*.24+Math.sin(q*4+i)*.018);
   });
   strips.forEach((item,i)=>{
    const tear=smooth((p-.08-(i%3)*.06)/.8),side=item.x>0?1:-1;
    item.mesh.position.set(item.x+side*tear*(1.4+(i%4)*.6),item.y+Math.sin(q*4+item.phase)*.18+tear*(i%2?.75:-.75),item.z+tear*(2.2+(i%3)*1.1));
    item.mesh.rotation.set(item.pitch+tear*side*.4,item.tilt+tear*side*.7,item.angle+tear*side*.55+Math.sin(q*3+item.phase)*.09);
   });
   poster.rotation.z=-.065+sweep*.025;poster.rotation.y=sweep*.035;
   comic.position.copy(camera.position);comic.quaternion.copy(camera.quaternion);
   const viewH=16*Math.tan(camera.fov*Math.PI/360),viewW=viewH*camera.aspect,closeScale=Math.min(viewW*.94/10,viewH*.77/3.9),portraitScale=Math.min(viewW*(mobile?.75:.42)/4.6,viewH*.9/6),heroScale=Math.min(viewW*(mobile?.86:.48)/4.8,viewH*.94/6.2);
   eyeCutin.visible=true;portraitCutin.visible=pose>0;heroCutin.visible=pose===2;
   if(pose===0){
    const land=smooth(q/.16);eyeCutin.position.set(mix(-viewW*.83,-viewW*.025,land),viewH*.03,-8);eyeCutin.scale.setScalar(closeScale*mix(1.07,1,poseTime));eyeCutin.rotation.set(.04,-.13,mix(-.2,-.085,land));
   }else if(pose===1){
    eyeCutin.position.set(-viewW*.26,viewH*(mobile?.28:.22),-9);eyeCutin.scale.setScalar(closeScale*(mobile?.77:.66));eyeCutin.rotation.set(-.09,.22,-.23);
    const land=smooth((q-.32)/.12);portraitCutin.position.set(mix(viewW*.7,viewW*(mobile?.01:.18),land),-viewH*.025,-7.7);portraitCutin.scale.setScalar(portraitScale*mix(1.04,1,poseTime));portraitCutin.rotation.set(.055,-.19,.11);
   }else{
    const land=smooth((q-.64)/.16);eyeCutin.position.set(-viewW*(mobile?.24:.32),viewH*(mobile?.33:.25),-9.2);eyeCutin.scale.setScalar(closeScale*(mobile?.67:.57));eyeCutin.rotation.set(-.12,.24,-.21);
    portraitCutin.position.set(viewW*(mobile?.3:.34),-viewH*.24,-9.5);portraitCutin.scale.setScalar(portraitScale*.6);portraitCutin.rotation.set(.1,-.22,.21);
    heroCutin.position.set(mix(-viewW*.7,-viewW*.015,land),-viewH*.025,-7.5);heroCutin.scale.setScalar(heroScale*mix(.93,1,land));heroCutin.rotation.set(mix(.15,-.025,land),mix(-.3,.035,land),mix(-.18,-.025,land));
   }
   burst.position.x=pose===1?viewW*.16:0;burst.position.y=pose===0?viewH*.03:0;burst.rotation.z=pose*.42+Math.floor(q*12)*.013;burst.scale.setScalar(pose===0?1.15:pose===1?1.3:1.05+poseTime*.12);
   gutters.forEach((gutter,i)=>{gutter.visible=pose>0;gutter.position.set((i?1:-1)*viewW*.03,(i?1:-1)*viewH*(pose===1?.19:.3),-7.3);gutter.rotation.z=i?-.16:.12;});
  }else{
   const mobile=camera.aspect<.8,sway=mobile?.55:1,sweep=Math.sin(p*TAU),bank=Math.sin(p*Math.PI);
   scene.background=new THREE.Color(0x070e20);scene.fog??=new THREE.FogExp2(0x0c1830,.032);ambient.color.setHex(0x6c8bc8);ambient.intensity=.8;key.color.setHex(0xa6bce0);key.intensity=1.1;fill.color.setHex(0x43d9ec);fill.intensity=.35;
   camera.position.set((mix(.85,-.38,p)+sweep*.45)*sway,mix(1.6,2.15,p)+bank*.34,mix(13.2,-.35,p));camera.lookAt(mix(-.45,-.75,p)*sway,mix(2.3,1.9,p),-20);
   camera.rotation.z=(sweep*-.045+bank*.012)*sway;
   floor.material.uniforms.time.value=time;advisor.position.y=1.3+Math.sin(time*1.25)*.055;advisor.rotation.y=-.08+Math.sin(time*.55)*.09;thoughtMaterial.opacity=.2+smooth((p-.25)/.6)*.065+Math.sin(time*1.1)*.012;
   predictionMaterial.opacity=.18+smooth((p-.3)/.6)*.18;suggestion.material.opacity=.25+Math.sin(time*1.8)*.055;suggestion.rotation.z=time*.14;
   nightPanels.forEach(item=>{
    const drift=Math.sin(time*.7+item.phase);item.mesh.position.set(item.x+drift*.08,item.y+drift*.07,item.z+bank*.22);item.mesh.rotation.y=item.angle+drift*.035;
    item.edge.position.set(item.mesh.position.x,item.mesh.position.y,item.mesh.position.z+.9);
   });
   predictions.forEach((item,i)=>{item.marker.position.copy(item.curve.getPoint((time*.22+i*.28)%1));item.material.opacity=(i===1?.25:.12)*(.7+p*.3);});
   rainData.forEach((drop,i)=>{const y=((drop.y-time*9.4)%15+15)%15-.7,z=((drop.z+time*1.2+47)%55+55)%55-47,index=i*6;rainPositions[index]=drop.x;rainPositions[index+1]=y;rainPositions[index+2]=z;rainPositions[index+3]=drop.x-.045;rainPositions[index+4]=y+drop.len*(1+bank*.45);rainPositions[index+5]=z-.035;});rainGeometry.attributes.position.needsUpdate=true;
  }
  renderer.render(scene,camera);frame=requestAnimationFrame(render);
 }
 function start(character='emiliano',nextDirection='enter'){
  if(lost)return false;stop();id=character==='yoru'?'yoru':'emiliano';direction=nextDirection==='exit'?'exit':'enter';punk.visible=id==='emiliano';comic.visible=id==='emiliano';night.visible=id==='yoru';host.dataset.character=id;host.hidden=false;resize();running=true;startTime=performance.now();render(startTime);return true;
 }
 function stop(){running=false;cancelAnimationFrame(frame);frame=0;host.hidden=true;}
 function contextLost(event){event.preventDefault();lost=true;stop();host.classList.remove('has-3d');}
 canvas.addEventListener('webglcontextlost',contextLost,false);
 function dispose(){stop();canvas.removeEventListener('webglcontextlost',contextLost);const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(object=>{if(object.geometry)gs.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){ms.add(m);if(m.map)ts.add(m.map);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());renderer.dispose();canvas.remove();host.classList.remove('has-3d');}
 return{start,stop,dispose,resize,get state(){return{running,id,direction,lost,width,height,drawCalls:renderer.info.render.calls,advisor:id==='yoru'};}};
}
