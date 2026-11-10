(() => {
  'use strict';
  const score=document.getElementById('wahScore');
  const preview=document.getElementById('wahPreview');
  const card=document.getElementById('wahCard');
  const database=document.getElementById('database');
  const section=document.getElementById('dbSection'),roster=document.getElementById('playersRoster');
  const toggle=document.getElementById('wahMusicToggle');
  const volume=document.getElementById('wahMusicVolume');
  const level=document.getElementById('wahMusicLevel');
  const status=document.getElementById('wahMusicStatus');
  const settingsKey='hyperborea_wahhiyyy_audio_v1';
  let active=false,userPaused=false,resumeAfterHidden=false,pending=false;
  const entryStart=65;
  let entrySeek=null;
  const scoreSource=score.getAttribute('src');
  score.dataset.source=scoreSource;
  let scoreObjectURL=null,scoreSourcePromise=null;
  let targetVolume=.28,fadeFrame=0,request=0;
  let hovered=false,focused=false,suppressPreview=false,previewWanted=false,previewFrame=0,previewRequest=0;
  let audioContext=null;
  const outputs=new Map(),levels=new Map(),primed=new Set();
  // The first entry starts at 1:05. Native looping then returns to 0:00.
  score.loop=true;
  function seekEntry(){
    if(!active||entrySeek===null||!scoreObjectURL||score.src!==scoreObjectURL||score.readyState<1||!Number.isFinite(score.duration)||score.duration<=0)return;
    try{
      const target=Math.min(entrySeek,Math.max(0,score.duration-.05));
      score.currentTime=target;
      if(Math.abs(score.currentTime-target)<.5)entrySeek=null;
    }catch{}
  }
  score.addEventListener('loadedmetadata',seekEntry);
  function prepareScoreSource(){
    // A complete local Blob supports seeking even when the static host does not
    // serve byte ranges. Fetch once, on entry; the roster keeps its light preview.
    if(scoreObjectURL)return Promise.resolve(scoreObjectURL);
    if(!scoreSourcePromise)scoreSourcePromise=fetch(scoreSource).then(response=>{
      if(!response.ok)throw new Error('OST unavailable');
      return response.blob();
    }).then(blob=>scoreObjectURL=URL.createObjectURL(blob)).catch(error=>{
      scoreSourcePromise=null;throw error;
    });
    return scoreSourcePromise;
  }
  function setVolume(audio,value){
    value=Math.max(0,Math.min(1,value));levels.set(audio,value);
    const output=outputs.get(audio);
    if(output)output.gain.value=value;else audio.volume=value;
  }
  function prepareOutput(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!audioContext&&Context){
      try{
        audioContext=new Context();
        for(const audio of [score,preview]){
          const source=audioContext.createMediaElementSource(audio),gain=audioContext.createGain();
          gain.gain.value=levels.get(audio)??0;
          source.connect(gain);gain.connect(audioContext.destination);outputs.set(audio,gain);
          audio.volume=1;
        }
      }catch{}
    }
    if(audioContext&&audioContext.state!=='running')audioContext.resume().catch(()=>{});
  }
  // Prime these specific media elements during a real gesture. Mobile browsers
  // may authorize each element separately; Web Audio keeps priming inaudible.
  function unlock(){
    prepareOutput();
    for(const audio of [score,preview]){
      if(primed.has(audio)||(audio===score?active:previewWanted))continue;
      const version=audio===score?request:previewRequest;
      setVolume(audio,0);primed.add(audio);
      Promise.resolve(audio.play()).then(()=>{
        if(version===(audio===score?request:previewRequest)){
          audio.pause();try{audio.currentTime=0;}catch{}
        }
      }).catch(()=>primed.delete(audio));
    }
  }
  document.addEventListener('pointerdown',event=>{if(event.isTrusted)unlock();},{capture:true});
  document.addEventListener('keydown',event=>{if(event.isTrusted&&(event.key==='Enter'||event.key===' '))unlock();},{capture:true});
  try{
    const saved=JSON.parse(localStorage.getItem(settingsKey)||'null');
    if(saved&&typeof saved.paused==='boolean')userPaused=saved.paused;
  }catch{}
  // Levels come from the shared sound mixer (window.HyperboreaSound); the preview has its own trim.
  const sound=window.HyperboreaSound,previewLevel=()=>sound.gain('wah','preview');
  targetVolume=sound.gain('wah');
  setVolume(score,targetVolume);
  setVolume(preview,0);
  function canPreview(){
    return !active&&!document.hidden&&database.classList.contains('active')&&!section.hidden&&!roster.hidden&&!window.WahArchive?.isOpen&&!window.WahArchive?.busy&&!window.FrogArchive?.isOpen&&!window.FrogArchive?.busy&&!window.SwarggyArchive?.isOpen&&!window.SwarggyArchive?.busy&&!window.HyperboreaTransitions?.busy;
  }
  function stopPreview(immediate=false){
    previewWanted=false;const version=++previewRequest;
    cancelAnimationFrame(previewFrame);previewFrame=0;
    const halt=()=>{preview.pause();setVolume(preview,0);try{preview.currentTime=0;}catch{}};
    if(immediate||preview.paused||(levels.get(preview)??0)===0){halt();return;}
    const started=performance.now(),initial=levels.get(preview)??0;
    function step(now){
      if(version!==previewRequest)return;
      const t=Math.min(1,(now-started)/220);setVolume(preview,initial*(1-t));
      if(t<1)previewFrame=requestAnimationFrame(step);else{previewFrame=0;halt();}
    }
    previewFrame=requestAnimationFrame(step);
  }
  function startPreview(){
    if(previewWanted||userPaused||suppressPreview||!canPreview())return;
    stopPreview(true);previewWanted=true;const version=++previewRequest;
    setVolume(preview,0);
    preview.play().then(()=>{
      if(version!==previewRequest){if(!previewWanted)preview.pause();return;}
      if(!previewWanted||!canPreview()){stopPreview(true);return;}
      const started=performance.now();
      function step(now){
        if(version!==previewRequest)return;
        if(!previewWanted||!canPreview()){stopPreview(true);return;}
        const t=Math.min(1,(now-started)/1600);setVolume(preview,previewLevel()*t*t*(3-2*t));
        if(t<1)previewFrame=requestAnimationFrame(step);else previewFrame=0;
      }
      previewFrame=requestAnimationFrame(step);
    }).catch(()=>{if(version===previewRequest){previewWanted=false;setVolume(preview,0);}});
  }
  card.addEventListener('pointerenter',event=>{
    if(event.pointerType==='touch')return;
    hovered=true;suppressPreview=false;startPreview();
  });
  card.addEventListener('pointerleave',()=>{hovered=false;focused=false;stopPreview();});
  card.addEventListener('mouseleave',()=>stopPreview());
  card.addEventListener('pointercancel',()=>stopPreview(true));
  window.addEventListener('blur',()=>{hovered=false;focused=false;stopPreview(true);});
  card.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||!canPreview())return;
    hovered=true;suppressPreview=false;startPreview();
  },{passive:true});
  card.addEventListener('focus',()=>{focused=card.matches(':focus-visible');if(focused)startPreview();});
  card.addEventListener('blur',()=>{focused=false;if(!hovered)stopPreview();});
  card.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){suppressPreview=true;stopPreview(true);}});
  for(const type of ['pointerenter','focus'])document.getElementById('fearCard').addEventListener(type,()=>stopPreview(true));
  const guard=new MutationObserver(()=>{if(!canPreview())stopPreview(true);});
  for(const element of [database,section,roster])guard.observe(element,{attributes:true,attributeFilter:['class','hidden']});
  function save(){try{localStorage.setItem(settingsKey,JSON.stringify({paused:userPaused}));}catch{}}
  function sync(){
    const playing=!score.paused||pending;
    toggle.textContent=playing?'PAUSE':'PLAY';
    toggle.setAttribute('aria-label',playing?'Приостановить OST wahhiyyy':'Воспроизвести OST wahhiyyy');
    toggle.setAttribute('aria-pressed',String(playing));
  }
  function cancelFade(){cancelAnimationFrame(fadeFrame);fadeFrame=0;}
  function pause(){
    request++;pending=false;cancelFade();score.pause();sync();
  }
  function fadeIn(version){
    cancelFade();
    const started=performance.now();
    function step(now){
      if(version!==request||!active||document.hidden||score.paused)return;
      const t=Math.min(1,(now-started)/1800);
      setVolume(score,targetVolume*t*t*(3-2*t));
      if(t<1)fadeFrame=requestAnimationFrame(step);else fadeFrame=0;
    }
    fadeFrame=requestAnimationFrame(step);
  }
  function play(){
    if(!active||userPaused||document.hidden)return;
    const version=++request;
    prepareOutput();
    seekEntry();
    cancelFade();setVolume(score,0);pending=true;status.textContent='Загрузка темы…';sync();
    // Keep the already primed element authorized while its seekable source loads.
    score.play().catch(()=>{});
    prepareScoreSource().then(url=>{
      if(version!==request||!active||document.hidden||userPaused)return false;
      if(score.src!==url){score.pause();score.src=url;score.load();}
      seekEntry();
      return score.play().then(()=>true);
    }).then(played=>{
      if(!played)return;
      if(version!==request){if(!active||document.hidden)score.pause();return;}
      pending=false;
      if(!active||document.hidden||userPaused){score.pause();sync();return;}
      seekEntry();
      status.textContent='';sync();fadeIn(version);
    }).catch(error=>{
      if(version!==request)return;
      pending=false;sync();
      status.textContent=error.name==='NotAllowedError'?'Нажми PLAY, чтобы включить тему':'Не удалось загрузить тему — попробуй PLAY';
    });
  }
  function enter(){
    suppressPreview=true;stopPreview(true);
    pause();active=true;resumeAfterHidden=false;
    entrySeek=entryStart;seekEntry();
    status.textContent='';
    if(!userPaused)play();
  }
  function exit(){
    suppressPreview=true;stopPreview(true);
    active=false;resumeAfterHidden=false;pause();
    entrySeek=null;
    try{score.currentTime=0;}catch{}
  }
  toggle.addEventListener('click',()=>{
    if(!active)return;
    if(pending||!score.paused){userPaused=true;resumeAfterHidden=false;pause();}
    else{userPaused=false;play();}
    save();
  });
  sound.bind(volume,'wah',level);
  sound.subscribe(channel=>{
    if(channel!=='wah'&&channel!=='master')return;
    targetVolume=sound.gain('wah');
    cancelFade();setVolume(score,pending?0:targetVolume);
    if(previewWanted&&!preview.paused){cancelAnimationFrame(previewFrame);previewFrame=0;setVolume(preview,previewLevel());}
  });
  score.addEventListener('play',sync);score.addEventListener('pause',sync);
  score.addEventListener('error',()=>{
    if(!active)return;
    pending=false;cancelFade();status.textContent='Тема недоступна — попробуй PLAY';sync();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      stopPreview(true);
      resumeAfterHidden=active&&!userPaused&&(pending||!score.paused);pause();
    }else if(active&&resumeAfterHidden&&!userPaused){resumeAfterHidden=false;play();}
    else if((hovered||focused)&&canPreview())startPreview();
  });
  window.addEventListener('pagehide',exit);
  window.WahAudio={enter,exit,getLevel:kind=>levels.get(kind==='preview'?preview:score)??0};sync();
})();

