import { pool } from '../config/database.js';

/**
 * Persists an activity log row and returns the inserted row (without join).
 */
export async function logActivity({ userId, action, entityType, entityId, boardId, details }) {
  const { rows } = await pool.query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, board_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, action, entity_type, entity_id, board_id, details, created_at`,
    [userId, action, entityType, entityId ?? null, boardId ?? null, details ? JSON.stringify(details) : null]
  );
  return rows[0];
}
