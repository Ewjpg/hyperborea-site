// Authored test reaction: both characters must be present on the same team.
// Future rules can use exact roles. '*' accepts any assigned football role.
export const CHEMISTRY_RULES = [{
  id: 'fear-wah-key',
  title: 'КЛЮЧ К СТРАХУ',
  lore: '',
  sameTeam: true,
  requirements: [{ player: 'fearCard', roles: ['*'] }, { player: 'wahCard', roles: ['*'] }]
}];

const roleName = value => String(value || '').trim().toUpperCase();

/** Resolve only authored rules against the roles actually assigned on the pitch. */
export function resolveChemistry(players, rules = CHEMISTRY_RULES) {
  if (!Array.isArray(players) || !Array.isArray(rules)) return [];
  const roster = players.filter(player => player && typeof player.id === 'string');
  const matches = [];
  for (const rule of rules) {
    if (!rule || typeof rule.id !== 'string' || typeof rule.title !== 'string'
      || !Array.isArray(rule.requirements) || !rule.requirements.length) continue;
    const requirements = rule.requirements;
    if (!requirements.every(item => item && typeof item.player === 'string'
      && Array.isArray(item.roles) && item.roles.length
      && item.roles.every(role => typeof role === 'string' && role.trim()))) continue;
    const groups = rule.sameTeam
      ? [...new Set(roster.map(player => player.team))].map(team => ({ team, players: roster.filter(player => player.team === team) }))
      : [{ team: null, players: roster }];
    for (const group of groups) {
      const candidates = requirements.map(requirement => group.players.filter(player =>
        player.id === requirement.player && requirement.roles.some(role => roleName(role) === roleName(player.role) || (role === '*' && roleName(player.role)))));
      // Each requirement must be fulfilled by a different slot, even if IDs repeat.
      const assign = (index, used) => index === candidates.length || candidates[index].some(player => {
        if (used.has(player)) return false;
        used.add(player);
        const found = assign(index + 1, used);
        used.delete(player);
        return found;
      });
      if (candidates.every(list => list.length) && assign(0, new Set())) {
        matches.push({ ...rule, team: group.team, lore: typeof rule.lore === 'string' ? rule.lore : '' });
      }
    }
  }
  return matches;
}
