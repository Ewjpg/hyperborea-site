// Procedural Lycoris radiata. All geometry and materials are local; no textures or network.
// A complete umbel, rather than one oversized daisy: six independent six-petalled florets.
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function finishGeometry(open, closed, indices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(open, 3));
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (closed) {
    const folded = new THREE.BufferGeometry();
    folded.setAttribute('position', new THREE.Float32BufferAttribute(closed, 3));
    folded.setIndex(indices);
    folded.computeVertexNormals();
    // The base is open; a weight of one means closed. Both normals are morphed.
    geometry.morphAttributes.position = [folded.getAttribute('position').clone()];
    geometry.morphAttributes.normal = [folded.getAttribute('normal').clone()];
    folded.dispose();
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function combine(geometries) {
  const open = [], closed = [], color = [], indices = [];
  let count = 0, morphed = false, colored = false;
  for (const g of geometries) {
    const p = g.getAttribute('position'), c = g.getAttribute('color');
    const m = g.morphAttributes.position?.[0];
    open.push(...p.array); closed.push(...(m || p).array);
    if (m) morphed = true;
    if (c) { color.push(...c.array); colored = true; }
    else for (let i = 0; i < p.count; i++) color.push(1, 1, 1);
    for (const index of g.index.array) indices.push(index + count);
    count += p.count; g.dispose();
  }
  return finishGeometry(open, morphed ? closed : null, indices, colored ? color : null);
}

function petalGeometry(phi, length, phase, quality, sepal = false) {
  const steps = quality === 'low' ? 23 : 36, across = quality === 'low' ? 3 : 5;
  const open = [], closed = [], colors = [], indices = [];
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.015, 0, 0), new THREE.Vector3(.25, .20, .025),
    new THREE.Vector3(.73, .43, -.015), new THREE.Vector3(1.02, .18, .018),
    new THREE.Vector3(.98, -.19, -.015), new THREE.Vector3(.77, -.26, .01),
    new THREE.Vector3(.70, -.035, 0)
  ], false, 'centripetal');
  const centre = new THREE.Vector3(), tangent = new THREE.Vector3();
  const radial = new THREE.Vector3(cp, 0, sp), lateral = new THREE.Vector3(-sp, 0, cp);
  const widthAxis = new THREE.Vector3(), normal = new THREE.Vector3();
  const c = new THREE.Color();
  for (let side = 0; side < 2; side++) for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPoint(t, centre); curve.getTangent(t, tangent);
    const radius = centre.x * length;
    const height = centre.y * length;
    const twist = Math.sin(t * Math.PI * 1.8 + phase) * .40;
    widthAxis.copy(lateral).multiplyScalar(Math.cos(twist)).addScaledVector(radial, -.32 * Math.sin(twist));
    widthAxis.y = Math.sin(twist) * .8; widthAxis.normalize();
    normal.set(-tangent.y * cp, tangent.x, -tangent.y * sp).normalize();
    const width = (sepal ? .10 : .073) * length * Math.pow(Math.max(0, Math.sin(Math.PI * t)), .62) * (1 - .38 * t) + .0015;
    for (let j = 0; j <= across; j++) {
      const u = j / across * 2 - 1;
      const scallop = Math.sin(t * 37 + phase) * .012 * length * Math.abs(u) ** 2 * Math.sin(Math.PI * t);
      const ridge = (Math.abs(u) ** 1.7 * .028 + scallop) * Math.sin(Math.PI * t);
      const thick = side ? -.0028 : .0028;
      const v = new THREE.Vector3(cp * radius, height, sp * radius);
      v.addScaledVector(lateral, centre.z * length).addScaledVector(widthAxis, width * u).addScaledVector(normal, ridge + thick);
      open.push(v.x, v.y, v.z);
      // A pointed, ridged spindle, arranged around the floral axis while closed.
      // Keep the closed leaf a solid shell too. Coincident front/back positions
      // make the half-open morph z-fight, especially under a bright rim light.
      const cr = (.015 + Math.sin(Math.PI * t) * .080) * length;
      const closedThickness = thick + Math.abs(u) ** 1.7 * .006 * Math.sin(Math.PI * t);
      closed.push(cp * cr + lateral.x * width * u * .48,
        t * 1.04 * length + ridge * .25, sp * cr + lateral.z * width * u * .48);
      closed[closed.length - 3] += cp * closedThickness;
      closed[closed.length - 1] += sp * closedThickness;
      if (sepal) c.setRGB(.13 + .055 * t, .025 + .018 * t, .018 + .008 * t);
      else {
        // Vein at the centre; the crimped edges catch a peach-red grazing light.
        const edge = Math.pow(Math.abs(u), 2.8), tip = smooth(.45, 1, t);
        c.setRGB(.42 + .34 * t + .17 * edge, .008 + .022 * tip + .055 * edge, .019 + .028 * tip + .038 * edge);
        c.multiplyScalar(side ? .72 : .95);
      }
      colors.push(c.r, c.g, c.b);
    }
  }
  const row = across + 1, face = (steps + 1) * row;
  for (let i = 0; i < steps; i++) for (let j = 0; j < across; j++) {
    const a = i * row + j, b = a + row;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
    indices.push(face + a, face + a + 1, face + b, face + b, face + a + 1, face + b + 1);
  }
  for (let i = 0; i < steps; i++) for (const j of [0, across]) {
    const a = i * row + j, b = a + row;
    indices.push(a, face + a, b, b, face + a, face + b);
  }
  return finishGeometry(open, closed, indices, colors);
}

function filament(phi, reach, rise, phase, quality) {
  const steps = quality === 'low' ? 21 : 32, sides = quality === 'low' ? 4 : 5;
  const open = [], closed = [], colors = [], indices = [];
  const point = new THREE.Vector3(), next = new THREE.Vector3(), tangent = new THREE.Vector3();
  const axis = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const sample = (t, target) => {
    const angle = phi + Math.sin(t * 1.6) * .13;
    const r = .035 + reach * t;
    return target.set(Math.cos(angle) * r,
      .025 + rise * Math.sin(t * Math.PI * .65) - .12 * t * t, Math.sin(angle) * r);
  };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; sample(t, point); sample(Math.min(1, t + .002), next);
    if (i === steps) { sample(t - .002, next); tangent.subVectors(point, next); }
    else tangent.subVectors(next, point);
    tangent.normalize(); axis.set(-sp, 0, cp);
    normal.crossVectors(tangent, axis).normalize(); binormal.crossVectors(tangent, normal).normalize();
    const radius = (.0078 * (1 - .55 * t) + .0014) * (quality === 'low' ? 1.13 : 1);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU, nx = Math.cos(a) * radius, ny = Math.sin(a) * radius;
      open.push(point.x + normal.x * nx + binormal.x * ny,
        point.y + normal.y * nx + binormal.y * ny, point.z + normal.z * nx + binormal.z * ny);
      const cr = .025 + .035 * Math.sin(t * Math.PI + phase);
      closed.push(cp * cr + Math.cos(a) * radius, t * reach * .82,
        sp * cr + Math.sin(a) * radius);
      colors.push(.72 + .23 * t, .025 + .055 * t, .04 + .045 * t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const tip = sample(1, new THREE.Vector3()), foldedTip = new THREE.Vector3(cp * (.025 + .035 * Math.sin(Math.PI + phase)), reach * .82, sp * (.025 + .035 * Math.sin(Math.PI + phase)));
  return {geometry: finishGeometry(open, closed, indices, colors), tip, foldedTip,
    direction: tangent.clone().normalize()};
}

function antherGeometry(tip, foldedTip, direction, scale, quality) {
  const shape = new THREE.SphereGeometry(1, quality === 'low' ? 6 : 9, quality === 'low' ? 4 : 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
  const p = shape.getAttribute('position'), open = [], closed = [], color = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiply(new THREE.Vector3(.048 * scale, .010 * scale, .015 * scale)).applyQuaternion(q);
    open.push(v.x + tip.x, v.y + tip.y, v.z + tip.z);
    closed.push(v.x * .45 + foldedTip.x, v.y * .45 + foldedTip.y, v.z * .45 + foldedTip.z);
    const bright = .86 + .14 * Math.max(0, v.y * 50);
    color.push(.92 * bright, .58 * bright, .25 * bright);
  }
  const result = finishGeometry(open, closed, Array.from(shape.index.array), color);
  shape.dispose(); return result;
}

function stalkGeometry(points, baseRadius, tipRadius, quality, dark = false) {
  const path = new THREE.CatmullRomCurve3(points), steps = quality === 'low' ? 22 : 38;
  const tube = new THREE.TubeGeometry(path, steps, 1, quality === 'low' ? 6 : 9, false);
  const p = tube.getAttribute('position'), normal = tube.getAttribute('normal');
  const colors = [], sides = quality === 'low' ? 6 : 9, centre = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; path.getPointAt(t, centre); const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t);
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      p.setXYZ(k, centre.x + normal.getX(k) * radius, centre.y + normal.getY(k) * radius, centre.z + normal.getZ(k) * radius);
      const stripe = .83 + .17 * Math.cos(j / sides * TAU * 3);
      colors.push((dark ? .12 : .085) * stripe, (dark ? .024 : .095) * stripe, (dark ? .021 : .047) * stripe);
    }
  }
  tube.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); tube.computeVertexNormals(); tube.computeBoundingSphere();
  return tube;
}

/**
 * Hub at y=0; bare stem extends to y=-4.5; full umbel about 4.2 units wide.
 * update(0..1, timeSeconds) is reversible and creates no objects per frame.
 */
export function createHiganbana3D({quality = 'high', seed = 11} = {}) {
  const low = quality === 'low', rand = seeded(seed);
  const group = new THREE.Group(); group.name = 'Minami / Lycoris radiata';
  const bloom = new THREE.Group(); group.add(bloom);
  const petals = new THREE.MeshPhysicalMaterial({color: 0xffffff, vertexColors: true,
    roughness: .38, metalness: 0, clearcoat: .26, clearcoatRoughness: .30,
    sheen: low ? 0 : .55, sheenColor: new THREE.Color('#ff6371'), sheenRoughness: .6,
    emissive: new THREE.Color('#370206'), emissiveIntensity: .11,
    side: THREE.DoubleSide});
  const threads = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .32,
    metalness: .06, emissive: new THREE.Color('#50020b'), emissiveIntensity: .18});
  const pollen = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .52, metalness: .08});
  const stemMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .50, metalness: .06});
  const sepalMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .58, side: THREE.DoubleSide});
  const geometries = [], units = [];
  const mesh = (geometry, material, parent) => {
    geometries.push(geometry); const object = new THREE.Mesh(geometry, material);
    object.frustumCulled = false; parent.add(object); return object;
  };
  mesh(stalkGeometry([new THREE.Vector3(-.10, -4.5, .04), new THREE.Vector3(-.17, -2.8, .045), new THREE.Vector3(.035, -1.25, -.025), new THREE.Vector3(0, 0, 0)], .061, .041, quality), stemMaterial, group);
  const pedicels = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const phi = i / count * TAU + .12 + (rand() - .5) * .16;
    const radius = .53 + rand() * .16, height = .10 + rand() * .22;
    const unit = new THREE.Group(); unit.position.set(Math.cos(phi) * radius, height, Math.sin(phi) * radius);
    unit.rotation.y = phi * .35 + rand() * .35;
    bloom.add(unit);
    const petalParts = [], threadParts = [], tipParts = [], sepals = [];
    const offset = rand() * TAU;
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * TAU + offset + (rand() - .5) * .13;
      const length = .86 + rand() * .22;
      petalParts.push(petalGeometry(a, length, rand() * TAU, quality));
      const f = filament(a + .20, 1.14 + rand() * .34, .74 + rand() * .34, rand(), quality);
      threadParts.push(f.geometry); tipParts.push(antherGeometry(f.tip, f.foldedTip, f.direction, .8 + rand() * .45, quality));
      if (j % 2 === 0) sepals.push(petalGeometry(a + .3, .46 + rand() * .10, rand() * TAU, quality, true));
    }
    const flowerPetals = mesh(combine(petalParts), petals, unit);
    const filaments = mesh(combine(threadParts), threads, unit);
    const anthers = mesh(combine(tipParts), pollen, unit);
    const calyx = mesh(combine(sepals), sepalMaterial, unit);
    units.push({unit, petals: flowerPetals, filaments, anthers, calyx, phi,
      height, radius, phase: rand() * TAU, delay: i * .023 + rand() * .035});
    pedicels.push(stalkGeometry([new THREE.Vector3(0, -.06, 0), new THREE.Vector3(Math.cos(phi) * radius * .5, height * .7, Math.sin(phi) * radius * .5), unit.position.clone()], .024, .016, quality, true));
  }
  mesh(combine(pedicels), stemMaterial, bloom);
  // The papery bracts at the umbel's junction remain visible beneath the red corolla.
  const junction = mesh(new THREE.SphereGeometry(.095, low ? 8 : 12, low ? 5 : 8), stemMaterial, bloom);
  junction.scale.set(1, 1.35, 1);
  let disposed = false;
  function update(progress = 1, timeSeconds = 0) {
    if (disposed) return;
    const p = clamp(progress), t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    bloom.rotation.z = Math.sin(t * .48) * .018;
    bloom.rotation.x = Math.sin(t * .37 + .4) * .013;
    for (const f of units) {
      // Stagger the onset, then remap the remaining interval to [0, 1], so
      // every floret reaches its exact fully-open geometry at progress=1.
      const localProgress = clamp((p - f.delay) / (1 - f.delay));
      const petalOpen = smooth(.12, .77, localProgress);
      const filamentOpen = smooth(.33, .94, localProgress);
      f.petals.morphTargetInfluences[0] = 1 - petalOpen;
      f.filaments.morphTargetInfluences[0] = 1 - filamentOpen;
      f.anthers.morphTargetInfluences[0] = 1 - filamentOpen;
      f.calyx.morphTargetInfluences[0] = 1 - smooth(.04, .58, localProgress);
      const spread = .48 + .52 * petalOpen;
      f.unit.position.x = Math.cos(f.phi) * f.radius * spread;
      f.unit.position.z = Math.sin(f.phi) * f.radius * spread;
      f.unit.position.y = f.height + (1 - petalOpen) * .06;
      f.unit.rotation.z = Math.sin(t * .57 + f.phase) * .025 * petalOpen;
      f.unit.rotation.x = Math.sin(t * .43 + f.phase) * .021 * petalOpen;
    }
  }
  update(0, 0);
  return {
    group, bloom, update,
    bounds: {radius: 2.25, top: 1.55, bottom: -4.5, centre: [0, -.9, 0]},
    stats: {florets: count, petals: count * 6, stamens: count * 6,
      drawCalls: geometries.length, triangles: geometries.reduce((n, g) => n + (g.index?.count || 0) / 3, 0)},
    dispose() {
      if (disposed) return; disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of [petals, threads, pollen, stemMaterial, sepalMaterial]) material.dispose();
      group.removeFromParent(); group.clear();
    }
  };
}
