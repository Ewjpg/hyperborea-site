// A shuffle bag keeps every fear in rotation, including across reloads.
export function chooseDossierFear(ids, saved = {}, random = Math.random) {
  if (!ids.length) throw new Error('At least one fear is required.');
  saved = saved && typeof saved === 'object' ? saved : {};
  const allowed = new Set(ids);
  let remaining = Array.isArray(saved.remaining)
    ? [...new Set(saved.remaining.filter(id => allowed.has(id)))] : [];
  if (!remaining.length) {
    remaining = [...ids];
    for (let i = remaining.length - 1; i > 0; i--) {
      const roll = Math.max(0, Math.min(.999999999, Number(random()) || 0));
      const j = Math.floor(roll * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
  }
  // Do not repeat at a bag boundary, or after a manual selection.
  if (remaining[0] === saved.last && ids.length > 1) {
    const different = remaining.findIndex(id => id !== saved.last);
    if (different > 0) [remaining[0], remaining[different]] = [remaining[different], remaining[0]];
    else remaining.unshift(ids.find(id => id !== saved.last));
  }
  const id = remaining.shift();
  return {id, state: {remaining, last: id}};
}
