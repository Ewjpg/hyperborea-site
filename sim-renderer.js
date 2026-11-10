import * as THREE from './vendor/three.module.min.js';
import { getFieldSpec } from './pass-model.js?v=31';

// Three.js 0.186.1, vendored locally under the MIT license in vendor/.
const FIELD_WIDTH = 68;
const FIELD_LENGTH = 105;
const TEAM_COLORS = { a: 0x6de9ee, b: 0xffad73 };
const PATH_COLORS = { pass: 0xa4faff, curve: 0x72d9ff, run: 0xffb377, shot: 0xff6677, zone: 0x9eeed8 };
const ARC_HEIGHTS = { pass: 1.8, curve: 3.5, run: 0, shot: 5 };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const validPoint = p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y));
const worldPoint = (p, height = 0, field = getFieldSpec('11')) => new THREE.Vector3((Number(p.x) - 50) * field.width / 100, height, (Number(p.y) - 50) * field.length / 100);
const UP = new THREE.Vector3(0, 1, 0);
const SHOT_VARIANTS = new Set(['straight', 'curve', 'lob', 'formless', 'formless-control']);
const shotVariant = value => SHOT_VARIANTS.has(value) ? value : 'lob';
const unitTime = value => clamp(Number(value) || 0, 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const isFormless = action => action.type === 'shot' && ['formless', 'formless-control'].includes(action.variant);

/** Height above the ball's ground resting point. All paths and playback use this math. */
export function getShotHeight(variant, value) {
  const t = unitTime(value), kind = shotVariant(variant);
  if (t === 0 || t === 1) return 0;
  if (kind === 'straight') return Math.sin(Math.PI * t) * 0.12;
  if (kind === 'curve') return Math.sin(Math.PI * t) * 1.15;
  if (kind === 'formless' || kind === 'formless-control') {
    const launch = 0.22, lift = kind === 'formless' ? 4.2 : 2.4;
    if (t < launch) return Math.sin(t / launch * Math.PI / 2) * lift;
    const travel = (t - launch) / (1 - launch);
    return lift * (1 - travel) + Math.sin(Math.PI * travel) * (kind === 'formless' ? 5.5 : 1.4);
  }
  return Math.sin(Math.PI * t) * 5;
}

/** Normalized pitch coordinates, including Formless's short wind-up before release. */
export function getActionPoint(action, value) {
  let t = unitTime(value);
  if (isFormless(action)) t = clamp((t - 0.22) / 0.78, 0, 1);
  if(action.type==='pass'&&action.variant==='hidden')t=clamp((t-.24)/.76,0,1);
  const a = action.from, b = action.to;
  if ((action.type === 'curve' || ((action.type === 'shot'||action.type==='pass') && action.variant === 'curve')) && validPoint(action.control)) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * action.control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * action.control.y + t * t * b.y };
  }
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function getActionHeight(action, value) {
  if (action.type === 'shot') return getShotHeight(action.variant, value);
  if(action.type==='pass'&&action.variant){
    const t=action.variant==='hidden'?clamp((unitTime(value)-.24)/.76,0,1):unitTime(value);
    return Math.sin(Math.PI*t)*({low:.08,lob:4,through:.12,hidden:.1,curve:2.6}[action.variant]||0);
  }
  return Math.sin(Math.PI * unitTime(value)) * (ARC_HEIGHTS[action.type] || 0);
}

/** Fear turns away from the target, bursts upward and flips through the bicycle kick. */
export function getFormlessPose(action, value) {
  const t = unitTime(value), controlled = action.variant === 'formless-control';
  const field = getFieldSpec(action.mode || '11');
  const dx = (action.to.x - action.from.x) * field.width / 100;
  const dz = (action.to.y - action.from.y) * field.length / 100;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const burst = smooth(clamp(t / 0.55, 0, 1)) * (controlled ? 1.2 : 2.2);
  const phase = clamp(t / 0.62, 0, 1), leap = phase < 1 ? Math.sin(Math.PI * phase) : 0;
  return {
    x: clamp(action.from.x - dx / length * burst / field.width * 100, 0, 100),
    y: clamp(action.from.y - dz / length * burst / field.length * 100, 0, 100),
    height: Math.max(0, leap) * (controlled ? 2.0 : 3.7),
    tilt: phase < 1 ? -Math.PI * 2 * smooth(phase) : 0,
    heading: Math.atan2(dx, dz) + Math.PI,
    effect: phase < 1 ? Math.max(0, leap) : 0
  };
}

class TacticalPath extends THREE.Curve {
  constructor(annotation, start = 0, end = 1, field = getFieldSpec(annotation.mode || '11')) {
    super();
    this.annotation = annotation;
    this.start = start;
    this.end = end;
    this.field = field;
  }
  getPoint(value, target = new THREE.Vector3()) {
    const t = this.start + value * (this.end - this.start);
    target.copy(worldPoint(getActionPoint(this.annotation, t), this.annotation.type === 'run' ? 0.2 : 0.56, this.field));
    target.y += getActionHeight(this.annotation, t);
    return target;
  }
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}

/** A demand-rendered, local-only WebGL tactical pitch. Coordinates use 0..100. */
export class FieldRenderer {
  constructor(host, callbacks = {}) {
    if (!(host instanceof HTMLElement)) throw new Error('3D field container is missing.');
    this.host = host;
    this.callbacks = callbacks;
    this.mode = String(callbacks.mode) === '5' ? '5' : '11';
    this.field = getFieldSpec(this.mode);
    this.cameraScale = Math.max(this.field.width / FIELD_WIDTH, this.field.length / FIELD_LENGTH);
    this.active = true;
    this.disposed = false;
    this.frame = 0;
    this.tool = 'camera';
    this.width = 1;
    this.height = 1;
    this.players = new Map();
    this.annotationCache = new Map();
    this.playerData = [];
    this.pickTargets = [];
    this.textures = new Map();
    this.pointers = new Map();
    this.hoverKey = null;
    this.cameraState = { azimuth: 0.57, polar: 0.65, radius: 153 };
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(UP, 0);
    this.projected = new THREE.Vector3();
    this._hostPosition = host.style.position;
    this._hostOverflow = host.style.overflow;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.overflow = 'hidden';

    const canvas = document.createElement('canvas');
    canvas.className = 'sim-webgl-canvas';
    canvas.dataset.renderer = 'webgl';
    canvas.setAttribute('aria-label', 'Interactive 3D football pitch');
    canvas.setAttribute('role', 'img');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch {
      host.style.position = this._hostPosition;
      host.style.overflow = this._hostOverflow;
      throw new Error('This device could not open the 3D pitch. WebGL 2 is required.');
    }
    this.canvas = canvas;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = false;
    host.appendChild(canvas);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'sim-player-labels';
    this.labelLayer.setAttribute('aria-hidden', 'true');
    this.labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    host.appendChild(this.labelLayer);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061216);
    this.scene.fog = new THREE.FogExp2(0x061216, 0.0028);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.3, 500);
    this.scene.add(new THREE.HemisphereLight(0xc4f6ff, 0x14352e, 2.15));
    const keyLight = new THREE.DirectionalLight(0xd4faff, 3.0);
    keyLight.position.set(35, 90, 10);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffddbc, 0.7);
    fillLight.position.set(-40, 30, -40);
    this.scene.add(fillLight);

    this.pitch = new THREE.Group();
    this.playerGroup = new THREE.Group();
    this.annotationGroup = new THREE.Group();
    this.scene.add(this.pitch, this.playerGroup, this.annotationGroup);
    this._buildPitch();
    this.pitch.scale.set(this.field.width / FIELD_WIDTH, 1, this.field.length / FIELD_LENGTH);
    this._buildBall();
    this._updateCamera();
    this._bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    host.dataset.simRenderer = 'ready';
    host.dataset.fieldMode = this.mode;
    host.dataset.fieldSize = `${this.field.width}x${this.field.length}`;
    host.dataset.fieldWidth = String(this.field.width);
    host.dataset.fieldLength = String(this.field.length);
  }

  _worldPoint(point, height = 0) { return worldPoint(point, height, this.field); }

  _material(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.05, ...extra });
  }

  _buildPitch() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(78, 1.1, 115), this._material(0x0c242a));
    base.position.y = -0.65;
    this.pitch.add(base);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), this._material(0x08161c));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.24;
    this.pitch.add(ground);
    for (let i = 0; i < 10; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH / 10), this._material(i % 2 ? 0x173e37 : 0x1d4940));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0, -FIELD_LENGTH / 2 + (i + 0.5) * FIELD_LENGTH / 10);
      this.pitch.add(stripe);
    }

    const linePoints = [];
    const addLine = (ax, az, bx, bz) => linePoints.push(ax, 0.055, az, bx, 0.055, bz);
    const rectangle = (left, top, right, bottom) => {
      addLine(left, top, right, top); addLine(right, top, right, bottom);
      addLine(right, bottom, left, bottom); addLine(left, bottom, left, top);
    };
    rectangle(-34, -52.5, 34, 52.5);
    addLine(-34, 0, 34, 0);
    for (const sign of [-1, 1]) {
      const goalLine = sign * 52.5;
      rectangle(-20.16, goalLine, 20.16, goalLine - sign * 16.5);
      rectangle(-9.16, goalLine, 9.16, goalLine - sign * 5.5);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), new THREE.MeshBasicMaterial({ color: 0xd5efe7 }));
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(0, 0.06, goalLine - sign * 11);
      this.pitch.add(spot);
      // Only the part of the penalty arc outside the box is drawn.
      for (let i = 0; i < 32; i++) {
        const a = Math.PI * 0.205 + i / 32 * Math.PI * 0.59;
        const b = Math.PI * 0.205 + (i + 1) / 32 * Math.PI * 0.59;
        addLine(Math.cos(a) * 9.15, goalLine - sign * (11 + Math.sin(a) * 9.15), Math.cos(b) * 9.15, goalLine - sign * (11 + Math.sin(b) * 9.15));
      }
      this._addGoal(sign);
    }
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2;
      const b = (i + 1) / 72 * Math.PI * 2;
      addLine(Math.cos(a) * 9.15, Math.sin(a) * 9.15, Math.cos(b) * 9.15, Math.sin(b) * 9.15);
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    this.pitch.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0xc9e5dd, transparent: true, opacity: 0.78 })));
    const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), new THREE.MeshBasicMaterial({ color: 0xd5efe7 }));
    centerSpot.rotation.x = -Math.PI / 2;
    centerSpot.position.y = 0.06;
    this.pitch.add(centerSpot);

    // Subtle border lamps give the ground thickness without expensive real-time shadows.
    for (const x of [-37, 37]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 111), new THREE.MeshBasicMaterial({ color: 0x3e8488 }));
      edge.position.set(x, -0.04, 0);
      this.pitch.add(edge);
    }
  }

  _addGoal(sign) {
    const goal = new THREE.Group();
    const front = sign * 52.65;
    const back = sign * 55.05;
    const postMaterial = this._material(0xf2f5eb, { roughness: 0.35, metalness: 0.3 });
    const post = (a, b) => {
      const delta = new THREE.Vector3().subVectors(b, a);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, delta.length(), 8), postMaterial);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
      goal.add(mesh);
    };
    post(new THREE.Vector3(-3.66, 0, front), new THREE.Vector3(-3.66, 2.44, front));
    post(new THREE.Vector3(3.66, 0, front), new THREE.Vector3(3.66, 2.44, front));
    post(new THREE.Vector3(-3.66, 2.44, front), new THREE.Vector3(3.66, 2.44, front));
    post(new THREE.Vector3(-3.66, 0, back), new THREE.Vector3(-3.66, 2.44, front));
    post(new THREE.Vector3(3.66, 0, back), new THREE.Vector3(3.66, 2.44, front));
    const points = [];
    const netLine = (a, b) => points.push(...a, ...b);
    for (let i = 0; i <= 16; i++) {
      const x = -3.66 + i / 16 * 7.32;
      netLine([x, 0, back], [x, 2.44, back]);
      netLine([x, 2.44, front], [x, 2.44, back]);
    }
    for (let i = 0; i <= 6; i++) {
      const y = i / 6 * 2.44;
      netLine([-3.66, y, back], [3.66, y, back]);
      for (const x of [-3.66, 3.66]) netLine([x, y, front], [x, y, back]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    goal.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8db9b4, transparent: true, opacity: 0.35 })));
    this.pitch.add(goal);
  }

  _buildBall() {
    this.ball = new THREE.Group();
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), this._material(0xf4f7ee, { roughness: 0.45 }));
    this.ball.add(ballMesh);
    // A low-poly black seam makes the moving ball recognizable even from above.
    for (const rotation of [0, Math.PI / 2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.548, 0.028, 4, 24), new THREE.MeshBasicMaterial({ color: 0x182b30 }));
      ring.rotation.y = rotation;
      this.ball.add(ring);
    }
    this.ball.visible = false;
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.08;
    this.ballShadow.visible = false;
    this.scene.add(this.ballShadow);
  }

  _getTexture(url) {
    let resolved;
    try {
      resolved = new URL(url, document.baseURI);
      if (resolved.origin !== location.origin || !['http:', 'https:', 'hyperborea:'].includes(resolved.protocol)) return Promise.resolve(null);
    } catch { return Promise.resolve(null); }
    if (this.textures.has(resolved.href)) return this.textures.get(resolved.href);
    const promise = new Promise(resolve => {
      new THREE.TextureLoader().load(resolved.href, texture => {
        if (this.disposed) { texture.dispose(); resolve(null); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        resolve(texture);
      }, undefined, () => resolve(null));
    });
    this.textures.set(resolved.href, promise);
    return promise;
  }

  setPlayers(players = []) {
    if (this.disposed) return;
    this.callbacks.onHover?.(null, { x: 0, y: 0 });
    this.hoverKey = null;
    disposeObject(this.playerGroup);
    this.playerGroup.clear();
    this.players.clear();
    this.pickTargets = [];
    this.labelLayer.replaceChildren();
    this.playerData = players.filter(p => p && p.key != null && validPoint(p)).map(p => ({ ...p, key: String(p.key), x: clamp(Number(p.x), 0, 100), y: clamp(Number(p.y), 0, 100) }));
    const generation = this.playerData;
    for (const player of this.playerData) {
      const color = TEAM_COLORS[player.team] || TEAM_COLORS.a;
      const group = new THREE.Group();
      group.position.copy(this._worldPoint(player));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.35, 24), this._material(color, { metalness: 0.2, roughness: 0.5 }));
      base.position.y = 0.22;
      group.add(base);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.055, 5, 28), new THREE.MeshBasicMaterial({ color }));
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.42;
      group.add(rim);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.07;
      group.add(shadow);

      const figure = new THREE.Group();
      group.add(figure);
      const pawn = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.83, 1.65, 12), this._material(color, { roughness: 0.48 }));
      body.position.y = 1.3;
      pawn.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.53, 12, 10), this._material(0xe9f0e8, { roughness: 0.48 }));
      head.position.y = 2.57;
      pawn.add(head);
      figure.add(pawn);

      // The portrait stands in real space as a camera-facing cutout above the 3D base.
      const portrait = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.025 }));
      portrait.center.set(0.5, 0.5);
      portrait.position.y = 3.02;
      portrait.scale.set(5.2, 5.2, 1);
      portrait.visible = false;
      figure.add(portrait);
      if (player.image) this._getTexture(player.image).then(texture => {
        if (!texture || this.disposed || generation !== this.playerData) return;
        portrait.material.map = texture;
        portrait.material.needsUpdate = true;
        portrait.visible = true;
        pawn.visible = false;
        this._requestRender();
      });
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 4.5, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
      hit.position.y = 2.25;
      hit.userData.playerKey = player.key;
      group.add(hit);
      this.pickTargets.push(hit);
      const aura = new THREE.Group();
      aura.visible = false;
      const veil = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.7, 4.8, 20, 1, true), this._material(0x02050a, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
      veil.position.y = 2.2;
      veil.userData.baseOpacity = 0.3;
      aura.add(veil);
      for (let ringIndex = 0; ringIndex < 3; ringIndex++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0 + ringIndex * 0.26, 0.055, 5, 40), new THREE.MeshBasicMaterial({ color: ringIndex === 1 ? 0xeaf6ff : 0x2978ff, transparent: true, opacity: 0.75, depthWrite: false }));
        ring.position.y = 0.55 + ringIndex * 1.05;
        ring.rotation.set(Math.PI / 2, ringIndex * 0.5, ringIndex * 0.6);
        ring.userData.baseOpacity = ringIndex === 1 ? 0.8 : 0.7;
        aura.add(ring);
      }
      group.add(aura);
      const label = document.createElement('span');
      label.className = 'sim-player-label';
      label.dataset.player = player.key;
      label.textContent = `${player.name || 'PLAYER'}${player.role ? ` · ${player.role}` : ''}`;
      label.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:4px 7px;border:1px solid rgba(188,236,231,.25);border-radius:3px;background:rgba(3,15,19,.83);color:#eef9f6;font:600 10px/1.2 system-ui,sans-serif;white-space:nowrap;letter-spacing:.035em;text-shadow:0 1px 2px #000;will-change:left,top;';
      label.style.borderBottomColor = `#${new THREE.Color(color).getHexString()}`;
      this.labelLayer.appendChild(label);
      this.playerGroup.add(group);
      this.players.set(player.key, { group, label, data: player, portrait, figure, pawn, hit, aura, height: 0 });
    }
    this._requestRender();
  }

  setAnnotations(annotations = []) {
    if (this.disposed) return;
    const keep = new Set();
    for (const [index, a] of annotations.entries()) {
      if (!a || !validPoint(a.from) || !validPoint(a.to) || !Object.hasOwn(PATH_COLORS, a.type)) continue;
      const from = this._worldPoint(a.from);
      const to = this._worldPoint(a.to);
      if (from.distanceTo(to) < 0.3) continue;
      const key = `${a.id ?? `index-${index}`}${a.preview ? ':preview' : ''}`;
      const signature = JSON.stringify([this.mode, a.type, a.variant, a.from.x, a.from.y, a.to.x, a.to.y, a.control?.x, a.control?.y, a.target?.x, a.target?.y, a.assessment?.accurate, !!a.preview]);
      keep.add(key);
      const previous = this.annotationCache.get(key);
      if (previous?.signature === signature) continue;
      if (previous) { this.annotationGroup.remove(previous.root); disposeObject(previous.root); }
      const root = new THREE.Group();
      this.annotationGroup.add(root);
      this.annotationCache.set(key, { signature, root });
      if (a.type === 'zone') { this._addZone(a, from, to, root); continue; }
      const path = new TacticalPath(a, 0, 1, this.field);
      const color = isFormless(a) ? (a.variant === 'formless' ? 0x3f8fff : 0xd0e6ff) : PATH_COLORS[a.type];
      const material = this._material(color, { emissive: color, emissiveIntensity: 0.25, roughness: 0.32, transparent: true, opacity: a.preview ? 0.58 : 0.96 });
      if (a.type === 'run') {
        const length = from.distanceTo(to);
        const pieces = clamp(Math.ceil(length / 2.8), 2, 32);
        for (let i = 0; i < pieces; i++) {
          const segment = new TacticalPath(a, i / pieces, Math.min(1, (i + 0.62) / pieces), this.field);
          root.add(new THREE.Mesh(new THREE.TubeGeometry(segment, 3, 0.14, 6, false), material));
        }
      } else {
        root.add(new THREE.Mesh(new THREE.TubeGeometry(path, 48, a.type === 'shot' ? 0.2 : 0.16, 7, false), material));
        const groundTrace = [];
        for (let i = 0; i <= 32; i++) {
          const p = path.getPoint(i / 32); p.y = 0.075; groundTrace.push(p);
        }
        root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(groundTrace), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 })));
      }
      // Keep the cone aimed along the final world-space trajectory in every direction.
      const tangent = path.getPoint(1).sub(path.getPoint(0.97)).normalize();
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.8, 10), material);
      arrow.position.copy(path.getPoint(1)).addScaledVector(tangent, -0.85);
      arrow.quaternion.setFromUnitVectors(UP, tangent);
      root.add(arrow);
      const origin = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 5, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }));
      origin.rotation.x = -Math.PI / 2;
      origin.position.copy(from); origin.position.y = 0.15;
      root.add(origin);
      if (a.type === 'pass' && a.assessment?.accurate === false && validPoint(a.target) && !a.preview) this._addPassMiss(a.target, to, root);
    }
    for (const [key, entry] of this.annotationCache) {
      if (keep.has(key)) continue;
      this.annotationGroup.remove(entry.root);
      disposeObject(entry.root);
      this.annotationCache.delete(key);
    }
    this._requestRender();
  }

  _addPassMiss(targetPoint, actualPoint, root) {
    const target = this._worldPoint(targetPoint, 0.16);
    const actual = actualPoint.clone(); actual.y = 0.16;
    const color = 0xe0c5b0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.055, 5, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(target);
    root.add(ring);
    const cross = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(target.x - 0.6, target.y, target.z), new THREE.Vector3(target.x + 0.6, target.y, target.z),
      new THREE.Vector3(target.x, target.y, target.z - 0.6), new THREE.Vector3(target.x, target.y, target.z + 0.6)
    ]);
    root.add(new THREE.LineSegments(cross, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })));
    if (actual.distanceTo(target) > 0.1) {
      const link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([target, actual]), new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.4, dashSize: 0.55, gapSize: 0.45 }));
      link.computeLineDistances();
      root.add(link);
    }
  }

  _addZone(a, from, to, root) {
    const radius = clamp(from.distanceTo(to), 2.5, 22);
    const color = PATH_COLORS.zone;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.32, 48), this._material(color, { transparent: true, opacity: a.preview ? 0.1 : 0.16, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.copy(from); disc.position.y = 0.19;
    root.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 6, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(from); ring.position.y = 0.42;
    root.add(ring);
    const cross = new THREE.Mesh(new THREE.RingGeometry(radius * 0.48, radius * 0.48 + 0.07, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    cross.rotation.x = -Math.PI / 2;
    cross.position.copy(from); cross.position.y = 0.4;
    root.add(cross);
  }

  setPose(pose = {}) {
    if (this.disposed) return;
    for (const p of pose.players || []) {
      const player = this.players.get(String(p.key));
      if (player && validPoint(p)) {
        player.group.position.copy(this._worldPoint(p));
        player.height = clamp(Number(p.height) || 0, 0, 12);
        player.figure.position.y = player.height;
        const tilt = Number(p.tilt) || 0;
        player.portrait.material.rotation = tilt;
        player.pawn.rotation.z = tilt;
        player.figure.rotation.y = Number(p.heading) || 0;
        player.hit.position.y = 2.25 + player.height;
        const effect = clamp(Number(p.effect) || 0, 0, 1);
        player.aura.visible = effect > 0.001;
        player.aura.position.y = player.height * 0.35;
        player.aura.scale.setScalar(1 + effect * 0.35);
        player.aura.rotation.y = tilt * 0.4;
        for (const mesh of player.aura.children) mesh.material.opacity = mesh.userData.baseOpacity * effect;
      }
    }
    if (Object.hasOwn(pose, 'ball')) {
      const p = pose.ball;
      this.ball.visible = this.ballShadow.visible = !!validPoint(p);
      if (validPoint(p)) {
        const elevation = Math.max(0, Number(p.height) || 0);
        this.ball.position.copy(this._worldPoint(p, 0.56 + elevation));
        this.ballShadow.position.copy(this._worldPoint(p, 0.08));
        const shadowScale = 1 + Math.min(elevation, 8) * 0.08;
        this.ballShadow.scale.setScalar(shadowScale);
        this.ballShadow.material.opacity = Math.max(0.1, 0.3 - elevation * 0.02);
        this.ball.rotation.x = Number(p.x) * 0.3;
        this.ball.rotation.z = Number(p.y) * -0.3;
      }
    }
    this._requestRender();
  }

  resetPose() {
    for (const p of this.players.values()) {
      p.group.position.copy(this._worldPoint(p.data));
      p.height = 0;
      p.figure.position.y = 0;
      p.figure.rotation.y = 0;
      p.portrait.material.rotation = 0;
      p.pawn.rotation.z = 0;
      p.hit.position.y = 2.25;
      p.aura.visible = false;
    }
    this.ball.visible = this.ballShadow.visible = false;
    this._requestRender();
  }

  setTool(type) {
    this.tool = type || 'camera';
    this.canvas.style.cursor = this.tool === 'camera' || this.tool === 'select' ? 'grab' : 'crosshair';
    this.pointers.clear();
    this.pinchDistance = 0;
  }

  setCamera(preset) {
    const presets = {
      broadcast: { azimuth: 0.57, polar: 0.65, radius: 153 },
      top: { azimuth: 0, polar: 0.025, radius: 151 },
      side: { azimuth: Math.PI / 2, polar: 1.02, radius: 134 }
    };
    Object.assign(this.cameraState, presets[preset] || presets.broadcast);
    this._updateCamera();
    this._requestRender();
  }

  _updateCamera() {
    const { radius, azimuth, polar } = this.cameraState;
    const aspect = this.width / Math.max(1, this.height);
    const responsiveRadius = radius * this.cameraScale * (aspect < 1 ? Math.max(1.25, 0.95 / Math.max(0.2, aspect)) : 1);
    this.camera.position.set(
      Math.sin(polar) * Math.sin(azimuth) * responsiveRadius,
      Math.cos(polar) * responsiveRadius,
      Math.sin(polar) * Math.cos(azimuth) * responsiveRadius
    ).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }

  _ray(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, -(event.clientY - rect.top) / Math.max(1, rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }

  _point(event) {
    const point = new THREE.Vector3();
    if (!this._ray(event).ray.intersectPlane(this.groundPlane, point)) return null;
    const x = point.x / this.field.width * 100 + 50;
    const y = point.z / this.field.length * 100 + 50;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x, y };
  }

  _player(event) {
    const intersections = this._ray(event).intersectObjects(this.pickTargets, false);
    return intersections.length ? this.players.get(intersections[0].object.userData.playerKey) : null;
  }

  _hover(event) {
    const player = this._player(event);
    this.hoverKey = player?.data.key || null;
    this.callbacks.onHover?.(player?.data || null, { x: event.clientX, y: event.clientY });
    this.canvas.style.cursor = player ? 'pointer' : this.tool === 'camera' || this.tool === 'select' ? 'grab' : 'crosshair';
  }

  _bindEvents() {
    this.listeners = [];
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      this.listeners.push(() => target.removeEventListener(type, handler, options));
    };
    on(this.canvas, 'pointerdown', event => {
      if (!this.active || event.button === 1) return;
      event.preventDefault();
      this.canvas.setPointerCapture?.(event.pointerId);
      // The right button always turns the camera; so does dragging empty grass while selecting.
      const orbit = event.button === 2 || this.tool === 'camera' || (this.tool === 'select' && !this._player(event));
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, orbit, right: event.button === 2 });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        a.moved = b.moved = true;
      }
    });
    on(this.canvas, 'pointermove', event => {
      if (!this.active) return;
      const point = this._point(event);
      if (point) this.callbacks.onMove?.(point, event);
      const pointer = this.pointers.get(event.pointerId);
      if (pointer) {
        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;
        pointer.x = event.clientX; pointer.y = event.clientY;
        if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.moved = true;
        if (this.pointers.size > 1) {
          const [a, b] = [...this.pointers.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (this.pinchDistance > 0) this.cameraState.radius = clamp(this.cameraState.radius * this.pinchDistance / Math.max(1, distance), 65, 250);
          this.pinchDistance = distance;
          this._updateCamera(); this._requestRender();
          return;
        }
        if (pointer.orbit && pointer.moved) {
          this.canvas.style.cursor = 'grabbing';
          this.cameraState.azimuth -= dx * 0.006;
          this.cameraState.polar = clamp(this.cameraState.polar + dy * 0.005, 0.025, 1.22);
          this._updateCamera(); this._requestRender();
          return;
        }
      }
      this._hover(event);
    });
    on(this.canvas, 'pointerup', event => {
      const pointer = this.pointers.get(event.pointerId);
      this.pointers.delete(event.pointerId);
      if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (!pointer || pointer.moved || pointer.right || !this.active) return;
      // Players remain selectable in every drawing mode.
      const player = this._player(event);
      if (player) this.callbacks.onPlayer?.(player.data.key, event);
      else if (this.tool !== 'camera') {
        const point = this._point(event);
        if (point) this.callbacks.onPoint?.(point, event);
      }
      this._hover(event);
    });
    on(this.canvas, 'contextmenu', event => event.preventDefault());
    on(this.canvas, 'pointercancel', event => { this.pointers.delete(event.pointerId); this.pinchDistance = 0; });
    on(this.canvas, 'pointerleave', event => {
      if (!this.pointers.has(event.pointerId)) this.callbacks.onHover?.(null, { x: event.clientX, y: event.clientY });
    });
    on(this.canvas, 'wheel', event => {
      if (!this.active) return;
      event.preventDefault();
      this.cameraState.radius = clamp(this.cameraState.radius * Math.exp(clamp(event.deltaY, -300, 300) * 0.001), 65, 250);
      this._updateCamera(); this._requestRender();
    }, { passive: false });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; this.pointers.clear(); }
      else this._requestRender();
    });
    on(this.canvas, 'webglcontextlost', event => {
      event.preventDefault();
      cancelAnimationFrame(this.frame); this.frame = 0;
      this.host.dataset.simRenderer = 'context-lost';
    });
    on(this.canvas, 'webglcontextrestored', () => {
      this.host.dataset.simRenderer = 'ready'; this._requestRender();
    });
  }

  // Weather: clear | rain | snow | night | fog | storm. Particles fall over the pitch; night and storm dim the
  // lights, fog thickens the air, and a storm flashes now and then. It animates only while it is not clear.
  setWeather(kind = 'clear') {
    if (this.disposed) return;
    const kinds = ['clear', 'rain', 'snow', 'night', 'fog', 'storm'];
    this.weather = kinds.includes(kind) ? kind : 'clear';
    if (!this._lights) {
      this._lights = [];
      this.scene.traverse(object => { if (object.isLight) this._lights.push([object, object.intensity]); });
      this._sky = this.scene.background.clone();
    }
    const dark = this.weather === 'night' || this.weather === 'storm';
    for (const [light, base] of this._lights) light.intensity = base * (dark ? 0.38 : this.weather === 'fog' ? 0.8 : this.weather === 'rain' ? 0.78 : 1);
    this.scene.background.copy(this._sky).multiplyScalar(dark ? 0.35 : 1);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.density = this.weather === 'fog' ? 0.016 : this.weather === 'rain' || this.weather === 'storm' ? 0.006 : this.weather === 'snow' ? 0.005 : 0.0028;
    if (this.weatherPoints) { this.scene.remove(this.weatherPoints); this.weatherPoints.geometry.dispose(); this.weatherPoints.material.dispose(); this.weatherPoints = null; }
    cancelAnimationFrame(this._weatherFrame); this._weatherFrame = 0;
    if (!this.floodlights && dark) {
      // Four stadium lamps so the pitch stays readable at night.
      this.floodlights = new THREE.Group();
      for (const [x, z] of [[-45, -62], [45, -62], [-45, 62], [45, 62]]) {
        const lamp = new THREE.PointLight(0xdfeeff, 0, 170, 1.3); lamp.position.set(x, 38, z); this.floodlights.add(lamp);
      }
      this.scene.add(this.floodlights);
    }
    if (this.floodlights) for (const lamp of this.floodlights.children) lamp.intensity = dark ? 2600 : 0;
    const falling = this.weather === 'rain' || this.weather === 'storm' || this.weather === 'snow';
    if (falling) {
      const snow = this.weather === 'snow', count = snow ? 1400 : 2200, box = {x: 90, y: 45, z: 130};
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { positions[i * 3] = (Math.random() - .5) * box.x; positions[i * 3 + 1] = Math.random() * box.y; positions[i * 3 + 2] = (Math.random() - .5) * box.z; }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({color: snow ? 0xffffff : 0x9fc6e8, size: snow ? 0.55 : 0.32, transparent: true, opacity: snow ? 0.9 : 0.6, depthWrite: false});
      this.weatherPoints = new THREE.Points(geometry, material); this.weatherPoints.frustumCulled = false;
      this.scene.add(this.weatherPoints);
      this._weatherBox = box;
    }
    let last = performance.now(), flash = 0, nextFlash = 2 + Math.random() * 5;
    const tick = now => {
      this._weatherFrame = 0;
      if (this.disposed || this.weather === 'clear' || this.weather === 'night' || this.weather === 'fog') return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (this.weatherPoints && this.active && !document.hidden) {
        const p = this.weatherPoints.geometry.attributes.position, snow = this.weather === 'snow', box = this._weatherBox;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - (snow ? 4.5 : 42) * dt, x = p.getX(i) + (snow ? Math.sin(now / 900 + i) * 1.2 : 6) * dt;
          if (y < 0) { y += box.y; x = (Math.random() - .5) * box.x; }
          if (x > box.x / 2) x -= box.x;
          p.setXY(i, x, y);
        }
        p.needsUpdate = true;
      }
      if (this.weather === 'storm') {
        nextFlash -= dt;
        if (nextFlash <= 0) { flash = 1; nextFlash = 3 + Math.random() * 7; }
        flash = Math.max(0, flash - dt * 4);
        for (const [light, base] of this._lights) light.intensity = base * (0.38 + flash * 2.2);
      }
      this._requestRender();
      this._weatherFrame = requestAnimationFrame(tick);
    };
    if (this.weather !== 'clear') this._weatherFrame = requestAnimationFrame(tick);
    this.host.dataset.weather = this.weather;
    this._requestRender();
  }

  setActive(value) {
    this.active = !!value;
    if (!this.active) {
      cancelAnimationFrame(this.frame); this.frame = 0;
      this.pointers.clear();
      this.callbacks.onHover?.(null, { x: 0, y: 0 });
    } else { this.resize(); this._requestRender(); }
  }

  resize() {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this._updateCamera();
    this._requestRender();
  }

  project(point) {
    if (!validPoint(point) || this.disposed) return null;
    const rect = this.canvas.getBoundingClientRect();
    const projected = this._worldPoint(point, Number(point.height) || 0).project(this.camera);
    return {
      x: rect.left + (projected.x + 1) * rect.width / 2,
      y: rect.top + (1 - projected.y) * rect.height / 2,
      visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
    };
  }

  _requestRender() {
    if (this.disposed || !this.active || document.hidden || this.frame || this.host.dataset.simRenderer === 'context-lost') return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.disposed || !this.active || document.hidden) return;
      this.scene.updateMatrixWorld(true);
      this.renderer.render(this.scene, this.camera);
      this._updateLabels();
    });
  }

  _updateLabels() {
    for (const player of this.players.values()) {
      this.projected.copy(player.group.position);
      this.projected.y += (player.portrait.visible ? 6 : 3.7) + player.height;
      this.projected.project(this.camera);
      const visible = this.projected.z > -1 && this.projected.z < 1 && Math.abs(this.projected.x) < 1.15 && Math.abs(this.projected.y) < 1.15;
      player.label.hidden = !visible;
      if (visible) {
        player.label.style.left = `${(this.projected.x + 1) * this.width / 2}px`;
        player.label.style.top = `${(1 - this.projected.y) * this.height / 2}px`;
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.frame); this.frame = 0;
    cancelAnimationFrame(this._weatherFrame); this._weatherFrame = 0;
    this.resizeObserver?.disconnect();
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.callbacks.onHover?.(null, { x: 0, y: 0 });
    disposeObject(this.scene);
    this.textures.forEach(promise => promise.then(texture => texture?.dispose()));
    this.textures.clear();
    this.scene.clear();
    this.players.clear();
    this.annotationCache.clear();
    this.pointers.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.labelLayer.remove();
    this.host.style.position = this._hostPosition;
    this.host.style.overflow = this._hostOverflow;
    delete this.host.dataset.simRenderer;
    delete this.host.dataset.fieldMode;
    delete this.host.dataset.fieldSize;
    delete this.host.dataset.fieldWidth;
    delete this.host.dataset.fieldLength;
  }
}
