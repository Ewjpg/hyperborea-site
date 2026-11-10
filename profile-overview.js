import {STAT_AXES, parseRating} from './rating-model.mjs?v=36';

// Read existing fields rather than keeping another copy of profile statistics.
const $ = id => document.getElementById(id);
const refreshers = [];
for (const overview of document.querySelectorAll('[data-profile-overview]')) {
  const id = overview.dataset.profileOverview;
  const dossier = $(id + 'Dossier');
  const position = $(id + 'Position');
  const weapon = $(id + 'Weapon');
  const ratings = STAT_AXES.map(axis => $(id + 'Stat' + axis));
  function refresh() {
    $(id + 'QuickPosition').textContent = id === 'fear' ? 'CF / LW' : position?.value.trim() || 'Не указана';
    $(id + 'QuickStats').textContent = ratings.filter(input => parseRating(input?.value) !== null).length + ' / ' + STAT_AXES.length;
    const name = id === 'fear' ? 'Formless' : weapon?.value.trim().split(/\r?\n/)[0] || '—';
    const summary = $(id + 'QuickWeapon');
    summary.textContent = name;
    summary.title = name === '—' ? '' : name;
  }
  dossier.addEventListener('input', refresh);
  new MutationObserver(refresh).observe(dossier, {attributes:true, attributeFilter:['hidden']});
  refreshers.push(refresh);
  refresh();
}

// These two characters have no authored callsign yet. Keep edits independent
// from their existing statistics/description drafts and never invent a nickname.
const callsignKey = 'hyperborea_callsigns_v1';
let callsigns = {};
try {
  const saved = JSON.parse(localStorage.getItem(callsignKey) || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) callsigns = saved;
} catch {}
for (const id of ['emiliano', 'yoru']) {
  const input = $(id + 'Callsign');
  if (!input) continue;
  input.value = typeof callsigns[id] === 'string' ? callsigns[id].slice(0,40) : '';
  input.addEventListener('input', () => {
    callsigns[id] = input.value;
    try { localStorage.setItem(callsignKey, JSON.stringify(callsigns)); } catch {}
  });
}
const refreshAll = () => refreshers.forEach(refresh => refresh());
requestAnimationFrame(refreshAll);
window.addEventListener('load', refreshAll, {once:true});
window.addEventListener('pageshow', refreshAll);
