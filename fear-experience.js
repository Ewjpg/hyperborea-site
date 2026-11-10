import {createFearWorld} from './fear-world.js?v=3';
import {createFearSound} from './fear-sound.js?v=3';

// Opening FEAR's dossier first drags the viewer into one of his fears, drawn at random.
// New fears are added here and get their own set in fear-world.js.
export const FEARS=[{id:'darkness',name:'DARKNESS',label:'СТРАХ ТЕМНОТЫ',objective:'НАЙДИ БЕЛЫЙ ГЛАЗ'}];
export const chooseFear=(roll=Math.random())=>FEARS[Math.min(FEARS.length-1,Math.floor(roll*FEARS.length))];

const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
const GLYPHS='ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&?';

function createFearExperience(screen,database){
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
  const overlay=document.createElement('section');
  overlay.className='fear-xp';overlay.hidden=true;overlay.tabIndex=-1;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Вход в досье Клаус Штурм');
  overlay.innerHTML=`<div class="fear-xp-stage" data-fear="stage"></div>
    <div class="fear-xp-shade" aria-hidden="true"></div><div class="fear-xp-bars" aria-hidden="true"><i></i><i></i></div>
    <div class="fear-xp-veil" data-fear="veil" aria-hidden="true"></div>
    <div class="fear-xp-header"><button type="button" data-fear="leave">← PLAYERS</button><button type="button" data-fear="skip">ПРОПУСТИТЬ ↗</button></div>
    <div class="fear-xp-title" data-fear="title" hidden><p>ТВОЙ СТРАХ</p><h2 data-fear="name"></h2><p data-fear="label"></p></div>
    <div class="fear-xp-hud" data-fear="hud" hidden>
      <p class="fear-xp-objective" data-fear="objective"></p>
      <p class="fear-xp-caption" data-fear="caption" role="status" aria-live="polite"></p>
      <i class="fear-xp-reticle" aria-hidden="true"></i>
      <p class="fear-xp-hint fear-xp-keys">WASD — идти · Shift — бежать<span>Мышь — осмотреться · Пробел — прислушаться · F — фонарь · Esc — пауза</span></p>
      <p class="fear-xp-hint fear-xp-thumbs">Левой рукой — идти · правой — смотреть</p>
      <p class="fear-xp-lock" data-fear="lock">Кликни — и смотри мышью</p>
      <button type="button" class="fear-xp-listen" data-fear="listen"><span>ПРОБЕЛ · </span>ПРИСЛУШАТЬСЯ<b data-fear="wait"></b></button>
      <button type="button" class="fear-xp-torch" data-fear="torch" aria-label="Фонарь"><span>F · </span><em data-fear="torchLabel">ФОНАРЬ</em><i aria-hidden="true"><b></b></i></button>
      <button type="button" class="fear-xp-touch" data-fear="touch" hidden><span>E · </span>КОСНУТЬСЯ ВЗГЛЯДА</button>
      <div class="fear-xp-stick" data-fear="stick" aria-hidden="true"><i></i></div>
    </div>
    <div class="fear-xp-pause" data-fear="pause" hidden><div><p>ТЕМНОТА ПОДОЖДЁТ</p><h2>Пауза</h2>
      <button type="button" class="fear-xp-primary" data-fear="resume">ПРОДОЛЖИТЬ</button>
      <button type="button" data-fear="dossier">СРАЗУ В ДОСЬЕ</button><button type="button" data-fear="leave">← PLAYERS</button></div></div>`;
  screen.append(overlay);
  const $=name=>overlay.querySelector(`[data-fear="${name}"]`);
  const stage=$('stage'),veil=$('veil'),skip=$('skip'),title=$('title'),hud=$('hud'),caption=$('caption'),listen=$('listen'),touch=$('touch'),stick=$('stick'),pausePanel=$('pause'),lockHint=$('lock'),torchButton=$('torch');
  let world=null,sound=null,fear=FEARS[0],state='off',phase='',handlers={},timers=[],epoch=0,drag=null,steer=null;

  function later(fn,ms){const token=epoch;timers.push(setTimeout(()=>{if(token===epoch)fn();},ms));}
  const canvas=()=>stage.querySelector('canvas');
  const locked=()=>!!canvas()&&document.pointerLockElement===canvas();
  function unlockPointer(){if(locked())document.exitPointerLock?.();}
  function releaseInput(){world?.keys.clear();if(world){world.stick.x=world.stick.y=0;}drag=null;steer=null;stick.classList.remove('active');}

  function reset(){
    epoch++;timers.forEach(clearTimeout);timers=[];unlockPointer();releaseInput();
    world?.dispose();sound?.dispose();world=null;sound=null;state='off';phase='';
    overlay.hidden=true;overlay.className='fear-xp';delete overlay.dataset.phase;
    title.hidden=hud.hidden=pausePanel.hidden=true;touch.hidden=true;caption.textContent='';caption.classList.remove('shown');
    veil.style.opacity='1';veil.style.background='#000';
    database.inert=false;screen.classList.remove('fear-xp-active');
  }
  function open(next={}){
    if(state!=='off')return false;
    fear=chooseFear();
    sound=createFearSound();sound.unlock(); // still inside the click that opened the card
    try{world=createFearWorld(stage,{veil,sound,reducedMotion:motion.matches,coarse:coarse.matches,onEvent:event});}
    catch(error){console.warn('FEAR scene:',error);sound.dispose();sound=null;stage.replaceChildren();return false;}
    handlers=next;state='running';
    $('name').textContent=fear.name;$('label').textContent=fear.label;$('objective').textContent=fear.objective;
    overlay.hidden=false;overlay.classList.toggle('fear-xp-coarse',coarse.matches);
    skip.textContent='ПРОПУСТИТЬ ↗';database.inert=true;screen.classList.add('fear-xp-active');
    world.start();overlay.focus({preventScroll:true});
    return true;
  }
  function scramble(element,text){
    if(motion.matches){element.textContent=text;return;}
    let frame=0;const total=20;
    const tick=()=>{
      frame++;element.textContent=[...text].map((letter,i)=>frame>total*(i+1)/text.length?letter:GLYPHS[Math.random()*GLYPHS.length|0]).join('');
      if(frame<=total)later(tick,48);
    };
    tick();
  }
  function event(type,detail={}){
    if(type==='phase'){
      phase=detail.phase;overlay.dataset.phase=phase;
      title.hidden=phase!=='title';hud.hidden=phase!=='explore';
      if(phase==='title')scramble($('name'),fear.name);
      if(phase==='explore'){
        skip.textContent='В ДОСЬЕ ↗';$('objective').classList.add('shown');
        later(()=>$('objective').classList.remove('shown'),5200);
      }
      if(phase==='found'||phase==='leaving'){unlockPointer();releaseInput();touch.hidden=true;}
    }else if(type==='hud'){
      touch.hidden=!detail.near;
      if('ready' in detail){listen.disabled=!detail.ready;listen.style.setProperty('--cooldown',String(detail.cooldown));$('wait').textContent=detail.ready||!detail.wait?'':' · '+detail.wait;}
      if('torch' in detail){
        torchButton.dataset.state=detail.torch;torchButton.disabled=!detail.canLight&&detail.torch!=='on';torchButton.style.setProperty('--battery',String(detail.battery));
        $('torchLabel').textContent=detail.torch==='dead'?'ФОНАРЬ СЕЛ':detail.torch==='off'?'ФОНАРЬ ВЫКЛ':'ФОНАРЬ';
      }
    }else if(type==='caption'){
      caption.textContent=detail.text;caption.classList.add('shown');
      later(()=>caption.classList.remove('shown'),3200);
    }else if(type==='complete')complete();
  }
  // The dossier appears under the white flash, then the flash fades away.
  function complete(){
    if(state==='off'||state==='leaving')return;
    state='leaving';unlockPointer();releaseInput();
    database.inert=false;overlay.classList.add('fear-xp-leaving');screen.classList.remove('fear-xp-active');
    const done=handlers.onComplete;handlers={};done?.();
    later(reset,motion.matches?60:1050);
  }
  function cancel(){
    if(state==='off'||state==='leaving')return;
    const done=handlers.onCancel;handlers={};reset();done?.();
  }
  function pause(){
    if(state!=='running'||['found','leaving','done'].includes(phase))return;
    state='paused';releaseInput();unlockPointer();world.pause();sound.pause();
    pausePanel.hidden=false;$('resume').focus({preventScroll:true});
  }
  function resume(){
    if(state!=='paused')return;
    state='running';pausePanel.hidden=true;world.resume();sound.resume();overlay.focus({preventScroll:true});
  }

  skip.addEventListener('click',()=>{if(state!=='running')return;if(phase==='explore')world.finish();else world.skip();});
  overlay.querySelectorAll('[data-fear="leave"]').forEach(button=>button.addEventListener('click',cancel));
  $('resume').addEventListener('click',resume);
  $('dossier').addEventListener('click',()=>{if(state!=='paused')return;resume();world.finish();});
  listen.addEventListener('click',()=>{if(state==='running')world.listen();});
  touch.addEventListener('click',()=>{if(state==='running')world.touch();});
  torchButton.addEventListener('click',()=>{if(state==='running')world.torch();});

  // Keys are caught before the site's own shortcuts while the fear is on screen.
  window.addEventListener('keydown',key=>{
    if(state==='off')return;
    key.stopPropagation();
    if(key.key==='Escape'){key.preventDefault();if(state==='paused')resume();else pause();return;}
    if(key.key==='Tab'){
      const buttons=[...overlay.querySelectorAll('button:not([disabled])')].filter(button=>button.getClientRects().length);
      key.preventDefault();if(!buttons.length)return;
      const index=buttons.indexOf(document.activeElement);buttons[(index+(key.shiftKey?-1:1)+buttons.length)%buttons.length].focus({preventScroll:true});
      return;
    }
    if(state!=='running'||phase!=='explore')return;
    if(MOVE_KEYS.has(key.code)){key.preventDefault();world.keys.add(key.code);}
    else if(key.code==='Space'){key.preventDefault();if(!key.repeat)world.listen();}
    else if(key.code==='KeyE'&&!key.repeat)world.touch();
    else if(key.code==='KeyF'&&!key.repeat)world.torch();
  },true);
  window.addEventListener('keyup',key=>{if(state!=='off'){world?.keys.delete(key.code);}},true);

  // Mouse: click to look with the mouse (pointer lock), or drag. Touch: left thumb walks, right thumb looks.
  stage.addEventListener('pointerdown',down=>{
    if(state!=='running'||phase!=='explore')return;
    if(down.pointerType==='mouse'){
      if(!locked())try{Promise.resolve(canvas()?.requestPointerLock?.()).catch(()=>{});}catch{}
      drag={id:down.pointerId,x:down.clientX,y:down.clientY};return;
    }
    down.preventDefault();stage.setPointerCapture?.(down.pointerId);
    const box=overlay.getBoundingClientRect();
    if(down.clientX<box.left+box.width*.45&&!steer){
      steer={id:down.pointerId,x:down.clientX,y:down.clientY};
      stick.style.left=down.clientX-box.left+'px';stick.style.top=down.clientY-box.top+'px';stick.classList.add('active');
    }else if(!drag)drag={id:down.pointerId,x:down.clientX,y:down.clientY};
  });
  stage.addEventListener('pointermove',moved=>{
    if(state!=='running'||!world)return;
    if(moved.pointerType==='mouse'&&locked()){world.look(clamp(moved.movementX,150),clamp(moved.movementY,150));return;}
    if(steer?.id===moved.pointerId){
      const dx=moved.clientX-steer.x,dy=moved.clientY-steer.y,length=Math.hypot(dx,dy),k=Math.min(1,length/52)/(length||1);
      world.stick.x=dx*k;world.stick.y=dy*k;stick.firstElementChild.style.transform=`translate(${dx*k*30}px,${dy*k*30}px)`;
    }else if(drag?.id===moved.pointerId){
      const speed=moved.pointerType==='mouse'?1:1.7;
      world.look((moved.clientX-drag.x)*speed,(moved.clientY-drag.y)*speed);drag.x=moved.clientX;drag.y=moved.clientY;
    }
  });
  const lift=up=>{
    if(steer?.id===up.pointerId){steer=null;if(world){world.stick.x=world.stick.y=0;}stick.classList.remove('active');stick.firstElementChild.style.transform='';}
    if(drag?.id===up.pointerId)drag=null;
  };
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,lift);
  document.addEventListener('pointerlockchange',()=>{overlay.classList.toggle('fear-xp-locked',locked());if(!locked())drag=null;});
  function clamp(value,limit){return Math.max(-limit,Math.min(limit,value));}

  window.addEventListener('resize',()=>world?.resize(),{passive:true});
  window.addEventListener('blur',()=>{if(state==='running'&&phase==='explore')pause();else releaseInput();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',reset);

  return{open,reset,cancel,pause,resume,
    get active(){return state!=='off';},
    get state(){return{state,phase,world:world?.state??null,sound:sound?.state??null};},
    get world(){return world;}};
}

window.FearExperience=createFearExperience(document.getElementById('screen'),document.getElementById('database'));
