import {STAT_AXES, parseRating} from './rating-model.mjs?v=36';
import {createProfileRadar} from './player-ratings.mjs?v=36';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('screen'), database = $('database'), section = $('dbSection'), roster = $('playersRoster');
  const dossier = $('frogDossier'), card = $('frogCard'), title = $('frogTitle');
  if (!screen || !database || !dossier || !card) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.createElement('div');
  overlay.className = 'frog-deal-overlay'; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
  screen.append(overlay);
  let opened = false, busy = false, swapping = false, finishTransition = null, runId = 0;
  let animations = [], timers = [], tiltFrame = 0, rollTimer = 0, rolling = false;
  const ambient = () => window.HyperboreaAmbience?.refresh();
  function theme(value) {
    database.classList.toggle('frog-theme', value);
    screen.classList.toggle('frog-active', value);
    if ($('dbNetworkStatus')) $('dbNetworkStatus').textContent = 'CONNECTION STABLE';
    ambient();
  }
  function clearTilt() {
    cancelAnimationFrame(tiltFrame); tiltFrame = 0;
    dossier.style.setProperty('--frog-rx', '0deg'); dossier.style.setProperty('--frog-ry', '0deg');
  }
  function stopRoll() {
    clearTimeout(rollTimer); rollTimer = 0; rolling = false;
    dossier.classList.remove('is-rolling');
    const button = $('frogRoll'); if (button) { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
  }
  function deactivate(restore) {
    window.FrogAudio?.exit();
    stopRoll(); clearTilt(); opened = false; dossier.hidden = true; theme(false);
    if (restore) {
      section.hidden = false; roster.hidden = false;
      $('dbPath').textContent = 'HYPERBOREA / PLAYERS'; database.scrollTop = 0;
      window.PlayersSpace?.refresh?.();
    }
  }
  function deal(swap, done) {
    finishTransition?.();
    const version = ++runId;
    let swapped = false;
    const applySwap = () => {
      if (swapped || version !== runId) return;
      swapped = true; swapping = true;
      try { swap(); } finally { swapping = false; }
    };
    const finish = () => {
      if (version !== runId) return;
      applySwap(); runId++;
      finishTransition = null; timers.forEach(clearTimeout); timers = [];
      animations.forEach(animation => animation.cancel()); animations = [];
      overlay.hidden = true; overlay.replaceChildren(); database.inert = false; busy = false;
      done?.();
    };
    finishTransition = finish; busy = true; database.inert = true;
    if (motion.matches || document.hidden) { applySwap(); finish(); return; }
    overlay.replaceChildren(); overlay.hidden = false;
    const width = screen.clientWidth, height = screen.clientHeight, count = width < 600 ? 5 : 7;
    const suits = ['♠', '♦', '♣', '♥'];
    for (let i = 0; i < count; i++) {
      const face = document.createElement('span'); face.className = 'frog-deal-card';
      face.textContent = suits[i % suits.length];
      const spread = i - (count - 1) / 2, offset = spread * width / count * .72;
      face.style.left = '50%'; face.style.top = '50%';
      overlay.append(face);
      animations.push(face.animate([
        { transform: `translate3d(-50%,${height * .65}px,-250px) rotateY(0deg) rotateZ(${-26 + spread * 3}deg)`, opacity: 0 },
        { transform: `translate3d(calc(-50% + ${offset}px),-50%,${80 - Math.abs(spread) * 20}px) rotateY(12deg) rotateZ(${spread * 9}deg)`, opacity: 1, offset: .37 },
        { transform: `translate3d(calc(-50% + ${offset}px),-50%,190px) rotateY(175deg) rotateZ(${spread * 9}deg)`, opacity: 1, offset: .66 },
        { transform: `translate3d(calc(-50% + ${offset * 2.5}px),${-height * .85}px,480px) rotateY(195deg) rotateZ(${spread * 20}deg)`, opacity: 0 }
      ], { duration: 1120, delay: Math.abs(spread) * 22, easing: 'cubic-bezier(.3,.02,.2,1)', fill: 'both' }));
    }
    animations.push(overlay.animate([
      { backgroundColor: '#08060600' }, { backgroundColor: '#080606', offset: .27 },
      { backgroundColor: '#080606', offset: .62 }, { backgroundColor: '#08060600' }
    ], { duration: 1250, fill: 'both' }));
    timers.push(setTimeout(applySwap, 470), setTimeout(finish, 1450));
    Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  }
  function open() {
    if (opened || busy || window.FrogCoin?.active || window.HyperboreaTransitions?.busy || window.WahArchive?.busy || window.WahArchive?.isOpen || window.FearArchive?.isOpen || !database.classList.contains('active') || section.hidden || roster.hidden) return;
    window.WahArchive?.reset(); window.FearArchive?.reset(); window.WahAudio?.exit();
    const enter=()=>reveal();
    if(!window.FrogCoin?.offer(enter,()=>$('back').click()))enter();
  }
  function reveal() {
    deal(() => {
      opened = true; section.hidden = true; roster.hidden = true; dossier.hidden = false; theme(true);
      window.FrogAudio?.enter();
      $('dbPath').textContent = 'HYPERBOREA / PLAYERS / FROG'; database.scrollTop = 0;
    }, () => { if (opened) title.focus({ preventScroll: true }); });
  }
  function close() {
    if (!opened || busy) return;
    window.FrogAudio?.exit();
    deal(() => deactivate(true), () => { if (!opened && database.classList.contains('active')) card.focus({ preventScroll: true }); });
  }
  function exitTo(swap, done) {
    if (!opened || busy) return false;
    window.FrogAudio?.exit();
    deal(() => { deactivate(false); swap(); }, done); return true;
  }
  function reset() {
    window.FrogCoin?.cancel();
    if (swapping) { deactivate(false); return; }
    const restore = opened || busy;
    finishTransition?.();
    deactivate(restore);
  }
  card.addEventListener('click', open); $('frogReturn')?.addEventListener('click', close);
  const art = dossier.querySelector('.frog-art');
  art?.addEventListener('pointermove', event => {
    if (!opened || busy || motion.matches || event.pointerType === 'touch') return;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      const rect = art.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
      const y = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5));
      dossier.style.setProperty('--frog-rx', `${(-y * 12).toFixed(2)}deg`);
      dossier.style.setProperty('--frog-ry', `${(x * 15).toFixed(2)}deg`);
    });
  }, { passive: true });
  art?.addEventListener('pointerleave', clearTilt, { passive: true });
  $('frogRoll')?.addEventListener('click', () => {
    if (!opened || busy || rolling) return;
    stopRoll(); rolling = true; const button = $('frogRoll');
    button.disabled = true; button.setAttribute('aria-busy', 'true'); dossier.classList.add('is-rolling');
    const symbols = ['♠', '♦', '♣', '♥'], reels = Array.from(dossier.querySelectorAll('.frog-reel-symbol'));
    const values = new Uint32Array(reels.length);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(values); else values.forEach((_, i) => values[i] = Math.floor(Math.random() * 4));
    const settle = () => {
      reels.forEach((reel, i) => { reel.textContent = symbols[values[i] % symbols.length]; });
      stopRoll(); $('frogRollStatus').textContent = reels.map(reel => reel.textContent).join(' · ');
    };
    if (motion.matches) settle(); else rollTimer = setTimeout(settle, 1250);
  });
  dossier.querySelectorAll('[data-frog-scroll]').forEach(button => button.addEventListener('click', () => {
    const target = $(button.dataset.frogScroll); if (!target) return;
    target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'start' });
  }));
  window.addEventListener('resize', () => { finishTransition?.(); clearTilt(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { finishTransition?.(); stopRoll(); clearTilt(); } });
  window.addEventListener('pagehide', reset);
  motion.addEventListener('change', () => { finishTransition?.(); stopRoll(); clearTilt(); });
  new MutationObserver(() => {
    if (opened && !database.classList.contains('active')) reset();
  }).observe(database, { attributes: true, attributeFilter: ['class'] });

  const axes = STAT_AXES;
  const inputs = axes.map(axis => $('frogStat' + axis));
  const position = $('frogPosition'), description = $('frogDescription'), weapon = $('frogWeapon');
  const profileKey = 'hyperborea_frog_profile_v1';
  const rating = parseRating, updateRadar = createProfileRadar('frog');
  function draw() {
    const ratings = inputs.map(input => rating(input.value));
    updateRadar(ratings);
    $('frogDescriptionCount').textContent = description.value.length + ' / 12000';
    $('frogWeaponCount').textContent = weapon.value.length + ' / 6000';
    return ratings;
  }
  function save() {
    const profile = { position: position.value, ratings: draw(), description: description.value, weapon: weapon.value };
    try { localStorage.setItem(profileKey, JSON.stringify(profile)); $('frogSaveState').textContent = 'Сохранено на этом устройстве'; }
    catch { $('frogSaveState').textContent = 'Изменения доступны до закрытия страницы'; }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.position === 'string') position.value = saved.position.slice(0, 40);
      if (typeof saved.description === 'string') description.value = saved.description.slice(0, 12000);
      if (typeof saved.weapon === 'string') weapon.value = saved.weapon.slice(0, 6000);
      if (Array.isArray(saved.ratings)) inputs.forEach((input, i) => { input.value = rating(saved.ratings[i]) ?? ''; });
    }
  } catch {}
  inputs.forEach(input => input.addEventListener('input', () => { input.value = rating(input.value) ?? ''; save(); }));
  for (const input of [position, description, weapon]) input.addEventListener('input', save);
  draw();
  window.FrogArchive = { open, close, reset, exitTo, get isOpen() { return opened; }, get busy() { return busy||!!window.FrogCoin?.active; } };
})();
