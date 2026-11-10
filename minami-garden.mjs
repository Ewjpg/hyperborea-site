// Минами Син: a higanbana to play with at the end of his dossier.
// Dragging turns it, holding folds it back into a bud, letting go makes it burst open,
// and tapping a floret shakes its petals loose. The sculpted lily (minami-lycoris.mjs) is used when it loads;
// otherwise the procedural one from higanbana-3d.mjs. No network beyond the site's own files.
import * as T from './vendor/three.module.min.js';
import {createHiganbana3D} from './higanbana-3d.mjs?v=1';
import {loadLycoris} from './minami-lycoris.mjs?v=2';

const clamp = T.MathUtils.clamp;
const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
// How long a press must last before it counts as holding rather than a tap, in ms.
const HOLD_DELAY = 150;

function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

// A loose petal: a narrow, slightly cupped blade about 0.9 long.
function petalGeometry(){
  const positions=[],indices=[],rows=14,cols=3;
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const t=i/rows,s=j/cols*2-1,w=Math.sin(Math.PI*t)**.8*.11;
    positions.push(s*w,t*.9,Math.sin(t*Math.PI*1.4)*.13+s*s*.05+Math.sin(t*15)*.012);
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const n=i*(cols+1)+j;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

// Distant lilies as faint red lines behind the flower, in one draw call.
function makeField(low){
  const positions=[],rand=random(4073),count=low?10:20;
  const line=(a,b)=>positions.push(...a,...b);
  for(let k=0;k<count;k++){
    const x=(rand()-.5)*30,z=-7-rand()*20,y=-4.2+rand()*.6,h=1.6+rand()*2.2;
    for(let i=0;i<6;i++)line([x+Math.sin(i/6*2)*.08,y+i/6*h,z],[x+Math.sin((i+1)/6*2)*.08,y+(i+1)/6*h,z]);
    for(let f=0;f<5;f++){
      const a=f*Math.PI*2/5,fx=x+Math.cos(a)*.22,fy=y+h,fz=z+Math.sin(a)*.22;
      for(let j=0;j<6;j++){
        const angle=j*Math.PI/3+a;let previous=[fx,fy,fz];
        for(let i=1;i<=6;i++){const t=i/6,r=t*.7,next=[fx+Math.cos(angle)*r,fy+Math.sin(t*Math.PI)*.3-t*t*.15,fz+Math.sin(angle)*r];line(previous,next);previous=next;}
      }
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  return new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x8f152b,transparent:true,opacity:.24,depthWrite:false}));
}

/**
 * host: an element that receives the canvas; it should be focusable for the keyboard.
 * onState(name): 'idle' | 'holding' | 'charged' | 'burst', for a hint line.
 * Call setActive(true) while the flower is on screen; nothing renders otherwise.
 */
export function createMinamiGarden(host,{onState=()=>{},onError=()=>{}}={}){
  const low=matchMedia('(max-width:760px), (pointer:coarse)').matches||(navigator.deviceMemory||8)<6;
  const still=matchMedia('(prefers-reduced-motion: reduce)');
  const rand=random(9127);
  const canvas=document.createElement('canvas');canvas.className='minami-garden-canvas';canvas.dataset.quality=low?'low':'high';
  const renderer=new T.WebGLRenderer({canvas,antialias:!low,powerPreference:low?'low-power':'default'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1.25:2));
  const scene=new T.Scene();scene.background=new T.Color(0x0a0306);scene.fog=new T.FogExp2(0x12040a,.034);
  const camera=new T.PerspectiveCamera(34,1,.1,60);

  // Both flowers offer: group, hub (where the florets branch), anchors (one per floret), pick (for taps),
  // update(open 0..1, seconds, dt), poke(hit) → whether it touched the flower, shake(power), wither(0..1), dispose().
  function proceduralFlower(){
    const made=createHiganbana3D({quality:low?'low':'high',seed:11});
    // The six florets are the groups inside the umbel; each gets its own wobble spring.
    const florets=made.bloom.children.filter(child=>child.isGroup).map(unit=>({unit,angle:0,velocity:0}));
    const tints=new Map();made.group.traverse(object=>{if(object.material&&!tints.has(object.material))tints.set(object.material,object.material.color.clone());});
    return {kind:'procedural',group:made.group,hub:made.bloom,anchors:florets.map(f=>f.unit),pick:florets.map(f=>f.unit),
      update(progress,seconds,dt){
        made.update(progress,seconds);
        for(const f of florets){
          f.velocity+=(-95*f.angle-6.5*f.velocity)*dt;f.angle+=f.velocity*dt;
          f.unit.rotation.x+=f.angle*.2;f.unit.rotation.z+=f.angle*.15;f.unit.scale.setScalar(1+Math.abs(f.angle)*.08);
        }
      },
      poke(hit){
        let unit=hit.object;while(unit&&!florets.some(f=>f.unit===unit))unit=unit.parent;
        const floret=florets.find(f=>f.unit===unit);if(!floret)return false;
        floret.velocity+=6+rand()*3;return true;
      },
      shake(power){for(const f of florets)f.velocity+=(rand()-.3)*5*power;},
      // Dying: darker colours and a nodding head (the procedural petals cannot droop on their own).
      wither(amount){made.group.rotation.x=amount*.45;for(const [material,color] of tints)material.color.copy(color).multiplyScalar(1-.6*amount);},
      dispose:made.dispose};
  }
  // The flower stays hidden until it is ready, then blooms in from a bud.
  const holder=new T.Group();scene.add(holder);
  let flower=null;
  function useFlower(next){
    if(disposed){next.dispose();return;}
    flower=next;holder.add(next.group);host.dataset.flower=next.kind;open=0;openVelocity=0;target=1;spring='gentle';flower.wither?.(flowEase());
  }
  loadLycoris({renderer,low}).then(model=>useFlower({kind:'model',...model})).catch(error=>{
    console.warn('Minami lycoris model unavailable, using the procedural flower:',error);
    try{useFlower(proceduralFlower());}catch(failure){onError(failure);}
  });

  scene.add(new T.HemisphereLight(0xe8c5ce,0x1a0b11,.7));
  const key=new T.DirectionalLight(0xffe2d5,2.7);key.position.set(-3,6,5);scene.add(key);
  const rim=new T.DirectionalLight(0xff173b,3.2);rim.position.set(3,2,-4);scene.add(rim);
  const cool=new T.DirectionalLight(0xb4bddb,1.1);cool.position.set(-5,0,-3);scene.add(cool);
  const warm=new T.PointLight(0xff533f,10,14,2);warm.position.set(0,2.6,2.2);scene.add(warm);
  // Light inside the bud: grows while it is held shut and flashes when it bursts.
  const heart=new T.PointLight(0xffa25e,0,5,2);heart.position.set(0,.55,0);scene.add(heart);
  const field=makeField(low);scene.add(field);

  const atmosphere=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform float time;uniform float charge;uniform float dim;
    void main(){vec2 p=vUv-.5;float r=length(p*vec2(1.,1.15));
      float halo=exp(-r*r*(15.-6.*charge))*(1.+charge*1.6);float rim=exp(-pow((r-.3)*26.,2.))*.12;
      float mist=sin(p.x*13.+time*.13)*sin(p.y*11.-time*.11)*.025;
      gl_FragColor=vec4(mix(vec3(.24,.016,.035),vec3(.075,.008,.012),dim)*max(0.,halo+rim+mist),(1.-smoothstep(.1,.55,r))*.65);}`,
    uniforms:{time:{value:0},charge:{value:0},dim:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const glow=new T.Mesh(new T.PlaneGeometry(17,17),atmosphere);glow.position.set(0,.4,-5);scene.add(glow);

  // Floating pollen that is always there.
  const moteCount=low?40:80,motes=new Float32Array(moteCount*3),motePhase=new Float32Array(moteCount);
  for(let i=0;i<moteCount;i++){motes[i*3]=(rand()-.5)*12;motes[i*3+1]=(rand()-.5)*7;motes[i*3+2]=(rand()-.5)*8;motePhase[i]=rand()*6.28;}
  const moteGeometry=new T.BufferGeometry();moteGeometry.setAttribute('position',new T.BufferAttribute(motes,3));moteGeometry.setAttribute('aPhase',new T.BufferAttribute(motePhase,1));
  const moteMaterial=new T.ShaderMaterial({
    vertexShader:`attribute float aPhase;uniform float time;uniform float pixelRatio;varying float vFade;void main(){vec3 p=position;p.x+=sin(time*.21+aPhase)*.35;p.y+=sin(time*.16+aPhase)*.5;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(18.,(1.5+sin(aPhase*3.)*.8)*pixelRatio*16./max(1.,-mv.z));vFade=.3+.3*sin(aPhase+time*.6);}`,
    fragmentShader:'varying float vFade;uniform float ash;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(vec3(1.,.53,.3),vec3(.42,.38,.38),ash),exp(-r*r*5.)*vFade);}',
    uniforms:{time:{value:0},pixelRatio:{value:renderer.getPixelRatio()},ash:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  scene.add(new T.Points(moteGeometry,moteMaterial));

  // Sparks: short-lived golden points from bursts and taps, and the ones drawn into a held bud.
  const SPARKS=low?100:200;
  const sparkPos=new Float32Array(SPARKS*3),sparkVel=new Float32Array(SPARKS*3),sparkLife=new Float32Array(SPARKS),sparkSize=new Float32Array(SPARKS);
  const sparkLeft=new Float32Array(SPARKS),sparkMax=new Float32Array(SPARKS),sparkDrag=new Float32Array(SPARKS);
  const sparkGeometry=new T.BufferGeometry();
  const sparkPosition=new T.BufferAttribute(sparkPos,3).setUsage(T.DynamicDrawUsage),sparkFade=new T.BufferAttribute(sparkLife,1).setUsage(T.DynamicDrawUsage);
  sparkGeometry.setAttribute('position',sparkPosition);sparkGeometry.setAttribute('aLife',sparkFade);sparkGeometry.setAttribute('aSize',new T.BufferAttribute(sparkSize,1).setUsage(T.DynamicDrawUsage));
  const sparkMaterial=new T.ShaderMaterial({
    vertexShader:`attribute float aLife;attribute float aSize;uniform float pixelRatio;varying float vLife;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aLife>0.?min(40.,aSize*pixelRatio*(.4+.6*aLife)*18./max(1.,-mv.z)):0.;vLife=aLife;}`,
    fragmentShader:'varying float vLife;uniform float ash;void main(){float r=length(gl_PointCoord-.5)*2.;float g=exp(-r*r*5.);gl_FragColor=vec4(mix(mix(vec3(1.,.32,.22),vec3(1.,.8,.5),vLife),vec3(.5,.46,.45),ash),g*min(1.,vLife*3.));}',
    uniforms:{pixelRatio:{value:renderer.getPixelRatio()},ash:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const sparks=new T.Points(sparkGeometry,sparkMaterial);sparks.frustumCulled=false;scene.add(sparks);
  let nextSpark=0;
  function spark(x,y,z,vx,vy,vz,life,size,drag=2.3){
    const i=nextSpark;nextSpark=(nextSpark+1)%SPARKS;
    sparkPos[i*3]=x;sparkPos[i*3+1]=y;sparkPos[i*3+2]=z;sparkVel[i*3]=vx;sparkVel[i*3+1]=vy;sparkVel[i*3+2]=vz;
    sparkLeft[i]=sparkMax[i]=life;sparkLife[i]=1;sparkSize[i]=size;sparkDrag[i]=drag;
  }

  // Loose petals that fly off and flutter down.
  const PETALS=low?50:100;
  const petalMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.42,metalness:.03,side:T.DoubleSide,emissive:0x2b030b,emissiveIntensity:.25});
  const petalGeometryLoose=petalGeometry();
  const petalMesh=new T.InstancedMesh(petalGeometryLoose,petalMaterial,PETALS);petalMesh.frustumCulled=false;
  petalMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const petals=Array.from({length:PETALS},()=>({life:0,max:1,position:new T.Vector3(),velocity:new T.Vector3(),rotation:new T.Euler(),spin:new T.Vector3(),scale:1,phase:0}));
  const dummy=new T.Object3D(),tint=new T.Color();
  dummy.scale.setScalar(0);dummy.updateMatrix();
  for(let i=0;i<PETALS;i++){petalMesh.setMatrixAt(i,dummy.matrix);petalMesh.setColorAt(i,tint.setHSL(.975+rand()*.03,.85,.34+rand()*.12));}
  scene.add(petalMesh);
  let nextPetal=0;
  function petal(origin,direction,speed){
    const p=petals[nextPetal];nextPetal=(nextPetal+1)%PETALS;
    p.position.copy(origin);p.velocity.copy(direction).multiplyScalar(speed);
    p.rotation.set(rand()*6.28,rand()*6.28,rand()*6.28);p.spin.set((rand()-.5)*8,(rand()-.5)*8,(rand()-.5)*8);
    p.max=p.life=2.8+rand()*1.8;p.scale=.3+rand()*.25;p.phase=rand()*6.28;
  }

  // ── State ───────────────────────────────────────────────────────────────────
  // open drives the bloom (0 bud … 1 open); it overshoots past 1 after a burst, shown as a swell.
  let open=0,openVelocity=0,target=1,spring='gentle',holding=false,charge=0,flash=0;
  let yaw=-.35,yawVelocity=0,sway=0,swayVelocity=0,time=0,lastInput=-10,state='',stateTimer=0;
  const hover=new T.Vector2(),hoverTarget=new T.Vector2(),hub=new T.Vector3(),look=new T.Vector3(0,.2,0);
  const SPRINGS={gentle:[9,5.6],closing:[6,4.9],burst:[52,6.2]};
  // Flow state (Minami's dark mode): 0 alive … 1 dead, eased over a few seconds.
  let flow=0,flowTarget=0,lastDying=-1,shed=0;
  const flowEase=()=>flow*flow*(3-2*flow);
  const BACKGROUND=new T.Color(0x0a0306),BACKGROUND_FLOW=new T.Color(0x040102),FOG=new T.Color(0x12040a),FOG_FLOW=new T.Color(0x070203);
  const WHITE=new T.Color(0xffffff),DEAD_PETAL=new T.Color(0x5a4446);
  function setState(name,hold=0){stateTimer=hold;if(name===state)return;state=name;host.dataset.state=name;try{onState(name);}catch{}}
  setState('idle');

  const work=new T.Vector3(),direction=new T.Vector3(),upward=new T.Vector3(0,1,0);
  function hubPosition(){return flower?flower.hub.getWorldPosition(hub):hub.set(0,0,0);}
  function burst(power){
    if(!flower)return;
    hubPosition();
    // Petals leave from where the florets are right now: close to the axis while it is still a bud.
    const spread=.35+.65*clamp(open,0,1);
    for(const anchor of flower.anchors){
      anchor.getWorldPosition(work).sub(hub).multiplyScalar(spread).add(hub);work.y+=(1-clamp(open,0,1))*.5;
      const count=Math.round(1+power*(low?3:5));
      for(let i=0;i<count;i++){
        direction.subVectors(work,hub).setY(0).normalize().multiplyScalar(.9).addScaledVector(upward,.55+rand()*.6);
        direction.x+=(rand()-.5)*.6;direction.z+=(rand()-.5)*.6;direction.normalize();
        petal(work,direction,1.6+power*2.4+rand()*.8);
      }
    }
    flower.shake(power);
    const count=Math.round((low?24:40)+power*(low?60:120));
    for(let i=0;i<count;i++){
      direction.set(rand()-.5,rand()-.35,rand()-.5).normalize();
      const speed=1.8+rand()*3.6*power;
      spark(hub.x,hub.y+.2,hub.z,direction.x*speed,direction.y*speed+.6,direction.z*speed,.7+rand()*1.1,1.2+rand()*2.2);
    }
    flash=1;
    // A ring of light spreading from the flower's heart, drawn in the page above the canvas.
    const wave=host.querySelector('.minami-garden-wave');
    if(wave&&!still.matches){
      work.copy(hub).project(camera);
      wave.style.left=((work.x+1)/2*100).toFixed(1)+'%';wave.style.top=((1-work.y)/2*100).toFixed(1)+'%';
      wave.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.15)'},{opacity:.22+power*.4,offset:.12},{opacity:0,transform:'translate(-50%,-50%) scale(1.7)'}],{duration:1100,easing:'cubic-bezier(.15,.7,.3,1)'});
    }
  }
  function startHold(){
    if(holding||!flower)return;
    holding=true;target=.04;spring='closing';lastInput=time;setState('holding');
  }
  function cancelHold(){
    if(!holding)return;
    holding=false;target=1;spring='gentle';setState('idle');
  }
  // Returns false when the bud was barely closed, so the caller can treat the press as a tap.
  function release(){
    if(!holding)return false;
    const power=charge;holding=false;target=1;lastInput=time;
    if(power<.12){spring='gentle';setState('idle');return false;}
    spring='burst';openVelocity+=1.5+power*3;burst(power);setState('burst',1.8);
    return true;
  }
  const raycaster=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,0,1),0);
  function tap(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    ndc.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(ndc,camera);
    const hit=flower?raycaster.intersectObjects(flower.pick,true)[0]:null;
    lastInput=time;
    if(hit&&flower.poke(hit,1)){
      hubPosition();
      for(let i=0;i<(low?3:4);i++){
        direction.subVectors(hit.point,hub).normalize().multiplyScalar(.7).addScaledVector(upward,.5);
        direction.x+=(rand()-.5)*.8;direction.z+=(rand()-.5)*.8;direction.normalize();
        petal(hit.point,direction,1+rand()*1.2);
      }
      for(let i=0;i<14;i++){direction.set(rand()-.5,rand()-.3,rand()-.5).normalize();const speed=.8+rand()*1.8;spark(hit.point.x,hit.point.y,hit.point.z,direction.x*speed,direction.y*speed,direction.z*speed,.5+rand()*.7,1+rand()*1.5);}
      return 'floret';
    }
    // A tap beside the flower is a breath of wind from that side.
    if(raycaster.ray.intersectPlane(plane,work)){
      swayVelocity+=(work.x<0?-1:1)*2.2;
      for(let i=0;i<8;i++)spark(work.x,work.y,work.z,(rand()-.5)*1.2,rand()*1.1,(rand()-.5)*1.2,.5+rand()*.5,1+rand());
    }
    return 'wind';
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  let press=null,dragVelocity=0;
  function down(event){
    if(press||event.button>0)return;
    try{canvas.setPointerCapture(event.pointerId);}catch{}
    press={id:event.pointerId,x:event.clientX,y:event.clientY,last:event.clientX,at:performance.now(),dragging:false};
    press.timer=setTimeout(()=>{if(press&&!press.dragging)startHold();},HOLD_DELAY);
    yawVelocity*=.3;dragVelocity=0;lastInput=time;
  }
  function move(event){
    const rect=canvas.getBoundingClientRect();
    if(event.pointerType!=='touch')hoverTarget.set(clamp((event.clientX-rect.left)/rect.width*2-1,-1,1),clamp(1-(event.clientY-rect.top)/rect.height*2,-1,1));
    if(!press||event.pointerId!==press.id)return;
    const now=performance.now(),dx=event.clientX-press.last;press.last=event.clientX;
    if(!press.dragging&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>7){press.dragging=true;clearTimeout(press.timer);cancelHold();}
    if(press.dragging){
      const turn=dx*.011;yaw+=turn;
      dragVelocity=dragVelocity*.5+turn/Math.max(.008,(now-(press.moved||press.at))/1000)*.5;press.moved=now;lastInput=time;
    }
  }
  function up(event){
    if(!press||event.pointerId!==press.id)return;
    clearTimeout(press.timer);
    if(press.dragging)yawVelocity=clamp(dragVelocity,-7,7);
    else if(!release())tap(event.clientX,event.clientY);
    press=null;
  }
  function cancel(event){
    if(!press||event.pointerId!==press.id)return;
    clearTimeout(press.timer);cancelHold();press=null;
  }
  function leave(){hoverTarget.set(0,0);}
  function keyDown(event){
    if(event.key===' '||event.key==='Enter'){event.preventDefault();if(!event.repeat)startHold();}
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();yawVelocity+=event.key==='ArrowLeft'?-1.6:1.6;lastInput=time;}
  }
  function keyUp(event){
    if(event.key!==' '&&event.key!=='Enter')return;
    event.preventDefault();
    if(!release())swayVelocity+=2;
  }
  const noMenu=event=>event.preventDefault();
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('contextmenu',noMenu);
  host.addEventListener('keydown',keyDown);host.addEventListener('keyup',keyUp);
  host.addEventListener('blur',cancelHold);
  host.prepend(canvas);

  // ── Frame ───────────────────────────────────────────────────────────────────
  function step(dt){
    time+=dt;
    const calm=still.matches;
    const [stiffness,damping]=SPRINGS[spring];
    openVelocity+=(stiffness*(target-open)-damping*openVelocity)*dt;open+=openVelocity*dt;
    if(spring==='burst'&&Math.abs(open-1)<.004&&Math.abs(openVelocity)<.02)spring='gentle';
    charge=clamp((1-open)/.92,0,1)*(holding?1:0);
    if(holding)setState(charge>.85?'charged':'holding');
    else if(state==='burst'&&(stateTimer-=dt)<=0)setState('idle');
    flash=Math.max(0,flash-dt*2.2);

    if(flower)flower.update(clamp(open,0,1),calm?0:time,dt);else{open=0;openVelocity=0;}

    // Flow state: the flower dies over a few seconds, its light fails and dry petals keep falling.
    // Dying is slow (about 4.5 s); coming back to life is quicker.
    flow+=clamp(flowTarget-flow,-dt/1.8,dt/4.5);
    const dying=flowEase();
    if(dying!==lastDying){
      lastDying=dying;flower?.wither?.(dying);
      scene.background.lerpColors(BACKGROUND,BACKGROUND_FLOW,dying);scene.fog.color.lerpColors(FOG,FOG_FLOW,dying);
      atmosphere.uniforms.dim.value=dying;moteMaterial.uniforms.ash.value=dying;sparkMaterial.uniforms.ash.value=dying;
      petalMaterial.color.lerpColors(WHITE,DEAD_PETAL,dying);petalMaterial.emissiveIntensity=.25*(1-dying);
      key.intensity=2.7*(1-.45*dying);rim.intensity=3.2*(1-.3*dying);
    }
    if(dying>.4&&flower&&!calm&&(shed-=dt)<=0){
      shed=.35+rand()*.8;
      flower.anchors[Math.floor(rand()*flower.anchors.length)].getWorldPosition(work);
      direction.set((rand()-.5)*.6,-.2,(rand()-.5)*.6).normalize();petal(work,direction,.3+rand()*.4);
    }
    const failing=dying>.5&&!calm&&rand()<.035;

    // Turning: inertia after a drag, then a slow idle spin once the flower is left alone.
    const idle=!press&&!holding&&time-lastInput>2.5&&!calm;
    yawVelocity+=((idle?.14*(1-.7*dying):0)-yawVelocity)*(1-Math.exp(-(idle?.6:2.4)*dt));
    if(!press||!press.dragging)yaw+=yawVelocity*dt;
    swayVelocity+=(-14*sway-2.6*swayVelocity)*dt;sway+=swayVelocity*dt;
    hover.lerp(hoverTarget,1-Math.exp(-4*dt));
    holder.rotation.set(-hover.y*.05,yaw,-sway*.14-hover.x*.04);
    holder.scale.setScalar(1+Math.max(0,open-1)*.45);
    // The held bud trembles harder the more it is charged.
    const shake=calm?0:charge*charge*.028;
    holder.position.set((rand()-.5)*shake,(rand()-.5)*shake*.6,0);

    heart.intensity=charge*charge*7+flash*14+(failing?rand()*5*dying:0);
    warm.intensity=(10+flash*8)*(1-.6*dying)*(failing?.35:1);
    atmosphere.uniforms.charge.value=Math.max(charge*.8,flash);atmosphere.uniforms.time.value=time;
    moteMaterial.uniforms.time.value=calm?0:time;
    host.style.setProperty('--charge',(Math.max(charge,flash)).toFixed(3));

    // While held, sparks are drawn in from around the bud.
    if(holding&&charge>.05&&!calm){
      hubPosition();
      const wanted=charge*(low?40:70)*dt;let count=Math.floor(wanted)+(rand()<wanted%1?1:0);
      while(count--){
        direction.set(rand()-.5,rand()-.3,rand()-.5).normalize();
        const distance=1.6+rand()*1.6,life=.55+rand()*.4,x=hub.x+direction.x*distance,y=hub.y+.3+direction.y*distance,z=hub.z+direction.z*distance;
        spark(x,y,z,(hub.x-x)/life,(hub.y+.3-y)/life,(hub.z-z)/life,life,.9+rand()*1.3,0);
      }
    }
    for(let i=0;i<SPARKS;i++){
      if(sparkLeft[i]<=0){sparkLife[i]=0;continue;}
      sparkLeft[i]-=dt;const drag=Math.exp(-sparkDrag[i]*dt);
      sparkVel[i*3]*=drag;sparkVel[i*3+1]=sparkVel[i*3+1]*drag+(sparkDrag[i]?.3*dt:0);sparkVel[i*3+2]*=drag;
      sparkPos[i*3]+=sparkVel[i*3]*dt;sparkPos[i*3+1]+=sparkVel[i*3+1]*dt;sparkPos[i*3+2]+=sparkVel[i*3+2]*dt;
      sparkLife[i]=Math.max(0,sparkLeft[i]/sparkMax[i]);
    }
    sparkPosition.needsUpdate=true;sparkFade.needsUpdate=true;sparkGeometry.attributes.aSize.needsUpdate=true;

    for(let i=0;i<PETALS;i++){
      const p=petals[i];
      if(p.life<=0){if(p.scale){p.scale=0;dummy.scale.setScalar(0);dummy.updateMatrix();petalMesh.setMatrixAt(i,dummy.matrix);}continue;}
      p.life-=dt;
      p.velocity.y-=1.25*dt;p.velocity.multiplyScalar(Math.exp(-1.7*dt));
      p.position.addScaledVector(p.velocity,dt);
      p.position.x+=Math.sin(time*2.6+p.phase)*.32*dt;p.position.z+=Math.cos(time*2.1+p.phase)*.24*dt;
      p.spin.multiplyScalar(Math.exp(-.35*dt));
      p.rotation.x+=p.spin.x*dt;p.rotation.y+=p.spin.y*dt;p.rotation.z+=p.spin.z*dt;
      dummy.position.copy(p.position);dummy.rotation.copy(p.rotation);
      dummy.scale.setScalar(Math.max(.0001,p.scale*Math.min(1,(p.max-p.life)/.12)*Math.min(1,p.life/.7)));
      dummy.updateMatrix();petalMesh.setMatrixAt(i,dummy.matrix);
    }
    petalMesh.instanceMatrix.needsUpdate=true;

    camera.position.set(hover.x*.32,look.y+Math.sin(.24)*distance+hover.y*.18,Math.cos(.24)*distance);
    camera.lookAt(look);
    renderer.render(scene,camera);
  }

  let distance=7.4,disposed=false,running=false,frame=0,previous=0;
  function resize(){
    if(disposed)return;
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    // Keep the whole umbel in frame on narrow screens.
    distance=Math.max(7.4,8.1/camera.aspect);
  }
  function loop(now){
    frame=requestAnimationFrame(loop);
    const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
    try{step(dt);}catch(error){setActive(false);onError(error);}
  }
  function setActive(active){
    if(disposed)return;
    if(active&&!running){running=true;previous=performance.now();frame=requestAnimationFrame(loop);}
    else if(!active&&running){running=false;cancelAnimationFrame(frame);frame=0;if(press){clearTimeout(press.timer);press=null;}cancelHold();}
  }
  function contextLost(event){event.preventDefault();if(disposed)return;setActive(false);onError(new Error('Minami garden WebGL context lost'));}
  canvas.addEventListener('webglcontextlost',contextLost);
  const observer=new ResizeObserver(resize);observer.observe(host);
  function dispose(){
    if(disposed)return;
    setActive(false);disposed=true;observer.disconnect();
    canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);
    canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('contextmenu',noMenu);
    canvas.removeEventListener('webglcontextlost',contextLost);
    host.removeEventListener('keydown',keyDown);host.removeEventListener('keyup',keyUp);host.removeEventListener('blur',cancelHold);
    host.style.removeProperty('--charge');delete host.dataset.state;delete host.dataset.flower;
    flower?.dispose();flower=null;
    for(const item of [field.geometry,glow.geometry,moteGeometry,sparkGeometry,petalGeometryLoose])item.dispose();
    for(const item of [field.material,atmosphere,moteMaterial,sparkMaterial,petalMaterial])item.dispose();
    petalMesh.dispose();scene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  resize();
  // Flow state on or off; instant skips the slow death (and reduced motion always does).
  function setFlow(on,instant=false){flowTarget=on?1:0;if(instant||still.matches)flow=flowTarget;}
  return {setActive,dispose,canvas,setFlow,
    // For tests: hold(), release() and tap(x, y) act like the pointer would.
    hold:startHold,release,tap,
    get state(){return {state,open,charge,running,quality:low?'low':'high',flower:flower?.kind||'loading',flow:+flow.toFixed(3)};}};
}
