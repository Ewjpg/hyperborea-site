import {STAT_AXES, parseRating} from './rating-model.mjs?v=36';
import {createProfileRadar} from './player-ratings.mjs?v=36';

(() => {
  'use strict';
  const axes = STAT_AXES;
  const inputs = axes.map(axis => document.getElementById('fearStat' + axis));
  const description = document.getElementById('fearDescription');
  const weapon = document.getElementById('fearWeapon');
  // The HTML holds the authored fallback immediately, including before imports.
  let canonicalWeapon = weapon.defaultValue;
  weapon.readOnly = true;
  const weaponState = document.getElementById('fearWeaponSaveState');
  const state = document.getElementById('fearSaveState');
  const updateRadar = createProfileRadar('fear');
  const key = 'hyperborea_fear_profile_v1';
  function draw() {
    const values = inputs.map(input => parseRating(input.value));
    document.getElementById('fearQuickStats').textContent = values.filter(value => value !== null).length + ' / 7';
    weapon.value = canonicalWeapon;
    const weaponSummary = 'Formless';
    document.getElementById('fearQuickWeapon').textContent = weaponSummary || '—';
    document.getElementById('fearQuickWeapon').title = weaponSummary;
    document.getElementById('fearDescriptionCount').textContent = description.value.length + ' / 12000';
    document.getElementById('fearWeaponCount').textContent = 'ЗАКРЕПЛЕНО';
    updateRadar(values);
    return values;
  }
  function save(source = 'description') {
    const ratings = draw();
    const message = source === 'weapon' ? weaponState : state;
    try {
      localStorage.setItem(key, JSON.stringify({ratings, description:description.value, weapon:canonicalWeapon}));
      message.textContent = 'Сохранено на этом устройстве';
    } catch (error) {
      message.textContent = 'Изменения доступны до закрытия страницы';
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      if (Array.isArray(saved.ratings)) inputs.forEach((input, index) => {
        const value = parseRating(saved.ratings[index]);
        input.value = value === null ? '' : String(value);
      });
      if (typeof saved.description === 'string') description.value = saved.description.slice(0, 12000);
      // A previous editable weapon must never replace FEAR's authored weapon.
      localStorage.setItem(key, JSON.stringify({...saved, weapon:canonicalWeapon}));
    }
  } catch (error) { /* An unavailable or malformed saved profile starts empty. */ }
  inputs.forEach(input => input.addEventListener('input', () => {
    const value = parseRating(input.value);
    if (value !== null) input.value = String(value);
    save();
  }));
  description.addEventListener('input', () => save('description'));
  weapon.addEventListener('input', () => { weapon.value = canonicalWeapon; draw(); });
  weaponState.textContent = 'Главное оружие FEAR · закреплено';
  draw();
  import('./weapon-data.mjs?v=28').then(({FEAR_WEAPON}) => {
    canonicalWeapon = FEAR_WEAPON;
    weapon.value = canonicalWeapon;
    draw();
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) localStorage.setItem(key, JSON.stringify({...saved, weapon:canonicalWeapon}));
    } catch { /* The read-only authored text stays available without storage. */ }
  }).catch(() => { /* The canonical HTML fallback stays available offline. */ });
})();
