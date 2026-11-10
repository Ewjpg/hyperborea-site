// Клаус Штурм: one time in five his card opens with a dance (assets/fear-dance.mp4) instead of the fear game.
// The dossier then keeps the dance as a blurred background under a screen of dots, and Минами Син's icon
// orbits Klaus's portrait in an over-tweened, elastic "tweenslop" style. fear.js decides when to use it.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  const database = document.getElementById('database');
  const dossier = document.getElementById('fearDossier');
  const art = dossier?.querySelector('.fear-hero-art');
  if (!screen || !database || !dossier || !art) return;
  const VIDEO = './assets/fear-dance.mp4?v=1';
  const ICON = './assets/minami-shin-manga.webp?v=2';
  const CHANCE = .15;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const sound = window.HyperboreaSound;
  const level = () => sound ? sound.gain('fear', 'dance') : .5;

  // The intro: the dance itself, sharp in the middle, with a blurred copy filling the screen behind it.
  const overlay = document.createElement('section');
  overlay.className = 'fear-dance-intro'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Клаус Штурм — танец'); overlay.tabIndex = -1;
  overlay.innerHTML = '<video class="fear-dance-blur" muted playsinline preload="none" aria-hidden="true"></video><i class="fear-dance-dots" aria-hidden="true"></i>'
    + '<video class="fear-dance-main" playsinline preload="none" aria-hidden="true"></video>'
    + '<img class="fear-dance-sticker" src="' + ICON + '" alt="" aria-hidden="true">'
    + '<p class="fear-dance-name" aria-hidden="true"><span>КЛАУС</span> <span>ШТУРМ</span></p>'
    + '<button class="fear-dance-skip" type="button">ПРОПУСТИТЬ ↗</button>';
  screen.append(overlay);
  const main = overlay.querySelector('.fear-dance-main'), blur = overlay.querySelector('.fear-dance-blur'), skip = overlay.querySelector('.fear-dance-skip');

  // In the dossier: the blurred dance stays on screen while scrolling, and Shin orbits the portrait.
  const backdrop = document.createElement('div');
  backdrop.className = 'fear-dance-backdrop'; backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML = '<div class="fear-dance-pin"><video loop playsinline preload="none"></video><i class="fear-dance-dots"></i></div>';
  dossier.prepend(backdrop);
  const backVideo = backdrop.querySelector('video');
  const orbit = document.createElement('span');
  orbit.className = 'fear-dance-orbit'; orbit.setAttribute('aria-hidden', 'true');
  // Four nested layers: the orbit, a counter-rotation that keeps him upright, his own spins, his squash and stretch.
  orbit.innerHTML = '<span class="fear-dance-arm"><span class="fear-dance-upright"><span class="fear-dance-spin"><img src="' + ICON + '" alt=""></span></span></span>';
  art.append(orbit);

  let state = 'off', callbacks = null, timer = 0;
  function play(next = {}) {
    if (state !== 'off') return false;
    callbacks = next; state = 'intro';
    for (const video of [main, blur]) { video.src = VIDEO; video.currentTime = 0; }
    main.volume = Math.min(1, level()); main.muted = false;
    overlay.hidden = false; database.inert = true; screen.classList.add('fear-dance-active');
    void overlay.offsetWidth; overlay.classList.add('is-on');
    skip.focus({preventScroll: true});
    // Started inside the click, so the browser lets the sound play; if it refuses, it plays muted.
    main.play().catch(() => { main.muted = true; main.play().catch(() => finish()); });
    blur.play().catch(() => {});
    // A stalled video must never trap the player.
    clearTimeout(timer); timer = setTimeout(finish, 20000);
    return true;
  }
  // keep: the dance goes on into the dossier, so the sharp video is left playing for the DVD window.
  function close(keep = false) {
    clearTimeout(timer);
    for (const video of keep ? [blur] : [main, blur]) { video.pause(); video.removeAttribute('src'); video.load(); }
    overlay.classList.remove('is-on'); overlay.hidden = true;
    database.inert = false; screen.classList.remove('fear-dance-active');
    const done = callbacks; callbacks = null; state = 'off';
    return done;
  }
  function finish() { if (state === 'intro') close(true)?.onComplete?.(); }
  function cancel() { if (state === 'intro') close()?.onCancel?.(); }
  // While the dance is on, its sound is the music: the profile's PLAY/PAUSE button and Klaus's slider control it.
  const toggle = document.getElementById('fearMusicToggle'), score = document.getElementById('fearScore');
  let soundOff = false, chaosTimer = 0;
  function syncToggle() {
    if (!toggle) return;
    const playing = dossier.classList.contains('fear-dance-on') ? !main.paused && !main.muted : !score?.paused;
    toggle.textContent = playing ? 'PAUSE' : 'PLAY'; toggle.setAttribute('aria-pressed', String(playing));
  }
  toggle?.addEventListener('click', () => {
    if (!dossier.classList.contains('fear-dance-on')) return;
    soundOff = !soundOff; main.muted = soundOff; syncToggle();
  });
  // Tweenslop chaos: every so often a random block of the card jumps, spins and squashes.
  const BLOCKS = '.profile-name-block,.fear-title,.fear-music-controls,.fear-quick-facts>div,.fear-section-nav button,.fear-radar,.player-overall,.fear-ratings label,.fear-cell-heading,.fear-weapon-heading,.fear-portrait-caption,.fear-portrait-echo,.fear-file-header .db-back,.fear-send-heading';
  function boing() {
    if (!dossier.classList.contains('fear-dance-on')) return;
    if (!document.hidden && !motion.matches) {
      const blocks = [...dossier.querySelectorAll(BLOCKS)].filter(block => block.offsetParent);
      for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n && blocks.length; i++) {
        const block = blocks[Math.floor(Math.random() * blocks.length)], turn = Math.random() < .5 ? -1 : 1;
        block.animate([
          {transform: 'none'},
          {transform: 'translateY(8px) scale(1.12,.82)', offset: .15},
          {transform: 'translateY(-26px) scale(.88,1.18) rotate(' + turn * 180 + 'deg)', offset: .45},
          {transform: 'translateY(4px) scale(1.1,.9) rotate(' + turn * 360 + 'deg)', offset: .75},
          {transform: 'rotate(' + turn * 360 + 'deg)'}
        ], {duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.3,1.6,.5,1)', composite: 'add'});
      }
    }
    chaosTimer = setTimeout(boing, 350 + Math.random() * 900);
  }
  // The DVD window: the same video element as the intro, moved into a frame that drifts and bounces off the
  // screen's edges. Each bounce squashes it and shifts its colour; now and then it changes course on its own.
  const dvd = document.createElement('div');
  dvd.className = 'fear-dance-dvd'; dvd.hidden = true; dvd.setAttribute('aria-hidden', 'true');
  screen.append(dvd);
  let dvdFrame = 0, last = 0, x = 0, y = 0, vx = 0, vy = 0, hue = 0, swerve = 0;
  function bounce(axis) {
    hue = (hue + 70 + Math.random() * 150) % 360; dvd.style.setProperty('--dvd-hue', hue.toFixed(0) + 'deg');
    const speed = Math.hypot(vx, vy) * (.8 + Math.random() * .45), angle = Math.atan2(vy, vx) + (Math.random() - .5) * .5;
    vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed;
    if (axis === 'x') vx = Math.abs(vx) * (x <= 0 ? 1 : -1); else vy = Math.abs(vy) * (y <= 0 ? 1 : -1);
    const speedNow = Math.hypot(vx, vy); if (speedNow < 140 || speedNow > 420) { const k = 260 / speedNow; vx *= k; vy *= k; }
    if (!motion.matches) dvd.firstElementChild?.animate(axis === 'x'
      ? [{scale: '1'}, {scale: '.72 1.18', offset: .25}, {scale: '1.12 .9', offset: .6}, {scale: '1'}]
      : [{scale: '1'}, {scale: '1.18 .72', offset: .25}, {scale: '.9 1.12', offset: .6}, {scale: '1'}], {duration: 420, easing: 'cubic-bezier(.3,1.7,.5,1)'});
  }
  function drift(now) {
    dvdFrame = requestAnimationFrame(drift);
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    const w = screen.clientWidth, h = screen.clientHeight, bw = dvd.offsetWidth, bh = dvd.offsetHeight;
    if ((swerve -= dt) <= 0) { swerve = 2 + Math.random() * 4; const angle = Math.random() * Math.PI * 2, speed = Math.hypot(vx, vy); vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed; }
    x += vx * dt; y += vy * dt;
    if (x <= 0 || x >= w - bw) { x = Math.max(0, Math.min(w - bw, x)); bounce('x'); }
    if (y <= 0 || y >= h - bh) { y = Math.max(0, Math.min(h - bh, y)); bounce('y'); }
    dvd.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }
  function startDvd() {
    dvd.append(main); main.loop = true; dvd.hidden = false;
    x = Math.random() * Math.max(1, screen.clientWidth - 240); y = Math.random() * Math.max(1, screen.clientHeight - 360);
    const angle = Math.random() * Math.PI * 2; vx = Math.cos(angle) * 240; vy = Math.sin(angle) * 240; swerve = 3;
    cancelAnimationFrame(dvdFrame); last = performance.now();
    if (!motion.matches) dvdFrame = requestAnimationFrame(drift); else dvd.style.transform = 'translate(24px,24px)';
  }
  function stopDvd() {
    cancelAnimationFrame(dvdFrame); dvdFrame = 0; dvd.hidden = true;
    main.loop = false; main.pause(); main.removeAttribute('src'); main.load();
    overlay.insertBefore(main, overlay.querySelector('.fear-dance-sticker'));
  }
  function decorate(on) {
    dossier.classList.toggle('fear-dance-on', on);
    database.classList.toggle('fear-dance-page', on);
    clearTimeout(chaosTimer);
    if (on) {
      // The intro's video carries on from where it was; if the intro ended, it starts over.
      soundOff = false;
      if (!main.getAttribute('src')) { main.src = VIDEO; main.muted = false; }
      main.volume = Math.min(1, level());
      if (main.ended) main.currentTime = 0;
      startDvd();
      main.play().catch(() => { main.muted = true; main.play().catch(() => {}); }).finally(syncToggle);
      // The blurred copy behind is silent and follows the same moment of the dance.
      backVideo.src = VIDEO; backVideo.muted = true;
      backVideo.addEventListener('loadedmetadata', () => { try { backVideo.currentTime = main.currentTime; } catch {} }, {once: true});
      backVideo.play().catch(() => {});
      chaosTimer = setTimeout(boing, 600);
    } else {
      backVideo.pause(); backVideo.removeAttribute('src'); backVideo.load();
      if (dvd.contains(main)) stopDvd();
    }
    syncToggle();
  }
  function reset() { if (state === 'intro') close(); decorate(false); if (dvd.contains(main)) stopDvd(); }

  main.addEventListener('ended', () => { if (state === 'intro') finish(); });
  skip.addEventListener('click', finish);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
    if (event.key === 'Tab') { event.preventDefault(); skip.focus({preventScroll: true}); }
  });
  sound?.subscribe(channel => { if (channel === 'fear' || channel === 'master') main.volume = Math.min(1, level()); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { main.pause(); blur.pause(); backVideo.pause(); return; }
    if (state === 'intro') { main.play().catch(() => {}); blur.play().catch(() => {}); }
    if (dossier.classList.contains('fear-dance-on')) { main.play().catch(() => {}); backVideo.play().catch(() => {}); }
  });

  window.FearDance = {
    // Set FearDance.force = true (for testing) to make the next opening a dance.
    force: false,
    roll() { const yes = this.force || Math.random() < CHANCE; this.force = false; return yes; },
    play, cancel, reset, decorate,
    get active() { return state !== 'off'; },
    get decorated() { return dossier.classList.contains('fear-dance-on'); }
  };
})();
