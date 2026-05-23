import { pool } from '../config/database.js';

export function listTitleForStatus(status) {
  switch (status) {
    case 'open':
      return 'to do';
    case 'in_progress':
      return 'in progress';
    case 'done':
      return 'done';
    default:
      return null;
  }
}

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

export async function findListIdForStatus(boardId, status) {
  const want = listTitleForStatus(status);
  if (!want) return null;
  const { rows } = await pool.query(`SELECT id, title FROM lists WHERE board_id = $1`, [boardId]);
  const match = rows.find((r) => r.title.trim().toLowerCase() === want);
  return match?.id ?? null;
}

export async function nextTaskPosition(listId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM tasks WHERE list_id = $1`,
    [listId]
  );
  return rows[0].p;
}
