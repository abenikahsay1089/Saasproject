import { pool } from '../config/database.js';

/**
 * Moves board ownership from current owner to newOwnerId.
 * Previous owner becomes admin on the team.
 */
export async function executeOwnershipTransfer(boardId, previousOwnerId, newOwnerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE boards SET owner_id = $1 WHERE id = $2`, [newOwnerId, boardId]);
    await client.query(`DELETE FROM teams WHERE board_id = $1 AND user_id = $2`, [boardId, newOwnerId]);
    await client.query(
      `INSERT INTO teams (board_id, user_id, role) VALUES ($1, $2, 'admin')
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'`,
      [boardId, previousOwnerId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
