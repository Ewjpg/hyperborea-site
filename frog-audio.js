(() => {
  'use strict';
  const audio=document.getElementById('frogScore'),toggle=document.getElementById('frogMusicToggle');
  const volume=document.getElementById('frogMusicVolume'),level=document.getElementById('frogMusicLevel'),status=document.getElementById('frogMusicStatus');
  if(!audio||!toggle)return;
  let active=false,paused=false,pending=false,resume=false,primed=false,version=0,frame=0,target=.24,ctx=null,gain=null,current=0;
  const key='hyperborea_frog_audio_v1';
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(typeof saved?.paused==='boolean')paused=saved.paused;}catch{}
  // The level comes from the shared sound mixer (window.HyperboreaSound).
  const sound=window.HyperboreaSound;target=sound.gain('frog');
  function output(value){current=value;if(gain)gain.gain.value=value;else audio.volume=value;}
  function prepare(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!ctx&&Context)try{ctx=new Context();gain=ctx.createGain();gain.gain.value=current;ctx.createMediaElementSource(audio).connect(gain);gain.connect(ctx.destination);audio.volume=1;}catch{}
    if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});
  }
  function sync(){const playing=pending||!audio.paused;toggle.textContent=playing?'PAUSE':'PLAY';toggle.setAttribute('aria-label',playing?'Приостановить музыку Frog':'Воспроизвести музыку Frog');toggle.setAttribute('aria-pressed',String(playing));}
  function save(){try{localStorage.setItem(key,JSON.stringify({paused}));}catch{}}
  function halt(){version++;pending=false;cancelAnimationFrame(frame);frame=0;audio.pause();output(0);sync();}
  function prime(event){
    if(!event.isTrusted||primed||active)return;
    prepare();output(0);primed=true;const token=version;
    Promise.resolve(audio.play()).then(()=>{if(token===version&&!active){audio.pause();try{audio.currentTime=0;}catch{}}}).catch(()=>{primed=false;});
  }
  document.addEventListener('pointerdown',prime,{capture:true});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')prime(event);},{capture:true});
  function play(){
    if(!active||paused||document.hidden)return;
    const token=++version;prepare();output(0);pending=true;status.textContent='Загрузка темы…';sync();
    audio.play().then(()=>{
      if(token!==version){if(!active||document.hidden)audio.pause();return;}
      pending=false;if(!active||paused||document.hidden){audio.pause();sync();return;}
      status.textContent='';sync();const start=performance.now();
      function fade(now){if(token!==version||!active||audio.paused||document.hidden)return;const t=Math.min(1,(now-start)/1600);output(target*t*t*(3-2*t));if(t<1)frame=requestAnimationFrame(fade);else frame=0;}
      frame=requestAnimationFrame(fade);
    }).catch(error=>{if(token!==version)return;pending=false;status.textContent=error.name==='NotAllowedError'?'Нажми PLAY, чтобы включить тему':'Не удалось загрузить тему — попробуй PLAY';sync();});
  }
  function enter(){halt();active=true;resume=document.hidden&&!paused;try{audio.currentTime=0;}catch{}status.textContent='';if(!paused)play();}
  function exit(){active=false;resume=false;halt();try{audio.currentTime=0;}catch{}}
  toggle.addEventListener('click',()=>{if(!active)return;if(pending||!audio.paused){paused=true;resume=false;halt();}else{paused=false;play();}save();});
  sound.bind(volume,'frog',level);
  sound.subscribe(channel=>{if(channel!=='frog'&&channel!=='master')return;target=sound.gain('frog');if(pending||audio.paused)return;cancelAnimationFrame(frame);frame=0;output(target);});
  audio.addEventListener('play',sync);audio.addEventListener('pause',sync);audio.addEventListener('error',()=>{if(active){halt();status.textContent='Тема недоступна — попробуй PLAY';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){resume=active&&!paused&&(pending||!audio.paused);halt();}else if(active&&resume&&!paused){resume=false;play();}});
  window.addEventListener('pagehide',exit);
  window.FrogAudio={enter,exit,getLevel:()=>current};output(0);sync();
})();
