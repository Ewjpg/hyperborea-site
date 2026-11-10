// Distances and accuracy are editor rules, not a prediction of a real match.
// Persist calculatePass's sampled result with the action; never reroll playback.
export const FIELD_SPECS = Object.freeze({
  '5': Object.freeze({ width: 40, length: 60 }),
  '11': Object.freeze({ width: 68, length: 105 })
});

export const PASS_RANGES = Object.freeze({
  short: Object.freeze({ label: 'Короткий', min: 0, max: 15 }),
  medium: Object.freeze({ label: 'Средний', min: 15, max: 30 }),
  long: Object.freeze({ label: 'Длинный', min: 30, max: Infinity })
});

export function getFieldSpec(mode) {
  return FIELD_SPECS[String(mode)] || FIELD_SPECS['11'];
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function pitchPoint(point) {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number'
    || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('A pitch point needs finite numeric x and y coordinates.');
  }
  return { x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) };
}

/** Straight ground distance between normalized pitch coordinates, in metres. */
export function distanceMeters(from, to, mode) {
  const a = pitchPoint(from), b = pitchPoint(to), field = getFieldSpec(mode);
  return Math.hypot((b.x - a.x) * field.width / 100, (b.y - a.y) * field.length / 100);
}

export function classifyDistance(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres) || metres < 0) return null;
  return metres <= 15 ? 'short' : metres <= 30 ? 'medium' : 'long';
}

function passingStat(value) {
  if (value === null || value === undefined || typeof value === 'boolean'
    || (typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 99 ? Math.round(number) : null;
}

// A small integer hash gives independent deterministic samples for nearby seeds.
function sample(seed, stream) {
  let value = ((Number.isFinite(seed) ? seed : 0) >>> 0) + Math.imul(stream + 1, 0x9e3779b9) | 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return ((value ^ value >>> 15) >>> 0) / 4294967296;
}

const difficulty = Object.freeze({ low: 0, lob: 0.04, through: 0.06, hidden: 0.07, curve: 0.08 });

/**
 * Sample one pass. Unknown PAS remains unrated and follows the authored target.
 * Curve distance uses the endpoint chord; flight height does not add ground metres.
 * successChance is 0..1; accurate=null means no accuracy roll was performed.
 */
export function calculatePass({ from, to, mode, pas, variant = 'low', seed = 0 } = {}) {
  const start = pitchPoint(from), target = pitchPoint(to), field = getFieldSpec(mode);
  const metres = distanceMeters(start, target, mode), rating = passingStat(pas);
  const base = { distanceMeters: metres, range: classifyDistance(metres), pas: rating };
  if (rating === null) {
    return { ...base, successChance: null, accurate: null, errorMeters: 0, actualTo: target };
  }
  const quality = rating / 99, penalty = difficulty[variant] || 0;
  const chance = clamp(0.46 + 0.51 * quality - metres * 0.0072
    - metres * 0.007 * (1 - quality) - penalty, 0.05, 0.97);
  const accurate = sample(seed, 0) < chance;
  if (accurate) return { ...base, successChance: chance, accurate: true, errorMeters: 0, actualTo: target };

  const radius = clamp((1.2 + 5.5 * (1 - quality) + Math.min(metres, 110) * 0.065 + penalty * 8)
    * (0.72 + sample(seed, 2) * 0.43), 2, 12);
  const angle = sample(seed, 1) * Math.PI * 2;
  let actualTo = target, errorMeters = 0;
  // At a touchline choose the inward alternative instead of clipping a miss to zero.
  for (const turn of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const candidate = {
      x: clamp(target.x + Math.cos(angle + turn) * radius / field.width * 100, 0, 100),
      y: clamp(target.y + Math.sin(angle + turn) * radius / field.length * 100, 0, 100)
    };
    const error = distanceMeters(target, candidate, mode);
    if (error > errorMeters) { actualTo = candidate; errorMeters = error; }
    if (error >= radius - 1e-8) break;
  }
  return { ...base, successChance: chance, accurate: false, errorMeters, actualTo };
}
