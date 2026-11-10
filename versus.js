// VERSUS: a fourth directory in the main menu. Pick two players and they face each other: portraits, a slash
// of light, both radars on one chart, each rating side by side with the winner lit, and a verdict.
// Everything comes from the dossiers (names, portraits, ratings, Overall), so it follows what is filled in there.
(() => {
  'use strict';
  const database = document.getElementById('database'), home = document.getElementById('dbHome'), grid = home?.querySelector('.db-grid');
  if (!database || !home || !grid) return;
  const AXES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'OFN'];
  const PLAYERS = [['fearCard', 'fear'], ['wahCard', 'wah'], ['frogCard', 'frog'], ['swarggyCard', 'swarggy'], ['emilianoCard', 'emiliano'], ['yoruCard', 'yoru']];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const people = PLAYERS.map(([card, key]) => {
    const el = document.getElementById(card);
    return {card, key, name: (el?.querySelector('[data-player-name]')?.textContent || key).trim(), image: el?.querySelector('img:not(.club-badge)')?.getAttribute('src') || ''};
  }).filter(p => p.image);
  const value = (p, axis) => { const n = parseInt(document.getElementById(p.key + 'Stat' + axis)?.value, 10); return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : null; };
  const overall = p => { const s = (document.getElementById(p.key + 'OverallScore')?.textContent || '').trim(); return /^\d+$/.test(s) ? +s : null; };

  // The menu card.
  const card = document.createElement('button');
  card.className = 'db-card versus-directory'; card.id = 'openVersus'; card.type = 'button';
  card.setAttribute('aria-label', 'Открыть VERSUS — сравнение игроков');
  card.innerHTML = '<span class="db-card-top"><svg class="db-icon" viewBox="0 0 24 24" aria-hidden="true"></svg><span class="db-card-number">04</span></span>'
    + '<span class="db-card-name">VERSUS</span><span class="db-card-description">Игрок против игрока</span><span class="db-card-open">[ OPEN ARENA ]</span>';
  grid.append(card);

  // The arena.
  const viewEl = document.createElement('section');
  viewEl.className = 'db-view versus-view'; viewEl.id = 'versusView'; viewEl.hidden = true; viewEl.setAttribute('aria-labelledby', 'versusTitle');
  const picker = side => `<div class="vs-picker" data-side="${side}" role="radiogroup" aria-label="${side === 'a' ? 'Первый игрок' : 'Второй игрок'}">${people.map(p => `<button type="button" role="radio" aria-checked="false" data-card="${p.card}" title="${p.name}"><img src="${p.image}" alt=""><span>${p.name}</span></button>`).join('')}</div>`;
  viewEl.innerHTML = `<div class="vs-top"><div><p class="db-kicker">HYPERBOREA / ARENA</p><h2 class="db-title" id="versusTitle" tabindex="-1">VERSUS</h2><p class="db-caption">ВЫБЕРИ ДВУХ ИГРОКОВ</p></div><div class="vs-top-actions"><button class="db-back" type="button" data-random>[ СЛУЧАЙНАЯ ПАРА ]</button><button class="db-back" type="button" data-exit>[ BACK TO DATABASE ]</button></div></div>
    <div class="vs-stage">
      <div class="vs-side vs-a">${picker('a')}<figure class="vs-fighter"><img alt=""><figcaption><b data-name></b><span data-ovr></span></figcaption></figure></div>
      <div class="vs-center"><span class="vs-mark" aria-hidden="true">VS</span><svg class="vs-radar" viewBox="0 0 300 300" role="img" aria-label="Сравнение параметров"></svg></div>
      <div class="vs-side vs-b">${picker('b')}<figure class="vs-fighter"><img alt=""><figcaption><b data-name></b><span data-ovr></span></figcaption></figure></div>
    </div>
    <div class="vs-rows" role="table" aria-label="Параметры"></div>
    <p class="vs-verdict" role="status" aria-live="polite"></p>`;
  home.after(viewEl);
  const rows = viewEl.querySelector('.vs-rows'), radar = viewEl.querySelector('.vs-radar'), verdict = viewEl.querySelector('.vs-verdict');
  const pick = {a: people[0], b: people[1] || people[0]};

  function radarSvg(a, b) {
    const cx = 150, cy = 150, R = 110, n = AXES.length, pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]; };
    const poly = p => AXES.map((ax, i) => pt(i, R * (value(p, ax) ?? 0) / 99).map(v => v.toFixed(1)).join(',')).join(' ');
    let s = [.25, .5, .75, 1].map(k => `<polygon class="vs-ring" points="${AXES.map((_, i) => pt(i, R * k).join(',')).join(' ')}"/>`).join('');
    s += AXES.map((ax, i) => { const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 20); return `<line class="vs-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="vs-axis" x="${lx}" y="${ly + 4}" text-anchor="middle">${ax}</text>`; }).join('');
    s += `<polygon class="vs-shape vs-shape-a" points="${poly(a)}"/><polygon class="vs-shape vs-shape-b" points="${poly(b)}"/>`;
    return s;
  }
  function render(animate = true) {
    const {a, b} = pick;
    for (const side of ['a', 'b']) {
      const p = pick[side], box = viewEl.querySelector('.vs-' + side);
      box.querySelector('.vs-fighter img').src = p.image;
      box.querySelector('[data-name]').textContent = p.name;
      const o = overall(p); box.querySelector('[data-ovr]').textContent = o === null ? 'OVR —' : 'OVR ' + o;
      for (const btn of box.querySelectorAll('.vs-picker button')) btn.setAttribute('aria-checked', String(btn.dataset.card === p.card));
    }
    radar.innerHTML = radarSvg(a, b);
    let winsA = 0, winsB = 0, known = 0;
    rows.replaceChildren();
    for (const ax of AXES) {
      const va = value(a, ax), vb = value(b, ax);
      if (va !== null && vb !== null) { known++; if (va > vb) winsA++; else if (vb > va) winsB++; }
      const row = document.createElement('div'); row.className = 'vs-row'; row.setAttribute('role', 'row');
      const win = va === null || vb === null || va === vb ? '' : va > vb ? 'a' : 'b';
      row.innerHTML = `<span class="vs-val ${win === 'a' ? 'is-win' : ''}" role="cell">${va ?? '—'}</span><i class="vs-bar vs-bar-a ${win === 'a' ? 'is-win' : ''}" style="--v:${(va ?? 0) / 99 * 100}%"></i><b role="rowheader">${ax}</b><i class="vs-bar vs-bar-b ${win === 'b' ? 'is-win' : ''}" style="--v:${(vb ?? 0) / 99 * 100}%"></i><span class="vs-val ${win === 'b' ? 'is-win' : ''}" role="cell">${vb ?? '—'}</span>`;
      rows.append(row);
    }
    if (a === b) verdict.textContent = 'Выбери двух разных игроков.';
    else if (!known) { const empty = [a, b].filter(p => AXES.every(ax => value(p, ax) === null)).map(p => p.name); verdict.textContent = (empty.length ? 'Нет параметров у: ' + empty.join(', ') : 'Параметры не пересекаются') + ' — заполни их в досье, и здесь появится сравнение.'; }
    else if (winsA === winsB) verdict.textContent = `РАВНЫЕ СИЛЫ · ${winsA} : ${winsB}`;
    else { const w = winsA > winsB ? a : b; verdict.textContent = `ПРЕИМУЩЕСТВО: ${w.name.toUpperCase()} · ${Math.max(winsA, winsB)} из ${known}`; }
    if (animate && !motion.matches) {
      viewEl.querySelector('.vs-a .vs-fighter').animate([{translate: '-60px 0', opacity: 0}, {translate: '0 0', opacity: 1}], {duration: 480, easing: 'cubic-bezier(.2,1.3,.4,1)'});
      viewEl.querySelector('.vs-b .vs-fighter').animate([{translate: '60px 0', opacity: 0}, {translate: '0 0', opacity: 1}], {duration: 480, easing: 'cubic-bezier(.2,1.3,.4,1)'});
      viewEl.querySelector('.vs-mark').animate([{scale: '2.4', opacity: 0, rotate: '-12deg'}, {scale: '1', opacity: 1, rotate: '0deg'}], {duration: 420, delay: 180, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards'});
    }
  }
  viewEl.addEventListener('click', event => {
    const btn = event.target.closest('.vs-picker button');
    if (btn) { const side = btn.closest('.vs-picker').dataset.side; pick[side] = people.find(p => p.card === btn.dataset.card); render(); return; }
    if (event.target.closest('[data-random]')) { const s = [...people].sort(() => Math.random() - .5); pick.a = s[0]; pick.b = s[1] || s[0]; render(); return; }
    if (event.target.closest('[data-exit]')) close();
  });
  function open() {
    home.hidden = true; viewEl.hidden = false; database.scrollTop = 0;
    const path = document.getElementById('dbPath'); if (path) path.textContent = 'HYPERBOREA / VERSUS';
    render(); viewEl.querySelector('#versusTitle').focus({preventScroll: true});
  }
  function close() {
    viewEl.hidden = true; home.hidden = false;
    const path = document.getElementById('dbPath'); if (path) path.textContent = 'HYPERBOREA / DATABASE';
    card.focus({preventScroll: true});
  }
  card.addEventListener('click', () => {
    if (window.HyperboreaTransitions?.glitch) window.HyperboreaTransitions.glitch(home, viewEl, open); else open();
  });
  // Leaving the database (back to the terminal) closes the arena.
  new MutationObserver(() => { if (!database.classList.contains('active') && !viewEl.hidden) close(); }).observe(database, {attributes: true, attributeFilter: ['class']});
  window.Versus = {open, close, pick(a, b) { pick.a = people.find(p => p.key === a) || pick.a; pick.b = people.find(p => p.key === b) || pick.b; render(false); }};
})();
