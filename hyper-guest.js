// The guest's own card in HYPERBOREA OS (menu row 05 ПРОФИЛЬ, or the `profile` command): a nick, an avatar picked
// from a file on their computer or phone, a line about themselves, a favourite player, the console colour and the
// avatar's look. The card is kept in this device's localStorage; while they are online, everyone else sees the nick,
// a 48×48 copy of the avatar, the line about them and the favourite player (07 В СЕТИ, hyper-net.js).
// Also here: HyperWindow, the small BIOS-style dialog box that the profile, the polls and ADMIN's broadcasts share.
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
    const focusables = () => [...el.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(x => !x.disabled && !x.closest('[hidden]') && x.type !== 'file');
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
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); win.close(); return; }
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
  const KEY = 'hyperborea_guest_card_v1';
  const COLORS = {green: ['Зелёный', '#7fe0b0'], amber: ['Янтарный', '#ffbf5a'], cyan: ['Голубой', '#7fd8ff'], pink: ['Розовый', '#ff9fd6'], white: ['Белый', '#f2f2f2']};
  const LOOKS = {plain: 'Обычный', pixel: 'Пиксели', crt: 'Зелёный монитор'};
  const NICK = /^[\p{L}\p{N}_.-]{2,16}$/u;
  const num = (v, d) => Number.isFinite(v) ? v : d;
  const clean = (c = {}) => ({
    nick: typeof c.nick === 'string' && NICK.test(c.nick) ? c.nick : '',
    about: typeof c.about === 'string' ? c.about.trim().slice(0, 80) : '',
    fav: typeof c.fav === 'string' ? c.fav.slice(0, 40) : '',
    color: COLORS[c.color] ? c.color : 'green',
    look: LOOKS[c.look] ? c.look : 'plain',
    avatar: typeof c.avatar === 'string' && /^data:image\/(webp|jpeg|png);base64,/.test(c.avatar) && c.avatar.length < 300000 ? c.avatar : '',
    since: num(c.since, Date.now()), visits: num(c.visits, 0), votes: num(c.votes, 0)
  });
  let card = clean();
  try { card = clean(JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch {}
  const listeners = new Set();
  function store(next) {
    const merged = clean({...card, ...next});
    try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { return false; }
    card = merged; paint();
    listeners.forEach(fn => { try { fn(card); } catch (error) { console.warn('Guest card:', error); } });
    return true;
  }
  const name = () => card.nick || 'guest';
  function paint() {
    document.documentElement.style.setProperty('--hos-accent', COLORS[card.color][1]);
    for (const el of document.querySelectorAll('[data-guest-avatar]')) fillAvatar(el);
  }

  // An avatar box: the picture in the chosen look, or the nick's first letter.
  const tiny = new Map();
  function pixelated(src) { // The picture squeezed to 24×24; CSS blows it back up with hard pixel edges.
    if (tiny.has(src)) return Promise.resolve(tiny.get(src));
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 24; c.getContext('2d').drawImage(img, 0, 0, 24, 24); const url = c.toDataURL('image/png'); tiny.set(src, url); resolve(url); };
      img.onerror = () => resolve(src); img.src = src;
    });
  }
  function fillAvatar(el, c = card) {
    el.classList.add('hg-ava'); el.dataset.look = c.look;
    if (!c.avatar) { el.replaceChildren(); el.dataset.letter = (c.nick || '?').slice(0, 1).toUpperCase(); el.classList.add('is-empty'); return; }
    el.classList.remove('is-empty');
    let img = el.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; el.replaceChildren(img); }
    if (c.look === 'pixel') { const want = c.avatar; pixelated(want).then(url => { if (el.dataset.look === 'pixel' && img.isConnected) img.src = url; }); }
    else img.src = c.avatar;
  }

  // What others see while this guest is online: the nick, a 48×48 avatar, the line about them, the favourite player.
  const minis = new Map();
  function miniAvatar(src) {
    if (!src) return Promise.resolve('');
    if (minis.has(src)) return Promise.resolve(minis.get(src));
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 48; c.getContext('2d').drawImage(img, 0, 0, 48, 48);
        let d = c.toDataURL('image/webp', .8); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', .8);
        minis.set(src, d); resolve(d);
      };
      img.onerror = () => resolve(''); img.src = src;
    });
  }
  async function publicCard() {
    const out = {nick: name(), look: card.look};
    const ava = await miniAvatar(card.avatar); if (ava) out.ava = ava;
    if (card.about) out.about = card.about;
    if (card.fav) out.fav = card.fav;
    return out;
  }

  // A picture from the guest's computer → a 160×160 square, cut from its middle, small enough for localStorage.
  function readAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Это не картинка.')); return; }
      if (file.size > 20 * 1024 * 1024) { reject(new Error('Файл больше 20 МБ.')); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d'), w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
        g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.imageSmoothingQuality = 'high';
        g.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, S, S);
        let data = c.toDataURL('image/webp', .86);
        if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', .86);
        resolve(data);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не получилось открыть картинку.')); };
      img.src = url;
    });
  }

  // ── The profile window ────────────────────────────────────────────────────
  const options = (map, pick) => Object.entries(map).map(([k, v]) => `<option value="${k}">${escape(pick(v))}</option>`).join('');
  const win = makeWindow('hguest', `<form class="hwin-box" novalidate>
      <h2 class="hwin-bar">Профиль гостя</h2>
      <div class="hwin-body">
        <div class="hg-top">
          <span class="hg-big" data-preview></span>
          <div class="hg-side">
            <p class="hg-name" data-name></p>
            <p class="hwin-dim" data-about-view></p>
            <div class="hg-buttons"><button type="button" class="hwin-btn" data-pick>[ Выбрать картинку… ]</button><button type="button" class="hwin-btn" data-drop>[ Убрать ]</button></div>
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" hidden>
            <p class="hwin-dim">Картинка с компьютера или из галереи телефона. Её маленькую копию увидят все в сети.</p>
          </div>
        </div>
        <label class="hwin-row"><span>Ник</span><input name="nick" maxlength="16" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="guest"><small class="hwin-hint">2–16 знаков: буквы, цифры, _ . -  Ник, аватар и «о себе» видят все в сети.</small></label>
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
  let draftAvatar = '', resetArmed = false;
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
  }
  function renderStats() {
    let id = '—'; try { id = localStorage.getItem('hyperborea_visitor_id_v1') || '—'; } catch {}
    const rows = [['Впервые', new Date(card.since).toLocaleDateString('ru-RU')], ['Запусков', card.visits], ['Глав пройдено', chapters()], ['Голосов', card.votes], ['Терминал', id]];
    $('.hg-stats', win.el).innerHTML = rows.map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
  }
  function open(from) {
    form.nick.value = card.nick; form.about.value = card.about; form.color.value = card.color; form.look.value = card.look;
    const list = players(); if (card.fav && !list.includes(card.fav)) list.unshift(card.fav);
    form.fav.innerHTML = '<option value="">— не выбран —</option>' + list.map(n => `<option>${escape(n)}</option>`).join('');
    form.fav.value = card.fav;
    draftAvatar = card.avatar; resetArmed = false; msg.textContent = ''; msg.className = 'hwin-msg';
    renderPreview(); renderStats();
    win.open(from, form.nick);
  }
  const say = (text, kind = '') => { msg.textContent = text; msg.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  form.addEventListener('input', event => { if (event.target !== file) renderPreview(); if (event.target === form.nick) say(''); });
  $('[data-pick]', win.el).addEventListener('click', () => file.click());
  $('[data-drop]', win.el).addEventListener('click', () => { draftAvatar = ''; renderPreview(); say('Аватар будет убран после сохранения.'); });
  file.addEventListener('change', async () => {
    const picked = file.files?.[0]; file.value = '';
    if (!picked) return;
    say('Обработка картинки…');
    try { draftAvatar = await readAvatar(picked); renderPreview(); say('Картинка готова. Нажми «Сохранить».', 'ok'); }
    catch (error) { say(error.message || 'Не получилось открыть картинку.', 'err'); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const nick = form.nick.value.trim();
    if (nick && !NICK.test(nick)) { say('Ник: от 2 до 16 знаков — буквы, цифры, _ . -', 'err'); form.nick.focus(); return; }
    const ok = store({nick, about: form.about.value, fav: form.fav.value, color: form.color.value, look: form.look.value, avatar: draftAvatar});
    if (!ok) { say('Не удалось сохранить: в памяти браузера нет места. Попробуй картинку поменьше.', 'err'); return; }
    say('Сохранено.', 'ok'); renderStats();
    setTimeout(() => win.close(), 450);
  });
  $('[data-close]', win.el).addEventListener('click', () => win.close());
  $('[data-reset]', win.el).addEventListener('click', () => {
    if (!resetArmed) { resetArmed = true; say('Нажми «Сбросить» ещё раз: ник, аватар и настройки сотрутся.', 'err'); return; }
    resetArmed = false; store({nick: '', about: '', fav: '', color: 'green', look: 'plain', avatar: ''});
    open(); say('Профиль сброшен.', 'ok');
  });

  window.HyperGuest = {
    get card() { return card; }, get nick() { return card.nick; }, name, COLORS, LOOKS,
    open, close: () => win.close(), get isOpen() { return win.isOpen; },
    save: store, fillAvatar, publicCard, players, addVote() { store({votes: card.votes + 1}); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  store({visits: card.visits + 1}); // one more launch
})();
