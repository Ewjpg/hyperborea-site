// PLAYERS as a planet: entering flies through the Blue Lock mark, then a globe of dotted continents turns
// under the pointer and every player stands on their own country. It replaces players-space.js but keeps
// its hooks: cards stay the same buttons (wrapped in .space-node), the roster gets space-ready / space-fallback,
// and window.PlayersSpace still offers refresh(), resetView() and getState().
(() => {
  'use strict';
  const roster = document.getElementById('playersRoster');
  const database = document.getElementById('database');
  const section = document.getElementById('dbSection');
  if (!roster || !database || !section) return;
  const cards = [...roster.querySelectorAll(':scope > button[id]')];
  if (!cards.length) return;
  // Where each player is from: [latitude, longitude, country]. Frog's country is unknown: he stands alone mid-ocean.
  const HOMES = {
    fearCard: [51.2, 10.4, 'Германия'], wahCard: [46.6, 2.4, 'Франция'], frogCard: [-8, -140, 'Неизвестно'],
    swarggyCard: [37.8, 140.6, 'Япония'], emilianoCard: [40.2, -3.7, 'Испания'], yoruCard: [33.6, 132.4, 'Япония']
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  roster.classList.add('players-space', 'players-globe');
  const backdrop = document.createElement('div');
  backdrop.className = 'space-backdrop'; backdrop.setAttribute('aria-hidden', 'true');
  roster.prepend(backdrop);
  const hud = document.createElement('span'); hud.className = 'space-hud';
  hud.textContent = String(cards.length).padStart(2, '0') + ' / PLAYERS';
  roster.append(hud);
  const controls = document.createElement('div'); controls.className = 'space-controls'; controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Управление планетой');
  const control = (label, text, action) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.textContent = text; b.addEventListener('click', action); controls.append(b); return b; };
  control('Отдалить', '−', () => zoomBy(1 / 1.2));
  const zoomLabel = document.createElement('output'); zoomLabel.className = 'space-zoom'; controls.append(zoomLabel);
  control('Приблизить', '+', () => zoomBy(1.2));
  control('Вернуть исходный вид', '⌂', () => resetView());
  roster.append(controls);
  // The entrance: the Blue Lock mark rushes toward the viewer until we pass through it.
  const intro = document.createElement('div'); intro.className = 'globe-intro'; intro.hidden = true; intro.setAttribute('aria-hidden', 'true');
  intro.innerHTML = '<img src="./assets/bluelock-mark.svg" alt="">';
  roster.append(intro);
  roster.tabIndex = 0;
  roster.setAttribute('aria-label', 'Планета игроков: перетащи, чтобы повернуть; колесо или два пальца — масштаб');
  const nodes = cards.map(card => {
    const wrapper = document.createElement('div'); wrapper.className = 'space-node';
    card.before(wrapper); wrapper.append(card);
    const [lat, lon, country] = HOMES[card.id] || [0, 0, ''];
    // The country's name, written on the planet at the foot of the pin.
    // One name per country, even when two players share it (Japan).
    const label = document.createElement('span'); label.className = 'globe-country'; label.setAttribute('aria-hidden', 'true'); label.textContent = country.toUpperCase();
    if (!roster.querySelector('.globe-country[data-country="' + country + '"]')) { label.dataset.country = country; roster.append(label); }
    return {card, wrapper, label, lat, lon, country, hovered: false, offset: {x: 0, y: 0}, projected: null, visible: false};
  });

  // View: the globe's rotation (yaw/pitch) with inertia, and the camera distance.
  const view = {yaw: -1.62, pitch: .32, zoom: 1, vyaw: 0, vpitch: 0};
  const HOME = {yaw: -1.62, pitch: .32};
  let scene = null, pending = null, failed = false, active = false, directoryVisible = false, frame = 0, previous = 0, idle = 0;
  let introStart = 0, entries = 0, drag = null;
  const pointers = new Map();
  const visible = () => database.classList.contains('active') && !roster.hidden && !section.hidden && !roster.classList.contains('space-suspended');

  function zoomBy(k) { view.zoom = Math.max(.6, Math.min(2.2, view.zoom * k)); idle = 0; kick(); }
  function resetView() { view.yaw = HOME.yaw; view.pitch = HOME.pitch; view.zoom = 1; view.vyaw = view.vpitch = 0; kick(); }
  function kick() { if (active && scene && !frame) { previous = 0; frame = requestAnimationFrame(tick); } }

  function tick(now) {
    frame = 0;
    if (!active || !scene || document.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0; previous = now;
    idle += dt;
    // A slow turn when left alone; a flick keeps spinning and slows down.
    if (!drag && !motion.matches) {
      view.yaw += view.vyaw * dt; view.pitch += view.vpitch * dt;
      const damp = Math.exp(-2.6 * dt); view.vyaw *= damp; view.vpitch *= damp;
      if (idle > 3 && !nodes.some(n => n.hovered)) view.yaw += .06 * dt;
    }
    view.pitch = Math.max(-1.1, Math.min(1.1, view.pitch));
    const entrance = introStart ? Math.min(1, (now - introStart) / 1600) : 1;
    scene.render(view, entrance);
    place(entrance);
    zoomLabel.value = Math.round(view.zoom * 100) + '%';
    frame = requestAnimationFrame(tick);
  }

  // Cards stand on their countries; on the far side of the planet they fade out, and two players from the same
  // country are pushed apart so they never cover each other.
  function place(entrance) {
    const width = roster.clientWidth, height = roster.clientHeight;
    for (const node of nodes) {
      const p = scene.project(node.lat, node.lon, 1.16);
      node.projected = p;
      const base = scene.project(node.lat, node.lon, 1.0);
      node.label.style.transform = `translate(${base.x.toFixed(1)}px,${(base.y + 6).toFixed(1)}px) translateX(-50%)`;
      node.label.classList.toggle('is-far', !(base.facing > .2 && entrance > .55));
      node.visible = p.facing > .12 && entrance > .55;
    }
    // Overlapping cards are spread apart: start from where the pins put them and push pairs apart a few times.
    const shown = nodes.filter(n => n.visible);
    for (const n of shown) n.spot = {x: n.projected.x, y: n.projected.y};
    for (let pass = 0; pass < 10; pass++) for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
      const a = shown[i], b = shown[j], dx = b.spot.x - a.spot.x, dy = b.spot.y - a.spot.y;
      const gapX = 150 * (a.projected.scale + b.projected.scale) / 2 + 44 - Math.abs(dx), gapY = 194 * (a.projected.scale + b.projected.scale) / 2 + 30 - Math.abs(dy);
      if (gapX > 0 && gapY > 0) {
        // Sideways is the shorter way out for cards that are taller than they are wide.
        if (gapX < gapY * 1.4) { const s = gapX / 2 * Math.sign(dx || (i % 2 ? 1 : -1)); a.spot.x -= s; b.spot.x += s; }
        else { const s = gapY / 2 * Math.sign(dy || 1); a.spot.y -= s; b.spot.y += s; }
      }
    }
    // Cards stay on screen: their bottom edge never goes above the top margin, nor past the sides.
    for (const n of shown) {
      const s = n.projected.scale;
      n.spot.y = Math.max(194 * s + 64, Math.min(height - 24, n.spot.y));
      n.spot.x = Math.max(75 * s + 16, Math.min(width - 75 * s - 16, n.spot.x));
      n.target = {x: n.spot.x - n.projected.x, y: n.spot.y - n.projected.y};
    }
    for (const node of nodes) {
      const target = node.visible ? node.target : {x: 0, y: 0};
      node.offset.x += (target.x - node.offset.x) * .2; node.offset.y += (target.y - node.offset.y) * .2;
      const p = node.projected, s = p.scale;
      // The card's bottom centre sits on the pin's tip.
      const x = p.x + node.offset.x - 75, y = p.y + node.offset.y - 194;
      node.wrapper.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      node.wrapper.style.transformOrigin = '50% 100%';
      node.wrapper.style.zIndex = String(node.hovered ? 9 : 2 + Math.round(p.facing * 5));
      node.wrapper.classList.toggle('is-far', !node.visible);
      node.card.tabIndex = node.visible ? 0 : -1;
      if (x < -300 || x > width + 300 || y < -400 || y > height + 300) node.wrapper.classList.add('is-far');
    }
  }

  function start() {
    if (scene) { kick(); return; }
    if (pending || failed) return;
    pending = Promise.all([import('./vendor/three.module.min.js'), loadMask(), fetch('./assets/world-borders.json?v=1').then(r => r.ok ? r.json() : []).catch(() => [])]).then(([THREE, mask, borders]) => {
      mask.borders = borders;
      pending = null;
      if (!active) return;
      scene = createScene(THREE, mask);
      roster.classList.add('space-ready'); roster.classList.remove('space-fallback');
      kick();
    }).catch(error => {
      pending = null; failed = true; console.warn('Players globe:', error);
      roster.classList.add('space-fallback'); roster.classList.remove('space-ready');
      nodes.forEach(node => { node.wrapper.style.removeProperty('transform'); node.card.tabIndex = 0; node.wrapper.classList.remove('is-far'); });
    });
  }
  function loadMask() {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = 'async';
      image.onload = () => { const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const x = c.getContext('2d'); x.drawImage(image, 0, 0); resolve({width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data}); };
      image.onerror = () => reject(new Error('World map'));
      image.src = './assets/world-land.png?v=2';
    });
  }
  function playIntro() {
    if (motion.matches) { introStart = 0; return; }
    introStart = performance.now();
    intro.hidden = false;
    const mark = intro.firstElementChild;
    const fly = [
      {transform: 'scale(.35)', opacity: 0, filter: 'blur(0)'},
      {transform: 'scale(1)', opacity: 1, offset: .25, filter: 'blur(0)'},
      {transform: 'scale(1.25)', opacity: 1, offset: .45, filter: 'blur(0)'},
      {transform: 'scale(38)', opacity: 0, filter: 'blur(6px)'}
    ];
    mark.animate(fly, {duration: 1300, easing: 'cubic-bezier(.7,0,.25,1)', fill: 'both'}).finished.then(() => { intro.hidden = true; }, () => { intro.hidden = true; });
    intro.animate([{opacity: 1}, {opacity: 1, offset: .7}, {opacity: 0}], {duration: 1300, fill: 'both'});
  }
  function refresh() {
    const directory = visible();
    if (directory && !directoryVisible) { entries++; resetView(); playIntro(); }
    directoryVisible = directory;
    const next = directory && !document.hidden;
    if (next === active) { if (next) start(); return; }
    active = next;
    if (active) start(); else { cancelAnimationFrame(frame); frame = 0; pointers.clear(); drag = null; roster.classList.remove('is-dragging'); }
  }

  // Dragging turns the planet (cards included); two fingers or the wheel zoom.
  roster.addEventListener('pointerdown', event => {
    if (!active || event.button > 0 || event.target.closest('.space-controls,.space-node')) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    event.preventDefault(); roster.setPointerCapture(event.pointerId); roster.classList.add('is-dragging');
    drag = {x: event.clientX, y: event.clientY, t: performance.now(), distance: 0};
    view.vyaw = view.vpitch = 0; idle = 0;
  });
  roster.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !drag) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pointers.size > 1) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.distance) zoomBy(distance / drag.distance);
      drag.distance = distance; return;
    }
    const now = performance.now(), dt = Math.max(.008, (now - drag.t) / 1000), k = 3.2 / Math.max(300, roster.clientHeight) / view.zoom;
    const dyaw = (event.clientX - drag.x) * k, dpitch = (event.clientY - drag.y) * k;
    view.yaw += dyaw; view.pitch += dpitch;
    view.vyaw = view.vyaw * .5 + dyaw / dt * .5; view.vpitch = view.vpitch * .5 + dpitch / dt * .5;
    drag.x = event.clientX; drag.y = event.clientY; drag.t = now; idle = 0;
  }, {passive: true});
  const release = event => {
    pointers.delete(event.pointerId);
    if (roster.hasPointerCapture(event.pointerId)) roster.releasePointerCapture(event.pointerId);
    if (!pointers.size) { drag = null; roster.classList.remove('is-dragging'); }
  };
  roster.addEventListener('pointerup', release); roster.addEventListener('pointercancel', release);
  roster.addEventListener('wheel', event => { if (!active) return; event.preventDefault(); zoomBy(Math.exp(-Math.max(-300, Math.min(300, event.deltaY)) * .0015)); }, {passive: false});
  roster.addEventListener('keydown', event => {
    if (event.target !== roster) return;
    const turns = {ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.15], ArrowDown: [0, .15]};
    if (turns[event.key]) { event.preventDefault(); view.yaw += turns[event.key][0]; view.pitch += turns[event.key][1]; idle = 0; }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.2); }
    else if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.2); }
    else if (event.key === 'Home') { event.preventDefault(); resetView(); }
  });
  for (const node of nodes) {
    node.card.addEventListener('pointerenter', () => { node.hovered = true; });
    node.card.addEventListener('pointerleave', () => { node.hovered = false; });
    // A card reached with the keyboard turns its country to the front.
    node.card.addEventListener('focus', () => { if (!node.card.matches(':focus-visible')) return; view.yaw = -node.lon * Math.PI / 180 - Math.PI / 2; view.pitch = node.lat * Math.PI / 180 * .8; view.vyaw = view.vpitch = 0; idle = 0; });
  }
  new MutationObserver(refresh).observe(roster, {attributes: true, attributeFilter: ['hidden', 'class']});
  for (const element of [section, database]) new MutationObserver(refresh).observe(element, {attributes: true, attributeFilter: ['hidden', 'class']});
  new ResizeObserver(() => { scene?.resize(); kick(); }).observe(roster);
  document.addEventListener('visibilitychange', refresh);
  window.PlayersSpace = {refresh, shuffle: resetView, resetView, getState: () => ({active, ready: !!scene, failed, entries, view: {...view},
    positions: nodes.map(n => ({id: n.card.id, country: n.country, visible: n.visible, ...(n.projected || {})}))})};
  refresh();

  function createScene(THREE, mask) {
    const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setClearColor(0x000000, 0);
    backdrop.append(renderer.domElement);
    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    const globe = new THREE.Group(); world.add(globe);
    // The ocean: a dark sphere whose rim glows Blue Lock blue.
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(.995, 64, 48), new THREE.ShaderMaterial({
      uniforms: {}, transparent: false,
      vertexShader: 'varying vec3 vNormal;varying vec3 vView;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-max(0.,dot(vNormal,vView)),2.6);vec3 c=mix(vec3(.012,.03,.07),vec3(.11,.38,1.),rim);gl_FragColor=vec4(c,1.);}'
    }));
    globe.add(ocean);
    // Continents as glowing dots: evenly spread points kept where the map is land.
    const land = (lat, lon) => {
      const x = Math.floor((lon + 180) / 360 * mask.width) % mask.width, y = Math.min(mask.height - 1, Math.floor((90 - lat) / 180 * mask.height));
      return mask.data[(y * mask.width + x) * 4] > 127;
    };
    // The green channel marks the players' countries; their dots are brighter and larger.
    const home = (lat, lon) => {
      const x = Math.floor((lon + 180) / 360 * mask.width) % mask.width, y = Math.min(mask.height - 1, Math.floor((90 - lat) / 180 * mask.height));
      return mask.data[(y * mask.width + x) * 4 + 1] > 127;
    };
    const toVector = (lat, lon, r, target = new THREE.Vector3()) => {
      const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
      return target.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    };
    const positions = [], homes = [], count = 34000, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2, radius = Math.sqrt(1 - y * y), theta = golden * i;
      const lat = Math.asin(y) * 180 / Math.PI, lon = ((Math.atan2(Math.sin(theta) * radius, Math.cos(theta) * radius) * 180 / Math.PI) + 540) % 360 - 180;
      if (land(lat, lon)) { const v = toVector(lat, lon, 1.001); (home(lat, lon) ? homes : positions).push(v.x, v.y, v.z); }
    }
    const dots = new THREE.BufferGeometry(); dots.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const dotMaterial = new THREE.PointsMaterial({color: 0xa8ceff, size: 2.8, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false});
    globe.add(new THREE.Points(dots, dotMaterial));
    const homeDots = new THREE.BufferGeometry(); homeDots.setAttribute('position', new THREE.Float32BufferAttribute(homes, 3));
    globe.add(new THREE.Points(homeDots, new THREE.PointsMaterial({color: 0xffffff, size: 3.6, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false})));
    // Borders between countries as thin lines.
    const border = [];
    for (const line of mask.borders || []) for (let i = 0; i + 3 < line.length; i += 2) { const a = toVector(line[i + 1], line[i], 1.003), b = toVector(line[i + 3], line[i + 2], 1.003); border.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const borderGeometry = new THREE.BufferGeometry(); borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(border, 3));
    globe.add(new THREE.LineSegments(borderGeometry, new THREE.LineBasicMaterial({color: 0x9cc2ff, transparent: true, opacity: .55, depthWrite: false})));
    // A faint grid of meridians and parallels.
    const grid = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 4) { const a = toVector(lat, lon, 1.002), b = toVector(lat, lon + 4, 1.002); grid.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) { const a = toVector(lat, lon, 1.002), b = toVector(lat + 4, lon, 1.002); grid.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const gridGeometry = new THREE.BufferGeometry(); gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    globe.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({color: 0x2d5aa8, transparent: true, opacity: .22, depthWrite: false})));
    // Pins: a line up from each player's country and a glowing dot where it meets the surface.
    const pins = [], heads = [];
    for (const node of nodes) { const a = toVector(node.lat, node.lon, 1.002), b = toVector(node.lat, node.lon, 1.16); pins.push(a.x, a.y, a.z, b.x, b.y, b.z); heads.push(a.x, a.y, a.z); }
    const pinGeometry = new THREE.BufferGeometry(); pinGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pins, 3));
    globe.add(new THREE.LineSegments(pinGeometry, new THREE.LineBasicMaterial({color: 0xbfe0ff, transparent: true, opacity: .85})));
    const headGeometry = new THREE.BufferGeometry(); headGeometry.setAttribute('position', new THREE.Float32BufferAttribute(heads, 3));
    globe.add(new THREE.Points(headGeometry, new THREE.PointsMaterial({color: 0xffffff, size: 7, sizeAttenuation: false})));
    // Atmosphere halo behind the planet, and a field of stars.
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.18, 48, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vNormal;varying vec3 vView;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 vNormal;varying vec3 vView;void main(){float a=pow(max(0.,dot(vNormal,vView)),3.2);gl_FragColor=vec4(vec3(.15,.42,1.)*a,a);}'
    }));
    world.add(halo);
    const stars = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); stars.push(v.x, v.y, v.z); }
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    world.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({color: 0x9fb8e0, size: 1.3, sizeAttenuation: false, transparent: true, opacity: .7})));
    const work = new THREE.Vector3(), normal = new THREE.Vector3(), toCamera = new THREE.Vector3();
    let width = 1, height = 1, distance = 3.6;
    function resize() {
      width = Math.max(1, roster.clientWidth); height = Math.max(1, roster.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    resize();
    return {
      resize,
      render(v, entrance) {
        globe.rotation.set(v.pitch, v.yaw, 0);
        // Fly in from far away during the entrance; a narrow screen pulls back so the whole planet fits.
        const fit = Math.max(1, .95 / camera.aspect), eased = 1 - Math.pow(1 - entrance, 3);
        distance = (2.85 * fit / v.zoom) + (1 - eased) * 14;
        camera.position.set(0, 0, distance); camera.lookAt(0, 0, 0);
        renderer.render(world, camera);
      },
      project(lat, lon, r) {
        toVector(lat, lon, r, work).applyEuler(globe.rotation);
        normal.copy(work).normalize(); toCamera.copy(camera.position).sub(work).normalize();
        const facing = normal.dot(toCamera);
        const depth = camera.position.distanceTo(work);
        work.project(camera);
        return {x: (work.x + 1) / 2 * width, y: (1 - work.y) / 2 * height, facing, scale: Math.max(.55, Math.min(1.15, 3.0 / depth * (.75 + .25 * Math.max(0, facing))))};
      },
      dispose() { renderer.dispose(); renderer.domElement.remove(); }
    };
  }
})();
