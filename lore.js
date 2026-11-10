// LORE directory: chapters chosen as cards (grouped in parts), each played as a visual novel (lore-novel.js)
// or read as text, and a glossary of clubs and terms. Data in lore-data.js, styles in lore.css.
// Glossary words in the text are underlined; clicking one opens a small card with its description.
(() => {
  'use strict';
  const section = document.getElementById('dbSection'), empty = document.getElementById('dbEmpty');
  const lore = window.HYPERBOREA_LORE;
  if (!section || !empty || !lore) return;
  const KEY = 'hyperborea_lore_v1';
  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const glossary = lore.glossary || [], chapters = lore.chapters || [];
  const parts = lore.parts?.length ? lore.parts : [{id: 'all', title: 'Главы', chapters: chapters.map(c => c.id)}];
  const byName = new Map();
  for (const entry of glossary) for (const name of [entry.term, ...(entry.aliases || [])]) byName.set(name.toLowerCase(), entry);
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const termPattern = names.length ? new RegExp('(' + names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi') : null;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };

  const reader = document.createElement('div');
  reader.className = 'lore'; reader.id = 'loreReader'; reader.hidden = true;
  reader.innerHTML = `<div class="lore-tabs" role="tablist"><button type="button" role="tab" data-tab="chapters">ГЛАВЫ</button><button type="button" role="tab" data-tab="glossary">ГЛОССАРИЙ</button></div>
    <div class="lore-pane" data-pane="chapters"><div class="lore-parts"></div><section class="lore-detail" aria-live="polite"></section><article class="lore-page" hidden></article></div>
    <div class="lore-pane" data-pane="glossary"><label class="lore-search"><span>ПОИСК</span><input type="search" placeholder="клуб или термин…"></label><div class="lore-terms"></div></div>
    <aside class="lore-card" hidden role="dialog" aria-label="Термин"><button type="button" class="lore-card-close" aria-label="Закрыть">×</button><small data-kind></small><b data-term></b><p data-text></p><button type="button" class="lore-card-more">ОТКРЫТЬ В ГЛОССАРИИ ↗</button></aside>`;
  empty.after(reader);
  const partsEl = reader.querySelector('.lore-parts'), detail = reader.querySelector('.lore-detail'), page = reader.querySelector('.lore-page');
  const terms = reader.querySelector('.lore-terms'), search = reader.querySelector('.lore-search input'), card = reader.querySelector('.lore-card');
  let current = null;

  function format(text, seen) {
    let html = escape(text);
    if (termPattern) html = html.replace(termPattern, match => {
      const entry = byName.get(match.toLowerCase());
      if (!entry || seen.has(entry.term)) return match;
      seen.add(entry.term);
      return `<button type="button" class="lore-term" data-term="${escape(entry.term)}">${match}</button>`;
    });
    return html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  // Parts with a row of chapter cards each; chapters not written yet are shown locked.
  function renderParts() {
    partsEl.innerHTML = parts.map(part => {
      const list = part.chapters.map(id => chapters.find(c => c.id === id)).filter(Boolean);
      const cards = list.map(c => `<button type="button" class="lore-chapter" data-chapter="${escape(c.id)}" aria-pressed="false">${c.cover ? `<img src="./assets/lore/${escape(c.cover)}" alt="">` : '<i></i>'}<span class="lore-chapter-num">${escape(c.number || '')}</span><b>${escape(c.title)}</b>${saved.done?.includes(c.id) ? '<small>ПРОЙДЕНО</small>' : ''}</button>`).join('');
      const locked = Array.from({length: part.upcoming || 0}, (_, i) => `<div class="lore-chapter is-locked" aria-disabled="true"><i></i><span class="lore-chapter-num">${String(list.length + i).padStart(2, '0')}</span><b>Скоро</b></div>`).join('');
      return `<section class="lore-part"><h3>${escape(part.title)}</h3><div class="lore-row">${cards}${locked}</div></section>`;
    }).join('');
  }
  function select(id) {
    current = chapters.find(c => c.id === id) || chapters[0];
    if (!current) { detail.innerHTML = '<p class="lore-empty">Глав пока нет.</p>'; return; }
    saved.chapter = current.id; save();
    for (const b of partsEl.querySelectorAll('[data-chapter]')) b.setAttribute('aria-pressed', String(b.dataset.chapter === current.id));
    detail.innerHTML = `<span class="lore-kicker">ГЛАВА ${escape(current.number || '')}</span><h3>${escape(current.title)}</h3>${current.subtitle ? `<p>${escape(current.subtitle)}</p>` : ''}
      <div class="lore-actions">${current.play?.length ? '<button type="button" class="lore-play" data-play>▶ ИГРАТЬ ГЛАВУ</button>' : ''}<button type="button" class="lore-read" data-read aria-expanded="false">ЧИТАТЬ ТЕКСТОМ</button></div>`;
    page.hidden = true; page.innerHTML = '';
  }
  function readText() {
    if (!current) return;
    const seen = new Set();
    let html = '';
    for (const block of current.blocks || []) {
      if (typeof block === 'string') {
        const line = block.trim().startsWith('—'), remark = /^\*[^*]+\*$/.test(block.trim());
        html += `<p class="${line ? 'is-line' : remark ? 'is-remark' : ''}">${format(block, seen)}</p>`;
      } else if (block.voice) html += `<p class="lore-voice">${format(block.voice, seen)}</p>`;
      else if (block.img) html += `<figure class="lore-figure"><img src="./assets/lore/${escape(block.img)}" alt="${escape(block.alt || '')}" loading="lazy">${block.credit ? `<figcaption>${escape(block.credit)}</figcaption>` : ''}</figure>`;
      else if (block.end) html += `<p class="lore-end">${escape(block.end)}</p>`;
    }
    page.innerHTML = html; page.hidden = false;
    detail.querySelector('[data-read]')?.setAttribute('aria-expanded', 'true');
    page.scrollIntoView({block: 'start', behavior: 'smooth'});
  }
  function renderGlossary(filter = '') {
    const q = filter.trim().toLowerCase(), groups = new Map();
    for (const entry of glossary) {
      if (q && !(entry.term + ' ' + (entry.text || '') + ' ' + (entry.aliases || []).join(' ')).toLowerCase().includes(q)) continue;
      if (!groups.has(entry.kind)) groups.set(entry.kind, []);
      groups.get(entry.kind).push(entry);
    }
    terms.innerHTML = groups.size ? [...groups].map(([kind, list]) => `<section><h4>${escape(kind)}</h4>${list.map(e => `<article class="lore-entry" id="lore-${escape(e.term.replace(/\s+/g, '-'))}"><b>${escape(e.term)}</b><p class="${e.text ? '' : 'is-empty'}">${escape(e.text || 'Описание пока не написано.')}</p></article>`).join('')}</section>`).join('') : '<p class="lore-empty">Ничего не найдено.</p>';
  }
  function tab(name) {
    for (const b of reader.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    for (const p of reader.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== name;
    card.hidden = true;
  }
  function openCard(button) {
    const entry = byName.get(button.dataset.term.toLowerCase());
    if (!entry) return;
    card.querySelector('[data-kind]').textContent = entry.kind;
    card.querySelector('[data-term]').textContent = entry.term;
    card.querySelector('[data-text]').textContent = entry.text || 'Описание пока не написано.';
    card.dataset.term = entry.term; card.hidden = false;
    const box = reader.getBoundingClientRect(), r = button.getBoundingClientRect();
    card.style.left = Math.max(8, Math.min(box.width - card.offsetWidth - 8, r.left - box.left)) + 'px';
    card.style.top = (r.bottom - box.top + 8) + 'px';
  }
  reader.addEventListener('click', event => {
    const t = event.target.closest('[data-tab]'); if (t) { tab(t.dataset.tab); return; }
    const c = event.target.closest('[data-chapter]'); if (c) { select(c.dataset.chapter); return; }
    if (event.target.closest('[data-play]')) {
      const chapter = current;
      window.LoreNovel?.play(chapter, () => { saved.done = [...new Set([...(saved.done || []), chapter.id])]; save(); renderParts(); select(chapter.id); });
      return;
    }
    if (event.target.closest('[data-read]')) { if (page.hidden) readText(); else { page.hidden = true; event.target.closest('[data-read]').setAttribute('aria-expanded', 'false'); } return; }
    const term = event.target.closest('.lore-term'); if (term) { openCard(term); return; }
    if (event.target.closest('.lore-card-close')) { card.hidden = true; return; }
    if (event.target.closest('.lore-card-more')) {
      const name = card.dataset.term; tab('glossary'); search.value = ''; renderGlossary();
      const el = document.getElementById('lore-' + name.replace(/\s+/g, '-'));
      el?.scrollIntoView({block: 'center'}); el?.classList.add('is-flash'); setTimeout(() => el?.classList.remove('is-flash'), 1400);
      return;
    }
    if (!event.target.closest('.lore-card')) card.hidden = true;
  });
  search.addEventListener('input', () => renderGlossary(search.value));
  addEventListener('keydown', event => { if (event.key === 'Escape' && !card.hidden) { card.hidden = true; event.stopPropagation(); } }, true);
  function sync() {
    const on = section.dataset.directory === 'lore' && !section.hidden;
    reader.hidden = !on; empty.classList.toggle('is-lore-hidden', on); section.classList.toggle('is-lore', on);
  }
  new MutationObserver(sync).observe(section, {attributes: true, attributeFilter: ['data-directory', 'hidden']});
  renderParts(); renderGlossary(); tab('chapters'); select(saved.chapter); sync();
  window.Lore = {select, tab, read: readText};
})();
