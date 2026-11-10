// Keep the original six slots stable for saved profiles and append Offense.
export const STAT_AXES = Object.freeze(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'OFN']);
export const RANK_SCALE = Object.freeze([
  { rank: 'S', min: 90, max: 99 },
  { rank: 'A', min: 80, max: 89 },
  { rank: 'B', min: 70, max: 79 },
  { rank: 'C', min: 60, max: 69 },
  { rank: 'D', min: 50, max: 59 },
  { rank: 'E', min: 30, max: 49 },
  { rank: 'F', min: 0, max: 29 },
]);

export function parseRating(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(99, Math.round(number))) : null;
}

export function calculateOverall(ratings) {
  const values = STAT_AXES.map((_, index) => parseRating(ratings?.[index]));
  const filled = values.filter(value => value !== null).length;
  if (filled !== STAT_AXES.length) return { score: null, rank: null, filled };
  const score = Math.round(values.reduce((sum, value) => sum + value, 0) / STAT_AXES.length);
  return { score, rank: RANK_SCALE.find(level => score >= level.min).rank, filled };
}

export function radarPoint(value, index) {
  const angle = (-90 + index * 360 / STAT_AXES.length) * Math.PI / 180;
  const radius = 118 * value / 99;
  return [180 + Math.cos(angle) * radius, 164 + Math.sin(angle) * radius];
}
