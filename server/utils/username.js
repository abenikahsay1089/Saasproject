import { pool } from '../config/database.js';

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(raw) {
  return String(raw).trim().toLowerCase();
}

export function isValidUsername(username) {
  return USERNAME_RE.test(username);
}

export function suggestUsernameFromEmail(email) {
  const local = String(email).split('@')[0] || 'user';
  let base = local.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  base = base.replace(/^_|_$/g, '');
  if (base.length < 3) base = `user_${base || 'x'}`;
  return base.slice(0, 30);
}

export async function findAvailableUsername(preferred) {
  let candidate = normalizeUsername(preferred);
  if (!isValidUsername(candidate)) {
    candidate = 'user';
  }
  for (let i = 0; i < 100; i++) {
    const tryName = i === 0 ? candidate : `${candidate.slice(0, 24)}_${i}`;
    const { rows } = await pool.query(`SELECT 1 FROM users WHERE LOWER(username) = $1`, [tryName]);
    if (!rows.length) return tryName;
  }
  throw new Error('Could not generate username');
}
