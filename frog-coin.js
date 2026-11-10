(() => {
  'use strict';
  const screen=document.getElementById('screen'),database=document.getElementById('database'),roster=document.getElementById('playersRoster');
  if(!screen||!database||!roster)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const dialog=document.createElement('section');dialog.id='frogCoinEvent';dialog.className='frog-coin-event';dialog.hidden=true;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','frogCoinQuestion');dialog.tabIndex=-1;
  dialog.innerHTML='<div class="frog-coin-halo" aria-hidden="true"></div><div class="frog-coin-content"><p class="frog-coin-kicker">FROG / CHANCE ENCOUNTER</p><h2 id="frogCoinQuestion">Думаешь тебе повезет?</h2><div class="frog-coin-stage" aria-hidden="true"><div class="frog-coin" id="frogCoin"><span class="frog-coin-face coin-front"><img src="./assets/bluelock-mark.svg" alt=""></span><span class="frog-coin-face coin-back">♠</span><span class="frog-coin-rim"></span></div><span class="frog-coin-shadow"></span></div><p class="frog-coin-status" id="frogCoinStatus" role="status" aria-live="polite"></p><div class="frog-coin-choices"><button id="frogCoinYes" type="button">Да</button><button id="frogCoinNo" type="button">Нет</button></div></div>';
  screen.append(dialog);
  const coin=dialog.querySelector('#frogCoin'),yes=dialog.querySelector('#frogCoinYes'),no=dialog.querySelector('#frogCoinNo'),status=dialog.querySelector('#frogCoinStatus');
  let active=false,phase='idle',face=null,animation=null,timer=0,epoch=0,enter=null,lose=null;
  function chance(p=.5){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/4294967296<p;}
  function clean(){
    const hadEvent=active;
    epoch++;clearTimeout(timer);timer=0;animation?.cancel();animation=null;
    active=false;phase='idle';dialog.hidden=true;dialog.removeAttribute('data-phase');dialog.removeAttribute('data-face');
    if(hadEvent)database.inert=false;roster.classList.remove('space-suspended');
    enter=lose=null;window.HyperboreaAmbience?.refresh();
  }
  function finish(won){const callback=won?enter:lose;clean();callback?.();}
  function decline(){if(active&&phase==='question')finish(true);}
  function toss(){
    if(!active||phase!=='question')return;
    phase='toss';face=chance()?'blue-lock':'spade';dialog.dataset.phase=phase;
    yes.disabled=no.disabled=true;status.textContent='';
    const token=epoch,turn=face==='blue-lock'?1440:1620;
    const settle=()=>{
      if(!active||token!==epoch||phase!=='toss')return;
      phase='result';dialog.dataset.phase=phase;dialog.dataset.face=face;
      status.textContent=face==='blue-lock'?'Удача на твоей стороне.':'В этот раз — нет.';
      timer=setTimeout(()=>{if(active&&token===epoch)finish(face==='blue-lock');},950);
    };
    if(motion.matches){coin.style.transform=`rotateY(${turn}deg)`;timer=setTimeout(settle,120);return;}
    animation=coin.animate([
      {transform:'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) scale(.9)'},
      {transform:'translate3d(0,-100px,100px) rotateX(430deg) rotateY(570deg) scale(1.05)',offset:.35},
      {transform:'translate3d(0,-75px,60px) rotateX(790deg) rotateY(1120deg) scale(1)',offset:.7},
      {transform:`translate3d(0,0,0) rotateX(1080deg) rotateY(${turn}deg) scale(1)`}
    ],{duration:2900,easing:'cubic-bezier(.28,.05,.25,1)',fill:'forwards'});
    animation.finished.then(settle).catch(()=>{});
  }
  function offer(onEnter,onLose){
    if(active)return true;
    // The coin turns up on one Frog opening in four.
    if(!chance(.25))return false;
    epoch++;active=true;phase='question';face=null;enter=onEnter;lose=onLose;
    coin.style.transform='';yes.disabled=no.disabled=false;status.textContent='';
    dialog.dataset.phase=phase;dialog.hidden=false;database.inert=true;roster.classList.add('space-suspended');
    yes.focus({preventScroll:true});return true;
  }
  yes.addEventListener('click',toss);no.addEventListener('click',decline);
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();decline();}
    if(event.key==='Tab'){
      event.preventDefault();const available=[yes,no].filter(button=>!button.disabled);
      if(!available.length){dialog.focus({preventScroll:true});return;}
      const current=available.indexOf(document.activeElement),direction=event.shiftKey?-1:1;
      available[(current+direction+available.length)%available.length].focus({preventScroll:true});
    }
  });
  document.addEventListener('visibilitychange',()=>{if(active&&phase==='toss'&&animation){if(document.hidden)animation.pause();else animation.play();}});
  motion.addEventListener('change',()=>{if(active&&phase==='toss'&&animation)animation.finish();});
  window.addEventListener('pagehide',clean);
  window.FrogCoin={offer,cancel:clean,get active(){return active;},getState:()=>({active,phase,face})};
})();
