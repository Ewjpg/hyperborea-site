// HYPERBOREA OS: the way into the terminal, like switching on an old computer (styles in hyper-os.css).
//  1. Power: the PC's own sound (assets/pc-hum.mp3) starts on a black screen — the switch, the relays, the fan.
//     After 2 s the picture comes on; the clicks never repeat, only the hum of the old computer loops on and on
//     (mixer channel «Шум компьютера»). A browser that blocks sound first asks for any key.
//  2. Splash: four lights swirl together into the Blue Lock mark, «Запуск HYPERBOREA».
//  3. Boot menu: choose a profile, Гость or ADMIN, like the "advanced boot options" screen. ADMIN asks for a
//     name and password, checked by the HYPERBOREA NET server (hyper-net.js).
//  4. Then the usual way in — connection, AZURE LATCH, ENTER SYSTEM, the BIOS lines — restyled as a command line,
//     and the main menu as a BIOS setup screen with a console at the bottom.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const sound = window.HyperboreaSound;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, el = document) => el.querySelector(s);
  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const VERSION = '2.1';
  // ADMIN's password is checked by HYPERBOREA NET (Firebase) and kept nowhere on the site. Only for offline tests,
  // window.HYPER_OS_AUTH may hold a PBKDF2-SHA256 hash of name + "\0" + password (read at check time).

  // ── The old computer's sound ──────────────────────────────────────────────
  // Played once from the start (switch, relays, fan spinning up), then 6 s…52.4 s of plain hum loops forever;
  // the loop's end is crossfaded into its start so there is no click at the seam.
  const HUM = './assets/pc-hum.mp3?v=1', LOOP_FROM = 6, LOOP_TO = 52.4, FADE = 2;
  let ctx = null, out = null, humReady = null, humSource = null;
  const level = () => sound ? sound.factor('pc', 'hum') : .5;
  function audio() {
    if (ctx) return ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); out = ctx.createGain(); out.gain.value = level(); out.connect(ctx.destination);
    sound?.subscribe(ch => { if ((ch === 'pc' || ch === 'master') && out) out.gain.setTargetAtTime(level(), ctx.currentTime, .1); });
    return ctx;
  }
  function buildHum() {
    if (humReady) return humReady;
    humReady = fetch(HUM).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data)).then(src => {
      const sr = src.sampleRate, A = Math.round(LOOP_FROM * sr), B = Math.min(Math.round(LOOP_TO * sr), src.length), F = Math.round(FADE * sr), L = B - A;
      const total = A + F + (L - 2 * F) + F, buffer = ctx.createBuffer(src.numberOfChannels, total, sr);
      for (let c = 0; c < src.numberOfChannels; c++) {
        const s = src.getChannelData(c), o = buffer.getChannelData(c);
        o.set(s.subarray(0, A + F));
        o.set(s.subarray(A + F, A + L - F), A + F);
        for (let j = 0, at = A + L - F; j < F; j++) { const t = j / F * Math.PI / 2; o[at + j] = s[A + L - F + j] * Math.cos(t) + s[A + j] * Math.sin(t); }
      }
      return {buffer, loopStart: (A + F) / sr};
    }).catch(error => { console.warn('PC hum:', error); return null; });
    return humReady;
  }
  async function startHum() {
    if (humSource || !audio()) return;
    const hum = await buildHum(); if (!hum || humSource) return;
    humSource = ctx.createBufferSource(); humSource.buffer = hum.buffer; humSource.loop = true;
    humSource.loopStart = hum.loopStart; humSource.loopEnd = hum.buffer.duration;
    humSource.connect(out); humSource.start();
  }
  document.addEventListener('visibilitychange', () => { if (!ctx || !humSource) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
  function beep(freq = 880, dur = .08, vol = .05, type = 'square') {
    if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime, k = sound ? sound.factor('terminal', 'fx') / 3.4 : .4;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol * k, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
  }

  // ── The overlay: power gate, splash, boot menu ───────────────────────────
  const os = document.createElement('section');
  os.className = 'hos'; os.dataset.state = 'dark'; os.setAttribute('aria-label', 'Запуск HYPERBOREA OS');
  os.innerHTML = `<button type="button" class="hos-gate" hidden><span class="hos-gate-icon" aria-hidden="true">⏻</span><span>Нажмите любую клавишу, чтобы включить компьютер</span></button>
    <div class="hos-splash" hidden><canvas aria-hidden="true"></canvas><p class="hos-starting">Запуск HYPERBOREA</p><small>© Blue Lock Systems, 2026</small></div>
    <div class="hos-menu" hidden role="dialog" aria-labelledby="hosMenuTitle">
      <h2 class="hos-bar" id="hosMenuTitle">Выбор профиля HYPERBOREA</h2>
      <p>Выберите профиль для входа в систему:</p>
      <p class="hos-dim">(Используйте клавиши со стрелками ↑ и ↓, чтобы выделить нужный вариант.)</p>
      <div class="hos-list" role="listbox" aria-label="Профили">
        <button type="button" role="option" data-profile="guest">Гость</button>
        <button type="button" role="option" data-profile="admin">ADMIN</button>
      </div>
      <form class="hos-login" hidden autocomplete="off">
        <p class="hos-login-title">Вход администратора</p>
        <label><span>Имя пользователя:</span><input name="user" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <label><span>Пароль:</span><input name="pass" type="password" autocomplete="off"></label>
        <p class="hos-login-msg" role="status"></p>
      </form>
      <p class="hos-desc"></p>
      <p class="hos-timer"></p>
      <footer class="hos-keys"><span data-keys>ВВОД=Выбрать</span><span data-keys-right></span></footer>
    </div>`;
  screen.append(os);
  const gate = $('.hos-gate', os), splashEl = $('.hos-splash', os), menu = $('.hos-menu', os), list = $('.hos-list', os);
  const login = $('.hos-login', os), msg = $('.hos-login-msg', os), desc = $('.hos-desc', os), timerEl = $('.hos-timer', os);
  const show = state => {
    os.dataset.state = state;
    gate.hidden = state !== 'gate'; splashEl.hidden = state !== 'splash'; menu.hidden = state !== 'menu';
  };

  // 1. Power.
  let powered = false, powerTimer = 0, splashAbort = null, skipped = false; // skipped: HyperOS.boot() went straight in
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function powerOn() {
    if (powered) return; powered = true;
    show('dark');
    if (audio()) { try { await Promise.race([ctx.resume(), wait(300)]); } catch {} await Promise.race([startHum(), wait(1500)]); }
    if (skipped || os.dataset.state !== 'dark') return;
    // The screen stays dark while the switch clicks and the fan spins up.
    powerTimer = setTimeout(() => { if (skipped) return; window.CrtPower?.(); splash(openMenu); }, motion.matches ? 200 : 2000);
  }
  async function boot() {
    if (!audio()) { powerOn(); return; }
    buildHum();
    if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 250))]); } catch {} }
    if (ctx.state === 'running') { powerOn(); return; }
    // The browser wants a key press before any sound.
    show('gate'); gate.focus({preventScroll: true});
    const go = () => { removeEventListener('keydown', go, true); gate.removeEventListener('click', go); powerOn(); };
    addEventListener('keydown', go, true); gate.addEventListener('click', go);
  }

  // 2. Splash: four lights spiral in and meet, the mark lights up and breathes.
  let splashDone = null;
  function splash(done) {
    show('splash');
    const canvas = $('canvas', splashEl), g = canvas.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    const mark = new Image(); mark.src = './assets/bluelock-mark.svg';
    let tinted = null;
    const tint = () => { // The navy mark recoloured to light so it can glow on black.
      const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
      x.drawImage(mark, 0, 0, 512, 512); x.globalCompositeOperation = 'source-in';
      const grad = x.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#7fc0ff');
      x.fillStyle = grad; x.fillRect(0, 0, 512, 512); tinted = c;
    };
    mark.onload = tint;
    let W = 0, H = 0;
    const size = () => { W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; };
    size(); addEventListener('resize', size);
    const ORBS = [['47,140,255', .2, 1], ['127,224,255', 1.8, 1], ['170,150,255', 3.3, 1], ['255,255,255', 4.8, 1]];
    const MEET = 2.5, END = motion.matches ? .8 : 6.2, t0 = performance.now();
    let raf = 0, finished = false;
    splashAbort = () => { finished = true; cancelAnimationFrame(raf); removeEventListener('resize', size); splashDone = null; splashAbort = null; };
    const finish = () => {
      if (finished) return; finished = true; cancelAnimationFrame(raf); removeEventListener('resize', size); splashDone = null;
      splashEl.animate?.([{opacity: 1}, {opacity: 0}], {duration: 400}).finished.then(() => done(), () => done());
      if (!splashEl.animate) done();
    };
    splashDone = finish;
    function frame(now) {
      const t = (now - t0) / 1000, cx = W / 2, cy = H * .42, R = Math.min(W, H) * .45, S = Math.min(W, H) * .2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.shadowBlur = 0;
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      if (t < MEET + .25) {
        const k = Math.min(1, t / MEET), e = 1 - Math.pow(1 - k, 2.4);
        for (const [c, a0, dir] of ORBS) {
          const ang = a0 + e * 5.4 * dir, r = R * (1 - e), x = cx + Math.cos(ang) * r * 1.3, y = cy + Math.sin(ang) * r * .8;
          const rad = 14 + 34 * (1 - e) + 6 * Math.sin(t * 9 + a0), grad = g.createRadialGradient(x, y, 0, x, y, rad);
          grad.addColorStop(0, `rgba(${c},1)`); grad.addColorStop(.25, `rgba(${c},.55)`); grad.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = grad; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }
      }
      if (t >= MEET - .3 && t < MEET + .8) { // The flash where they meet.
        const f = 1 - Math.abs(t - MEET) / .8, grad = g.createRadialGradient(cx, cy, 0, cx, cy, S * 1.6);
        grad.addColorStop(0, `rgba(200,230,255,${.55 * f})`); grad.addColorStop(1, 'rgba(47,140,255,0)');
        g.fillStyle = grad; g.fillRect(cx - S * 2, cy - S * 2, S * 4, S * 4);
      }
      if (tinted && t > MEET - .25) {
        const k = Math.min(1, (t - MEET + .25) / .9), breathe = t > MEET + 1 ? .7 + .3 * Math.sin((t - MEET - 1) * 2.2) : 1, s = S * (.86 + .14 * k);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = k;
        g.shadowColor = '#2f8cff'; g.shadowBlur = 46 * breathe;
        g.drawImage(tinted, cx - s / 2, cy - s / 2, s, s);
      }
      if (t < END) raf = requestAnimationFrame(frame); else finish();
    }
    raf = requestAnimationFrame(frame);
  }

  // 3. Boot menu.
  const DESCRIPTIONS = {
    guest: 'Описание: Обычный вход. Досье игроков, лор, тактика и VERSUS.',
    admin: 'Описание: Вход для администратора системы. Требуются имя пользователя и пароль.'
  };
  const LAST = 'hyperborea_profile_last_v1';
  let profile = null, selected = 0, countdown = 0, countTimer = 0, onChosen = null, lockedUntil = 0, failures = 0;
  const options = () => [...list.querySelectorAll('[data-profile]')];
  function highlight(i) {
    selected = (i + options().length) % options().length;
    options().forEach((b, n) => { b.setAttribute('aria-selected', String(n === selected)); b.classList.toggle('is-on', n === selected); });
    desc.textContent = DESCRIPTIONS[options()[selected].dataset.profile];
  }
  function stopTimer() { clearInterval(countTimer); countTimer = 0; timerEl.textContent = ''; }
  function openMenu(done) {
    onChosen = typeof done === 'function' ? done : finishBoot;
    show('menu'); login.hidden = true; list.hidden = false; msg.textContent = '';
    $('[data-keys]', os).textContent = 'ВВОД=Выбрать'; $('[data-keys-right]', os).textContent = '';
    const nick = window.HyperGuest?.nick; $('[data-profile="guest"]', list).textContent = nick ? 'Гость (' + nick + ')' : 'Гость';
    let last = 'guest'; try { last = localStorage.getItem(LAST) || 'guest'; } catch {}
    highlight(Math.max(0, options().findIndex(b => b.dataset.profile === last)));
    // Like a boot menu: without a key press the default profile starts by itself.
    stopTimer(); countdown = 20;
    const tick = () => { timerEl.textContent = 'Вход с профилем «Гость» автоматически через: ' + countdown + ' с'; if (countdown-- <= 0) { stopTimer(); choose('guest'); } };
    tick(); countTimer = setInterval(tick, 1000);
    options()[selected].focus({preventScroll: true});
  }
  function choose(name) {
    stopTimer();
    if (name === 'admin') { showLogin(); return; }
    done('guest');
  }
  function done(name) {
    profile = name;
    try { localStorage.setItem(LAST, name); } catch {}
    document.documentElement.dataset.profile = name;
    beep(name === 'admin' ? 1046 : 784, .12, .06, 'triangle');
    const next = onChosen; onChosen = null;
    os.animate?.([{opacity: 1}, {opacity: 0}], {duration: motion.matches ? 1 : 450}).finished.then(() => { show('off'); next?.(name); }, () => { show('off'); next?.(name); });
    if (!os.animate) { show('off'); next?.(name); }
    applyProfile();
  }
  function showLogin() {
    list.hidden = true; login.hidden = false; msg.textContent = ''; desc.textContent = DESCRIPTIONS.admin;
    $('[data-keys]', os).textContent = 'ВВОД=Войти'; $('[data-keys-right]', os).textContent = 'ESC=Назад';
    login.reset(); login.user.focus({preventScroll: true});
  }
  function backToList() { login.hidden = true; list.hidden = false; $('[data-keys]', os).textContent = 'ВВОД=Выбрать'; $('[data-keys-right]', os).textContent = ''; highlight(selected); options()[selected].focus({preventScroll: true}); }
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function check(name, pass) {
    const cfg = window.HYPER_OS_AUTH;
    if (!cfg || !crypto?.subtle) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(name + '\u0000' + pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', salt: b64(cfg.salt), iterations: cfg.iter, hash: 'SHA-256'}, key, 256));
    const want = b64(cfg.hash); let diff = bits.length ^ want.length;
    for (let i = 0; i < Math.min(bits.length, want.length); i++) diff |= bits[i] ^ want[i];
    return diff === 0;
  }
  login.addEventListener('submit', async event => {
    event.preventDefault();
    if (login.dataset.busy) return;
    if (Date.now() < lockedUntil) { msg.textContent = 'Вход заблокирован. Подождите ' + Math.ceil((lockedUntil - Date.now()) / 1000) + ' с.'; return; }
    const name = login.user.value, pass = login.pass.value;
    if (!name || !pass) { msg.textContent = 'Введите имя пользователя и пароль.'; return; }
    login.dataset.busy = '1'; msg.textContent = 'Проверка…';
    // With HYPERBOREA NET set up, the password is checked by the server (Firebase) and never kept on the site;
    // without it, against the local hash above.
    let result = 'wrong';
    try { result = window.HyperNet?.configured ? await window.HyperNet.adminSignIn(name, pass) : !window.HYPER_OS_AUTH ? 'offline' : (await check(name, pass)) ? 'ok' : 'wrong'; }
    catch (error) { console.warn('Login:', error); }
    delete login.dataset.busy; login.pass.value = '';
    if (result === 'ok') { failures = 0; msg.textContent = 'Доступ разрешён.'; setTimeout(() => done('admin'), 350); return; }
    if (result !== 'wrong') {
      beep(196, .3, .07);
      msg.textContent = result === 'locked' ? 'Сервер временно закрыл вход после многих попыток. Попробуйте позже.'
        : result === 'offline' ? 'Нет связи с сервером HYPERBOREA NET. Вход ADMIN сейчас недоступен.' : 'Ошибка сервера HYPERBOREA NET. Попробуйте позже.';
      return;
    }
    failures++; beep(196, .3, .07);
    if (!motion.matches) login.animate?.([{translate: '0 0'}, {translate: '-8px 0'}, {translate: '6px 0'}, {translate: '0 0'}], {duration: 260});
    if (failures >= 3) { failures = 0; lockedUntil = Date.now() + 30000; msg.textContent = 'Слишком много попыток. Вход заблокирован на 30 с.'; setTimeout(() => { if (!login.hidden) backToList(); }, 1600); return; }
    msg.textContent = 'Неверное имя пользователя или пароль. Осталось попыток: ' + (3 - failures) + '.';
    login.pass.focus({preventScroll: true});
  });
  list.addEventListener('click', event => { const b = event.target.closest('[data-profile]'); if (!b) return; highlight(options().indexOf(b)); choose(b.dataset.profile); });
  list.addEventListener('pointermove', event => { const b = event.target.closest('[data-profile]'); if (b && !b.classList.contains('is-on')) highlight(options().indexOf(b)); });
  // Keys while the overlay is up: skip the splash, move through the menu, leave the login.
  addEventListener('keydown', event => {
    const state = os.dataset.state;
    if (state === 'splash') { if (splashDone && !event.repeat) { event.preventDefault(); splashDone(); } return; }
    if (state !== 'menu') { if (state === 'dark' || state === 'gate') event.preventDefault?.(); return; }
    stopTimer();
    if (!login.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); backToList(); }
      // Enter sends the form from either field, even where a browser skips implicit submission (the game's terminal).
      else if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); login.requestSubmit(); }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); beep(660, .03, .03); highlight(selected + (event.key === 'ArrowDown' ? 1 : -1)); options()[selected].focus({preventScroll: true}); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(options()[selected].dataset.profile); }
    event.stopImmediatePropagation();
  }, true);
  os.addEventListener('pointerdown', () => { if (os.dataset.state === 'splash') splashDone?.(); else if (os.dataset.state === 'menu') stopTimer(); });

  // ── After the profile: the old way in, restyled ───────────────────────────
  const connection = document.getElementById('connection'), landing = document.getElementById('landing');
  const enter = document.getElementById('enter'), userEl = document.getElementById('userId'), visitor = userEl?.textContent || '';
  // The guest's nick (hyper-guest.js) becomes the prompt: nick@hyperborea:~$
  const guestName = () => window.HyperGuest?.name() || 'guest';
  const prompt = () => profile === 'admin' ? 'admin@hyperborea:~#' : guestName() + '@hyperborea:~$';
  const profileName = () => profile === 'admin' ? 'ADMIN' : 'ГОСТЬ';
  // HYPERBOREA NET (hyper-net.js): one line about the connection and how many terminals are on.
  function netLine() {
    const net = window.HyperNet;
    if (!net) return 'Сеть: —';
    return net.status === 'online' ? 'Сеть: в сети · онлайн: ' + net.count : 'Сеть: ' + net.statusText;
  }
  function renderNet() {
    for (const el of document.querySelectorAll('[data-hos-net]')) el.textContent = netLine();
    const row = document.getElementById('openPoll'), p = window.HyperNet?.poll;
    if (row) row.querySelector('.db-card-description').textContent = p?.open ? 'Идёт опрос: ' + p.q : 'Голосование для всех';
    const people = document.getElementById('openMembers'), net = window.HyperNet;
    if (people) people.querySelector('.db-card-description').textContent = net?.status === 'online' ? 'В сети: ' + net.count + ' · всего: ' + net.people.length : 'Все гости и их роли';
    const idea = document.getElementById('openIdea');
    if (idea) {
      idea.querySelector('.db-card-name').textContent = profile === 'admin' ? 'ИДЕИ' : 'ИДЕЯ';
      const fresh = (net?.ideas || []).filter(i => !i.read).length;
      idea.querySelector('.db-card-description').textContent = profile === 'admin' ? (net?.ideas ? 'Входящие: ' + net.ideas.length + (fresh ? ' · новых: ' + fresh : '') : 'Входящие идеи гостей') : 'Отправить идею ADMIN';
    }
  }
  function applyProfile() {
    if (userEl) userEl.textContent = profile === 'admin' ? 'ADMIN' : 'GUEST ' + (window.HyperGuest?.nick || visitor);
    if (connection) connection.dataset.profile = 'ВХОД С ПРОФИЛЕМ: ' + profileName();
    for (const el of document.querySelectorAll('[data-hos-prompt]')) el.textContent = prompt();
    for (const el of document.querySelectorAll('[data-hos-profile]')) el.textContent = profileName();
    renderHelp(); renderNet();
  }
  function finishBoot() { document.getElementById('connectStart')?.click(); }
  // The landing as a terminal: a block-letter banner, the last login, a prompt with the ENTER SYSTEM command.
  const FONT = {
    A: [' ### ', '#   #', '#####', '#   #', '#   #'], Z: ['#####', '   # ', '  #  ', ' #   ', '#####'], U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
    R: ['#### ', '#   #', '#### ', '#  # ', '#   #'], E: ['#####', '#    ', '#### ', '#    ', '#####'], L: ['#    ', '#    ', '#    ', '#    ', '#####'],
    T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '], C: [' ####', '#    ', '#    ', '#    ', ' ####'], H: ['#   #', '#   #', '#####', '#   #', '#   #'], ' ': ['  ', '  ', '  ', '  ', '  ']
  };
  const banner = text => Array.from({length: 5}, (_, row) => [...text].map(ch => FONT[ch][row]).join(' ')).join('\n').replace(/#/g, '█');
  if (landing && enter) {
    const pre = document.createElement('pre'); pre.className = 'hos-banner'; pre.setAttribute('aria-hidden', 'true'); pre.textContent = banner('AZURE LATCH');
    const now = new Date(), when = now.toLocaleString('ru-RU', {weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
    const info = document.createElement('div'); info.className = 'hos-term';
    info.innerHTML = `<p>HYPERBOREA OS ${VERSION} · tty1 · профиль: <b data-hos-profile>ГОСТЬ</b></p><p class="hos-dim">Последний вход: ${escape(when)}</p><p class="hos-dim" data-hos-net></p><p class="hos-dim">Введите команду или нажмите ВВОД.</p>`;
    const line = document.createElement('div'); line.className = 'hos-cmdline';
    line.innerHTML = '<span class="hos-prompt" data-hos-prompt>guest@hyperborea:~$</span>';
    enter.textContent = './enter_system'; enter.setAttribute('aria-label', 'Войти в систему'); enter.after(line); line.append(enter);
    const cursor = document.createElement('i'); cursor.className = 'hos-cursor'; cursor.setAttribute('aria-hidden', 'true'); line.append(cursor);
    landing.prepend(pre); landing.querySelector('.subtitle')?.after(info);
  }

  // ── The main menu as a BIOS setup screen, with a console ──────────────────
  const home = document.getElementById('dbHome'), grid = home?.querySelector('.db-grid');
  let help = null, cli = null, outEl = null, input = null;
  const HELP = {
    openPlayers: () => ['PLAYERS', 'Досье игроков: карты на глобусе, рейтинги, музыка и сцены каждого.', 'Досье: ' + document.querySelectorAll('button[aria-label^="Открыть досье"]').length],
    openLore: () => ['LORE', 'История мира: главы-новеллы и глоссарий клубов и терминов.', 'Глав: ' + (window.HYPERBOREA_LORE?.chapters?.length || 0)],
    openTactics: () => ['TACTICS', 'Тактическая доска: схемы, составы 5×5 и 11×11, симуляция и матч с ИИ.', 'Форматы: 5×5 · 11×11'],
    openVersus: () => ['VERSUS', 'Арена: выбери двух игроков и сравни их параметры.', 'Режим: 1 на 1'],
    openProfile: () => ['ПРОФИЛЬ', 'Твой ник, аватар с компьютера, пара слов о себе, любимый игрок и цвет консоли. Хранится только на этом компьютере.', 'Команда: profile'],
    openMembers: () => ['УЧАСТНИКИ', 'Все, кто заходил на сайт, по ролям — как на сервере Discord: кто в сети, кто нет, аватар, ник и пара слов о себе.' + (profile === 'admin' ? ' Роли создаёшь и выдаёшь ты.' : ''), 'Команды: members · roles'],
    openIdea: () => profile === 'admin' ? ['ИДЕИ', 'Карточки идей, которые прислали гости. Видишь только ты.', 'Команда: ideas']
      : ['ИДЕЯ', 'Шаблоны идей для ADMIN: новый игрок (анкета, рейтинги, портрет), глава, событие, функция сайта. Можно приложить картинку; ответ ADMIN придёт в «Мои идеи».', 'Команда: idea'],
    openPoll: () => {
      const p = window.HyperNet?.poll;
      return ['ОПРОС', p ? (p.open ? 'Идёт опрос: ' : 'Последний опрос (закрыт): ') + p.q : 'Голосования от ADMIN. Когда откроется новый опрос, все в сети увидят сообщение.', 'Команда: vote'];
    }
  };
  let helpFor = 'openPlayers';
  function renderHelp(id = helpFor) {
    if (!help) return; helpFor = id;
    const [title, text, extra] = (HELP[id] || HELP.openPlayers)();
    const about = profile === 'admin' ? '' : window.HyperGuest?.card.about || '';
    const role = profile === 'admin' ? null : window.HyperNet?.myRole;
    help.innerHTML = `<h3>Справка</h3><b>${escape(title)}</b><p>${escape(text)}</p><p class="hos-dim">${escape(extra)}</p><hr>`
      + `<div class="hos-who"><span data-guest-avatar></span><p><b class="hos-profile-tag">${escape(profile === 'admin' ? 'admin' : guestName())}</b><br><span class="hos-dim">${role ? `<span class="hos-role" style="color:${escape(role.color)}">${escape(role.name)}</span>` : escape(profileName())}${about ? ' · ' + escape(about) : ''}</span></p></div>`
      + `<p class="hos-dim" data-hos-net>${escape(netLine())}</p><p class="hos-dim">HYPERBOREA OS ${VERSION}</p>`;
    const ava = help.querySelector('[data-guest-avatar]'); if (window.HyperGuest) window.HyperGuest.fillAvatar(ava); else ava.remove();
  }
  const rows = () => [...(grid?.querySelectorAll('.db-card') || [])];
  if (home && grid) {
    home.classList.add('hos-bios');
    // Two more rows: the guest's profile and the polls.
    const addRow = (id, number, name, text, open) => {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'db-card hos-extra'; row.id = id;
      row.setAttribute('aria-label', name + ' — ' + text);
      row.innerHTML = '<span class="db-card-top"><span class="db-card-number">' + number + '</span></span><span class="db-card-name">' + name + '</span><span class="db-card-description"></span>';
      row.querySelector('.db-card-description').textContent = text;
      row.addEventListener('click', () => open(row)); grid.append(row);
    };
    addRow('openProfile', '05', 'ПРОФИЛЬ', 'Ник, аватар и цвет консоли', row => window.HyperGuest?.open(row));
    addRow('openPoll', '06', 'ОПРОС', 'Голосование для всех', row => window.HyperNet?.openPoll(row));
    addRow('openMembers', '07', 'УЧАСТНИКИ', 'Все гости и их роли', row => window.HyperNet?.openMembers(row));
    addRow('openIdea', '08', 'ИДЕЯ', 'Отправить идею ADMIN', row => profile === 'admin' ? window.HyperNet?.openInbox(row) : window.HyperNet?.openIdea(row));
    help = document.createElement('aside'); help.className = 'hos-help'; help.setAttribute('aria-live', 'polite');
    const keys = document.createElement('p'); keys.className = 'hos-legend';
    keys.innerHTML = '<span>↑↓ Выбор</span><span>ВВОД Открыть</span><span>ESC Назад</span><span>F1 Справка</span><span>Печатайте — консоль</span>';
    cli = document.createElement('form'); cli.className = 'hos-cli'; cli.setAttribute('autocomplete', 'off');
    cli.innerHTML = '<div class="hos-out" aria-live="polite"></div><label><span class="hos-prompt" data-hos-prompt>guest@hyperborea:~$</span><input name="cmd" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Команда"></label>';
    grid.after(help, keys, cli);
    outEl = $('.hos-out', cli); input = cli.cmd;
    renderHelp();
    grid.addEventListener('focusin', e => { const r = e.target.closest('.db-card'); if (r) renderHelp(r.id); });
    grid.addEventListener('pointerover', e => { const r = e.target.closest('.db-card'); if (r && r.id !== helpFor) renderHelp(r.id); });
    print('HYPERBOREA OS ' + VERSION + '. Введите help, чтобы увидеть команды.', 'dim');
  }
  function print(text, kind = '') {
    if (!outEl) return;
    const p = document.createElement('p'); p.textContent = text; if (kind) p.className = 'is-' + kind; outEl.append(p);
    while (outEl.childElementCount > 9) outEl.firstElementChild.remove();
  }
  const SECTIONS = {players: 'openPlayers', игроки: 'openPlayers', lore: 'openLore', лор: 'openLore', tactics: 'openTactics', тактика: 'openTactics', versus: 'openVersus', версус: 'openVersus', profile: 'openProfile', профиль: 'openProfile', poll: 'openPoll', опрос: 'openPoll', members: 'openMembers', участники: 'openMembers', idea: 'openIdea', идея: 'openIdea'};
  const history = []; let back = 0;
  const COMMANDS = {
    help() {
      print('help · ls · open <раздел> · profile · members · roles · vote · who · idea · net · whoami · date · ver · cls · logout · exit');
      print('Разделы: players, lore, tactics, versus — можно просто набрать имя раздела.', 'dim');
      if (profile === 'admin') {
        print('ADMIN: say <текст> — эфир всем · event <имя> — событие у всех · ideas — входящие идеи', 'admin');
        print('ADMIN: poll Вопрос? | Вариант 1 | Вариант 2 · poll close · sysupdate · reboot', 'admin');
        print('ADMIN: role new Название #цвет · role give ник Роль · role take ник · role del Роль', 'admin');
      } else {
        const net = window.HyperNet, mine = [['say', 'say <текст> — эфир'], ['event', 'event <имя> — событие'], ['poll', 'poll Вопрос? | А | Б — опрос']].filter(([p]) => net?.can(p));
        if (mine.length) print('Твоя роль «' + net.myRole?.name + '» может: ' + mine.map(([, t]) => t).join(' · '), 'admin');
      }
    },
    ls() { for (const r of rows()) print((r.querySelector('.db-card-number')?.textContent || '').trim() + '  ' + r.querySelector('.db-card-name')?.textContent.trim().padEnd(9) + ' ' + (r.querySelector('.db-card-description')?.textContent || '').trim()); },
    open(arg) {
      const id = SECTIONS[(arg || '').toLowerCase()];
      if (!id) { print('Нет такого раздела: ' + (arg || '—') + '. Наберите ls.', 'err'); return; }
      print('Открываю ' + arg.toUpperCase() + '…'); document.getElementById(id)?.click();
    },
    whoami() { print(profile === 'admin' ? 'admin (ADMIN)' : guestName() + ' (ГОСТЬ) · ' + visitor); },
    profile() { print('Открываю профиль…'); window.HyperGuest?.open(input); },
    net() {
      const net = window.HyperNet;
      print('HYPERBOREA NET: ' + (net ? net.statusText : '—') + (net?.status === 'online' ? ' · онлайн: ' + net.count : ''));
      if (net?.status === 'off') print('Сервер ещё не подключён: настройки в hyper-net-config.js.', 'dim');
    },
    who() {
      const net = window.HyperNet;
      if (net?.status !== 'online') { print('Счётчик недоступен: ' + (net ? net.statusText : 'нет модуля сети') + '.', 'err'); return; }
      print('В сети: ' + net.count + ' — ' + (net.online.map(u => u.nick + (u.me ? ' (ты)' : '')).join(', ') || '—'), 'ok');
    },
    members(arg) { print('Открываю участников…'); window.HyperNet?.openMembers(input, arg || ''); },
    roles() {
      const net = window.HyperNet, list = net?.roleList || [];
      if (!list.length) { print(net?.status === 'online' ? 'Ролей пока нет.' : 'Роли недоступны: ' + (net ? net.statusText : '—') + '.'); if (profile === 'admin') print('Создать: role new Название #цвет — или в окне 07 УЧАСТНИКИ → Роли.', 'admin'); return; }
      const count = id => net.people.filter(p => p.role?.id === id).length;
      for (const r of list) print('  ' + r.name.padEnd(16) + Object.keys(net.PERMS).filter(k => r.perms?.[k]).map(k => net.PERMS[k]).join(', ').padEnd(24) + count(r.id) + ' уч.', 'dim');
    },
    role(arg) {
      if (needAdmin()) return;
      const net = window.HyperNet, [sub = '', ...rest] = (arg || '').split(/\s+/).filter(Boolean), tail = rest.join(' ');
      const done = r => print(r, /^(Роль создана|Роль «.*» выдана|Роль убрана|Роль удалена)/.test(r) ? 'admin' : 'err');
      const key = sub.toLowerCase();
      if (key === 'new' || key === 'создать') {
        const m = tail.match(/^(.*?)\s*(#[0-9a-fA-F]{6})?$/), name = (m?.[1] || '').trim();
        if (!name) { print('Формат: role new Название #цвет (цвет можно не писать)', 'err'); return; }
        net.createRole(name, m?.[2] || '').then(r => { done(r); if (r.startsWith('Роль создана')) print('Права роли включаются в окне 07 УЧАСТНИКИ → Роли.', 'dim'); });
      } else if (key === 'give' || key === 'выдать') {
        if (rest.length < 2) { print('Формат: role give ник Название роли', 'err'); return; }
        net.giveRole(rest[0], rest.slice(1).join(' ')).then(done);
      } else if (key === 'take' || key === 'снять') {
        if (!rest[0]) { print('Формат: role take ник', 'err'); return; }
        net.takeRole(rest[0]).then(done);
      } else if (key === 'del' || key === 'удалить') {
        if (!tail) { print('Формат: role del Название роли', 'err'); return; }
        net.deleteRole(tail).then(done);
      } else {
        print('role new Название #цвет · role give ник Роль · role take ник · role del Роль', 'admin');
        print('Права ролей (эфир, опросы, события) — в окне 07 УЧАСТНИКИ → Роли.', 'dim');
      }
    },
    idea() { print('Открываю карточку идеи…'); window.HyperNet?.openIdea(input); },
    ideas() { if (needAdmin()) return; print('Открываю входящие идеи…', 'admin'); window.HyperNet?.openInbox(input); },
    vote(arg) {
      const net = window.HyperNet, n = parseInt(arg, 10);
      if (!arg) { print('Открываю голосование…'); net?.openPoll(input); return; }
      const p = net?.poll;
      if (!p) { print('Сейчас нет опроса.', 'err'); return; }
      if (!(n >= 1 && n <= p.options.length)) { print('Номер варианта: от 1 до ' + p.options.length + '.', 'err'); return; }
      net.vote(n - 1).then(r => print(r === 'ok' ? 'Голос принят: ' + p.options[n - 1] : r === 'closed' ? 'Опрос закрыт.' : 'Голос не отправлен: нет связи с сервером.', r === 'ok' ? 'ok' : 'err'));
    },
    poll(arg) {
      const net = window.HyperNet, p = net?.poll;
      if (!arg) {
        if (!p) { print(net?.status === 'online' ? 'Опросов пока не было.' : 'Сервер опросов: ' + (net ? net.statusText : '—') + '.'); return; }
        const r = net.results;
        print((p.open ? 'Опрос: ' : 'Опрос (закрыт): ') + p.q);
        p.options.forEach((o, i) => print('  ' + (i + 1) + '. ' + o + (r ? ' — ' + (r.counts[i] || 0) : ''), 'dim'));
        return;
      }
      if (needPerm('poll')) return;
      const report = r => print(r === 'ok' ? 'Готово.' : r, r === 'ok' ? 'admin' : 'err');
      if (/^(close|закрыть)$/i.test(arg)) { net.closePoll().then(report); return; }
      const [q, ...options] = arg.split('|').map(x => x.trim()).filter(Boolean);
      if (!q || options.length < 2 || options.length > 8) { print('Формат: poll Вопрос? | Вариант 1 | Вариант 2 (от 2 до 8 вариантов)', 'err'); return; }
      net.openNewPoll(q.slice(0, 140), options.map(o => o.slice(0, 60))).then(r => print(r === 'ok' ? 'Опрос открыт — его увидят все в сети.' : r, r === 'ok' ? 'admin' : 'err'));
    },
    say(arg) {
      if (needPerm('say')) return;
      if (!arg) { print('Формат: say <текст> — сообщение всем, кто в сети.', 'err'); return; }
      window.HyperNet?.say(arg.slice(0, 300)).then(r => print(r === 'ok' ? 'Эфир отправлен всем, кто в сети.' : r, r === 'ok' ? 'admin' : 'err'));
    },
    event(arg) {
      if (needPerm('event')) return;
      const net = window.HyperNet, events = net?.EVENTS || {};
      const [name, where] = (arg || '').toLowerCase().split(/\s+/);
      if (!name) { print('event <имя> — у всех в сети · event <имя> here — только у тебя', 'admin'); for (const [k, v] of Object.entries(events)) print('  ' + k.padEnd(10) + v, 'dim'); return; }
      if (!events[name]) { print('Нет такого события: ' + name + '. Наберите event.', 'err'); return; }
      if (where === 'here') { print('Событие ' + name + ' — только на этом экране.', 'admin'); setTimeout(() => net.local.event(name), 300); return; }
      net.fire(name).then(r => print(r === 'ok' ? 'Событие ' + name + ' запущено у всех в сети.' : r, r === 'ok' ? 'admin' : 'err'));
    },
    date() { print(new Date().toLocaleString('ru-RU')); },
    ver() { print('HYPERBOREA OS ' + VERSION + ' · Blue Lock Systems'); },
    cls() { outEl.replaceChildren(); },
    logout() { print('Выход из профиля…'); window.HyperNet?.adminSignOut(); setTimeout(() => { show('menu'); os.style.opacity = ''; openMenu(() => { input?.focus({preventScroll: true}); print('Профиль: ' + profileName(), 'ok'); }); }, 250); },
    exit() { document.getElementById('back')?.click(); },
    sysupdate() { if (needAdmin()) return; print('Запуск экрана обновления…', 'admin'); window.SystemUpdate?.simulate(VERSION); },
    reboot() { if (needAdmin()) return; print('Перезагрузка…', 'admin'); setTimeout(() => location.reload(), 400); }
  };
  Object.assign(COMMANDS, {dir: COMMANDS.ls, cd: COMMANDS.open, clear: COMMANDS.cls, '?': COMMANDS.help, профиль: COMMANDS.profile, онлайн: COMMANDS.members, online: COMMANDS.members, участники: COMMANDS.members, роли: COMMANDS.roles, роль: COMMANDS.role, идея: COMMANDS.idea, идеи: COMMANDS.ideas,
    голос: COMMANDS.vote, опрос: COMMANDS.poll, эфир: COMMANDS.say, событие: COMMANDS.event});
  // A command for ADMIN — or for a guest whose role has this right (07 УЧАСТНИКИ → Роли).
  function needPerm(perm) {
    if (profile === 'admin' || window.HyperNet?.can(perm)) return false;
    beep(196, .2, .05); print('Отказано в доступе: нужна роль с правом «' + (window.HyperNet?.PERMS[perm] || perm) + '» или профиль ADMIN.', 'err'); return true;
  }
  function needAdmin() { if (profile === 'admin') return false; beep(196, .2, .05); print('Отказано в доступе: команда только для профиля ADMIN.', 'err'); return true; }
  cli?.addEventListener('submit', event => {
    event.preventDefault();
    const raw = input.value.trim(); input.value = ''; if (!raw) return;
    history.push(raw); back = history.length;
    print(prompt() + ' ' + raw, 'cmd');
    const [name, ...rest] = raw.split(/\s+/), key = name.toLowerCase();
    if (COMMANDS[key]) COMMANDS[key](rest.join(' '));
    else if (SECTIONS[key]) COMMANDS.open(key);
    else if (key === 'sudo') needAdmin() || print('Вы и так ADMIN.', 'admin');
    else { beep(220, .08, .04); print(name + ': команда не найдена. Наберите help.', 'err'); }
  });
  // Arrow keys walk the BIOS list; typing anywhere on it goes to the console.
  addEventListener('keydown', event => {
    if (!home || home.hidden || !document.getElementById('database')?.classList.contains('active') || os.dataset.state !== 'off') return;
    if (window.BootEvents?.active || window.LoreNovel?.playing || window.HyperWindow?.anyOpen) return;
    const inCli = event.target === input;
    if (inCli && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && history.length) {
      event.preventDefault(); back = Math.max(0, Math.min(history.length, back + (event.key === 'ArrowUp' ? -1 : 1))); input.value = history[back] || ''; return;
    }
    if (inCli && event.key === 'Escape') { if (input.value) { event.preventDefault(); event.stopImmediatePropagation(); input.value = ''; } else input.blur(); return; }
    if (event.key === 'F1') { event.preventDefault(); COMMANDS.help(); return; }
    if (inCli || event.target.closest?.('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const all = rows(), at = all.indexOf(document.activeElement);
      all[(at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus({preventScroll: true});
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') input?.focus({preventScroll: true});
  });

  window.HyperGuest?.onChange(() => { if (profile) applyProfile(); });
  if (window.HyperNet) {
    for (const type of ['status', 'online', 'members', 'poll', 'ideas', 'roles']) window.HyperNet.on(type, renderNet);
    window.HyperNet.on('roles', () => renderHelp());
  }
  window.HyperOS = {
    get profile() { return profile; }, get isAdmin() { return profile === 'admin'; }, get state() { return os.dataset.state; },
    // What the hum is doing (for checking by hand): context state, whether it plays, where the loop starts.
    get audio() { return {state: ctx?.state || 'none', playing: !!humSource, loopStart: humSource?.loopStart || 0, duration: humSource?.buffer?.duration || 0, gain: out?.gain.value || 0}; },
    // Straight to the guest profile (for tests and the game's terminal): skips the splash and the menu.
    boot(asGuest = true) { if (!asGuest || profile) return; skipped = true; clearTimeout(powerTimer); splashAbort?.(); stopTimer(); if (!powered) { powered = true; audio(); ctx?.resume().catch(() => {}); startHum(); } onChosen = finishBoot; done('guest'); },
    logout: () => COMMANDS.logout(), run: cmd => { if (input) { input.value = cmd; cli.requestSubmit(); } }
  };
  show('dark');
  boot();
})();
