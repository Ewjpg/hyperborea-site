import * as THREE from './vendor/three.module.min.js';
import {createCubeModel,FACES,FACE_INFO,faceForNormal} from './kle-cube-model.mjs?v=57';

const COLORS={U:'#f4f6fc',R:'#e24e52',F:'#2474e9',D:'#f3ce50',L:'#f3954d',B:'#46aa8c'};
const NAMES={U:'Верхняя',R:'Правая',F:'Передняя',D:'Нижняя',L:'Левая',B:'Задняя'};
const clamp01=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp01(t);return t*t*(3-2*t);};
const easeOutCubic=t=>1-Math.pow(1-clamp01(t),3);
const easeOutBack=t=>{t=clamp01(t)-1;return 1+2.4*t*t*t+1.4*t*t;};
const easeInOut=t=>{t=clamp01(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const AXES=['x','y','z'];
const spacing=1.025;
// Entrance: pieces fly in and assemble, then the cube visibly scrambles itself.
const INTRO_PIECE_MS=720,SOLVED_MS=980,SHATTER_MS=1150;
const hashOf=id=>Array.from(id).reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,7);
function roundedBox(size=.95,radius=.08){const geometry=new THREE.BoxGeometry(size,size,size,5,5,5),positions=geometry.attributes.position,half=size/2,core=half-radius,p=new THREE.Vector3(),base=new THREE.Vector3();for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);base.set(THREE.MathUtils.clamp(p.x,-core,core),THREE.MathUtils.clamp(p.y,-core,core),THREE.MathUtils.clamp(p.z,-core,core));p.sub(base).normalize().multiplyScalar(radius).add(base);positions.setXYZ(i,p.x,p.y,p.z);}geometry.computeVertexNormals();return geometry;}
function roundedSquare(path,h,r){path.moveTo(-h+r,-h);path.lineTo(h-r,-h);path.quadraticCurveTo(h,-h,h,-h+r);path.lineTo(h,h-r);path.quadraticCurveTo(h,h,h-r,h);path.lineTo(-h+r,h);path.quadraticCurveTo(-h,h,-h,h-r);path.lineTo(-h,-h+r);path.quadraticCurveTo(-h,-h,-h+r,-h);return path;}
function stickerShape(){const shape=roundedSquare(new THREE.Shape(),.395,.085);return new THREE.ExtrudeGeometry(shape,{depth:.015,bevelEnabled:true,bevelSegments:2,bevelSize:.012,bevelThickness:.009,steps:1,curveSegments:5});}
// A thin glowing border that hugs the edge of the selected face.
function frameShape(){const shape=roundedSquare(new THREE.Shape(),1.505,.1);shape.holes.push(roundedSquare(new THREE.Path(),1.44,.06));return new THREE.ShapeGeometry(shape,6);}

export function createKleRubik(host,{onComplete=()=>{},onError=()=>{},onChange=()=>{}}={}){
 if(!(host instanceof HTMLElement))throw new TypeError('A cube host is required.');
 const model=createCubeModel(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let renderer=null,canvas=null,context2d=null,fallback=false,disposed=false,running=false,started=false;
 let width=1,height=1,frame=0,phase='idle',selectedFace='F',moves=0,scramble=[],queue=[],turnAnimation=null,settleAt=0,shatterAt=0,introAt=0,introEnd=0;
 let solving=false,scrambling=false,completed=false,orbitX=.36,orbitY=-.56,spinX=0,spinY=0,pointer=null,drag=null,lastPick=0,hiddenAt=0,cameraZ=9,extraYaw=0;
 const oldTouchAction=host.style.touchAction;host.style.touchAction='none';
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
 const camera=new THREE.PerspectiveCamera(37,1,.1,100),cube=new THREE.Group();scene.add(cube);
 const bodyGeometry=roundedBox(),stickerGeometry=stickerShape(),selectionGeometry=frameShape();
 const bodyMaterial=new THREE.MeshPhysicalMaterial({color:0x17233b,roughness:.31,metalness:.07,clearcoat:.48,clearcoatRoughness:.29,transparent:true,opacity:1});
 const cubieMeshes=new Map(),stickers=[],materials=new Set([bodyMaterial]),raycaster=new THREE.Raycaster(),pickPoint=new THREE.Vector2();
 const frontNormal=new THREE.Vector3(0,0,1),normal=new THREE.Vector3(),dragPlane=new THREE.Plane(),dragPoint=new THREE.Vector3(),inverseRotation=new THREE.Quaternion();
 const ambient=new THREE.HemisphereLight(0xf7fbff,0xb3c8e5,2);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,4.1);key.position.set(-4,7,7);key.castShadow=true;key.shadow.mapSize.set(768,768);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.bias=-.0004;scene.add(key);
 const fill=new THREE.DirectionalLight(0x9dbffa,1.6);fill.position.set(5,1,-3);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xcfe0ff,1.2);rim.position.set(2,-3,-6);scene.add(rim);
 const floorGeometry=new THREE.PlaneGeometry(50,50),floorMaterial=new THREE.ShadowMaterial({opacity:.16});
 const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-2.08;floor.receiveShadow=true;scene.add(floor);
 // A ripple runs across the floor when the cube is solved.
 const waveGeometry=new THREE.RingGeometry(1.9,2.05,64),waveMaterial=new THREE.MeshBasicMaterial({color:0x2c7bff,transparent:true,opacity:0,depthWrite:false});
 const wave=new THREE.Mesh(waveGeometry,waveMaterial);wave.rotation.x=-Math.PI/2;wave.position.y=-2.07;wave.visible=false;scene.add(wave);
 const selectionMaterial=new THREE.MeshBasicMaterial({color:0x2c7bff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
 const selection=new THREE.Mesh(selectionGeometry,selectionMaterial);selection.renderOrder=2;cube.add(selection);
 let selectionOpacity=0;
 for(const cubie of model.cubies){
  const group=new THREE.Group();group.userData.id=cubie.id;
  const body=new THREE.Mesh(bodyGeometry,bodyMaterial);body.castShadow=true;body.receiveShadow=true;group.add(body);
  const stickerMeshes=cubie.stickers.map(sticker=>{
   const material=new THREE.MeshPhysicalMaterial({color:COLORS[sticker.color],roughness:.28,metalness:.015,clearcoat:.32,clearcoatRoughness:.32,transparent:true,opacity:1,emissive:0x000000});materials.add(material);
   const mesh=new THREE.Mesh(stickerGeometry,material);mesh.userData.color=sticker.color;mesh.userData.cubieId=cubie.id;group.add(mesh);stickers.push(mesh);return mesh;
  });
  group.userData.stickers=stickerMeshes;cube.add(group);cubieMeshes.set(cubie.id,group);
 }
 function placeSelection(){const info=FACE_INFO[selectedFace];normal.fromArray(info.normal);selection.position.copy(normal).multiplyScalar(1.512);selection.quaternion.setFromUnitVectors(frontNormal,normal);}
 function syncPose(){
  cube.updateMatrixWorld(true);
  for(const cubie of model.cubies){
   const group=cubieMeshes.get(cubie.id);if(group.parent!==cube)cube.attach(group);
   group.position.fromArray(cubie.position).multiplyScalar(spacing);group.rotation.set(0,0,0);group.scale.setScalar(1);
   cubie.stickers.forEach((sticker,i)=>{const mesh=group.userData.stickers[i];normal.fromArray(sticker.normal);mesh.position.copy(normal).multiplyScalar(.481);mesh.quaternion.setFromUnitVectors(frontNormal,normal);mesh.userData.face=faceForNormal(sticker.normal);mesh.material.emissive.setHex(mesh.userData.face===selectedFace?0x0d2a5c:0);mesh.material.emissiveIntensity=.2;mesh.material.opacity=1;});
  }
  bodyMaterial.opacity=1;placeSelection();
 }
 const busy=()=>!!turnAnimation||!!drag||solving||scrambling||['intro','solved','shattering'].includes(phase);
 function state(){return{running,busy:busy(),moves,solved:model.isSolved(),solving,scrambling,intro:phase==='intro',shattering:phase==='shattering',selectedFace,phase,history:model.history,scramble:scramble.map(move=>({...move})),facelets:model.facelets,framePending:!!frame,fallback,disposed,drawCalls:renderer?.info.render.calls??0};}
 function changed(){try{onChange(state());}catch{}}
 function styleCanvas(node){node.className='kle-rubik-canvas';node.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';node.setAttribute('role','img');node.setAttribute('aria-label','Кубик Рубика. Потяни за грань, чтобы повернуть её, или за фон, чтобы осмотреть кубик. Нажми грань, чтобы выбрать её.');}
 function createFallback(){
  cancelDrag();fallback=true;renderer?.dispose();renderer=null;canvas?.remove();canvas=document.createElement('canvas');styleCanvas(canvas);context2d=canvas.getContext('2d');host.append(canvas);if(!context2d){onError(new Error('Cube graphics unavailable.'));return false;}resize();changed();return true;
 }
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;canvas=renderer.domElement;styleCanvas(canvas);host.append(canvas);}catch{createFallback();}
 function resize(){if(disposed)return;const bounds=host.getBoundingClientRect();width=Math.max(1,bounds.width||innerWidth);height=Math.max(1,bounds.height||innerHeight);camera.aspect=width/height;const extent=camera.aspect<.75?5.7:4.3;cameraZ=Math.max(8.8,extent/(2*Math.tan(camera.fov*Math.PI/360)*camera.aspect));camera.position.set(0,.15,cameraZ);camera.lookAt(0,0,0);camera.updateProjectionMatrix();if(renderer)renderer.setSize(width,height,false);else if(canvas){const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context2d?.setTransform(dpr,0,0,dpr,0,0);}}
 function faceRects(){const cell=Math.min(width/13.7,height/11.3),side=cell*3,gap=cell*.15,boardW=side*4+gap*3,boardH=side*3+gap*2,left=(width-boardW)/2,top=(height-boardH)/2;return Object.fromEntries([['U',1,0],['L',0,1],['F',1,1],['R',2,1],['B',3,1],['D',1,2]].map(([face,x,y])=>[face,{x:left+x*(side+gap),y:top+y*(side+gap),side,cell}]));}
 function drawFallback(now){if(!context2d)return;const ctx=context2d;ctx.clearRect(0,0,width,height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);const faces=model.facelets,rects=faceRects(),explosion=phase==='shattering'?ease((now-shatterAt)/(motion.matches?160:850)):0;
  for(const face of FACES){const r=rects[face],dx=(r.x+r.side/2-width/2)*explosion*2.3,dy=(r.y+r.side/2-height/2)*explosion*2.3;ctx.save();ctx.globalAlpha=1-explosion;ctx.translate(r.x+dx,r.y+dy);ctx.fillStyle='#15233a';ctx.fillRect(-2,-2,r.side+4,r.side+4);for(let i=0;i<9;i++){ctx.fillStyle=COLORS[faces[face][i]];ctx.fillRect(i%3*r.cell+2,Math.floor(i/3)*r.cell+2,r.cell-4,r.cell-4);}if(face===selectedFace){ctx.strokeStyle='#155de2';ctx.lineWidth=3;ctx.strokeRect(-5,-5,r.side+10,r.side+10);}ctx.restore();}
 }
 function layerPivot(axis,layer){const pivot=new THREE.Group(),groups=[];cube.updateMatrixWorld(true);cube.add(pivot);pivot.updateMatrixWorld(true);for(const cubie of model.cubies)if(cubie.position[axis]===layer){const group=cubieMeshes.get(cubie.id);pivot.attach(group);groups.push(group);}return{pivot,groups};}
 function beginTurn(face,quarter=1,duration=260,automatic=false){
  if(!FACE_INFO[face]||!Number.isInteger(quarter))return false;
  const amount=((quarter%4)+4)%4;if(!amount)return false;
  const turn=amount===3?-1:amount,info=FACE_INFO[face],{pivot,groups}=layerPivot(info.axis,info.layer);
  // Manual turns snap with a small overshoot; automatic ones stay smooth.
  turnAnimation={face,quarter:turn,pivot,groups,axis:AXES[info.axis],from:0,angle:info.sign*turn*Math.PI/2,started:performance.now(),duration:motion.matches?1:duration,automatic,easing:automatic?ease:easeOutBack};phase=automatic?(scrambling?'scrambling':'solving'):'turn';changed();return true;
 }
 function finishTurn(){const animation=turnAnimation;if(!animation)return;turnAnimation=null;const turned=!!animation.quarter&&model.turn(animation.face,animation.quarter);syncPose();cube.remove(animation.pivot);if(turned&&!animation.automatic)moves++;if(turned&&!scrambling&&model.isSolved()){queue=[];solving=false;phase='solved';settleAt=performance.now();}else phase=solving?'solving':scrambling?'scrambling':'play';changed();}
 function beginIntro(now){
  phase='intro';introAt=now;introEnd=0;
  for(const group of cubieMeshes.values()){
   const target=group.position.clone(),n=hashOf(group.userData.id),out=target.clone().normalize();
   // Bottom layer lands first, the top layer last.
   const delay=(target.y/spacing+1)*135+(n%7)*22;introEnd=Math.max(introEnd,delay+INTRO_PIECE_MS);
   group.userData.intro={target,delay,from:target.clone().addScaledVector(out,5+(n%5)*.7).add(new THREE.Vector3(Math.sin(n)*1.4,2.6+(n%3)*.8,Math.cos(n)*1.4)),spin:new THREE.Vector3(Math.sin(n*1.3)*3.2,Math.cos(n*.9)*3.2,Math.sin(n*.4)*2.4)};
  }
  changed();
 }
 function renderIntro(now){
  const elapsed=now-introAt;
  for(const group of cubieMeshes.values()){const {target,from,spin,delay}=group.userData.intro,t=easeOutCubic((elapsed-delay)/INTRO_PIECE_MS);group.position.lerpVectors(from,target,t);group.rotation.set(spin.x*(1-t),spin.y*(1-t),spin.z*(1-t));group.scale.setScalar(.55+.45*t);}
  if(elapsed>=introEnd){syncPose();scrambling=true;phase='scrambling';queue=scramble.map(move=>({...move}));changed();}
 }
 function beginShatter(now){phase='shattering';shatterAt=now;extraYaw=0;cube.scale.setScalar(1);wave.visible=false;for(const group of cubieMeshes.values()){const n=hashOf(group.userData.id),direction=group.position.clone().normalize();group.userData.shatter={start:group.position.clone(),velocity:direction.multiplyScalar(5.2+(n%9)*.35).add(new THREE.Vector3(0,3.4+(n%5)*.5,0)),spin:new THREE.Vector3(Math.sin(n)*4.2,Math.cos(n*.7)*4.2,Math.sin(n*.5)*3.2)};}changed();}
 function complete(){if(completed||disposed)return;completed=true;running=false;phase='complete';cancelAnimationFrame(frame);frame=0;changed();onComplete();}
 function setStickerGlow(amount){for(const mesh of stickers){mesh.material.emissive.setHex(0xffffff);mesh.material.emissiveIntensity=amount;}}
 function render(now){frame=0;if(!running||disposed)return;if(document.hidden){if(!hiddenAt)hiddenAt=now;return;}
  if(!pointer&&(Math.abs(spinX)>1e-4||Math.abs(spinY)>1e-4)){orbitY+=spinY;orbitX=THREE.MathUtils.clamp(orbitX+spinX,-1.35,1.35);spinX*=.9;spinY*=.9;}
  cube.rotation.set(orbitX,orbitY+extraYaw,0);if(phase!=='shattering')cube.position.y=motion.matches?0:Math.sin(now*.0011)*.055;
  camera.position.z=phase==='intro'?cameraZ*(1+.3*(1-easeOutCubic((now-introAt)/(introEnd||1)))):cameraZ;camera.lookAt(0,0,0);
  if(phase==='intro')renderIntro(now);
  if(turnAnimation){const t=Math.min(1,(now-turnAnimation.started)/turnAnimation.duration);turnAnimation.pivot.rotation[turnAnimation.axis]=turnAnimation.from+(turnAnimation.angle-turnAnimation.from)*turnAnimation.easing(t);if(t>=1)finishTurn();}
  if((solving||scrambling)&&!turnAnimation&&queue.length){const next=queue.shift();beginTurn(next.face,next.quarter,scrambling?170:Math.max(45,Math.min(160,1500/Math.max(1,queue.length+1))),true);}
  if(scrambling&&!turnAnimation&&!queue.length){scrambling=false;phase='play';changed();}
  const showSelection=['play','turn'].includes(phase)&&!fallback;selectionOpacity+=((showSelection?.55+Math.sin(now*.004)*.15:0)-selectionOpacity)*.18;selectionMaterial.opacity=selectionOpacity;selection.visible=selectionOpacity>.01;
  if(phase==='solved'){
   if(motion.matches){if(now-settleAt>=30)beginShatter(now);}
   else{
    // Victory: one full spin, a soft pulse, a white flash over the stickers and a ripple on the floor.
    const t=(now-settleAt)/SOLVED_MS;extraYaw=easeInOut(t)*Math.PI*2;cube.scale.setScalar(1+Math.sin(clamp01(t)*Math.PI)*.07);
    setStickerGlow(Math.sin(clamp01(t*1.5)*Math.PI)*.22);
    wave.visible=true;wave.scale.setScalar(1+easeOutCubic(t)*1.5);waveMaterial.opacity=.32*(1-clamp01(t));
    if(t>=1)beginShatter(now);
   }
  }
  if(phase==='shattering'){const duration=motion.matches?160:SHATTER_MS,t=Math.min(1,(now-shatterAt)/duration),seconds=(now-shatterAt)/1000;
   if(!motion.matches){for(const group of cubieMeshes.values()){const {start,velocity,spin}=group.userData.shatter;group.position.copy(start).addScaledVector(velocity,seconds);group.position.y-=9*seconds*seconds;group.rotation.set(spin.x*seconds,spin.y*seconds,spin.z*seconds);group.scale.setScalar(1-.35*t);}}
   const opacity=motion.matches?1-t:1-clamp01((t-.3)/.7);for(const material of materials)material.opacity=opacity;if(t>=1){complete();return;}}
  if(renderer)renderer.render(scene,camera);else drawFallback(now);
  frame=requestAnimationFrame(render);
 }
 const canPlay=()=>running&&!disposed&&!turnAnimation&&!drag&&phase==='play';
 function selectFace(face){if(!FACE_INFO[face]||disposed||drag||solving||scrambling||['intro','solved','shattering'].includes(phase))return false;selectedFace=face;if(!turnAnimation)syncPose();else placeSelection();changed();return true;}
 function turn(face=selectedFace,quarter=1){if(!canPlay())return false;selectedFace=face;placeSelection();return beginTurn(face,quarter);}
 function undo(){if(!canPlay())return false;const previous=model.history.at(-1);if(!previous)return false;selectedFace=previous.face;placeSelection();return beginTurn(previous.face,previous.quarter===2?2:-previous.quarter);}
 function autoSolve(){if(!running||disposed||solving||scrambling||['intro','solved','shattering'].includes(phase))return false;
  cancelDrag();if(turnAnimation)finishTurn();
  solving=true;phase='solving';queue=model.inverse;
  // Long play histories are still reversed legally, then the last few turns
  // are shown in full so skipping always finishes within a few seconds.
  while(queue.length>12){const move=queue.shift();model.turn(move.face,move.quarter);}syncPose();
  if(model.isSolved()){solving=false;phase='solved';settleAt=performance.now();}
  changed();return true;
 }
 function localPoint(event){const bounds=canvas.getBoundingClientRect();return{x:(event.clientX-bounds.left)/bounds.width*width,y:(event.clientY-bounds.top)/bounds.height*height};}
 function aim(event){const p=localPoint(event);pickPoint.set(p.x/width*2-1,-p.y/height*2+1);raycaster.setFromCamera(pickPoint,camera);}
 function stickerAt(event){if(fallback)return null;cube.updateMatrixWorld(true);aim(event);const hit=raycaster.intersectObjects(stickers,false)[0];if(!hit?.object.userData.face)return null;const face=hit.object.userData.face,faceNormal=new THREE.Vector3().fromArray(FACE_INFO[face].normal);dragPlane.setFromNormalAndCoplanarPoint(faceNormal.clone().applyQuaternion(cube.quaternion),hit.point);return{face,normal:faceNormal,start:hit.point.clone(),position:cubieMeshes.get(hit.object.userData.cubieId).position.clone().divideScalar(spacing).round()};}
 function pick(event){if(disposed||!running||solving||phase==='shattering')return;if(fallback){const p=localPoint(event);for(const[face,r]of Object.entries(faceRects()))if(p.x>=r.x&&p.x<=r.x+r.side&&p.y>=r.y&&p.y<=r.y+r.side){selectFace(face);break;}return;}const hit=stickerAt(event);if(hit)selectFace(hit.face);}
 // Drag along a face to turn the layer under the finger. The middle slice is not a face turn, so it orbits instead.
 function dragDelta(event){aim(event);if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return null;inverseRotation.copy(cube.quaternion).invert();return dragPoint.clone().sub(pointer.hit.start).applyQuaternion(inverseRotation);}
 function beginDrag(event){
  const hit=pointer.hit,delta=hit&&dragDelta(event);if(!delta)return false;
  delta.addScaledVector(hit.normal,-delta.dot(hit.normal));
  let along=-1,best=0;for(let i=0;i<3;i++){if(Math.abs(hit.normal.getComponent(i))>.5)continue;const value=Math.abs(delta.getComponent(i));if(value>best){best=value;along=i;}}
  if(along<0)return false;
  const direction=new THREE.Vector3().setComponent(along,1),spin=new THREE.Vector3().crossVectors(hit.normal,direction);
  const axis=[0,1,2].find(i=>Math.abs(spin.getComponent(i))>.5),layer=Math.round(hit.position.getComponent(axis));
  if(!layer)return false;
  const face=FACES.find(name=>FACE_INFO[name].axis===axis&&FACE_INFO[name].layer===layer);
  selectedFace=face;syncPose();
  drag={face,axis,sign:Math.sign(spin.getComponent(axis)),direction,angle:0,...layerPivot(axis,layer)};phase='turn';changed();return true;
 }
 function moveDrag(event){const delta=dragDelta(event);if(!delta)return;drag.angle=THREE.MathUtils.clamp(drag.sign*delta.dot(drag.direction)*.95,-Math.PI,Math.PI);drag.pivot.rotation[AXES[drag.axis]]=drag.angle;}
 function releaseDrag(){
  const current=drag;drag=null;const quarterAngle=Math.PI/2;
  let q=Math.round(current.angle/quarterAngle);if(!q&&Math.abs(current.angle)>.32)q=Math.sign(current.angle);q=Math.max(-2,Math.min(2,q));
  const target=q*quarterAngle;
  turnAnimation={face:current.face,quarter:q*FACE_INFO[current.face].sign,pivot:current.pivot,groups:current.groups,axis:AXES[current.axis],from:current.angle,angle:target,started:performance.now(),duration:motion.matches?1:Math.max(90,Math.abs(target-current.angle)/quarterAngle*200),automatic:false,easing:easeOutCubic};
  changed();
 }
 function cancelDrag(){if(!drag)return;const pivot=drag.pivot;drag=null;syncPose();cube.remove(pivot);if(phase==='turn')phase='play';}
 function down(event){if(!running||solving||phase==='shattering'||phase==='solved'||event.button>0)return;spinX=spinY=0;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,mode:null,hit:canPlay()?stickerAt(event):null};host.setPointerCapture?.(event.pointerId);event.preventDefault();}
 function move(event){if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
  if(!pointer.mode&&Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>7)pointer.mode=pointer.hit&&canPlay()&&beginDrag(event)?'turn':'orbit';
  if(pointer.mode==='turn'&&drag)moveDrag(event);
  else if(pointer.mode==='orbit'&&!fallback){spinY=dx*.009;spinX=dy*.008;orbitY+=spinY;orbitX=THREE.MathUtils.clamp(orbitX+spinX,-1.35,1.35);}
  pointer.x=event.clientX;pointer.y=event.clientY;event.preventDefault();}
 function up(event){if(!pointer||pointer.id!==event.pointerId)return;const mode=pointer.mode;host.releasePointerCapture?.(event.pointerId);if(mode==='turn'&&drag)releaseDrag();else if(!mode&&performance.now()-lastPick>80){lastPick=performance.now();pick(event);}if(mode!=='orbit'||motion.matches)spinX=spinY=0;pointer=null;}
 function cancel(){if(drag)releaseDrag();pointer=null;}
 function contextLost(event){event.preventDefault();if(disposed)return;createFallback();}
 host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',cancel);
 canvas?.addEventListener('webglcontextlost',contextLost);
 function visibility(){
  if(document.hidden){if(running){hiddenAt=performance.now();cancelAnimationFrame(frame);frame=0;if(drag)releaseDrag();pointer=null;}}
  else if(running&&!disposed){const now=performance.now(),gap=hiddenAt?now-hiddenAt:0;if(turnAnimation)turnAnimation.started+=gap;if(phase==='intro')introAt+=gap;if(phase==='solved')settleAt+=gap;if(phase==='shattering')shatterAt+=gap;hiddenAt=0;if(!frame)render(now);}
 }
 document.addEventListener('visibilitychange',visibility);
 const observer=new ResizeObserver(resize);observer.observe(host);
 function start(){if(disposed)return false;if(running)return true;completed=false;running=true;resize();
  if(!started){started=true;
   if(motion.matches||fallback){scramble=model.scramble(4);syncPose();phase='play';}
   else{scramble=createCubeModel().scramble(4);syncPose();beginIntro(performance.now());}
  }else phase='play';
  changed();render(performance.now());return true;}
 function stop(){running=false;cancelAnimationFrame(frame);frame=0;hiddenAt=0;pointer=null;cancelDrag();
  // Finish an interrupted entrance instantly so the cube stays a legal scramble.
  if(turnAnimation){const pivot=turnAnimation.pivot,pending=turnAnimation.automatic&&scrambling?turnAnimation:null;turnAnimation=null;if(pending)model.turn(pending.face,pending.quarter);cube.remove(pivot);}
  if(phase==='intro')queue=scramble.map(move=>({...move}));
  if(phase==='intro'||scrambling)for(const move of queue)model.turn(move.face,move.quarter);
  queue=[];solving=false;scrambling=false;extraYaw=0;cube.scale.setScalar(1);syncPose();if(phase!=='complete')phase='idle';changed();}
 function dispose(){if(disposed)return;stop();disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',cancel);canvas?.removeEventListener('webglcontextlost',contextLost);renderer?.dispose();const geometries=new Set([bodyGeometry,stickerGeometry,floorGeometry,selectionGeometry,waveGeometry]);geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());floorMaterial.dispose();selectionMaterial.dispose();waveMaterial.dispose();canvas?.remove();host.style.touchAction=oldTouchAction;changed();}
 resize();
 return{start,turn,undo,selectFace,autoSolve,stop,resize,dispose,get state(){return state();}};
}
