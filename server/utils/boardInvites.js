import { pool } from '../config/database.js';
import { notifyUser } from '../services/notificationService.js';

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/** Attach pending email-only invites to a user account (e.g. after login). */
export async function linkInvitesToUser(userId, email) {
  const emailNorm = normalizeEmail(email);
  try {
    await pool.query(
      `UPDATE board_invites SET user_id = $1
       WHERE LOWER(email) = $2 AND user_id IS NULL AND status = 'pending'`,
      [userId, emailNorm]
    );
  } catch (e) {
    if (e.code !== '42P01') throw e;
  }
}

/**
 * After registration: attach user_id to email invites and send inbox notifications (no auto-join).
 */
export async function linkInvitesAndNotifyNewUser(userId, email, io) {
  const emailNorm = normalizeEmail(email);
  let rows = [];
  try {
    const result = await pool.query(
      `UPDATE board_invites
       SET user_id = $1
       WHERE LOWER(email) = $2 AND user_id IS NULL AND status = 'pending'
       RETURNING id, board_id`,
      [userId, emailNorm]
    );
    rows = result.rows;
  } catch (e) {
    if (e.code === '42P01') return 0;
    throw e;
  }

  for (const row of rows) {
    const { rows: boards } = await pool.query(`SELECT title FROM boards WHERE id = $1`, [
      row.board_id,
    ]);
    const title = boards[0]?.title || 'a workspace';
    await notifyUser(io, {
      userId,
      message: `You were invited to "${title}". Open your Inbox to accept or decline.`,
      type: 'board_invite',
      boardInviteId: row.id,
    });
  }
  return rows.length;
}
