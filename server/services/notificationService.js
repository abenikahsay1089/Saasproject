import { pool } from '../config/database.js';

/**
 * Inserts a notification and pushes it over Socket.io to the user's personal room.
 */
export async function notifyUser(
  io,
  {
    userId,
    message,
    type,
    boardInviteId = null,
    ownershipTransferId = null,
    boardId = null,
    taskId = null,
    conversationId = null,
  }
) {
  if (!userId) return null;
  let n;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (
         user_id, message, type, board_invite_id, ownership_transfer_id,
         board_id, task_id, conversation_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, message, type, boardInviteId, ownershipTransferId, boardId, taskId, conversationId]
    );
    n = rows[0];
  } catch (e) {
    if (e.code !== '42703') throw e;
    try {
      const { rows } = await pool.query(
        `INSERT INTO notifications (user_id, message, type, board_invite_id, ownership_transfer_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, message, type, boardInviteId, ownershipTransferId]
      );
      n = {
        ...rows[0],
        board_id: boardId,
        task_id: taskId,
        conversation_id: conversationId,
      };
    } catch (e2) {
      if (e2.code !== '42703') throw e2;
      const { rows } = await pool.query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, message, type]
      );
      n = {
        ...rows[0],
        board_invite_id: boardInviteId,
        ownership_transfer_id: ownershipTransferId,
        board_id: boardId,
        task_id: taskId,
        conversation_id: conversationId,
      };
    }
  }
  if (io && n) {
    io.to(`user:${userId}`).emit('notification', n);
  }
  return n;
}

/** Notify several users with the same payload (deduped). */
export async function notifyMany(io, userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean).map(Number))];
  const results = [];
  for (const userId of unique) {
    const n = await notifyUser(io, { ...payload, userId });
    if (n) results.push(n);
  }
  return results;
}
