// One place for every sound level: a master volume and a slider per character.
// Tracks are trimmed from measured loudness so the same slider position sounds equally loud
// for every character, and sliders follow a perceptual curve (50 % ≈ half as loud).
(() => {
  'use strict';
  const KEY='hyperborea_sound_mixer_v1';
  const CHANNELS=[
    {id:'master',label:'Общая громкость',value:.9},
    {id:'terminal',label:'Терминал и события',value:.6},
    // The old computer's hum under everything (hyper-os.js, assets/pc-hum.mp3).
    {id:'pc',label:'Шум компьютера',value:.6},
    {id:'lore',label:'Лор и новеллы',value:.6},
    {id:'fear',label:'Клаус Штурм',value:.6},
    {id:'wah',label:'Кле Энигм',value:.6},
    {id:'frog',label:'Frog',value:.6},
    {id:'swarggy',label:'Минами Син',value:.6},
    {id:'emiliano',label:'Эмилиано Санчес',value:.6},
    // Ready before Yoru has a theme: add 'yoru:score' to TRIMS when the track arrives.
    {id:'yoru',label:'Нишимура Йору',value:.6}
  ];
  // Linear trims from loud-section RMS of each file, aiming at about −15 dBFS with both sliders at 100 %.
  // Previews sit about 4 dB under their full theme. "fx" scales the synthesized CRT hiss and blips.
  const TRIMS={
    // Novel scenes in LORE (lore-novel.js): synthesized ambience and effects.
    'lore:fx':2.2,
    // The PC recording sits around -40 dBFS RMS; its switch clicks peak near -10 dBFS.
    'pc:hum':5,
    'terminal:music':.44,'terminal:crash':.69,'terminal:fx':3.4,
    'fear:score':.32,'fear:preview':.21,'fear:fx':1.2,'fear:theme':2.7,
    // The rare dance intro (assets/fear-dance.mp4), measured at -12.6 dB RMS.
    'fear:dance':.76,
    'wah:score':.6,'wah:preview':.7,'wah:video':2.5,
    'frog:score':.54,
    // Run Up is supplied separately; re-measure this trim if the file is replaced by a louder or quieter edit.
    'swarggy:score':.42,
    // Flow state: "Creepiness" (assets/minami-creepiness.mp3) and the radio static of its transition.
    'swarggy:flow':.76,'swarggy:fx':1,
    'emiliano:score':.38
  };
  const levels=Object.fromEntries(CHANNELS.map(channel=>[channel.id,channel.value]));
  let muted=false;
  // Temporary silence that is never saved: the game holds the site's sound while the player is away from the terminal.
  let suspended=false;
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    for(const channel of CHANNELS)if(Number.isFinite(saved?.levels?.[channel.id]))levels[channel.id]=Math.max(0,Math.min(1,saved.levels[channel.id]));
    muted=saved?.muted===true;
  }catch{}
  const listeners=new Set();
  const curve=value=>value*value;
  function save(){try{localStorage.setItem(KEY,JSON.stringify({levels,muted}));}catch{}}
  function notify(channel){for(const listener of listeners){try{listener(channel);}catch(error){console.warn('Sound mixer listener:',error);}}}
  function factor(channel,track='score'){return muted||suspended?0:(TRIMS[channel+':'+track]??1)*curve(levels[channel]??1)*curve(levels.master);}
  const api={
    channels:CHANNELS.map(({id,label})=>({id,label})),
    level:channel=>levels[channel]??1,
    // Linear gain for a media element (never above 1).
    gain:(channel,track)=>Math.min(1,factor(channel,track)),
    // Unclamped multiplier for synthesized sounds.
    factor,
    set(channel,value){if(!(channel in levels))return;levels[channel]=Math.max(0,Math.min(1,Number(value)||0));save();notify(channel);},
    get muted(){return muted;},
    setMuted(value){muted=!!value;save();notify('master');},
    setSuspended(value){suspended=!!value;notify('master');},
    // Every audio module calls this; the channel is 'master' when everything changes.
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    // Binds a profile's own range input (0–100) and its output label to a channel.
    bind(input,channel,output){
      if(!input)return;
      // --fill lets each profile's styled track show how far the slider is filled.
      const sync=()=>{const percent=Math.round(api.level(channel)*100);input.value=String(percent);input.style.setProperty('--fill',percent+'%');if(output)output.value=percent+'%';};
      input.addEventListener('input',()=>api.set(channel,Number(input.value)/100));
      api.subscribe(changed=>{if(changed===channel||changed==='master')sync();});sync();
    }
  };
  window.HyperboreaSound=api;

  // The mixer panel, opened from [ ЗВУК ] in the database header.
  function buildPanel(){
    // Profile sliders that have no audio module of their own yet.
    api.bind(document.getElementById('yoruMusicVolume'),'yoru',document.getElementById('yoruMusicLevel'));
    const back=document.getElementById('back');
    if(!back||document.getElementById('soundMixer'))return;
    const toggle=document.createElement('button');
    toggle.type='button';toggle.id='soundMixerToggle';toggle.className='db-back sound-mixer-toggle';
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','soundMixer');
    back.before(toggle);
    const panel=document.createElement('section');
    panel.id='soundMixer';panel.className='sound-mixer';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Громкость');
    panel.innerHTML=`<div class="sound-mixer-head"><strong>ЗВУК</strong><button type="button" class="sound-mixer-mute" aria-pressed="false"></button><button type="button" class="sound-mixer-close" aria-label="Закрыть">×</button></div>
      <div class="sound-mixer-rows"></div>
      <p class="sound-mixer-note">Громкость треков выровнена: одинаковый процент звучит одинаково у всех. 50% — примерно вдвое тише, чем 100%.</p>`;
    const rows=panel.querySelector('.sound-mixer-rows');
    for(const channel of CHANNELS){
      const row=document.createElement('label');row.className='sound-mixer-row'+(channel.id==='master'?' is-master':'');
      row.innerHTML=`<span></span><input type="range" min="0" max="100" step="1"><output></output>`;
      row.querySelector('span').textContent=channel.label;
      const input=row.querySelector('input');input.setAttribute('aria-label','Громкость: '+channel.label);
      rows.append(row);api.bind(input,channel.id,row.querySelector('output'));
    }
    document.body.append(panel);
    const mute=panel.querySelector('.sound-mixer-mute');
    function syncMute(){
      mute.textContent=muted?'ВКЛЮЧИТЬ ЗВУК':'ВЫКЛЮЧИТЬ ВСЁ';mute.setAttribute('aria-pressed',String(muted));
      // Phones show only the note glyph so the header path keeps its room.
      toggle.innerHTML=`[ <span class="sound-mixer-word">${muted?'ЗВУК ВЫКЛ':'ЗВУК'}</span><span class="sound-mixer-glyph" aria-hidden="true">♪</span> ]`;
      toggle.setAttribute('aria-label',muted?'Звук выключен. Открыть громкость':'Громкость');toggle.classList.toggle('is-muted',muted);
      panel.classList.toggle('is-muted',muted);
    }
    api.subscribe(syncMute);syncMute();
    function place(){
      const rect=toggle.getBoundingClientRect(),width=Math.min(360,innerWidth-24);
      panel.style.width=width+'px';
      panel.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.right-width))+'px';
      panel.style.top=Math.min(rect.bottom+10,Math.max(12,innerHeight-panel.offsetHeight-12))+'px';
    }
    function open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');place();panel.querySelector('input')?.focus({preventScroll:true});}
    function close(focus){if(panel.hidden)return;panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
    toggle.addEventListener('click',()=>panel.hidden?open():close(false));
    mute.addEventListener('click',()=>api.setMuted(!muted));
    panel.querySelector('.sound-mixer-close').addEventListener('click',()=>close(true));
    document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))close(false);},true);
    // Escape closes only the panel, not the profile underneath.
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
    addEventListener('resize',()=>{if(!panel.hidden)place();},{passive:true});
    // Leaving the database (for example back to the terminal) closes the panel.
    const database=document.getElementById('database');
    if(database)new MutationObserver(()=>{if(!database.classList.contains('active'))close(false);}).observe(database,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildPanel,{once:true});else buildPanel();
})();
