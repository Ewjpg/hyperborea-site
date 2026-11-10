import {createKleExperience} from './kle-experience.js?v=58';
import {STAT_AXES, parseRating} from './rating-model.mjs?v=36';
import {createProfileRadar} from './player-ratings.mjs?v=36';

(() => {
  'use strict';
  const screen=document.getElementById('screen'),database=document.getElementById('database');
  const section=document.getElementById('dbSection'),roster=document.getElementById('playersRoster');
  const dossier=document.getElementById('wahDossier'),card=document.getElementById('wahCard');
  const overlay=document.getElementById('wahPuzzleOverlay'),title=document.getElementById('wahTitle');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let opened=false,busy=false,swapping=false,finishTransition=null,runId=0,timer=0,animations=[];
  const experience=createKleExperience({screen,database,onCancel:()=>close(),onComplete:()=>{
    if(!opened)return;
    dossier.hidden=false;database.inert=false;busy=false;
    document.getElementById('dbPath').textContent='HYPERBOREA / PLAYERS / КЛЕ ЭНИГМ';
    database.scrollTop=0;if(!document.hidden)title.focus({preventScroll:true});startBlue();ambience();
  }});
  let pointerFrame=0;
  let blueCycle=0,blueEnd=0;
  function stopBlue(){
    clearInterval(blueCycle);clearTimeout(blueEnd);blueCycle=0;blueEnd=0;
    dossier.classList.remove('wah-blue-pulse');
  }
  function startBlue(){
    stopBlue();
    if(!opened||busy||document.hidden||motion.matches)return;
    blueCycle=setInterval(()=>{
      if(!opened||busy||document.hidden||motion.matches)return;
      dossier.classList.add('wah-blue-pulse');
      clearTimeout(blueEnd);
      blueEnd=setTimeout(()=>{dossier.classList.remove('wah-blue-pulse');blueEnd=0;},1300);
    },5000);
  }
  const ambience=()=>window.HyperboreaAmbience?.refresh();
  function theme(active){
    database.classList.toggle('wah-theme',active);screen.classList.toggle('wah-active',active);
    document.getElementById('dbNetworkStatus').textContent='CONNECTION STABLE';
    ambience();
  }
  function clearScene(){
    cancelAnimationFrame(pointerFrame);pointerFrame=0;
    dossier.style.setProperty('--wah-rx','0deg');dossier.style.setProperty('--wah-ry','0deg');
  }
  function deactivate(restore){
    stopBlue();
    window.WahAudio?.exit();
    opened=false;dossier.hidden=true;theme(false);clearScene();
    if(restore){section.hidden=false;roster.hidden=false;document.getElementById('dbPath').textContent='HYPERBOREA / PLAYERS';database.scrollTop=0;}
  }
  function cancelPuzzle(){
    if(finishTransition){finishTransition();return;}
    clearTimeout(timer);animations.forEach(animation=>animation.cancel());animations=[];
    overlay.hidden=true;overlay.replaceChildren();database.inert=experience.active;busy=experience.active;runId++;
  }
  function cloneView(){
    const copy=database.cloneNode(true);
    const originals=database.querySelectorAll('input,textarea');
    copy.querySelectorAll('input,textarea').forEach((field,i)=>{field.value=originals[i].value;});
    copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    copy.classList.add('wah-piece-snapshot');copy.inert=true;copy.setAttribute('aria-hidden','true');
    copy.querySelectorAll('button,input,textarea').forEach(element=>{element.disabled=true;element.tabIndex=-1;});
    return copy;
  }
  function piecePath(x,y,w,h,col,row,cols,rows){
    const n=value=>Number(value.toFixed(2));
    let path='M'+n(x)+' '+n(y);
    function edge(ax,ay,bx,by,sign){
      if(!sign){path+='L'+n(bx)+' '+n(by);return;}
      const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy),tx=dx/length,ty=dy/length;
      const nx=-ty,ny=tx,amplitude=Math.min(w,h)*.1*sign;
      const point=(t,b)=>[n(ax+dx*t+nx*amplitude*b),n(ay+dy*t+ny*amplitude*b)].join(' ');
      path+='L'+point(.38,0)+'C'+point(.44,0)+' '+point(.44,.25)+' '+point(.42,.55);
      path+='C'+point(.38,1.2)+' '+point(.43,1.5)+' '+point(.5,1.5);
      path+='C'+point(.57,1.5)+' '+point(.62,1.2)+' '+point(.58,.55);
      path+='C'+point(.56,.25)+' '+point(.56,0)+' '+point(.62,0)+'L'+point(1,0);
    }
    const direction=(a,b)=>(a+b)%2?1:-1;
    edge(x,y,x+w,y,row===0?0:direction(col,row));
    edge(x+w,y,x+w,y+h,col===cols-1?0:direction(col+1,row));
    edge(x+w,y+h,x,y+h,row===rows-1?0:-direction(col,row+1));
    edge(x,y+h,x,y,col===0?0:-direction(col,row));
    return path+'Z';
  }
  function puzzleTransition(swap,done){
    cancelPuzzle();
    const version=++runId,source=cloneView(),scroll=database.scrollTop;
    const width=screen.clientWidth,height=screen.clientHeight,phone=matchMedia('(pointer:coarse)').matches||width<700;
    const cols=phone?3:4,rows=3,cw=width/cols,ch=height/rows;
    overlay.replaceChildren();overlay.hidden=false;busy=true;database.inert=true;
    const end=()=>{
      if(version!==runId)return;
      runId++;finishTransition=null;clearTimeout(timer);
      animations.forEach(animation=>animation.cancel());animations=[];
      overlay.hidden=true;overlay.replaceChildren();database.inert=experience.active;busy=experience.active;
      done?.();
    };
    finishTransition=end;
    if(!motion.matches){
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const piece=document.createElement('div');piece.className='wah-puzzle-piece';
        const path=piecePath(col*cw,row*ch,cw,ch,col,row,cols,rows);
        piece.style.setProperty('--piece-clip','path("'+path+'")');
        piece.style.transformOrigin=((col+.5)*cw)+'px '+((row+.5)*ch)+'px';
        const depth=document.createElement('div');depth.className='wah-piece-depth';
        for(let layer=8;layer>=1;layer--){const side=document.createElement('div');side.className='wah-piece-side';side.style.transform='translateZ('+(-layer*4)+'px)';side.style.background=layer%2?'#81a8d9':'#3978c1';piece.append(side);}
        const face=document.createElement('div');face.className='wah-piece-face';
        const snapshot=source.cloneNode(true);snapshot.inert=true;face.appendChild(snapshot);
        piece.append(depth,face);overlay.appendChild(piece);snapshot.scrollTop=scroll;
        const dx=(col+.5)/cols-.5,dy=(row+.5)/rows-.5;
        const spin=(col+row)%2?1:-1;
        const translateX=dx*width*1.7+(dx===0?spin*width*.15:0),translateY=dy*height*1.5;
        const delay=Math.round((Math.abs(dx)+Math.abs(dy))*180+(col%2)*35);
        animations.push(piece.animate([
          {transform:'translate3d(0,0,0) rotateX(0deg) rotateY(0deg)',opacity:1,offset:0},
          {transform:`translate3d(${dx*22}px,${dy*22}px,65px) rotateX(${dy*-14}deg) rotateY(${dx*20}deg)`,opacity:1,offset:.2},
          {transform:`translate3d(${dx*120}px,${dy*100}px,240px) rotateX(${dy*-48}deg) rotateY(${dx*55}deg) rotateZ(${spin*4}deg)`,opacity:1,offset:.48},
          {transform:`translate3d(${translateX}px,${translateY}px,760px) rotateX(${dy*-130+spin*20}deg) rotateY(${dx*125+spin*10}deg) rotateZ(${spin*22}deg)`,opacity:0,offset:1}
        ],{duration:1180,delay,easing:'cubic-bezier(.42,.02,.2,1)',fill:'both'}));
      }
    }
    swapping=true;
    try{swap();}finally{swapping=false;}
    if(motion.matches){timer=setTimeout(end,100);}
    else{
      Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{if(version===runId)end();});
      timer=setTimeout(end,1700);
    }
  }
  function open(options){
    if(opened||busy||window.FrogArchive?.busy||window.FrogArchive?.isOpen||window.HyperboreaTransitions?.busy||!database.classList.contains('active')||section.hidden||roster.hidden)return false;
    window.FearArchive?.reset();window.EmilianoAudio?.exit();window.WahAudio?.exit();window.FrogAudio?.exit();
    const forced=['metavision','rubik'].includes(options?.variant)?options.variant:undefined;
    puzzleTransition(()=>{
      opened=true;section.hidden=true;roster.hidden=true;dossier.hidden=true;theme(true);
      experience.showGate(forced);
      document.getElementById('dbPath').textContent='HYPERBOREA / PLAYERS / КЛЕ ЭНИГМ';database.scrollTop=0;
    },()=>{if(opened&&experience.active){busy=true;database.inert=true;experience.focusGate();}});
    return true;
  }
  function close(){
    if(!opened)return;
    stopBlue();
    if(experience.active){experience.reset();cancelPuzzle();deactivate(true);busy=false;card.focus({preventScroll:true});return;}
    puzzleTransition(()=>deactivate(true),()=>{if(!opened&&database.classList.contains('active'))card.focus({preventScroll:true});});
  }
  function exitTo(swap,done){
    if(!opened)return false;
    stopBlue();
    if(experience.active){experience.reset();cancelPuzzle();deactivate(false);swap();done?.();return true;}
    puzzleTransition(()=>{deactivate(false);swap();},done);return true;
  }
  function reset(){
    if(swapping){experience.reset();deactivate(false);return;}
    const restore=opened;
    experience.reset();cancelPuzzle();deactivate(restore);
  }
  card.addEventListener('click',open);document.getElementById('wahReturn').addEventListener('click',close);
  const art=dossier.querySelector('.wah-art');
  art.addEventListener('pointermove',event=>{
    if(!opened||busy||event.pointerType==='touch'||motion.matches)return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame=requestAnimationFrame(()=>{
      const bounds=art.getBoundingClientRect();
      const x=Math.max(-.5,Math.min(.5,(event.clientX-bounds.left)/bounds.width-.5));
      const y=Math.max(-.5,Math.min(.5,(event.clientY-bounds.top)/bounds.height-.5));
      dossier.style.setProperty('--wah-rx',(-y*9).toFixed(2)+'deg');dossier.style.setProperty('--wah-ry',(x*11).toFixed(2)+'deg');
    });
  },{passive:true});
  art.addEventListener('pointerleave',clearScene,{passive:true});
  window.addEventListener('resize',()=>{if(busy&&!experience.active)cancelPuzzle();clearScene();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!experience.active)cancelPuzzle();clearScene();stopBlue();}else if(opened&&!busy)startBlue();});
  window.addEventListener('pagehide',reset);
  motion.addEventListener('change',()=>{if(!experience.active)cancelPuzzle();clearScene();if(motion.matches)stopBlue();else if(opened&&!busy)startBlue();});
  dossier.querySelectorAll('[data-wah-scroll]').forEach(button=>button.addEventListener('click',()=>{
    const target=document.getElementById(button.dataset.wahScroll);if(!target)return;
    target.focus({preventScroll:true});target.scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});
  }));

  const axes=STAT_AXES,inputs=axes.map(axis=>document.getElementById('wahStat'+axis));
  const position=document.getElementById('wahPosition'),description=document.getElementById('wahDescription'),weapon=document.getElementById('wahWeapon');
  const profileKey='hyperborea_wahhiyyy_profile_v1';
  const rating=parseRating,updateRadar=createProfileRadar('wah');
  function draw(){
    const values=inputs.map(input=>rating(input.value));updateRadar(values);
    document.getElementById('wahDescriptionCount').textContent=description.value.length+' / 12000';document.getElementById('wahWeaponCount').textContent=weapon.value.length+' / 6000';
    return values;
  }
  function save(target){
    const ratings=draw();const state=document.getElementById(target==='weapon'?'wahWeaponSaveState':'wahSaveState');
    try{localStorage.setItem(profileKey,JSON.stringify({position:position.value,ratings,description:description.value,weapon:weapon.value}));state.textContent='Сохранено на этом устройстве';}
    catch{state.textContent='Изменения доступны до закрытия страницы';}
  }
  try{
    const saved=JSON.parse(localStorage.getItem(profileKey)||'null');
    if(saved&&typeof saved==='object'){
      if(typeof saved.position==='string')position.value=saved.position.slice(0,40);
      if(typeof saved.description==='string')description.value=saved.description.slice(0,12000);
      if(typeof saved.weapon==='string')weapon.value=saved.weapon.slice(0,6000);
      if(Array.isArray(saved.ratings))inputs.forEach((input,i)=>{input.value=rating(saved.ratings[i])??'';});
    }
  }catch{}
  inputs.forEach(input=>input.addEventListener('input',()=>{input.value=rating(input.value)??'';save('ratings');}));
  position.addEventListener('input',()=>save('position'));description.addEventListener('input',()=>save('description'));weapon.addEventListener('input',()=>save('weapon'));draw();
  window.WahArchive={open,close,reset,exitTo,get isOpen(){return opened;},get busy(){return busy;},get entranceState(){return experience.state;}};
})();
