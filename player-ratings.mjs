import { STAT_AXES, calculateOverall, radarPoint } from './rating-model.mjs?v=36';

export function createProfileRadar(prefix) {
  const $ = suffix => document.getElementById(prefix + suffix);
  const polygon = $('RadarProfile'), dots = $('RadarDots'), description = $('RadarDesc');
  const overall = $('Overall'), score = $('OverallScore'), rank = $('OverallRank');
  const state = $('OverallState'), meter = overall.querySelector('.overall-meter > span');
  return values => {
    dots.replaceChildren();
    values.forEach((value, index) => {
      if (value === null) return;
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const [x, y] = radarPoint(value, index);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '2.5');
      dots.append(dot);
    });
    const result = calculateOverall(values);
    polygon.style.display = result.score === null ? 'none' : '';
    if (result.score !== null) polygon.setAttribute('points', values.map((value, index) => radarPoint(value, index).join(',')).join(' '));
    description.textContent = STAT_AXES.map((axis, index) => axis + ': ' + (values[index] ?? 'не задано')).join(', ') + '.';
    overall.dataset.rank = result.rank || 'unrated';
    score.textContent = result.score ?? '—';
    rank.textContent = result.rank ?? '—';
    rank.setAttribute('aria-label', result.rank ? 'Ранг ' + result.rank : 'Ранг не рассчитан');
    state.textContent = result.score === null ? 'Заполнено ' + result.filled + ' / 7' : 'Ранг ' + result.rank;
    meter.style.width = result.score === null ? '0%' : (result.score / 99 * 100).toFixed(2) + '%';
  };
}
