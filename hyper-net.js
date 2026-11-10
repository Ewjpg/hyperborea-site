// HYPERBOREA NET: what every open terminal shares live.
//  · the online count (and, for ADMIN, who is on);
//  · «эфир» — ADMIN's message that pops up on every screen at once;
//  · events ADMIN launches for everyone: static, CONNECTION LOST, ACCESS BLOCKED, a crash, the FEAR darkness;
//  · polls: ADMIN asks, guests vote, everyone watches the bars move;
//  · everyone sees everyone online — avatar, nick, a line about them (07 В СЕТИ);
//  · idea cards: guests fill in a template and send it; only ADMIN can read them (08 ИДЕЯ / ИДЕИ).
// It runs on a small Firebase Realtime Database (settings in hyper-net-config.js, rules in
// firebase/database.rules.json). Guests sign in anonymously; ADMIN signs in with the password kept only in Firebase,
// and only that account may broadcast, launch events or open polls — the database itself refuses anyone else.
// Without settings the site works on its own and these features say the server is not connected.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const cfg = window.HYPER_NET || {};
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const $ = (s, el = document) => el.querySelector(s);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const EVENTS = {
    glitch: 'Помехи на экране',
    reconnect: '«CONNECTION LOST» на 20 секунд',
    locked: '«ACCESS BLOCKED» на 60 секунд',
    crash: 'Падение системы со звуком',
    fear: 'Затянуть во тьму FEAR'
  };
  const STATUS = {off: 'сервер не подключён', connecting: 'подключение…', online: 'в сети', offline: 'нет связи', error: 'ошибка сервера'};
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');

  // ── State and listeners ───────────────────────────────────────────────────
  const subs = {};
  const on = (type, fn) => { (subs[type] ||= new Set()).add(fn); return () => subs[type].delete(fn); };
  const emit = (type, data) => subs[type]?.forEach(fn => { try { fn(data); } catch (error) { console.warn('HyperNet ' + type + ':', error); } });
  const net = {status: cfg.firebase ? 'connecting' : 'off', online: [], poll: null, results: null, ideas: null};
  let backend = null, starting = null, pollKnown = false;
  const IDEA_KINDS = {
    player: ['Новый игрок', 'Имя: \nСтрана: \nКлуб: \nПозиция: \nСильная сторона: \nОсобый приём: \nИстория: '],
    lore: ['Глава или история', 'Кто участвует: \nГде: \nЧто происходит: \nЧем заканчивается: '],
    event: ['Событие на сайте', 'Что видят все на экране: \nСколько длится: \nКогда запускать: '],
    site: ['Функция сайта', 'Что добавить или поменять: \nГде на сайте: \nЗачем это нужно: '],
    other: ['Другое', '']
  };
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const person = (key, v, me) => ({uid: key, nick: str(v?.nick, 16) || '?', ava: /^data:image\/(webp|jpeg|png);base64,/.test(v?.ava || '') ? v.ava : '', look: str(v?.look, 8) || 'plain',
    about: str(v?.about, 80), fav: str(v?.fav, 40), at: v?.at || 0, me});
  const setStatus = s => { if (net.status !== s) { net.status = s; emit('status', s); } };
  const remembered = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  const SEEN = 'hyperborea_net_seen_v1', MINE = 'hyperborea_net_votes_v1';
  const seen = new Set(remembered(SEEN));
  const markSeen = id => { seen.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-40))); } catch {} };
  let mine = {}; try { mine = JSON.parse(localStorage.getItem(MINE) || '{}') || {}; } catch {}
  const now = () => backend?.now() ?? Date.now();
  const validPoll = p => p && typeof p.id === 'string' && typeof p.q === 'string' && Array.isArray(p.options) && p.options.length >= 2 ? p : null;

  // What the backend reports.
  const sink = {
    status: setStatus,
    online(list) { net.online = list; emit('online', list); },
    broadcast(b) { if (b?.id && typeof b.text === 'string' && !seen.has(b.id)) { if (now() - (b.at || 0) < 10 * 60 * 1000) whenFree(() => showBroadcast(b), Infinity); else markSeen(b.id); } },
    event(e) {
      if (!e?.id || seen.has(e.id)) return;
      markSeen(e.id);
      if (EVENTS[e.name] && now() - (e.at || 0) < 30000) whenFree(() => runEvent(e.name), 20000);
    },
    poll(p) {
      const prev = net.poll; net.poll = validPoll(p);
      if (net.poll?.id !== prev?.id) net.results = null;
      emit('poll', net.poll);
      // A poll opened while this terminal is on: tell everyone (not the one already there when it started).
      if (pollKnown && net.poll?.open && net.poll.id !== prev?.id) whenFree(() => announcePoll(net.poll), 5 * 60 * 1000);
      pollKnown = true;
    },
    ideas(list) {
      const before = net.ideas; net.ideas = list;
      emit('ideas', list);
      // New cards while ADMIN is on: a message for each batch (not for the pile already there when signing in).
      if (before && list) {
        const known = new Set(before.map(i => i.id)), fresh = list.filter(i => !known.has(i.id));
        if (fresh.length) whenFree(() => showMessage({title: 'НОВАЯ ИДЕЯ', text: fresh[0].title, meta: 'От ' + fresh[0].nick + (fresh.length > 1 ? ' · и ещё ' + (fresh.length - 1) : '') + ' · ' + kindName(fresh[0].kind), alt: {label: 'Открыть', fn: () => openInbox()}}), 10 * 60 * 1000);
      }
    },
    votes(r) {
      if (r.id !== net.poll?.id) return;
      net.results = r;
      if (Number.isInteger(r.mine)) { mine[r.id] = r.mine; try { localStorage.setItem(MINE, JSON.stringify(mine)); } catch {} }
      emit('votes', r);
    }
  };

  // ── Firebase ──────────────────────────────────────────────────────────────
  async function firebaseBackend(conf) {
    const [A, U, D] = await Promise.all(['app', 'auth', 'database'].map(n => import(SDK + 'firebase-' + n + '.js')));
    const app = A.getApps().find(a => a.name === 'hyperborea') || A.initializeApp(conf, 'hyperborea');
    let auth; try { auth = U.initializeAuth(app, {persistence: [U.indexedDBLocalPersistence, U.browserLocalPersistence]}); } catch { auth = U.getAuth(app); }
    const saved = await new Promise(resolve => { const stop = U.onAuthStateChanged(auth, user => { stop(); resolve(user); }); });
    const uid = (saved || (await U.signInAnonymously(auth)).user).uid; // the same anonymous id on every visit
    const db = D.getDatabase(app);
    let offset = 0, connected = false, profile = {nick: window.HyperGuest?.name() || 'guest'};
    const me = D.ref(db, 'online/' + uid);
    const warn = what => error => console.warn('HYPERBOREA NET ' + what + ':', error?.code || error);
    const join = () => D.set(me, {...profile, at: D.serverTimestamp()}).catch(warn('online'));
    window.HyperGuest?.publicCard().then(p => { profile = p; if (connected) join(); });
    D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
    D.onValue(D.ref(db, '.info/connected'), s => {
      connected = s.val() === true;
      sink.status(connected ? 'online' : 'offline');
      if (connected) D.onDisconnect(me).remove().then(join, warn('presence'));
    });
    D.onValue(D.ref(db, 'online'), s => {
      const list = []; s.forEach(c => { list.push(person(c.key, c.val(), c.key === uid)); });
      sink.online(list);
    }, warn('online list'));
    D.onValue(D.ref(db, 'broadcast'), s => sink.broadcast(s.val()), warn('broadcast'));
    D.onValue(D.ref(db, 'event'), s => sink.event(s.val()), warn('event'));
    let stopVotes = null;
    D.onValue(D.ref(db, 'poll'), s => {
      const poll = validPoll(s.val()); sink.poll(poll);
      stopVotes?.(); stopVotes = null;
      if (poll) stopVotes = D.onValue(D.ref(db, 'votes/' + poll.id), v => {
        const counts = poll.options.map(() => 0); let my = null;
        v.forEach(c => { const i = c.val(); if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i]++; if (c.key === uid) my = i; });
        sink.votes({id: poll.id, counts, total: counts.reduce((a, b) => a + b, 0), mine: my});
      }, warn('votes'));
    }, warn('poll'));

    // ADMIN: a second, separate sign-in that lives only in memory — gone after a reload or a logout.
    let adminAuth = null, adminDb = null, stopIdeas = null;
    const admin = () => { if (!adminDb || !adminAuth?.currentUser) throw new Error('not-admin'); return adminDb; };
    return {
      uid, now: () => Date.now() + offset,
      setProfile(p) { profile = p; if (connected) join(); },
      // An idea card: written once, readable only by ADMIN; the server allows one a minute per guest.
      async sendIdea(idea) {
        const key = D.push(D.ref(db, 'ideas')).key;
        await D.update(D.ref(db), {['ideas/' + key]: {...idea, uid, at: D.serverTimestamp()}, ['ideaLast/' + uid]: D.serverTimestamp()});
        return key;
      },
      vote: (id, i) => D.set(D.ref(db, 'votes/' + id + '/' + uid), i),
      async adminSignIn(email, pass) {
        if (!adminAuth) { const adminApp = A.initializeApp(conf, 'hyperborea-admin'); adminAuth = U.initializeAuth(adminApp, {persistence: U.inMemoryPersistence}); adminDb = D.getDatabase(adminApp); }
        try {
          await U.signInWithEmailAndPassword(adminAuth, email, pass);
          stopIdeas?.();
          stopIdeas = D.onValue(D.query(D.ref(adminDb, 'ideas'), D.limitToLast(100)), s => {
            const list = []; s.forEach(c => { const v = c.val() || {}; list.push({id: c.key, nick: str(v.nick, 16) || '?', kind: str(v.kind, 8), title: str(v.title, 60), text: str(v.text, 600), fav: str(v.fav, 40), at: v.at || 0, read: v.read === true}); });
            sink.ideas(list.reverse());
          }, warn('ideas'));
          return 'ok';
        }
        catch (error) {
          const code = String(error?.code || '');
          if (code.includes('network')) return 'offline';
          if (code.includes('too-many-requests')) return 'locked';
          if (/invalid|wrong-password|user-not-found|user-disabled|missing-password/.test(code)) return 'wrong';
          console.warn('ADMIN sign-in:', code || error); return 'error';
        }
      },
      adminSignOut() { stopIdeas?.(); stopIdeas = null; sink.ideas(null); if (adminAuth?.currentUser) U.signOut(adminAuth).catch(() => {}); },
      get isAdmin() { return !!adminAuth?.currentUser; },
      say: text => D.set(D.ref(admin(), 'broadcast'), {text, at: D.serverTimestamp(), id: rid()}),
      fire: name => D.set(D.ref(admin(), 'event'), {name, at: D.serverTimestamp(), id: rid()}),
      openPoll: (q, options) => D.set(D.ref(admin(), 'poll'), {id: 'p' + Date.now().toString(36), q, options, open: true, at: D.serverTimestamp()}),
      closePoll: () => D.update(D.ref(admin(), 'poll'), {open: false}),
      markIdea: (id, read) => D.update(D.ref(admin(), 'ideas/' + id), {read}),
      deleteIdea: id => D.remove(D.ref(admin(), 'ideas/' + id))
    };
  }
  function start() {
    if (starting) return starting;
    if (!cfg.firebase) { setStatus('off'); return starting = Promise.resolve(null); }
    setStatus('connecting');
    starting = firebaseBackend(cfg.firebase).then(b => { backend = b; return b; }, error => {
      console.warn('HYPERBOREA NET:', error?.code || error);
      setStatus(String(error?.code || error?.message || '').includes('network') || !navigator.onLine ? 'offline' : 'error');
      starting = null; return null; // the next call tries again
    });
    return starting;
  }
  const timeout = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);
  window.HyperGuest?.onChange(() => window.HyperGuest.publicCard().then(p => backend?.setProfile(p)));

  // ── Waiting for a quiet moment ────────────────────────────────────────────
  // Nothing pops up over the boot screens, a chapter of the novel, the FEAR darkness or another event.
  const busy = () => (window.HyperOS && window.HyperOS.state !== 'off') || window.BootEvents?.active || window.FearExperience?.active || window.LoreNovel?.playing;
  function whenFree(fn, limit) {
    const t0 = Date.now();
    const attempt = () => { if (!busy()) fn(); else if (Date.now() - t0 < limit) setTimeout(attempt, 700); };
    attempt();
  }

  // ── Events for everyone ───────────────────────────────────────────────────
  let noiseCtx = null;
  function hiss(seconds) { // A burst of TV static under the picture noise.
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      noiseCtx ||= new C(); if (noiseCtx.state !== 'running') noiseCtx.resume().catch(() => {});
      const n = Math.round(noiseCtx.sampleRate * seconds), buffer = noiseCtx.createBuffer(1, n, noiseCtx.sampleRate), d = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (.55 + .45 * Math.sin(i / n * Math.PI * 9) ** 2);
      const src = noiseCtx.createBufferSource(), gain = noiseCtx.createGain(), t = noiseCtx.currentTime;
      const level = (window.HyperboreaSound?.factor('terminal', 'fx') ?? .4) * .09;
      gain.gain.setValueAtTime(level, t); gain.gain.exponentialRampToValueAtTime(.0001, t + seconds);
      src.buffer = buffer; src.connect(gain).connect(noiseCtx.destination); src.start(t);
    } catch {}
  }
  function glitch() {
    if (motion.matches) { window.CrtPower?.(); return; }
    screen.classList.remove('hnet-glitch'); void screen.offsetWidth; screen.classList.add('hnet-glitch');
    const noise = document.createElement('div'); noise.className = 'hnet-noise'; noise.setAttribute('aria-hidden', 'true'); screen.append(noise);
    hiss(1.25);
    setTimeout(() => { screen.classList.remove('hnet-glitch'); noise.remove(); window.CrtPower?.(); }, 1300);
  }
  function runEvent(name) {
    const back = document.activeElement;
    const restore = () => { if (back && document.contains(back) && !window.HyperWindow?.anyOpen) back.focus?.({preventScroll: true}); };
    window.HyperWindow?.closeAll();
    if (name === 'glitch') glitch();
    else if (name === 'reconnect' || name === 'locked') window.BootEvents?.run(name).then(restore);
    else if (name === 'crash') { window.BootEvents?.prepare('crash'); window.BootEvents?.run('crash').then(restore); }
    else if (name === 'fear') { if (!window.FearExperience?.open({onComplete: restore, onCancel: restore})) glitch(); }
    emit('event', name);
  }

  // ── Windows: «эфир» and the poll ──────────────────────────────────────────
  const W = window.HyperWindow;
  const msgWin = W.make('hnet-msg', `<div class="hwin-box">
      <h2 class="hwin-bar"></h2>
      <div class="hwin-body"><p class="hnet-msg-text"></p><p class="hwin-dim hnet-msg-meta"></p></div>
      <footer class="hwin-keys"><button type="button" data-ok>[ OK ]</button><button type="button" data-alt hidden></button></footer>
    </div>`);
  let altAction = null;
  function showMessage({title, text, meta = '', alt = null, beep = true}) {
    $('.hwin-bar', msgWin.el).textContent = title;
    $('.hnet-msg-text', msgWin.el).textContent = text;
    $('.hnet-msg-meta', msgWin.el).textContent = meta;
    const altBtn = $('[data-alt]', msgWin.el); altAction = alt?.fn || null;
    altBtn.hidden = !alt; altBtn.textContent = alt ? '[ ' + alt.label + ' ]' : '';
    msgWin.open(null, alt ? altBtn : $('[data-ok]', msgWin.el));
    if (beep) chime();
  }
  $('[data-ok]', msgWin.el).addEventListener('click', () => msgWin.close());
  $('[data-alt]', msgWin.el).addEventListener('click', () => { const fn = altAction; msgWin.close(); fn?.(); });
  function chime() { // Two short terminal tones.
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      noiseCtx ||= new C(); if (noiseCtx.state !== 'running') return;
      const k = (window.HyperboreaSound?.factor('terminal', 'fx') ?? .4) * .05;
      [[880, 0], [1320, .11]].forEach(([f, d]) => {
        const o = noiseCtx.createOscillator(), g = noiseCtx.createGain(), t = noiseCtx.currentTime + d;
        o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(k, t); g.gain.exponentialRampToValueAtTime(.0001, t + .09);
        o.connect(g).connect(noiseCtx.destination); o.start(t); o.stop(t + .1);
      });
    } catch {}
  }
  const clock = at => new Date(at || Date.now()).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
  function showBroadcast(b) {
    if (seen.has(b.id)) return;
    markSeen(b.id);
    showMessage({title: 'ЭФИР · СООБЩЕНИЕ ОТ ADMIN', text: b.text, meta: 'Получено в ' + clock(b.at) + ' · видят все, кто сейчас в сети'});
    emit('broadcast', b);
  }
  function announcePoll(p) {
    if (!p?.open || Number.isInteger(mine[p.id])) return;
    showMessage({title: 'НОВЫЙ ОПРОС', text: p.q, meta: 'Голосовать можно в меню: 06 ОПРОС', alt: {label: 'Голосовать', fn: () => openPoll()}});
  }

  const pollWin = W.make('hnet-poll', `<div class="hwin-box">
      <h2 class="hwin-bar">Голосование</h2>
      <div class="hwin-body"><p class="hnet-q"></p><div class="hnet-opts" role="group"></div><p class="hwin-dim hnet-poll-meta"></p><p class="hwin-msg" role="status"></p></div>
      <footer class="hwin-keys"><span class="hwin-legend">↑↓ Выбор · ВВОД Голосовать · ESC Закрыть</span><button type="button" data-close>[ Закрыть ]</button></footer>
    </div>`);
  const pollMsg = (text, kind = '') => { const m = $('.hwin-msg', pollWin.el); m.textContent = text; m.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  const bar = (part, width = 16) => { const n = Math.round(part * width); return '█'.repeat(n) + '░'.repeat(width - n); };
  function renderPoll() {
    if (pollWin.el.hidden) return;
    const q = $('.hnet-q', pollWin.el), list = $('.hnet-opts', pollWin.el), meta = $('.hnet-poll-meta', pollWin.el);
    const focusedAt = [...list.children].indexOf(document.activeElement);
    const p = net.poll;
    if (!p) {
      list.replaceChildren();
      q.textContent = net.status === 'off' ? 'Голосования работают через сервер HYPERBOREA NET, а он ещё не подключён.'
        : net.status === 'connecting' ? 'Подключение к серверу…' : net.status === 'online' ? 'Сейчас нет открытых опросов. Загляни позже!' : 'Нет связи с сервером голосований.';
      meta.textContent = isAdmin() ? 'ADMIN: новый опрос — poll Вопрос? | Вариант 1 | Вариант 2' : '';
      return;
    }
    const r = net.results?.id === p.id ? net.results : null, my = Number.isInteger(r?.mine) ? r.mine : mine[p.id];
    const reveal = Number.isInteger(my) || !p.open || isAdmin();
    q.textContent = p.q;
    list.innerHTML = p.options.map((text, i) => {
      const count = r?.counts[i] || 0, part = r?.total ? count / r.total : 0;
      return `<button type="button" class="hnet-opt${i === my ? ' is-mine' : ''}" data-i="${i}" ${p.open ? '' : 'aria-disabled="true"'}>`
        + `<span class="hnet-mark">${i === my ? '(•)' : '( )'}</span><span class="hnet-name"></span>`
        + (reveal ? `<span class="hnet-bar" aria-hidden="true">${bar(part)}</span><span class="hnet-pct">${Math.round(part * 100)}% · ${count}</span>` : '') + '</button>';
    }).join('');
    [...list.children].forEach((b, i) => { $('.hnet-name', b).textContent = p.options[i]; });
    meta.textContent = (p.open ? 'Опрос открыт' : 'Опрос закрыт') + ' · голосов: ' + (r?.total ?? '…') + (reveal ? '' : ' · результаты — после твоего голоса');
    const keep = list.children[focusedAt >= 0 ? focusedAt : Math.max(0, Number.isInteger(my) ? my : 0)];
    if (pollWin.isOpen && (focusedAt >= 0 || !pollWin.el.contains(document.activeElement))) keep?.focus({preventScroll: true});
  }
  function openPoll(from) {
    start(); pollMsg('');
    pollWin.open(from, $('[data-close]', pollWin.el));
    renderPoll();
    const opts = $('.hnet-opts', pollWin.el).children, my = mine[net.poll?.id];
    (opts[Number.isInteger(my) ? my : 0] || $('[data-close]', pollWin.el)).focus({preventScroll: true});
  }
  $('[data-close]', pollWin.el).addEventListener('click', () => pollWin.close());
  $('.hnet-opts', pollWin.el).addEventListener('click', event => { const b = event.target.closest('.hnet-opt'); if (b) vote(Number(b.dataset.i)); });
  $('.hnet-opts', pollWin.el).addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const all = [...event.currentTarget.children], at = all.indexOf(document.activeElement);
    all[(at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus({preventScroll: true});
  });
  for (const type of ['poll', 'votes', 'status']) on(type, renderPoll);

  async function vote(i) {
    const p = net.poll;
    if (!p) return 'no-poll';
    if (!p.open) { pollMsg('Опрос уже закрыт.', 'err'); return 'closed'; }
    if (!backend) { pollMsg('Нет связи с сервером.', 'err'); return 'offline'; }
    const first = !Number.isInteger(mine[p.id]) && !Number.isInteger(net.results?.mine);
    pollMsg('Отправка голоса…');
    try {
      await backend.vote(p.id, i);
      mine[p.id] = i; try { localStorage.setItem(MINE, JSON.stringify(mine)); } catch {}
      if (first) window.HyperGuest?.addVote();
      pollMsg('Голос принят: ' + p.options[i] + '.', 'ok'); renderPoll(); return 'ok';
    } catch (error) {
      console.warn('Vote:', error?.code || error);
      pollMsg('Сервер не принял голос. Попробуй ещё раз.', 'err'); return 'error';
    }
  }

  // ── Who is online: everyone's card ────────────────────────────────────────
  const fmt = at => new Date(at || Date.now()).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  const offlineText = () => net.status === 'off' ? 'Сервер HYPERBOREA NET ещё не подключён.' : net.status === 'connecting' ? 'Подключение к серверу…' : 'Нет связи с сервером.';
  const peopleWin = W.make('hnet-people', `<div class="hwin-box hwin-wide">
      <h2 class="hwin-bar">В сети</h2>
      <div class="hwin-body"><p class="hwin-dim hnet-people-meta"></p><div class="hnet-people-list"></div></div>
      <footer class="hwin-keys"><span class="hwin-legend">Аватар, ник и «о себе» каждый меняет в 05 ПРОФИЛЬ</span><button type="button" data-close>[ Закрыть ]</button></footer>
    </div>`);
  function renderPeople() {
    if (peopleWin.el.hidden) return;
    const meta = $('.hnet-people-meta', peopleWin.el), box = $('.hnet-people-list', peopleWin.el);
    if (net.status !== 'online') { meta.textContent = offlineText(); box.replaceChildren(); return; }
    const list = [...net.online].sort((a, b) => (b.me - a.me) || (a.at - b.at));
    meta.textContent = 'Сейчас в сети: ' + list.length;
    box.replaceChildren(...list.map(u => {
      const card = document.createElement('article'); card.className = 'hnet-person' + (u.me ? ' is-me' : '');
      card.innerHTML = '<span class="hnet-person-ava"></span><div><b></b><p class="hnet-person-about"></p><p class="hwin-dim hnet-person-fav"></p></div>';
      window.HyperGuest?.fillAvatar($('.hnet-person-ava', card), {avatar: u.ava, look: u.look, nick: u.nick});
      $('b', card).textContent = u.nick + (u.me ? ' (ты)' : '');
      $('.hnet-person-about', card).textContent = u.about || '—';
      $('.hnet-person-fav', card).textContent = u.fav ? '♥ ' + u.fav : '';
      return card;
    }));
  }
  function openOnline(from) { start(); peopleWin.open(from, $('[data-close]', peopleWin.el)); renderPeople(); }
  $('[data-close]', peopleWin.el).addEventListener('click', () => peopleWin.close());
  for (const type of ['online', 'status']) on(type, renderPeople);

  // ── Idea card: a template the guest fills in and sends to ADMIN ───────────
  const kindName = k => IDEA_KINDS[k]?.[0] || 'Другое';
  const SENT = 'hyperborea_ideas_sent_v1';
  const sentList = () => { try { return JSON.parse(localStorage.getItem(SENT) || '[]'); } catch { return []; } };
  const ideaWin = W.make('hnet-idea', `<form class="hwin-box hwin-wide" novalidate>
      <h2 class="hwin-bar">Карточка идеи</h2>
      <div class="hwin-body">
        <p class="hwin-dim">Заполни карточку — она уйдёт прямо ADMIN. Кроме него её никто не увидит.</p>
        <label class="hwin-row"><span>О чём идея</span><select name="kind">${Object.entries(IDEA_KINDS).map(([k, v]) => '<option value="' + k + '">' + v[0] + '</option>').join('')}</select></label>
        <label class="hwin-row"><span>Заголовок</span><input name="title" maxlength="60" autocomplete="off" placeholder="коротко, в чём идея"></label>
        <label class="hwin-row"><span>Про игрока</span><select name="fav"></select></label>
        <label class="hwin-row hwin-row-top"><span>Описание</span><textarea name="text" maxlength="600" rows="8" spellcheck="true"></textarea><small class="hwin-hint" data-count></small></label>
        <p class="hwin-dim hnet-idea-from"></p>
        <p class="hwin-msg" role="status"></p>
        <div class="hnet-idea-sent hwin-dim"></div>
      </div>
      <footer class="hwin-keys"><button type="submit">[ Отправить ADMIN ]</button><button type="button" data-close>[ Отмена ]</button></footer>
    </form>`);
  const ideaForm = $('form', ideaWin.el);
  const ideaMsg = (text, kind = '') => { const m = $('.hwin-msg', ideaWin.el); m.textContent = text; m.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  let lastTemplate = '', lastSent = 0;
  function applyTemplate() { // The kind's template goes in while the text is empty or still the untouched template.
    const t = IDEA_KINDS[ideaForm.kind.value]?.[1] || '';
    if (!ideaForm.text.value.trim() || ideaForm.text.value === lastTemplate) ideaForm.text.value = t;
    lastTemplate = t; countIdea();
  }
  const countIdea = () => { $('[data-count]', ideaWin.el).textContent = ideaForm.text.value.length + ' / 600'; };
  function renderSent() {
    const list = sentList();
    $('.hnet-idea-sent', ideaWin.el).textContent = list.length ? 'Ты уже отправил: ' + list.length + ' · последняя — «' + list[0].title + '» (' + fmt(list[0].at) + ')' : '';
  }
  function openIdea(from) {
    start(); ideaMsg('');
    const players = window.HyperGuest?.players() || [];
    ideaForm.fav.innerHTML = '<option value="">— не про конкретного игрока —</option>' + players.map(n => '<option></option>').join('');
    [...ideaForm.fav.options].slice(1).forEach((o, i) => { o.textContent = players[i]; o.value = players[i]; });
    $('.hnet-idea-from', ideaWin.el).textContent = 'От: ' + (window.HyperGuest?.name() || 'guest') + ' (ник меняется в 05 ПРОФИЛЬ)';
    applyTemplate(); renderSent();
    ideaWin.open(from, ideaForm.kind);
  }
  ideaForm.kind.addEventListener('change', applyTemplate);
  ideaForm.text.addEventListener('input', countIdea);
  $('[data-close]', ideaWin.el).addEventListener('click', () => ideaWin.close());
  ideaForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (ideaForm.dataset.busy) return;
    const title = ideaForm.title.value.trim(), text = ideaForm.text.value.trim(), kind = ideaForm.kind.value;
    if (title.length < 3) { ideaMsg('Напиши заголовок — хотя бы пару слов.', 'err'); ideaForm.title.focus(); return; }
    if (text.length < 10 || text === (IDEA_KINDS[kind]?.[1] || '').trim()) { ideaMsg('Опиши идею подробнее.', 'err'); ideaForm.text.focus(); return; }
    if (Date.now() - lastSent < 60000) { ideaMsg('Следующую идею можно отправить через минуту.', 'err'); return; }
    if (!backend) { ideaMsg(offlineText() + ' Идея не отправлена — текст останется здесь.', 'err'); return; }
    ideaForm.dataset.busy = '1'; ideaMsg('Отправка…');
    try {
      await backend.sendIdea({nick: window.HyperGuest?.name() || 'guest', kind, title, text, ...(ideaForm.fav.value ? {fav: ideaForm.fav.value} : {})});
      lastSent = Date.now();
      try { localStorage.setItem(SENT, JSON.stringify([{title, kind, at: Date.now()}, ...sentList()].slice(0, 20))); } catch {}
      ideaForm.title.value = ''; ideaForm.text.value = ''; lastTemplate = ''; applyTemplate(); renderSent();
      ideaMsg('Идея отправлена ADMIN. Спасибо!', 'ok'); emit('idea-sent', title);
    } catch (error) {
      console.warn('Idea:', error?.code || error);
      ideaMsg(/permission/i.test(String(error?.code || error)) ? 'Сервер не принял: подожди минуту и попробуй снова.' : 'Не получилось отправить. Попробуй ещё раз.', 'err');
    } finally { delete ideaForm.dataset.busy; }
  });

  // ── ADMIN's inbox ─────────────────────────────────────────────────────────
  const inboxWin = W.make('hnet-inbox', `<div class="hwin-box hwin-wide">
      <h2 class="hwin-bar">Идеи от гостей</h2>
      <div class="hwin-body"><p class="hwin-dim hnet-inbox-meta"></p><div class="hnet-inbox-list"></div><p class="hwin-msg" role="status"></p></div>
      <footer class="hwin-keys"><span class="hwin-legend">Видишь только ты · новые сверху</span><button type="button" data-close>[ Закрыть ]</button></footer>
    </div>`);
  let armedDelete = null;
  function renderInbox() {
    if (inboxWin.el.hidden) return;
    const meta = $('.hnet-inbox-meta', inboxWin.el), box = $('.hnet-inbox-list', inboxWin.el);
    if (!isAdmin()) { meta.textContent = 'Входящие идеи видит только ADMIN, вошедший через сервер.'; box.replaceChildren(); return; }
    const list = net.ideas || [];
    meta.textContent = list.length ? 'Всего: ' + list.length + ' · новых: ' + list.filter(i => !i.read).length : 'Пока идей нет.';
    const focused = document.activeElement?.closest?.('.hnet-idea')?.dataset.id;
    box.replaceChildren(...list.map(i => {
      const card = document.createElement('article'); card.className = 'hnet-idea' + (i.read ? '' : ' is-new'); card.dataset.id = i.id;
      card.innerHTML = '<header><b></b><span class="hwin-dim"></span></header><p class="hnet-idea-text"></p><p class="hwin-dim hnet-idea-fav"></p>'
        + '<div class="hnet-idea-actions"><button type="button" class="hwin-btn" data-read></button><button type="button" class="hwin-btn" data-del>[ Удалить ]</button></div>';
      $('b', card).textContent = (i.read ? '' : '● ') + '[' + kindName(i.kind) + '] ' + i.title;
      $('header span', card).textContent = i.nick + ' · ' + fmt(i.at);
      $('.hnet-idea-text', card).textContent = i.text;
      $('.hnet-idea-fav', card).textContent = i.fav ? 'Про игрока: ' + i.fav : '';
      $('[data-read]', card).textContent = i.read ? '[ Отметить новой ]' : '[ Прочитано ]';
      return card;
    }));
    if (focused) box.querySelector('[data-id="' + CSS.escape(focused) + '"] [data-read]')?.focus({preventScroll: true});
  }
  function openInbox(from) { start(); armedDelete = null; inboxWin.open(from, $('[data-close]', inboxWin.el)); renderInbox(); }
  $('[data-close]', inboxWin.el).addEventListener('click', () => inboxWin.close());
  $('.hnet-inbox-list', inboxWin.el).addEventListener('click', async event => {
    const button = event.target.closest('button'), card = event.target.closest('.hnet-idea'); if (!button || !card) return;
    const id = card.dataset.id, idea = (net.ideas || []).find(i => i.id === id), say = $('.hwin-msg', inboxWin.el);
    if (button.matches('[data-read]')) { const r = await act(b => b.markIdea(id, !idea?.read)); if (r !== 'ok') say.textContent = r; return; }
    if (armedDelete !== id) { armedDelete = id; button.textContent = '[ Точно удалить? ]'; return; }
    armedDelete = null; const r = await act(b => b.deleteIdea(id)); say.textContent = r === 'ok' ? 'Удалено.' : r;
  });
  on('ideas', renderInbox);

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  const isAdmin = () => !!backend?.isAdmin;
  async function adminSignIn(name, pass) {
    const login = String(name || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,32}$/.test(login) || !pass) return 'wrong';
    const b = await timeout(start(), 12000);
    if (!b) return net.status === 'error' ? 'error' : 'offline';
    return timeout(b.adminSignIn(login + '@' + (cfg.adminEmailDomain || 'example.com'), pass), 15000).then(r => r || 'offline');
  }
  // ADMIN's actions: 'ok', or what went wrong in a few words.
  async function act(fn) {
    if (!cfg.firebase) return 'Сервер HYPERBOREA NET не подключён (hyper-net-config.js).';
    if (!backend) return 'Нет связи с сервером.';
    if (!backend.isAdmin) return 'Нужен вход ADMIN через сервер (logout → ADMIN).';
    try { await fn(backend); return 'ok'; }
    catch (error) {
      const code = String(error?.code || error?.message || error);
      console.warn('ADMIN action:', code);
      return /permission/i.test(code) ? 'Сервер отказал в доступе: проверь UID админа в правилах базы.' : 'Ошибка сервера: ' + code;
    }
  }

  window.HyperNet = {
    EVENTS, STATUS,
    get configured() { return !!cfg.firebase; },
    get status() { return net.status; },
    get statusText() { return STATUS[net.status] || net.status; },
    get online() { return net.online; },
    get count() { return net.online.length; },
    get poll() { return net.poll; },
    get results() { return net.results; },
    get isAdmin() { return isAdmin(); },
    on, start, vote, openPoll, adminSignIn,
    adminSignOut() { backend?.adminSignOut(); },
    say: text => act(b => b.say(text)),
    fire: name => act(b => b.fire(name)),
    openNewPoll: (q, options) => act(b => b.openPoll(q, options)),
    openOnline, openIdea, openInbox, IDEA_KINDS,
    get ideas() { return net.ideas; },
    closePoll: () => act(b => b.closePoll()),
    // For trying things out on one screen (and for tests): an event or a message right here, no server involved.
    local: {event: runEvent, message: text => showBroadcast({id: rid(), text, at: Date.now()})},
    // Tests: put a stand-in for Firebase in place (same methods as firebaseBackend returns) and feed it via sink.
    _useBackend(fake) { backend = fake; starting = Promise.resolve(fake); cfg.firebase ||= {test: true}; return sink; }
  };
  start();
})();
