// Local, procedural cinema for Minami Shin. No network assets or audio ownership.
import * as T from './vendor/three.module.min.js';
import {createHiganbana3D} from './higanbana-3d.mjs?v=1';
import {createLycoris, preloadLycoris, lycorisReady} from './minami-lycoris.mjs?v=2';

// The sculpted lily starts loading as soon as this module is imported (the card is hovered or focused).
preloadLycoris().catch(()=>{});
/** Resolves true once the sculpted lily is ready, or false after ms; the opening then uses the procedural one. */
export function modelReady(ms=1500){return Promise.race([preloadLycoris().then(()=>true,()=>false),new Promise(resolve=>setTimeout(()=>resolve(false),ms))]);}

export const OPENING_DURATION = 6900;
const clamp = T.MathUtils.clamp;
const smooth = (a,b,x) => {const k=clamp((x-a)/(b-a),0,1);return k*k*(3-2*k);};
const mix = T.MathUtils.lerp;
const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

function petalGeometry(){
  const positions=[],indices=[],rows=18,cols=4;
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const t=i/rows,s=j/cols*2-1,w=Math.sin(Math.PI*t)**.8*.11;
    positions.push(s*w,t*.9,Math.sin(t*Math.PI*1.4)*.13+s*s*.05+Math.sin(t*15)*.012);
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const n=i*(cols+1)+j;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function makeField(low){
  const positions=[],rand=random(1521),count=low?12:24;
  const line=(a,b)=>positions.push(...a,...b);
  // Distant lilies are actual spatial silhouettes, kept in one draw call.
  for(let k=0;k<count;k++){
    const x=(rand()-.5)*35,z=-5-rand()*24,y=-4.6+rand()*.7,h=1.3+rand()*2.2;
    for(let i=0;i<7;i++)line([x+Math.sin(i/7*2)*.08,y+i/7*h,z],[x+Math.sin((i+1)/7*2)*.08,y+(i+1)/7*h,z]);
    for(let f=0;f<5;f++){
      const a=f*Math.PI*2/5,fx=x+Math.cos(a)*.22,fy=y+h,fz=z+Math.sin(a)*.22;
      for(let j=0;j<6;j++){
        const angle=j*Math.PI/3+a;
        let previous=[fx,fy,fz];
        for(let i=1;i<=7;i++){
          const t=i/7,r=t*.7;
          const next=[fx+Math.cos(angle)*r,fy+Math.sin(t*Math.PI)*.3-t*t*.15,fz+Math.sin(angle)*r];line(previous,next);previous=next;
        }
      }
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  return new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x8f152b,transparent:true,opacity:.3,depthWrite:false}));
}

export function createMinamiOpening(host,{onError=()=>{}}={}){
  const low=matchMedia('(max-width:760px), (pointer:coarse)').matches || (navigator.deviceMemory||8)<6;
  const canvas=document.createElement('canvas');canvas.className='minami-cinema-canvas';canvas.setAttribute('aria-hidden','true');canvas.dataset.quality=low?'low':'high';
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:!low,powerPreference:low?'low-power':'high-performance'});}
  catch(error){canvas.remove();throw error;}
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1.25:1.6));
  renderer.setClearColor(0x050204,1);
  const scene=new T.Scene();scene.background=new T.Color(0x050204);scene.fog=new T.FogExp2(0x100309,.042);
  const camera=new T.PerspectiveCamera(40,1,.06,65);
  const model=lycorisReady();
  const flower=model?createLycoris(model,{renderer,low}):createHiganbana3D({quality:low?'low':'high',seed:11});scene.add(flower.group);
  const lightRoot=new T.Group();scene.add(lightRoot);
  lightRoot.add(new T.HemisphereLight(0xe8c5ce,0x1a0b11,.65));
  const key=new T.DirectionalLight(0xffe2d5,2.8);key.position.set(-3,6,5);lightRoot.add(key);
  const redRim=new T.DirectionalLight(0xff173b,3.3);redRim.position.set(3,2,-4);lightRoot.add(redRim);
  const cool=new T.DirectionalLight(0xb4bddb,1.15);cool.position.set(-5,0,-3);lightRoot.add(cool);
  const warm=new T.PointLight(0xff533f,13,15,2);warm.position.set(0,3,2);lightRoot.add(warm);
  const field=makeField(low);scene.add(field);

  // A light-filled atmosphere behind the petals; generated directly in the shader.
  const atmosphere=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:`
    varying vec2 vUv; uniform float time;
    void main(){vec2 p=vUv-.5;float r=length(p*vec2(1.,1.18));
      float halo=exp(-r*r*16.);float rim=exp(-pow((r-.31)*28.,2.))*.14;
      float mist=sin(p.x*14.+time*.13)*sin(p.y*12.-time*.11)*.025;
      gl_FragColor=vec4(vec3(.22,.013,.032)*max(0.,halo+rim+mist),(1.-smoothstep(.1,.55,r))*.6);}`,
    uniforms:{time:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const atmosphereMesh=new T.Mesh(new T.PlaneGeometry(24,24),atmosphere);atmosphereMesh.position.set(0,.8,-9);scene.add(atmosphereMesh);

  const rand=random(817),pollenCount=low?100:250,points=new Float32Array(pollenCount*3),sizes=new Float32Array(pollenCount),phases=new Float32Array(pollenCount);
  for(let i=0;i<pollenCount;i++){points[i*3]=(rand()-.5)*17;points[i*3+1]=(rand()-.5)*11;points[i*3+2]=(rand()-.5)*20;sizes[i]=1+rand()*3;phases[i]=rand()*6.28;}
  const pollenGeometry=new T.BufferGeometry();pollenGeometry.setAttribute('position',new T.BufferAttribute(points,3));pollenGeometry.setAttribute('aSize',new T.BufferAttribute(sizes,1));pollenGeometry.setAttribute('aPhase',new T.BufferAttribute(phases,1));
  const pollenMaterial=new T.ShaderMaterial({
    vertexShader:`attribute float aSize;attribute float aPhase;uniform float time;uniform float pixelRatio;varying float vFade;void main(){vec3 p=position;p.x+=sin(time*.21+aPhase)*.4;p.y+=sin(time*.16+aPhase)*.6;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(22.,aSize*pixelRatio*17./max(1.,-mv.z));vFade=(.35+.35*sin(aPhase+time*.6))*smoothstep(.2,2.,-mv.z);}`,
    fragmentShader:'varying float vFade;uniform float reveal;void main(){float r=length(gl_PointCoord-.5)*2.;float glow=exp(-r*r*5.);gl_FragColor=vec4(vec3(1.,.53,.3)*glow,glow*vFade*reveal);}',
    uniforms:{time:{value:0},pixelRatio:{value:renderer.getPixelRatio()},reveal:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  scene.add(new T.Points(pollenGeometry,pollenMaterial));

  const looseCount=low?14:30,looseGeometry=petalGeometry();
  const looseMaterial=new T.MeshStandardMaterial({color:0xa10a28,roughness:.42,metalness:.03,side:T.DoubleSide,emissive:0x29030b,emissiveIntensity:.18});
  const loose=new T.InstancedMesh(looseGeometry,looseMaterial,looseCount);loose.frustumCulled=false;
  const looseData=Array.from({length:looseCount},()=>({x:(rand()-.5)*13,y:rand()*12,z:(rand()-.5)*11,angle:rand()*6.28,scale:.35+rand()*.8,speed:.4+rand()*.45}));
  const dummy=new T.Object3D();scene.add(loose);

  // One scene pass, a small separable highlight pass, then photographic focus/color.
  const type=renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType;
  const target=new T.WebGLRenderTarget(1,1,{type,depthBuffer:true});target.depthTexture=new T.DepthTexture(1,1);
  const blurA=new T.WebGLRenderTarget(1,1,{type,depthBuffer:false}),blurB=blurA.clone();
  const postScene=new T.Scene(),postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1),quadGeometry=new T.PlaneGeometry(2,2);
  const blurMaterial=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec2 stepSize;uniform float extract;
    vec3 sampleAt(vec2 uv){vec3 c=texture2D(image,uv).rgb;return mix(c,max(c-vec3(.7),vec3(0.)),extract);}
    void main(){vec3 c=sampleAt(vUv)*.227027;c+=(sampleAt(vUv+stepSize*1.384615)+sampleAt(vUv-stepSize*1.384615))*.316216;c+=(sampleAt(vUv+stepSize*3.230769)+sampleAt(vUv-stepSize*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`,
    uniforms:{image:{value:null},stepSize:{value:new T.Vector2()},extract:{value:0}},depthTest:false,depthWrite:false});
  const grade=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform sampler2D image;uniform sampler2D glow;uniform sampler2D depthMap;
    uniform vec2 texel;uniform float focus;uniform float aperture;uniform float time;uniform float fade;
    float viewZ(float d){return (.06*65.)/(65.-d*(65.-.06));}
    void main(){float z=viewZ(texture2D(depthMap,vUv).x);float radius=clamp(abs(z-focus)/max(z,.1)*aperture,0.,1.)*7.;
      vec3 col=texture2D(image,vUv).rgb*2.;
      col+=texture2D(image,vUv+texel*vec2(1.,0.)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(-1.,0.)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(0.,1.)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(0.,-1.)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(.707,.707)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(-.707,-.707)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(.707,-.707)*radius).rgb;
      col+=texture2D(image,vUv+texel*vec2(-.707,.707)*radius).rgb;
      col=col*.1+texture2D(glow,vUv).rgb*.32;
      float vignette=1.-smoothstep(.23,.77,length((vUv-.5)*vec2(1.,.82)));
      col*=mix(.55,1.,vignette)*fade;
      float grain=fract(sin(dot(gl_FragCoord.xy+fract(time)*31.,vec2(12.9898,78.233)))*43758.5453);
      col+=vec3((grain-.5)*.0018);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,uniforms:{image:{value:target.texture},glow:{value:blurA.texture},depthMap:{value:target.depthTexture},texel:{value:new T.Vector2(1,1)},focus:{value:7},aperture:{value:low?.25:.65},time:{value:0},fade:{value:0}},depthTest:false,depthWrite:false});
  const quad=new T.Mesh(quadGeometry,grade);postScene.add(quad);
  host.append(canvas);

  let disposed=false,frame=0,start=0,last=0,completed=false,completion=null,ending=null,elapsed=0,draws=0,triangles=0;
  const aim=new T.Vector3(),pointer=new T.Vector2(),pointerTarget=new T.Vector2();
  function resize(){
    if(disposed)return;
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    const size=new T.Vector2();renderer.getDrawingBufferSize(size);target.setSize(size.x,size.y);
    blurA.setSize(Math.max(1,Math.round(size.x/4)),Math.max(1,Math.round(size.y/4)));blurB.setSize(blurA.width,blurA.height);
    grade.uniforms.texel.value.set(1/size.x,1/size.y);
  }
  function renderAt(seconds){
    if(disposed)return null;
    elapsed=Math.max(0,seconds);const t=elapsed;
    const unfold=smooth(.35,4.3,t),turn=smooth(2.2,6.6,t),lift=smooth(0,2.1,t),approach=smooth(4.6,6.9,t);
    flower.update(unfold,t);flower.group.rotation.y=-.18+turn*.2;
    // While still a bud the flower sways and its light breathes, so the first seconds are never still.
    const bud=1-smooth(.3,2.4,t);flower.group.rotation.z=Math.sin(t*1.7)*.045*bud;
    warm.intensity=13*(.45+.55*smooth(0,1.4,t))+Math.sin(t*3.1)*2.6*bud;
    const angle=mix(.88,-.22,turn),radius=mix(8.9,6.25,lift)-approach*1.15;
    const framing=camera.aspect<.85?Math.max(1,.95/camera.aspect):1;
    camera.position.set(Math.sin(angle)*radius*framing,(mix(-.75,2.8,lift)+Math.sin(turn*Math.PI)*.45)*framing,Math.cos(angle)*radius*framing);
    aim.set(0,mix(-.45,.05,lift),0);
    pointer.lerp(pointerTarget,.045);camera.position.x+=pointer.x*.15;camera.position.y+=pointer.y*.1;
    if(ending){const out=smooth(ending.time,ending.time+ending.duration,t);camera.position.lerp(aim,out*.86);aim.y+=out*.15;}
    camera.lookAt(aim);camera.fov=mix(40,36,approach);camera.updateProjectionMatrix();
    // The glow always sits straight behind the flower, facing the camera, whichever side the camera is on.
    atmosphereMesh.position.copy(camera.position).sub(aim).setLength(-9).add(aim);atmosphereMesh.position.y+=.8;atmosphereMesh.quaternion.copy(camera.quaternion);
    grade.uniforms.focus.value=camera.position.distanceTo(aim);grade.uniforms.time.value=t;grade.uniforms.fade.value=smooth(0,.65,t);
    atmosphere.uniforms.time.value=t;
    pollenMaterial.uniforms.time.value=t;pollenMaterial.uniforms.reveal.value=smooth(1.3,4.5,t);
    loose.visible=t>2.1;
    for(let i=0;i<looseCount;i++){
      const p=looseData[i];dummy.position.set(p.x+Math.sin(t*.35+p.angle)*.7,((p.y-t*p.speed+40)%12)-6,p.z);
      dummy.rotation.set(t*.3+p.angle,p.angle+t*.18,t*.4+p.angle);dummy.scale.setScalar(p.scale*smooth(2.1,3.9,t));dummy.updateMatrix();loose.setMatrixAt(i,dummy.matrix);
    }
    loose.instanceMatrix.needsUpdate=true;
    renderer.info.autoReset=false;renderer.info.reset();
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    quad.material=blurMaterial;blurMaterial.uniforms.image.value=target.texture;blurMaterial.uniforms.extract.value=1;blurMaterial.uniforms.stepSize.value.set(2/target.width,0);
    renderer.setRenderTarget(blurB);renderer.render(postScene,postCamera);
    blurMaterial.uniforms.image.value=blurB.texture;blurMaterial.uniforms.extract.value=0;blurMaterial.uniforms.stepSize.value.set(0,1.7/blurB.height);
    renderer.setRenderTarget(blurA);renderer.render(postScene,postCamera);
    quad.material=grade;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
    draws=renderer.info.render.calls;triangles=renderer.info.render.triangles;
    return {elapsed:t,progress:unfold,draws,triangles,quality:low?'low':'high'};
  }
  function tick(now){
    frame=0;if(disposed)return;
    const t=(now-start)/1000;
    if(!low||now-last>31){last=now;try{renderAt(t);}catch(error){stop();onError(error);return;}}
    if(t>=OPENING_DURATION/1000&&!completed){completed=true;completion?.();}
    if(!disposed)frame=requestAnimationFrame(tick);
  }
  function stop(){cancelAnimationFrame(frame);frame=0;}
  function play(done){if(disposed)return;stop();completion=done;completed=false;ending=null;start=performance.now();last=0;renderAt(0);frame=requestAnimationFrame(tick);}
  function finish(duration=850){if(!disposed&&!ending)ending={time:elapsed,duration:duration/1000};}
  function contextLost(event){event.preventDefault();if(disposed)return;stop();onError(new Error('Minami WebGL context lost'));}
  function move(event){if(low)return;const rect=canvas.getBoundingClientRect();pointerTarget.set((event.clientX-rect.left)/rect.width-.5,.5-(event.clientY-rect.top)/rect.height);}
  const observer=new ResizeObserver(resize);observer.observe(host);
  canvas.addEventListener('webglcontextlost',contextLost);host.addEventListener('pointermove',move,{passive:true});
  function dispose(){
    if(disposed)return;disposed=true;stop();observer.disconnect();canvas.removeEventListener('webglcontextlost',contextLost);host.removeEventListener('pointermove',move);
    flower.dispose();const geometries=new Set(),materials=new Set();
    for(const root of [field,atmosphereMesh,loose]){if(root.geometry)geometries.add(root.geometry);if(root.material)materials.add(root.material);}
    geometries.add(pollenGeometry);geometries.add(quadGeometry);materials.add(pollenMaterial);materials.add(blurMaterial);materials.add(grade);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());target.dispose();blurA.dispose();blurB.dispose();
    scene.clear();postScene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();completion=null;
  }
  try{resize();}catch(error){dispose();throw error;}
  return {play,finish,dispose,renderAt,stop,canvas,get state(){return {active:!disposed,running:!!frame,elapsed,draws,triangles,quality:low?'low':'high',flower:model?'model':'procedural'};}};
}
