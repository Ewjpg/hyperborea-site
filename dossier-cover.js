// Dossier 2.0 ("Гибрид, чисто"): the top of every dossier becomes a cover — the player's portrait in a circle,
// a ring of seven stat arcs around it and Overall with its rank — next to the name, a terminal line and the facts.
// Nothing is rebuilt: each dossier's own portrait block (with its look switch, Flow, dance and so on) is moved
// into the cover, and its own name, callsign and inputs stay where their scripts expect them (dossier-cover.css).
(() => {
  'use strict';
  const AXES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'OFN'];
  // key, dossier, hero, identity column, portrait block, name for the terminal line.
  const DOSSIERS = [
    ['fear', 'fearDossier', '.fear-profile', '.fear-identity', '.fear-hero-art', 'klaus_sturm'],
    ['wah', 'wahDossier', '.wah-hero', '.wah-identity', '.wah-art', 'kle_enigm'],
    ['frog', 'frogDossier', '.frog-hero', '.frog-identity', '.frog-art', 'frog'],
    ['swarggy', 'swarggyDossier', '.swarggy-hero', '.swarggy-identity', '.swarggy-art', 'minami_shin'],
    ['emiliano', 'emilianoDossier', '.np-hero', '.np-identity', '.np-art', 'emiliano_sanchez'],
    ['yoru', 'yoruDossier', '.np-hero', '.np-identity', '.np-art', 'nishimura_yoru']
  ];
  const CLUB = new Set(['fear', 'swarggy']);
  const SVG = 'http://www.w3.org/2000/svg';
  const rank = v => v >= 90 ? 'S' : v >= 80 ? 'A' : v >= 70 ? 'B' : v >= 60 ? 'C' : v >= 50 ? 'D' : v >= 30 ? 'E' : 'F';
  const covers = [], levels = [];
  for (const [key, dossierId, heroSel, identitySel, artSel, handle] of DOSSIERS) {
    const dossier = document.getElementById(dossierId);
    const hero = dossier?.querySelector(heroSel), identity = hero?.querySelector(identitySel), art = hero?.querySelector(artSel);
    if (!dossier || !hero || !identity || !art) continue;
    dossier.classList.add('dc-dossier', 'dc-' + key);
    hero.classList.add('dc-hero');
    const cover = document.createElement('div');
    cover.className = 'dc-cover';
    cover.innerHTML = '<span class="dc-mast" aria-hidden="true">HYPERBOREA</span><div class="dc-disc"></div>'
      + '<svg class="dc-ring" viewBox="0 0 400 400" role="img"><title>Параметры</title></svg>'
      + '<p class="dc-ovr"><b>—</b><small>OVR</small></p>';
    hero.insertBefore(cover, identity);
    cover.querySelector('.dc-disc').append(art);
    // Look switches sit on the cover, outside the round portrait, so they stay whole.
    const look = art.querySelector('.minami-look,.fear-look');
    if (look) cover.append(look);
    // The terminal line and the facts row go at the top of the identity column.
    const prompt = document.createElement('p');
    prompt.className = 'dc-prompt'; prompt.setAttribute('aria-hidden', 'true');
    prompt.textContent = 'open player ' + handle;
    identity.prepend(prompt);
    const facts = document.createElement('dl');
    facts.className = 'dc-facts';
    facts.innerHTML = '<div><dt>ПОЗИЦИИ</dt><dd class="dc-positions">—</dd></div>'
      + (CLUB.has(key) ? '<div><dt>КЛУБ</dt><dd class="dc-club">QIQI</dd></div>' : '');
    const nameBlock = identity.querySelector('.profile-name-block');
    (identity.querySelector('.profile-callsign') || nameBlock)?.after(facts);
    // Ratings: each input gets a column that fills to its value.
    const ratings = dossier.querySelector('.profile-ratings');
    if (ratings) {
      (ratings.closest('[id$="StatsCell"]') || ratings.parentElement).classList.add('dc-stats');
      for (const input of ratings.querySelectorAll('input')) {
        const level = document.createElement('i'); level.className = 'dc-level'; level.setAttribute('aria-hidden', 'true'); level.append(document.createElement('b'));
        input.before(level);
        const sync = () => { const n = parseInt(input.value, 10); level.style.setProperty('--v', (Number.isFinite(n) ? Math.max(0, Math.min(99, n)) / 99 * 100 : 0).toFixed(1) + '%'); };
        input.addEventListener('input', sync); sync(); levels.push(sync);
      }
    }
    covers.push({key, cover, ring: cover.querySelector('.dc-ring'), ovr: cover.querySelector('.dc-ovr b'), small: cover.querySelector('.dc-ovr small'), positions: facts.querySelector('.dc-positions')});
  }
  // The ring: one arc per axis, as long as the value (0–99), with the axis name and number outside it.
  const cx = 200, cy = 200, r = 160, gap = .09, span = Math.PI * 2 / AXES.length;
  const arc = (a0, a1) => {
    const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
    return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  };
  const value = id => { const n = parseInt(document.getElementById(id)?.value, 10); return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : null; };
  function draw({key, ring, ovr, small, positions}) {
    const values = AXES.map(axis => value(key + 'Stat' + axis));
    ring.replaceChildren();
    ring.insertAdjacentHTML('beforeend', '<title>Параметры: ' + AXES.map((a, i) => a + ' ' + (values[i] ?? '—')).join(', ') + '</title>');
    AXES.forEach((axis, i) => {
      const a0 = -Math.PI / 2 + i * span + gap, a1 = a0 + span - gap * 2, mid = (a0 + a1) / 2, length = r * (a1 - a0);
      const lx = cx + Math.cos(mid) * (r + 27), ly = cy + Math.sin(mid) * (r + 27);
      const v = values[i];
      ring.insertAdjacentHTML('beforeend',
        `<path class="dc-track" d="${arc(a0, a1)}"/>`
        + (v ? `<path class="dc-arc" style="--len:${(length * v / 99).toFixed(1)}" d="${arc(a0, a1)}"/>` : '')
        + `<text class="dc-axis" x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="middle">${axis}</text>`
        + `<text class="dc-value" x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" text-anchor="middle">${v ?? '—'}</text>`);
    });
    const score = (document.getElementById(key + 'OverallScore')?.textContent || '').trim();
    const ok = /^\d+$/.test(score);
    ovr.textContent = ok ? score : '—';
    small.textContent = ok ? 'OVR · ' + rank(+score) : 'OVR';
    const place = (document.getElementById(key + 'QuickPosition')?.textContent || '').trim();
    positions.textContent = place && !/не указан/i.test(place) ? place.replace(/\s*[,/]\s*/g, ' · ') : '—';
  }
  covers.forEach(draw);
  // Saved ratings are filled in by each dossier's own script after load; catch up once they are there.
  setTimeout(() => { levels.forEach(sync => sync()); covers.forEach(draw); }, 600);
  let pending = 0;
  const redraw = () => { clearTimeout(pending); pending = setTimeout(() => covers.forEach(draw), 80); };
  document.addEventListener('input', event => { if (event.target.closest?.('.dc-dossier')) redraw(); }, true);
  for (const {key} of covers) for (const id of [key + 'OverallScore', key + 'QuickPosition']) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(redraw).observe(el, {childList: true, characterData: true, subtree: true});
  }
  // Redraw on opening, so the arcs grow in each time.
  for (const {key, cover} of covers) {
    const dossier = cover.closest('.dc-dossier');
    new MutationObserver(() => { if (!dossier.hidden) { cover.classList.remove('is-in'); void cover.offsetWidth; cover.classList.add('is-in'); redraw(); } })
      .observe(dossier, {attributes: true, attributeFilter: ['hidden']});
  }
})();
