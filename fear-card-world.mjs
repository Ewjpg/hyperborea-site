import * as T from './vendor/three.module.min.js';
import {organicFears} from './fear-card-organic.mjs?v=1';
import {spatialFears} from './fear-card-spatial.mjs?v=1';
import {uncannyFears} from './fear-card-uncanny.mjs?v=1';
import {chooseDossierFear} from './fear-card-model.mjs?v=1';
import {createFearKit,createSoftwareFearRenderer} from './fear-card-kit.mjs?v=1';

export const DOSSIER_FEARS=Object.freeze([...organicFears,...spatialFears,...uncannyFears]);
const STORE='hyperborea_fear_dossier_worlds_v1';
const ids=DOSSIER_FEARS.map(fear=>fear.id);
const dossier=document.getElementById('fearDossier');
const database=document.getElementById('database');
const profile=dossier?.querySelector('.fear-profile');

function createDossierWorld(){
  const stage=document.createElement('div');stage.className='fear-card-stage';stage.setAttribute('aria-hidden','true');
  const shade=document.createElement('div');shade.className='fear-card-shade';shade.setAttribute('aria-hidden','true');
  const bar=document.createElement('section');bar.className='fear-card-chapter';bar.setAttribute('aria-label','Страх Клауса Штурма');
  bar.innerHTML='<div class="fear-card-caption"><span class="fear-card-kicker">FEAR / ВНУТРИ СТРАХА</span><h3 id="fearCardName" aria-live="polite"></h3><p id="fearCardSubtitle"></p></div><div class="fear-card-choices"><span id="fearCardCount"></span><button id="fearCardNext" type="button" aria-label="Показать другой случайный страх">Другой страх <span aria-hidden="true">↗</span></button><select id="fearCardSelect" aria-label="Выбрать страх"></select></div>';
  dossier.querySelector('.fear-file-header').after(bar);profile.prepend(stage,shade);dossier.classList.add('fear-world-dossier');
  const title=bar.querySelector('#fearCardName'),subtitle=bar.querySelector('#fearCardSubtitle');
  const select=bar.querySelector('select'),next=bar.querySelector('button'),counter=bar.querySelector('#fearCardCount');
  for(const fear of DOSSIER_FEARS){const option=document.createElement('option');option.value=fear.id;option.textContent=fear.title;select.append(option);}
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const pointer={x:0,y:0},target={x:0,y:0};
  let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch{}
  let active=false,inView=true,scene=null,camera=null,renderer=null,kit=null,root=null,canvas=null;
  let selected=null,frame=0,lastFrame=0,elapsed=0,pulse=0,software=false,disposed=false,renderCount=0;
  function save(){try{localStorage.setItem(STORE,JSON.stringify(saved));}catch{}}
  function visible(){return !dossier.hidden&&database.classList.contains('active');}
  function size(){if(!renderer||!camera)return;const rect=stage.getBoundingClientRect();const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);if(motion.matches)draw(performance.now());}
  function createRenderer(){
    scene=new T.Scene();scene.fog=new T.FogExp2('#030508',.055);
    camera=new T.PerspectiveCamera(43,1,.1,80);camera.position.set(1.4,1.5,12.4);camera.lookAt(0,0,0);
    scene.add(new T.HemisphereLight('#cbd7e6','#0b0a12',2.5));
    const key=new T.DirectionalLight('#dce9ff',3.4);key.position.set(-4,7,6);scene.add(key);
    const edge=new T.PointLight('#a6c6df',38,25,2);edge.position.set(4,1,-3);scene.add(edge);
    const front=new T.PointLight('#fff4e5',13,20,2);front.position.set(-2,-1,5);scene.add(front);
    canvas=document.createElement('canvas');canvas.className='fear-card-canvas';
    try{
      renderer=new T.WebGLRenderer({canvas,antialias:devicePixelRatio<2,alpha:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(max-width:700px)').matches?1.35:1.65));
      renderer.setClearColor('#030508',0);renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;software=false;
      canvas.addEventListener('webglcontextlost',contextLost);
    }catch{canvas=document.createElement('canvas');canvas.className='fear-card-canvas';renderer=createSoftwareFearRenderer(canvas,scene,camera);software=true;}
    stage.replaceChildren(canvas);stage.dataset.renderer=software?'software':'webgl';
  }
  function contextLost(event){event.preventDefault();if(disposed||!active)return;cancelAnimationFrame(frame);frame=0;renderer.dispose();canvas.remove();canvas=document.createElement('canvas');canvas.className='fear-card-canvas';renderer=createSoftwareFearRenderer(canvas,scene,camera);software=true;stage.replaceChildren(canvas);stage.dataset.renderer='software';size();schedule();}
  function setFear(id){
    const fear=DOSSIER_FEARS.find(item=>item.id===id);if(!fear)return;
    cancelAnimationFrame(frame);frame=0;
    selected=fear;title.textContent=fear.title;subtitle.textContent=fear.subtitle;select.value=id;
    counter.textContent=String(DOSSIER_FEARS.indexOf(fear)+1).padStart(2,'0')+' / '+ids.length;
    dossier.dataset.fearWorld=id;dossier.style.setProperty('--fear-world-accent',fear.accent||'#8f9ca8');
    if(!renderer)createRenderer();
    if(kit){scene.remove(root);kit.dispose();}
    root=new T.Group();scene.add(root);
    kit=createFearKit(root,Math.floor(Math.random()*0xffffffff),software||innerWidth<700?'low':'normal');
    fear.build(kit);root.position.x=innerWidth<700?0:2.25;
    pulse=0;elapsed=0;lastFrame=0;size();draw(performance.now());schedule();
  }
  function randomFear(){const chosen=chooseDossierFear(ids,saved);saved=chosen.state;save();setFear(chosen.id);}
  function choose(id){if(!ids.includes(id))return;saved={last:id,remaining:(saved.remaining||[]).filter(value=>value!==id)};save();setFear(id);}
  function schedule(){if(!frame&&active&&inView&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(!active||!renderer)return;
    if(software&&lastFrame&&now-lastFrame<100&&!motion.matches){schedule();return;}
    const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;elapsed+=dt;
    pointer.x+=(target.x-pointer.x)*.065;pointer.y+=(target.y-pointer.y)*.065;pulse=Math.max(0,pulse-dt*.65);
    root.position.x=(innerWidth<700?0:2.25)+pointer.x*.22;
    root.rotation.y=pointer.x*.12;root.rotation.x=pointer.y*.04;
    kit.tick(motion.matches?1.7:elapsed,dt,pointer,pulse);
    camera.position.x=1.4+pointer.x*.75;camera.position.y=1.5-pointer.y*.45;
    camera.lookAt(innerWidth<700?0:.4,0,0);renderer.render(scene,camera);renderCount++;
    schedule();
  }
  function open(){if(active)return;active=true;disposed=false;randomFear();}
  function close(){
    if(!active&&!renderer)return;active=false;disposed=true;cancelAnimationFrame(frame);frame=0;
    if(kit){kit.dispose();kit=null;}if(renderer){renderer.dispose();if(!software)renderer.forceContextLoss();renderer=null;}
    stage.replaceChildren();scene=camera=root=canvas=null;pointer.x=pointer.y=target.x=target.y=0;
  }
  function sync(){visible()?open():close();}
  next.addEventListener('click',randomFear);select.addEventListener('change',()=>choose(select.value));
  profile.addEventListener('pointermove',event=>{if(motion.matches)return;const rect=profile.getBoundingClientRect();target.x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));target.y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));},{passive:true});
  profile.addEventListener('pointerleave',()=>{target.x=target.y=0;},{passive:true});
  profile.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select,textarea,a'))return;pulse=1;},{passive:true});
  const observer=new MutationObserver(sync);observer.observe(dossier,{attributes:true,attributeFilter:['hidden']});observer.observe(database,{attributes:true,attributeFilter:['class']});
  const intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView){cancelAnimationFrame(frame);frame=0;}else{lastFrame=0;schedule();}},{root:database,rootMargin:'100px'});intersection.observe(profile);
  const resize=new ResizeObserver(size);resize.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{lastFrame=0;schedule();}});
  motion.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;if(active){draw(performance.now());schedule();}});
  window.addEventListener('pagehide',close);sync();
  return {open,close,next:randomFear,choose,get state(){return {active,id:selected?.id,title:selected?.title,count:ids.length,renderer:software?'software':'webgl',running:!!frame,renderCount,remaining:saved.remaining?.length||0,meshes:root?(()=>{let count=0;root.traverse(o=>{if(o.isMesh)count++;});return count;})():0};}};
}
if(profile&&dossier&&database)window.FearCardWorld=createDossierWorld();
