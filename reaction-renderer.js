import * as THREE from './vendor/three.module.min.js';

// The relief is created only while a chemical reaction exists. It shares the
// locally vendored Three.js runtime with the pitch and never loads assets.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function taperedTube(points, radius, segments = 24, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], normals = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPointAt(t);
    const r = radius * (.035 + .965 * Math.pow(1 - t, .8));
    for (let j = 0; j <= radial; j++) {
      const angle = j / radial * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(frames.binormals[i], Math.sin(angle));
      positions.push(center.x + normal.x * r, center.y + normal.y * r, center.z + normal.z * r);
      normals.push(normal.x, normal.y, normal.z);
      if (i < segments && j < radial) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function mesh(geometry, material, parent, position) {
  const result = new THREE.Mesh(geometry, material);
  if (position) result.position.copy(position);
  parent.add(result);
  return result;
}

/** A lit, sculptural fear relief behind the reaction's existing text and icons. */
export function createReactionRenderer(host) {
  if (!(host instanceof HTMLElement)) throw new Error('Reaction container is missing.');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement;
  canvas.className = 'sim-reaction-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 40);
  const relief = new THREE.Group();
  scene.add(relief);
  const black = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: .3, metalness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x010103, roughness: .42, metalness: .35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x12316e, emissive: 0x063ba5, emissiveIntensity: .65, roughness: .35, metalness: .55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x697081, emissiveIntensity: .22, roughness: .24, metalness: .45 });
  const rim = new THREE.MeshBasicMaterial({ color: 0x1c5fdb, transparent: true, opacity: .3, depthWrite: false });

  scene.add(new THREE.AmbientLight(0x7984a7, .65));
  const topLight = new THREE.DirectionalLight(0xd7e3ff, 2.8);
  topLight.position.set(-3, 6, 6); scene.add(topLight);
  const edgeLight = new THREE.DirectionalLight(0x1550f0, 4);
  edgeLight.position.set(4, 1, -1); scene.add(edgeLight);
  const keyLight = new THREE.PointLight(0xe8edff, 13, 8, 2);
  keyLight.position.set(-.7, 1, 3); scene.add(keyLight);

  // A convex black eye, thick upper/lower lids and a recessed vertical pupil.
  const eye = new THREE.Group(); relief.add(eye);
  const globe = mesh(new THREE.SphereGeometry(1, 32, 18), dark, eye);
  globe.scale.set(1.58, .67, .42);
  const lids = new THREE.Group(); eye.add(lids);
  for (const side of [-1, 1]) {
    const points = [v(-1.67, 0, .12), v(-.9, side * .53, .35), v(0, side * .72, .47), v(.9, side * .53, .35), v(1.67, 0, .12)];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, .095, 8, false), black, lids);
    mesh(taperedTube([v(-1.69, .01, .1), v(-1.89, side * .3, .04), v(-2.04, side * .58, -.08)], .115, 15), black, lids);
    mesh(taperedTube([v(1.69, .01, .1), v(1.89, side * .3, .04), v(2.04, side * .58, -.08)], .115, 15), black, lids);
  }
  const gaze = new THREE.Group(); gaze.position.z = .43; eye.add(gaze);
  const iris = mesh(new THREE.SphereGeometry(.45, 28, 16), blue, gaze);
  iris.scale.z = .31;
  mesh(new THREE.TorusGeometry(.45, .026, 7, 48), blue, gaze, v(0, 0, .06));
  const pupil = mesh(new THREE.SphereGeometry(.34, 18, 12), dark, gaze, v(0, 0, .125));
  pupil.scale.set(.19, 1.15, .17);
  const glint = mesh(new THREE.SphereGeometry(.035, 8, 6), white, gaze, v(-.12, .19, .17));
  const halo = mesh(new THREE.TorusGeometry(1.04, .012, 4, 64), rim, eye, v(0, 0, -.16));
  halo.scale.set(1.65, .9, 1); halo.rotation.x = .2;

  // The key is a physical object with an open bow, shaft and three teeth. Its
  // rotation exposes thickness, instead of behaving like a flat SVG overlay.
  const key = new THREE.Group(); relief.add(key);
  mesh(new THREE.TorusGeometry(.23, .048, 8, 28), white, key, v(-.77, 0, 0));
  mesh(new THREE.BoxGeometry(1.22, .075, .105), white, key, v(.02, 0, 0));
  mesh(new THREE.BoxGeometry(.12, .27, .105), white, key, v(.57, -.1, 0));
  mesh(new THREE.BoxGeometry(.12, .19, .105), white, key, v(.3, -.065, 0));
  mesh(new THREE.BoxGeometry(.09, .18, .105), white, key, v(.03, .07, 0));

  // Black fingers curl out of the panel edges at different depths. Individual
  // knuckles and tapered tips catch the rim light without obscuring the text.
  const flanks = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const claw = new THREE.Group(); relief.add(claw);
      const flip = side;
      const points = [v(flip * .08, -.55, -.15), v(flip * -.09, -.05, .16), v(flip * -.38, .28, .4), v(flip * -.56, .55, .52), v(flip * -.39, .8, .42)];
      mesh(taperedTube(points, .14 + i % 2 * .03, 28, 8), black, claw);
      const knuckle = mesh(new THREE.IcosahedronGeometry(.14, 1), black, claw, points[2]);
      knuckle.scale.set(.75, 1.3, .8);
      const branch = [v(flip * -.08, -.1, .1), v(flip * -.45, -.06, .25), v(flip * -.7, .12, .27), v(flip * -.84, .31, .05)];
      mesh(taperedTube(branch, .09, 19, 6), dark, claw);
      claw.userData = { side, row: i, phase: i * 1.37 + (side > 0 ? 1.8 : 0) };
      flanks.push(claw);
    }
  }

  // A fractured black crown at the top gives the eye an oppressive silhouette.
  const crown = new THREE.Group(); relief.add(crown);
  const shards = [];
  for (let i = 0; i < 9; i++) {
    const shard = mesh(new THREE.ConeGeometry(.13 + i % 3 * .025, .45 + i % 4 * .09, 4), black, crown);
    shard.position.set((i - 4) * .42, .53 + Math.sin(i * 1.7) * .13, -.12 + i % 3 * .12);
    shard.rotation.z = (i - 4) * -.14;
    shard.rotation.x = .3 + i % 2 * .5;
    shards.push(shard);
  }

  let active = false, disposed = false, inView = true, lost = false, pagePaused = false;
  let frame = 0, lastFrame = 0, clock = 0, previous = 0, panelHeight = 7;
  const pointer = { x: 0, y: 0 }, follow = { x: 0, y: 0 };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panel = host.closest('.sim-reactions') || host.parentElement;
  const canDraw = () => active && inView && !pagePaused && !document.hidden && !disposed && !lost && host.isConnected;

  function pose(time, still = false) {
    const phase = still ? .6 : time;
    follow.x += (pointer.x - follow.x) * .07;
    follow.y += (pointer.y - follow.y) * .07;
    const centerY = panelHeight / 2 - 2.0;
    eye.position.y = centerY;
    eye.rotation.y = follow.x * .14 + Math.sin(phase * .28) * .055;
    eye.rotation.x = -follow.y * .08;
    gaze.position.x = follow.x * .16 + Math.sin(phase * .39) * .05;
    gaze.position.y = follow.y * .12;
    const tension = .94 + Math.sin(phase * .65) * .04;
    lids.scale.y = tension;
    iris.scale.y = .96 + Math.sin(phase * .51) * .04;
    glint.position.x = -.12 + follow.x * .02;
    key.position.set(Math.sin(phase * .48) * .38, centerY - .06 + Math.cos(phase * .61) * .15, 1.02 + Math.sin(phase * .42) * .2);
    key.rotation.set(Math.sin(phase * .45) * .22, Math.sin(phase * .38) * .6, -.14 + Math.sin(phase * .48) * .25);
    keyLight.position.set(key.position.x - .5, centerY + 1, 3);
    crown.position.y = centerY + .75;
    crown.rotation.y = eye.rotation.y * .5;
    for (const claw of flanks) {
      const { side, row, phase: offset } = claw.userData;
      claw.position.set(side * 2.55, panelHeight / 2 - .7 - row * (panelHeight - .6) / 4, .04 + Math.sin(offset) * .22);
      claw.rotation.z = side * (.11 + Math.sin(phase * .38 + offset) * .06);
      claw.rotation.y = side * (.12 + Math.sin(phase * .29 + offset) * .16);
      claw.position.x += side * Math.sin(phase * .34 + offset) * .045;
    }
    for (let i = 0; i < shards.length; i++) shards[i].rotation.y = phase * .035 + i * .7;
  }

  function renderOnce() {
    if (!canDraw()) return;
    pose(clock, motion.matches);
    renderer.render(scene, camera);
  }

  function tick(now) {
    frame = 0;
    if (!canDraw()) { previous = 0; return; }
    if (now - lastFrame >= 32) {
      if (previous) clock += Math.min((now - previous) / 1000, .05);
      previous = now; lastFrame = now;
      renderOnce();
    }
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    if (!canDraw()) return;
    renderOnce();
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    panelHeight = 5.4 / camera.aspect;
    camera.position.set(0, 0, panelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderOnce();
  }

  function onPointer(event) {
    if (!canDraw() || motion.matches) return;
    const rect = host.getBoundingClientRect();
    pointer.x = clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, -1, 1);
    pointer.y = clamp(1 - (event.clientY - rect.top) / Math.max(1, rect.height) * 2, -1, 1);
  }
  function onLeave() { pointer.x = 0; pointer.y = 0; }
  function onPageHide() { pagePaused = true; sync(); }
  function onPageShow() { pagePaused = false; sync(); }
  function contextLost(event) {
    event.preventDefault(); lost = true; sync();
    panel?.classList.remove('has-depth');
    host.dataset.reactionRenderer = 'unavailable';
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(host);
  const visibilityObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? true; sync();
  }, { rootMargin: '80px' }) : null;
  visibilityObserver?.observe(host);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  panel?.addEventListener('pointermove', onPointer, { passive: true });
  panel?.addEventListener('pointerleave', onLeave, { passive: true });
  motion.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', contextLost);
  host.dataset.reactionRenderer = 'ready';
  resize();

  return {
    setActive(value) { active = !!value; resize(); sync(); },
    dispose() {
      if (disposed) return;
      active = false; disposed = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      sizeObserver.disconnect(); visibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      panel?.removeEventListener('pointermove', onPointer);
      panel?.removeEventListener('pointerleave', onLeave);
      motion.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
      delete host.dataset.reactionRenderer;
      panel?.classList.remove('has-depth');
    }
  };
}
