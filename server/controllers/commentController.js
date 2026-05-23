import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import {
  assertBoardWritable,
  getBoardIdForTask,
  getBoardIfMember,
  handleBoardAccessError,
} from '../utils/boardAccess.js';
import {
  getBoardMeta,
  getBoardLeaderIds,
  getTaskDiscussionParticipantIds,
  getUserName,
  notifyUsers,
  truncateSnippet,
} from '../utils/notifyHelpers.js';
import { logActivity } from '../utils/activity.js';
import { emitToBoard } from '../sockets/boardSocket.js';

export const addCommentValidators = [
  param('taskId').isInt(),
  body('body').trim().isLength({ min: 1, max: 4000 }),
];

export async function listComments(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const boardId = await getBoardIdForTask(taskId);
    if (!boardId) return res.status(404).json({ error: 'Task not found' });
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Task not found' });
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS author_name, u.email AS author_email
       FROM task_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    res.json({ comments: rows });
  } catch (e) {
    next(e);
  }
}

export async function addComment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const taskId = Number(req.params.taskId);
    const { body: text } = req.body;
    const boardId = await getBoardIdForTask(taskId);
    if (!boardId) return res.status(404).json({ error: 'Task not found' });
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Task not found' });
    try {
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      throw e;
    }

    const { rows: T } = await pool.query(`SELECT title, assigned_to FROM tasks WHERE id = $1`, [taskId]);
    const taskMeta = T[0];

    const { rows } = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, req.user.id, text]
    );
    const io = req.app.get('io');

    const authorName = await getUserName(req.user.id);
    const boardMeta = await getBoardMeta(boardId);
    const workspace = boardMeta?.title || 'a workspace';
    const snippet = truncateSnippet(text);

    const participantIds = await getTaskDiscussionParticipantIds(taskId, req.user.id);
    const leaderIds = await getBoardLeaderIds(boardId, req.user.id);
    await notifyUsers(io, [...participantIds, ...leaderIds], {
      excludeUserId: req.user.id,
      message: `${authorName} commented on "${taskMeta.title}" on "${workspace}": "${snippet}"`,
      type: 'task_comment',
      boardId,
      taskId,
    });

    const act = await logActivity({
      userId: req.user.id,
      action: 'comment_added',
      entityType: 'task',
      entityId: taskId,
      boardId,
      details: { snippet: text.slice(0, 120) },
    });
    if (io) emitToBoard(io, boardId, 'activityAdded', act);

    res.status(201).json({ comment: rows[0] });
  } catch (e) {
    next(e);
  }
}
