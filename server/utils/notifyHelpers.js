import { pool } from '../config/database.js';
import { notifyUser } from '../services/notificationService.js';

export async function getUserName(userId) {
  if (!userId) return 'Someone';
  const { rows } = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
  return rows[0]?.name || 'Someone';
}

export async function getBoardMeta(boardId) {
  const { rows } = await pool.query(`SELECT id, title, owner_id FROM boards WHERE id = $1`, [boardId]);
  return rows[0] || null;
}

/** All workspace members: owner + team rows. */
export async function getBoardMemberIds(boardId, excludeUserId = null) {
  const board = await getBoardMeta(boardId);
  if (!board) return [];
  const { rows } = await pool.query(`SELECT user_id FROM teams WHERE board_id = $1`, [boardId]);
  const ids = new Set(rows.map((r) => r.user_id));
  ids.add(board.owner_id);
  if (excludeUserId) ids.delete(Number(excludeUserId));
  return [...ids];
}

/** Owner + admins on a workspace. */
export async function getBoardLeaderIds(boardId, excludeUserId = null) {
  const board = await getBoardMeta(boardId);
  if (!board) return [];
  const { rows } = await pool.query(
    `SELECT user_id FROM teams WHERE board_id = $1 AND role = 'admin'`,
    [boardId]
  );
  const ids = new Set(rows.map((r) => r.user_id));
  ids.add(board.owner_id);
  if (excludeUserId) ids.delete(Number(excludeUserId));
  return [...ids];
}

/**
 * Notify unique user ids (skips null/undefined and excluded id).
 */
export async function notifyUsers(io, userIds, payload) {
  const seen = new Set();
  for (const rawId of userIds) {
    const userId = Number(rawId);
    if (!userId || seen.has(userId)) continue;
    if (payload.excludeUserId && userId === Number(payload.excludeUserId)) continue;
    seen.add(userId);
    const { excludeUserId: _, ...rest } = payload;
    try {
      await notifyUser(io, { userId, ...rest });
    } catch (e) {
      console.error(`Notification failed for user ${userId}:`, e.message);
    }
  }
}

/**
 * Task updates: assignee (optional) + workspace owner + admins, deduped.
 */
export async function notifyTaskStakeholders(
  io,
  { boardId, taskId, excludeUserId, message, type, assigneeId = null, includeAssignee = true }
) {
  const leaderIds = await getBoardLeaderIds(boardId, excludeUserId);
  const targets = new Set(leaderIds);
  if (includeAssignee && assigneeId && Number(assigneeId) !== Number(excludeUserId)) {
    targets.add(Number(assigneeId));
  }
  await notifyUsers(io, [...targets], {
    excludeUserId,
    message,
    type,
    boardId,
    taskId,
  });
}

/** Assignee + prior commenters on a task (for comment notifications). */
export async function getTaskDiscussionParticipantIds(taskId, excludeUserId = null) {
  const { rows: taskRows } = await pool.query(
    `SELECT assigned_to FROM tasks WHERE id = $1`,
    [taskId]
  );
  const { rows: commenters } = await pool.query(
    `SELECT DISTINCT user_id FROM task_comments WHERE task_id = $1`,
    [taskId]
  );
  const ids = new Set(commenters.map((r) => r.user_id));
  if (taskRows[0]?.assigned_to) ids.add(taskRows[0].assigned_to);
  if (excludeUserId) ids.delete(Number(excludeUserId));
  return [...ids];
}

/** Everyone on the workspace except the actor. */
export async function notifyBoardMembers(
  io,
  boardId,
  { excludeUserId, message, type, conversationId = null, taskId = null }
) {
  const memberIds = await getBoardMemberIds(boardId, excludeUserId);
  await notifyUsers(io, memberIds, {
    excludeUserId,
    message,
    type,
    boardId,
    taskId,
    conversationId,
  });
}

/**
 * Workspace owner + person who sent the invite (e.g. an admin), when different from owner.
 */
export async function notifyWorkspaceStakeholders(
  io,
  { boardId, invitedBy, excludeUserId, message, type }
) {
  const board = await getBoardMeta(boardId);
  if (!board) return;
  await notifyUsers(io, [board.owner_id, invitedBy], {
    excludeUserId,
    message,
    type,
    boardId,
  });
}

export function truncateSnippet(text, max = 80) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
