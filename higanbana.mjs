// Минами Син: light SVG ornaments for the profile, plus a lazy real 3D opening.
// Petals are narrow, wavy and curled back at the tip; long stamens sweep out past them.
// Every part is its own element so the intro can unfurl the flower piece by piece.
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

// Keep Three/WebGL off the initial page load. All modules live beside this file.
export function prepareHiganbanaOpening() {
  return import('./minami-opening.mjs?v=3');
}

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function node(name, attributes = {}, parent) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent?.append(element);
  return element;
}

const fixed = value => Math.round(value * 10) / 10;

// One petal along +x: base at the origin, wavy body, tip curling back toward the stem.
function petalPath(length, width, wave, curl, phase) {
  const steps = 26, left = [], right = [];
  const centre = t => Math.sin(t * Math.PI * 2.3 + phase) * wave * t + (t > .7 ? curl * ((t - .7) / .3) ** 2 * length * .24 : 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = t > .7 ? (t - .7) / .3 : 0;
    const x = 16 + (length - 16) * t - k * k * k * length * .05, y = centre(t);
    const half = (width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12 + .03)), .75) * (1 - .5 * t) + .6) / 2;
    const dt = 1 / steps, ya = centre(Math.max(0, t - dt)), yb = centre(Math.min(1, t + dt));
    const dx = (length - 16) * 2 * dt, dy = yb - ya, size = Math.hypot(dx, dy) || 1;
    const nx = -dy / size, ny = dx / size;
    left.push([x + nx * half, y + ny * half]);
    right.push([x - nx * half, y - ny * half]);
  }
  const points = left.concat(right.reverse());
  return 'M' + points.map(([x, y]) => fixed(x) + ' ' + fixed(y)).join('L') + 'Z';
}

function veinPath(length, wave, curl, phase) {
  const parts = [];
  for (let i = 2; i <= 22; i++) {
    const t = i / 26;
    let x = 16 + (length - 16) * t;
    let y = Math.sin(t * Math.PI * 2.3 + phase) * wave * t;
    if (t > .7) {
      const k = (t - .7) / .3;
      y += curl * k * k * length * .24;
      x -= k * k * k * length * .05;
    }
    parts.push(fixed(x) + ' ' + fixed(y));
  }
  return 'M' + parts.join('L');
}

/**
 * Builds the flower. Returns {svg, petals, veins, stamens, anthers, heart, stem}.
 * reach — petal length in SVG units; the viewBox is 1000 wide around the flower's centre,
 * and with a stem it reaches stemLength units below the centre.
 */
export function createHiganbana({seed = 7, petals = 20, stamens = 30, reach = 200, stem = false, stemLength = 500, className = ''} = {}) {
  const rand = random(seed);
  const id = 'hb' + (++uid);
  const bottom = stem ? Math.max(500, stemLength) : 500;
  const svg = node('svg', {viewBox: `-500 -500 1000 ${500 + bottom}`, class: ('higanbana ' + className).trim(), 'aria-hidden': 'true', focusable: 'false'});
  const defs = node('defs', {}, svg);
  const petalFill = node('radialGradient', {id: id + 'p', cx: 0, cy: 0, r: reach * 1.15, gradientUnits: 'userSpaceOnUse'}, defs);
  for (const [offset, color] of [[0, '#4a0410'], [.28, '#9d0c25'], [.62, '#d8172f'], [.88, '#f03244'], [1, '#ff6070']]) node('stop', {offset, 'stop-color': color}, petalFill);
  const glow = node('radialGradient', {id: id + 'g'}, defs);
  node('stop', {offset: 0, 'stop-color': '#ff2b45', 'stop-opacity': '.42'}, glow);
  node('stop', {offset: .45, 'stop-color': '#c8102e', 'stop-opacity': '.16'}, glow);
  node('stop', {offset: 1, 'stop-color': '#ff2b45', 'stop-opacity': '0'}, glow);

  const parts = {svg, petals: [], veins: [], stamens: [], anthers: [], heart: null, stem: null, glow: null};
  if (stem) {
    parts.stem = node('path', {class: 'hb-stem', d: `M0 30C-16 ${fixed(30 + bottom * .34)} 20 ${fixed(30 + bottom * .66)} -6 ${bottom}`, fill: 'none', stroke: '#1d2b17', 'stroke-width': 9, 'stroke-linecap': 'round', pathLength: 1}, svg);
  }
  parts.glow = node('circle', {class: 'hb-glow', r: reach * 1.7, fill: `url(#${id}g)`}, svg);
  const flower = node('g', {class: 'hb-flower'}, svg);
  parts.flower = flower;

  // Petals: a ring of narrow, wavy, recurved petals (six florets of a real umbel, seen from above).
  const back = node('g', {class: 'hb-petals'}, flower);
  for (let i = 0; i < petals; i++) {
    const angle = i * 360 / petals + (rand() - .5) * 11;
    const length = reach * (.84 + rand() * .32);
    const width = reach * (.1 + rand() * .045);
    const wave = reach * (.03 + rand() * .03);
    const curl = rand() < .5 ? 1 : -1;
    const phase = rand() * Math.PI * 2;
    const holder = node('g', {transform: `rotate(${fixed(angle)})`}, back);
    const unit = node('g', {class: 'hb-petal'}, holder);
    node('path', {d: petalPath(length, width, wave, curl, phase), fill: `url(#${id}p)`}, unit);
    const vein = node('path', {class: 'hb-vein', d: veinPath(length, wave, curl, phase), fill: 'none', stroke: '#ff8a96', 'stroke-opacity': '.42', 'stroke-width': Math.max(1, reach * .006), 'stroke-linecap': 'round'}, unit);
    parts.petals.push(unit);
    parts.veins.push(vein);
  }

  // Stamens: long red filaments sweeping past the petals with pale pollen at the tips.
  const threads = node('g', {class: 'hb-stamens'}, flower);
  const swirl = rand() < .5 ? 1 : -1;
  for (let i = 0; i < stamens; i++) {
    const angle = i * 360 / stamens + (rand() - .5) * 9;
    const length = reach * (1.28 + rand() * .42);
    const bend = swirl * (14 + rand() * 16) * Math.PI / 180;
    const ex = Math.cos(bend) * length, ey = Math.sin(bend) * length;
    const cx = length * .55, cy = swirl * length * (.02 + rand() * .06);
    const holder = node('g', {transform: `rotate(${fixed(angle)})`}, threads);
    const thread = node('path', {class: 'hb-stamen', d: `M${fixed(reach * .1)} 0Q${fixed(cx)} ${fixed(cy)} ${fixed(ex)} ${fixed(ey)}`, fill: 'none', stroke: '#f03a4d', 'stroke-width': Math.max(1, reach * (.008 + rand() * .004)), 'stroke-linecap': 'round', pathLength: 1}, holder);
    const tangent = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
    const tip = node('g', {transform: `translate(${fixed(ex)} ${fixed(ey)}) rotate(${fixed(tangent)})`}, holder);
    const anther = node('ellipse', {class: 'hb-anther', cx: 0, cy: 0, rx: fixed(reach * .03), ry: fixed(reach * .012), fill: rand() < .7 ? '#f6c98a' : '#ffd9b0'}, tip);
    parts.stamens.push(thread);
    parts.anthers.push(anther);
  }

  parts.heart = node('g', {class: 'hb-heart'}, flower);
  node('circle', {r: fixed(reach * .12), fill: '#5a0715'}, parts.heart);
  node('circle', {r: fixed(reach * .065), fill: '#b3122b'}, parts.heart);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + rand() * .4;
    node('circle', {cx: fixed(Math.cos(a) * reach * .07), cy: fixed(Math.sin(a) * reach * .07), r: fixed(reach * .016), fill: '#f6c98a', 'fill-opacity': '.8'}, parts.heart);
  }
  return parts;
}

// The intro: stem rises, the bud opens, petals unfurl and the stamens shoot out.
// Returns the animations so the caller can cancel them.
export function bloom(parts, {delay = 0, speed = 1, stem = true} = {}) {
  const animations = [];
  const at = ms => delay + ms * speed;
  const play = (element, frames, options) => {
    if (!element) return;
    animations.push(element.animate(frames, {fill: 'both', ...options}));
  };
  if (stem && parts.stem) play(parts.stem, [{strokeDasharray: '1 1', strokeDashoffset: 1}, {strokeDasharray: '1 1', strokeDashoffset: 0}], {duration: 520 * speed, delay: at(0), easing: 'cubic-bezier(.3,0,.2,1)'});
  play(parts.glow, [{opacity: 0, transform: 'scale(.2)'}, {opacity: 1, transform: 'scale(1)'}], {duration: 1300 * speed, delay: at(380), easing: 'ease-out'});
  play(parts.heart, [{transform: 'scale(0)'}, {transform: 'scale(1.25)', offset: .7}, {transform: 'scale(1)'}], {duration: 520 * speed, delay: at(330), easing: 'ease-out'});
  const order = parts.petals.map((_, index) => index).sort((a, b) => ((a * 7) % parts.petals.length) - ((b * 7) % parts.petals.length));
  order.forEach((index, rank) => {
    const start = at(560 + rank * 26);
    play(parts.petals[index], [
      {transform: 'rotate(-38deg) scale(.06,.28)', opacity: 0},
      {opacity: 1, offset: .18},
      {transform: 'rotate(5deg) scale(1.04,1.02)', offset: .72},
      {transform: 'rotate(0deg) scale(1)', opacity: 1}
    ], {duration: 820 * speed, delay: start, easing: 'cubic-bezier(.2,.75,.25,1)'});
    play(parts.veins[index], [{opacity: 0}, {opacity: 0, offset: .5}, {opacity: 1}], {duration: 820 * speed, delay: start});
  });
  parts.stamens.forEach((thread, index) => {
    const start = at(880 + ((index * 11) % parts.stamens.length) * 17);
    play(thread, [{strokeDasharray: '1 1', strokeDashoffset: 1}, {strokeDasharray: '1 1', strokeDashoffset: 0}], {duration: 640 * speed, delay: start, easing: 'cubic-bezier(.15,.7,.2,1)'});
    play(parts.anthers[index], [{opacity: 0, transform: 'scale(.1)'}, {opacity: 1, transform: 'scale(1)'}], {duration: 300 * speed, delay: start + 520 * speed, easing: 'ease-out'});
  });
  return animations;
}
