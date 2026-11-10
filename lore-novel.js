// LORE novel player: plays a chapter's "play" script (lore-data.js) as a visual novel over the whole screen.
// Backgrounds (the Uozu shore; the main hall of Azure Latch, a wide panorama the camera walks along), drawn panels
// with shake / flash / zoom, the receptionist's sprite with poses, a name plate and a typewriter text box,
// a location caption, and sound made on the fly with Web Audio (waves and gulls, the hall's hum, the desk bell,
// keyboard, heartbeat, steps, a dramatic sting). Volume: «Лор и новеллы».
// An {explore} step lets the player walk the hall freely: a floor plan in the corner, markers on people and things,
// each one a short scene of its own; the chapter goes on only from the spot marked "ends" (the receptionist).
// Click, Space or Enter continues; ← → walk while exploring; AUTO plays on by itself; Esc leaves. Styles in lore-novel.css.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const sound = window.HyperboreaSound;
  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

  // ── The hall: four zones side by side, the camera looks at one at a time ──
  const ZONES = ['exit', 'desk', 'hall', 'screen'];
  const ZONE_NAMES = {exit: 'ВЫХОД', desk: 'РЕГИСТРАЦИЯ', hall: 'ЗОНА ОЖИДАНИЯ', screen: 'МЕДИА-ЭКРАН'};
  // Where the markers of the known spots sit: zone, x (% of the zone's width), y (% of the height).
  const SPOT_AT = {clerk: ['desk', 67, 34], queue: ['hall', 17, 34], pair: ['hall', 50, 30], bench: ['hall', 66, 52], screen: ['screen', 85, 26], exit: ['exit', 50, 24]};
  const MATCH = './assets/lore/match-1937.mp4?v=1';
  // Background people: faceless silhouettes, like the crowd in a manga.
  const body = 'M28 56Q52 46 76 56Q86 60 86 74L80 150H24L18 74Q18 60 28 56Z';
  const legs = 'M26 148H78L74 282H56L52 176L48 282H30Z';
  const shoes = '<path d="M28 280H50Q53 290 44 292H22Q21 285 28 280Z"/><path d="M54 280H76Q81 286 79 292H58Q52 289 54 280Z"/>';
  const head = '<ellipse cx="52" cy="30" rx="16" ry="18"/><rect x="45" y="44" width="14" height="12" rx="4"/>';
  const armL = '<path d="M20 66Q12 70 12 86V140Q12 148 18 148Q24 148 24 140L27 88Z"/>';
  const armR = '<path d="M84 66Q92 70 92 86V140Q92 148 86 148Q80 148 80 140L77 88Z"/>';
  const FIGURES = {
    // In the queue, with a suitcase, shifting from foot to foot.
    queue: `<svg viewBox="0 0 132 300" class="nv-npc" data-npc="queue" style="left:8%;height:58%;top:30%">${head}<path d="M35 26Q36 8 54 9Q72 10 70 32Q66 18 52 18Q40 19 35 26Z"/><path d="${body}"/>${armL}<path d="M84 64Q94 68 96 84L100 140Q100 148 94 148Q88 148 88 140L80 90Z"/><path d="${legs}"/>${shoes}<rect class="nv-npc-bag" x="96" y="196" width="34" height="88" rx="6"/><path class="nv-npc-handle" d="M102 196V146H122V196"/></svg>`,
    // Two talking by the column: one with arms crossed, one waving a hand.
    pair: `<svg viewBox="0 0 240 300" class="nv-npc" data-npc="pair" style="left:37%;height:56%;top:31%">${head}<path d="${body}"/><path d="M16 84Q52 76 88 84L90 104Q52 96 14 104Z" class="nv-npc-arms"/><path d="${legs}"/>${shoes}
      <g transform="translate(118 -6)"><ellipse cx="52" cy="30" rx="15" ry="17"/><path d="M36 24Q40 6 56 8Q70 10 68 28L60 20Q48 16 36 24Z"/><rect x="45" y="44" width="14" height="12" rx="4"/><path d="${body}"/>${armR}<g class="nv-npc-wave"><path d="M20 66Q10 66 8 80L4 104Q2 112 8 116L-6 140Q-10 148 -2 150Q4 152 8 144L24 116L28 86Z"/></g><path d="${legs}"/>${shoes}</g></svg>`,
    // On the bench, spinning a ball on one finger.
    bench: `<svg viewBox="0 0 150 240" class="nv-npc" data-npc="bench" style="left:72%;height:40%;top:46%">${head}<path d="M30 56Q54 46 76 56Q86 60 86 74L82 140H28L20 74Q20 60 30 56Z"/>${armL}<path d="M80 64Q92 62 98 50L104 20Q106 12 112 14Q117 16 115 24L108 56Q102 76 86 86Z"/><path d="M26 130H98Q110 132 110 146V158H30Q22 150 26 130Z"/><path d="M90 150H110L108 222H92Z"/><path d="M70 152H88L86 222H72Z"/><path d="M90 220H112Q116 228 112 232H88Z"/><path d="M70 220H90Q94 228 90 232H66Z"/><g class="nv-npc-ball"><circle cx="111" cy="2" r="13"/><path d="M98 2H124M111 -11V15" class="nv-npc-seam"/></g></svg>`
  };

  const root = document.createElement('section');
  root.className = 'novel'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Глава');
  root.innerHTML = `<div class="novel-bg" data-bg="black"><div class="nv-shore"><img src="./assets/lore/uozu-shore.webp" alt=""><i class="nv-shimmer"></i><small>Фото: Google Street View</small></div>
      <div class="nv-lobby"><svg class="nv-defs" aria-hidden="true"><defs><linearGradient id="nvNpcFill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300"><stop offset="0" stop-color="#11223f"/><stop offset=".55" stop-color="#081123"/><stop offset="1" stop-color="#03060c"/></linearGradient></defs></svg><div class="nv-hall">
        <i class="nv-hall-wall"></i><i class="nv-hall-floor"></i>
        <div class="nv-zone" data-zone="exit"><b class="nv-exit-sign"><i>⇦</i>EXIT<small>出口</small></b><div class="nv-doors"><i class="nv-outside"></i><i class="nv-door l"></i><i class="nv-door r"></i></div><i class="nv-gate g1"></i><i class="nv-gate g2"></i><i class="nv-gate g3"></i><i class="nv-plant p1"></i><i class="nv-plant p2"></i><i class="nv-mat"></i></div>
        <div class="nv-zone" data-zone="desk"><div class="nv-sign"><img src="./assets/bluelock-mark.svg" alt=""><b>AZURE LATCH</b><span>INTERNATIONAL STRIKER PROJECT</span></div>
          <i class="nv-screen s1"><em>REGISTRATION · 登録 · РЕГИСТРАЦИЯ</em></i><i class="nv-screen s2"><em>WELCOME · ようこそ · BIENVENUE</em></i>
          <img class="nv-clerk" alt="Регистратор" hidden><div class="nv-desk"><i class="nv-bell"></i><i class="nv-monitor"></i><i class="nv-papers"></i><b>REGISTRATION</b><span>AZURE LATCH · 受付</span></div><i class="nv-rope r1"></i><i class="nv-rope r2"></i></div>
        <div class="nv-zone" data-zone="hall"><div class="nv-board"><b>ОЧЕРЕДЬ · QUEUE</b><span>A-114 → 3</span><span>A-115 → 1</span><span class="is-now">A-116 → 2</span><span>A-117 …</span></div><i class="nv-column"></i><i class="nv-bench"></i>${FIGURES.queue}${FIGURES.pair}${FIGURES.bench}</div>
        <div class="nv-zone" data-zone="screen"><div class="nv-tv"><video muted loop playsinline preload="none" data-src="${MATCH}"></video><i class="nv-tv-scan"></i><span class="nv-tv-tag">AZURE LATCH · АРХИВ</span><span class="nv-tv-live">● REC</span></div>
          <p class="nv-tv-ticker"><em>НИДЕРЛАНДЫ — ФРАНЦИЯ · АМСТЕРДАМ · 1937 · ИТОГ 2:3 · ЗАПИСЬ: POLYGOON HOLLANDS NIEUWS · </em></p><i class="nv-seats s1"></i><i class="nv-seats s2"></i></div>
        <div class="nv-spots"></div>
      </div><div class="nv-hall-fg"><i></i><i></i><i></i></div></div></div>
    <figure class="novel-cg" hidden><img alt=""></figure>
    <div class="novel-tv" hidden><video muted loop playsinline preload="none"></video><p>АРХИВ · НИДЕРЛАНДЫ — ФРАНЦИЯ · 1937 · <small>Polygoon Hollands Nieuws · Beeld en Geluid · общественное достояние</small></p></div>
    <p class="novel-voice" hidden></p>
    <p class="novel-place" hidden></p>
    <div class="novel-explore" hidden>
      <button type="button" class="novel-walk" data-walk="-1"><i>←</i><span></span></button><button type="button" class="novel-walk" data-walk="1"><span></span><i>→</i></button>
      <figure class="novel-map"><p class="novel-hint"></p><figcaption>ПЛАН · ГЛАВНОЕ ЗДАНИЕ · 1 ЭТАЖ</figcaption><svg viewBox="0 0 400 176" aria-label="План главного здания">
        <path class="nm-wall" d="M10 12H390V164H10V104M10 72V12"/><path class="nm-door" d="M10 72V104"/><text class="nm-out" x="14" y="92">⇦ улица</text>
        <path class="nm-inner" d="M100 12V48M100 128V164M200 12V40M300 12V40M300 136V164"/>
        <g class="nm-room" data-zone="exit" tabindex="0" role="button" aria-label="Выход"><rect x="11" y="13" width="89" height="150"/><text x="55" y="34">ВЫХОД</text><path class="nm-icon" d="M30 112H80M34 120H76M38 128H72"/></g>
        <g class="nm-room" data-zone="desk" tabindex="0" role="button" aria-label="Регистрация"><rect x="100" y="13" width="100" height="150"/><text x="150" y="34">РЕГИСТРАЦИЯ</text><path class="nm-icon" d="M118 58V82H182V58"/><circle class="nm-person" cx="150" cy="66" r="4"/></g>
        <g class="nm-room" data-zone="hall" tabindex="0" role="button" aria-label="Зона ожидания"><rect x="200" y="13" width="100" height="150"/><text x="250" y="34">ОЖИДАНИЕ</text><path class="nm-icon" d="M216 60H246M216 66H246M254 60H284M254 66H284"/><rect class="nm-icon" x="244" y="88" width="12" height="12"/><circle class="nm-person" cx="216" cy="90" r="3.5"/><circle class="nm-person" cx="236" cy="110" r="3.5"/><circle class="nm-person" cx="264" cy="110" r="3.5"/><circle class="nm-person" cx="282" cy="80" r="3.5"/></g>
        <g class="nm-room" data-zone="screen" tabindex="0" role="button" aria-label="Медиа-экран"><rect x="300" y="13" width="89" height="150"/><text x="345" y="34">ЭКРАН</text><path class="nm-tv" d="M384 56V120"/><path class="nm-icon" d="M326 66V110M342 66V110M358 66V110"/></g>
        <g class="nm-me"><circle r="11" class="nm-ring"/><circle r="5.5"/><text y="-15">ВЫ</text></g>
      </svg></figure></div>
    <div class="novel-box" hidden><b class="novel-name" hidden></b><p class="novel-text" aria-live="polite"></p><span class="novel-next" aria-hidden="true">▼</span></div>
    <div class="novel-card" hidden><span data-kicker></span><h2 data-title></h2><p data-sub></p><small data-credits></small></div>
    <div class="novel-tools"><button type="button" data-auto aria-pressed="false">АВТО</button><button type="button" data-skip>ПРОПУСТИТЬ ↷</button><button type="button" data-exit>✕ ВЫЙТИ</button></div>
    <i class="novel-flash" aria-hidden="true"></i>`;
  screen.append(root);
  const $ = s => root.querySelector(s);
  const bg = $('.novel-bg'), cg = $('.novel-cg'), cgImg = cg.querySelector('img'), voiceEl = $('.novel-voice'), placeEl = $('.novel-place');
  const box = $('.novel-box'), nameEl = $('.novel-name'), textEl = $('.novel-text'), cardEl = $('.novel-card'), flashEl = $('.novel-flash');
  const lobby = $('.nv-lobby'), clerk = $('.nv-clerk'), spotsEl = $('.nv-spots'), exploreEl = $('.novel-explore'), hintEl = $('.novel-hint');
  const wallVideo = $('.nv-tv video'), tv = $('.novel-tv'), tvVideo = tv.querySelector('video'), doors = $('.nv-doors'), me = $('.nm-me');

  // ── Sound ─────────────────────────────────────────────────────────────────
  let ctx = null, out = null, ambient = null, noiseBuffer = null;
  const level = () => sound ? sound.factor('lore', 'fx') : .4;
  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); setTimeout(() => { load('kids'); load('kick'); }, 0); out = ctx.createGain(); out.gain.value = level(); out.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      sound?.subscribe(ch => { if ((ch === 'lore' || ch === 'master') && out) out.gain.value = level(); });
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer; s.loop = true; return s; };
  function env(node, t, peak, attack, decay) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + attack); node.gain.exponentialRampToValueAtTime(.0001, t + attack + decay); }
  function tone(freq, t, peak, attack, decay, type = 'sine', to) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    env(g, t, peak, attack, decay); o.connect(g).connect(out); o.start(t); o.stop(t + attack + decay + .05);
  }
  function burst(t, peak, decay, freq = 2000, q = 1) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    env(g, t, peak, .004, decay); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + decay + .05);
  }
  const SFX = {
    ding(t) { tone(1318, t, .22, .005, 1.6); tone(2637, t, .08, .005, 1.1); },
    keys(t) { for (let i = 0; i < 14; i++) burst(t + i * .09 + Math.random() * .05, .12, .03, 3200 + Math.random() * 1500, 2); },
    heartbeat(t) { for (let i = 0; i < 3; i++) { tone(62, t + i * .8, .5, .01, .18, 'sine', 40); tone(58, t + i * .8 + .22, .38, .01, .16, 'sine', 38); } },
    ball(t) { for (let i = 0; i < 4; i++) tone(140, t + i * .32, .35 - i * .06, .003, .12, 'sine', 60); },
    shock(t) { tone(880, t, .16, .005, .25, 'square', 220); burst(t, .25, .2, 1200, .8); },
    sting(t) { tone(55, t, .7, .02, 2.2, 'sawtooth', 40); burst(t, .5, 1.4, 600, .5); tone(220, t, .12, .02, 1.8, 'triangle', 110); },
    whoosh(t) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3500, t + .5); env(g, t, .35, .25, .4); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + .8); },
    door(t) { burst(t, .3, .5, 500, .6); tone(90, t + .05, .25, .01, .4, 'sine', 70); },
    // Footsteps on a polished floor while the camera walks.
    steps(t) { for (let i = 0; i < 4; i++) { const at = t + i * .34 + Math.random() * .03; tone(110, at, .16, .003, .08, 'sine', 60); burst(at, .05, .05, 1800, 2); } },
    // The automatic glass doors slide open and shut.
    slide(t) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(700, t + .7); env(g, t, .16, .2, .7); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 1); tone(150, t, .05, .1, .7, 'triangle', 120); },
    tick(t) { tone(1600, t, .05, .002, .05, 'square'); }
  };
  // Recorded sounds from Wikimedia Commons (assets/lore/sfx/CREDITS.txt), decoded once.
  const FILES = {kids: './assets/lore/sfx/kids-tokyo.ogg?v=1', kick: './assets/lore/sfx/ball-kick.ogg?v=1'};
  const buffers = new Map();
  function load(name) {
    if (!buffers.has(name)) buffers.set(name, fetch(FILES[name]).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null));
    return buffers.get(name);
  }
  function sample(name, t, peak = 1, from = 0, length) {
    load(name).then(buffer => {
      if (!buffer || !playing) return;
      const s = ctx.createBufferSource(), g = ctx.createGain(), start = Math.max(t, ctx.currentTime), dur = Math.min(length ?? buffer.duration, buffer.duration - from);
      s.buffer = buffer; g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(peak, start + .4); g.gain.setValueAtTime(peak, start + Math.max(.4, dur - 1.2)); g.gain.linearRampToValueAtTime(0, start + dur);
      s.connect(g).connect(out); s.start(start, from, dur);
    });
  }
  // Children playing as they run past, and the ball being kicked twice.
  SFX.kids = t => { sample('kids', t, .9, 0, 6.5); sample('kick', t + .5, .8); sample('kick', t + 2.1, .55); };
  function sfx(name) { if (!audio() || !SFX[name]) return; SFX[name](ctx.currentTime + .02); }
  function loop(name) {
    if (ambient) { const a = ambient; a.gain.gain.setTargetAtTime(0, ctx.currentTime, .4); setTimeout(() => a.stop(), 1600); ambient = null; }
    if (!name || !audio()) return;
    const t = ctx.currentTime, gain = ctx.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(1, t, .8); gain.connect(out);
    const nodes = [], timers = [];
    if (name === 'waves') {
      // Surf: low noise that swells and falls every few seconds, and a gull now and then.
      const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = .32; lfo.frequency.value = .13; depth.gain.value = .22;
      lfo.connect(depth).connect(g.gain); s.connect(f).connect(g).connect(gain); s.start(); lfo.start(); nodes.push(s, lfo);
      const gull = () => { const n = ctx.currentTime; for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(1500, n + i * .28); o.frequency.exponentialRampToValueAtTime(950, n + i * .28 + .22); env(e, n + i * .28, .05, .02, .24); o.connect(e).connect(gain); o.start(n + i * .28); o.stop(n + i * .28 + .3); } timers.push(setTimeout(gull, 5000 + Math.random() * 7000)); };
      timers.push(setTimeout(gull, 2500));
    } else if (name === 'lobby') {
      // A big quiet hall: air conditioning hum and far-off voices.
      const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = .2;
      s.connect(f).connect(g).connect(gain); s.start(); nodes.push(s);
      const v = noise(), vf = ctx.createBiquadFilter(), vg = ctx.createGain(), lfo = ctx.createOscillator(), d = ctx.createGain();
      vf.type = 'bandpass'; vf.frequency.value = 700; vf.Q.value = 2.5; vg.gain.value = .04; lfo.frequency.value = 2.3; d.gain.value = .03;
      lfo.connect(d).connect(vg.gain); v.connect(vf).connect(vg).connect(gain); v.start(); lfo.start(); nodes.push(v, lfo);
    }
    ambient = {gain, stop() { nodes.forEach(n => { try { n.stop(); } catch {} }); timers.forEach(clearTimeout); gain.disconnect(); }};
  }
  function blip() { if (!ctx || ctx.state !== 'running') return; tone(520 + Math.random() * 120, ctx.currentTime, .025, .002, .03, 'square'); }

  // ── The hall: camera, receptionist, match screen ─────────────────────────
  let zone = 'desk', walking = false;
  function setCam(name, instant) {
    zone = ZONES.includes(name) ? name : 'desk';
    const k = ZONES.indexOf(zone);
    if (instant) { lobby.classList.add('is-still'); void lobby.offsetWidth; }
    lobby.style.setProperty('--camx', (k * root.clientWidth) + 'px');
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => lobby.classList.remove('is-still')));
    const [x, y] = [[55, 120], [150, 104], [250, 136], [345, 120]][k];
    me.style.transform = `translate(${x}px, ${y}px)`;
    for (const r of root.querySelectorAll('.nm-room')) r.classList.toggle('is-here', r.dataset.zone === zone);
    syncVideo();
  }
  addEventListener('resize', () => { if (playing) setCam(zone, true); });
  function walk(name) {
    if (!ZONES.includes(name) || name === zone || walking) return Promise.resolve(name === zone);
    const far = Math.abs(ZONES.indexOf(name) - ZONES.indexOf(zone));
    walking = true; root.classList.add('is-walking'); sfx('steps'); if (far > 1) setTimeout(() => playing && sfx('steps'), 1300);
    root.style.setProperty('--walk', (motion.matches ? 0 : 1.1 + far * .45) + 's');
    setCam(name);
    if (explore) renderExplore();
    return new Promise(done => setTimeout(() => { walking = false; root.classList.remove('is-walking'); done(true); }, motion.matches ? 0 : 1100 + far * 450));
  }
  // The receptionist behind the desk: calm · laugh · open · crossed (assets/lore/clerk-*.webp), or null.
  const CLERK_NAME = 'Регистратор';
  function setSprite(pose) {
    if (!pose) { clerk.hidden = true; clerk.dataset.pose = ''; return; }
    if (clerk.dataset.pose === pose && !clerk.hidden) return;
    const first = clerk.hidden;
    clerk.src = './assets/lore/clerk-' + pose + '.webp?v=1'; clerk.dataset.pose = pose; clerk.hidden = false;
    if (!motion.matches) clerk.animate(first ? [{opacity: 0, translate: '-50% 12px'}, {opacity: 1, translate: '-50% 0'}] : [{translate: '-50% 5px'}, {translate: '-50% -3px'}, {translate: '-50% 0'}], {duration: first ? 500 : 260, easing: 'ease-out'});
  }
  function syncVideo() {
    const on = playing && bg.dataset.bg === 'lobby' && !document.hidden && tv.hidden;
    if (on) { if (!wallVideo.src) wallVideo.src = wallVideo.dataset.src; wallVideo.play().catch(() => {}); } else wallVideo.pause();
  }
  function watch(on) {
    if (on) {
      tvVideo.src = wallVideo.dataset.src;
      const start = wallVideo.currentTime || 0;
      tvVideo.addEventListener('loadedmetadata', () => { try { tvVideo.currentTime = start; } catch {} }, {once: true});
      tv.hidden = false; tvVideo.play().catch(() => {});
      if (!motion.matches) tv.animate([{opacity: 0, scale: '.86'}, {opacity: 1, scale: '1'}], {duration: 420, easing: 'cubic-bezier(.2,1.1,.4,1)'});
    } else if (!tv.hidden) {
      if (tvVideo.currentTime) try { wallVideo.currentTime = tvVideo.currentTime; } catch {}
      tvVideo.pause(); tv.hidden = true;
    }
    syncVideo();
  }

  // ── Exploring ─────────────────────────────────────────────────────────────
  // explore: the {explore} step being played, the spots seen. stack: the main script while a spot's scene plays.
  let explore = null, stack = null;
  function spotsHere() { return (explore?.step.spots || []).map(s => ({...s, at: s.at || SPOT_AT[s.id] || ['desk', 50, 30]})); }
  function renderExplore() {
    const spots = spotsHere();
    spotsEl.innerHTML = spots.map(s => {
      const [z, x, y] = s.at, k = ZONES.indexOf(z);
      return `<button type="button" class="nv-spot${explore.seen.has(s.id) ? ' is-seen' : ''}${s.ends ? ' is-main' : ''}" data-spot="${escape(s.id)}" style="left:${(k + x / 100) * 25}%;top:${y}%" tabindex="${z === zone ? 0 : -1}"><i></i><span>${escape(s.label || s.id)}</span></button>`;
    }).join('');
    const k = ZONES.indexOf(zone);
    for (const b of root.querySelectorAll('[data-walk]')) {
      const to = ZONES[k + +b.dataset.walk]; b.hidden = !to; b.dataset.to = to || ''; b.querySelector('span').textContent = to ? ZONE_NAMES[to] : '';
    }
    for (const r of root.querySelectorAll('.nm-room')) {
      const all = spots.filter(s => s.at[0] === r.dataset.zone);
      r.classList.toggle('is-done', all.length > 0 && all.every(s => explore.seen.has(s.id)));
      r.classList.toggle('has-main', all.some(s => s.ends));
    }
    placeEl.textContent = 'AZURE LATCH · ГЛАВНОЕ ЗДАНИЕ · ' + ZONE_NAMES[zone]; show(placeEl, true);
  }
  function enterExplore(step) {
    if (explore?.step !== step) explore = {step, seen: new Set()};
    show(box, false); show(voiceEl, false); show(cardEl, false);
    if (!cg.hidden) setCg({cg: null});
    hintEl.textContent = step.hint || 'Осмотритесь.';
    exploreEl.hidden = false; root.classList.add('is-exploring'); root.classList.remove('is-ready');
    if (step.from && !explore.started) setCam(step.from);
    explore.started = true;
    renderExplore();
    if (!motion.matches) exploreEl.animate([{opacity: 0}, {opacity: 1}], {duration: 400});
  }
  function leaveExplore() { exploreEl.hidden = true; root.classList.remove('is-exploring'); }
  async function openSpot(id) {
    if (!explore || walking || stack) return;
    const spot = spotsHere().find(s => s.id === id); if (!spot) return;
    if (spot.at[0] !== zone) await walk(spot.at[0]);
    if (!playing || !explore) return;
    leaveExplore(); explore.seen.add(spot.id);
    stack = {script, index, spot};
    script = spot.play || []; index = 0;
    root.querySelector(`[data-npc="${CSS.escape(spot.id)}"]`)?.classList.add('is-talking');
    if (spot.watch) watch(true);
    if (spot.id === 'exit') { doors.classList.add('is-open'); sfx('slide'); }
    next();
  }
  function finishSpot() {
    const {script: s, index: i, spot} = stack; stack = null; script = s; index = i;
    root.querySelector('.nv-npc.is-talking')?.classList.remove('is-talking');
    watch(false);
    if (doors.classList.contains('is-open')) { doors.classList.remove('is-open'); sfx('slide'); }
    show(box, false);
    if (spot.ends) { explore = null; next(); } else enterExplore(explore.step);
  }

  // ── Playback ──────────────────────────────────────────────────────────────
  let script = [], credits = '', index = 0, typing = null, waiting = false, auto = false, autoTimer = 0, onDone = null, playing = false;
  function show(el, on) { el.hidden = !on; }
  function effect(step) {
    if (step.flash && !motion.matches) flashEl.animate([{opacity: .9}, {opacity: 0}], {duration: 700, easing: 'ease-out'});
    if (step.shake && !motion.matches) root.animate([{translate: '0 0'}, {translate: '-10px 4px'}, {translate: '9px -3px'}, {translate: '-6px 2px'}, {translate: '0 0'}], {duration: 360});
  }
  function setCg(step) {
    if (step.cg === null) { if (!cg.hidden) cg.animate([{opacity: 1}, {opacity: 0}], {duration: 250}).finished.then(() => { if (cgImg.dataset.src === '') cg.hidden = true; }); cgImg.dataset.src = ''; return; }
    cgImg.src = './assets/lore/' + step.cg; cgImg.dataset.src = step.cg; cg.hidden = false; cg.classList.toggle('is-zoom', !!step.zoom);
    if (!motion.matches) cg.animate(step.zoom ? [{scale: '1.35', opacity: 0}, {scale: '1', opacity: 1}] : [{translate: '0 24px', opacity: 0}, {translate: '0 0', opacity: 1}], {duration: step.zoom ? 380 : 450, easing: 'cubic-bezier(.2,1.2,.4,1)'});
  }
  function type(text, done) {
    textEl.textContent = '';
    const chars = [...text]; let i = 0;
    const speed = motion.matches ? 0 : 28;
    if (!speed) { textEl.textContent = text; done(); return; }
    const id = setInterval(() => {
      textEl.textContent += chars[i]; if (i % 3 === 0 && chars[i] !== ' ') blip(); i++;
      if (i >= chars.length) { clearInterval(id); typing = null; done(); }
    }, speed);
    typing = {id, finish() { clearInterval(id); typing = null; textEl.textContent = text; done(); }};
  }
  function line(step) {
    const kind = step.voice !== undefined ? 'voice' : step.say !== undefined ? 'say' : step.think !== undefined ? 'think' : 'narr';
    const text = step[kind];
    clerk.classList.toggle('is-speaking', kind === 'say' && step.who === CLERK_NAME);
    if (kind === 'voice') {
      show(box, false); show(voiceEl, true); voiceEl.textContent = '';
      const target = voiceEl;
      waiting = true;
      let i = 0; const chars = [...text];
      const id = setInterval(() => { target.textContent += chars[i++]; if (i >= chars.length) { clearInterval(id); typing = null; ready(step); } }, motion.matches ? 1 : 45);
      typing = {id, finish() { clearInterval(id); typing = null; target.textContent = text; ready(step); }};
      return;
    }
    show(voiceEl, false); show(box, true);
    box.dataset.kind = kind;
    const who = kind === 'say' ? step.who : kind === 'think' ? 'Кле · мысли' : '';
    nameEl.textContent = who || ''; show(nameEl, !!who);
    waiting = true;
    type(text, () => ready(step));
  }
  function ready(step) {
    root.classList.add('is-ready');
    // A cut-off line goes on by itself; a press in between must not start the next line twice.
    if (step.cut) { waiting = false; root.classList.remove('is-ready'); setTimeout(next, 120); return; }
    if (auto) autoTimer = setTimeout(next, 900 + (step.voice || step.say || step.think || step.narr || '').length * 35);
  }
  function next() {
    clearTimeout(autoTimer); root.classList.remove('is-ready'); waiting = false;
    if (typing) { clearInterval(typing.id); typing = null; }
    while (index < script.length) {
      const step = script[index++];
      if (step.bg) { const was = bg.dataset.bg; bg.dataset.bg = step.bg; if (step.bg !== 'black') show(voiceEl, false); if (step.bg === 'lobby' && was !== 'lobby') setCam(step.zone || 'desk', true); syncVideo(); }
      if (step.zone && !step.bg) walk(step.zone);
      if ('loop' in step) loop(step.loop);
      if (step.sfx) sfx(step.sfx);
      if ('sprite' in step) setSprite(step.sprite);
      effect(step);
      if ('cg' in step) setCg(step);
      if (step.place) { placeEl.textContent = step.place; show(placeEl, true); placeEl.animate?.([{opacity: 0, translate: '-12px 0'}, {opacity: 1, translate: '0 0'}], {duration: 500}); }
      if (step.title) {
        show(box, false); show(voiceEl, false); cardEl.querySelector('[data-kicker]').textContent = 'HYPERBOREA · LORE'; cardEl.querySelector('[data-title]').textContent = step.title; cardEl.querySelector('[data-sub]').textContent = step.sub || ''; cardEl.querySelector('[data-credits]').textContent = '';
        show(cardEl, true); waiting = true; root.classList.add('is-ready'); if (auto) autoTimer = setTimeout(next, 2200); return;
      } else show(cardEl, false);
      if (step.end) {
        leaveExplore(); explore = null; watch(false);
        show(box, false); show(voiceEl, false); show(cg, false); show(placeEl, false); loop(null);
        cardEl.querySelector('[data-kicker]').textContent = ''; cardEl.querySelector('[data-title]').textContent = step.end; cardEl.querySelector('[data-sub]').textContent = 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ…'; cardEl.querySelector('[data-credits]').textContent = credits;
        show(cardEl, true); waiting = true; root.classList.add('is-ready', 'is-end'); return;
      }
      if (step.explore) { enterExplore(step); return; }
      if (step.voice !== undefined || step.say !== undefined || step.think !== undefined || step.narr !== undefined) { line(step); return; }
      if (step.hold) { show(box, false); waiting = true; root.classList.add('is-ready'); if (auto) autoTimer = setTimeout(next, 1800); return; }
      if (step.wait) { setTimeout(next, motion.matches ? 0 : step.wait); return; }
    }
    if (stack) { finishSpot(); return; }
    exit();
  }
  function advance() {
    if (!playing || walking) return;
    if (typing) { typing.finish(); return; }
    if (root.classList.contains('is-end')) { exit(); return; }
    if (waiting) next();
  }
  function play(chapter, done) {
    if (!chapter?.play?.length) return false;
    script = chapter.play; credits = chapter.credits || ''; index = 0; onDone = done; playing = true; auto = false; explore = null; stack = null; walking = false;
    $('[data-auto]').setAttribute('aria-pressed', 'false');
    bg.dataset.bg = 'black'; cg.hidden = true; box.hidden = true; voiceEl.hidden = true; placeEl.hidden = true; cardEl.hidden = true; exploreEl.hidden = true; tv.hidden = true;
    setSprite(null); doors.classList.remove('is-open');
    root.classList.remove('is-ready', 'is-end', 'is-exploring', 'is-walking'); root.hidden = false;
    audio();
    if (!motion.matches) root.animate([{opacity: 0}, {opacity: 1}], {duration: 400});
    root.focus({preventScroll: true});
    setCam('desk', true);
    next();
    return true;
  }
  function exit() {
    if (!playing) return;
    playing = false; clearTimeout(autoTimer); if (typing) { clearInterval(typing.id); typing = null; }
    explore = null; stack = null; walking = false; leaveExplore(); watch(false); wallVideo.pause();
    loop(null); root.hidden = true; root.classList.remove('is-end');
    const done = onDone; onDone = null; done?.();
  }
  function skip() {
    if (stack) { script = stack.script; index = stack.index; stack = null; watch(false); root.querySelector('.nv-npc.is-talking')?.classList.remove('is-talking'); }
    leaveExplore(); explore = null;
    while (index < script.length && !script[index].end) index++;
    if (typing) { clearInterval(typing.id); typing = null; }
    next();
  }
  root.tabIndex = -1;
  root.addEventListener('click', event => {
    if (event.target.closest('[data-exit]')) { exit(); return; }
    if (event.target.closest('[data-skip]')) { skip(); return; }
    if (event.target.closest('[data-auto]')) { auto = !auto; event.target.closest('[data-auto]').setAttribute('aria-pressed', String(auto)); if (auto && root.classList.contains('is-ready')) next(); return; }
    if (explore && !stack) {
      const spot = event.target.closest('[data-spot]'); if (spot) { openSpot(spot.dataset.spot); return; }
      const step = event.target.closest('[data-walk]'); if (step) { walk(step.dataset.to); return; }
      const room = event.target.closest('.nm-room'); if (room) { walk(room.dataset.zone); return; }
      return;
    }
    advance();
  });
  root.addEventListener('keydown', event => {
    const room = event.target.closest?.('.nm-room');
    if (room && (event.key === 'Enter' || event.key === ' ') && explore && !stack) { event.preventDefault(); event.stopImmediatePropagation(); walk(room.dataset.zone); }
  });
  addEventListener('keydown', event => {
    if (!playing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); return; }
    if (explore && !stack) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopImmediatePropagation(); walk(ZONES[ZONES.indexOf(zone) + (event.key === 'ArrowLeft' ? -1 : 1)]); }
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopImmediatePropagation(); advance(); }
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && ctx) ctx.suspend?.(); else if (playing && ctx) ctx.resume?.(); syncVideo(); });
  window.LoreNovel = {play, exit, walk, open: openSpot, get playing() { return playing; }, get zone() { return zone; }, get exploring() { return !!explore && !stack; }};
})();
