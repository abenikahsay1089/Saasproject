import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import { signToken } from '../utils/jwt.js';
import { deleteAvatarFile } from '../utils/avatarFiles.js';
import { linkInvitesAndNotifyNewUser, linkInvitesToUser } from '../utils/boardInvites.js';
import { notifyUser } from '../services/notificationService.js';
import {
  findAvailableUsername,
  isValidUsername,
  normalizeUsername,
  suggestUsernameFromEmail,
} from '../utils/username.js';

const USER_COLUMNS = 'id, name, username, email, avatar_url, bio, created_at';

async function loadUserProfile(userId) {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user) return null;
  const { rows: statsRows } = await pool.query(
    `SELECT
       (SELECT COUNT(DISTINCT b.id)::int
        FROM boards b
        LEFT JOIN teams t ON t.board_id = b.id
        WHERE b.owner_id = $1 OR t.user_id = $1) AS boards_count,
       (SELECT COUNT(*)::int FROM tasks WHERE assigned_to = $1) AS tasks_assigned,
       (SELECT COUNT(*)::int FROM notifications WHERE user_id = $1 AND read_status = FALSE) AS unread_notifications`,
    [userId]
  );
  return { user, stats: statsRows[0] };
}

export const registerValidators = [
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3–30 characters: letters, numbers, underscore'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
];

export const loginValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    let username = normalizeUsername(req.body.username || suggestUsernameFromEmail(email));
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    username = await findAvailableUsername(username);
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [name, username, email, hash]
    );
    const user = rows[0];
    const io = req.app.get('io');
    await linkInvitesAndNotifyNewUser(user.id, user.email, io);
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (e) {
    if (e.code === '23505') {
      if (e.constraint?.includes('username')) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, name, email, password, created_at FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    delete user.password;
    await linkInvitesToUser(user.id, user.email);
    await ensureInviteNotifications(user.id, user.email, req.app.get('io'));
    const token = signToken(user);
    res.json({ user, token });
  } catch (e) {
    next(e);
  }
}

async function inviteNotificationExists(userId, inviteId, boardTitle) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM notifications n
       WHERE n.user_id = $1 AND n.type = 'board_invite'
         AND (n.board_invite_id = $2 OR n.message LIKE $3)
       LIMIT 1`,
      [userId, inviteId, `%${boardTitle}%`]
    );
    return rows.length > 0;
  } catch (e) {
    if (e.code !== '42703') throw e;
    const { rows } = await pool.query(
      `SELECT 1 FROM notifications n
       WHERE n.user_id = $1 AND n.type = 'board_invite' AND n.message LIKE $2
       LIMIT 1`,
      [userId, `%${boardTitle}%`]
    );
    return rows.length > 0;
  }
}

async function ensureInviteNotifications(userId, email, io) {
  const emailNorm = email.trim().toLowerCase();
  let rows = [];
  try {
    const result = await pool.query(
      `SELECT i.id, b.title
       FROM board_invites i
       JOIN boards b ON b.id = i.board_id
       WHERE i.status = 'pending'
         AND (i.user_id = $1 OR LOWER(i.email) = $2)`,
      [userId, emailNorm]
    );
    rows = result.rows;
  } catch (e) {
    if (e.code === '42P01') return;
    if (e.code !== '42703') throw e;
    const result = await pool.query(
      `SELECT i.id, b.title
       FROM board_invites i
       JOIN boards b ON b.id = i.board_id
       WHERE i.user_id = $1 OR LOWER(i.email) = $2`,
      [userId, emailNorm]
    );
    rows = result.rows;
  }
  for (const row of rows) {
    const exists = await inviteNotificationExists(userId, row.id, row.title);
    if (exists) continue;
    await notifyUser(io, {
      userId,
      message: `You were invited to "${row.title}". Open Inbox or Workspaces to accept.`,
      type: 'board_invite',
      boardInviteId: row.id,
    });
  }
}

export async function me(req, res, next) {
  try {
    const { rows: meRow } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    if (meRow[0]) {
      await linkInvitesToUser(req.user.id, meRow[0].email);
      await ensureInviteNotifications(req.user.id, meRow[0].email, req.app.get('io'));
    }
    const profile = await loadUserProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (e) {
    next(e);
  }
}

export const updateProfileValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 255 }),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3–30 characters: letters, numbers, underscore'),
  body('email').optional().isEmail().normalizeEmail(),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('avatarUrl').optional({ nullable: true }).isString(),
];

export async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, username, email, bio, avatarUrl } = req.body;
    const updates = [];
    const params = [];
    let p = 1;
    if (name !== undefined) {
      updates.push(`name = $${p++}`);
      params.push(name);
    }
    if (username !== undefined) {
      const uname = normalizeUsername(username);
      if (!isValidUsername(uname)) {
        return res.status(400).json({ error: 'Invalid username format' });
      }
      const { rows: taken } = await pool.query(
        `SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2`,
        [uname, req.user.id]
      );
      if (taken.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.push(`username = $${p++}`);
      params.push(uname);
    }
    if (email !== undefined) {
      const { rows: taken } = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id <> $2`,
        [email, req.user.id]
      );
      if (taken.length > 0) {
        return res.status(409).json({ error: 'Email is already in use' });
      }
      updates.push(`email = $${p++}`);
      params.push(email);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${p++}`);
      params.push(bio);
    }
    if (avatarUrl !== undefined) {
      if (!avatarUrl) {
        const { rows } = await pool.query(`SELECT avatar_url FROM users WHERE id = $1`, [
          req.user.id,
        ]);
        deleteAvatarFile(rows[0]?.avatar_url);
      }
      updates.push(`avatar_url = $${p++}`);
      params.push(avatarUrl || null);
    }
    if (updates.length === 0) {
      const profile = await loadUserProfile(req.user.id);
      return res.json(profile);
    }
    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, params);
    const profile = await loadUserProfile(req.user.id);
    res.json(profile);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    next(e);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const { rows: existing } = await pool.query(`SELECT avatar_url FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    deleteAvatarFile(existing[0]?.avatar_url);

    const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;
    await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [
      avatarUrl,
      req.user.id,
    ]);
    const profile = await loadUserProfile(req.user.id);
    res.json(profile);
  } catch (e) {
    next(e);
  }
}

export async function deleteAvatar(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT avatar_url FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    deleteAvatarFile(rows[0]?.avatar_url);
    await pool.query(`UPDATE users SET avatar_url = NULL WHERE id = $1`, [req.user.id]);
    const profile = await loadUserProfile(req.user.id);
    res.json(profile);
  } catch (e) {
    next(e);
  }
}
