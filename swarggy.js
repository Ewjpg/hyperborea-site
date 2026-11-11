// Минами Син (Swarggy/Ew). Opening the card makes a higanbana bloom and starts his theme,
// "Run Up" by Jun Murayama (assets/minami-run-up.mp3). FLOW STATE turns the dossier dark to "Creepiness".
// Element ids keep the old "swarggy" prefix: tactics, simulation and saved drafts rely on them.
import {createHiganbana, bloom, prepareHiganbanaOpening} from './higanbana.mjs?v=4';
import {STAT_AXES, parseRating} from './rating-model.mjs?v=36';
import {createProfileRadar} from './player-ratings.mjs?v=36';

(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const screen=$('screen'),database=$('database'),section=$('dbSection'),roster=$('playersRoster');
  const card=$('swarggyCard'),dossier=$('swarggyDossier'),title=$('swarggyTitle');
  if(!screen||!database||!card||!dossier)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const NAME='Минами Син';
  // Where the theme starts, in seconds of the file.
  const THEME_START=0;
  const BLOOM_TIME=2350,FADE_TIME=850,CINEMA_FADE_TIME=1150;

  // ── Music: his theme, and "Creepiness" (Jun Murayama, assets/minami-creepiness.mp3) in Flow state ──
  const music=(()=>{
    const toggle=$('swarggyMusicToggle'),volume=$('swarggyVolume');
    const level=$('swarggyVolumeLevel'),status=$('swarggyMusicStatus');
    const sound=window.HyperboreaSound,key='hyperborea_swarggy_audio_v1';
    // trim names the mixer's per-file level: 'swarggy:score' and 'swarggy:flow'.
    const tracks={
      theme:{audio:$('swarggyScore'),trim:'score',start:THEME_START,name:'тему Минами Сина'},
      flow:{audio:$('swarggyFlowScore'),trim:'flow',start:0,name:'музыку Flow state'}
    };
    let current=tracks.theme,audio=current.audio;
    let wanted=false,userPaused=false,resume=false,pending=false,version=0,frame=0,output=0,context=null,gain=null;
    try{userPaused=JSON.parse(localStorage.getItem(key)||'null')?.paused===true;}catch{}
    const target=()=>sound?sound.gain('swarggy',current.trim):.3;
    function setOutput(value){output=Math.max(0,Math.min(1,value));if(gain)gain.gain.value=output;else if(audio)audio.volume=output;}
    // Web Audio lets the level work on phones too, where media volume is fixed. Both tracks share one gain.
    function prepare(){
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!context&&Context)try{context=new Context();gain=context.createGain();gain.gain.value=output;gain.connect(context.destination);}catch{context=null;gain=null;}
      if(gain)for(const track of Object.values(tracks))if(track.audio&&!track.source)try{track.source=context.createMediaElementSource(track.audio);track.source.connect(gain);track.audio.volume=1;}catch{}
      if(context&&context.state!=='running')context.resume().catch(()=>{});
    }
    function fade(to,seconds,done){
      cancelAnimationFrame(frame);frame=0;
      if(seconds<=0||motion.matches||document.hidden){setOutput(to);done?.();return;}
      const from=output,begin=performance.now();
      const step=now=>{
        const k=Math.min(1,(now-begin)/(seconds*1000));setOutput(from+(to-from)*k*k*(3-2*k));
        if(k<1)frame=requestAnimationFrame(step);else{frame=0;done?.();}
      };
      frame=requestAnimationFrame(step);
    }
    function seek(track,value){try{track.audio.currentTime=value;}catch{}}
    function sync(){
      if(!toggle)return;
      const playing=pending||(audio&&!audio.paused);
      toggle.textContent=playing?'PAUSE':'PLAY';toggle.setAttribute('aria-pressed',String(playing));
      toggle.setAttribute('aria-label',(playing?'Приостановить ':'Включить ')+current.name);
    }
    function save(){try{localStorage.setItem(key,JSON.stringify({paused:userPaused}));}catch{}}
    function play(){
      if(!audio||!wanted||userPaused||document.hidden)return;
      prepare();
      if(!audio.paused&&!pending){fade(target(),.6);sync();return;}
      const token=++version,playing=audio;pending=true;sync();
      playing.play().then(()=>{
        if(token!==version){if(!wanted||userPaused||playing!==audio)playing.pause();return;}
        pending=false;
        if(!wanted||userPaused||document.hidden){playing.pause();sync();return;}
        status.textContent='';fade(target(),1.6);sync();
      }).catch(error=>{
        if(token!==version)return;
        pending=false;
        status.textContent=error?.name==='NotAllowedError'?'Нажми PLAY, чтобы включить '+current.name:'Музыка недоступна — попробуй PLAY';
        sync();
      });
    }
    function start(){
      if(!audio)return;
      wanted=true;resume=false;status.textContent='';
      cancelAnimationFrame(frame);frame=0;
      if(audio.paused){setOutput(0);seek(current,current.start);}
      if(userPaused)sync();else play();
    }
    function stop(){
      wanted=false;resume=false;version++;pending=false;
      const finish=()=>{
        if(wanted)return;
        for(const track of Object.values(tracks))if(track.audio){track.audio.pause();seek(track,track.start);}
        current=tracks.theme;audio=current.audio;setOutput(0);sync();
      };
      if(audio&&!audio.paused)fade(0,.4,finish);else finish();
      status.textContent='';
    }
    // Switches between the theme and the Flow track; the old one stops dead (both share one gain).
    // Entering Flow plays its track even if the theme was paused: pressing the button is asking for it.
    function use(name){
      const next=tracks[name];
      if(!next?.audio||next===current)return;
      version++;pending=false;cancelAnimationFrame(frame);frame=0;
      current.audio.pause();seek(current,current.start);
      current=next;audio=next.audio;setOutput(0);seek(next,next.start);
      if(name==='flow')userPaused=false;
      if(wanted)play();else sync();
    }
    for(const track of Object.values(tracks)){
      if(!track.audio)continue;
      track.audio.addEventListener('playing',()=>{if(track!==current||!wanted||userPaused)track.audio.pause();sync();});
      track.audio.addEventListener('pause',sync);
      track.audio.addEventListener('error',()=>{if(track!==current)return;pending=false;version++;if(wanted)status.textContent='Музыка недоступна — попробуй PLAY';sync();});
    }
    if(audio){
      toggle?.addEventListener('click',()=>{
        if(!wanted)return;
        if(pending||!audio.paused){userPaused=true;version++;pending=false;cancelAnimationFrame(frame);frame=0;audio.pause();setOutput(0);sync();}
        else{userPaused=false;play();}
        save();
      });
      sound?.bind(volume,'swarggy',level);
      sound?.subscribe(channel=>{if((channel==='swarggy'||channel==='master')&&!audio.paused&&!frame)setOutput(target());});
      // Unlock Web Audio on a real gesture without loading the track.
      document.addEventListener('pointerdown',event=>{if(event.isTrusted&&wanted)prepare();},{capture:true});
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden){if(wanted&&(pending||!audio.paused)){resume=true;version++;pending=false;cancelAnimationFrame(frame);frame=0;audio.pause();}}
        else if(wanted&&resume&&!userPaused){resume=false;play();}
      });
      setOutput(0);sync();
    }
    return {start,stop,use,get state(){return audio?{track:current===tracks.flow?'flow':'theme',wanted,userPaused,pending,paused:audio.paused,currentTime:audio.currentTime,level:output}:null;}};
  })();

  // ── Intro: the flower opens over the roster ───────────────────────────────
  const overlay=document.createElement('section');
  overlay.id='swarggyIntroOverlay';overlay.className='swarggy-intro';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',NAME+' — вход в досье');overlay.tabIndex=-1;
  overlay.innerHTML='<div class="minami-intro-sky" aria-hidden="true"></div><div class="minami-intro-moon" aria-hidden="true"></div><div class="minami-intro-3d" aria-hidden="true"></div><div class="minami-finish-wash" aria-hidden="true"></div><span class="minami-intro-kanji" aria-hidden="true" lang="ja">彼岸花</span><div class="minami-intro-bloom" aria-hidden="true"></div><div class="minami-intro-petals" aria-hidden="true"></div><div class="minami-intro-flash" aria-hidden="true"></div><div class="minami-cinema-frame" aria-hidden="true"></div><div class="swarggy-intro-label"><span>彼岸花 / HIGANBANA</span><strong>'+NAME+'</strong><span>Swarggy/Ew</span></div><button id="swarggyIntroSkip" type="button">ПРОПУСТИТЬ <span aria-hidden="true">↗</span></button>';
  screen.append(overlay);
  const skip=$('swarggyIntroSkip'),bloomBox=overlay.querySelector('.minami-intro-bloom'),cinemaBox=overlay.querySelector('.minami-intro-3d');
  const introFlower=createHiganbana({seed:11,petals:22,stamens:32,reach:200,stem:true,className:'minami-intro-flower'});
  bloomBox.append(introFlower.svg);
  scatterPetals(overlay.querySelector('.minami-intro-petals'),18,5);

  let opened=false,busy=false,swapping=false,epoch=0,phase='idle',finishCurrent=null;
  let timers=[],animations=[],tiltFrame=0;
  let intro3D=null,openingModule=null;
  function prepareOpening(){
    if(motion.matches)return Promise.resolve(null);
    if(!openingModule)openingModule=prepareHiganbanaOpening().catch(()=>{openingModule=null;return null;});
    return openingModule;
  }
  card.addEventListener('pointerenter',prepareOpening,{passive:true});
  card.addEventListener('focus',prepareOpening);
  const later=(callback,delay)=>{const token=epoch;const id=setTimeout(()=>{if(token===epoch)callback();},delay);timers.push(id);return id;};
  const ambient=()=>window.HyperboreaAmbience?.refresh();
  function clearTilt(){cancelAnimationFrame(tiltFrame);tiltFrame=0;dossier.style.setProperty('--swarggy-rx','0deg');dossier.style.setProperty('--swarggy-ry','0deg');}
  function cleanup(){
    epoch++;timers.forEach(clearTimeout);timers=[];animations.forEach(a=>a.cancel());animations=[];
    intro3D?.dispose();intro3D=null;delete overlay.dataset.renderer;
    finishCurrent=null;overlay.hidden=true;overlay.classList.remove('is-blooming','is-finishing','is-iris');
    skip.hidden=false;database.inert=false;roster.classList.remove('space-suspended');screen.classList.remove('swarggy-cinematic');
    busy=false;phase='idle';
  }
  function theme(active){database.classList.toggle('swarggy-theme',active);screen.classList.toggle('swarggy-active',active);ambient();}
  function reveal(){
    opened=true;section.hidden=true;roster.hidden=true;dossier.hidden=false;theme(true);
    $('dbPath').textContent='HYPERBOREA / PLAYERS / МИНАМИ СИН';
    const network=$('dbNetworkStatus');if(network)network.textContent='CONNECTION STABLE';
    database.scrollTop=0;garden.refresh();
  }
  function deactivate(restore){
    opened=false;dossier.hidden=true;theme(false);clearTilt();music.stop();garden.stop();flowState.reset();
    if(restore){section.hidden=false;roster.hidden=false;$('dbPath').textContent='HYPERBOREA / PLAYERS';database.scrollTop=0;window.PlayersSpace?.refresh?.();}
  }
  function finishIntro(immediate=false){
    if(!busy||phase!=='intro')return;
    phase='reveal';reveal();
    const finish=()=>{if(phase!=='reveal')return;cleanup();if(opened&&!document.hidden)title.focus({preventScroll:true});};
    finishCurrent=finish;
    if(immediate||motion.matches||document.hidden){finish();return;}
    overlay.classList.add('is-finishing');
    if(intro3D){
      // The camera dives into the flower while its red fills the screen; the profile then rises out of
      // that red, so the 3D scene and the profile are never seen blended together.
      intro3D.finish(CINEMA_FADE_TIME);
      // Easing sits on each step: a whole-animation easing would shift the offsets and let the views overlap.
      animations.push(overlay.querySelector('.minami-finish-wash').animate([{opacity:0,easing:'ease-in'},{opacity:1,offset:.4},{opacity:1}],{duration:CINEMA_FADE_TIME,fill:'both'}));
      animations.push(overlay.animate([{opacity:1},{opacity:1,offset:.52,easing:'ease-out'},{opacity:0}],{duration:CINEMA_FADE_TIME,fill:'both'}));
      later(finish,CINEMA_FADE_TIME);
      return;
    }
    animations.push(overlay.animate([{opacity:1},{opacity:1,offset:.25},{opacity:0}],{duration:FADE_TIME,easing:'ease-in',fill:'both'}));
    animations.push(introFlower.flower.animate([{transform:'scale(1) rotate(0deg)'},{transform:'scale(3.4) rotate(14deg)'}],{duration:FADE_TIME,easing:'cubic-bezier(.55,0,.4,1)',fill:'both'}));
    later(finish,FADE_TIME);
  }
  function enter(){
    if(opened||busy||window.HyperboreaTransitions?.busy||window.FrogArchive?.busy||window.FrogArchive?.isOpen||window.FrogCoin?.active||window.WahArchive?.busy||window.WahArchive?.isOpen||window.FearArchive?.isOpen||window.NewPlayersArchive?.isOpen||window.NewPlayersArchive?.busy||!database.classList.contains('active')||section.hidden||roster.hidden)return;
    window.FearArchive?.silence();window.WahAudio?.exit();window.FrogAudio?.exit();window.EmilianoAudio?.exit?.();
    cleanup();busy=true;phase='intro';ambient();
    // Start inside the click so the browser lets the theme play.
    music.start();
    if(motion.matches||document.hidden){finishIntro(true);return;}
    database.inert=true;roster.classList.add('space-suspended');screen.classList.add('swarggy-cinematic');
    overlay.hidden=false;skip.hidden=false;
    // The fallback stays light; WebGL is created only for an actual entrance.
    overlay.dataset.renderer='pending';
    void overlay.offsetWidth;overlay.classList.add('is-blooming');
    animations.push(overlay.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out',fill:'both'}));
    skip.focus({preventScroll:true});
    finishCurrent=()=>finishIntro(true);
    const token=epoch;
    let fallbackStarted=false;
    function fallback(){
      if(token!==epoch||phase!=='intro'||fallbackStarted)return;
      fallbackStarted=true;intro3D?.dispose();intro3D=null;overlay.dataset.renderer='svg';
      animations.push(...bloom(introFlower,{delay:80}));later(()=>finishIntro(),BLOOM_TIME);
    }
    // The sculpted lily is used when it arrives in time; otherwise the procedural flower opens.
    prepareOpening().then(module=>module?.modelReady?module.modelReady(1400).then(()=>module):module).then(module=>{
      if(token!==epoch||phase!=='intro')return;
      if(!module){fallback();return;}
      try{
        intro3D=module.createMinamiOpening(cinemaBox,{onError:fallback});
        overlay.dataset.renderer='webgl';intro3D.play(()=>finishIntro());
      }catch{fallback();}
    });
    // A failed/very slow graphics driver must never block navigation.
    later(()=>{if(phase==='intro')finishIntro(true);},12000);
  }
  // Short closing bloom: the open flower flares and hides the swap between views.
  function iris(swap,done){
    cleanup();busy=true;phase='iris';database.inert=true;roster.classList.add('space-suspended');screen.classList.add('swarggy-cinematic');
    let changed=false;
    const change=()=>{if(changed)return;changed=true;swapping=true;try{swap();}finally{swapping=false;}};
    const finish=()=>{if(phase!=='iris')return;change();cleanup();done?.();};
    finishCurrent=finish;
    if(motion.matches||document.hidden){finish();return;}
    music.stop();
    overlay.hidden=false;overlay.classList.add('is-iris');skip.hidden=true;overlay.focus({preventScroll:true});
    animations.push(overlay.animate([{opacity:0},{opacity:1,offset:.4},{opacity:1,offset:.56},{opacity:0}],{duration:950,easing:'cubic-bezier(.3,0,.2,1)',fill:'both'}));
    animations.push(introFlower.flower.animate([{transform:'scale(.35) rotate(-30deg)',opacity:0},{transform:'scale(1.05) rotate(0deg)',opacity:1,offset:.45},{transform:'scale(2.6) rotate(10deg)',opacity:0}],{duration:950,easing:'cubic-bezier(.3,0,.2,1)',fill:'both'}));
    later(change,380);later(finish,980);
  }
  function close(){
    if(busy&&(phase==='intro'||phase==='reveal')){reset();if(database.classList.contains('active'))card.focus({preventScroll:true});return;}
    if(!opened||busy)return;
    iris(()=>deactivate(true),()=>{if(database.classList.contains('active'))card.focus({preventScroll:true});});
  }
  function exitTo(swap,done){if(!opened||busy)return false;iris(()=>{deactivate(false);swap();},done);return true;}
  function reset(){
    if(swapping){deactivate(false);return;}
    const restore=opened||busy;cleanup();deactivate(restore);
  }
  card.addEventListener('click',enter);$('swarggyReturn').addEventListener('click',close);
  skip.addEventListener('click',()=>finishIntro(true));
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(phase==='intro'||phase==='reveal')){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='Tab'){event.preventDefault();(skip.hidden?overlay:skip).focus({preventScroll:true});}
  });

  // ── Dossier art: flowers around the portrait, two looks of Shin ───────────
  const art=dossier.querySelector('.swarggy-art');
  const back=dossier.querySelector('.minami-flowers-back'),front=dossier.querySelector('.minami-flowers-front');
  [[back,{seed:3,petals:18,stamens:26,reach:190,stem:true,stemLength:900,className:'minami-flower flower-a'}],
   [back,{seed:21,petals:16,stamens:24,reach:170,stem:true,stemLength:900,className:'minami-flower flower-b'}],
   [back,{seed:8,petals:14,stamens:20,reach:150,stem:true,stemLength:900,className:'minami-flower flower-c'}],
   [front,{seed:5,petals:18,stamens:28,reach:190,stem:true,stemLength:900,className:'minami-flower flower-d'}]]
    .forEach(([parent,options])=>parent?.append(createHiganbana(options).svg));
  scatterPetals(dossier.querySelector('.minami-drift'),12,9);
  // A small flower on the roster card too.
  const cardArt=card.querySelector('.swarggy-card-art');
  if(cardArt){
    const bloomMark=document.createElement('span');bloomMark.className='minami-card-bloom';bloomMark.setAttribute('aria-hidden','true');
    bloomMark.append(createHiganbana({seed:17,petals:16,stamens:22,reach:190,className:'minami-card-flower'}).svg);
    cardArt.insertBefore(bloomMark,cardArt.querySelector('img'));
  }

  const looks=[...dossier.querySelectorAll('.minami-look button')];
  const portraits={field:dossier.querySelector('.minami-portrait-field'),off:dossier.querySelector('.minami-portrait-off')};
  function setLook(look){
    if(!art||!portraits[look])return;
    art.dataset.look=look;
    for(const button of looks)button.setAttribute('aria-pressed',String(button.dataset.look===look));
    for(const [name,image] of Object.entries(portraits))image?.setAttribute('aria-hidden',String(name!==look));
  }
  looks.forEach(button=>button.addEventListener('click',()=>setLook(button.dataset.look)));
  setLook('field');

  // ── 04 Хиганбана: a 3D flower to play with, loaded only when it scrolls into view ──
  // Its WebGL context exists only while the dossier is open; without WebGL a 2D flower blooms on click.
  const garden=(()=>{
    const stage=$('swarggyGarden'),status=$('swarggyGardenStatus');
    if(!stage)return {refresh(){},stop(){},setFlow(){},state:null};
    const WORDS={idle:'ЗАЖМИ ЦВЕТОК',holding:'СМЫКАЕТСЯ…',charged:'ОТПУСКАЙ',burst:'ЕЩЁ РАЗ?'};
    // In Flow state the flower is dying.
    const WORDS_FLOW={idle:'ОН УВЯДАЕТ',holding:'ДЕРЖИ…',charged:'НЕ ОТПУСКАЙ',burst:'ПЕПЕЛ'};
    let instance=null,loading=false,token=0,visible=false,failed=false,flat=null,flow=false,word='idle';
    const say=()=>{if(!failed)status.textContent=(flow?WORDS_FLOW:WORDS)[word]||'';};
    function fallback(){
      failed=true;instance?.dispose();instance=null;stage.dataset.renderer='svg';status.textContent='НАЖМИ НА ЦВЕТОК';
      if(flat)return;
      flat=createHiganbana({seed:11,petals:22,stamens:32,reach:200,className:'minami-garden-flower'});stage.prepend(flat.svg);
      let playing=[];
      const replay=()=>{playing.forEach(a=>a.cancel());playing=motion.matches?[]:bloom(flat,{speed:.8});};
      stage.addEventListener('click',replay);
      stage.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();replay();}});
    }
    function load(){
      if(loading)return;
      loading=true;const current=++token;
      import('./minami-garden.mjs?v=2').then(module=>{
        if(current!==token)return;
        loading=false;
        if(!opened||instance||failed)return;
        instance=module.createMinamiGarden(stage,{onState:name=>{word=name;say();},onError:fallback});
        instance.setFlow(flow);stage.dataset.renderer='webgl';refresh();
      }).catch(()=>{if(current!==token)return;loading=false;fallback();});
    }
    function refresh(){
      const wanted=opened&&visible&&!document.hidden;
      if(wanted&&!instance&&!failed)load();
      instance?.setActive(wanted);
    }
    function stop(){
      token++;loading=false;instance?.dispose();instance=null;
      if(stage.dataset.renderer==='webgl')delete stage.dataset.renderer;
      word='idle';say();
    }
    function setFlow(on){flow=on;instance?.setFlow(on);say();}
    new IntersectionObserver(entries=>{visible=entries[entries.length-1].isIntersecting;refresh();},{rootMargin:'200px 0px'}).observe(stage);
    document.addEventListener('visibilitychange',refresh);
    return {refresh,stop,setFlow,get state(){return instance?instance.state:{renderer:stage.dataset.renderer||'none',visible};},get instance(){return instance;}};
  })();

  // ── Flow state: red-and-white static, the whole screen scribbled out in pencil, "Creepiness" plays, ──
  // the dossier turns dark and haunted and every flower dies. The button itself stutters on purpose.
  const flowState=(()=>{
    const button=$('swarggyFlowToggle'),label=button?.querySelector('.minami-flow-label');
    if(!button||!label)return {reset(){},get active(){return false;}};
    const SVG='http://www.w3.org/2000/svg',rand=Math.random,coarse=matchMedia('(pointer:coarse)');
    let active=false,changing=false,timers=[],sceneAnimations=[],sceneNoise=null,layerNoise=null,sfx=null;
    const later=(callback,delay)=>{const id=setTimeout(callback,delay);timers.push(id);return id;};
    const clearTimers=()=>{timers.forEach(clearTimeout);timers=[];};

    // Points → a smooth pencil line (Catmull-Rom as cubic Béziers).
    function smoothPath(points){
      let d='M'+points[0][0].toFixed(1)+' '+points[0][1].toFixed(1);
      for(let i=0;i<points.length-1;i++){
        const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
        d+='C'+[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6,p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6,p2[0],p2[1]].map(v=>v.toFixed(1)).join(' ');
      }
      return d;
    }
    // A chaotic scribble inside a box, as points: a crossing-out zigzag, a tangle of loops or a slash.
    function scribblePoints(x,y,w,h,kind){
      const points=[];
      if(kind==='loops'){
        const cx=x+w/2,cy=y+h/2;let a=rand()*6.3;
        for(let i=0,n=18+Math.floor(rand()*20);i<n;i++){a+=.55+rand()*.7;const k=.45+rand()*.55;points.push([cx+Math.cos(a)*w/2*k,cy+Math.sin(a)*h/2*k]);}
      }else if(kind==='slash'){
        const flip=rand()<.5;
        for(let i=0;i<=5;i++){const t=i/5;points.push([x+w*t+(rand()-.5)*w*.03,(flip?y+h*(1-t):y+h*t)+(rand()-.5)*h*.06]);}
      }else{
        const rows=7+Math.floor(rand()*9),tilt=(rand()-.5)*.3;
        for(let i=0;i<=rows;i++){const t=i/rows,side=i%2;points.push([x+w*(side?.88+rand()*.12:rand()*.12),y+h*t+(side?-1:1)*tilt*h*.5+(rand()-.5)*h/rows*.8]);}
      }
      return points;
    }
    // The same scribble as an SVG path; tally marks are four strokes and a cross-stroke.
    function scribble(x,y,w,h,kind){
      if(kind!=='tally')return smoothPath(scribblePoints(x,y,w,h,kind));
      let d='';const step=w/6;
      for(let i=0;i<4;i++){const px=x+step*(i+.8);d+=`M${(px+(rand()-.5)*3).toFixed(1)} ${(y+rand()*h*.1).toFixed(1)}L${(px+(rand()-.5)*5).toFixed(1)} ${(y+h*(.9+rand()*.1)).toFixed(1)}`;}
      return d+`M${x.toFixed(1)} ${(y+h*.75).toFixed(1)}L${(x+w).toFixed(1)} ${(y+h*.2).toFixed(1)}`;
    }
    // The points along the smooth curve through them (Catmull-Rom), about every 6 px.
    function sampleCurve(points){
      const out=[points[0]];
      for(let i=0;i<points.length-1;i++){
        const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
        const steps=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/6));
        for(let s=1;s<=steps;s++){
          const u=s/steps,u2=u*u,u3=u2*u;
          out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3)));
        }
      }
      return out;
    }
    // A graphite stroke from a to b: a few thin, uneven lines side by side, so it looks drawn with a pencil.
    function graphite(context,a,b,width,color,alpha){
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
      context.strokeStyle=color;context.globalAlpha=alpha*(.75+rand()*.25);context.lineWidth=1.2+rand()*1.7;
      context.beginPath();
      for(let i=0,lines=Math.max(2,Math.round(width/1.15));i<lines;i++){
        const o=(rand()-.5)*width,o2=o+(rand()-.5)*1.4;
        context.moveTo(a[0]+nx*o,a[1]+ny*o);context.lineTo(b[0]+nx*o2,b[1]+ny*o2);
      }
      context.stroke();
    }
    function pencil(parent,d,width,color,opacity){
      const path=document.createElementNS(SVG,'path');
      path.setAttribute('d',d);path.setAttribute('pathLength','1');
      path.style.cssText=`stroke:${color};stroke-width:${width.toFixed(1)}px;opacity:${opacity}`;
      parent.append(path);return path;
    }
    const draw=(path,duration,delay=0)=>path.animate([{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDasharray:'1 1',strokeDashoffset:0}],{duration,delay,easing:'cubic-bezier(.3,.1,.4,1)',fill:'both'});
    // Each SVG is drawn in its own pixels, so pencil widths stay true.
    function fit(svg){const w=Math.max(1,svg.clientWidth||svg.parentElement.clientWidth),h=Math.max(1,svg.clientHeight||svg.parentElement.clientHeight);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);return [w,h];}

    // A few frames of red-and-white static, drawn once and shuffled at a low, choppy frame rate.
    function runNoise(canvas,fps){
      const context=canvas.getContext('2d'),frames=[];
      for(let f=0;f<6;f++){
        const image=context.createImageData(canvas.width,canvas.height),d=image.data;
        for(let row=0;row<canvas.height;row++){
          const band=rand()<.06?1.7:1;
          for(let col=0;col<canvas.width;col++){
            const i=(row*canvas.width+col)*4,v=rand()**1.6*band,white=rand()<.34;
            d[i]=Math.min(255,v*255);d[i+1]=Math.min(255,v*(white?235:24));d[i+2]=Math.min(255,v*(white?232:38));d[i+3]=255;
          }
        }
        frames.push(image);
      }
      let last=0,id=0,on=true;
      const tick=now=>{if(!on)return;id=requestAnimationFrame(tick);if(now-last<1000/fps)return;last=now;context.putImageData(frames[Math.floor(rand()*frames.length)],0,0);};
      context.putImageData(frames[0],0,0);id=requestAnimationFrame(tick);
      return {stop(){on=false;cancelAnimationFrame(id);}};
    }
    // A burst of radio static, at the level of Minami's slider.
    function hiss(seconds,strength){
      const k=window.HyperboreaSound?window.HyperboreaSound.factor('swarggy','fx'):.3,Context=window.AudioContext||window.webkitAudioContext;
      if(!k||!Context||document.hidden)return;
      try{
        sfx=sfx||new Context();if(sfx.state!=='running')sfx.resume().catch(()=>{});
        const length=Math.floor(sfx.sampleRate*seconds),buffer=sfx.createBuffer(1,length,sfx.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<length;i++)data[i]=(rand()*2-1)*.5+(rand()<.002?(rand()*2-1)*2.5:0);
        const source=sfx.createBufferSource(),band=sfx.createBiquadFilter(),level=sfx.createGain(),now=sfx.currentTime,peak=.22*k*strength;
        source.buffer=buffer;band.type='bandpass';band.frequency.value=2300;band.Q.value=.6;
        level.gain.setValueAtTime(0,now);level.gain.linearRampToValueAtTime(peak,now+.03);level.gain.setValueAtTime(peak,now+seconds*.55);level.gain.linearRampToValueAtTime(0,now+seconds);
        source.connect(band).connect(level).connect(sfx.destination);source.start();
      }catch{}
    }

    // The transition scene and the layer of interference that stays while Flow is on.
    const scene=document.createElement('section');scene.className='minami-flow-scene';scene.hidden=true;scene.setAttribute('aria-hidden','true');
    scene.innerHTML='<canvas class="minami-flow-noise" width="192" height="108"></canvas><canvas class="minami-flow-pencil"></canvas><span class="minami-flow-kanji" lang="ja">死</span>';
    screen.append(scene);
    const layer=document.createElement('div');layer.className='minami-flow-layer';layer.hidden=true;layer.setAttribute('aria-hidden','true');
    layer.innerHTML='<canvas class="minami-flow-static" width="160" height="90"></canvas><div class="minami-flow-vignette"></div><i class="minami-flow-tear"></i><i class="minami-flow-tear"></i><i class="minami-flow-tear"></i><svg class="minami-flow-doodles" preserveAspectRatio="none"></svg>';
    screen.append(layer);
    const pencilCanvas=scene.querySelector('.minami-flow-pencil'),doodles=layer.querySelector('.minami-flow-doodles');
    let pencilFrame=0;

    // Pencil marks left on the dossier, and his spiral eyes lit red.
    const sceneArt=dossier.querySelector('.minami-scene'),overline=dossier.querySelector('.swarggy-overline'),nameSpan=title.querySelector('span');
    const overlineHTML=overline?.innerHTML,nameText=nameSpan?.textContent;
    const marks=[[dossier.querySelector('.profile-name-block'),'marks-name'],[dossier.querySelector('.profile-callsign'),'marks-callsign'],[sceneArt,'marks-art']]
      .filter(([host])=>host).map(([host,kind])=>{const svg=document.createElementNS(SVG,'svg');svg.setAttribute('class','minami-flow-marks '+kind);svg.setAttribute('aria-hidden','true');svg.setAttribute('preserveAspectRatio','none');host.append(svg);return svg;});
    function drawMarks(){
      for(const svg of marks){
        svg.replaceChildren();const [w,h]=fit(svg),kind=svg.classList[1];let delay=0;
        const add=(d,width,color,opacity)=>{draw(pencil(svg,d,width,color,opacity),260+rand()*260,delay);delay+=140+rand()*160;};
        if(kind==='marks-name'){
          add(scribble(w*.02,h*.52,w*.5,h*.4,'zigzag'),2.2,'#c9bfc1',.55);
          add(scribble(-w*.02,h*.1,w*.7,h*.8,'slash'),2.6,'#b3122b',.75);
        }else if(kind==='marks-callsign'){
          add(scribble(w*.04,h*.5,w*.9,h*.1,'slash'),2,'#c9bfc1',.6);
          add(scribble(w*.06,h*.6,w*.8,h*.08,'slash'),1.6,'#c9bfc1',.45);
        }else{
          add(scribble(w*.24,h*.12,w*.52,h*.5,'loops'),2.2,'#b3122b',.7);
          add(scribble(w*.06,h*.08,w*.12,h*.08,'tally'),2,'#c9bfc1',.55);
          add(scribble(w*.76,h*.07,w*.2,h*.16,'zigzag'),2.4,'#c9bfc1',.5);
        }
      }
    }
    const clearMarks=()=>marks.forEach(svg=>svg.replaceChildren());
    const eyes=document.createElementNS(SVG,'svg');eyes.setAttribute('class','minami-flow-eyes');eyes.setAttribute('viewBox','0 0 1254 1254');eyes.setAttribute('aria-hidden','true');
    const spiral=(cx,cy,r)=>{let d='';for(let i=0;i<=96;i++){const a=i/96*Math.PI*6,k=r*i/96;d+=(i?'L':'M')+(cx+Math.cos(a)*k).toFixed(1)+' '+(cy+Math.sin(a)*k).toFixed(1);}return d;};
    // Eye centres in the manga portrait (assets/minami-shin-manga.webp, 1254 px square).
    eyes.innerHTML=[[538,601],[735,601]].map(([x,y])=>`<g class="minami-flow-eye"><circle cx="${x}" cy="${y}" r="44" class="minami-flow-eye-glow"/><path d="${spiral(x,y,36)}"/></g>`).join('');
    sceneArt?.append(eyes);
    function placeEyes(){
      const image=portraits.field;if(!image)return;
      // The portrait is object-fit: contain, centred in its box.
      const w=image.offsetWidth,h=image.offsetHeight,s=Math.min(w,h);
      Object.assign(eyes.style,{left:image.offsetLeft+(w-s)/2+'px',top:image.offsetTop+(h-s)/2+'px',width:s+'px',height:s+'px'});
    }

    function setButton(on){
      label.dataset.text=on?'ВЫЙТИ ИЗ FLOW':'FLOW STATE';label.textContent=label.dataset.text;
      button.setAttribute('aria-pressed',String(on));button.classList.toggle('is-on',on);
      button.setAttribute('aria-label',on?'Выйти из Flow state':'Flow state: тёмный режим досье');
    }
    function dark(on){
      // Flow shows only the manga portrait (its spiral eyes glow), so the look switch is hidden then.
      if(on)setLook('field');
      dossier.classList.toggle('is-flow',on);database.classList.toggle('minami-flow',on);garden.setFlow(on);
      if(overline)overline.innerHTML=on?'<span aria-hidden="true"></span><b lang="ja">死</b> FLOW STATE':overlineHTML;
      if(!on&&nameSpan){nameSpan.textContent=nameText;nameSpan.classList.remove('is-death');}
      dossier.classList.remove('is-glitch');
    }
    function showLayer(on){
      layer.hidden=!on;layerNoise?.stop();layerNoise=null;
      if(on)layerNoise=runNoise(layer.querySelector('canvas'),motion.matches?1:11);
    }
    // Interference while Flow is on: tear bars, bursts of static, his name flickering to 死, the portrait glitching,
    // and now and then a quick scribble across the screen.
    function haunt(){
      const tears=[...layer.querySelectorAll('.minami-flow-tear')];
      const tear=()=>{
        const count=1+Math.floor(rand()*3);
        tears.forEach((bar,i)=>{if(i>=count){bar.style.opacity='0';return;}Object.assign(bar.style,{top:(rand()*100).toFixed(1)+'%',height:(2+rand()*rand()*38).toFixed(0)+'px',transform:`translateX(${((rand()-.5)*30).toFixed(0)}px)`,opacity:'1'});});
        later(()=>tears.forEach(bar=>{bar.style.opacity='0';}),50+rand()*130);later(tear,700+rand()*2600);
      };
      const burst=()=>{layer.classList.add('is-burst');hiss(.22,.45);later(()=>layer.classList.remove('is-burst'),90+rand()*120);later(burst,4500+rand()*6500);};
      const name=()=>{if(nameSpan){nameSpan.textContent='死';nameSpan.classList.add('is-death');later(()=>{nameSpan.textContent=nameText;nameSpan.classList.remove('is-death');},90+rand()*160);}later(name,2600+rand()*5500);};
      const glitch=()=>{dossier.classList.add('is-glitch');later(()=>dossier.classList.remove('is-glitch'),70+rand()*110);later(glitch,1800+rand()*4200);};
      const doodle=()=>{
        const [w,h]=fit(doodles),kinds=['zigzag','loops','slash'];
        const path=pencil(doodles,scribble(rand()*w*.7,rand()*h*.7,w*(.2+rand()*.3),h*(.15+rand()*.3),kinds[Math.floor(rand()*3)]),1.5+rand()*2.5,rand()<.5?'#b3122b':'#c9bfc1',.5);
        draw(path,320);path.animate([{opacity:.5},{opacity:.5,offset:.4},{opacity:0}],{duration:2600,fill:'both'}).finished.then(()=>path.remove(),()=>path.remove());
        later(doodle,6500+rand()*7000);
      };
      later(tear,900);later(burst,3500);later(name,2200);later(glitch,1400);later(doodle,5000);
    }
    function settle(on){
      changing=false;sceneNoise?.stop();sceneNoise=null;sceneAnimations.forEach(a=>a.cancel());sceneAnimations=[];
      cancelAnimationFrame(pencilFrame);pencilFrame=0;scene.hidden=true;pencilCanvas.width=pencilCanvas.height=1;
      if(on){showLayer(true);placeEyes();drawMarks();if(!motion.matches)haunt();}
    }
    function enter(){
      if(active||changing||!opened||busy)return;
      active=true;changing=true;setButton(true);music.use('flow');
      if(motion.matches||document.hidden){dark(true);settle(true);return;}
      hiss(1.3,1);
      const w=Math.max(1,screen.clientWidth),h=Math.max(1,screen.clientHeight),ratio=Math.min(devicePixelRatio||1,1.5);
      pencilCanvas.width=Math.round(w*ratio);pencilCanvas.height=Math.round(h*ratio);
      const context=pencilCanvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);context.lineCap='round';
      scene.hidden=false;sceneNoise=runNoise(scene.querySelector('canvas'),24);
      // The static dims a little as the graphite covers it, so the pencil reads.
      sceneAnimations.push(scene.querySelector('canvas').animate([{opacity:1},{opacity:1,offset:.15},{opacity:.62}],{duration:1700,fill:'both'}));
      sceneAnimations.push(scene.animate([{opacity:0},{opacity:1,offset:.3},{opacity:.25,offset:.5},{opacity:1}],{duration:220,easing:'steps(4,end)',fill:'both'}));
      // The screen is crossed out stroke by stroke: heavy graphite, a few red-pencil lines.
      // Each frame draws only the new bit of every stroke, so the canvas never has to be redrawn.
      const begin=performance.now(),lines=[];
      for(let i=0,count=coarse.matches?20:30;i<count;i++){
        const kind=i<4?'slash':['zigzag','loops','zigzag','slash'][Math.floor(rand()*4)];
        const bw=w*(.35+rand()*.7),bh=h*(.25+rand()*.6),red=rand()<.18;
        lines.push({points:sampleCurve(scribblePoints(rand()*(w-bw*.6)-bw*.2,rand()*(h-bh*.6)-bh*.2,bw,bh,kind)),drawn:0,
          width:red?3+rand()*5:9+rand()*22,color:red?'#b0102a':(rand()<.5?'#0c0809':'#1a1214'),alpha:red?.95:.9+rand()*.1,
          start:80+rand()*1250,duration:220+rand()*380});
      }
      const sketch=now=>{
        let pending=false;
        for(const line of lines){
          const k=Math.min(1,Math.max(0,(now-begin-line.start)/line.duration)),until=Math.floor((1-(1-k)*(1-k))*(line.points.length-1));
          while(line.drawn<until){graphite(context,line.points[line.drawn],line.points[line.drawn+1],line.width,line.color,line.alpha);line.drawn++;}
          if(line.drawn<line.points.length-1)pending=true;
        }
        pencilFrame=pending?requestAnimationFrame(sketch):0;
      };
      pencilFrame=requestAnimationFrame(sketch);
      sceneAnimations.push(scene.querySelector('.minami-flow-kanji').animate([{opacity:0},{opacity:0,offset:.62},{opacity:1,offset:.63},{opacity:0,offset:.66},{opacity:0,offset:.7},{opacity:.9,offset:.71},{opacity:0,offset:.74},{opacity:0}],{duration:2200,fill:'both'}));
      later(()=>dark(true),1000);
      later(()=>sceneAnimations.push(scene.animate([{opacity:1},{opacity:.55,offset:.2},{opacity:1,offset:.35},{opacity:.3,offset:.6},{opacity:.6,offset:.7},{opacity:0}],{duration:620,easing:'steps(6,end)',fill:'both'})),1950);
      later(()=>settle(true),2600);
    }
    function exit(){
      if(!active||changing)return;
      changing=true;clearTimers();setButton(false);music.use('theme');
      if(motion.matches||document.hidden){active=false;dark(false);clearMarks();showLayer(false);settle(false);return;}
      hiss(.6,.8);
      scene.hidden=false;sceneNoise=runNoise(scene.querySelector('canvas'),30);
      sceneAnimations.push(scene.animate([{opacity:0},{opacity:1,offset:.15},{opacity:.4,offset:.3},{opacity:1,offset:.45},{opacity:0}],{duration:900,easing:'steps(7,end)',fill:'both'}));
      later(()=>{dark(false);clearMarks();showLayer(false);},300);
      later(()=>{active=false;settle(false);},900);
    }
    // Leaving the dossier ends Flow at once.
    function reset(){
      clearTimers();active=false;changing=false;settle(false);showLayer(false);clearMarks();dark(false);setButton(false);
    }

    // The lag: random frozen frames (with a garbled letter or two) while hovered or focused, and a hang on press.
    const GLYPHS='▓▒░█#%&?!/\\|01';
    function garble(on){
      const text=label.dataset.text;
      if(!on){label.textContent=text;return;}
      const chars=[...text];
      for(let i=0,n=1+Math.floor(rand()*3);i<n;i++){const k=Math.floor(rand()*chars.length);if(chars[k]!==' ')chars[k]=GLYPHS[Math.floor(rand()*GLYPHS.length)];}
      label.textContent=chars.join('');
    }
    let lagTimer=0;
    function lag(){
      clearTimeout(lagTimer);
      if(motion.matches||!(button.matches(':hover')||button.matches(':focus-visible'))||button.classList.contains('is-hang'))return;
      button.classList.add('is-frozen');garble(rand()<.6);
      lagTimer=setTimeout(()=>{button.classList.remove('is-frozen');garble(false);lagTimer=setTimeout(lag,120+rand()*480);},70+rand()*230);
    }
    function unlag(){clearTimeout(lagTimer);button.classList.remove('is-frozen');if(!button.classList.contains('is-hang'))garble(false);}
    button.addEventListener('pointerenter',lag);button.addEventListener('focus',lag);
    button.addEventListener('pointerleave',unlag);button.addEventListener('blur',unlag);
    button.addEventListener('click',()=>{
      if(changing||button.classList.contains('is-hang'))return;
      const go=()=>active?exit():enter();
      if(motion.matches){go();return;}
      unlag();button.classList.add('is-hang');garble(true);
      setTimeout(()=>{button.classList.remove('is-hang');garble(false);go();},260);
    });
    window.addEventListener('resize',()=>{if(active&&!changing){placeEyes();drawMarks();}},{passive:true});
    setButton(false);
    return {enter,exit,reset,get active(){return active;},get changing(){return changing;}};
  })();

  dossier.querySelectorAll('[data-swarggy-scroll]').forEach(button=>button.addEventListener('click',()=>{
    const target=$(button.dataset.swarggyScroll);target?.focus({preventScroll:true});target?.scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});
  }));
  art?.addEventListener('pointermove',event=>{
    if(!opened||busy||motion.matches||event.pointerType==='touch')return;
    cancelAnimationFrame(tiltFrame);tiltFrame=requestAnimationFrame(()=>{
      const rect=art.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(event.clientX-rect.left)/rect.width-.5)),y=Math.max(-.5,Math.min(.5,(event.clientY-rect.top)/rect.height-.5));
      dossier.style.setProperty('--swarggy-rx',(-y*8).toFixed(2)+'deg');dossier.style.setProperty('--swarggy-ry',(x*11).toFixed(2)+'deg');
    });
  },{passive:true});
  art?.addEventListener('pointerleave',clearTilt,{passive:true});
  window.addEventListener('resize',()=>{finishCurrent?.();clearTilt();},{passive:true});
  document.addEventListener('visibilitychange',()=>{const hidden=document.hidden;dossier.classList.toggle('swarggy-paused',hidden);overlay.classList.toggle('swarggy-paused',hidden);if(hidden){finishCurrent?.();clearTilt();}});
  motion.addEventListener('change',()=>{finishCurrent?.();clearTilt();});
  window.addEventListener('pagehide',reset);
  // An iris exit deliberately deactivates the database before its finish callback.
  // Keep that callback alive so central navigation can release its running state.
  new MutationObserver(()=>{if((opened||busy)&&phase!=='iris'&&!database.classList.contains('active'))reset();}).observe(database,{attributes:true,attributeFilter:['class']});

  // ── Profile: ratings and position are saved on this device; the description and weapon are canon and read-only ──
  const inputs=STAT_AXES.map(axis=>$('swarggyStat'+axis));
  const position=$('swarggyPosition'),description=$('swarggyDescription'),weapon=$('swarggyWeapon');
  const profileKey='hyperborea_swarggy_profile_v1',updateRadar=createProfileRadar('swarggy');
  // Older drafts may still hold a description/weapon; they stay in storage untouched but no longer replace the canon text.
  let stored={};
  function draw(){
    const ratings=inputs.map(input=>parseRating(input.value));updateRadar(ratings);
    return ratings;
  }
  function save(){
    stored={...stored,ratings:draw(),position:position.value};
    try{localStorage.setItem(profileKey,JSON.stringify(stored));$('swarggySaveState').textContent='Сохранено на этом устройстве';}catch{$('swarggySaveState').textContent='Изменения доступны до закрытия страницы';}
  }
  try{
    const saved=JSON.parse(localStorage.getItem(profileKey)||'null');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
      stored=saved;
      if(Array.isArray(saved.ratings))inputs.forEach((input,i)=>{input.value=parseRating(saved.ratings[i])??'';});
      if(typeof saved.position==='string')position.value=saved.position.slice(0,40);
    }
  }catch{}
  inputs.forEach(input=>input.addEventListener('input',()=>{input.value=parseRating(input.value)??'';save();}));
  position.addEventListener('input',save);
  draw();
  // The canon texts are read in full, so each read-only box grows to its text instead of scrolling.
  // Refit only when the width changes: that covers the dossier opening and the window resizing.
  for(const box of [description,weapon]){
    let width=0;
    const fit=()=>{box.style.height='auto';box.style.height=box.scrollHeight+2+'px';};
    new ResizeObserver(([entry])=>{const next=Math.round(entry.contentRect.width);if(next&&next!==width){width=next;fit();}}).observe(box);
  }

  // Loose petals that drift down; positions are fixed per page so they never jump.
  function scatterPetals(box,count,seed){
    if(!box)return;
    let value=seed;
    const rand=()=>{value=(value*16807)%2147483647;return value/2147483647;};
    for(let i=0;i<count;i++){
      const petal=document.createElement('i');
      petal.style.setProperty('--x',(rand()*100).toFixed(1)+'%');
      petal.style.setProperty('--size',(7+rand()*9).toFixed(1)+'px');
      petal.style.setProperty('--drift',((rand()-.5)*160).toFixed(0)+'px');
      petal.style.setProperty('--spin',((rand()-.5)*720).toFixed(0)+'deg');
      petal.style.setProperty('--time',(6+rand()*7).toFixed(2)+'s');
      petal.style.setProperty('--delay',(-rand()*12).toFixed(2)+'s');
      box.append(petal);
    }
  }

  window.SwarggyArchive={open:enter,close,reset,exitTo,get isOpen(){return opened;},get busy(){return busy;},get state(){return phase;},get variant(){return 'higanbana-3d';},get cinematic(){return intro3D;},get music(){return music.state;},get garden(){return garden.state;},get flow(){return flowState;}};
})();
