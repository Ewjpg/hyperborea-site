// FEAR's sound: the threads and the fall are synthesized; the darkness has a looping theme
// (assets/fear-darkness-theme.mp3) that plays from the fall until the dossier, under synthesized
// mechanical noises in the spirit of analog horror. Everything follows the mixer's FEAR channel
// (HyperboreaSound 'fear': track 'fx' for the synthesis, 'theme' for the loop).
const THEME='./assets/fear-darkness-theme.mp3';
export function createFearSound(){
  const mixer=window.HyperboreaSound;
  const level=()=>mixer?mixer.factor('fear','fx'):.3;
  const themeLevel=()=>mixer?mixer.factor('fear','theme'):.8;
  let ctx=null,out=null,wet=null,noise=null,crushCurve=null,unsubscribe=null,disposed=false,nextBeat=0,mode='idle';
  let themeOut=null,themeBuffer=null,themeLoop=[0,0],themeLoad=null,themeWanted=false,themeSource=null,themeGain=null;
  const voices=new Set();
  const now=()=>ctx?.currentTime||0;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

  // Must run inside a click or key press, or browsers keep the context silent.
  function unlock(){
    if(disposed)return false;
    if(!ctx){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return false;
      try{ctx=new Context({latencyHint:'interactive'});}catch{return false;}
      out=ctx.createGain();out.gain.value=level();
      const limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-20;limiter.knee.value=14;limiter.ratio.value=5;limiter.attack.value=.008;limiter.release.value=.24;
      out.connect(limiter);limiter.connect(ctx.destination);
      const length=ctx.sampleRate*4|0;noise=ctx.createBuffer(1,length,ctx.sampleRate);
      const data=noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
      // A dark synthetic hall: decaying filtered noise as the reverb impulse.
      const impulse=ctx.createBuffer(2,ctx.sampleRate*2.6|0,ctx.sampleRate);
      for(let c=0;c<2;c++){const d=impulse.getChannelData(c);let s=0;for(let i=0;i<d.length;i++){s=s*.6+(Math.random()*2-1)*.4;const t=i/ctx.sampleRate;d[i]=s*Math.exp(-t*2.6)*Math.min(1,t/.012)*.5;}}
      wet=ctx.createGain();wet.gain.value=.16;
      const hall=ctx.createConvolver(),tone=ctx.createBiquadFilter(),back=ctx.createGain();
      hall.buffer=impulse;tone.type='lowpass';tone.frequency.value=1700;back.gain.value=.24;
      wet.connect(hall);hall.connect(tone);tone.connect(back);back.connect(out);
      // A coarse staircase: what makes a buzz sound like a cheap, broken machine voice.
      crushCurve=new Float32Array(512);for(let i=0;i<512;i++)crushCurve[i]=Math.round((i/511*2-1)*5)/5;
      // The theme bypasses the limiter: it is mastered already and the trim can lift it above 100 %.
      themeOut=ctx.createGain();themeOut.gain.value=themeLevel();themeOut.connect(ctx.destination);
      unsubscribe=mixer?.subscribe(channel=>{
        if(channel!=='fear'&&channel!=='master')return;
        out.gain.setTargetAtTime(level(),now(),.04);themeOut.gain.setTargetAtTime(themeLevel(),now(),.04);
      });
      loadTheme();
    }
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    return true;
  }
  const ready=()=>ctx&&!disposed;

  // The theme is short, so it is decoded whole and looped without a gap, skipping its silent edges.
  function loadTheme(){
    if(themeLoad||themeBuffer)return;
    themeLoad=fetch(THEME).then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.arrayBuffer();})
      .then(data=>ctx.decodeAudioData(data)).then(buffer=>{
        const channels=[...Array(buffer.numberOfChannels)].map((_,i)=>buffer.getChannelData(i)),loud=i=>channels.some(c=>Math.abs(c[i])>.003);
        let first=0,last=buffer.length-1;while(first<last&&!loud(first))first++;while(last>first&&!loud(last))last--;
        themeLoop=[first/buffer.sampleRate,(last+1)/buffer.sampleRate];themeBuffer=buffer;
        if(themeWanted)startTheme();
      }).catch(error=>{console.warn('FEAR theme:',error);}).finally(()=>{themeLoad=null;});
  }
  function startTheme(){
    if(!ready()||!themeBuffer||themeSource)return;
    const t=now();
    themeSource=ctx.createBufferSource();themeSource.buffer=themeBuffer;themeSource.loop=true;
    [themeSource.loopStart,themeSource.loopEnd]=themeLoop;
    themeGain=ctx.createGain();themeGain.gain.setValueAtTime(0,t);themeGain.gain.linearRampToValueAtTime(1,t+2.5);
    themeSource.connect(themeGain);themeGain.connect(themeOut);themeSource.start(t,themeLoop[0]);
  }
  function theme(){if(!ready())return;themeWanted=true;if(themeBuffer)startTheme();else loadTheme();}
  function stopTheme(fade=.6){
    themeWanted=false;if(!themeSource)return;
    const t=now(),source=themeSource,gain=themeGain;themeSource=themeGain=null;
    gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+fade);
    try{source.stop(t+fade+.05);}catch{}
    source.addEventListener('ended',()=>{try{source.disconnect();gain.disconnect();}catch{}},{once:true});
  }
  // Tape trouble: the loop drags down like a dying cassette and winds back up.
  function dragTheme(){
    if(!themeSource)return;
    const t=now(),rate=themeSource.playbackRate,g=themeGain.gain;
    rate.cancelScheduledValues(t);rate.setValueAtTime(1,t);rate.exponentialRampToValueAtTime(.22,t+.6);rate.setValueAtTime(.22,t+1.4);rate.exponentialRampToValueAtTime(1,t+2.3);
    g.cancelScheduledValues(t);g.setValueAtTime(1,t);g.linearRampToValueAtTime(.45,t+.6);g.setValueAtTime(.45,t+1.4);g.linearRampToValueAtTime(1,t+2.3);
  }
  // The loop drops out in stutters along with the flashlight.
  function stutterTheme(length=.8){
    if(!themeSource)return;
    const t=now(),g=themeGain.gain;g.cancelScheduledValues(t);
    for(let k=0;k<length;k+=.05+Math.random()*.05)g.setValueAtTime(Math.random()<.5?.12:1,t+k);
    g.setValueAtTime(1,t+length);
  }

  function track(source,nodes,tag){
    const voice={source,nodes,tag};voices.add(voice);
    source.addEventListener('ended',()=>{voices.delete(voice);for(const node of [source,...nodes])try{node.disconnect();}catch{}},{once:true});
    return voice;
  }
  function stop(tag,fade=.08){
    if(!ctx)return;const t=now();
    for(const voice of [...voices])if(voice.tag===tag){
      for(const node of voice.nodes)if(node.envelope){node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(0,t,Math.max(.005,fade/3));}
      try{voice.source.stop(t+fade+.02);}catch{}
    }
  }
  function route(node,pan=0,send=.3){
    const panner=ctx.createStereoPanner(),reverb=ctx.createGain();
    panner.pan.value=clamp(pan,-1,1);reverb.gain.value=send;
    node.connect(panner);panner.connect(out);panner.connect(reverb);reverb.connect(wet);
    return[panner,reverb];
  }
  function envelope(gain,time,peak,attack,hold,decay){
    gain.envelope=true;const g=gain.gain;
    g.setValueAtTime(1e-5,time);g.linearRampToValueAtTime(peak,time+attack);
    if(hold>0)g.setValueAtTime(peak,time+attack+hold);
    g.exponentialRampToValueAtTime(1e-5,time+attack+hold+decay);
  }
  // Filtered noise: breath, creaks, whooshes. sweep moves the filter to a new frequency over the sound.
  function hiss({time=now(),peak=.1,attack=.02,hold=0,decay=.3,low=1000,high=40,band=0,q=0,sweep=0,pan=0,send=.3,tag='fx'}={}){
    if(!ready())return null;
    const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
    const hp=ctx.createBiquadFilter(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),end=time+attack+hold+decay;
    hp.type='highpass';hp.frequency.value=high;hp.Q.value=.6;
    filter.type=band?'bandpass':'lowpass';filter.frequency.setValueAtTime(band||low,time);filter.Q.value=q||(band?.8:.65);
    if(sweep)filter.frequency.exponentialRampToValueAtTime(sweep,end);
    envelope(gain,time,peak,attack,hold,decay);
    source.connect(hp);hp.connect(filter);filter.connect(gain);
    track(source,[hp,filter,gain,...route(gain,pan,send)],tag);
    source.start(time,Math.random()*3);source.stop(end+.03);
    return{gain,filter};
  }
  function tone({time=now(),frequency=60,end=frequency,peak=.06,attack=.02,hold=0,decay=.5,type='sine',pan=0,send=.2,tag='fx'}={}){
    if(!ready())return null;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),stopAt=time+attack+hold+decay;
    osc.type=type;osc.frequency.setValueAtTime(frequency,time);osc.frequency.exponentialRampToValueAtTime(Math.max(10,end),stopAt);
    envelope(gain,time,peak,attack,hold,decay);osc.connect(gain);
    track(osc,[gain,...route(gain,pan,send)],tag);
    osc.start(time);osc.stop(stopAt+.03);
    return{gain,osc};
  }
  // A breathy voice: noise through a vowel-ish band, trembling like a whisper.
  function whisper(pan=0,strength=.5,time=now(),tag='fx'){
    if(!ready())return;
    const source=ctx.createBufferSource(),band=ctx.createBiquadFilter(),air=ctx.createBiquadFilter(),gain=ctx.createGain(),tremolo=ctx.createOscillator(),depth=ctx.createGain(),length=1.1+Math.random()*.6;
    source.buffer=noise;source.loop=true;band.type='bandpass';band.frequency.setValueAtTime(900+Math.random()*500,time);band.frequency.linearRampToValueAtTime(1600+Math.random()*900,time+length);band.Q.value=2.2;
    air.type='highpass';air.frequency.value=450;
    envelope(gain,time,.07*strength,.25,length-.6,.35);
    tremolo.frequency.value=7+Math.random()*5;depth.gain.value=.035*strength;tremolo.connect(depth);depth.connect(gain.gain);
    source.connect(air);air.connect(band);band.connect(gain);
    track(source,[air,band,gain,...route(gain,pan,.7)],tag);track(tremolo,[depth],tag);
    source.start(time,Math.random()*3);source.stop(time+length+.05);tremolo.start(time);tremolo.stop(time+length+.05);
  }

  // ── Mechanical noises, analog-horror style ──────────────────────────────────────────────────
  // A broken machine trying to speak: a flat buzz pushed through vowel formants, crushed to steps.
  // No real words — just the cadence of a voice coming out of a speaker that should be dead.
  const VOWELS=[[730,1090],[270,2290],[300,870],[530,1840],[570,840],[440,1020]];
  function garble(pan=0,strength=.6,time=now(),tag='fx'){
    if(!ready())return;
    const syllables=3+Math.floor(Math.random()*4),pitch=88+Math.random()*34,end=time+.1+syllables*.17;
    const buzz=ctx.createOscillator(),low=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),drive=ctx.createGain(),crush=ctx.createWaveShaper(),radio=ctx.createBiquadFilter(),gain=ctx.createGain();
    buzz.type='sawtooth';low.type=high.type='bandpass';low.Q.value=7;high.Q.value=9;drive.gain.value=6;crush.curve=crushCurve;
    radio.type='bandpass';radio.frequency.value=1500;radio.Q.value=.7;
    gain.envelope=true;gain.gain.setValueAtTime(0,time);
    for(let i=0;i<syllables;i++){
      const t=time+.08+i*.17,[f1,f2]=VOWELS[Math.random()*VOWELS.length|0],peak=.05*strength*(i===syllables-1?.7:1);
      low.frequency.setValueAtTime(f1,t);high.frequency.setValueAtTime(f2,t);
      buzz.frequency.setValueAtTime(pitch*(i%2?1:.93)*(Math.random()<.2?1.45:1),t);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(peak,t+.02);gain.gain.setValueAtTime(peak,t+.11);gain.gain.linearRampToValueAtTime(0,t+.15);
    }
    buzz.connect(low);buzz.connect(high);low.connect(drive);high.connect(drive);drive.connect(crush);crush.connect(radio);radio.connect(gain);
    track(buzz,[low,high,drive,crush,radio,gain,...route(gain,pan,.55)],tag);
    buzz.start(time);buzz.stop(end+.05);
    hiss({time,peak:.012*strength,attack:.03,hold:end-time-.1,decay:.1,band:2400,q:.8,high:900,pan,send:.3,tag});
  }
  // Something in the dark speaks: sometimes a whisper, sometimes the broken machine.
  function voice(pan=0,strength=.5){if(Math.random()<.5)garble(pan,strength+.15);else whisper(pan,strength);}
  // A servo winding up and stopping on a click — the eye has turned towards you.
  function servo(pan=0,time=now()){
    if(!ready())return;
    const osc=ctx.createOscillator(),band=ctx.createBiquadFilter(),gain=ctx.createGain();
    osc.type='sawtooth';osc.frequency.setValueAtTime(170,time);osc.frequency.exponentialRampToValueAtTime(430,time+.38);osc.frequency.setValueAtTime(430,time+.5);osc.frequency.exponentialRampToValueAtTime(250,time+.72);
    band.type='bandpass';band.frequency.value=1250;band.Q.value=2.2;
    envelope(gain,time,.022,.04,.6,.12);osc.connect(band);band.connect(gain);
    track(osc,[band,gain,...route(gain,pan,.4)],'fx');osc.start(time);osc.stop(time+.8);
    for(const at of [0,.11,.23,.34,.76])hiss({time:time+at,peak:at>.7?.05:.022,attack:.001,decay:.025,band:3200,q:5,high:1500,pan,send:.3});
  }
  // A dead VHS channel coughing: chirps of static, mains hum and a falling squeal.
  function glitch(pan=0,time=now()){
    if(!ready())return;
    for(let i=0;i<5;i++)hiss({time:time+i*.045+Math.random()*.02,peak:.045,attack:.002,decay:.03,band:1800+Math.random()*3000,q:4,high:600,pan,send:.1});
    tone({time,frequency:60,end:60,peak:.02,attack:.005,hold:.14,decay:.05,type:'square',pan,send:.05});
    tone({time:time+.05,frequency:1500,end:190,peak:.01,attack:.003,decay:.09,type:'square',pan,send:.1});
  }
  // The flashlight switch: a crisp double click, or one dull click when the battery is too low.
  function torch(on=true,dead=false){
    if(!ready())return;const t=now();
    if(dead){hiss({time:t,peak:.05,attack:.001,decay:.03,band:1100,q:3,high:300,pan:.3,send:.05});return;}
    for(const at of [0,.045])hiss({time:t+at,peak:on?.06:.045,attack:.001,decay:.015,band:3600,q:6,high:1500,pan:.3,send:.05});
    tone({time:t,frequency:on?950:700,end:on?650:480,peak:.006,attack:.002,decay:.03,type:'square',pan:.3,send:.05});
  }
  // The hand is torn back into the dark: a rush away, a thump, nails skittering off.
  function snatch(pan=0){
    if(!ready())return;const t=now();
    hiss({time:t,peak:.16,attack:.008,decay:.38,band:2200,q:1.1,sweep:240,high:150,pan,send:.5});
    tone({time:t,frequency:140,end:55,peak:.08,attack:.004,decay:.3,pan,send:.4});
    for(let i=0;i<5;i++)hiss({time:t+.05+i*.035,peak:.04*(1-i/6),attack:.001,decay:.02,band:3800,q:6,high:2000,pan:pan*(1-i/5),send:.6});
  }
  // Metal struck somewhere far off in the dark.
  function clank(pan=0,time=now()){
    if(!ready())return;
    for(const [f,p] of [[212,.026],[337,.02],[519,.014],[811,.009],[1233,.005]])tone({time,frequency:f,end:f*.99,peak:p,attack:.002,decay:1.3+Math.random()*.8,pan,send:.95});
    hiss({time,peak:.035,attack:.002,decay:.2,band:900,high:200,pan,send:.9});
  }

  // The whole opening is scored ahead of time so it stays in sync with the picture.
  function opening(){
    if(!unlock())return;
    stop('opening',.02);stop('bed',.05);mode='opening';
    const t=now()+.03;
    tone({time:t,frequency:43,end:33,peak:.062,attack:1.5,hold:3.2,decay:2.2,send:.8,tag:'opening'});
    tone({time:t+.4,frequency:66,end:39,peak:.022,attack:2.1,hold:.9,decay:2.1,pan:-.2,send:.75,tag:'opening'});
    hiss({time:t,peak:.12,attack:1.1,hold:2.1,decay:2.8,band:190,high:32,send:.8,tag:'opening'});
    // Wet creaks as the tendons rise and coil.
    for(const [at,pan] of [[.65,-.6],[1.1,.3],[1.42,.5],[1.9,-.2],[2.18,-.25],[2.6,.45],[2.96,.6],[3.48,-.65],[3.9,.2],[4.16,.35]])
      hiss({time:t+at,peak:.05+at*.009,attack:.1,hold:.04,decay:.5,band:330+at*90,q:3.5,sweep:220+at*60,high:90,pan,send:.55,tag:'opening'});
    // The reach: tension winds up, a thin whine on top.
    const rise=hiss({time:t+2.9,peak:.2,attack:1.65,hold:.02,decay:.25,low:350,sweep:2400,high:110,send:.6,tag:'opening'});
    rise&&rise.filter.frequency.setValueAtTime(350,t+2.9);
    tone({time:t+3.1,frequency:520,end:780,peak:.012,attack:1.4,decay:.25,type:'triangle',send:.6,tag:'opening'});
    // The grab: a snap, a thud, the threads humming taut.
    hiss({time:t+4.6,peak:.26,attack:.002,decay:.13,band:2300,high:900,send:.4,tag:'opening'});
    tone({time:t+4.6,frequency:92,end:36,peak:.15,attack:.006,decay:.55,send:.5,tag:'opening'});
    hiss({time:t+4.76,peak:.12,attack:.002,decay:.1,band:1700,high:700,pan:.4,send:.4,tag:'opening'});
    tone({time:t+4.85,frequency:118,end:116,peak:.018,attack:.05,hold:.9,decay:.4,type:'sawtooth',send:.2,tag:'opening'});
    // The pull: a rising rush and a sub drop, then the impact in the dark.
    hiss({time:t+4.95,peak:.22,attack:1.45,hold:.05,decay:.12,band:260,q:.9,sweep:2600,high:60,send:.5,tag:'opening'});
    tone({time:t+4.95,frequency:70,end:24,peak:.1,attack:1.5,decay:.2,send:.4,tag:'opening'});
    tone({time:t+6.5,frequency:52,end:21,peak:.17,attack:.01,decay:2.4,send:.7,tag:'opening'});
    hiss({time:t+6.5,peak:.15,attack:.005,decay:1.4,low:480,high:30,send:.8,tag:'opening'});
  }
  function stopOpening(){stop('opening',.18);}
  function title(){
    if(!ready())return;mode='title';
    const t=now()+.05;
    for(const [f,p] of [[110,.03],[164.8,.016],[220,.012],[329.6,.006]])tone({time:t,frequency:f,end:f*.985,peak:p,attack:.012,decay:3.6,send:1,tag:'title'});
  }
  // The darkness bed: a low room tone, and — only if the theme failed to load — beating drones.
  function explore(){
    if(!ready())return;
    stop('bed',.05);mode='explore';nextBeat=now()+.8;
    const withTheme=!!(themeSource||themeLoad||themeBuffer);
    const t=now(),source=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noise;source.loop=true;hp.type='highpass';hp.frequency.value=31;lp.type='lowpass';lp.frequency.value=480;
    gain.envelope=true;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(withTheme?.025:.05,t+2);
    source.connect(hp);hp.connect(lp);lp.connect(gain);track(source,[hp,lp,gain,...route(gain,0,.6)],'bed');source.start(t);
    const swell=ctx.createOscillator(),swellDepth=ctx.createGain();swell.frequency.value=.083;swellDepth.gain.value=withTheme?.006:.012;swell.connect(swellDepth);swellDepth.connect(gain.gain);track(swell,[swellDepth],'bed');swell.start(t);
    if(withTheme)return;
    for(const [f,p] of [[37,.018],[38.6,.012],[61.2,.004]]){
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=f;g.envelope=true;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(p,t+2.4);
      osc.connect(g);track(osc,[g,...route(g,(Math.random()-.5)*.35,.2)],'bed');osc.start(t);
    }
  }
  // Called every frame while exploring: the heart races as the eye gets near.
  function tick(proximity=0,panic=false){
    if(!ready()||mode!=='explore'||ctx.state!=='running')return;
    const t=now();if(nextBeat<t)nextBeat=t+.05;
    if(nextBeat>t+.12)return;
    const p=panic?1:clamp(proximity),bpm=50+p*72,strength=.45+p*.6;
    tone({time:nextBeat,frequency:58,end:41,peak:.085*strength,attack:.008,decay:.17,send:.1,tag:'beat'});
    tone({time:nextBeat+.23,frequency:51,end:39,peak:.055*strength,attack:.008,decay:.21,send:.1,tag:'beat'});
    nextBeat+=60/bpm;
  }
  let lastStep=0;
  function step(run){
    if(!ready()||mode!=='explore')return;const t=now();if(t-lastStep<.2)return;lastStep=t;
    const pan=(Math.random()>.5?1:-1)*(.09+Math.random()*.06);
    hiss({time:t,peak:run?.12:.085,attack:.004,hold:.005,decay:run?.13:.17,low:950,high:85,pan,send:.14});
    tone({time:t,frequency:run?86:72,end:39,peak:run?.048:.034,attack:.008,decay:.14,pan,send:.12});
  }
  // A ping, then its echo returns late and from the side where the eye is.
  function pulse(pan=0,distance=40){
    if(!ready())return;const t=now(),near=1-clamp(distance/60),delay=.17+Math.min(distance,120)/120*.85;
    tone({time:t,frequency:180,end:105,peak:.048,attack:.025,decay:.65,send:.75});
    hiss({time:t,peak:.035,attack:.035,decay:.26,band:520,high:170,send:.6});
    tone({time:t+delay,frequency:280+near*110,end:155,peak:.03+near*.02,attack:.045,decay:.95,pan,send:1});
    hiss({time:t+delay+.06,peak:.03,attack:.12,decay:.8,band:760,high:180,pan,send:1});
    tone({time:t+delay+.42,frequency:250+near*90,end:150,peak:.012+near*.008,attack:.05,decay:.9,pan:pan*.7,send:1});
  }
  // The flashlight stutters: a crackle, a VHS cough, and the theme drops out with it.
  function flicker(length=.8){
    if(!ready())return;const t=now();
    for(let i=0;i<4;i++)hiss({time:t+i*.07+Math.random()*.04,peak:.03,attack:.003,decay:.04,band:2600,q:3,high:1200,pan:.25,send:.1});
    tone({time:t,frequency:120,end:118,peak:.01,attack:.01,hold:.25,decay:.1,type:'sawtooth',pan:.25,send:.1});
    glitch(.25,t+.03);stutterTheme(length);
  }
  // Far away something heavy moves — a thud, or metal striking metal.
  function distant(pan=0){
    if(!ready())return;const t=now();
    if(Math.random()<.5){clank(pan,t);return;}
    tone({time:t,frequency:46,end:30,peak:.05,attack:.02,decay:1.3,pan,send:.9});
    hiss({time:t,peak:.035,attack:.01,decay:.9,low:300,high:30,pan,send:.9});
  }
  function breath(pan=.7){
    if(!ready())return;const t=now();
    hiss({time:t,peak:.05,attack:.55,hold:.2,decay:.6,band:700,q:1.2,sweep:520,high:250,pan,send:.3});
    hiss({time:t+1.6,peak:.035,attack:.4,decay:.9,band:560,q:1.2,sweep:420,high:220,pan,send:.3});
  }
  // The eye snaps shut and is torn up into the dark; the tape drags, voices and machines circle you.
  function escape(){
    if(!ready())return;const t=now();
    dragTheme();
    tone({time:t,frequency:1250,end:170,peak:.032,attack:.01,decay:1.05,type:'sawtooth',send:.7});
    hiss({time:t,peak:.13,attack:.01,decay:.9,band:3000,q:1.4,sweep:300,high:200,send:.6});
    tone({time:t+.05,frequency:62,end:27,peak:.14,attack:.008,decay:1.6,send:.6});
    hiss({time:t+.2,peak:.12,attack:.5,decay:.35,band:400,sweep:2800,high:90,send:.5});
    glitch(-.4,t+.3);
    whisper(-.8,.9,t+.55);garble(.75,.85,t+.8);whisper(-.1,.9,t+1.1);garble(.45,.7,t+1.45);
  }
  function found(){
    if(!ready())return;mode='found';stop('bed',.75);stopTheme(2.1);const t=now();
    tone({time:t,frequency:58,end:34,peak:.13,attack:.06,hold:.04,decay:1.7,send:.55});
    hiss({time:t+.02,peak:.075,attack:.16,decay:1.65,low:1450,high:100,send:.9});
    for(const [f,p,at] of [[523.3,.016,.1],[784,.012,.35],[1046.5,.009,.6],[1568,.006,.9]])tone({time:t+at,frequency:f,end:f,peak:p,attack:.4,hold:.3,decay:2.6,send:1});
  }
  function leave(){
    if(!ready())return;mode='found';stop('bed',.4);stopTheme(.5);const t=now();
    hiss({time:t,peak:.08,attack:.35,decay:.9,low:2400,high:300,send:.9});
    tone({time:t+.1,frequency:784,end:784,peak:.01,attack:.3,decay:2,send:1});
  }
  return{unlock,opening,stopOpening,title,theme,stopTheme,explore,tick,step,pulse,flicker,distant,breath,whisper,voice,garble,servo,glitch,clank,torch,snatch,escape,found,leave,
    pause(){if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{});},
    resume(){if(ctx&&ctx.state==='suspended'&&!disposed)ctx.resume().catch(()=>{});},
    dispose(){
      if(disposed)return;disposed=true;unsubscribe?.();
      if(!ctx)return;
      const t=now();out.gain.cancelScheduledValues(t);out.gain.setTargetAtTime(0,t,.08);stopTheme(.3);
      const context=ctx;setTimeout(()=>{for(const voice of voices)try{voice.source.stop();}catch{}voices.clear();context.close().catch(()=>{});},400);
    },
    get state(){return{mode,context:ctx?.state||'none',voices:voices.size,theme:themeSource?'playing':themeBuffer?'ready':themeLoad?'loading':'none'};}};
}
