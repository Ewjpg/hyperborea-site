// The guest's own card in HYPERBOREA OS (menu row 05 ПРОФИЛЬ, or the `profile` command): a nick, an avatar picked
// from a file on their computer or phone and framed by hand (drag to move, wheel / slider / pinch to zoom), a line
// about themselves, a favourite player, the console colour and the avatar's look.
// The card is kept in this device's localStorage: the avatar at 512×512, plus the picked picture (up to 1280 px) so
// its framing can be changed later. Other members see the nick, the line, the favourite player and a 128×128 copy of
// the avatar (07 УЧАСТНИКИ, hyper-net.js).
// Also here: HyperWindow, the small BIOS-style dialog box that the profile, the polls and the member list share.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const $ = (s, el = document) => el.querySelector(s);
  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

  // ── HyperWindow: a dialog box over the terminal ──────────────────────────
  const windows = new Set();
  const anyOpen = () => [...windows].some(w => !w.el.hidden);
  function makeWindow(cls, html) {
    const el = document.createElement('section');
    el.className = 'hwin ' + cls; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = html; screen.append(el);
    const bar = $('.hwin-bar', el);
    if (bar) { bar.id = bar.id || cls + '-title'; el.setAttribute('aria-labelledby', bar.id); }
    let opener = null;
    const focusables = () => [...el.querySelectorAll('button,input,select,textarea,canvas[tabindex],[tabindex="0"]')].filter(x => !x.disabled && !x.closest('[hidden]') && x.type !== 'file');
    const win = {
      el, onClose: null,
      get isOpen() { return !el.hidden; },
      open(from, first) {
        if (el.hidden) opener = from || document.activeElement;
        el.hidden = false;
        (first || focusables()[0])?.focus({preventScroll: true});
      },
      close() {
        if (el.hidden) return;
        el.hidden = true; win.onClose?.();
        const back = opener; opener = null;
        if (back && document.contains(back) && !anyOpen()) back.focus?.({preventScroll: true});
      }
    };
    el.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!win.onEscape?.()) win.close(); return; }
      if (event.key === 'Tab') { // Keep Tab inside the box.
        const all = focusables(); if (!all.length) return;
        const at = all.indexOf(document.activeElement);
        if (event.shiftKey && at <= 0) { event.preventDefault(); all.at(-1).focus(); }
        else if (!event.shiftKey && at === all.length - 1) { event.preventDefault(); all[0].focus(); }
      }
      event.stopPropagation(); // Keys typed here are not the menu's or the console's.
    });
    el.addEventListener('pointerdown', event => { if (event.target === el) win.close(); }); // the dim backdrop
    windows.add(win);
    return win;
  }
  window.HyperWindow = {make: makeWindow, get anyOpen() { return anyOpen(); }, closeAll() { windows.forEach(w => w.close()); }};

  // ── The card ──────────────────────────────────────────────────────────────
  const KEY = 'hyperborea_guest_card_v1', SRC_KEY = 'hyperborea_guest_avatar_src_v1';
  const AVATAR = 512, SOURCE_MAX = 1280, SHARED = 128;
  const COLORS = {green: ['Зелёный', '#7fe0b0'], amber: ['Янтарный', '#ffbf5a'], cyan: ['Голубой', '#7fd8ff'], pink: ['Розовый', '#ff9fd6'], white: ['Белый', '#f2f2f2']};
  const LOOKS = {plain: 'Обычный', pixel: 'Пиксели', crt: 'Зелёный монитор'};
  const NICK = /^[\p{L}\p{N}_.-]{2,16}$/u;
  const IMAGE = /^data:image\/(webp|jpeg|png);base64,/;
  const num = (v, d) => Number.isFinite(v) ? v : d;
  const cleanCrop = c => c && [c.x, c.y, c.z].every(Number.isFinite) ? {x: Math.min(1, Math.max(0, c.x)), y: Math.min(1, Math.max(0, c.y)), z: Math.min(6, Math.max(1, c.z))} : null;
  const clean = (c = {}) => ({
    nick: typeof c.nick === 'string' && NICK.test(c.nick) ? c.nick : '',
    about: typeof c.about === 'string' ? c.about.trim().slice(0, 80) : '',
    fav: typeof c.fav === 'string' ? c.fav.slice(0, 40) : '',
    color: COLORS[c.color] ? c.color : 'green',
    look: LOOKS[c.look] ? c.look : 'plain',
    avatar: typeof c.avatar === 'string' && IMAGE.test(c.avatar) && c.avatar.length < 800000 ? c.avatar : '',
    crop: cleanCrop(c.crop),
    since: num(c.since, Date.now()), visits: num(c.visits, 0), votes: num(c.votes, 0)
  });
  let card = clean();
  try { card = clean(JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch {}
  let source = ''; // the picked picture, for framing it again later
  try { const s = localStorage.getItem(SRC_KEY) || ''; if (IMAGE.test(s)) source = s; } catch {}
  const listeners = new Set();
  function store(next) {
    const merged = clean({...card, ...next});
    try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { return false; }
    card = merged; paint();
    listeners.forEach(fn => { try { fn(card); } catch (error) { console.warn('Guest card:', error); } });
    return true;
  }
  function storeSource(src) { // false when the browser has no room for it
    try { if (src) localStorage.setItem(SRC_KEY, src); else localStorage.removeItem(SRC_KEY); source = src; return true; }
    catch { try { localStorage.removeItem(SRC_KEY); } catch {} source = ''; return false; }
  }
  const name = () => card.nick || 'guest';
  function paint() {
    document.documentElement.style.setProperty('--hos-accent', COLORS[card.color][1]);
    for (const el of document.querySelectorAll('[data-guest-avatar]')) fillAvatar(el);
  }

  // Pictures: load, encode, resize.
  const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Не получилось открыть картинку.')); img.src = src; });
  function encode(canvas, quality) {
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
  }
  function scaled(img, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, size, size);
    return c;
  }

  // An avatar box: the picture in the chosen look, or the nick's first letter.
  const tiny = new Map();
  function pixelated(src) { // The picture squeezed to 32×32; CSS blows it back up with hard pixel edges.
    if (tiny.has(src)) return Promise.resolve(tiny.get(src));
    return loadImage(src).then(img => { const url = scaled(img, 32).toDataURL('image/png'); tiny.set(src, url); return url; }, () => src);
  }
  function fillAvatar(el, c = card) {
    el.classList.add('hg-ava'); el.dataset.look = c.look || 'plain';
    if (!c.avatar) { el.replaceChildren(); el.dataset.letter = (c.nick || '?').slice(0, 1).toUpperCase(); el.classList.add('is-empty'); return; }
    el.classList.remove('is-empty');
    let img = el.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; el.replaceChildren(img); }
    if (c.look === 'pixel') { pixelated(c.avatar).then(url => { if (el.dataset.look === 'pixel' && img.isConnected) img.src = url; }); }
    else if (img.getAttribute('src') !== c.avatar) img.src = c.avatar;
  }

  // What other members see: the card's public part, and a 128×128 copy of the avatar (kept under ~40 KB of text).
  let shared = {from: '', url: ''};
  async function publicAvatar() {
    if (!card.avatar) return '';
    if (shared.from === card.avatar) return shared.url;
    try {
      const small = scaled(await loadImage(card.avatar), SHARED);
      let url = '';
      for (const q of [.86, .72, .58, .45]) { url = encode(small, q); if (url.length <= 40000) break; }
      shared = {from: card.avatar, url: url.length <= 40000 ? url : ''};
    } catch { shared = {from: card.avatar, url: ''}; }
    return shared.url;
  }
  function publicCard() {
    const out = {nick: name(), look: card.look};
    if (card.about) out.about = card.about;
    if (card.fav) out.fav = card.fav;
    return out;
  }

  // A picture from the guest's computer or phone → at most 1280 px on its longer side, ready for framing.
  async function readSource(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Это не картинка.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ.');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url), k = Math.min(1, SOURCE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
      return encode(c, .88);
    } finally { URL.revokeObjectURL(url); }
  }

  // ── The profile window ────────────────────────────────────────────────────
  const options = (map, pick) => Object.entries(map).map(([k, v]) => `<option value="${k}">${escape(pick(v))}</option>`).join('');
  const HINT = 'Картинка с компьютера или из галереи телефона. Её копию 128×128 увидят все участники.';
  const CROP_HINT = 'Двигай картинку мышкой или пальцем. Масштаб — колёсико, ползунок или двумя пальцами. Стрелки тоже работают.';
  const win = makeWindow('hguest', `<form class="hwin-box" novalidate>
      <h2 class="hwin-bar">Профиль гостя</h2>
      <div class="hwin-body">
        <div class="hg-top">
          <div class="hg-ava-col">
            <span class="hg-big" data-preview></span>
            <div class="hg-crop" hidden>
              <canvas width="560" height="560" tabindex="0" aria-label="Положение аватарки"></canvas>
              <label class="hg-zoom"><span>Масштаб</span><input type="range" min="1" max="6" step="0.01" value="1" aria-label="Масштаб"></label>
            </div>
          </div>
          <div class="hg-side">
            <p class="hg-name" data-name></p>
            <p class="hwin-dim" data-about-view></p>
            <div class="hg-buttons" data-normal><button type="button" class="hwin-btn" data-pick>[ Выбрать картинку… ]</button><button type="button" class="hwin-btn" data-frame>[ Положение ]</button><button type="button" class="hwin-btn" data-drop>[ Убрать ]</button></div>
            <div class="hg-buttons" data-cropping hidden><button type="button" class="hwin-btn" data-crop-ok>[ Готово ]</button><button type="button" class="hwin-btn" data-crop-reset>[ По центру ]</button><button type="button" class="hwin-btn" data-crop-cancel>[ Отмена ]</button></div>
            <input type="file" accept="image/*" hidden>
            <p class="hwin-dim" data-ava-hint></p>
          </div>
        </div>
        <label class="hwin-row"><span>Ник</span><input name="nick" maxlength="16" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="guest"><small class="hwin-hint">2–16 знаков: буквы, цифры, _ . -  Ник, аватар и «о себе» видят все участники.</small></label>
        <label class="hwin-row"><span>О себе</span><input name="about" maxlength="80" autocomplete="off" placeholder="пара слов"></label>
        <label class="hwin-row"><span>Любимый игрок</span><select name="fav"></select></label>
        <label class="hwin-row"><span>Цвет консоли</span><select name="color">${options(COLORS, v => v[0])}</select></label>
        <label class="hwin-row"><span>Вид аватара</span><select name="look">${options(LOOKS, v => v)}</select></label>
        <dl class="hg-stats"></dl>
        <p class="hwin-msg" role="status"></p>
      </div>
      <footer class="hwin-keys"><button type="submit">[ Сохранить ]</button><button type="button" data-close>[ Отмена ]</button><button type="button" data-reset>[ Сбросить ]</button></footer>
    </form>`);
  const form = $('form', win.el), file = $('input[type=file]', win.el), msg = $('.hwin-msg', win.el), preview = $('[data-preview]', win.el);
  const canvas = $('.hg-crop canvas', win.el), zoom = $('.hg-crop input', win.el);
  let draftAvatar = '', draftSrc = '', draftCrop = null, resetArmed = false;
  const draft = () => clean({...card, nick: NICK.test(form.nick.value.trim()) ? form.nick.value.trim() : card.nick, about: form.about.value, fav: form.fav.value, color: form.color.value, look: form.look.value, avatar: draftAvatar});
  function players() { // Names from the dossier cards on the page.
    return [...new Set([...document.querySelectorAll('button[aria-label^="Открыть досье "]')].map(b => b.getAttribute('aria-label').slice(14).trim()).filter(Boolean))];
  }
  function chapters() {
    let done = 0; try { done = (JSON.parse(localStorage.getItem('hyperborea_lore_v1') || '{}').done || []).length; } catch {}
    return done + ' из ' + (window.HYPERBOREA_LORE?.chapters?.length || 0);
  }
  function renderPreview() {
    const d = draft();
    fillAvatar(preview, d);
    $('[data-name]', win.el).textContent = (form.nick.value.trim() || 'guest') + '@hyperborea';
    $('[data-name]', win.el).style.color = COLORS[d.color][1];
    $('[data-about-view]', win.el).textContent = d.about || 'О себе пока ничего.';
    $('[data-drop]', win.el).disabled = !draftAvatar;
    $('[data-frame]', win.el).disabled = !draftAvatar;
  }
  function renderStats() {
    let id = '—'; try { id = localStorage.getItem('hyperborea_visitor_id_v1') || '—'; } catch {}
    const rows = [['Впервые', new Date(card.since).toLocaleDateString('ru-RU')], ['Запусков', card.visits], ['Глав пройдено', chapters()], ['Голосов', card.votes], ['Терминал', id]];
    $('.hg-stats', win.el).innerHTML = rows.map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
  }

  // Framing: the square is cut from the picture at (x, y) — its centre, as a share of the width and height — and
  // z — how much smaller than the picture's short side it is (1 = as big as possible).
  const crop = {img: null, src: '', x: .5, y: .5, z: 1, active: false};
  const cropSide = () => Math.min(crop.img.naturalWidth, crop.img.naturalHeight) / crop.z;
  function clampCrop() {
    const w = crop.img.naturalWidth, h = crop.img.naturalHeight, s = cropSide();
    crop.x = Math.min(1 - s / 2 / w, Math.max(s / 2 / w, crop.x));
    crop.y = Math.min(1 - s / 2 / h, Math.max(s / 2 / h, crop.y));
  }
  function drawCrop(target, size) {
    const g = target.getContext('2d'), s = cropSide();
    g.imageSmoothingQuality = 'high'; g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
    g.drawImage(crop.img, crop.x * crop.img.naturalWidth - s / 2, crop.y * crop.img.naturalHeight - s / 2, s, s, 0, 0, size, size);
  }
  function paintCrop() {
    const size = canvas.width, g = canvas.getContext('2d');
    drawCrop(canvas, size);
    g.strokeStyle = 'rgba(200,210,255,.35)'; g.lineWidth = 2; g.beginPath(); // thirds, like a camera
    for (const t of [1 / 3, 2 / 3]) { g.moveTo(size * t, 0); g.lineTo(size * t, size); g.moveTo(0, size * t); g.lineTo(size, size * t); }
    g.stroke();
    zoom.value = String(crop.z);
  }
  function setZoom(z) { crop.z = Math.min(6, Math.max(1, z)); clampCrop(); paintCrop(); }
  function showCropping(on) {
    crop.active = on;
    $('.hg-crop', win.el).hidden = !on; preview.hidden = on;
    $('[data-normal]', win.el).hidden = on; $('[data-cropping]', win.el).hidden = !on;
    $('[data-ava-hint]', win.el).textContent = on ? CROP_HINT : HINT;
  }
  async function startCrop(src, at) {
    try { crop.img = await loadImage(src); } catch (error) { say(error.message, 'err'); return; }
    crop.src = src; crop.x = at?.x ?? .5; crop.y = at?.y ?? .5; crop.z = at?.z ?? 1;
    clampCrop(); showCropping(true); paintCrop(); canvas.focus({preventScroll: true});
  }
  function finishCrop(apply) {
    if (!crop.active) return;
    if (apply && crop.img) {
      const out = document.createElement('canvas'); out.width = out.height = AVATAR; drawCrop(out, AVATAR);
      draftAvatar = encode(out, .9); draftSrc = crop.src; draftCrop = {x: crop.x, y: crop.y, z: crop.z};
      say('Положение выбрано. Нажми «Сохранить».', 'ok');
    }
    showCropping(false); renderPreview();
  }
  const pointers = new Map(); let pinch = 0;
  canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, {x: event.clientX, y: event.clientY}); pinch = 0; });
  canvas.addEventListener('pointermove', event => {
    const last = pointers.get(event.pointerId); if (!last || !crop.img) return;
    const now = {x: event.clientX, y: event.clientY}; pointers.set(event.pointerId, now);
    if (pointers.size === 2) { // two fingers: zoom by how far apart they are
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) setZoom(crop.z * d / pinch); pinch = d; return;
    }
    const k = cropSide() / canvas.clientWidth;
    crop.x -= (now.x - last.x) * k / crop.img.naturalWidth; crop.y -= (now.y - last.y) * k / crop.img.naturalHeight;
    clampCrop(); paintCrop();
  });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, event => { pointers.delete(event.pointerId); pinch = 0; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); setZoom(crop.z * Math.exp(-event.deltaY * .0015)); }, {passive: false});
  canvas.addEventListener('keydown', event => {
    if (!crop.img) return;
    const step = .04 * cropSide(), moves = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
    if (moves[event.key]) { event.preventDefault(); crop.x += moves[event.key][0] / crop.img.naturalWidth; crop.y += moves[event.key][1] / crop.img.naturalHeight; clampCrop(); paintCrop(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(crop.z * 1.1); }
    else if (event.key === '-') { event.preventDefault(); setZoom(crop.z / 1.1); }
    else if (event.key === 'Enter') { event.preventDefault(); finishCrop(true); $('[data-frame]', win.el).focus(); }
  });
  zoom.addEventListener('input', () => setZoom(Number(zoom.value)));
  win.onEscape = () => { if (!crop.active) return false; finishCrop(false); $('[data-pick]', win.el).focus(); return true; };

  function open(from) {
    form.nick.value = card.nick; form.about.value = card.about; form.color.value = card.color; form.look.value = card.look;
    const list = players(); if (card.fav && !list.includes(card.fav)) list.unshift(card.fav);
    form.fav.innerHTML = '<option value="">— не выбран —</option>' + list.map(n => `<option>${escape(n)}</option>`).join('');
    form.fav.value = card.fav;
    draftAvatar = card.avatar; draftSrc = card.avatar ? source : ''; draftCrop = card.crop; resetArmed = false;
    msg.textContent = ''; msg.className = 'hwin-msg';
    showCropping(false); renderPreview(); renderStats();
    win.open(from, form.nick);
  }
  const say = (text, kind = '') => { msg.textContent = text; msg.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  form.addEventListener('input', event => { if (event.target !== file && event.target !== zoom) renderPreview(); if (event.target === form.nick) say(''); });
  $('[data-pick]', win.el).addEventListener('click', () => file.click());
  $('[data-frame]', win.el).addEventListener('click', () => {
    // The picked picture when we still have it; otherwise the avatar itself (already square).
    if (draftSrc) startCrop(draftSrc, draftCrop); else if (draftAvatar) startCrop(draftAvatar, null);
  });
  $('[data-drop]', win.el).addEventListener('click', () => { draftAvatar = ''; draftSrc = ''; draftCrop = null; renderPreview(); say('Аватар будет убран после сохранения.'); });
  $('[data-crop-ok]', win.el).addEventListener('click', () => { finishCrop(true); $('[data-frame]', win.el).focus(); });
  $('[data-crop-cancel]', win.el).addEventListener('click', () => { finishCrop(false); $('[data-pick]', win.el).focus(); });
  $('[data-crop-reset]', win.el).addEventListener('click', () => { if (!crop.img) return; crop.x = crop.y = .5; crop.z = 1; clampCrop(); paintCrop(); canvas.focus(); });
  file.addEventListener('change', async () => {
    const picked = file.files?.[0]; file.value = '';
    if (!picked) return;
    say('Открываю картинку…');
    try { const src = await readSource(picked); say('Выбери положение и нажми «Готово».'); await startCrop(src, null); }
    catch (error) { say(error.message || 'Не получилось открыть картинку.', 'err'); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (crop.active) finishCrop(true);
    const nick = form.nick.value.trim();
    if (nick && !NICK.test(nick)) { say('Ник: от 2 до 16 знаков — буквы, цифры, _ . -', 'err'); form.nick.focus(); return; }
    const ok = store({nick, about: form.about.value, fav: form.fav.value, color: form.color.value, look: form.look.value, avatar: draftAvatar, crop: draftAvatar ? draftCrop : null});
    if (!ok) { say('Не удалось сохранить: в памяти браузера нет места. Попробуй другую картинку.', 'err'); return; }
    const kept = storeSource(draftAvatar ? draftSrc : '');
    say(kept || !draftSrc ? 'Сохранено.' : 'Сохранено. Исходная картинка не поместилась в память — положение потом можно менять только по уже обрезанной.', 'ok');
    renderStats();
    setTimeout(() => win.close(), kept || !draftSrc ? 450 : 2600);
  });
  $('[data-close]', win.el).addEventListener('click', () => win.close());
  $('[data-reset]', win.el).addEventListener('click', () => {
    if (!resetArmed) { resetArmed = true; say('Нажми «Сбросить» ещё раз: ник, аватар и настройки сотрутся.', 'err'); return; }
    resetArmed = false; store({nick: '', about: '', fav: '', color: 'green', look: 'plain', avatar: '', crop: null}); storeSource('');
    open(); say('Профиль сброшен.', 'ok');
  });

  window.HyperGuest = {
    get card() { return card; }, get nick() { return card.nick; }, name, COLORS, LOOKS,
    open, close: () => win.close(), get isOpen() { return win.isOpen; },
    save: store, fillAvatar, publicCard, publicAvatar, players, addVote() { store({votes: card.votes + 1}); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  store({visits: card.visits + 1}); // one more launch
})();
