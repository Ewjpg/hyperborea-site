// The CRT itself (terminal-intro.css): the glass of the tube sits over everything, and CrtPower() lights the tube
// as a thin white line that opens into the picture. HYPERBOREA OS (hyper-os.js) calls it when the picture comes on,
// two seconds after the computer's switch is heard.
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const glass = document.createElement('div'); glass.className = 'crt-glass'; glass.setAttribute('aria-hidden', 'true');
  screen.append(glass);
  window.CrtPower = () => {
    if (motion.matches) return;
    const power = document.createElement('div'); power.className = 'crt-power'; power.setAttribute('aria-hidden', 'true');
    screen.append(power);
    power.addEventListener('animationend', () => power.remove(), {once: true});
    setTimeout(() => power.remove(), 1600);
  };
})();
