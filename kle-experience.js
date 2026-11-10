import {createKleRubik} from './kle-rubik.js?v=58';

// Kle's metavision is a pre-rendered film. Its own sound effects follow Kle's volume slider;
// the theme music starts only when the profile appears.
const VISION_FILM='./assets/kle-metavision.mp4';
function createVisionFilm(host,{onComplete,onError}){
  const video=document.createElement('video');
  video.className='kle-metavision-video';video.src=VISION_FILM;video.preload='auto';video.playsInline=true;video.setAttribute('aria-hidden','true');
  const sound=window.HyperboreaSound,level=()=>sound?sound.gain('wah','video'):.3;
  video.volume=level();
  const unsubscribe=sound?.subscribe(channel=>{if(channel==='wah'||channel==='master')video.volume=level();});
  let done=false;const end=callback=>{if(done)return;done=true;callback();};
  video.addEventListener('ended',()=>end(()=>onComplete?.()));
  video.addEventListener('error',()=>end(()=>onError?.(new Error('The metavision film could not be played.'))));
  host.append(video);
  return{
    start(){Promise.resolve(video.play()).catch(()=>{video.muted=true;return video.play();}).catch(()=>end(()=>onError?.(new Error('Playback was blocked.'))));},
    dispose(){done=true;unsubscribe?.();video.pause();video.removeAttribute('src');video.load();video.remove();},
    get state(){return{phase:video.ended?'complete':'film',elapsed:video.currentTime,duration:video.duration||0};}
  };
}

export const chooseKleVariant = (roll = Math.random()) => roll < .5 ? 'metavision' : 'rubik';

export function createKleExperience({screen,database,onComplete,onCancel}) {
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const overlay=document.createElement('section');
  overlay.id='kleExperience';overlay.className='kle-experience';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Вход в досье Кле Энигм');overlay.tabIndex=-1;
  overlay.innerHTML=`<div id="kleSceneStage" class="kle-scene-stage" aria-hidden="true"></div>
    <button id="kleGateStart" class="kle-gate" type="button"><span>Нажми, чтобы продолжить</span><i aria-hidden="true">↗</i></button>
    <div class="kle-intro-header"><button id="kleIntroClose" type="button">← PLAYERS</button><button id="kleIntroSkip" type="button">ПРОПУСТИТЬ ↗</button></div>
    <div id="kleCubeControls" class="kle-cube-controls" hidden><p id="kleCubeStatus" role="status" aria-live="polite">Собери кубик</p>
    <div class="kle-face-controls" role="group" aria-label="Выбор грани кубика"><button type="button" data-kle-face="U">Верх</button><button type="button" data-kle-face="D">Низ</button><button type="button" data-kle-face="F">Перед</button><button type="button" data-kle-face="B">Зад</button><button type="button" data-kle-face="L">Лево</button><button type="button" data-kle-face="R">Право</button></div>
    <div class="kle-turn-controls" role="group" aria-label="Поворот выбранной грани"><button id="kleTurnLeft" type="button" aria-label="Повернуть грань против часовой стрелки">↶</button><button id="kleCubeUndo" type="button">ОТМЕНИТЬ ХОД</button><button id="kleTurnRight" type="button" aria-label="Повернуть грань по часовой стрелке">↷</button></div>
    <p class="kle-cube-hint">Потяни за грань, чтобы повернуть её, или за фон — чтобы осмотреть кубик.<span class="kle-key-hint"> Клавиши U D F B L R, Shift — обратно, Z — отменить.</span></p></div>`;
  screen.append(overlay);
  const $=id=>overlay.querySelector('#'+id),stage=$('kleSceneStage'),gate=$('kleGateStart');
  const skip=$('kleIntroSkip'),controls=$('kleCubeControls'),status=$('kleCubeStatus');
  let phase='off',variant=null,rendering='none',scene=null,epoch=0,timers=[],autoRequested=false,audioStarted=false;
  const active=()=>phase!=='off';
  function later(fn,ms){const token=epoch;const timer=setTimeout(()=>{if(token===epoch)fn();},ms);timers.push(timer);}
  function clearScene(){scene?.dispose();scene=null;stage.replaceChildren();}
  function reset(){epoch++;timers.forEach(clearTimeout);timers=[];clearScene();phase='off';rendering='none';autoRequested=false;audioStarted=false;overlay.hidden=true;overlay.classList.remove('kle-leaving');gate.classList.remove('kle-gate-leaving');gate.hidden=false;controls.hidden=true;skip.disabled=false;database.inert=false;screen.classList.remove('kle-intro-active');}
  function ensureAudio(){if(audioStarted)return;audioStarted=true;window.WahAudio?.enter();}
  // The profile appears underneath while the white scene dissolves away.
  function finish(){
    if(!active()||phase==='leaving')return;ensureAudio();
    if(motion.matches){reset();onComplete?.();return;}
    phase='leaving';controls.hidden=true;overlay.classList.add('kle-leaving');screen.classList.remove('kle-intro-active');
    onComplete?.();later(reset,760);
  }
  function cancel(){if(active())onCancel?.();}
  function showGate(forced){reset();variant=['metavision','rubik'].includes(forced)?forced:chooseKleVariant();phase='gate';overlay.dataset.variant=variant;overlay.hidden=false;gate.hidden=false;database.inert=true;screen.classList.add('kle-intro-active');
    // The film starts loading behind the white gate, so it is ready by the time it is pressed.
    if(variant==='metavision'&&!motion.matches)prepareFilm();}
  function prepareFilm(){const token=epoch;scene=createVisionFilm(stage,{onComplete:()=>{if(token===epoch)finish();},onError:()=>{if(token===epoch)visionFallback();}});}
  function focusGate(){if(phase==='gate'&&!document.hidden)gate.focus({preventScroll:true});}
  const faceNames={U:'Верхняя',D:'Нижняя',F:'Передняя',B:'Задняя',L:'Левая',R:'Правая'};
  function cubeUI(value){
    if(phase!=='rubik')return;
    const state=value??scene?.state;if(!state)return;
    if(state.fallback)rendering='fallback';
    const disabled=!!(state.busy||state.solving||state.shattering||autoRequested);
    for(const button of controls.querySelectorAll('button'))button.disabled=disabled;
    $('kleCubeUndo').disabled=disabled||!state.moves;
    skip.disabled=!!(state.solving||state.shattering||autoRequested);
    for(const button of controls.querySelectorAll('[data-kle-face]'))button.setAttribute('aria-pressed',String(button.dataset.kleFace===state.selectedFace));
    status.textContent=state.shattering||state.phase==='solved'?'Собрано!':state.intro?'Кубик собирается…':state.scrambling?'Перемешиваю…':state.solving?'Собирается…':`${faceNames[state.selectedFace]||'Передняя'} грань · Ходов: ${state.moves||0}`;
    if(autoRequested&&!state.busy&&!state.solving&&!state.shattering&&scene){autoRequested=false;queueMicrotask(()=>{if(phase==='rubik')scene?.autoSolve();});}
  }
  function visionFallback(){
    if(!active()||phase!=='metavision'||rendering==='fallback')return;
    clearScene();rendering='fallback';
    stage.innerHTML=`<div class="kle-vision-fallback"><svg class="kle-fallback-eye" viewBox="0 0 400 230"><path d="M22 115Q200-75 378 115Q200 302 22 115Z" fill="#fff" stroke="#111b2c" stroke-width="8"/><g fill="none" stroke="#111b2c" stroke-width="9"><circle cx="200" cy="115" r="75" stroke-dasharray="50 8 14 8"/><circle cx="200" cy="115" r="57" stroke-dasharray="20 7 42 7"/><circle cx="200" cy="115" r="37" stroke-dasharray="16 8"/><circle cx="200" cy="115" r="12"/></g></svg><div class="kle-fallback-pitch"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><svg class="kle-fallback-key" viewBox="0 0 400 240"><rect x="60" y="94" width="130" height="120" rx="15" fill="#1764dc"/><path d="M87 94V65a38 38 0 0 1 76 0v29" fill="none" stroke="#2669ca" stroke-width="15"/><circle cx="125" cy="143" r="13" fill="#fff"/><path d="m119 148-6 28h24l-6-28" fill="#fff"/><g fill="none" stroke="#8ab6f4" stroke-width="15"><circle cx="278" cy="79" r="34"/><path d="M278 113v94m0-14h39m-39-29h27"/></g></svg></div>`;
    later(finish,motion.matches?350:4900);
  }
  function startVision(){
    phase='metavision';controls.hidden=true;
    if(motion.matches){visionFallback();return;}
    rendering='film';if(!scene)prepareFilm();scene.start();
  }
  function startCube(){
    phase='rubik';controls.hidden=false;rendering='webgl';const token=epoch;
    try{scene=createKleRubik(stage,{onComplete:()=>{if(token===epoch)finish();},onChange:cubeUI,onError:()=>{if(token===epoch){rendering='unavailable';controls.hidden=true;stage.innerHTML='<p class="kle-unavailable">Кубик не загрузился. Можно продолжить в профиль.</p>';skip.disabled=false;}}});scene.start();cubeUI(scene.state);}
    catch{rendering='unavailable';controls.hidden=true;stage.innerHTML='<p class="kle-unavailable">Кубик не загрузился. Можно продолжить в профиль.</p>';}
  }
  function start(){if(phase!=='gate')return;
    if(motion.matches)gate.hidden=true;else{gate.classList.add('kle-gate-leaving');later(()=>{gate.hidden=true;},520);}if(variant==='rubik')startCube();else startVision();skip.focus({preventScroll:true});}
  function autoSolve(){
    if(phase==='gate')start();
    if(phase!=='rubik'||rendering==='unavailable'){finish();return;}
    autoRequested=true;cubeUI(scene?.state);
  }
  gate.addEventListener('click',start);
  skip.addEventListener('click',()=>{if(variant==='rubik')autoSolve();else finish();});
  $('kleIntroClose').addEventListener('click',cancel);
  for(const button of controls.querySelectorAll('[data-kle-face]'))button.addEventListener('click',()=>{scene?.selectFace(button.dataset.kleFace);cubeUI();});
  $('kleTurnLeft').addEventListener('click',()=>{if(phase==='rubik')scene?.turn(scene.state.selectedFace,-1);});
  $('kleTurnRight').addEventListener('click',()=>{if(phase==='rubik')scene?.turn(scene.state.selectedFace,1);});
  $('kleCubeUndo').addEventListener('click',()=>{if(phase==='rubik')scene?.undo();});
  // Cube keys work wherever focus is, even after a control button was disabled mid-turn.
  const keyFaces={KeyU:'U',KeyD:'D',KeyF:'F',KeyB:'B',KeyL:'L',KeyR:'R'};
  document.addEventListener('keydown',event=>{
    if(phase!=='rubik'||!scene||overlay.hidden||event.altKey||event.metaKey||event.repeat)return;
    const face=!event.ctrlKey&&keyFaces[event.code];
    if(face){event.preventDefault();scene.turn(face,event.shiftKey?-1:1);return;}
    if(event.code==='KeyZ'||event.key==='Backspace'){event.preventDefault();scene.undo();}
  });
  overlay.addEventListener('keydown',event=>{
    if(phase==='leaving')return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();return;}
    if(event.key==='Tab'){
      const buttons=[...overlay.querySelectorAll('button:not([disabled])')].filter(button=>button.getClientRects().length);
      if(!buttons.length){event.preventDefault();return;}
      const index=buttons.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;
      event.preventDefault();buttons[next].focus({preventScroll:true});
    }
  });
  window.addEventListener('resize',()=>scene?.resize(),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='metavision')finish();});
  motion.addEventListener('change',()=>{if(motion.matches&&phase==='metavision')finish();});
  window.addEventListener('pagehide',reset);
  const api={showGate,focusGate,start,reset,autoSolve,selectFace:face=>scene?.selectFace?.(face),turn:(face,dir)=>scene?.turn?.(face,dir),undo:()=>scene?.undo?.(),get active(){return active();},get state(){return{phase,variant,rendering,cinematic:phase==='metavision'?scene?.state??null:null,cube:phase==='rubik'?scene?.state??null:null};}};
  window.KleExperience=api;return api;
}
