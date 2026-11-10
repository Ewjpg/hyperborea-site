// HYPERBOREA NET: what every open terminal shares live.
//  · members, like a Discord server: everyone who has ever come in, grouped by role, online or not, with their
//    avatar, nick and a line about them (07 УЧАСТНИКИ). ADMIN creates roles (name, colour, rights) and hands them out;
//  · «эфир» — a message that pops up on every screen at once;
//  · events for everyone: static, CONNECTION LOST, ACCESS BLOCKED, a crash, the FEAR darkness;
//  · polls: someone asks, everyone votes and watches the bars move (06 ОПРОС);
//  · idea cards: guests fill in a template and send it; only ADMIN can read them (08 ИДЕЯ / ИДЕИ).
// Broadcasts, events and polls are ADMIN's — and anyone's whose role has that right («Эфир», «События», «Опросы»).
// It runs on a small Firebase Realtime Database (settings in hyper-net-config.js, rules in
// firebase/database.rules.json). Guests sign in anonymously; ADMIN signs in with the password kept only in Firebase.
// The database itself checks every right, so a page edited in the browser cannot get around it.
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
  const PERMS = {say: 'Эфир', poll: 'Опросы', event: 'События'};
  const PALETTE = ['#ff6b6b', '#ffb84d', '#ffe46b', '#7fe0b0', '#7fd8ff', '#8fa5ff', '#c79bff', '#ff9fd6'];
  const ADMIN_ROLE = {name: 'ADMIN', color: '#ff6b6b', order: -1, perms: {}};
  const STATUS = {off: 'сервер не подключён', connecting: 'подключение…', online: 'в сети', offline: 'нет связи', error: 'ошибка сервера'};
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
  const hashOf = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

  // ── State and listeners ───────────────────────────────────────────────────
  const subs = {};
  const on = (type, fn) => { (subs[type] ||= new Set()).add(fn); return () => subs[type].delete(fn); };
  const emit = (type, data) => subs[type]?.forEach(fn => { try { fn(data); } catch (error) { console.warn('HyperNet ' + type + ':', error); } });
  const net = {status: cfg.firebase ? 'connecting' : 'off', online: [], members: {}, roles: {}, roleDefs: {}, poll: null, results: null, ideas: null};
  let backend = null, starting = null, pollKnown = false, faked = false; // faked: a test put its stand-in in place
  // Idea templates: each kind's fields (key, label, type, hint or options, max length), the field that is its title,
  // ratings for a new player, and what its picture is for.
  const IDEA_TYPES = {
    player: {name: 'Новый игрок', icon: '⚽', title: 'name', image: 'Портрет', hint: 'Пустая анкета-досье: заполни, что придумал, выставь рейтинги и загрузи портрет.',
      fields: [['name', 'Имя', 'input', 'имя и фамилия', 40], ['country', 'Страна', 'input', 'например, Япония', 40], ['club', 'Клуб', 'input', 'например, Azure Latch', 40],
        ['position', 'Позиция', 'select', ['Нападающий', 'Полузащитник', 'Защитник', 'Вратарь', 'Универсал']], ['number', 'Номер', 'number', '1–99', 3], ['age', 'Возраст', 'number', '', 3],
        ['strength', 'Сильная сторона', 'input', 'чем он опасен', 80], ['move', 'Особый приём', 'input', 'название и как работает', 120],
        ['character', 'Характер', 'input', 'какой он вне поля', 120], ['story', 'История', 'textarea', 'откуда он, почему играет, что его ждёт…', 600]],
      stats: [['speed', 'Скорость'], ['shot', 'Удар'], ['pass', 'Пас'], ['dribble', 'Дриблинг'], ['defense', 'Защита'], ['physical', 'Физика']]},
    lore: {name: 'Глава или история', icon: '✎', title: 'title', image: 'Обложка', hint: 'Сюжет для LORE: кто, где, что происходит и чем всё кончается.',
      fields: [['title', 'Название', 'input', 'как называется глава', 60], ['hero', 'Главный герой', 'player'], ['who', 'Кто ещё участвует', 'input', '', 120],
        ['where', 'Где', 'input', 'место действия', 80], ['plot', 'Что происходит', 'textarea', 'по порядку, как в новелле', 600], ['ending', 'Чем заканчивается', 'textarea', '', 300]]},
    event: {name: 'Событие на сайте', icon: '⚡', title: 'title', image: 'Набросок или скриншот', hint: 'То, что ADMIN сможет запускать у всех — как помехи или тьма FEAR.',
      fields: [['title', 'Название', 'input', 'как назвать событие', 60], ['screen', 'Что видят все', 'textarea', 'что происходит на экране', 400],
        ['sound', 'Звук и настроение', 'input', '', 120], ['length', 'Сколько длится', 'input', 'например, 20 секунд', 40], ['when', 'Когда запускать', 'input', '', 120]]},
    site: {name: 'Функция сайта', icon: '⚙', title: 'title', image: 'Скриншот или набросок', hint: 'Что добавить или поменять на сайте.',
      fields: [['title', 'Что добавить', 'input', 'коротко', 60], ['where', 'Где на сайте', 'input', 'например, в VERSUS', 80],
        ['how', 'Как это работает', 'textarea', '', 600], ['why', 'Зачем это нужно', 'textarea', '', 300]]},
    other: {name: 'Другое', icon: '✦', title: 'title', image: 'Картинка', hint: 'Всё остальное — пиши как удобно.',
      fields: [['title', 'Заголовок', 'input', '', 60], ['text', 'Описание', 'textarea', '', 600]]}
  };
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const obj = v => v && typeof v === 'object' ? v : {};
  // A presence entry. Older versions of the site also put their profile and a small avatar there.
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

  // Roles.
  // ADMIN's role belongs to the ADMIN profile (its own account, hyper-net-config.js → adminUid), not to a device.
  const roleDef = id => net.roleDefs[id] || null;
  const roleOf = uid => {
    if (uid && uid === cfg.adminUid) return {id: 'admin', ...ADMIN_ROLE};
    const id = net.roles[uid], def = id && id !== 'admin' && roleDef(id);
    return def ? {id, ...def} : null;
  };
  const selfUid = () => backend?.selfUid ?? backend?.uid;
  const roleList = () => Object.entries(net.roleDefs).map(([id, d]) => ({id, ...d})).sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(b.name));
  const isAdmin = () => !!backend?.isAdmin;
  const can = perm => isAdmin() || !!(backend && roleOf(backend.uid)?.perms?.[perm]);

  // What the backend reports.
  const pageSink = {
    status: setStatus,
    online(list) { net.online = list; emit('online', list); },
    members(map) { net.members = obj(map); emit('members', net.members); },
    roles(map) { net.roles = obj(map); emit('roles'); },
    roleDefs(map) { net.roleDefs = obj(map); emit('roles'); },
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
    // What the server reports goes to the page — unless a test has put its stand-in in place meanwhile.
    const sink = Object.fromEntries(Object.entries(pageSink).map(([k, fn]) => [k, (...args) => { if (!faked) fn(...args); }]));
    const app = A.getApps().find(a => a.name === 'hyperborea') || A.initializeApp(conf, 'hyperborea');
    let auth; try { auth = U.initializeAuth(app, {persistence: [U.indexedDBLocalPersistence, U.browserLocalPersistence]}); } catch { auth = U.getAuth(app); }
    const saved = await new Promise(resolve => { const stop = U.onAuthStateChanged(auth, user => { stop(); resolve(user); }); });
    const uid = (saved || (await U.signInAnonymously(auth)).user).uid; // the same anonymous id on every visit
    const db = D.getDatabase(app);
    const warn = what => error => console.warn('HYPERBOREA NET ' + what + ':', error?.code || error);
    let offset = 0, connected = false, profile = {nick: window.HyperGuest?.name() || 'guest', look: 'plain'};
    // Who this terminal is in the lists: the guest (anonymous id) — or, while signed in, the ADMIN profile under
    // ADMIN's own account, so ADMIN is a member of its own with the ADMIN role, apart from this device's guest.
    const identity = (base, id) => ({db: base, uid: id, me: D.ref(base, 'online/' + id), member: D.ref(base, 'members/' + id), firstKnown: false});
    const guest = identity(db, uid);
    let self = guest;
    // The member card: written on every visit and change; «last» also when the connection drops.
    async function saveMember(i) {
      try {
        if (!i.firstKnown) i.firstKnown = (await D.get(D.child(i.member, 'first'))).exists();
        const data = {nick: profile.nick, look: profile.look || 'plain', about: profile.about || null, fav: profile.fav || null, av: profile.av || null, last: D.serverTimestamp()};
        if (!i.firstKnown) data.first = D.serverTimestamp();
        await D.update(i.member, data); i.firstKnown = true;
        await D.onDisconnect(D.child(i.member, 'last')).set(D.serverTimestamp());
      } catch (error) { warn('member')(error); }
    }
    const join = (i = self) => { if (!connected) return; D.set(i.me, {nick: profile.nick, at: D.serverTimestamp()}).catch(warn('online')); saveMember(i); };
    async function enter(i) { self = i; try { await D.onDisconnect(i.me).remove(); } catch (error) { warn('presence')(error); } join(i); }
    async function leave(i) { // out of «в сети», with the time it left
      try { await D.onDisconnect(i.me).cancel(); await D.remove(i.me); if (i.firstKnown) await D.update(i.member, {last: D.serverTimestamp()}); }
      catch (error) { warn('leave')(error); }
    }
    D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
    D.onValue(D.ref(db, '.info/connected'), s => {
      connected = s.val() === true;
      sink.status(connected ? 'online' : 'offline');
      if (connected) enter(self);
    });
    D.onValue(D.ref(db, 'online'), s => {
      const list = []; s.forEach(c => { list.push(person(c.key, c.val(), c.key === self.uid)); });
      sink.online(list);
    }, warn('online list'));
    D.onValue(D.ref(db, 'members'), s => sink.members(s.val()), warn('members'));
    D.onValue(D.ref(db, 'roles'), s => sink.roles(s.val()), warn('roles'));
    D.onValue(D.ref(db, 'roleDefs'), s => sink.roleDefs(s.val()), warn('roleDefs'));
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
    // Broadcasts, events and polls go out as ADMIN when signed in, otherwise as this guest (the rules check the role).
    const writer = () => adminAuth?.currentUser ? adminDb : db;
    return {
      uid, now: () => Date.now() + offset,
      get selfUid() { return self.uid; },
      setProfile(p) { profile = p; join(); },
      setAvatar: url => url ? D.set(D.ref(self.db, 'avatars/' + self.uid), url) : D.remove(D.ref(self.db, 'avatars/' + self.uid)),
      getAvatar: who => D.get(D.ref(db, 'avatars/' + who)).then(s => s.val() || ''),
      // An idea card: written once, readable only by ADMIN; the server allows one a minute per guest.
      async sendIdea(idea, image) { // the picture goes to its own place, so ADMIN's list stays light
        const key = D.push(D.ref(db, 'ideas')).key;
        const upd = {['ideas/' + key]: {...idea, uid, at: D.serverTimestamp()}, ['ideaLast/' + uid]: D.serverTimestamp()};
        if (image) upd['ideaImages/' + key] = image;
        await D.update(D.ref(db), upd);
        return key;
      },
      getIdea: id => D.get(D.ref(db, 'ideas/' + id)).then(s => s.val()), // the sender may read their own
      getIdeaImage: id => D.get(D.ref(admin(), 'ideaImages/' + id)).then(s => s.val() || ''),
      replyIdea: (id, reply) => D.update(D.ref(admin(), 'ideas/' + id), {reply: reply || null, read: true}),
      vote: (id, i) => D.set(D.ref(db, 'votes/' + id + '/' + uid), i),
      async adminSignIn(email, pass) {
        if (!adminAuth) { const adminApp = A.initializeApp(conf, 'hyperborea-admin'); adminAuth = U.initializeAuth(adminApp, {persistence: U.inMemoryPersistence}); adminDb = D.getDatabase(adminApp); }
        try {
          await U.signInWithEmailAndPassword(adminAuth, email, pass);
          // This device's guest leaves «в сети»; the ADMIN profile comes in under ADMIN's own account.
          if (self === guest) { await leave(guest); await enter(identity(adminDb, adminAuth.currentUser.uid)); }
          if (net.roles[uid] === 'admin') D.remove(D.ref(adminDb, 'roles/' + uid)).catch(() => {}); // an older version marked the device itself
          stopIdeas?.();
          stopIdeas = D.onValue(D.query(D.ref(adminDb, 'ideas'), D.limitToLast(100)), s => {
            const list = []; s.forEach(c => { const v = c.val() || {}; list.push({id: c.key, nick: str(v.nick, 16) || '?', kind: str(v.kind, 8), title: str(v.title, 60), text: str(v.text, 1500), fav: str(v.fav, 40), at: v.at || 0, read: v.read === true,
              fields: obj(v.fields), stats: obj(v.stats), img: v.img === true, reply: str(v.reply, 300)}); });
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
      async adminSignOut() {
        stopIdeas?.(); stopIdeas = null; sink.ideas(null);
        if (self !== guest) { await leave(self); await enter(guest); } // the ADMIN profile leaves, the guest comes back
        if (adminAuth?.currentUser) await U.signOut(adminAuth).catch(() => {});
      },
      get isAdmin() { return !!adminAuth?.currentUser; },
      say: (text, by) => D.set(D.ref(writer(), 'broadcast'), {text, at: D.serverTimestamp(), id: rid(), ...(by ? {by} : {})}),
      fire: name => D.set(D.ref(writer(), 'event'), {name, at: D.serverTimestamp(), id: rid()}),
      openPoll: (q, options) => D.set(D.ref(writer(), 'poll'), {id: 'p' + Date.now().toString(36), q, options, open: true, at: D.serverTimestamp()}),
      closePoll: () => D.update(D.ref(writer(), 'poll'), {open: false}),
      markIdea: (id, read) => D.update(D.ref(admin(), 'ideas/' + id), {read}),
      deleteIdea: id => D.update(D.ref(admin()), {['ideas/' + id]: null, ['ideaImages/' + id]: null}),
      setRole: (who, role) => D.set(D.ref(admin(), 'roles/' + who), role || null),
      saveRoles: defs => D.update(D.ref(admin(), 'roleDefs'), defs),
      async deleteRole(id) {
        const upd = {['roleDefs/' + id]: null};
        for (const [who, role] of Object.entries(net.roles)) if (role === id) upd['roles/' + who] = null;
        await D.update(D.ref(admin()), upd);
      },
      removeMember: who => D.update(D.ref(admin()), {['members/' + who]: null, ['avatars/' + who]: null, ['roles/' + who]: null})
    };
  }
  function start() {
    if (starting) return starting;
    if (!cfg.firebase) { setStatus('off'); return starting = Promise.resolve(null); }
    setStatus('connecting');
    starting = firebaseBackend(cfg.firebase).then(b => { if (faked) return backend; backend = b; publishProfile(); checkReplies(); return b; }, error => {
      if (faked) return backend;
      console.warn('HYPERBOREA NET:', error?.code || error);
      setStatus(String(error?.code || error?.message || '').includes('network') || !navigator.onLine ? 'offline' : 'error');
      starting = null; return null; // the next call tries again
    });
    return starting;
  }
  const timeout = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(null), ms))]);
  // This guest's card for the others: the public part, and the 128×128 avatar only when it changed.
  // While ADMIN is signed in, the same card goes out as the ADMIN profile (nick «ADMIN» if the card has none).
  let sentAvatar = null, sentFor = null;
  async function publishProfile() {
    const b = backend, guest = window.HyperGuest; if (!b?.setProfile || !guest) return;
    if (selfUid() !== sentFor) { sentFor = selfUid(); sentAvatar = null; }
    const url = await guest.publicAvatar(), av = url ? hashOf(url) : '';
    if (av !== sentAvatar) { try { await b.setAvatar(url); sentAvatar = av; } catch (error) { console.warn('Avatar:', error?.code || error); } }
    const card = guest.publicCard();
    if (b.isAdmin && !guest.nick) card.nick = 'ADMIN';
    b.setProfile({...card, ...(av && sentAvatar === av ? {av} : {})});
  }
  window.HyperGuest?.onChange(() => publishProfile());

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
    const by = str(b.by, 16);
    showMessage({title: by ? 'ЭФИР · ' + by.toUpperCase() : 'ЭФИР · СООБЩЕНИЕ ОТ ADMIN', text: b.text, meta: 'Получено в ' + clock(b.at) + ' · видят все, кто сейчас в сети'});
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
      meta.textContent = can('poll') ? 'Новый опрос: poll Вопрос? | Вариант 1 | Вариант 2' : '';
      return;
    }
    const r = net.results?.id === p.id ? net.results : null, my = Number.isInteger(r?.mine) ? r.mine : mine[p.id];
    const reveal = Number.isInteger(my) || !p.open || can('poll');
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
  for (const type of ['poll', 'votes', 'status', 'roles']) on(type, renderPoll);

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

  // ── Members: everyone who has come in, grouped by role like Discord ──────
  const fmt = at => new Date(at || Date.now()).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  const day = at => new Date(at || Date.now()).toLocaleDateString('ru-RU');
  function ago(at) {
    if (!at) return 'давно';
    const s = Math.max(0, (now() - at) / 1000);
    return s < 90 ? 'только что' : s < 3600 ? Math.round(s / 60) + ' мин назад' : s < 86400 ? Math.round(s / 3600) + ' ч назад' : fmt(at);
  }
  const offlineText = () => net.status === 'off' ? 'Сервер HYPERBOREA NET ещё не подключён.' : net.status === 'connecting' ? 'Подключение к серверу…' : 'Нет связи с сервером.';
  function people() {
    const online = new Set(net.online.map(u => u.uid)), me = selfUid(), all = new Map();
    for (const [uid, m] of Object.entries(net.members)) {
      const v = obj(m);
      all.set(uid, {uid, nick: str(v.nick, 16) || '?', look: str(v.look, 8) || 'plain', about: str(v.about, 80), fav: str(v.fav, 40), av: str(v.av, 16), ava: '', first: v.first || 0, last: v.last || 0});
    }
    for (const u of net.online) if (!all.has(u.uid)) all.set(u.uid, {...u, av: '', first: u.at, last: u.at}); // an older site: presence only
    return [...all.values()].map(p => ({...p, online: online.has(p.uid), me: p.uid === me, role: roleOf(p.uid)}));
  }
  const findMember = nick => people().filter(p => p.nick.toLowerCase() === String(nick).toLowerCase()).sort((a, b) => (b.online - a.online) || (b.last - a.last))[0] || null;
  const findRole = name => roleList().find(r => r.name.toLowerCase() === String(name).trim().toLowerCase()) || null;

  // Avatars are fetched once per member and picture, then kept for the session.
  const avatarCache = new Map();
  function personAvatar(el, p) {
    const fill = avatar => window.HyperGuest?.fillAvatar(el, {nick: p.nick, look: p.look, avatar});
    if (p.me && window.HyperGuest) { fill(window.HyperGuest.card.avatar); return; }
    const key = p.uid + ':' + p.av, hit = avatarCache.get(key);
    fill(typeof hit === 'string' ? hit : p.ava || '');
    if (!p.av || typeof hit === 'string' || !backend?.getAvatar) return;
    let pending = hit;
    if (!pending) { pending = backend.getAvatar(p.uid).then(url => { avatarCache.set(key, url); return url; }, () => { avatarCache.delete(key); return ''; }); avatarCache.set(key, pending); }
    pending.then(url => { if (url && el.isConnected) fill(url); });
  }

  const memWin = W.make('hnet-members', `<div class="hwin-box hwin-wide hnet-members-box">
      <h2 class="hwin-bar">Участники</h2>
      <div class="hwin-body">
        <div class="hnet-tabs" role="tablist" hidden><button type="button" role="tab" data-tab="people">[ Участники ]</button><button type="button" role="tab" data-tab="roles">[ Роли ]</button></div>
        <p class="hwin-dim hnet-mem-meta"></p>
        <div class="hnet-mem-grid" data-pane="people"><div class="hnet-mem-list"></div><aside class="hnet-mem-card" aria-live="polite"></aside></div>
        <div class="hnet-roles" data-pane="roles" hidden>
          <div class="hnet-role-list"></div>
          <form class="hnet-role-new" novalidate>
            <p class="hnet-role-new-title">Новая роль</p>
            <label class="hwin-row"><span>Название</span><input name="name" maxlength="20" autocomplete="off" placeholder="например, Модератор"></label>
            <div class="hwin-row"><span>Цвет</span><div class="hnet-swatches">${PALETTE.map(c => `<button type="button" class="hnet-swatch" data-color="${c}" style="--sw:${c}" aria-label="Цвет ${c}"></button>`).join('')}<input type="color" name="color" value="#7fd8ff" aria-label="Свой цвет"></div></div>
            <div class="hwin-row"><span>Права</span><div class="hnet-perms">${Object.entries(PERMS).map(([k, v]) => `<label><input type="checkbox" name="perm-${k}"> ${v}</label>`).join('')}</div></div>
            <button type="submit" class="hwin-btn">[ Создать роль ]</button>
          </form>
        </div>
        <p class="hwin-msg" role="status"></p>
      </div>
      <footer class="hwin-keys"><span class="hwin-legend">Нажми на участника — откроется его карточка</span><button type="button" data-close>[ Закрыть ]</button></footer>
    </div>`);
  let selected = null, tab = 'people', armed = '';
  const memMsg = (text, kind = '') => { const m = $('.hwin-msg', memWin.el); m.textContent = text; m.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  function memberRow(p) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.uid = p.uid;
    b.className = 'hnet-mem' + (p.online ? ' is-on' : '') + (p.uid === selected ? ' is-selected' : '');
    b.innerHTML = '<span class="hnet-mem-ava"><span></span><i class="hnet-dot" aria-hidden="true"></i></span><span class="hnet-mem-text"><b></b><small></small></span>';
    personAvatar($('.hnet-mem-ava > span', b), p);
    $('b', b).textContent = p.nick + (p.me ? ' (ты)' : '');
    if (p.role) $('b', b).style.color = p.role.color;
    $('small', b).textContent = p.about || (p.online ? 'в сети' : 'был(а) ' + ago(p.last));
    b.setAttribute('aria-label', p.nick + (p.role ? ', ' + p.role.name : '') + (p.online ? ', в сети' : ', не в сети'));
    return b;
  }
  function renderMembers() {
    if (memWin.el.hidden) return;
    const admin = isAdmin(), meta = $('.hnet-mem-meta', memWin.el), list = $('.hnet-mem-list', memWin.el);
    $('.hnet-tabs', memWin.el).hidden = !admin;
    if (!admin) tab = 'people';
    for (const b of memWin.el.querySelectorAll('[data-tab]')) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.classList.toggle('is-on', b.dataset.tab === tab); }
    for (const pane of memWin.el.querySelectorAll('[data-pane]')) pane.hidden = pane.dataset.pane !== tab;
    renderRoleList();
    const all = people();
    if (!all.length) { meta.textContent = net.status === 'online' ? 'Пока никого нет.' : offlineText(); list.replaceChildren(); renderCard(); return; }
    const online = all.filter(p => p.online), offline = all.filter(p => !p.online);
    meta.textContent = 'В сети: ' + online.length + ' · всего участников: ' + all.length + (net.status === 'online' ? '' : ' · ' + offlineText());
    const byNick = (a, b) => (b.me - a.me) || a.nick.localeCompare(b.nick);
    const groups = [];
    for (const r of [{id: 'admin', ...ADMIN_ROLE}, ...roleList()]) {
      const ms = online.filter(p => p.role?.id === r.id);
      if (ms.length) groups.push([r.name, r.color, ms.sort(byNick)]);
    }
    const plain = online.filter(p => !p.role); if (plain.length) groups.push(['В сети', '', plain.sort(byNick)]);
    if (offline.length) groups.push(['Не в сети', '', offline.sort((a, b) => b.last - a.last)]);
    const focused = document.activeElement?.closest?.('.hnet-mem')?.dataset.uid;
    list.replaceChildren(...groups.map(([name, color, ms]) => {
      const g = document.createElement('section'); g.className = 'hnet-mem-group';
      const h = document.createElement('h3'); h.textContent = name.toUpperCase() + ' — ' + ms.length; if (color) h.style.color = color;
      g.append(h, ...ms.map(memberRow)); return g;
    }));
    if (focused) list.querySelector('[data-uid="' + CSS.escape(focused) + '"]')?.focus({preventScroll: true});
    if (selected && !all.some(p => p.uid === selected)) selected = null;
    renderCard();
  }
  function renderCard() {
    const box = $('.hnet-mem-card', memWin.el), p = selected && people().find(x => x.uid === selected);
    if (!p) { box.innerHTML = '<p class="hwin-dim">Выбери участника в списке — здесь появится его карточка.</p>'; return; }
    box.innerHTML = '<span class="hnet-card-ava"></span><p class="hnet-card-nick"></p><p class="hnet-card-role"></p><p class="hnet-card-status"></p>'
      + '<p class="hnet-card-about"></p><p class="hwin-dim hnet-card-fav"></p><p class="hwin-dim hnet-card-first"></p><div class="hnet-card-admin" hidden></div>';
    personAvatar($('.hnet-card-ava', box), p);
    const nick = $('.hnet-card-nick', box); nick.textContent = p.nick + (p.me ? ' (ты)' : ''); if (p.role) nick.style.color = p.role.color;
    const role = $('.hnet-card-role', box);
    if (p.role) { const tag = document.createElement('span'); tag.className = 'hnet-role-tag'; tag.style.setProperty('--rc', p.role.color); tag.textContent = p.role.name; role.append(tag); }
    else role.innerHTML = '<span class="hnet-role-tag">Гость</span>';
    $('.hnet-card-status', box).textContent = p.online ? '● в сети' : '○ был(а) в сети ' + ago(p.last);
    $('.hnet-card-status', box).classList.toggle('is-on', p.online);
    $('.hnet-card-about', box).textContent = p.about || 'О себе ничего не написано.';
    $('.hnet-card-fav', box).textContent = p.fav ? '♥ Любимый игрок: ' + p.fav : '';
    $('.hnet-card-first', box).textContent = p.first ? 'Впервые: ' + day(p.first) : '';
    if (!isAdmin() || p.role?.id === 'admin') return;
    const panel = $('.hnet-card-admin', box); panel.hidden = false;
    panel.innerHTML = '<p class="hwin-dim">ADMIN</p><label class="hnet-card-pick"><span>Роль</span><select></select></label>'
      + '<div class="hnet-card-actions"><button type="button" class="hwin-btn" data-give>[ Выдать ]</button><button type="button" class="hwin-btn" data-remove>[ Убрать из списка ]</button></div>';
    const select = $('select', panel);
    select.append(new Option('— без роли —', ''), ...roleList().map(r => new Option(r.name, r.id)));
    select.value = p.role?.id || '';
    if (!roleList().length) { // nothing to give yet
      const hint = document.createElement('p'); hint.className = 'hwin-dim hnet-card-hint';
      hint.innerHTML = 'Ролей пока нет. <button type="button" class="hwin-btn" data-goto-roles>[ Создать роль ]</button>';
      $('.hnet-card-pick', panel).after(hint); $('[data-give]', panel).disabled = true;
    }
  }
  function renderRoleList() {
    const box = $('.hnet-role-list', memWin.el);
    if (tab !== 'roles') return;
    const roles = roleList(), counts = {};
    for (const id of Object.values(net.roles)) counts[id] = (counts[id] || 0) + 1;
    if (!roles.length) { box.innerHTML = '<p class="hwin-dim">Ролей пока нет — создай первую ниже.</p>'; return; }
    box.replaceChildren(...roles.map((r, i) => {
      const row = document.createElement('div'); row.className = 'hnet-role-row'; row.dataset.role = r.id;
      row.innerHTML = '<i class="hnet-role-swatch"></i><b></b><span class="hwin-dim"></span><span class="hnet-perms">'
        + Object.entries(PERMS).map(([k, v]) => `<label><input type="checkbox" data-perm="${k}"${r.perms?.[k] ? ' checked' : ''}> ${v}</label>`).join('') + '</span>'
        + `<span class="hnet-role-btns"><button type="button" class="hwin-btn" data-up${i ? '' : ' disabled'} aria-label="Выше">↑</button><button type="button" class="hwin-btn" data-down${i < roles.length - 1 ? '' : ' disabled'} aria-label="Ниже">↓</button><button type="button" class="hwin-btn" data-del>[ Удалить ]</button></span>`;
      $('.hnet-role-swatch', row).style.background = r.color;
      $('b', row).textContent = r.name; $('b', row).style.color = r.color;
      $('span.hwin-dim', row).textContent = (counts[r.id] || 0) + ' уч.';
      return row;
    }));
  }
  function openMembers(from, nick) {
    start(); memMsg(''); armed = '';
    if (nick) selected = findMember(nick)?.uid || selected;
    memWin.open(from, $('[data-close]', memWin.el));
    renderMembers();
    ($('.hnet-mem-list .hnet-mem', memWin.el) || $('[data-close]', memWin.el)).focus({preventScroll: true});
  }
  $('[data-close]', memWin.el).addEventListener('click', () => memWin.close());
  memWin.el.addEventListener('click', async event => {
    const t = event.target;
    const tabBtn = t.closest('[data-tab]'); if (tabBtn) { tab = tabBtn.dataset.tab; memMsg(''); renderMembers(); return; }
    if (t.closest('[data-goto-roles]')) { tab = 'roles'; memMsg(''); renderMembers(); $('.hnet-role-new', memWin.el).name.focus(); return; }
    const row = t.closest('.hnet-mem');
    if (row) {
      selected = row.dataset.uid; armed = ''; memMsg(''); renderMembers();
      // On a phone the card sits under the list: bring it into view.
      if (matchMedia('(max-width: 760px)').matches) $('.hnet-mem-card', memWin.el).scrollIntoView({block: 'nearest', behavior: motion.matches ? 'auto' : 'smooth'});
      return;
    }
    const swatch = t.closest('[data-color]'); if (swatch) { $('.hnet-role-new', memWin.el).color.value = swatch.dataset.color; return; }
    const p = selected && people().find(x => x.uid === selected);
    if (t.closest('[data-give]') && p) {
      const id = $('.hnet-card-admin select', memWin.el).value, r = await act(b => b.setRole(p.uid, id));
      memMsg(r === 'ok' ? (id ? 'Роль «' + roleDef(id)?.name + '» выдана: ' + p.nick : 'Роль убрана: ' + p.nick) : r, r === 'ok' ? 'ok' : 'err'); return;
    }
    if (t.closest('[data-remove]') && p) {
      if (armed !== 'rm:' + p.uid) { armed = 'rm:' + p.uid; memMsg('Нажми ещё раз: ' + p.nick + ' пропадёт из списка (вернётся, если снова зайдёт на сайт).', 'err'); return; }
      armed = ''; const r = await act(b => b.removeMember(p.uid)); if (r === 'ok') selected = null;
      memMsg(r === 'ok' ? 'Убран из списка: ' + p.nick : r, r === 'ok' ? 'ok' : 'err'); return;
    }
    const roleRow = t.closest('.hnet-role-row'); if (!roleRow) return;
    const roles = roleList(), at = roles.findIndex(r => r.id === roleRow.dataset.role), role = roles[at];
    if (!role) return;
    if (t.closest('[data-del]')) {
      if (armed !== 'del:' + role.id) { armed = 'del:' + role.id; memMsg('Нажми «Удалить» ещё раз: роль «' + role.name + '» снимется со всех.', 'err'); return; }
      armed = ''; const r = await act(b => b.deleteRole(role.id)); memMsg(r === 'ok' ? 'Роль удалена: ' + role.name : r, r === 'ok' ? 'ok' : 'err'); return;
    }
    const to = t.closest('[data-up]') ? at - 1 : t.closest('[data-down]') ? at + 1 : -1;
    if (to >= 0 && to < roles.length) { // move it one place and number them all 1, 2, 3…
      const order = [...roles]; order.splice(to, 0, ...order.splice(at, 1));
      const defs = Object.fromEntries(order.map(({id, ...def}, i) => [id, {...def, order: i + 1}]));
      const r = await act(b => b.saveRoles(defs));
      if (r !== 'ok') memMsg(r, 'err');
    }
  });
  memWin.el.addEventListener('change', async event => {
    const box = event.target.closest('[data-perm]'), roleRow = event.target.closest('.hnet-role-row'); if (!box || !roleRow) return;
    const role = roleList().find(r => r.id === roleRow.dataset.role); if (!role) return;
    const {id, ...def} = role, perms = {...(def.perms || {}), [box.dataset.perm]: box.checked};
    const r = await act(b => b.saveRoles({[id]: {...def, perms}}));
    memMsg(r === 'ok' ? 'Права роли «' + role.name + '» сохранены.' : r, r === 'ok' ? 'ok' : 'err');
  });
  $('.hnet-role-new', memWin.el).addEventListener('submit', async event => {
    event.preventDefault();
    const f = event.currentTarget, perms = {};
    for (const k of Object.keys(PERMS)) if (f['perm-' + k].checked) perms[k] = true;
    const r = await createRole(f.name.value, f.color.value, perms), ok = r.startsWith('Роль создана');
    memMsg(r, ok ? 'ok' : 'err');
    if (ok) { f.reset(); f.color.value = '#7fd8ff'; }
  });
  for (const type of ['members', 'online', 'roles', 'status']) on(type, renderMembers);

  async function createRole(name, color, perms = {}) {
    name = String(name || '').trim().slice(0, 20);
    if (!name) return 'Напиши название роли.';
    if (name.toLowerCase() === 'admin' || findRole(name)) return 'Роль «' + name + '» уже есть.';
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = PALETTE[roleList().length % PALETTE.length];
    const order = Math.max(0, ...roleList().map(r => r.order || 0)) + 1, id = 'r' + Date.now().toString(36);
    const r = await act(b => b.saveRoles({[id]: {name, color, order, perms}}));
    return r === 'ok' ? 'Роль создана: ' + name : r;
  }

  // ── Idea cards: a template for each kind of idea, a picture, a live preview, and the guest's own list ──
  // The guest picks a kind, fills its template (a new player gets a whole blank dossier with ratings and a
  // portrait), may attach a picture, and sends it. Only ADMIN reads ideas; the sender sees whether ADMIN has read
  // theirs and ADMIN's answer («Мои идеи»), and gets a message when an answer comes.
  const kindName = k => IDEA_TYPES[k]?.name || 'Другое';
  const SENT = 'hyperborea_ideas_sent_v1', DRAFT = 'hyperborea_idea_draft_v1', REPLIES = 'hyperborea_idea_replies_v1';
  const readJSON = (key, d) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? d; } catch { return d; } };
  const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } };
  const sentList = () => { const l = readJSON(SENT, []); return Array.isArray(l) ? l : []; };
  const loaded = readJSON(DRAFT, {}) || {};
  const draft = {kind: IDEA_TYPES[loaded.kind] ? loaded.kind : 'player', values: obj(loaded.values), stats: obj(loaded.stats)};
  let ideaImage = '', ideaTab = 'new', lastSent = 0, draftTimer = 0, myStatus = {};
  const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => writeJSON(DRAFT, draft), 400); };
  const statOf = key => Math.min(99, Math.max(1, Math.round(Number(draft.stats[key]) || 50)));

  const ideaWin = W.make('hnet-idea', `<form class="hwin-box hnet-idea-box" novalidate>
      <h2 class="hwin-bar">Идеи для HYPERBOREA</h2>
      <div class="hwin-body">
        <div class="hnet-tabs" role="tablist"><button type="button" role="tab" data-itab="new">[ Новая идея ]</button><button type="button" role="tab" data-itab="mine">[ Мои идеи ]</button></div>
        <div data-ipane="new">
          <div class="hnet-kinds" role="radiogroup" aria-label="О чём идея">${Object.entries(IDEA_TYPES).map(([k, t]) => `<button type="button" role="radio" data-kind="${k}"><b>${t.icon}</b> ${t.name}</button>`).join('')}</div>
          <p class="hwin-dim hnet-kind-hint"></p>
          <div class="hnet-idea-grid">
            <div class="hnet-idea-fields"></div>
            <aside class="hnet-idea-preview" aria-label="Как карточку увидит ADMIN"></aside>
          </div>
        </div>
        <div data-ipane="mine" hidden><div class="hnet-mine-list"></div></div>
        <p class="hwin-msg" role="status"></p>
      </div>
      <footer class="hwin-keys"><button type="submit" data-send>[ Отправить ADMIN ]</button><button type="button" data-clear>[ Очистить шаблон ]</button><span class="hwin-legend"></span><button type="button" data-close>[ Закрыть ]</button></footer>
    </form>`);
  const ideaForm = $('form', ideaWin.el), fieldsBox = $('.hnet-idea-fields', ideaWin.el), previewBox = $('.hnet-idea-preview', ideaWin.el);
  const ideaMsg = (text, kind = '') => { const m = $('.hwin-msg', ideaWin.el); m.textContent = text; m.className = 'hwin-msg' + (kind ? ' is-' + kind : ''); };
  const ideaFile = document.createElement('input'); ideaFile.type = 'file'; ideaFile.accept = 'image/*'; ideaFile.hidden = true; ideaForm.append(ideaFile);

  // A picture from the computer or the phone's gallery → at most 900 px on its longer side, under ~280 KB of text.
  async function readIdeaImage(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Это не картинка.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Не получилось открыть картинку.')); i.src = url; });
      for (const [side, q] of [[900, .82], [900, .66], [700, .6], [520, .55]]) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL('image/webp', q); if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', q);
        if (data.length <= 280000) return data;
      }
      throw new Error('Картинка слишком большая даже после уменьшения.');
    } finally { URL.revokeObjectURL(url); }
  }

  function field([key, label, type, hint, max]) {
    const vals = draft.values[draft.kind] ||= {}, row = document.createElement('label');
    row.className = 'hwin-row' + (type === 'textarea' ? ' hwin-row-top' : '');
    const span = document.createElement('span'); span.textContent = label;
    let input;
    if (type === 'select' || type === 'player') {
      input = document.createElement('select');
      const options = type === 'player' ? (window.HyperGuest?.players() || []) : hint;
      input.append(new Option(type === 'player' ? '— не важно —' : '—', ''), ...options.map(o => new Option(o, o)));
    } else if (type === 'textarea') { input = document.createElement('textarea'); input.rows = max > 400 ? 5 : 3; }
    else { input = document.createElement('input'); input.autocomplete = 'off'; if (type === 'number') input.inputMode = 'numeric'; }
    if (max) input.maxLength = max;
    if (typeof hint === 'string') input.placeholder = hint;
    input.name = 'f-' + key; input.dataset.field = key; input.value = vals[key] || '';
    if (key === IDEA_TYPES[draft.kind].title) row.classList.add('is-title');
    row.append(span, input);
    return row;
  }
  function renderIdeaForm() {
    const t = IDEA_TYPES[draft.kind];
    for (const b of ideaWin.el.querySelectorAll('[data-kind]')) { const on = b.dataset.kind === draft.kind; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); }
    $('.hnet-kind-hint', ideaWin.el).textContent = t.hint;
    fieldsBox.replaceChildren(...t.fields.map(field));
    if (t.stats) { // ratings, like the players' dossiers
      const box = document.createElement('fieldset'); box.className = 'hnet-stats-edit';
      box.innerHTML = '<legend>Рейтинги (1–99)</legend>' + t.stats.map(([k, label]) => `<label><span>${label}</span><input type="range" min="1" max="99" data-stat="${k}"><output></output></label>`).join('');
      for (const input of box.querySelectorAll('[data-stat]')) { input.value = String(statOf(input.dataset.stat)); input.nextElementSibling.textContent = input.value; }
      fieldsBox.append(box);
    }
    const pic = document.createElement('div'); pic.className = 'hwin-row hnet-idea-pic';
    pic.innerHTML = `<span>${t.image}</span><div><div class="hnet-pic-buttons"><button type="button" class="hwin-btn" data-pic>[ Загрузить картинку… ]</button><button type="button" class="hwin-btn" data-pic-drop>[ Убрать ]</button></div><small class="hwin-dim">С компьютера или из галереи телефона · уменьшится до 900 px</small></div>`;
    $('[data-pic-drop]', pic).disabled = !ideaImage;
    fieldsBox.append(pic);
    $('.hwin-legend', ideaWin.el).textContent = 'От: ' + (window.HyperGuest?.name() || 'guest');
    renderIdeaPreview();
  }
  // How ADMIN will see it — for a player, a little dossier.
  function renderIdeaPreview() {
    const t = IDEA_TYPES[draft.kind], v = draft.values[draft.kind] || {}, out = document.createElement('div');
    const photo = document.createElement('div'); photo.className = 'hnet-pv-photo';
    if (ideaImage) { const img = document.createElement('img'); img.src = ideaImage; img.alt = ''; photo.append(img); } else photo.textContent = t.icon;
    const line = (cls, text) => { if (!text) return; const p = document.createElement('p'); p.className = cls; p.textContent = text; out.append(p); };
    out.className = 'hnet-pv hnet-pv-' + draft.kind;
    line('hnet-pv-kind', t.name.toUpperCase());
    out.append(photo);
    if (draft.kind === 'player') {
      if (v.number) { const n = document.createElement('span'); n.className = 'hnet-pv-num'; n.textContent = '#' + v.number; photo.append(n); }
      line('hnet-pv-title', (v.name || 'Имя игрока').toUpperCase());
      line('hnet-pv-meta', [v.country, v.club, v.position].filter(Boolean).join(' · ') || 'страна · клуб · позиция');
      const stats = document.createElement('dl'); stats.className = 'hnet-pv-stats';
      let sum = 0;
      for (const [k, label] of t.stats) { const n = statOf(k); sum += n; stats.insertAdjacentHTML('beforeend', `<dt>${label}</dt><dd><i style="--v:${n}%"></i><b>${n}</b></dd>`); }
      out.append(stats);
      line('hnet-pv-ovr', 'ОБЩИЙ ' + Math.round(sum / t.stats.length));
      line('hnet-pv-line', v.move ? '★ ' + v.move : '');
      line('hnet-pv-line', v.strength ? '▲ ' + v.strength : '');
    } else {
      line('hnet-pv-title', v[t.title] || 'Заголовок');
      for (const [key, label] of t.fields) if (key !== t.title && v[key]) line('hnet-pv-line', label + ': ' + (v[key].length > 140 ? v[key].slice(0, 140) + '…' : v[key]));
    }
    previewBox.replaceChildren(out);
  }
  async function renderMine() {
    const box = $('.hnet-mine-list', ideaWin.el), list = sentList();
    if (!list.length) { box.innerHTML = '<p class="hwin-dim">Ты ещё не отправлял идей. Заполни шаблон во вкладке «Новая идея».</p>'; return; }
    const draw = () => box.replaceChildren(...list.map(s => {
      const st = myStatus[s.id], card = document.createElement('article'); card.className = 'hnet-mine';
      const status = !s.id ? 'отправлено' : !st ? 'проверяю…' : st.gone ? '✕ удалена ADMIN' : st.reply ? '↩ ADMIN ответил' : st.read ? '✓ ADMIN прочитал' : '● ждёт ADMIN';
      card.innerHTML = '<header><b></b><span class="hwin-dim"></span></header><p class="hnet-mine-status"></p>';
      $('b', card).textContent = '[' + kindName(s.kind) + '] ' + s.title;
      $('header span', card).textContent = fmt(s.at);
      $('.hnet-mine-status', card).textContent = status; $('.hnet-mine-status', card).classList.toggle('is-ok', !!(st?.read || st?.reply));
      if (st?.reply) { const r = document.createElement('p'); r.className = 'hnet-mine-reply'; r.textContent = st.reply; card.append(r); }
      return card;
    }));
    draw();
    await checkReplies(false); draw();
  }
  // ADMIN's answers to this guest's ideas: read on start and in «Мои идеи»; a new one pops up once.
  async function checkReplies(announce = true) {
    const b = backend; if (!b?.getIdea) return;
    const seenReplies = readJSON(REPLIES, {}) || {}, fresh = [];
    for (const s of sentList().filter(x => x.id).slice(0, 20)) {
      try {
        const v = await b.getIdea(s.id);
        myStatus[s.id] = v ? {read: v.read === true, reply: str(v.reply, 300)} : {gone: true};
        if (v?.reply && seenReplies[s.id] !== v.reply) fresh.push({...s, reply: str(v.reply, 300)});
      } catch { /* the server may not let this guest read it (an older idea) */ }
    }
    if (!fresh.length) return;
    for (const f of fresh) seenReplies[f.id] = f.reply;
    writeJSON(REPLIES, seenReplies);
    if (announce) whenFree(() => showMessage({title: 'ОТВЕТ ADMIN', text: fresh[0].reply, meta: 'На твою идею «' + fresh[0].title + '»' + (fresh.length > 1 ? ' · и ещё ответов: ' + (fresh.length - 1) : ''), alt: {label: 'Мои идеи', fn: () => openIdea(null, 'mine')}}), 10 * 60 * 1000);
  }
  function showIdeaTab(name) {
    ideaTab = name;
    for (const b of ideaWin.el.querySelectorAll('[data-itab]')) { const on = b.dataset.itab === name; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); }
    for (const p of ideaWin.el.querySelectorAll('[data-ipane]')) p.hidden = p.dataset.ipane !== name;
    $('[data-send]', ideaWin.el).hidden = $('[data-clear]', ideaWin.el).hidden = name !== 'new';
    $('[data-itab="mine"]', ideaWin.el).textContent = '[ Мои идеи' + (sentList().length ? ' · ' + sentList().length : '') + ' ]';
    if (name === 'mine') renderMine();
  }
  function openIdea(from, which = 'new') {
    start(); ideaMsg('');
    renderIdeaForm(); showIdeaTab(which);
    ideaWin.open(from, which === 'new' ? $('[data-kind].is-on', ideaWin.el) : $('[data-itab="mine"]', ideaWin.el));
  }
  ideaWin.el.addEventListener('click', event => {
    const t = event.target;
    const tab = t.closest('[data-itab]'); if (tab) { ideaMsg(''); showIdeaTab(tab.dataset.itab); return; }
    const kind = t.closest('[data-kind]'); if (kind) { draft.kind = kind.dataset.kind; saveDraft(); ideaMsg(''); renderIdeaForm(); kind.focus(); return; }
    if (t.closest('[data-pic]')) { ideaFile.click(); return; }
    if (t.closest('[data-pic-drop]')) { ideaImage = ''; renderIdeaForm(); return; }
    if (t.closest('[data-clear]')) { draft.values[draft.kind] = {}; if (draft.kind === 'player') draft.stats = {}; ideaImage = ''; saveDraft(); renderIdeaForm(); ideaMsg('Шаблон очищен.'); return; }
    if (t.closest('[data-close]')) ideaWin.close();
  });
  // Arrows move between the kinds, like radio buttons.
  $('.hnet-kinds', ideaWin.el).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const all = [...event.currentTarget.children], at = all.indexOf(document.activeElement), step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    all[(at + step + all.length) % all.length]?.click();
  });
  ideaForm.addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.field) { (draft.values[draft.kind] ||= {})[el.dataset.field] = el.value; }
    else if (el.dataset.stat) { draft.stats[el.dataset.stat] = Number(el.value); el.nextElementSibling.textContent = el.value; }
    else return;
    saveDraft(); renderIdeaPreview();
  });
  ideaFile.addEventListener('change', async () => {
    const picked = ideaFile.files?.[0]; ideaFile.value = ''; if (!picked) return;
    ideaMsg('Обработка картинки…');
    try { ideaImage = await readIdeaImage(picked); renderIdeaForm(); ideaMsg('Картинка добавлена (' + Math.round(ideaImage.length * .75 / 1024) + ' КБ).', 'ok'); }
    catch (error) { ideaMsg(error.message || 'Не получилось открыть картинку.', 'err'); }
  });
  ideaForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (ideaForm.dataset.busy || ideaTab !== 'new') return;
    const kind = draft.kind, t = IDEA_TYPES[kind], raw = draft.values[kind] || {}, fields = {};
    for (const [key, , , , max] of t.fields) { const v = String(raw[key] || '').trim(); if (v) fields[key] = v.slice(0, Math.min(max || 600, 600)); }
    const title = (fields[t.title] || '').slice(0, 60);
    const focus = key => ideaForm.querySelector('[data-field="' + key + '"]')?.focus();
    if (title.length < 3) { ideaMsg('Заполни поле «' + t.fields.find(f => f[0] === t.title)[1] + '» — хотя бы пару слов.', 'err'); focus(t.title); return; }
    const rest = t.fields.filter(f => f[0] !== t.title && fields[f[0]]);
    if (rest.map(f => fields[f[0]]).join('').length < 10 && !(t.stats && ideaImage)) { ideaMsg('Заполни ещё хотя бы одно поле шаблона — чтобы ADMIN понял идею.', 'err'); focus(t.fields.find(f => f[0] !== t.title)?.[0]); return; }
    if (Date.now() - lastSent < 60000) { ideaMsg('Следующую идею можно отправить через минуту.', 'err'); return; }
    if (!backend) { ideaMsg(offlineText() + ' Идея не отправлена — шаблон сохранён.', 'err'); return; }
    const text = (rest.map(([key, label]) => label + ': ' + fields[key]).join('\n') || title).slice(0, 1500);
    const idea = {nick: window.HyperGuest?.name() || 'guest', kind, title, text, fields};
    if (t.stats) idea.stats = Object.fromEntries(t.stats.map(([k]) => [k, statOf(k)]));
    if (ideaImage) idea.img = true;
    ideaForm.dataset.busy = '1'; ideaMsg('Отправка…');
    try {
      const id = await backend.sendIdea(idea, ideaImage);
      lastSent = Date.now();
      writeJSON(SENT, [{id, title, kind, at: Date.now()}, ...sentList()].slice(0, 30));
      draft.values[kind] = {}; if (t.stats) draft.stats = {}; ideaImage = ''; writeJSON(DRAFT, draft);
      renderIdeaForm(); showIdeaTab('new');
      ideaMsg('Идея «' + title + '» отправлена ADMIN. Ответ появится во вкладке «Мои идеи».', 'ok'); emit('idea-sent', title);
    } catch (error) {
      console.warn('Idea:', error?.code || error);
      ideaMsg(/permission/i.test(String(error?.code || error)) ? 'Сервер не принял: подожди минуту и попробуй снова.' : 'Не получилось отправить. Попробуй ещё раз.', 'err');
    } finally { delete ideaForm.dataset.busy; }
  });

  // ── ADMIN's inbox ─────────────────────────────────────────────────────────
  const inboxWin = W.make('hnet-inbox', `<div class="hwin-box hwin-wide hnet-inbox-box">
      <h2 class="hwin-bar">Идеи от гостей</h2>
      <div class="hwin-body"><p class="hwin-dim hnet-inbox-meta"></p><div class="hnet-inbox-list"></div><p class="hwin-msg" role="status"></p></div>
      <footer class="hwin-keys"><span class="hwin-legend">Видишь только ты · новые сверху · ответ увидит автор</span><button type="button" data-close>[ Закрыть ]</button></footer>
    </div>`);
  let armedDelete = null, replyingTo = null;
  const ideaImages = new Map();
  function ideaBody(i, card) {
    const t = IDEA_TYPES[i.kind] || IDEA_TYPES.other, f = i.fields || {};
    const add = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; card.append(p); return p; };
    if (i.img) { // the picture comes separately, only when shown
      const fig = document.createElement('figure'); fig.className = 'hnet-idea-img'; fig.textContent = 'картинка загружается…'; card.append(fig);
      let pending = ideaImages.get(i.id);
      if (!pending) { pending = backend?.getIdeaImage ? backend.getIdeaImage(i.id).catch(() => '') : Promise.resolve(''); ideaImages.set(i.id, pending); }
      pending.then(url => { if (!fig.isConnected) return; if (!url) { fig.textContent = 'картинку не удалось загрузить'; return; } const img = document.createElement('img'); img.src = url; img.alt = 'Картинка к идее «' + i.title + '»'; fig.replaceChildren(img); });
    }
    if (!Object.keys(f).length) { add('hnet-idea-text', i.text); return; } // an idea from the older, plain card
    if (i.kind === 'player') {
      add('hnet-idea-meta', [f.country, f.club, f.position, f.number && '#' + f.number, f.age && f.age + ' лет'].filter(Boolean).join(' · '));
      if (t.stats && i.stats) {
        const dl = document.createElement('dl'); dl.className = 'hnet-pv-stats';
        for (const [k, label] of t.stats) { const n = Math.min(99, Math.max(1, Number(i.stats[k]) || 0)); dl.insertAdjacentHTML('beforeend', `<dt>${label}</dt><dd><i style="--v:${n}%"></i><b>${n}</b></dd>`); }
        card.append(dl);
      }
    }
    const skip = new Set([t.title, ...(i.kind === 'player' ? ['country', 'club', 'position', 'number', 'age'] : [])]);
    const dl = document.createElement('dl'); dl.className = 'hnet-idea-fields-view';
    for (const [key, label] of t.fields) if (!skip.has(key) && f[key]) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = f[key]; dl.append(dt, dd); }
    if (dl.childElementCount) card.append(dl);
  }
  function renderInbox() {
    if (inboxWin.el.hidden) return;
    const meta = $('.hnet-inbox-meta', inboxWin.el), box = $('.hnet-inbox-list', inboxWin.el);
    if (!isAdmin()) { meta.textContent = 'Входящие идеи видит только ADMIN, вошедший через сервер.'; box.replaceChildren(); return; }
    const list = net.ideas || [];
    meta.textContent = list.length ? 'Всего: ' + list.length + ' · новых: ' + list.filter(i => !i.read).length : 'Пока идей нет.';
    const focused = document.activeElement?.closest?.('.hnet-idea')?.dataset.id, typing = replyingTo && $('.hnet-reply-edit textarea', inboxWin.el)?.value;
    box.replaceChildren(...list.map(i => {
      const card = document.createElement('article'); card.className = 'hnet-idea hnet-idea-' + (IDEA_TYPES[i.kind] ? i.kind : 'other') + (i.read ? '' : ' is-new'); card.dataset.id = i.id;
      card.innerHTML = '<header><b></b><span class="hwin-dim"></span></header>';
      $('b', card).textContent = (i.read ? '' : '● ') + (IDEA_TYPES[i.kind]?.icon || '✎') + ' [' + kindName(i.kind) + '] ' + i.title;
      $('header span', card).textContent = i.nick + ' · ' + fmt(i.at);
      ideaBody(i, card);
      if (i.fav) { const p = document.createElement('p'); p.className = 'hwin-dim'; p.textContent = 'Про игрока: ' + i.fav; card.append(p); }
      if (i.reply) { const p = document.createElement('p'); p.className = 'hnet-idea-reply'; p.textContent = '↩ Твой ответ: ' + i.reply; card.append(p); }
      if (replyingTo === i.id) {
        const edit = document.createElement('div'); edit.className = 'hnet-reply-edit';
        edit.innerHTML = '<textarea maxlength="300" rows="3" placeholder="Ответ автору идеи (до 300 знаков)"></textarea><div><button type="button" class="hwin-btn" data-reply-send>[ Отправить ответ ]</button><button type="button" class="hwin-btn" data-reply-cancel>[ Отмена ]</button></div>';
        $('textarea', edit).value = typing ?? i.reply ?? ''; card.append(edit);
      }
      const actions = document.createElement('div'); actions.className = 'hnet-idea-actions';
      actions.innerHTML = '<button type="button" class="hwin-btn" data-read></button><button type="button" class="hwin-btn" data-reply>[ Ответить ]</button><button type="button" class="hwin-btn" data-del>[ Удалить ]</button>';
      $('[data-read]', actions).textContent = i.read ? '[ Отметить новой ]' : '[ Прочитано ]';
      card.append(actions);
      return card;
    }));
    if (replyingTo) $('.hnet-reply-edit textarea', inboxWin.el)?.focus({preventScroll: true});
    else if (focused) box.querySelector('[data-id="' + CSS.escape(focused) + '"] [data-read]')?.focus({preventScroll: true});
  }
  function openInbox(from) { start(); armedDelete = null; replyingTo = null; inboxWin.open(from, $('[data-close]', inboxWin.el)); renderInbox(); }
  $('[data-close]', inboxWin.el).addEventListener('click', () => inboxWin.close());
  $('.hnet-inbox-list', inboxWin.el).addEventListener('click', async event => {
    const button = event.target.closest('button'), card = event.target.closest('.hnet-idea'); if (!button || !card) return;
    const id = card.dataset.id, idea = (net.ideas || []).find(i => i.id === id), say = $('.hwin-msg', inboxWin.el);
    if (button.matches('[data-read]')) { const r = await act(b => b.markIdea(id, !idea?.read)); if (r !== 'ok') say.textContent = r; return; }
    if (button.matches('[data-reply]')) { replyingTo = id; say.textContent = ''; renderInbox(); return; }
    if (button.matches('[data-reply-cancel]')) { replyingTo = null; renderInbox(); return; }
    if (button.matches('[data-reply-send]')) {
      const text = $('.hnet-reply-edit textarea', card).value.trim().slice(0, 300);
      const r = await act(b => b.replyIdea(id, text));
      if (r === 'ok') { replyingTo = null; say.textContent = text ? 'Ответ отправлен: ' + idea?.nick + ' увидит его в «Мои идеи».' : 'Ответ убран.'; renderInbox(); }
      else say.textContent = r;
      return;
    }
    if (armedDelete !== id) { armedDelete = id; button.textContent = '[ Точно удалить? ]'; return; }
    armedDelete = null; const r = await act(b => b.deleteIdea(id)); say.textContent = r === 'ok' ? 'Удалено.' : r;
  });
  on('ideas', renderInbox);

  // ── ADMIN and roles' rights ───────────────────────────────────────────────
  async function adminSignIn(name, pass) {
    const login = String(name || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,32}$/.test(login) || !pass) return 'wrong';
    const b = await timeout(start(), 12000);
    if (!b) return net.status === 'error' ? 'error' : 'offline';
    const result = await timeout(b.adminSignIn(login + '@' + (cfg.adminEmailDomain || 'example.com'), pass), 15000) || 'offline';
    if (result === 'ok') publishProfile();
    return result;
  }
  // An action on the server: 'ok', or what went wrong in a few words. `perm` lets a role with that right do it too;
  // without it, only ADMIN may.
  async function act(fn, perm) {
    if (!cfg.firebase) return 'Сервер HYPERBOREA NET не подключён (hyper-net-config.js).';
    if (!backend) return 'Нет связи с сервером.';
    if (!backend.isAdmin && !(perm && can(perm))) return perm ? 'Нет прав: нужна роль с правом «' + PERMS[perm] + '».' : 'Нужен вход ADMIN через сервер (logout → ADMIN).';
    try { await fn(backend); return 'ok'; }
    catch (error) {
      const code = String(error?.code || error?.message || error);
      console.warn('HYPERBOREA NET action:', code);
      return /permission/i.test(code) ? (backend.isAdmin ? 'Сервер отказал в доступе: проверь правила базы (UID админа).' : 'Сервер отказал: у твоей роли нет этого права.') : 'Ошибка сервера: ' + code;
    }
  }
  const myNick = () => window.HyperGuest?.name() || 'guest';

  window.HyperNet = {
    EVENTS, STATUS, PERMS, IDEA_TYPES, IDEA_KINDS: IDEA_TYPES,
    get configured() { return !!cfg.firebase; },
    get status() { return net.status; },
    get statusText() { return STATUS[net.status] || net.status; },
    get online() { return net.online; },
    get count() { return net.online.length; },
    get people() { return people(); },
    get roleList() { return roleList(); },
    get myRole() { return backend ? roleOf(selfUid()) : null; },
    get poll() { return net.poll; },
    get results() { return net.results; },
    get ideas() { return net.ideas; },
    get isAdmin() { return isAdmin(); },
    can, on, start, vote, openPoll, adminSignIn,
    async adminSignOut() { if (!backend) return; await backend.adminSignOut(); publishProfile(); },
    say: text => act(b => b.say(text, b.isAdmin ? '' : myNick()), 'say'),
    fire: name => act(b => b.fire(name), 'event'),
    openNewPoll: (q, options) => act(b => b.openPoll(q, options), 'poll'),
    closePoll: () => act(b => b.closePoll(), 'poll'),
    openMembers, openOnline: openMembers, openIdea, openInbox,
    findMember, findRole, createRole,
    async giveRole(nick, roleName) {
      const p = findMember(nick); if (!p) return 'Нет участника с ником «' + nick + '». Список — команда members.';
      const r = findRole(roleName); if (!r) return 'Нет роли «' + roleName + '». Список — команда roles.';
      const res = await act(b => b.setRole(p.uid, r.id)); return res === 'ok' ? 'Роль «' + r.name + '» выдана: ' + p.nick : res;
    },
    async takeRole(nick) {
      const p = findMember(nick); if (!p) return 'Нет участника с ником «' + nick + '».';
      const res = await act(b => b.setRole(p.uid, null)); return res === 'ok' ? 'Роль убрана: ' + p.nick : res;
    },
    async deleteRole(name) {
      const r = findRole(name); if (!r) return 'Нет роли «' + name + '».';
      const res = await act(b => b.deleteRole(r.id)); return res === 'ok' ? 'Роль удалена: ' + r.name : res;
    },
    // For trying things out on one screen (and for tests): an event or a message right here, no server involved.
    local: {event: runEvent, message: text => showBroadcast({id: rid(), text, at: Date.now()})},
    // Tests: put a stand-in for Firebase in place (same methods as firebaseBackend returns) and feed it via sink.
    _useBackend(fake) { faked = true; backend = fake; starting = Promise.resolve(fake); cfg.firebase ||= {test: true}; publishProfile(); return pageSink; }
  };
  start();
})();
