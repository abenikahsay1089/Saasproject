import { pool } from '../config/database.js';

/**
 * Returns board row if user is owner or team member; otherwise null.
 */
export async function getBoardIfMember(userId, boardId) {
  const { rows } = await pool.query(
    `SELECT b.*
     FROM boards b
     LEFT JOIN teams t ON t.board_id = b.id AND t.user_id = $2
     WHERE b.id = $1 AND (b.owner_id = $2 OR t.user_id IS NOT NULL)
     LIMIT 1`,
    [boardId, userId]
  );
  return rows[0] || null;
}

export function isBoardFrozen(board) {
  return board?.status === 'frozen';
}

/** Blocks task/list/invite edits when workspace is frozen. */
export function assertBoardWritable(board) {
  if (isBoardFrozen(board)) {
    const err = new Error(
      'This workspace is frozen. Ask the owner to unfreeze it before making changes.'
    );
    err.status = 423;
    throw err;
  }
}

export function handleBoardAccessError(res, e) {
  if (e.status) {
    return res.status(e.status).json({ error: e.message });
  }
  return null;
}

/**
 * Resolves list_id -> board_id for access checks.
 */
export async function getBoardIdForList(listId) {
  const { rows } = await pool.query(
    `SELECT board_id FROM lists WHERE id = $1`,
    [listId]
  );
  return rows[0]?.board_id ?? null;
}

/**
 * Resolves task_id -> board_id.
 */
export async function getBoardIdForTask(taskId) {
  const { rows } = await pool.query(
    `SELECT l.board_id
     FROM tasks t
     JOIN lists l ON l.id = t.list_id
     WHERE t.id = $1`,
    [taskId]
  );
  return rows[0]?.board_id ?? null;
}
