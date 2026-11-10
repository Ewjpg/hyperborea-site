// The app's own mouse pointer (only inside the HYPERBOREA app, never on the website or a touch screen):
// a glowing pixel arrow like on an old CRT monitor. Now and then it lags — freezes, then jumps with a colour
// split — and once in a while it turns into a smooth modern pointer for a few seconds before going back.
(() => {
  'use strict';
  if (location.protocol !== 'hyperborea:') return;
  const fine = matchMedia('(pointer: fine)'), motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches) return;
  document.documentElement.classList.add('app-cursor');
  const cursor = document.createElement('div');
  cursor.className = 'crt-cursor'; cursor.setAttribute('aria-hidden', 'true');
  // A 12×19 pixel arrow, drawn as an SVG of squares so it stays crisp and blocky at any scale.
  const ARROW = ['X', 'XX', 'X.X', 'X..X', 'X...X', 'X....X', 'X.....X', 'X......X', 'X.......X', 'X........X', 'X.........X', 'X......XXXXX', 'X...X..X', 'X..XX..X', 'X.X  X..X', 'XX   X..X', 'X     X..X', '      X..X', '       XX'];
  const cells = []; ARROW.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') cells.push(`<rect x="${x}" y="${y}" width="1" height="1" class="edge"/>`); else if (c === '.') cells.push(`<rect x="${x}" y="${y}" width="1" height="1" class="body"/>`); }));
  cursor.innerHTML = `<svg class="crt-arrow" viewBox="0 0 12 19" shape-rendering="crispEdges">${cells.join('')}</svg><span class="crt-beam"></span><span class="modern-dot"></span><span class="modern-ring"></span>`;
  document.body.append(cursor);
  let x = -100, y = -100, shownX = -100, shownY = -100, frozen = false, modern = false, frame = 0, seen = false;
  const later = (fn, ms) => setTimeout(fn, ms);
  function paint() {
    frame = 0;
    if (!frozen) {
      // The CRT pointer follows exactly; the modern one glides.
      const k = modern ? .35 : 1;
      shownX += (x - shownX) * k; shownY += (y - shownY) * k;
    }
    cursor.style.transform = `translate(${shownX.toFixed(1)}px,${shownY.toFixed(1)}px)`;
    if (modern && (Math.abs(x - shownX) > .3 || Math.abs(y - shownY) > .3)) frame = requestAnimationFrame(paint);
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
  addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    x = event.clientX; y = event.clientY;
    if (!seen) { seen = true; shownX = x; shownY = y; cursor.classList.add('is-on'); }
    // What is under the pointer decides its shape: text fields get a beam, anything clickable a brighter glow.
    const target = event.target instanceof Element ? event.target : null;
    const text = target?.closest('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]),textarea,[contenteditable="true"]');
    const link = !text && target?.closest('button,a,[role=button],label,select,summary,input,.space-node');
    cursor.classList.toggle('is-text', !!text); cursor.classList.toggle('is-link', !!link);
    queue();
  }, {passive: true});
  addEventListener('pointerdown', () => { cursor.classList.add('is-down'); }, {passive: true});
  addEventListener('pointerup', () => { cursor.classList.remove('is-down'); }, {passive: true});
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-on'));
  document.addEventListener('mouseenter', () => { if (seen) cursor.classList.add('is-on'); });
  // The lag: a frozen moment, then a jump with a red and blue double.
  function lag() {
    if (!motion.matches && !document.hidden && seen && !modern) {
      frozen = true; cursor.classList.add('is-lag');
      later(() => { frozen = false; queue(); later(() => cursor.classList.remove('is-lag'), 140); }, 120 + Math.random() * 280);
    }
    later(lag, 10000 + Math.random() * 10000);
  }
  // The upgrade: a few seconds of a smooth modern pointer, flickering in and out like a bad signal.
  function upgrade() {
    if (!motion.matches && !document.hidden && seen) {
      cursor.classList.add('is-switch');
      later(() => { modern = true; cursor.classList.add('is-modern'); cursor.classList.remove('is-switch'); queue(); }, 220);
      const stay = 3600 + Math.random() * 2400;
      later(() => { cursor.classList.add('is-switch'); }, stay);
      later(() => { modern = false; cursor.classList.remove('is-modern', 'is-switch'); shownX = x; shownY = y; queue(); }, stay + 220);
    }
    later(upgrade, 20000 + Math.random() * 25000);
  }
  later(lag, 4000); later(upgrade, 15000);
})();
