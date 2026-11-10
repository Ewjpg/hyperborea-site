// Roster cards as collectible "foil" cards (player-foil.css). The cards keep their own markup and listeners;
// this adds the rating corner (Overall and positions, read live from each dossier), the player number,
// the callsign, and a holographic sheen that follows the pointer while the card tilts toward it.
(() => {
  'use strict';
  const roster = document.getElementById('playersRoster');
  if (!roster) return;
  // card id → dossier id prefix, number on the card, colours (ink, accent, deep).
  const PLAYERS = [
    ['fearCard', 'fear', '01', '#d6d6d6', '#5d5d5d', '#161616'],
    ['wahCard', 'wah', '02', '#9cc2ff', '#2665d7', '#0b1a3a'],
    ['frogCard', 'frog', '03', '#ead29c', '#a8843f', '#2a1d0c'],
    ['swarggyCard', 'swarggy', '04', '#ff6b7c', '#c8162f', '#3a0712'],
    ['emilianoCard', 'emiliano', '05', '#d8bdf6', '#8a5cc7', '#22123a'],
    ['yoruCard', 'yoru', '06', '#bcd6f7', '#3d6aa6', '#0b1626']
  ];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [];
  const make = (tag, className, parent, text = '') => { const el = document.createElement(tag); el.className = className; if (text) el.textContent = text; parent.append(el); return el; };
  for (const [cardId, key, number, ink, accent, deep] of PLAYERS) {
    const card = document.getElementById(cardId);
    if (!card) continue;
    const art = card.firstElementChild, body = art?.nextElementSibling;
    if (!art || !body) continue;
    card.classList.add('foil-card');
    card.style.setProperty('--ink', ink); card.style.setProperty('--accent', accent); card.style.setProperty('--deep', deep);
    make('span', 'foil-number', art, number).setAttribute('aria-hidden', 'true');
    const corner = make('span', 'foil-corner', art);
    const ovr = make('span', 'foil-ovr', corner, '—');
    make('span', 'foil-ovr-label', corner, 'OVR');
    const positions = make('span', 'foil-positions', corner, '—');
    const callsign = make('span', 'foil-callsign', body);
    body.prepend(callsign);
    make('span', 'foil-sheen', card).setAttribute('aria-hidden', 'true');
    cards.push({card, key, ovr, positions, callsign});
  }
  // Overall, positions and callsign come from the dossiers, so the cards follow whatever is typed there.
  const text = id => (document.getElementById(id)?.textContent || '').trim();
  function refresh() {
    for (const {key, ovr, positions, callsign} of cards) {
      const score = text(key + 'OverallScore');
      ovr.textContent = /^\d+$/.test(score) ? score : '—';
      const place = text(key + 'QuickPosition');
      positions.textContent = place && !/не указан/i.test(place) ? place.replace(/\s*[,/]\s*/g, ' · ') : '—';
      // A callsign that only repeats the name (Frog) is left out.
      const sign = (document.querySelector('#' + key + 'Dossier .profile-callsign strong')?.textContent || '').trim();
      const name = (callsign.parentElement.querySelector('[data-player-name]')?.textContent || '').trim();
      callsign.textContent = sign.toLowerCase() === name.toLowerCase() ? '' : sign;
    }
  }
  refresh();
  let pending = 0;
  const later = () => { clearTimeout(pending); pending = setTimeout(refresh, 120); };
  document.addEventListener('input', later, true);
  new MutationObserver(later).observe(roster, {attributes: true, attributeFilter: ['hidden', 'class']});
  for (const key of PLAYERS.map(p => p[1])) {
    for (const id of [key + 'OverallScore', key + 'QuickPosition']) {
      const el = document.getElementById(id);
      if (el) new MutationObserver(later).observe(el, {childList: true, characterData: true, subtree: true});
    }
  }
  // Tilt toward the pointer and move the sheen with it.
  for (const {card} of cards) {
    card.addEventListener('pointermove', event => {
      if (motion.matches || event.pointerType === 'touch') return;
      const r = card.getBoundingClientRect(), x = (event.clientX - r.left) / r.width - .5, y = (event.clientY - r.top) / r.height - .5;
      card.style.setProperty('--foil-x', ((x + .5) * 100).toFixed(0) + '%'); card.style.setProperty('--foil-y', ((y + .5) * 100).toFixed(0) + '%');
      card.style.setProperty('--tilt-x', (-y).toFixed(3)); card.style.setProperty('--tilt-y', x.toFixed(3));
      card.style.setProperty('--tilt', (Math.hypot(x, y) * 26).toFixed(1) + 'deg');
    });
    card.addEventListener('pointerleave', () => card.style.setProperty('--tilt', '0deg'));
  }
})();
