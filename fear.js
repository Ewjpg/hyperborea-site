(() => {
  'use strict';
  const screen = document.getElementById('screen');
  const database = document.getElementById('database');
  const roster = document.getElementById('playersRoster');
  const card = document.getElementById('fearCard');
  const section = document.getElementById('dbSection');
  const dossier = document.getElementById('fearDossier');
  const path = document.getElementById('dbPath');
  const status = document.getElementById('dbNetworkStatus');
  const shroud = document.getElementById('fearShroud');
  const preview = document.getElementById('fearPreview');
  const score = document.getElementById('fearScore');
  const musicToggle = document.getElementById('fearMusicToggle');
  const musicVolume = document.getElementById('fearMusicVolume');
  const musicLevel = document.getElementById('fearMusicLevel');
  const musicSettingsKey = 'hyperborea_fear_audio_v1';
  let opened = false;
  let transitioning = false;
  let closing = false;
  let hovered = false;
  let focused = false;
  let previewWanted = false;
  let previewExhausted = false;
  let suppressPreview = false;
  let resumeScore = false;
  let transitionTimers = [];
  let epoch = 0;
  let previewFadeFrame = 0;
  let previewRequest = 0;
  let scoreVolume = .18;
  let userPaused = false;
  try {
    const saved = JSON.parse(localStorage.getItem(musicSettingsKey) || 'null');
    if (saved && typeof saved.paused === 'boolean') userPaused = saved.paused;
  } catch (error) {}
  // Levels come from the shared sound mixer (window.HyperboreaSound); the preview has its own trim.
  const sound = window.HyperboreaSound;
  scoreVolume = sound.gain('fear');
  preview.volume = 0;
  score.volume = scoreVolume;
  function syncMusicControls() {
    musicToggle.textContent = score.paused ? 'PLAY' : 'PAUSE';
    musicToggle.setAttribute('aria-label', score.paused ? 'Воспроизвести музыку FEAR' : 'Приостановить музыку FEAR');
    musicToggle.setAttribute('aria-pressed', String(!score.paused));
  }
  function saveMusicSettings() {
    try { localStorage.setItem(musicSettingsKey, JSON.stringify({paused:userPaused})); } catch (error) {}
  }
  sound.bind(musicVolume, 'fear', musicLevel);
  sound.subscribe(channel => {
    if (channel !== 'fear' && channel !== 'master') return;
    scoreVolume = sound.gain('fear');
    score.volume = scoreVolume;
    if (previewWanted && !previewFadeFrame && !preview.paused) preview.volume = sound.gain('fear', 'preview');
  });
  musicToggle.addEventListener('click', () => {
    if (!opened || transitioning || window.FearDance?.decorated) return;
    if (score.paused) {
      userPaused = false;
      playScore();
    } else {
      userPaused = true;
      score.pause();
    }
    syncMusicControls();
    saveMusicSettings();
  });
  score.addEventListener('play', () => { if (!window.FearDance?.decorated) syncMusicControls(); });
  score.addEventListener('pause', () => { if (!window.FearDance?.decorated) syncMusicControls(); });
  syncMusicControls();

  function rosterVisible() {
    return database.classList.contains('active') && !roster.hidden && !section.hidden && !opened && !transitioning && !document.hidden && !window.WahArchive?.isOpen && !window.WahArchive?.busy && !window.FrogArchive?.isOpen && !window.FrogArchive?.busy && !window.SwarggyArchive?.isOpen && !window.SwarggyArchive?.busy;
  }
  function halt(audio) {
    audio.pause();
    try { audio.currentTime = 0; } catch (error) {}
  }
  function cancelPreviewFade() {
    cancelAnimationFrame(previewFadeFrame);
    previewFadeFrame = 0;
  }
  function fadeInPreview() {
    cancelPreviewFade();
    const started = performance.now();
    function step(now) {
      if (!previewWanted || !rosterVisible()) return;
      const progress = Math.min(1, (now - started) / 2200);
      preview.volume = sound.gain('fear', 'preview') * progress * progress * (3 - 2 * progress);
      if (progress < 1) previewFadeFrame = requestAnimationFrame(step);
      else previewFadeFrame = 0;
    }
    previewFadeFrame = requestAnimationFrame(step);
  }
  function stopPreview() {
    previewRequest++;
    cancelPreviewFade();
    preview.volume = 0;
    previewWanted = false;
    halt(preview);
  }
  function startPreview() {
    if (!rosterVisible() || suppressPreview || previewExhausted || previewWanted || userPaused) return;
    previewWanted = true;
    preview.volume = 0;
    preview.currentTime = 0;
    const request = ++previewRequest;
    preview.play().then(() => {
      if (request === previewRequest && previewWanted && rosterVisible()) fadeInPreview();
      else if (!previewWanted) halt(preview);
    }).catch(error => {
      if (request === previewRequest) previewWanted = false;
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') console.warn('FEAR preview:', error);
    });
  }
  preview.addEventListener('ended', () => {
    cancelPreviewFade();
    preview.volume = 0;
    previewWanted = false;
    previewExhausted = true;
  });
  card.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    previewExhausted = false;
    startPreview();
  });
  card.addEventListener('pointerleave', () => {
    hovered = false;
    focused = false;
    previewExhausted = false;
    stopPreview();
  });
  card.addEventListener('pointermove', () => {
    if (!suppressPreview || !rosterVisible()) return;
    suppressPreview = false;
    previewExhausted = false;
    startPreview();
  });
  card.addEventListener('focus', () => {
    focused = card.matches(':focus-visible');
    if (focused) startPreview();
  });
  card.addEventListener('blur', () => {
    focused = false;
    if (!opened) suppressPreview = false;
    if (!hovered) stopPreview();
  });
  card.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') suppressPreview = true;
  });
  card.addEventListener('mouseleave', stopPreview);
  card.addEventListener('pointercancel', stopPreview);
  window.addEventListener('blur', () => {hovered=false;focused=false;stopPreview();});
  const previewGuard = new MutationObserver(() => {if (!rosterVisible()) stopPreview();});
  for (const element of [database,roster,section]) previewGuard.observe(element,{attributes:true,attributeFilter:['class','hidden']});
  function applyTheme(active) {
    database.classList.toggle('fear-theme', active);
    screen.classList.toggle('fear-active', active);
    status.textContent = active ? 'SIGNAL UNKNOWN' : 'CONNECTION STABLE';
  }
  function transition(swap, finish) {
    transitioning = true;
    shroud.hidden = false;
    // A diagonal ink cut and two held impact images, with no eyelid movement.
    shroud.replaceChildren();
    const cover = document.createElement('div');
    cover.className = 'fear-ink-cover';
    shroud.appendChild(cover);
    for (const name of ['first','second']) {
      const frame = document.createElement('div');
      frame.className = 'fear-impact-frame ' + name;
      const portrait = document.createElement('img');
      portrait.src = './assets/fear-cutout.png';
      portrait.alt = '';
      frame.appendChild(portrait);
      const slash = document.createElement('span');
      slash.className = 'fear-impact-slash';
      frame.appendChild(slash);
      shroud.appendChild(frame);
    }
    const edge = document.createElement('div');
    edge.className = 'fear-cut-edge';
    shroud.appendChild(edge);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transitionTimers.push(setTimeout(swap, reduced ? 95 : 430));
    transitionTimers.push(setTimeout(() => {
      shroud.hidden = true;
      shroud.replaceChildren();
      transitioning = false;
      transitionTimers = [];
      finish();
    }, reduced ? 210 : 1180));
  }
  function playScore() {
    const request = epoch;
    score.volume = scoreVolume;
    if (userPaused) { syncMusicControls(); return; }
    score.play().then(() => {
      if (request !== epoch && !opened) halt(score);
    }).catch(error => {
      if (error.name !== 'AbortError') console.warn('FEAR dossier:', error);
    });
  }
  function showDossier() {
    section.hidden = true;
    dossier.hidden = false;
    path.textContent = 'HYPERBOREA / PLAYERS / КЛАУС ШТУРМ';
    database.scrollTop = 0;
  }
  function openDossier() {
    if (opened || transitioning || !rosterVisible()) return;
    epoch++;
    stopPreview();
    opened = true;
    suppressPreview = true;
    applyTheme(true);
    // One time in five the fear is replaced by a dance (fear-dance.js), and the dossier keeps it as a backdrop.
    if (window.FearDance?.roll() && window.FearDance.play({onComplete: revealFromDance, onCancel: leaveFear})) {
      transitioning = true;
      primeScore();
      return;
    }
    // Threads first drag the viewer through one of FEAR's fears (fear-experience.js);
    // the ink cut below stays as the fallback when 3D is unavailable.
    if (window.FearExperience?.open({onComplete: revealFromFear, onCancel: leaveFear})) {
      transitioning = true;
      primeScore();
      return;
    }
    score.currentTime = 0; // This excerpt starts at original track timestamp 0:35.
    playScore(); // Called inside the click, before transition timers.
    transition(showDossier, () => document.getElementById('fearTitle').focus({preventScroll:true}));
  }
  // The theme only starts after the fear, so it is unlocked silently inside the opening click.
  function primeScore() {
    score.muted = true;
    score.play().then(() => {
      halt(score);
      score.muted = false;
    }).catch(() => { score.muted = false; });
  }
  function revealFromFear() {
    if (!opened) return;
    transitioning = false;
    showDossier();
    score.currentTime = 0;
    playScore();
    document.getElementById('fearTitle').focus({preventScroll:true});
  }
  // The dance replaces his theme: its own sound plays instead, and the music button controls it.
  function revealFromDance() {
    if (!opened) return;
    transitioning = false;
    showDossier();
    window.FearDance.decorate(true);
    document.getElementById('fearTitle').focus({preventScroll:true});
  }
  function leaveFear() {
    window.FearDance?.decorate(false);
    transitioning = false;
    resetGaze();
    opened = false;
    applyTheme(false);
    suppressPreview = true;
    card.focus({preventScroll:true});
  }
  function restoreRoster() {
    window.FearDance?.decorate(false);
    resetGaze();
    opened = false;
    dossier.hidden = true;
    section.hidden = false;
    path.textContent = 'HYPERBOREA / PLAYERS';
    applyTheme(false);
    database.scrollTop = 0;
  }
  function closeDossier() {
    if (window.FearExperience?.active) { window.FearExperience.cancel(); return; }
    if (window.FearDance?.active) { window.FearDance.cancel(); return; }
    if (!opened || closing || window.HyperboreaTransitions?.busy) return;
    silence();
    suppressPreview = true;
    // Cancel an unfinished impact entrance before using the normal system glitch.
    transitionTimers.forEach(clearTimeout);
    transitionTimers = [];
    shroud.hidden = true;
    shroud.replaceChildren();
    transitioning = true;
    closing = true;
    const finish = () => {
      transitioning = false;
      closing = false;
      suppressPreview = true;
      card.focus({preventScroll:true});
    };
    if (window.HyperboreaTransitions) {
      window.HyperboreaTransitions.glitch(dossier.hidden ? section : dossier, section, restoreRoster, finish);
    } else {
      restoreRoster(); finish();
    }
  }
  function silence() {
    epoch++;
    stopPreview();
    halt(score);
    resumeScore = false;
  }
  function reset() {
    window.FearExperience?.reset();
    window.FearDance?.reset();
    resetGaze();
    epoch++;
    stopPreview();
    halt(score);
    resumeScore = false;
    transitionTimers.forEach(clearTimeout);
    transitionTimers = [];
    shroud.hidden = true;
    shroud.replaceChildren();
    transitioning = false;
    closing = false;
    if (opened) restoreRoster();
    opened = false;
    dossier.hidden = true;
    applyTheme(false);
    hovered = false;
    focused = false;
    previewExhausted = false;
    suppressPreview = false;
  }
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gazePupils = Array.from(dossier.querySelectorAll('.watcher-pupils circle')).map(pupil => ({
    pupil, svg:pupil.ownerSVGElement,
    cx:Number(pupil.getAttribute('cx')), cy:Number(pupil.getAttribute('cy')), x:0, y:0
  }));
  let gazeFrame = 0;
  let gazePoint = null;
  function requestGaze() {
    if (!gazeFrame && opened && !dossier.hidden && gazePoint && !motionPreference.matches) {
      gazeFrame = requestAnimationFrame(drawGaze);
    }
  }
  function drawGaze() {
    gazeFrame = 0;
    if (!opened || dossier.hidden || !gazePoint || motionPreference.matches) return;
    // Read each eye's geometry first, then write transforms: no shared viewport offset.
    const plans = gazePupils.map(eye => {
      const matrix = eye.svg.getScreenCTM();
      if (!matrix) return {eye,x:0,y:0};
      let local;
      try { local = new DOMPoint(gazePoint.x,gazePoint.y).matrixTransform(matrix.inverse()); }
      catch(error) { return {eye,x:0,y:0}; }
      const dx = local.x - eye.cx, dy = local.y - eye.cy;
      const distance = Math.hypot(dx,dy);
      const amount = Math.min(1,distance / 120);
      return {eye,x:distance ? dx/distance*8*amount : 0,y:distance ? dy/distance*3*amount : 0};
    });
    let moving = false;
    for (const {eye,x,y} of plans) {
      if (Math.abs(x-eye.x)+Math.abs(y-eye.y)>.025) moving=true;
      eye.x += (x-eye.x)*.22;
      eye.y += (y-eye.y)*.22;
      eye.pupil.setAttribute('transform','translate('+eye.x.toFixed(3)+' '+eye.y.toFixed(3)+')');
    }
    if (moving) requestGaze();
  }
  function resetGaze() {
    cancelAnimationFrame(gazeFrame);gazeFrame=0;gazePoint=null;
    gazePupils.forEach(eye => {eye.x=0;eye.y=0;eye.pupil.setAttribute('transform','translate(0 0)');});
  }
  database.addEventListener('pointermove',event=>{
    if (!opened || event.pointerType==='touch' || motionPreference.matches) return;
    gazePoint={x:event.clientX,y:event.clientY};requestGaze();
  },{passive:true});
  database.addEventListener('pointerleave',resetGaze,{passive:true});
  database.addEventListener('scroll',requestGaze,{passive:true});
  window.addEventListener('resize',requestGaze);
  motionPreference.addEventListener('change',()=>{if(motionPreference.matches)resetGaze();});
  dossier.querySelectorAll('[data-fear-scroll]').forEach(button=>{
    button.addEventListener('click',()=>{
      const target=document.getElementById(button.dataset.fearScroll);
      if(!target)return;
      target.focus({preventScroll:true});
      target.scrollIntoView({behavior:motionPreference.matches?'auto':'smooth',block:'start'});
    });
  });
  card.addEventListener('click', openDossier);
  document.getElementById('fearReturn').addEventListener('click', closeDossier);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPreview();
      resumeScore = opened && !score.paused;
      score.pause();
    } else if (opened && resumeScore) {
      resumeScore = false;
      playScore();
    }
  });
  window.addEventListener('pagehide', reset);
  // Two looks of Klaus, as for Minami Shin: on the field (the manga cut-out) and off the field (colour art).
  const heroArt = dossier.querySelector('.fear-hero-art');
  const lookButtons = [...dossier.querySelectorAll('.fear-look button')];
  function setLook(look) {
    if (!heroArt) return;
    heroArt.dataset.look = look;
    for (const button of lookButtons) button.setAttribute('aria-pressed', String(button.dataset.look === look));
    heroArt.querySelector('.fear-portrait-off')?.setAttribute('aria-hidden', String(look !== 'off'));
  }
  lookButtons.forEach(button => button.addEventListener('click', () => setLook(button.dataset.look)));
  window.FearArchive = {reset, silence, close:closeDossier, setLook, get isOpen(){return opened;}};
})();

