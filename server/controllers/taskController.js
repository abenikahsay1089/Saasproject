import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import {
  assertBoardWritable,
  getBoardIfMember,
  getBoardIdForList,
  getBoardIdForTask,
  handleBoardAccessError,
} from '../utils/boardAccess.js';
import { logActivity } from '../utils/activity.js';
import { emitToBoard } from '../sockets/boardSocket.js';
import { notifyUser } from '../services/notificationService.js';
import { getBoardMeta, getUserName, notifyTaskStakeholders } from '../utils/notifyHelpers.js';
import { assertCanSetTaskStatus, getPermissionsForUser } from '../utils/boardRoles.js';
import { findListIdForStatus, nextTaskPosition } from '../utils/taskListSync.js';

function mapTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    list_id: row.list_id,
    title: row.title,
    description: row.description,
    assigned_to: row.assigned_to,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const createTaskValidators = [
  body('listId').isInt(),
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('assignedTo').optional().isInt(),
  body('status').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('dueDate').optional().isISO8601(),
  body('position').optional().isInt(),
];

export async function tasksByList(req, res, next) {
  try {
    const listId = Number(req.params.listId);
    const boardId = await getBoardIdForList(listId);
    if (!boardId) return res.status(404).json({ error: 'List not found' });
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'List not found' });
    const { rows } = await pool.query(
      `SELECT t.*, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.list_id = $1
       ORDER BY t.position ASC, t.id ASC`,
      [listId]
    );
    res.json({ tasks: rows });
  } catch (e) {
    next(e);
  }
}

export async function createTask(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { listId, title, description, assignedTo, status, priority, dueDate, position } = req.body;
    const boardId = await getBoardIdForList(Number(listId));
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
    const permissions = await getPermissionsForUser(board, req.user.id);
    const effectiveStatus = status || 'open';
    try {
      assertCanSetTaskStatus(permissions, effectiveStatus);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }
    let pos = position;
    if (pos === undefined) {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM tasks WHERE list_id = $1`,
        [listId]
      );
      pos = rows[0].p;
    }
    const { rows } = await pool.query(
      `INSERT INTO tasks (list_id, title, description, assigned_to, status, priority, due_date, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        listId,
        title,
        description ?? null,
        assignedTo ?? null,
        effectiveStatus,
        priority || 'medium',
        dueDate || null,
        pos,
      ]
    );
    const task = mapTaskRow(rows[0]);
    const io = req.app.get('io');
    const boardMeta = await getBoardMeta(boardId);
    const assignerName = await getUserName(req.user.id);
    if (assignedTo && assignedTo !== req.user.id) {
      await notifyUser(io, {
        userId: assignedTo,
        message: `${assignerName} assigned you "${title}" on "${boardMeta?.title || 'a workspace'}".`,
        type: 'task_assigned',
        boardId,
        taskId: task.id,
      });
    }
    await notifyTaskStakeholders(io, {
      boardId,
      taskId: task.id,
      excludeUserId: req.user.id,
      assigneeId: assignedTo,
      includeAssignee: false,
      message: `${assignerName} created "${title}" on "${boardMeta?.title || 'a workspace'}".`,
      type: 'task_created',
    });
    const act = await logActivity({
      userId: req.user.id,
      action: 'task_created',
      entityType: 'task',
      entityId: task.id,
      boardId,
      details: { title: task.title },
    });
    if (io) {
      emitToBoard(io, boardId, 'taskCreated', { task, boardId });
      emitToBoard(io, boardId, 'activityAdded', act);
    }
    res.status(201).json({ task });
  } catch (e) {
    next(e);
  }
}

export const updateTaskValidators = [
  param('id').isInt(),
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('listId').optional().isInt(),
  body('assignedTo').optional({ nullable: true }).isInt(),
  body('status').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('dueDate').optional({ nullable: true }).isISO8601(),
  body('position').optional().isInt(),
];

export async function updateTask(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const taskId = Number(req.params.id);
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

    const { rows: before } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [taskId]);
    const prev = before[0];
    if (!prev) return res.status(404).json({ error: 'Task not found' });

    const permissions = await getPermissionsForUser(board, req.user.id);

    const {
      title,
      description,
      listId,
      assignedTo,
      status,
      priority,
      dueDate,
      position,
    } = req.body;

    if (listId !== undefined) {
      const newListId = Number(listId);
      const b2 = await getBoardIdForList(newListId);
      if (b2 !== boardId) {
        return res.status(400).json({ error: 'Target list must belong to the same board' });
      }
    }

    if (status !== undefined && status !== prev.status) {
      try {
        assertCanSetTaskStatus(permissions, status);
      } catch (e) {
        return res.status(e.status || 403).json({ error: e.message });
      }
    }

    let syncedListId;
    let syncedPosition;
    if (status !== undefined && status !== prev.status && listId === undefined) {
      syncedListId = await findListIdForStatus(boardId, status);
      if (syncedListId && syncedListId !== prev.list_id) {
        syncedPosition = await nextTaskPosition(syncedListId);
      } else {
        syncedListId = undefined;
      }
    }

    const updates = [];
    const params = [];
    let p = 1;
    if (title !== undefined) {
      updates.push(`title = $${p++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${p++}`);
      params.push(description);
    }
    if (listId !== undefined) {
      updates.push(`list_id = $${p++}`);
      params.push(Number(listId));
    } else if (syncedListId !== undefined) {
      updates.push(`list_id = $${p++}`);
      params.push(syncedListId);
    }
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${p++}`);
      params.push(assignedTo);
    }
    if (status !== undefined) {
      updates.push(`status = $${p++}`);
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${p++}`);
      params.push(priority);
    }
    if (dueDate !== undefined) {
      updates.push(`due_date = $${p++}`);
      params.push(dueDate || null);
    }
    if (position !== undefined) {
      updates.push(`position = $${p++}`);
      params.push(position);
    } else if (syncedPosition !== undefined) {
      updates.push(`position = $${p++}`);
      params.push(syncedPosition);
    }

    let task;
    if (updates.length === 0) {
      return res.json({ task: mapTaskRow(prev) });
    }
    params.push(taskId);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    task = mapTaskRow(rows[0]);
    const io = req.app.get('io');
    const boardMeta = await getBoardMeta(boardId);
    const actorName = await getUserName(req.user.id);
    const workspace = boardMeta?.title || 'a workspace';

    const moved = prev.list_id !== task.list_id || prev.position !== task.position;
    if (moved && io) {
      emitToBoard(io, boardId, 'taskMoved', { task, boardId, previousListId: prev.list_id });
    }

    if (assignedTo !== undefined && assignedTo !== prev.assigned_to) {
      if (assignedTo && assignedTo !== req.user.id) {
        await notifyUser(io, {
          userId: assignedTo,
          message: `${actorName} assigned you "${task.title}" on "${workspace}".`,
          type: 'task_assigned',
          boardId,
          taskId,
        });
      }
      if (prev.assigned_to && prev.assigned_to !== req.user.id && prev.assigned_to !== assignedTo) {
        await notifyUser(io, {
          userId: prev.assigned_to,
          message: `${actorName} unassigned you from "${task.title}" on "${workspace}".`,
          type: 'task_unassigned',
          boardId,
          taskId,
        });
      }
      await notifyTaskStakeholders(io, {
        boardId,
        taskId,
        excludeUserId: req.user.id,
        assigneeId: null,
        includeAssignee: false,
        message: `${actorName} updated assignment on "${task.title}" in "${workspace}".`,
        type: 'task_updated',
      });
    }

    const titleChanged = title !== undefined && title !== prev.title;
    const descChanged = description !== undefined && description !== prev.description;
    if (titleChanged || descChanged) {
      await notifyTaskStakeholders(io, {
        boardId,
        taskId,
        excludeUserId: req.user.id,
        assigneeId: task.assigned_to,
        message: `${actorName} updated "${prev.title}" on "${workspace}".`,
        type: 'task_updated',
      });
    }

    if (
      dueDate !== undefined &&
      String(dueDate) !== String(prev.due_date)
    ) {
      await notifyTaskStakeholders(io, {
        boardId,
        taskId,
        excludeUserId: req.user.id,
        assigneeId: task.assigned_to,
        message: `${actorName} changed the due date for "${task.title}" on "${workspace}".`,
        type: 'task_updated',
      });
    }

    if (priority !== undefined && priority !== prev.priority) {
      await notifyTaskStakeholders(io, {
        boardId,
        taskId,
        excludeUserId: req.user.id,
        assigneeId: task.assigned_to,
        message: `${actorName} set priority on "${task.title}" to ${priority} on "${workspace}".`,
        type: 'task_updated',
      });
    }

    if (status !== undefined && status !== prev.status) {
      if (status === 'done') {
        await notifyTaskStakeholders(io, {
          boardId,
          taskId,
          excludeUserId: req.user.id,
          assigneeId: task.assigned_to,
          message: `${actorName} marked "${task.title}" complete on "${workspace}".`,
          type: 'task_completed',
        });
      } else if (status === 'in_progress') {
        await notifyTaskStakeholders(io, {
          boardId,
          taskId,
          excludeUserId: req.user.id,
          assigneeId: task.assigned_to,
          message: `${actorName} marked "${task.title}" in progress on "${workspace}".`,
          type: 'task_status_changed',
        });
      } else if (status === 'open') {
        await notifyTaskStakeholders(io, {
          boardId,
          taskId,
          excludeUserId: req.user.id,
          assigneeId: task.assigned_to,
          message: `${actorName} reopened "${task.title}" on "${workspace}".`,
          type: 'task_status_changed',
        });
      }
    }

    if (moved) {
      await notifyTaskStakeholders(io, {
        boardId,
        taskId,
        excludeUserId: req.user.id,
        assigneeId: task.assigned_to,
        message: `${actorName} moved "${task.title}" on "${workspace}".`,
        type: 'task_moved',
      });
    }

    const act = await logActivity({
      userId: req.user.id,
      action: moved ? 'task_moved' : 'task_updated',
      entityType: 'task',
      entityId: task.id,
      boardId,
      details: { title: task.title, moved },
    });
    if (io) {
      emitToBoard(io, boardId, 'taskUpdated', { task, boardId });
      emitToBoard(io, boardId, 'activityAdded', act);
    }

    res.json({ task });
  } catch (e) {
    next(e);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
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
    const { rows: taskRows } = await pool.query(
      `SELECT title, assigned_to FROM tasks WHERE id = $1`,
      [taskId]
    );
    const deleted = taskRows[0];
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
    const io = req.app.get('io');
    const boardMeta = await getBoardMeta(boardId);
    const actorName = await getUserName(req.user.id);
    const workspace = boardMeta?.title || 'a workspace';
    if (deleted?.assigned_to && deleted.assigned_to !== req.user.id) {
      await notifyUser(io, {
        userId: deleted.assigned_to,
        message: `${actorName} deleted "${deleted.title}" on "${workspace}".`,
        type: 'task_deleted',
        boardId,
        taskId,
      });
    }
    await notifyTaskStakeholders(io, {
      boardId,
      taskId,
      excludeUserId: req.user.id,
      assigneeId: deleted?.assigned_to,
      includeAssignee: false,
      message: `${actorName} deleted "${deleted?.title}" on "${workspace}".`,
      type: 'task_deleted',
    });
    if (io) emitToBoard(io, boardId, 'taskDeleted', { taskId, boardId });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
