// "SYSTEM UPDATE": real app updates shown as a terminal event (only inside the app, through preload.js).
// While the new version downloads, a small panel in the corner shows its progress without blocking anything;
// once it is ready, the screen offers a restart, and the CRT switches off to a dot before the app reinstalls.
// The new version then opens with the usual power-on flash (terminal-intro.js).
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const bridge = window.HyperboreaApp;
  const panel = document.createElement('aside');
  panel.className = 'sysupd-panel'; panel.hidden = true; panel.setAttribute('role', 'status');
  panel.innerHTML = '<span class="sysupd-dot"></span><div><b>SYSTEM UPDATE <span data-v></span></b><small data-s>DOWNLOADING PACKAGE…</small><i class="sysupd-bar"><i></i></i></div>';
  const overlay = document.createElement('section');
  overlay.className = 'sysupd'; overlay.hidden = true; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'sysupdTitle');
  overlay.innerHTML = '<img class="sysupd-mark" src="./assets/bluelock-mark.svg" alt="">'
    + '<p class="sysupd-kicker">HYPERBOREA OS</p><h2 id="sysupdTitle">SYSTEM UPDATE <span data-v></span> READY</h2>'
    + '<div class="sysupd-log" aria-live="polite"></div><i class="sysupd-bar big"><i></i></i>'
    + '<div class="sysupd-actions"><button type="button" data-install>[ RESTART NOW ]</button><button type="button" data-later>[ LATER ]</button></div>';
  const off = document.createElement('div'); off.className = 'crt-off'; off.hidden = true; off.setAttribute('aria-hidden', 'true');
  screen.append(panel, overlay, off);
  const setVersion = v => { for (const el of [...panel.querySelectorAll('[data-v]'), ...overlay.querySelectorAll('[data-v]')]) el.textContent = v || ''; };
  const setProgress = p => { for (const bar of document.querySelectorAll('.sysupd-bar>i')) bar.style.width = Math.max(0, Math.min(100, p)) + '%'; panel.querySelector('[data-s]').textContent = p >= 100 ? 'PACKAGE VERIFIED' : 'DOWNLOADING PACKAGE… ' + Math.round(p) + '%'; };
  const log = overlay.querySelector('.sysupd-log');
  const say = text => { const line = document.createElement('div'); line.textContent = '> ' + text; log.append(line); };
  let version = '', later = false;
  function available(v) { version = v || version; setVersion(version); panel.hidden = false; setProgress(0); }
  function ready(v) {
    version = v || version; setVersion(version); setProgress(100); panel.hidden = true;
    if (later) return;
    log.replaceChildren(); overlay.hidden = false;
    say('PACKAGE ' + version + ' DOWNLOADED'); setTimeout(() => say('INTEGRITY CHECK ........ OK'), 350); setTimeout(() => say('REBOOT REQUIRED'), 700);
    overlay.querySelector('[data-install]').focus({preventScroll: true});
  }
  // The CRT goes out the old way: the picture squeezes into a line, then into a dot, then dark.
  function install() {
    overlay.querySelector('[data-install]').disabled = true;
    say('REBOOTING…');
    const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    off.hidden = false; off.classList.toggle('is-instant', motion);
    setTimeout(() => (bridge ? bridge.installUpdate() : location.reload()), motion ? 100 : 1050);
  }
  overlay.querySelector('[data-install]').addEventListener('click', install);
  overlay.querySelector('[data-later]').addEventListener('click', () => {
    later = true; overlay.hidden = true; bridge?.laterUpdate();
    // A reminder stays in the corner: it installs on closing the app anyway.
    panel.hidden = false; panel.querySelector('[data-s]').textContent = 'INSTALLS ON EXIT · CLICK TO RESTART';
    panel.classList.add('is-ready');
  });
  panel.addEventListener('click', () => { if (panel.classList.contains('is-ready')) { later = false; ready(version); } });
  bridge?.onUpdate(info => {
    if (!info) return;
    if (info.state === 'available') available(info.version);
    else if (info.state === 'progress') { panel.hidden = false; setProgress(info.percent); }
    else if (info.state === 'ready') ready(info.version);
  });
  // For trying it out without a real release: SystemUpdate.simulate('1.2').
  window.SystemUpdate = {simulate(v = '1.2') { available(v); let p = 0; const t = setInterval(() => { p += 9 + Math.random() * 14; setProgress(Math.min(100, p)); if (p >= 100) { clearInterval(t); setTimeout(() => ready(v), 400); } }, 260); }};
})();
