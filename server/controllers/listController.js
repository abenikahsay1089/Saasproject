import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import {
  assertBoardWritable,
  getBoardIfMember,
  getBoardIdForList,
  handleBoardAccessError,
} from '../utils/boardAccess.js';
import { emitToBoard } from '../sockets/boardSocket.js';
import { logActivity } from '../utils/activity.js';
import { notifyUser } from '../services/notificationService.js';
import { getBoardMeta, getUserName, notifyTaskStakeholders } from '../utils/notifyHelpers.js';
import { getPermissionsForUser, isRestrictedListTitle } from '../utils/boardRoles.js';
import { statusForListTitle } from '../utils/taskListSync.js';

export const createListValidators = [
  body('boardId').isInt(),
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('position').optional().isInt(),
];

export async function listsByBoard(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const { rows } = await pool.query(
      `SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC, id ASC`,
      [boardId]
    );
    res.json({ lists: rows });
  } catch (e) {
    next(e);
  }
}

export async function createList(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { boardId, title, position } = req.body;
    const board = await getBoardIfMember(req.user.id, Number(boardId));
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      throw e;
    }
    let pos = position;
    if (pos === undefined) {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM lists WHERE board_id = $1`,
        [boardId]
      );
      pos = rows[0].p;
    }
    const { rows } = await pool.query(
      `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING *`,
      [boardId, title, pos]
    );
    const list = rows[0];
    const io = req.app.get('io');
    const act = await logActivity({
      userId: req.user.id,
      action: 'list_created',
      entityType: 'list',
      entityId: list.id,
      boardId: Number(boardId),
      details: { title: list.title },
    });
    if (io) emitToBoard(io, Number(boardId), 'activityAdded', act);
    res.status(201).json({ list });
  } catch (e) {
    next(e);
  }
}

export const updateListValidators = [
  param('id').isInt(),
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('position').optional().isInt(),
];

export async function updateList(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const listId = Number(req.params.id);
    const { rows: L } = await pool.query(`SELECT board_id FROM lists WHERE id = $1`, [listId]);
    const listRow = L[0];
    if (!listRow) return res.status(404).json({ error: 'List not found' });
    const board = await getBoardIfMember(req.user.id, listRow.board_id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      throw e;
    }
    const { title, position } = req.body;
    const { rows } = await pool.query(
      `UPDATE lists SET
        title = COALESCE($1, title),
        position = COALESCE($2, position)
       WHERE id = $3
       RETURNING *`,
      [title ?? null, position ?? null, listId]
    );
    res.json({ list: rows[0] });
  } catch (e) {
    next(e);
  }
}

export async function deleteList(req, res, next) {
  try {
    const listId = Number(req.params.id);
    const { rows: L } = await pool.query(`SELECT board_id FROM lists WHERE id = $1`, [listId]);
    const listRow = L[0];
    if (!listRow) return res.status(404).json({ error: 'List not found' });
    const board = await getBoardIfMember(req.user.id, listRow.board_id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      throw e;
    }
    await pool.query(`DELETE FROM lists WHERE id = $1`, [listId]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export const reorderTasksValidators = [
  param('listId').isInt(),
  body('taskIds').isArray(),
  body('taskIds.*').isInt(),
];

/**
 * Sets task order within a list (and list_id for each task to this list).
 * Used after drag-and-drop to persist positions 0..n-1.
 */
export async function reorderTasksInList(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const listId = Number(req.params.listId);
    const boardId = await getBoardIdForList(listId);
    if (!boardId) return res.status(404).json({ error: 'List not found' });
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'List not found' });
    try {
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      throw e;
    }
    const { rows: listRows } = await pool.query(`SELECT title FROM lists WHERE id = $1`, [listId]);
    if (isRestrictedListTitle(listRows[0]?.title)) {
      const permissions = await getPermissionsForUser(board, req.user.id);
      if (!permissions.canManageTaskStatus) {
        return res.status(403).json({
          error:
            'Only the workspace owner or an admin can move tasks to In progress or Done',
        });
      }
    }
    const listTitle = listRows[0]?.title;
    const syncedStatus = statusForListTitle(listTitle);
    const { taskIds } = req.body;
    const ids = taskIds.map(Number);
    const { rows: tasksBefore } = await pool.query(
      `SELECT id, list_id, assigned_to, title FROM tasks WHERE id = ANY($1::int[])`,
      [ids]
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < taskIds.length; i++) {
        const tid = Number(taskIds[i]);
        const before = tasksBefore.find((t) => t.id === tid);
        const movedHere = before && before.list_id !== listId;
        const { rowCount } = await client.query(
          movedHere && syncedStatus
            ? `UPDATE tasks SET list_id = $1, position = $2, status = $5 WHERE id = $3 AND list_id IN (
                 SELECT id FROM lists WHERE board_id = $4
               )`
            : `UPDATE tasks SET list_id = $1, position = $2 WHERE id = $3 AND list_id IN (
                 SELECT id FROM lists WHERE board_id = $4
               )`,
          movedHere && syncedStatus
            ? [listId, i, tid, boardId, syncedStatus]
            : [listId, i, tid, boardId]
        );
        if (rowCount === 0) {
          throw new Error('Invalid task or list for this board');
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.message?.includes('Invalid task')) {
        return res.status(400).json({ error: e.message });
      }
      throw e;
    } finally {
      client.release();
    }
    const io = req.app.get('io');
    if (io) emitToBoard(io, boardId, 'tasksReordered', { listId, taskIds });

    const boardMeta = await getBoardMeta(boardId);
    const actorName = await getUserName(req.user.id);
    const workspace = boardMeta?.title || 'a workspace';
    for (const t of tasksBefore) {
      if (t.list_id !== listId) {
        if (t.assigned_to && t.assigned_to !== req.user.id) {
          await notifyUser(io, {
            userId: t.assigned_to,
            message: `${actorName} moved "${t.title}" on "${workspace}".`,
            type: 'task_moved',
            boardId,
            taskId: t.id,
          });
        }
        await notifyTaskStakeholders(io, {
          boardId,
          taskId: t.id,
          excludeUserId: req.user.id,
          assigneeId: t.assigned_to,
          includeAssignee: false,
          message: `${actorName} moved "${t.title}" on "${workspace}".`,
          type: 'task_moved',
        });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
