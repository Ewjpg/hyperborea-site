(() => {
  'use strict';
  const overlay=document.getElementById('bootEventOverlay'),screen=document.getElementById('screen');
  const title=document.getElementById('bootEventTitle'),note=document.getElementById('bootEventNote');
  const timer=document.getElementById('bootEventTimer'),meter=document.getElementById('bootEventMeter');
  const fill=document.getElementById('bootEventFill'),emblem=document.getElementById('bootEventEmblem');
  const icon=document.getElementById('bootCrashIcon'),tears=document.getElementById('bootEventTears');
  const retry=document.getElementById('bootEventReconnect'),playButton=document.getElementById('bootEventPlay');
  const audio=document.getElementById('bootCrashAudio');
  let active=false,kind=null,phase=null,deadline=0,interval=0,transitionTimer=0;
  let resolveEvent=null,eventPromise=null,onActive=()=>{},soundStarted=false,prepared=false;
  let context=null,gain=null;
  function roll(){
    const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
    const value=bytes[0]/4294967296;
    // Locked 1%, reconnect 8%, crash 0.5%.
    return value<.01?'locked':value<.09?'reconnect':value<.095?'crash':null;
  }
  function volume(value){if(gain)gain.gain.value=value;else audio.volume=value;}
  function prepare(event){
    if(event!=='crash')return;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!context&&Context){
        context=new Context();gain=context.createGain();gain.gain.value=0;
        context.createMediaElementSource(audio).connect(gain);gain.connect(context.destination);audio.volume=1;
      }
      if(context&&context.state!=='running')context.resume().catch(()=>{});
      if(prepared)return;
      prepared=true;volume(0);
      Promise.resolve(audio.play()).then(()=>{
        if(!soundStarted){audio.pause();try{audio.currentTime=0;}catch{}}
      }).catch(()=>{prepared=false;});
    }catch{prepared=false;}
  }
  function setPhase(value){phase=value;overlay.dataset.phase=value;}
  function finish(result){
    if(!active)return;
    clearInterval(interval);clearTimeout(transitionTimer);interval=0;transitionTimer=0;
    audio.pause();volume(0);try{audio.currentTime=0;}catch{}
    screen.classList.remove('boot-event-active','boot-event-crashing');
    overlay.hidden=true;tears.replaceChildren();active=false;kind=null;phase=null;
    const resolve=resolveEvent;resolveEvent=null;eventPromise=null;onActive(false,result);resolve?.(result);
  }
  function playSound(){
    if(!active||kind!=='crash'||document.hidden)return;
    soundStarted=true;setPhase('audio');
    volume(window.HyperboreaSound?.gain('terminal','crash')??.4);try{audio.currentTime=0;}catch{}
    if(context&&context.state!=='running')context.resume().catch(()=>{});
    Promise.resolve(audio.play()).then(()=>{
      if(!active||kind!=='crash'){audio.pause();return;}
      playButton.hidden=true;
    }).catch(()=>{
      if(active&&kind==='crash'){playButton.hidden=false;playButton.textContent='[ PLAY AUDIO ]';}
    });
  }
  function tick(){
    if(!active)return;
    const remaining=Math.max(0,deadline-Date.now());
    if(kind==='locked'||kind==='reconnect'){
      const seconds=Math.ceil(remaining/1000);
      timer.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      const duration=kind==='locked'?60000:20000;
      const progress=Math.min(100,Math.max(0,(1-remaining/duration)*100));
      fill.style.width=progress+'%';meter.setAttribute('aria-valuenow',String(Math.round(progress)));
      if(!remaining)finish('continue');
    }else if(kind==='crash'&&phase!=='tear'&&!remaining){
      retry.hidden=false;
      if(!soundStarted&&!document.hidden)playSound();
    }
  }
  function run(event){
    if(active)return eventPromise;
    if(!['locked','reconnect','crash'].includes(event))return Promise.resolve('continue');
    active=true;kind=event;soundStarted=false;overlay.dataset.kind=event;
    eventPromise=new Promise(resolve=>{resolveEvent=resolve;});
    retry.hidden=true;playButton.hidden=true;tears.replaceChildren();
    icon.hidden=true;emblem.hidden=event!=='reconnect';
    title.hidden=event==='crash';note.hidden=event==='crash';timer.hidden=event==='crash';meter.hidden=event==='crash';
    title.textContent=event==='locked'?'ACCESS BLOCKED':'CONNECTION LOST';
    note.textContent=event==='locked'?'AUTOMATIC RETRY IN':'RECONNECTING TO HYPERBOREA...';
    overlay.hidden=false;screen.classList.add('boot-event-active');onActive(true);overlay.focus({preventScroll:true});
    if(event==='crash'){
      setPhase('tear');screen.classList.add('boot-event-crashing');
      for(let i=0;i<12;i++){
        const strip=document.createElement('span');strip.style.setProperty('--strip',i);
        strip.textContent=i%2?'> SYSTEM EXCEPTION // 0x0000 // CONNECTION LOST':'> VERIFYING DATABASE... ACCESS VIOLATION';tears.appendChild(strip);
      }
      transitionTimer=setTimeout(()=>{
        if(!active||kind!=='crash')return;
        screen.classList.remove('boot-event-crashing');tears.replaceChildren();
        icon.hidden=false;setPhase('icon');deadline=Date.now()+10000;tick();
      },1200);
    }else{
      setPhase('countdown');deadline=Date.now()+(event==='locked'?60000:20000);tick();
    }
    interval=setInterval(tick,100);
    return eventPromise;
  }
  retry.addEventListener('click',()=>finish('retry'));
  playButton.addEventListener('click',playSound);
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}
    if(event.key==='Tab'){
      const buttons=[retry,playButton].filter(button=>!button.hidden);
      if(!buttons.length){event.preventDefault();overlay.focus();}
      else if(!buttons.includes(document.activeElement)){event.preventDefault();(event.shiftKey?buttons.at(-1):buttons[0]).focus();}
      else if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
    }
  });
  document.addEventListener('visibilitychange',()=>{
    if(!active)return;
    if(document.hidden)audio.pause();else tick();
  });
  window.addEventListener('pagehide',()=>finish('cancelled'));
  window.BootEvents={roll,prepare,run,cancel:()=>finish('cancelled'),configure:options=>{onActive=options.onActive||(()=>{});},get active(){return active;}};
})();
