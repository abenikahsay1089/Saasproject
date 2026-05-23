import { pool } from '../config/database.js';

export async function getTeamRole(userId, boardId) {
  const { rows } = await pool.query(
    `SELECT role FROM teams WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId]
  );
  return rows[0]?.role ?? null;
}

/**
 * Permission matrix:
 * - Owner: transfer ownership, promote/demote admins, remove anyone, invite, cancel invites, edit/delete workspace
 * - Admin: invite members, cancel pending invites, set task In progress/Done
 * - Member: no people management
 */
export function buildBoardPermissions(board, userId, teamRole) {
  const isOwner = Number(board.owner_id) === Number(userId);
  const isAdmin = teamRole === 'admin';
  return {
    isOwner,
    isAdmin,
    canInvite: isOwner || isAdmin,
    canRemoveMembers: isOwner,
    canManageRoles: isOwner,
    canTransferOwnership: isOwner,
    canCancelInvites: isOwner || isAdmin,
    canUpdateBoard: isOwner,
    canDeleteBoard: isOwner,
    canManageTaskStatus: isOwner || isAdmin,
  };
}

export async function getPermissionsForUser(board, userId) {
  const teamRole =
    Number(board.owner_id) === Number(userId) ? null : await getTeamRole(userId, board.id);
  return buildBoardPermissions(board, userId, teamRole);
}

export async function requireCanInvite(board, userId) {
  const permissions = await getPermissionsForUser(board, userId);
  if (!permissions.canInvite) {
    const err = new Error('Only the workspace owner or an admin can invite teammates');
    err.status = 403;
    throw err;
  }
  return permissions;
}

export async function requireOwner(board, userId, message = 'Only the workspace owner can do that') {
  if (Number(board.owner_id) !== Number(userId)) {
    const err = new Error(message);
    err.status = 403;
    throw err;
  }
}

export async function requireCanCancelInvites(board, userId) {
  const permissions = await getPermissionsForUser(board, userId);
  if (!permissions.canCancelInvites) {
    const err = new Error('Only the workspace owner or an admin can cancel invites');
    err.status = 403;
    throw err;
  }
  return permissions;
}

const RESTRICTED_TASK_STATUSES = new Set(['in_progress', 'done']);

export { isRestrictedListTitle } from './taskListSync.js';

/** Owner/admin only may set In progress or Done. */
export function assertCanSetTaskStatus(permissions, status) {
  if (!RESTRICTED_TASK_STATUSES.has(status)) return;
  if (!permissions?.canManageTaskStatus) {
    const err = new Error(
      'Only the workspace owner or an admin can mark tasks In progress or Done'
    );
    err.status = 403;
    throw err;
  }
}
