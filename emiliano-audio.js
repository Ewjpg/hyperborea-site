(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const audio=$('emilianoScore'),card=$('emilianoCard'),database=$('database');
  const roster=$('playersRoster'),section=$('dbSection');
  const toggle=$('emilianoMusicToggle'),volume=$('emilianoMusicVolume');
  const level=$('emilianoMusicLevel'),status=$('emilianoMusicStatus');
  if(!audio||!card||!toggle)return;
  const key='hyperborea_emiliano_audio_v1',previewEnd=15;
  const source=audio.getAttribute('src');
  let sourceURL=null,sourcePromise=null;
  let mode='idle',hovered=false,focused=false,suppressed=false,capped=false;
  let userPaused=false,pending=false,resume=false,target=.22,output=0,version=0;
  let frame=0,boundary=0,previous=0,context=null,gain=null;
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(typeof saved?.paused==='boolean')userPaused=saved.paused;}catch{}
  // The level comes from the shared sound mixer (window.HyperboreaSound).
  const sound=window.HyperboreaSound;target=sound.gain('emiliano');
  const active=()=>mode==='profile';
  function setOutput(value){output=Math.max(0,Math.min(1,value));if(gain)gain.gain.value=output;else audio.volume=output;}
  function prepare(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!context&&Context)try{context=new Context();gain=context.createGain();gain.gain.value=output;context.createMediaElementSource(audio).connect(gain);gain.connect(context.destination);audio.volume=1;}catch{}
    if(context&&context.state!=='running')context.resume().catch(()=>{});
  }
  function prepareSource(){
    // A complete Blob makes 0:15 seekable on local hosts without byte ranges.
    // Load only on the first preview/entry and retain this source thereafter.
    if(sourceURL)return Promise.resolve(sourceURL);
    if(!sourcePromise)sourcePromise=fetch(source).then(response=>{
      if(!response.ok)throw new Error('OST unavailable');
      return response.blob();
    }).then(blob=>sourceURL=URL.createObjectURL(blob)).catch(error=>{sourcePromise=null;throw error;});
    return sourcePromise;
  }
  function sync(){const playing=pending||!audio.paused;toggle.textContent=playing?'PAUSE':'PLAY';toggle.setAttribute('aria-pressed',String(playing));toggle.setAttribute('aria-label',playing?'Приостановить музыку Санчеса':'Воспроизвести музыку Санчеса');}
  function save(){try{localStorage.setItem(key,JSON.stringify({paused:userPaused}));}catch{}}
  function canPreview(){return !document.hidden&&database.classList.contains('active')&&!roster.hidden&&!section.hidden&&!window.HyperboreaTransitions?.busy&&!window.NewPlayersArchive?.isOpen&&!window.NewPlayersArchive?.busy&&!window.FearArchive?.isOpen&&!window.WahArchive?.isOpen&&!window.WahArchive?.busy&&!window.FrogArchive?.isOpen&&!window.FrogArchive?.busy&&!window.FrogCoin?.active&&!window.SwarggyArchive?.isOpen&&!window.SwarggyArchive?.busy;}
  function cancelTimers(){cancelAnimationFrame(frame);frame=0;clearTimeout(boundary);boundary=0;previous=0;}
  function pause(){version++;pending=false;cancelTimers();audio.pause();setOutput(0);sync();}
  function seek(value){try{audio.currentTime=value;}catch{}}
  function stopPreview(){if(active())return;mode='idle';capped=false;pause();seek(0);}
  function capPreview(){if(mode!=='preview'||capped)return;capped=true;pause();seek(previewEnd);}
  function boundaryTimer(){clearTimeout(boundary);boundary=0;if(mode==='preview'&&!audio.paused&&!capped){const remaining=(previewEnd-audio.currentTime)/Math.max(.01,audio.playbackRate);if(remaining<=0)capPreview();else boundary=setTimeout(()=>{if(audio.currentTime>=previewEnd-.025)capPreview();else boundaryTimer();},remaining*1000);}}
  function animateOutput(){
    if(frame)return;
    function tick(now){
      frame=0;if(mode==='idle'||audio.paused||document.hidden)return;
      if(mode==='preview'&&audio.currentTime>=previewEnd){capPreview();return;}
      const seconds=previous?Math.min(.08,(now-previous)/1000):.016;previous=now;
      const edge=mode==='preview'?Math.min(1,Math.max(0,(previewEnd-audio.currentTime)/.25)):1;
      const desired=target*(mode==='preview'?.72:1)*edge;
      setOutput(output+(desired-output)*(1-Math.exp(-seconds/ .1)));
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  function play(){
    if(mode==='idle'||userPaused||document.hidden||(mode==='preview'&&capped))return;
    prepare();
    if(pending)return;
    if(sourceURL&&audio.src===sourceURL&&!audio.paused){status.textContent='';sync();boundaryTimer();animateOutput();return;}
    const token=++version;pending=true;if(active())status.textContent='Загрузка темы…';sync();
    // Prime this same element in the entry gesture while its seekable source
    // loads. The gain remains silent until the complete source is attached.
    if(!sourceURL){setOutput(0);audio.play().then(()=>{if(token===version&&!sourceURL)audio.pause();}).catch(()=>{});}
    prepareSource().then(url=>{
      if(token!==version||mode==='idle'||userPaused||document.hidden)return false;
      if(audio.src!==url){audio.pause();audio.src=url;audio.load();}
      return audio.play().then(()=>true);
    }).then(played=>{
      if(!played)return;
      if(token!==version)return;
      pending=false;
      if(mode==='idle'||userPaused||document.hidden){audio.pause();sync();return;}
      status.textContent='';sync();boundaryTimer();animateOutput();
    }).catch(error=>{
      if(token!==version)return;pending=false;
      if(active())status.textContent=error.name==='NotAllowedError'?'Нажми PLAY, чтобы включить тему':'Не удалось загрузить тему — попробуй PLAY';
      sync();
    });
  }
  function preview(){
    if(active()||mode==='preview'||suppressed||userPaused||!canPreview())return;
    window.FearArchive?.silence();window.WahAudio?.exit();window.FrogAudio?.exit();
    mode='preview';capped=false;seek(0);play();
  }
  function enter(){
    const continuing=mode==='preview';
    if(!continuing){pause();seek(0);}
    mode='profile';capped=false;resume=document.hidden&&!userPaused;suppressed=true;
    clearTimeout(boundary);boundary=0;status.textContent='';
    if(!userPaused)play();else sync();
  }
  function exit(){mode='idle';hovered=false;focused=false;suppressed=true;capped=false;resume=false;pause();seek(0);status.textContent='';}
  card.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovered=true;suppressed=false;preview();});
  card.addEventListener('pointerleave',()=>{hovered=false;focused=false;stopPreview();});
  card.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'&&suppressed&&canPreview()){suppressed=false;preview();}},{passive:true});
  card.addEventListener('focus',()=>{focused=card.matches(':focus-visible');if(focused)preview();});
  card.addEventListener('blur',()=>{focused=false;if(!hovered)stopPreview();});
  card.addEventListener('pointercancel',()=>{hovered=false;focused=false;stopPreview();});
  // Unlock Web Audio on a real gesture without downloading or playing the OST.
  document.addEventListener('pointerdown',event=>{if(event.isTrusted)prepare();},{capture:true});
  document.addEventListener('keydown',event=>{if(event.isTrusted&&(event.key==='Enter'||event.key===' '))prepare();},{capture:true});
  toggle.addEventListener('click',()=>{if(!active())return;if(pending||!audio.paused){userPaused=true;resume=false;pause();}else{userPaused=false;play();}save();});
  sound.bind(volume,'emiliano',level);
  sound.subscribe(channel=>{if(channel!=='emiliano'&&channel!=='master')return;target=sound.gain('emiliano');if(!audio.paused)setOutput(target*(mode==='preview'?.72:1));});
  audio.addEventListener('playing',()=>{if(mode==='idle'||!sourceURL||audio.src!==sourceURL){audio.pause();return;}boundaryTimer();animateOutput();sync();});
  audio.addEventListener('timeupdate',()=>{if(mode==='preview'&&audio.currentTime>=previewEnd)capPreview();});
  audio.addEventListener('seeked',boundaryTimer);
  audio.addEventListener('ratechange',boundaryTimer);
  audio.addEventListener('pause',()=>{cancelTimers();sync();});
  audio.addEventListener('error',()=>{pause();if(active())status.textContent='Тема недоступна — попробуй PLAY';});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){resume=active()&&!userPaused&&(pending||!audio.paused);if(active())pause();else stopPreview();}
    else if(active()&&resume&&!userPaused){resume=false;play();}
    else if((hovered||focused)&&canPreview())preview();
  });
  window.addEventListener('blur',()=>{if(!active()){hovered=false;focused=false;stopPreview();}});
  window.addEventListener('pagehide',exit);
  const guard=()=>{
    if(mode==='preview'&&!canPreview())stopPreview();
    if(active()&&(!database.classList.contains('active')||(window.NewPlayersArchive&&(window.NewPlayersArchive.id!=='emiliano'||(!window.NewPlayersArchive.isOpen&&!window.NewPlayersArchive.busy)))))exit();
  };
  const observer=new MutationObserver(guard);
  for(const node of [database,roster,section])observer.observe(node,{attributes:true,attributeFilter:['hidden','class']});
  window.EmilianoAudio={enter,exit,getLevel:()=>output,get state(){return{mode,active:active(),previewCapped:capped,pending,userPaused,currentTime:audio.currentTime,paused:audio.paused};}};
  setOutput(0);sync();
})();
