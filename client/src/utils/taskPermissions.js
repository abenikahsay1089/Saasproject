/** Matches default column names to task status. */
export function statusForListTitle(title) {
  const t = String(title || '')
    .trim()
    .toLowerCase();
  if (t === 'to do') return 'open';
  if (t === 'in progress') return 'in_progress';
  if (t === 'done') return 'done';
  return null;
}

export function isRestrictedListTitle(title) {
  const status = statusForListTitle(title);
  return status === 'in_progress' || status === 'done';
}
