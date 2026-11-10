import * as THREE from './vendor/three.module.min.js';
import {createDarknessModel,CHUNK,random} from './fear-darkness-model.mjs?v=1';

// FEAR's way in: black threads rise out of a pool, wrap around the viewer and drag them under.
// Below waits a fear chosen at random — for now only darkness: an endless black field
// where a white eye hides, twice slips away deeper, and the third time lets itself be touched.
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const lerp=(a,b,t)=>a+(b-a)*t;
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// A yaw θ looks along (-sin θ, -cos θ); this is the yaw that faces a direction.
const yawOf=(dx,dz)=>Math.atan2(-dx,-dz);

export const OPENING={grab:4.6,pull:4.95,dive:6.2,end:7.2};
// Listening is rationed, so the echo cannot simply be spammed all the way to the eye.
const TITLE=2.8,LISTEN_COOLDOWN=12,EYE_HEIGHT=2.25,EYE_LIFT=34,HEAD=1.7;
// The flashlight runs on a battery: about 26 s of light, then it dies and stays dead until fully
// recharged (9 s of total dark). Switching it off by hand (F) recharges it too.
const BATTERY={drain:1/26,charge:1/9,low:.18,relight:.35};
// Spin round fast enough and a hand is right there at your back — then it snaps away into the dark.
const HAND={turn:2,window:.45,reach:.95,cooldown:20,hold:.16,retreat:.4};
const ESCAPE={close:.16,lift:.2,gone:.95,burst:.55,move:1.9,lightBack:2.15,caption:2.5,end:3.2};
const CAPTIONS=['ОН УШЁЛ ГЛУБЖЕ','ОН ВСЁ ЕЩЁ СМОТРИТ'];
const FLOOR=144,FLOOR_TILE=8,RANGE=2,THREAD_TOP=24,FLASH=58;

// A tapered tube whose spine is rebuilt every frame from a handful of control points.
class LivingThread{
  constructor(material,{segments=64,sides=10,radius=.1,flare=0,taper=.62}={}){
    Object.assign(this,{segments,sides,radius,flare,taper});
    const count=(segments+1)*(sides+1),geometry=new THREE.BufferGeometry(),index=[];
    this.position=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
    this.normal=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position',this.position);geometry.setAttribute('normal',this.normal);
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1);}
    geometry.setIndex(index);
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;
    this.points=Array.from({length:segments+1},()=>new THREE.Vector3());
    this.controls=[];this.curve=new THREE.CatmullRomCurve3(this.controls,false,'centripetal');
    this.tangent=new THREE.Vector3();this.last=new THREE.Vector3(0,1,0);this.n=new THREE.Vector3();this.b=new THREE.Vector3();this.turn=new THREE.Quaternion();
  }
  // growth (0–1) reveals the thread from root to tip; time and phase ripple its surface.
  update(controls,growth=1,time=0,phase=0,thickness=1){
    this.controls.length=0;this.controls.push(...controls);
    const {segments:S,sides:R,points}=this,shown=clamp(growth,.002,1);
    for(let i=0;i<=S;i++)this.curve.getPoint(i/S*shown,points[i]);
    for(let i=0;i<=S;i++){
      const p=points[i];
      this.tangent.subVectors(points[Math.min(S,i+1)],points[Math.max(0,i-1)]);
      if(this.tangent.lengthSq()<1e-12)this.tangent.copy(this.last);
      this.tangent.normalize();
      if(i===0){
        const vertical=Math.abs(this.tangent.y)>.9;
        this.n.set(vertical?1:0,vertical?0:1,0).addScaledVector(this.tangent,-(vertical?this.tangent.x:this.tangent.y)).normalize();
      }else{this.turn.setFromUnitVectors(this.last,this.tangent);this.n.applyQuaternion(this.turn).normalize();}
      this.b.crossVectors(this.tangent,this.n);this.last.copy(this.tangent);
      const u=i/S,ripple=1+.055*Math.sin(u*16-time*3.4+phase)+.025*Math.sin(u*37+time*1.9+phase);
      const r=this.radius*thickness*Math.pow(Math.max(.003,1-u),this.taper)*ripple*(1+this.flare*Math.exp(-u*14));
      for(let j=0;j<=R;j++){
        const a=j/R*TAU,c=Math.cos(a),s=Math.sin(a),k=i*(R+1)+j;
        const nx=this.n.x*c+this.b.x*s,ny=this.n.y*c+this.b.y*s,nz=this.n.z*c+this.b.z*s;
        this.position.setXYZ(k,p.x+nx*r,p.y+ny*r,p.z+nz*r);this.normal.setXYZ(k,nx,ny,nz);
      }
    }
    this.position.needsUpdate=this.normal.needsUpdate=true;this.mesh.visible=growth>.003;
  }
}

function merge(list){
  let vertices=0,indices=0;
  for(const g of list){vertices+=g.attributes.position.count;indices+=g.index.count;}
  const position=new Float32Array(vertices*3),normal=new Float32Array(vertices*3),index=new Uint32Array(indices);
  let v=0,i=0;
  for(const g of list){
    position.set(g.attributes.position.array,v*3);normal.set(g.attributes.normal.array,v*3);
    for(const k of g.index.array)index[i++]=k+v;
    v+=g.attributes.position.count;g.dispose();
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.BufferAttribute(position,3));out.setAttribute('normal',new THREE.BufferAttribute(normal,3));out.setIndex(new THREE.BufferAttribute(index,1));
  return out;
}
function roundedBox(radius){
  const g=new THREE.BoxGeometry(1,1,1,4,8,4),p=g.attributes.position,v=new THREE.Vector3(),d=new THREE.Vector3(),core=.5-radius;
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const cx=clamp(v.x,-core,core),cy=clamp(v.y,-core,core),cz=clamp(v.z,-core,core);
    d.set(v.x-cx,v.y-cy,v.z-cz);if(d.lengthSq())d.normalize().multiplyScalar(radius);
    p.setXYZ(i,cx+d.x,cy+d.y,cz+d.z);
  }
  g.computeVertexNormals();g.translate(0,.5,0);return g;
}
// Strands twisted around each other, splaying into roots at the floor. Built 16 m tall.
function twistedColumn(strands,spread,radius){
  const parts=[];
  for(let k=0;k<strands;k++){
    const a0=k/strands*TAU,pts=[new THREE.Vector3(Math.cos(a0)*spread*3.4,-.05,Math.sin(a0)*spread*3.4)];
    for(let i=1;i<=40;i++){const y=i/40*16,a=a0+y*.5,s=spread*(1+.3*Math.sin(y*.8+k*2));pts.push(new THREE.Vector3(Math.cos(a)*s,y,Math.sin(a)*s));}
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),72,radius,6,false));
  }
  return merge(parts);
}
// A bent black limb with a thinner vine around it; feet 5 m apart.
function archGeometry(){
  const main=[],vine=[];
  for(let i=0;i<=24;i++){const a=i/24*Math.PI;main.push(new THREE.Vector3(-Math.cos(a)*2.5,Math.sin(a)*4.4-.15,Math.sin(a*3)*.12));}
  for(let i=0;i<=90;i++){const s=i/90,a=s*Math.PI,w=s*TAU*6;vine.push(new THREE.Vector3(-Math.cos(a)*(2.5+Math.cos(w)*.26),Math.sin(a)*(4.4+Math.cos(w)*.26)-.15,Math.sin(w)*.26));}
  return merge([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(main),90,.2,10,false),new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vine),180,.05,6,false)]);
}
function rootGeometry(variant){
  const r=random(911+variant*97),pts=[];let x=0,z=0,a=r()*TAU;
  for(let i=0;i<7;i++){pts.push(new THREE.Vector3(x,i?.03+r()*.05:.1,z));a+=(r()-.5)*1.1;const step=.5+r()*.6;x+=Math.cos(a)*step;z+=Math.sin(a)*step;}
  const thread=new LivingThread(null,{segments:48,sides:7,radius:.07+variant*.02,flare:.9,taper:.8});
  thread.update(pts);return thread.mesh.geometry;
}
function hangingThread(){const g=new THREE.CylinderGeometry(.018,.011,1,5,1,true);g.translate(0,-.5,0);return g;}

function canvasTexture(size,draw){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'));
  return new THREE.CanvasTexture(canvas);
}
function floorTexture(){
  const texture=canvasTexture(512,g=>{
    const r=random(42118);g.fillStyle='#707070';g.fillRect(0,0,512,512);
    for(let i=0;i<16000;i++){const v=65+Math.floor(r()*110);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(r()*512,r()*512,1+r()*2,1);}
    for(let i=0;i<70;i++){g.strokeStyle=`rgba(185,185,185,${.05+r()*.18})`;g.lineWidth=.4;g.beginPath();const x=r()*512,y=r()*512;g.moveTo(x,y);g.lineTo(x+r()*60,y+r()*100);g.stroke();}
    // Worn seams between large tiles: in the dark they are what tells you that you are moving.
    g.strokeStyle='#262626';g.lineWidth=3;g.strokeRect(1.5,1.5,509,509);
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}
function glowTexture(){
  const texture=canvasTexture(128,g=>{
    const gradient=g.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.18,'rgba(225,236,255,.55)');gradient.addColorStop(.5,'rgba(170,190,230,.12)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gradient;g.fillRect(0,0,128,128);
  });
  texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
// Soft studio panels reflected in every glossy black surface.
function studioEnvironment(renderer){
  const room=new THREE.Scene();room.background=new THREE.Color(0x080c14);
  for(const [x,y,z,w,h] of [[-8,4,3,6,10],[7,5,-3,5,10],[0,10,0,12,3]]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0x839bb4,side:THREE.DoubleSide}));
    panel.position.set(x,y,z);panel.lookAt(0,1,0);room.add(panel);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),texture=pmrem.fromScene(room,.05).texture;
  pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return texture;
}

// ── The opening: a tar pool, tendons, and threads that latch onto the viewer ─────────────────
function createOpening(){
  const group=new THREE.Group(),lights=new THREE.Group(),r=random(627181),geometries=[],materials=[];
  const mat=o=>{const m=new THREE.MeshPhysicalMaterial(o);materials.push(m);return m;};
  const mesh=(geometry,material)=>{geometries.push(geometry);const m=new THREE.Mesh(geometry,material);group.add(m);return m;};
  const skin=mat({color:0x030406,roughness:.205,metalness:.39,clearcoat:1,clearcoatRoughness:.115,envMapIntensity:1.75});
  const sinew=mat({color:0x07090b,roughness:.25,metalness:.49,clearcoat:.8,clearcoatRoughness:.15,envMapIntensity:1.45});
  const tar=mat({color:0x020304,roughness:.12,metalness:.58,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.7});
  mesh(new THREE.CylinderGeometry(3.25,3.08,.075,112),tar).position.y=.015;
  const blobs=[],ripples=[],tendons=[],helix=[];
  for(let i=0;i<8;i++){
    const a=i/8*TAU,blob=mesh(new THREE.SphereGeometry(.72+r()*.2,26,16),skin);
    blob.position.set(Math.cos(a)*(.8+r()*.45),.1+r()*.1,Math.sin(a)*(.6+r()*.4));
    blobs.push({blob,rest:new THREE.Vector3(1.15+r()*.3,.18+r()*.12,.8+r()*.35),phase:r()*TAU});
  }
  for(let i=0;i<5;i++){const ring=mesh(new THREE.TorusGeometry(.7+i*.44,.022,6,112),sinew);ring.rotation.x=Math.PI/2;ring.position.y=.061;ripples.push({ring,phase:r()*TAU});}
  // Once the threads have the viewer, a hole opens in the middle of the pool: that is where they pull.
  const glowing=()=>new THREE.MeshBasicMaterial({color:0xc4d3ea,transparent:true,opacity:0,fog:false,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const voidMaterial=new THREE.MeshBasicMaterial({color:0x000000,fog:false}),rimMaterial=glowing(),haloMaterial=glowing();
  materials.push(voidMaterial,rimMaterial,haloMaterial);
  const hole=new THREE.Group();hole.position.y=.09;hole.rotation.x=-Math.PI/2;group.add(hole);
  for(const [geometry,material] of [[new THREE.CircleGeometry(1,64),voidMaterial],[new THREE.RingGeometry(1,1.012,128),rimMaterial],[new THREE.RingGeometry(1.012,1.09,128),haloMaterial]]){geometries.push(geometry);hole.add(new THREE.Mesh(geometry,material));}
  // Half the thick tendons and most fine threads latch onto the viewer; the rest close over the pool.
  for(let i=0;i<16;i++)tendons.push({thread:new LivingThread(skin,{segments:64,sides:10,radius:.21+r()*.15,flare:.5}),angle:i/16*TAU+(r()-.5)*.2,phase:r()*TAU,delay:.42+r()*.7,base:.65+r()*1.12,height:r()*.75,breadth:r()*.65,reach:r()*.75,attach:i%2?Infinity:OPENING.grab+r()*.1,ring:i/16*TAU+r()*.3});
  for(let i=0;i<26;i++)tendons.push({fine:true,thread:new LivingThread(sinew,{segments:44,sides:6,radius:.035+r()*.045}),angle:i/26*TAU+(r()-.5)*.3,phase:r()*TAU,delay:.65+r()*1.05,base:.5+r()*1.6,height:r()*1.15,breadth:.2+r()*1.1,reach:.2+r()*1.05,attach:i%3===2?Infinity:3.7+r()*1.15,ring:r()*TAU});
  for(let i=0;i<3;i++)helix.push({thread:new LivingThread(sinew,{segments:120,sides:6,radius:.034,taper:.35}),offset:i/3*TAU});
  for(const t of [...tendons,...helix]){group.add(t.thread.mesh);geometries.push(t.thread.mesh.geometry);}
  // The prototype's cold studio light, unchanged: it already made the tar read beautifully.
  const key=new THREE.DirectionalLight(0xb5c4d9,1.5);key.position.set(-7,15,6);
  const back=new THREE.DirectionalLight(0x667e9e,1.8);back.position.set(4,9,-15);
  const rimA=new THREE.PointLight(0xd5dfed,75,26,2);rimA.position.set(-3,5,5);
  const rimB=new THREE.PointLight(0x7d95ad,60,23,2);rimB.position.set(3,4,-2);
  lights.add(new THREE.HemisphereLight(0xa4b3c9,0x10121a,.43),key,back,rimA,rimB);group.add(lights);

  const P=Array.from({length:7},()=>new THREE.Vector3()),H=Array.from({length:14},()=>new THREE.Vector3());
  const cam=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),tmp=new THREE.Vector3(),look=new THREE.Vector3();
  const POOL=new THREE.Vector3(0,.1,0);

  function tendon(spec,t){
    const fine=spec.fine,a=spec.angle,c=Math.cos(a),s=Math.sin(a);
    const rise=smoother((t-spec.delay)/(fine?1.6:1.8)),coil=smoother((t-2.3-spec.delay*.25)/2.1),close=smoother((t-OPENING.pull-spec.delay*.1)/1.1);
    const sway=Math.sin(t*1.55+spec.phase)*.15,wob=Math.sin(t*2.5+spec.phase)*(.1+coil*.1);
    const h=2.25+s*1.4+spec.height,reach=lerp(1.65+.4*Math.sin(spec.phase),5.7+spec.reach,coil);
    P[0].set(c*spec.base,.025,s*spec.base*.7);
    P[1].set(c*(spec.base+.25),.28+rise*.5,s*spec.base*.65);
    P[2].set(Math.cos(a+.54+sway)*(1.2+spec.breadth),.8+rise*(1.1+spec.height),Math.sin(a+.54+sway)*.95+.1);
    P[3].set(c*(1.7+spec.breadth)+Math.sin(t*1.2+spec.phase)*.13,h+Math.sin(spec.phase)*.55,lerp(s*1.1+.15,1.8,coil));
    P[4].set(c*lerp(2.25+spec.breadth,1.85,coil),h+Math.sin(a+1.2)*.7,lerp(s*1.3+.8,3.2+spec.reach*.15,coil));
    P[5].set(c*lerp(2.45+spec.breadth,1.3,coil)+wob,lerp(h+c*.5,2.5+s*.9,coil),reach-.55);
    P[6].set(c*lerp(2,.75,coil)+wob,lerp(1.95+s*.9+spec.height,2.45+s*.8,coil),reach);
    if(fine)for(let i=1;i<7;i++){P[i].x+=Math.sin(t*1.6+spec.phase+i*1.1)*.22;P[i].y+=Math.cos(t*1.8+spec.phase+i)*.17;}
    const grab=smoother((t-spec.attach)/(fine?.6:.42));
    if(grab>0){
      // The tip wraps around the viewer, then the thread pulls taut and hums.
      const rho=fine?.62:.9,cx=Math.cos(spec.ring),cy=Math.sin(spec.ring)*.78,taut=smooth((t-spec.attach-.25)/.5),buzz=Math.sin(t*38+spec.phase)*.035*taut;
      tmp.copy(cam).addScaledVector(right,cx*rho).addScaledVector(up,cy*rho).addScaledVector(fwd,-.35);P[6].lerp(tmp,grab);
      tmp.copy(cam).addScaledVector(right,cx*rho*1.2).addScaledVector(up,cy*rho*1.2).addScaledVector(fwd,1);P[5].lerp(tmp,grab);
      tmp.lerpVectors(P[0],cam,.62).addScaledVector(right,cx*rho*.7+buzz).addScaledVector(up,cy*rho*.7-(1-taut)*.45);P[4].lerp(tmp,grab*.9);
      tmp.lerpVectors(P[0],cam,.34).addScaledVector(right,cx*.35).addScaledVector(up,buzz-(1-taut)*.3);P[3].lerp(tmp,grab*.7);
    }else if(close>0){
      // Free tendons are sucked back down into the opening hole.
      P[6].lerp(tmp.set(c*.35,.12,s*.35),close);P[5].lerp(tmp.set(c*.9,.8,s*.9),close*.85);P[4].lerp(tmp.set(c*1.3,1.4,s*1.1),close*.6);
    }
    spec.thread.update(P,(.004+.996*rise)*(1-close*.55*(spec.attach<Infinity?0:1)),t,spec.phase);
  }

  function placeCamera(t,camera,shake){
    const settle=smooth(t/4.6),lean=smooth((t-3.3)/.9)*(1-smooth((t-4.58)/.1)),jerk=smooth((t-4.6)/.16);
    const pull=Math.pow(clamp((t-OPENING.pull)/1.6),2.2);
    camera.position.set(lerp(Math.sin(t*.45)*.28,0,pull),lerp(lerp(2.95,2.45,settle)+lean*.12,-.9,pull),lerp(lerp(8.6,5.75,settle)+lean*.45-jerk*.5,.15,pull));
    camera.lookAt(look.set(0,lerp(lerp(1.1,1.5,settle),-5,pull),lerp(0,-.4,pull)));
    camera.fov=lerp(lerp(47,40,smooth((t-4.05)/.55)),104,pull);
    if(shake){
      const k=.006+lean*.012+(t>OPENING.grab?.075*Math.exp(-(t-OPENING.grab)*6):0)+.035*pull;
      camera.position.x+=(Math.sin(t*37.1)+Math.sin(t*23.7)*.5)*k;camera.position.y+=Math.sin(t*41.3+1)*k*.8;
    }
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    cam.copy(camera.position);camera.getWorldDirection(fwd);
    right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);
  }

  function update(t,camera,shake=true){
    placeCamera(t,camera,shake);
    const open=smooth((t-OPENING.grab+.15)/1.3);
    // The blobs in the middle drain away as the hole opens.
    for(const {blob,rest,phase} of blobs){blob.scale.copy(rest);blob.scale.y*=1+Math.sin(t*2.1+phase)*.15+smoother((t-.25)/1.5)*.35;blob.scale.multiplyScalar(Math.max(.001,1-open*1.1));}
    for(const {ring,phase} of ripples){const k=(1+Math.sin(t*2.05+phase)*.035)*(1+open*.6);ring.scale.set(k,k*(.88+Math.sin(phase)*.04),1);}
    hole.visible=open>0;hole.scale.setScalar(.001+open*1.75+Math.sin(t*9)*.02*open);
    rimMaterial.opacity=open*(.7+.25*Math.sin(t*13));haloMaterial.opacity=open*(.1+.05*Math.sin(t*7));
    for(const spec of tendons)tendon(spec,t);
    // Spiral threads coil round the line of sight and tighten into a funnel down to the pool.
    const coil=smooth((t-OPENING.grab-.05)/.55),tight=smooth((t-OPENING.grab-.1)/1.3),length=Math.max(1.5,cam.distanceTo(POOL))+.6;
    for(const {thread,offset} of helix){
      if(coil<=0){thread.mesh.visible=false;continue;}
      for(let i=0;i<H.length;i++){
        const s=i/(H.length-1),a=s*TAU*2.3+t*2.4+offset,radius=lerp(1.3,.38,tight)*(1-.72*s)+.04;
        H[i].copy(cam).addScaledVector(fwd,.3+s*length).addScaledVector(right,Math.cos(a)*radius).addScaledVector(up,Math.sin(a)*radius*.8);
      }
      thread.update(H,coil,t,offset);
    }
  }
  return{group,update,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

// ── The white eye ─────────────────────────────────────────────────────────────────────────────
function createWhiteEye(glow){
  const group=new THREE.Group(),face=new THREE.Group(),ball=new THREE.Group(),irisGroup=new THREE.Group();
  face.rotation.order='YXZ';group.add(face);face.add(ball);ball.add(irisGroup);
  const geometries=[],materials=[];
  const mat=(o,Type=THREE.MeshPhysicalMaterial)=>{const m=new Type(o);materials.push(m);return m;};
  const add=(geometry,material,parent=ball)=>{geometries.push(geometry);const m=new THREE.Mesh(geometry,material);parent.add(m);return m;};
  const porcelain=mat({color:0xf2f4f5,roughness:.23,metalness:.05,clearcoat:1,clearcoatRoughness:.13,emissive:0x8b929c,emissiveIntensity:.32});
  const edge=mat({color:0xbec6d1,roughness:.32,metalness:.15,clearcoat:.7,emissive:0x46505c,emissiveIntensity:.14});
  const lid=mat({color:0xf9fafb,roughness:.19,metalness:.04,clearcoat:1,emissive:0xd2d9df,emissiveIntensity:.3});
  const socket=mat({color:0x030508,roughness:.24,metalness:.38,clearcoat:.8,side:THREE.DoubleSide});
  const iris=mat({color:0x151b22,roughness:.33,metalness:.42,clearcoat:.65,emissive:0x7c8a96,emissiveIntensity:.06});
  const pupil=mat({color:0x000102,roughness:.12,metalness:.08,clearcoat:.8});
  const sinew=mat({color:0x030507,roughness:.22,metalness:.3,clearcoat:1,clearcoatRoughness:.15});
  const vein=mat({color:0xdce3e8,roughness:.3,metalness:.05,emissive:0xb6c0cb,emissiveIntensity:.22,transparent:true,opacity:.34,depthWrite:false});
  const lens=mat({color:0xe7f0fa,roughness:.025,metalness:0,clearcoat:1,clearcoatRoughness:.02,transparent:true,opacity:.17,depthWrite:false});
  const shine=mat({color:0xffffff,transparent:true,opacity:.62,depthWrite:false,toneMapped:false},THREE.MeshBasicMaterial);
  // A porcelain almond, pierced right through where the iris sits.
  const almond=new THREE.Shape();almond.moveTo(-1.25,0);almond.bezierCurveTo(-.79,.74,.79,.74,1.25,0);almond.bezierCurveTo(.79,-.74,-.79,-.74,-1.25,0);
  const hole=new THREE.Path();hole.absarc(0,0,.392,0,TAU,true);almond.holes.push(hole);
  const sclera=new THREE.ExtrudeGeometry(almond,{depth:.18,steps:1,curveSegments:48,bevelEnabled:true,bevelSize:.075,bevelThickness:.105,bevelSegments:6});sclera.translate(0,0,-.09);
  add(sclera,[porcelain,edge]);
  for(const side of [1,-1])add(new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(-1.25,0,.115),new THREE.Vector3(-.79,side*.74,.16),new THREE.Vector3(.79,side*.74,.16),new THREE.Vector3(1.25,0,.115)),96,side>0?.025:.018,10,false),lid);
  const well=add(new THREE.CylinderGeometry(.388,.325,.18,72,1,true),socket);well.rotation.x=Math.PI/2;well.position.z=.106;
  add(new THREE.CircleGeometry(.326,72),socket).position.z=.012;
  add(new THREE.RingGeometry(.045,.319,72),iris,irisGroup).position.z=.035;
  const slit=new THREE.Shape();slit.moveTo(0,.245);slit.bezierCurveTo(.046,.14,.046,-.14,0,-.245);slit.bezierCurveTo(-.046,-.14,-.046,.14,0,.245);
  const pupilMesh=add(new THREE.ExtrudeGeometry(slit,{depth:.018,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:3,curveSegments:32,steps:1}),pupil,irisGroup);pupilMesh.position.z=.049;
  const fibers=[];
  for(let i=0;i<32;i++){const a=i/32*TAU,inner=.075+i%3*.014,outer=.267+i%4*.01;fibers.push(new THREE.Vector3(Math.cos(a)*inner,Math.sin(a)*inner,.05),new THREE.Vector3(Math.cos(a+.025)*outer,Math.sin(a+.025)*outer,.05));}
  const fiberGeometry=new THREE.BufferGeometry().setFromPoints(fibers);geometries.push(fiberGeometry);
  irisGroup.add(new THREE.LineSegments(fiberGeometry,mat({color:0x616e7d,transparent:true,opacity:.42},THREE.LineBasicMaterial)));
  add(new THREE.TorusGeometry(.383,.012,10,96),edge).position.z=.198;
  const cornea=new THREE.SphereGeometry(.54,48,28,0,TAU,0,.76);cornea.rotateX(Math.PI/2);cornea.translate(0,0,-.235);add(cornea,lens);
  const glintA=add(new THREE.SphereGeometry(.018,12,10),shine);glintA.position.set(-.095,.125,.265);glintA.scale.set(1,.42,.38);
  add(new THREE.SphereGeometry(.009,10,8),shine).position.set(.087,-.062,.294);
  // Black tendrils hang beneath it; pale filaments fan out from the corners.
  const tendrils=[];
  for(let i=0;i<5;i++){
    const side=i%2?1:-1,drop=(i-2)*.075;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*(1.04+i*.025),-.04,-.06),new THREE.Vector3(side*1.38,-.22+drop,-.18),new THREE.Vector3(side*.92,-.72+drop,-.34),new THREE.Vector3(side*.22,-1.03-i*.08,-.13-i*.06)]);
    tendrils.push({mesh:add(new THREE.TubeGeometry(curve,52,.028+i%3*.009,10,false),sinew,face),phase:i*1.71,swing:.018,speed:.65});
  }
  for(let i=0;i<6;i++){
    const side=i%2?1:-1,row=Math.floor(i/2);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*1.15,.02,-.03),new THREE.Vector3(side*(1.4+row*.07),.21-row*.19,-.08),new THREE.Vector3(side*(1.53+row*.13),.38-row*.34,-.12),new THREE.Vector3(side*(1.72+row*.09),.29-row*.38,-.18)]);
    tendrils.push({mesh:add(new THREE.TubeGeometry(curve,40,.007+row*.0015,7,false),vein,face),phase:i*.91,swing:.025,speed:.8});
  }
  // It hangs from threads that disappear into the dark above.
  for(let i=0;i<3;i++){
    const x=(i-1)*.62,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.8,.35,-.12),new THREE.Vector3(x*1.2+.1,3,-.3),new THREE.Vector3(x*1.6-.2,12,-.2+i*.3),new THREE.Vector3(x*2,30,0)]);
    add(new THREE.TubeGeometry(curve,60,.026-i*.004,7,false),sinew,group);
  }
  const halo=new THREE.Sprite(mat({map:glow,color:0xd7e2ff,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending},THREE.SpriteMaterial));
  halo.scale.setScalar(6.5);halo.position.z=-.3;face.add(halo);
  const light=new THREE.PointLight(0xe6eeff,10,11,1.4);light.position.set(0,-.2,1.1);face.add(light);

  let yaw=0,pitch=0,blinkStart=-9,nextBlink=3+Math.random()*4;
  const local=new THREE.Vector3();
  function update(dt,time,camera,{open=1,dilate=0,alert=0}={}){
    local.copy(camera.position).sub(group.position);
    const targetYaw=Math.atan2(local.x,local.z),targetPitch=clamp(-Math.atan2(local.y,Math.hypot(local.x,local.z))*.8,-.4,.4);
    yaw+=wrapAngle(targetYaw-yaw)*(1-Math.exp(-dt*2.6));pitch+=(targetPitch-pitch)*(1-Math.exp(-dt*3));
    face.position.y=Math.sin(time*1.13)*.045;face.rotation.set(pitch,yaw,Math.sin(time*.47)*.019);
    // The iris drifts inside its socket towards the viewer.
    face.updateMatrixWorld();local.copy(camera.position);face.worldToLocal(local);
    const gx=clamp(local.x/Math.max(2,Math.abs(local.z)),-1,1),gy=clamp(local.y/Math.max(2,local.length()),-1,1);
    irisGroup.position.set(gx*.036,gy*.035,0);irisGroup.rotation.set(-gy*.1,gx*.09,0);
    if(time>nextBlink){blinkStart=time;nextBlink=time+4+Math.random()*5;}
    const b=time-blinkStart,blink=b<.09?b/.09:b<.24?1-(b-.09)/.15:0;
    ball.scale.y=Math.max(.02,open*(1-blink*.92))*(1+dilate*.08);
    pupilMesh.scale.set(1+dilate*3.4,1-dilate*.22,1);
    porcelain.emissiveIntensity=.32+alert*.12+dilate*(.3+.15*Math.sin(time*2.1));lid.emissiveIntensity=.3+dilate*.3;iris.emissiveIntensity=.06+alert*.06+dilate*.2;
    vein.opacity=.34+dilate*.3;halo.material.opacity=(.18+alert*.08+dilate*.3)*open;light.intensity=(6+alert*3+dilate*10)*Math.max(.15,open);
    for(const t of tendrils)t.mesh.rotation.z=Math.sin(time*t.speed+t.phase)*t.swing;
  }
  return{group,update,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

// A long pale hand on an arm that runs back into the dark; fingers reach along +z.
function createHand(){
  const group=new THREE.Group(),geometries=[];
  const skin=new THREE.MeshStandardMaterial({color:0xc6cbd1,roughness:.62,metalness:0,emissive:0x2c3138,emissiveIntensity:1});
  const nail=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.35});
  const add=(geometry,material,parent)=>{geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;};
  const arm=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,-.08),new THREE.Vector3(.02,-.04,-.6),new THREE.Vector3(.12,-.18,-2),new THREE.Vector3(.35,-.5,-5),new THREE.Vector3(.6,-.9,-9)]);
  add(new THREE.TubeGeometry(arm,80,.034,8,false),skin,group);
  const palm=add(new THREE.SphereGeometry(1,16,12),skin,group);palm.scale.set(.075,.022,.1);palm.position.z=.02;
  const fingers=[];
  for(let i=0;i<5;i++){
    const thumb=i===0,base=new THREE.Group(),joint=new THREE.Group();
    base.position.set(thumb?-.075:-.05+(i-1)*.034,thumb?-.005:0,thumb?0:.09);base.rotation.y=thumb?.7:(i-2.5)*-.12;
    const first=thumb?.07:.13+(i===2?.03:0)-(i===4?.03:0),second=thumb?.06:.11-(i===4?.02:0);
    const a=add(new THREE.CylinderGeometry(.0085,.01,first,6),skin,base);a.rotation.x=Math.PI/2;a.position.z=first/2;
    joint.position.z=first;base.add(joint);
    const b=add(new THREE.CylinderGeometry(.005,.0085,second,6),skin,joint);b.rotation.x=Math.PI/2;b.position.z=second/2;
    const tip=add(new THREE.ConeGeometry(.006,.03,6),nail,joint);tip.rotation.x=Math.PI/2;tip.position.z=second+.012;
    group.add(base);fingers.push({base,joint,phase:i*1.3});
  }
  group.scale.setScalar(1.4);group.visible=false;
  return{group,from:new THREE.Vector3(),away:new THREE.Vector3(),across:new THREE.Vector3(),active:false,t:0,seen:0,retreatAt:-1,
    // 0 = reaching with fingers spread, 1 = clenched as it is torn away.
    curl(amount,time){for(const f of fingers){f.base.rotation.x=amount*.7+Math.sin(time*31+f.phase)*.06;f.joint.rotation.x=amount*1.1;}},
    dispose(){geometries.forEach(g=>g.dispose());skin.dispose();nail.dispose();}};
}

// Pairs of pale eyes that open in the dark around you and shut when the light finds them.
function createWatcher(){
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0xdfe5ee,transparent:true,opacity:0,fog:false,depthWrite:false});
  const pupilMaterial=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,fog:false,depthWrite:false});
  const shape=new THREE.Shape();shape.moveTo(-.1,0);shape.quadraticCurveTo(0,.075,.1,0);shape.quadraticCurveTo(0,-.05,-.1,0);
  const lid=new THREE.ShapeGeometry(shape,12),dot=new THREE.CircleGeometry(.022,12),pair=new THREE.Group();
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(lid,material);eye.position.x=side*.16;eye.rotation.z=side*-.14;pair.add(eye);
    const iris=new THREE.Mesh(dot,pupilMaterial);iris.position.set(side*.16,.004,.002);pair.add(iris);
  }
  pair.scale.setScalar(1.6);group.add(pair);group.visible=false;
  return{group,pair,material,pupilMaterial,age:0,life:0,alive:false,closing:-1,nextBlink:2,blinkAt:-9,burst:false,
    dispose(){lid.dispose();dot.dispose();material.dispose();pupilMaterial.dispose();}};
}

// ── The fear of darkness: an endless field, a flashlight, and the white eye somewhere out there ──
function createDarkness({seed,glow,floorMap,shadows}){
  const model=createDarknessModel(seed),group=new THREE.Group(),bin=[],keep=x=>{bin.push(x);return x;},r=random(seed^0x5f3759df);
  group.visible=false;
  floorMap.repeat.set(FLOOR/FLOOR_TILE,FLOOR/FLOOR_TILE);
  // Surfaces are mid-grey on purpose: the dark comes from the missing light, not from black paint,
  // so whatever the flashlight touches reads clearly.
  const floor=new THREE.Mesh(keep(new THREE.PlaneGeometry(FLOOR,FLOOR)),keep(new THREE.MeshPhysicalMaterial({color:0x474c55,roughness:.42,metalness:.1,clearcoat:.6,clearcoatRoughness:.3,bumpMap:floorMap,bumpScale:.8,roughnessMap:floorMap})));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;group.add(floor);
  const stone=keep(new THREE.MeshPhysicalMaterial({color:0x2a2e35,roughness:.5,metalness:.15,clearcoat:.65,clearcoatRoughness:.3}));
  const tar=keep(new THREE.MeshPhysicalMaterial({color:0x1c2026,roughness:.3,metalness:.35,clearcoat:1,clearcoatRoughness:.14}));
  const instanced=(geometry,material,count,cast=shadows)=>{
    const mesh=new THREE.InstancedMesh(keep(geometry),material,count);
    mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=cast;mesh.receiveShadow=shadows;group.add(mesh);return mesh;
  };
  const meshes={slab:instanced(roundedBox(.06),stone,110),column:[instanced(twistedColumn(3,.2,.075),tar,36),instanced(twistedColumn(5,.3,.05),tar,36)],
    arch:instanced(archGeometry(),tar,10),thread:instanced(hangingThread(),tar,200,false),root:[0,1,2].map(v=>instanced(rootGeometry(v),tar,40,false))};
  const dummy=new THREE.Object3D(),hanging=[];
  let built='';
  function rebuild(cx,cz){
    built=cx+','+cz;hanging.length=0;
    const used=new Map(),put=mesh=>{const i=used.get(mesh)||0;if(i>=mesh.instanceMatrix.count)return;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);used.set(mesh,i+1);};
    for(const item of model.itemsAround((cx+.5)*CHUNK,(cz+.5)*CHUNK,RANGE)){
      dummy.position.set(item.x,0,item.z);dummy.rotation.set(0,item.yaw||0,0);dummy.scale.set(1,1,1);
      if(item.kind==='slab'){dummy.scale.set(item.w,item.h,item.d);put(meshes.slab);}
      else if(item.kind==='column'){dummy.scale.set(1,item.h/16,1);put(meshes.column[item.variant]);}
      else if(item.kind==='arch'){dummy.scale.setScalar(item.span/5);put(meshes.arch);}
      else if(item.kind==='root'){dummy.scale.setScalar(item.scale);put(meshes.root[item.variant]);}
      else if(item.kind==='thread'&&hanging.length<meshes.thread.instanceMatrix.count)hanging.push(item);
    }
    for(const mesh of [meshes.slab,...meshes.column,meshes.arch,...meshes.root]){mesh.count=used.get(mesh)||0;mesh.instanceMatrix.needsUpdate=true;}
    meshes.thread.count=hanging.length;
  }
  // Fine dust hangs around the player, wrapping so there is always some to drift past.
  const DUST=650,dustBase=new Float32Array(DUST*3),dustPosition=new THREE.BufferAttribute(new Float32Array(DUST*3),3).setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<DUST;i++){dustBase[i*3]=r()*30;dustBase[i*3+1]=.3+r()*8;dustBase[i*3+2]=r()*30;}
  const dustGeometry=keep(new THREE.BufferGeometry());dustGeometry.setAttribute('position',dustPosition);
  const dust=new THREE.Points(dustGeometry,keep(new THREE.PointsMaterial({color:0x9aa7b8,size:.022,transparent:true,opacity:.3,depthWrite:false})));dust.frustumCulled=false;group.add(dust);

  const eye=createWhiteEye(glow);group.add(eye.group);
  const watchers=Array.from({length:5},createWatcher);watchers.forEach(w=>group.add(w.group));
  const hand=createHand();group.add(hand.group);

  // Listening: a ring runs out across the floor, chevrons point the way, a glint answers from afar.
  const ring=new THREE.Mesh(keep(new THREE.RingGeometry(.97,1,96)),keep(new THREE.MeshBasicMaterial({color:0xc8d3e2,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})));
  ring.rotation.x=-Math.PI/2;group.add(ring);
  const chevronMaterial=keep(new THREE.MeshBasicMaterial({color:0xe5ecf6,transparent:true,opacity:0,depthWrite:false})),chevrons=new THREE.Group();
  for(let w=0;w<3;w++)chevrons.add(new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.25,.025,.2-w*.42),new THREE.Vector3(0,.025,-.12-w*.42),new THREE.Vector3(.25,.025,.2-w*.42)]),10,.014,5,false)),chevronMaterial));
  group.add(chevrons);
  const glint=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:glow,color:0xe8f0ff,transparent:true,opacity:0,depthTest:false,depthWrite:false,fog:false,blending:THREE.AdditiveBlending})));
  glint.renderOrder=10;group.add(glint);

  const lights=new THREE.Group();
  const flash=new THREE.SpotLight(0xdfe7f2,FLASH,28,.5,.72,1.55);
  if(shadows){flash.castShadow=true;flash.shadow.mapSize.set(1024,1024);flash.shadow.camera.near=.3;flash.shadow.camera.far=26;flash.shadow.bias=-.0004;flash.shadow.normalBias=.03;}
  const aura=new THREE.PointLight(0x8090a8,.9,5,1.6);
  lights.add(new THREE.HemisphereLight(0x2c3648,0x000000,.16),flash,flash.target,aura);group.add(lights);

  function update(time,camera){
    const cx=model.chunkOf(camera.position.x),cz=model.chunkOf(camera.position.z);
    if(built!==cx+','+cz)rebuild(cx,cz);
    for(let i=0;i<hanging.length;i++){
      const h=hanging[i];
      dummy.position.set(h.x,THREAD_TOP,h.z);dummy.rotation.set(Math.sin(time*.55+h.phase)*.012,0,Math.cos(time*.43+h.phase*1.7)*.012);dummy.scale.set(h.thickness,THREAD_TOP-h.bottom,h.thickness);
      dummy.updateMatrix();meshes.thread.setMatrixAt(i,dummy.matrix);
    }
    meshes.thread.instanceMatrix.needsUpdate=true;
    floor.position.x=Math.round(camera.position.x/FLOOR_TILE)*FLOOR_TILE;floor.position.z=Math.round(camera.position.z/FLOOR_TILE)*FLOOR_TILE;
    const a=dustPosition.array,drift=time*.05;
    for(let i=0;i<DUST;i++){
      a[i*3]=((dustBase[i*3]+drift-camera.position.x)%30+30)%30-15+camera.position.x;
      a[i*3+1]=dustBase[i*3+1]+Math.sin(time*.2+i)*.15;
      a[i*3+2]=((dustBase[i*3+2]-drift*.6-camera.position.z)%30+30)%30-15+camera.position.z;
    }
    dustPosition.needsUpdate=true;
  }
  return{group,model,eye,watchers,hand,ring,chevrons,chevronMaterial,glint,flash,aura,update,invalidate(){built='';},
    dispose(){eye.dispose();hand.dispose();watchers.forEach(w=>w.dispose());bin.forEach(x=>x.dispose());}};
}

export function createFearWorld(host,{veil,sound,reducedMotion=false,coarse=false,onEvent=()=>{}}={}){
  // Throws when WebGL is unavailable; the caller then falls back to the plain transition.
  const renderer=new THREE.WebGLRenderer({antialias:!coarse,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=!coarse;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.5));
  renderer.domElement.className='fear-xp-canvas';host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(47,1,.06,140);camera.rotation.order='YXZ';
  const environment=studioEnvironment(renderer),glow=glowTexture(),floorMap=floorTexture();
  scene.environment=environment;
  const opening=createOpening(),darkness=createDarkness({seed:Math.random()*2**31|0,glow,floorMap,shadows:!coarse});
  scene.add(opening.group,darkness.group);
  const {model,eye}=darkness;
  const SETS={opening:{background:0x020306,fog:.029,env:1},darkness:{background:0x000000,fog:.075,env:.09}};
  function useSet(name){
    const set=SETS[name];opening.group.visible=name==='opening';darkness.group.visible=name==='darkness';
    scene.background=new THREE.Color(set.background);scene.fog=new THREE.FogExp2(set.background,set.fog);scene.environmentIntensity=set.env;
  }
  useSet('opening');

  const keys=new Set(),stick={x:0,y:0},player={x:0,z:0,yaw:0,pitch:0,bob:0,walked:0,still:0};
  const forward=new THREE.Vector3(),toEye=new THREE.Vector3(),aim=new THREE.Vector3(0,0,-1),tmp=new THREE.Vector3();
  const found={from:new THREE.Vector3(),to:new THREE.Vector3(),q0:new THREE.Quaternion(),q1:new THREE.Quaternion(),m:new THREE.Matrix4()};
  let phase='idle',phaseT=0,clock=0,frame=0,last=0,paused=false,disposed=false,completed=false;
  let stage=0,noticed=-1,escapeT=-1,listenAt=-99,flickerUntil=0,nextFlicker=0,flickerLevel=1,flickerSwap=0,nextWatcher=0,nextDistant=0,breathed=false;
  let veilState='',hudState='',eyeLift=0,eyeOpen=1,eyeDilate=0,near=false,proximity=0;
  let battery=1,torch='on',torchAt=-9,handReadyAt=0;
  const turns=[];
  const eyeState={open:1,dilate:0,alert:0};

  function setVeil(color,opacity){
    const value=opacity.toFixed(3),key=color+value;if(!veil||key===veilState)return;veilState=key;
    veil.style.background=color;veil.style.opacity=value;
  }
  function setPhase(next){phase=next;phaseT=0;onEvent('phase',{phase});}
  function resize(){
    const width=host.clientWidth||innerWidth,height=host.clientHeight||innerHeight;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  resize();

  function enterTitle(){
    // The darkness theme starts at the fall and runs until the dossier.
    sound?.stopOpening();sound?.title();sound?.theme();
    useSet('darkness');player.x=player.z=0;player.yaw=0;player.pitch=0;
    model.clearEye();stage=0;
    const at=model.placeEye(player,0);eye.group.position.set(at.x,EYE_HEIGHT,at.z);darkness.invalidate();
    placeExploreCamera(0);darkness.update(0,camera);
    // Compile the darkness while the screen is black, so the first step does not stutter.
    try{renderer.compile(scene,camera);}catch{}
    setVeil('#000',1);setPhase('title');
  }
  function enterExplore(){
    setPhase('explore');sound?.explore();
    nextFlicker=clock+18+Math.random()*16;nextWatcher=clock+9+Math.random()*5;nextDistant=clock+12+Math.random()*10;
  }

  function placeExploreCamera(dt){
    camera.fov=70;camera.position.set(player.x,HEAD+(reducedMotion?0:Math.sin(player.bob)*.028),player.z);
    camera.rotation.set(player.pitch,player.yaw,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    // The flashlight is held a little low and right, and lags the head a touch.
    const flash=darkness.flash;
    flash.position.copy(camera.position).addScaledVector(tmp.setFromMatrixColumn(camera.matrixWorld,0),.16).addScaledVector(tmp.setFromMatrixColumn(camera.matrixWorld,1),-.2);
    aim.lerp(forward,dt?1-Math.exp(-dt*14):1).normalize();
    flash.target.position.copy(flash.position).addScaledVector(aim,8);darkness.aura.position.copy(camera.position);
  }

  function move(dt){
    const ahead=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
    const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;
    if(keys.has('ArrowLeft'))player.yaw+=dt*1.5;
    if(keys.has('ArrowRight'))player.yaw-=dt*1.5;
    const amount=Math.min(1,Math.hypot(ahead,side));
    if(amount<.08){player.still+=dt;return;}
    player.still=0;breathed=false;
    const run=keys.has('ShiftLeft')||keys.has('ShiftRight')||Math.hypot(stick.x,stick.y)>.94,speed=(run?5.6:3.2)*amount*dt,length=Math.hypot(ahead,side);
    const s=Math.sin(player.yaw),c=Math.cos(player.yaw),x0=player.x,z0=player.z;
    model.move(player,(-s*ahead+c*side)/length*speed,(-c*ahead-s*side)/length*speed);
    const moved=Math.hypot(player.x-x0,player.z-z0);
    player.bob+=moved*(run?2.2:2.6);player.walked+=moved;
    if(player.walked>(run?1.9:1.45)){player.walked=0;sound?.step(run);}
  }

  function panOf(x,z){return clamp(-Math.sin(wrapAngle(yawOf(x-player.x,z-player.z)-player.yaw)),-1,1);}

  // How bright the flashlight is: it stutters now and then, and dies while the eye escapes.
  function lightLevel(){
    if(phase==='explore'&&phaseT<1.5){const t=phaseT;return t<.55?0:t<1.3?(Math.sin(t*61)>.1?.85:.05):1;}
    if(escapeT>=0){const t=escapeT;if(t<.32)return Math.sin(t*90)>0?.6:.05;if(t<ESCAPE.lightBack)return 0;if(t<ESCAPE.lightBack+.5)return Math.sin(t*70)>-.2?.9:.08;return 1;}
    if(clock<flickerUntil){if(clock>flickerSwap){flickerSwap=clock+.04+Math.random()*.06;flickerLevel=Math.random()<.5?.04:.6+Math.random()*.4;}return flickerLevel;}
    if(clock>nextFlicker&&phase==='explore'&&torch==='on'){flickerUntil=clock+.5+Math.random()*.8;nextFlicker=clock+12+Math.random()*12;sound?.flicker(flickerUntil-clock);}
    return 1;
  }
  // The battery drains while the light is on and recharges in the dark; a dead light stays dead until full.
  function torchLevel(dt){
    if(phase!=='explore')return torch==='on'?1:0;
    if(torch==='on'){
      battery=Math.max(0,battery-dt*BATTERY.drain);
      if(battery<=0){torch='dead';torchAt=clock;sound?.flicker(1.1);onEvent('caption',{text:'ФОНАРЬ СЕЛ'});}
    }else{
      battery=Math.min(1,battery+dt*BATTERY.charge);
      if(torch==='dead'&&battery>=1)switchTorch('on');
    }
    const since=clock-torchAt;
    if(torch==='dead')return since<1.1?(Math.sin(since*53)>.2?.5*(1-since/1.1):.03):0;
    if(torch==='off')return 0;
    const startup=since<.5?(Math.sin(since*70)>-.2?.85:.05):1;
    // A weak battery browns out and stutters before it dies.
    const weak=battery<BATTERY.low?(.35+battery/BATTERY.low*.65)*(Math.random()<.04?.2:1):1;
    return startup*weak;
  }
  function switchTorch(next){torch=next;torchAt=clock;sound?.torch(next==='on');}
  function toggleTorch(){
    if(phase!=='explore')return false;
    if(torch==='on'){switchTorch('off');return true;}
    if(torch==='off'&&battery>=BATTERY.relight){switchTorch('on');return true;}
    sound?.torch(false,true);return false;
  }

  // Detects a fast spin; the hand waits where the player's back was, and is torn away once seen.
  function watchTurns(){
    turns.push({t:clock,yaw:player.yaw});
    while(turns.length&&clock-turns[0].t>HAND.window)turns.shift();
    const hand=darkness.hand;
    if(hand.active||clock<handReadyAt||phaseT<8||Math.abs(player.yaw-turns[0].yaw)<HAND.turn)return;
    // It hovers at shoulder height a little to one side, reaching across for your neck.
    const back=turns[0].yaw+Math.PI,side=Math.random()<.5?-1:1;
    const x=player.x-Math.sin(back)*HAND.reach+Math.cos(back)*side*.3,z=player.z-Math.cos(back)*HAND.reach-Math.sin(back)*side*.3;
    turns.length=0;
    if(model.blocked(x,z,.2)){handReadyAt=clock+3;return;}
    handReadyAt=clock+HAND.cooldown;
    hand.from.set(x,HEAD-.1,z);hand.group.position.copy(hand.from);hand.group.visible=true;
    hand.across.set(-Math.cos(back)*side*.35,-.08,Math.sin(back)*side*.35);
    hand.active=true;hand.t=0;hand.seen=0;hand.retreatAt=-1;
  }
  function updateHand(dt){
    const hand=darkness.hand;if(!hand.active)return;
    hand.t+=dt;
    if(hand.retreatAt<0){
      hand.group.lookAt(tmp.copy(camera.position).add(hand.across));
      tmp.copy(hand.group.position).sub(camera.position).normalize();
      if(forward.dot(tmp)>.8)hand.seen+=dt;
      if(hand.seen>HAND.hold||hand.t>1.2){
        hand.retreatAt=hand.t;hand.away.copy(hand.group.position).sub(camera.position).setY(0).normalize();
        sound?.snatch(panOf(hand.group.position.x,hand.group.position.z));
      }
      hand.curl(.12,clock);
      return;
    }
    const k=clamp((hand.t-hand.retreatAt)/HAND.retreat);
    hand.group.position.copy(hand.from).addScaledVector(hand.away,Math.pow(k,2.2)*11);hand.group.position.y-=k*k*.6;
    hand.curl(.12+k*.9,clock);
    if(k>=1){hand.active=false;hand.group.visible=false;}
  }

  // A burst surrounds the player while the light is out — the first pair right ahead; the rest of
  // the time they open at the edge of sight, mostly to the sides and behind.
  function spawnWatcher(burst,order=0){
    const w=darkness.watchers.find(item=>!item.alive);if(!w)return;
    for(let attempt=0;attempt<4;attempt++){
      const spread=burst?(order?(Math.random()-.5)*2.6:(Math.random()-.5)*.4):Math.PI*.4+Math.random()*Math.PI*1.2;
      const angle=player.yaw+spread,distance=burst?6.5+Math.random()*4:12+Math.random()*7;
      const x=player.x-Math.sin(angle)*distance,z=player.z-Math.cos(angle)*distance;
      if(model.blocked(x,z,.4))continue;
      w.group.position.set(x,1.3+Math.random()*1.1,z);w.alive=true;w.burst=burst;w.age=0;w.closing=-1;w.life=burst?3:9+Math.random()*6;w.nextBlink=1+Math.random()*2;w.group.visible=true;
      if(!burst||Math.random()<.5)sound?.voice(panOf(x,z),burst?.8:.45);
      return;
    }
  }
  function updateWatchers(dt,level){
    for(const w of darkness.watchers){
      if(!w.alive)continue;
      w.age+=dt;w.group.lookAt(camera.position);
      const dx=w.group.position.x-camera.position.x,dz=w.group.position.z-camera.position.z,distance=Math.hypot(dx,dz);
      tmp.copy(w.group.position).sub(camera.position).normalize();
      const lit=level>.5&&forward.dot(tmp)>.965&&distance<21;
      if(w.closing<0&&(w.age>w.life||distance<6||lit||(w.burst&&level>.5&&w.age>.5)))w.closing=0;
      let open=smooth(w.age/.6);
      if(w.closing>=0){w.closing+=dt;open*=1-smooth(w.closing/(lit?.1:.35));if(w.closing>.4){w.alive=false;w.group.visible=false;continue;}}
      if(w.age>w.nextBlink){w.blinkAt=w.age;w.nextBlink=w.age+2+Math.random()*3;}
      const b=w.age-w.blinkAt,blink=b<.08?b/.08:b<.2?1-(b-.08)/.12:0;
      w.pair.scale.set(1,Math.max(.05,1-blink),1);
      w.material.opacity=open*.62;w.pupilMaterial.opacity=open;
    }
  }

  function startEscape(){escapeT=0;sound?.escape();onEvent('hud',{near:false});}
  function updateEscape(dt){
    const before=escapeT;escapeT+=dt;const t=escapeT;
    eyeOpen=1-smooth(t/ESCAPE.close);
    eyeLift=Math.pow(clamp((t-ESCAPE.lift)/(ESCAPE.gone-ESCAPE.lift)),2)*EYE_LIFT;
    eye.group.visible=t<ESCAPE.gone||t>=ESCAPE.move;
    if(before<ESCAPE.burst&&t>=ESCAPE.burst)for(let i=0;i<3;i++)spawnWatcher(true,i);
    if(before<ESCAPE.move&&t>=ESCAPE.move){
      const at=model.placeEye(player,++stage,Math.random,player.yaw);
      eye.group.position.set(at.x,EYE_HEIGHT,at.z);darkness.invalidate();eyeLift=0;
    }
    if(t>=ESCAPE.move){eyeOpen=1;eyeLift=0;}
    if(before<ESCAPE.lightBack&&t>=ESCAPE.lightBack)sound?.glitch(0);
    if(before<ESCAPE.caption&&t>=ESCAPE.caption)onEvent('caption',{text:CAPTIONS[Math.min(stage-1,CAPTIONS.length-1)]});
    if(t>=ESCAPE.end)escapeT=-1;
  }

  function listen(){
    if(phase!=='explore'||escapeT>=0||clock-listenAt<LISTEN_COOLDOWN)return false;
    listenAt=clock;
    const dx=eye.group.position.x-player.x,dz=eye.group.position.z-player.z,distance=Math.hypot(dx,dz);
    // Far away the echo is vague; it sharpens as you close in.
    const blur=clamp((distance-25)/100)*.38,yaw=yawOf(dx,dz)+(Math.random()*2-1)*blur;
    darkness.pulse={at:clock,x:player.x,z:player.z,yaw,distance,delay:.15+Math.min(distance,120)/120*.85};
    darkness.ring.position.set(player.x,.03,player.z);
    darkness.chevrons.position.set(player.x-Math.sin(yaw)*1.2,0,player.z-Math.cos(yaw)*1.2);darkness.chevrons.rotation.y=yaw;
    sound?.pulse(clamp(-Math.sin(wrapAngle(yaw-player.yaw)),-1,1),distance);
    return true;
  }
  function updatePulse(){
    const pulse=darkness.pulse;if(!pulse){darkness.ring.material.opacity=0;darkness.chevronMaterial.opacity=0;darkness.glint.material.opacity=0;return;}
    const t=clock-pulse.at,k=clamp(t/1.8);
    darkness.ring.scale.setScalar(.4+k*14);darkness.ring.material.opacity=.16*(1-k);
    darkness.chevronMaterial.opacity=.55*Math.sin(clamp(t/1.6)*Math.PI);
    const g=clamp((t-pulse.delay)/1.4),reach=Math.min(pulse.distance,24);
    darkness.glint.position.set(pulse.x-Math.sin(pulse.yaw)*reach,EYE_HEIGHT,pulse.z-Math.cos(pulse.yaw)*reach);
    darkness.glint.scale.setScalar(1.6+g*2.6);darkness.glint.material.opacity=t<pulse.delay?0:.85*Math.sin(g*Math.PI)*(pulse.distance>24?.75:1);
    if(t>3.4)darkness.pulse=null;
  }

  function touch(){
    if(phase!=='explore'||!near)return false;
    setPhase('found');near=false;onEvent('hud',{near:false});sound?.found();
    found.from.copy(camera.position);found.q0.copy(camera.quaternion);
    const e=eye.group.position;tmp.set(camera.position.x-e.x,0,camera.position.z-e.z).normalize();
    found.to.set(e.x+tmp.x*2,EYE_HEIGHT,e.z+tmp.z*2);
    found.m.lookAt(found.to,tmp.set(e.x,EYE_HEIGHT+.05,e.z),camera.up);found.q1.setFromRotationMatrix(found.m);
    return true;
  }
  // Leaves the fear at once: a white flash straight into the dossier.
  function finish(){
    if(phase==='done'||phase==='found'||phase==='leaving')return;
    sound?.stopOpening();sound?.leave();setPhase('leaving');
  }
  function skip(){
    if(phase==='opening')enterTitle();
    else if(phase==='title')enterExplore();
  }

  function updateExplore(dt){
    const level=lightLevel()*torchLevel(dt);
    darkness.flash.intensity=FLASH*level;darkness.aura.intensity=.9*(.35+.65*level);
    if(phase==='explore'&&escapeT<0)move(dt);
    placeExploreCamera(dt);darkness.update(clock,camera);
    if(phase==='explore'&&escapeT<0)watchTurns();
    updateHand(dt);
    if(escapeT>=0)updateEscape(dt);
    const e=eye.group.position;e.y=EYE_HEIGHT+eyeLift;
    toEye.set(e.x,EYE_HEIGHT,e.z).sub(camera.position);
    const distance=Math.hypot(toEye.x,toEye.z),facing=forward.dot(toEye.normalize());
    proximity=escapeT>=0?1:1-clamp((distance-5)/85);
    eyeState.open=eyeOpen;eyeState.alert=clamp(1-(distance-4)/12);eyeState.dilate=eyeDilate;
    eye.update(dt,clock,camera,eyeState);
    if(phase==='explore'&&escapeT<0){
      // The first time you come near, a servo whirs: the eye has turned to you.
      if(distance<14&&noticed!==stage){noticed=stage;sound?.servo(panOf(e.x,e.z));}
      if(stage<2&&(distance<4.2||distance<7.5&&facing>.55))startEscape();
      near=stage>=2&&distance<4&&facing>.78;
      // More of them open while the light is out.
      const dark=level<.3;
      if(clock>nextWatcher){nextWatcher=clock+(dark?4+Math.random()*3:8+Math.random()*7);if(darkness.watchers.filter(w=>w.alive).length<(dark?3:2))spawnWatcher(false);}
      if(clock>nextDistant){nextDistant=clock+14+Math.random()*16;sound?.distant(Math.random()*2-1);}
      // Stand still too long and something breathes just behind you.
      if(player.still>7&&!breathed){breathed=true;sound?.breath(Math.random()<.5?-.7:.7);}
    }
    updateWatchers(dt,level);updatePulse();
    sound?.tick(proximity,escapeT>=0);
    const cooldown=clamp((clock-listenAt)/LISTEN_COOLDOWN),wait=Math.ceil(LISTEN_COOLDOWN-(clock-listenAt));
    const hud=`${near}|${cooldown>=1&&escapeT<0}|${Math.round(cooldown*20)}|${wait}|${Math.round(battery*20)}|${torch}`;
    if(hud!==hudState&&phase==='explore'){hudState=hud;onEvent('hud',{near,ready:cooldown>=1&&escapeT<0,cooldown,wait:Math.max(0,wait),battery,torch,canLight:torch==='on'||torch==='off'&&battery>=BATTERY.relight});}
  }

  function update(dt){
    clock+=dt;phaseT+=dt;
    if(phase==='opening'){
      opening.update(phaseT,camera,!reducedMotion);
      setVeil('#000',Math.max(1-smooth(phaseT/.9),smooth((phaseT-OPENING.dive)/.3)));
      if(phaseT>=OPENING.end)enterTitle();
      return true;
    }
    if(phase==='title'){if(phaseT>=TITLE)enterExplore();return false;}
    if(phase==='explore'){updateExplore(dt);setVeil('#000',1-smooth(phaseT/1.3));return true;}
    if(phase==='found'){
      const k=smoother(phaseT/1.4);
      eyeDilate=smooth((phaseT-.3)/1.2);updateExplore(dt);
      camera.position.lerpVectors(found.from,found.to,k);camera.quaternion.slerpQuaternions(found.q0,found.q1,k);camera.updateMatrixWorld();
      setVeil('#fff',smooth((phaseT-1.35)/.7));
      if(phaseT>2.15&&!completed){completed=true;setPhase('done');onEvent('complete');}
      return true;
    }
    if(phase==='leaving'){
      if(darkness.group.visible)updateExplore(dt);else opening.update(OPENING.grab,camera,false);
      setVeil('#fff',smooth(phaseT/.45));
      if(phaseT>.5&&!completed){completed=true;setPhase('done');onEvent('complete');}
      return true;
    }
    return false;
  }

  function loop(now){
    if(disposed||paused)return;
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    if(update(dt)&&!(veil&&veilState.endsWith('1.000')))renderer.render(scene,camera);
    frame=requestAnimationFrame(loop);
  }
  function start(){
    if(phase!=='idle')return;
    if(reducedMotion)enterTitle();
    else{setPhase('opening');sound?.opening();setVeil('#000',1);}
    last=performance.now();frame=requestAnimationFrame(loop);
  }

  return{
    start,listen,touch,skip,finish,resize,keys,stick,torch:toggleTorch,
    look(dx,dy){if(phase!=='explore')return;player.yaw-=dx*.0022;player.pitch=clamp(player.pitch-dy*.0022,-1.2,1.2);},
    pause(){if(paused||disposed)return;paused=true;cancelAnimationFrame(frame);keys.clear();stick.x=stick.y=0;},
    resume(){if(!paused||disposed)return;paused=false;last=performance.now();frame=requestAnimationFrame(loop);},
    dispose(){
      if(disposed)return;disposed=true;cancelAnimationFrame(frame);
      opening.dispose();darkness.dispose();environment.dispose();glow.dispose();floorMap.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
    get state(){
      const e=eye.group.position;
      return{phase,phaseT,stage,escaping:escapeT>=0,near,proximity,torch,battery,hand:darkness.hand.active?(darkness.hand.retreatAt<0?'reaching':'retreating'):'none',
        player:{x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch},eye:{x:e.x,z:e.z,distance:Math.hypot(e.x-player.x,e.z-player.z)},
        clearings:model.clearings.length,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
    },
    // Test hooks: jump the opening to a moment, or stand somewhere in the dark.
    debug:{
      opening(t){useSet('opening');phase='opening';phaseT=t;opening.update(t,camera,false);renderer.render(scene,camera);},
      pose(x,z,yaw=0,pitch=0){player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch;},
      render(){renderer.render(scene,camera);},
      step(seconds,dt=1/60){for(let t=0;t<seconds;t+=dt)update(dt);},
      get parts(){return{scene,camera,renderer,darkness,opening};}
    }
  };
}
