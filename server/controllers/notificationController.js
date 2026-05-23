import { param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';

export async function listNotifications(req, res, next) {
  try {
    let rows;
    try {
      const result = await pool.query(
        `SELECT id, user_id, message, type, read_status, board_invite_id, ownership_transfer_id,
                board_id, task_id, conversation_id, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.user.id]
      );
      rows = result.rows;
    } catch (e) {
      if (e.code !== '42703') throw e;
      try {
        const result = await pool.query(
          `SELECT id, user_id, message, type, read_status, board_invite_id, ownership_transfer_id, created_at
           FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [req.user.id]
        );
        rows = result.rows.map((n) => ({
          ...n,
          board_id: null,
          task_id: null,
          conversation_id: null,
        }));
      } catch (e2) {
        if (e2.code !== '42703') throw e2;
        const result = await pool.query(
          `SELECT id, user_id, message, type, read_status, created_at
           FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [req.user.id]
        );
        rows = result.rows.map((n) => ({
          ...n,
          board_invite_id: null,
          ownership_transfer_id: null,
        }));
      }
    }
    res.json({ notifications: rows });
  } catch (e) {
    next(e);
  }
}

export const readNotificationValidators = [param('id').isInt()];

export async function markNotificationRead(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `UPDATE notifications SET read_status = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (e) {
    next(e);
  }
}
