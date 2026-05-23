import { param, query, validationResult } from 'express-validator';
import { pool } from '../config/database.js';

export const userIdParam = [param('id').isInt()];

/** True if both users share at least one workspace. */
async function usersShareBoard(userA, userB) {
  if (userA === userB) return true;
  const { rows } = await pool.query(
    `SELECT 1
     FROM boards b
     WHERE (
       b.owner_id = $1 OR EXISTS (SELECT 1 FROM teams t WHERE t.board_id = b.id AND t.user_id = $1)
     )
     AND (
       b.owner_id = $2 OR EXISTS (SELECT 1 FROM teams t WHERE t.board_id = b.id AND t.user_id = $2)
     )
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

export const searchUsersValidators = [
  query('q').trim().isLength({ min: 2, max: 100 }).withMessage('Enter at least 2 characters'),
];

/** Find users by @username or display name (any registered user, for invites). */
export async function searchUsers(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const term = req.query.q.trim();
    const exact = term.toLowerCase();
    const pattern = `%${exact}%`;
    const prefix = `${exact}%`;

    let rows;
    try {
      const result = await pool.query(
        `SELECT id, name, username, avatar_url
         FROM users
         WHERE id <> $1
           AND (LOWER(username) LIKE $2 OR LOWER(name) LIKE $2)
         ORDER BY
           CASE
             WHEN LOWER(username) = $3 THEN 0
             WHEN LOWER(name) = $3 THEN 1
             WHEN LOWER(username) LIKE $4 OR LOWER(name) LIKE $4 THEN 2
             ELSE 3
           END,
           name ASC
         LIMIT 20`,
        [req.user.id, pattern, exact, prefix]
      );
      rows = result.rows;
    } catch (e) {
      if (e.code !== '42703') throw e;
      const result = await pool.query(
        `SELECT id, name, email, avatar_url
         FROM users
         WHERE id <> $1 AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2)
         ORDER BY name ASC
         LIMIT 20`,
        [req.user.id, pattern]
      );
      rows = result.rows.map((u) => ({
        ...u,
        username: u.email?.split('@')[0] || `user${u.id}`,
      }));
    }

    res.json({ users: rows });
  } catch (e) {
    next(e);
  }
}

export async function getUserProfile(req, res, next) {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const sharedWorkspace = await usersShareBoard(req.user.id, targetId);
    const { rows } = await pool.query(
      `SELECT id, name, username, email, avatar_url, bio, created_at
       FROM users WHERE id = $1`,
      [targetId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const user = { ...rows[0] };
    if (!sharedWorkspace && user.id !== req.user.id) {
      delete user.email;
    }

    res.json({ user, sharedWorkspace });
  } catch (e) {
    next(e);
  }
}
