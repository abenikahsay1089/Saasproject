import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import {
  assertBoardWritable,
  getBoardIfMember,
  handleBoardAccessError,
  isBoardFrozen,
} from '../utils/boardAccess.js';
import { logActivity } from '../utils/activity.js';
import { emitToBoard } from '../sockets/boardSocket.js';
import { notifyUser } from '../services/notificationService.js';
import { normalizeEmail } from '../utils/boardInvites.js';
import { getUserName } from '../utils/notifyHelpers.js';
import {
  getPermissionsForUser,
  requireCanCancelInvites,
  requireCanInvite,
  requireOwner,
} from '../utils/boardRoles.js';
import { loadBoardMembers } from '../utils/boardMembers.js';

export const createBoardValidators = [body('title').trim().isLength({ min: 1, max: 255 })];
export const boardIdParam = [param('id').isInt()];

export async function listBoards(req, res, next) {
  try {
    const uid = req.user.id;
    const { rows } = await pool.query(
      `SELECT DISTINCT b.id, b.title, b.owner_id, b.status, b.created_at
       FROM boards b
       LEFT JOIN teams t ON t.board_id = b.id
       WHERE b.owner_id = $1 OR t.user_id = $1
       ORDER BY b.created_at DESC`,
      [uid]
    );
    res.json({ boards: rows });
  } catch (e) {
    next(e);
  }
}

export async function createBoard(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO boards (title, owner_id) VALUES ($1, $2) RETURNING *`,
        [title, req.user.id]
      );
      const board = rows[0];
      const defaults = ['To Do', 'In Progress', 'Done'];
      for (let i = 0; i < defaults.length; i++) {
        await client.query(
          `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3)`,
          [board.id, defaults[i], i]
        );
      }
      await client.query('COMMIT');
      const io = req.app.get('io');
      const act = await logActivity({
        userId: req.user.id,
        action: 'board_created',
        entityType: 'board',
        entityId: board.id,
        boardId: board.id,
        details: { title: board.title },
      });
      if (io) emitToBoard(io, board.id, 'activityAdded', act);
      res.status(201).json({ board });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
}

export async function getBoard(req, res, next) {
  try {
    const id = Number(req.params.id);
    const board = await getBoardIfMember(req.user.id, id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    res.json({ board });
  } catch (e) {
    next(e);
  }
}

export async function updateBoard(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = Number(req.params.id);
    const board = await getBoardIfMember(req.user.id, id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can update the board' });
    }
    const { title } = req.body;
    const { rows } = await pool.query(
      `UPDATE boards SET title = COALESCE($1, title) WHERE id = $2 RETURNING *`,
      [title ?? board.title, id]
    );
    res.json({ board: rows[0] });
  } catch (e) {
    next(e);
  }
}

export async function deleteBoard(req, res, next) {
  try {
    const id = Number(req.params.id);
    const board = await getBoardIfMember(req.user.id, id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can delete this workspace' });
    }

    const { rows: members } = await pool.query(
      `SELECT user_id FROM teams WHERE board_id = $1`,
      [id]
    );
    const io = req.app.get('io');
    const ownerName = await getUserName(req.user.id);
    for (const m of members) {
      if (m.user_id !== req.user.id) {
        await notifyUser(io, {
          userId: m.user_id,
          message: `${ownerName} deleted the workspace "${board.title}".`,
          type: 'workspace_deleted',
          boardId: id,
        });
      }
    }

    await pool.query(`DELETE FROM boards WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function freezeBoard(req, res, next) {
  try {
    const id = Number(req.params.id);
    const board = await getBoardIfMember(req.user.id, id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can freeze this workspace' });
    }
    if (isBoardFrozen(board)) {
      return res.json({ board, message: 'Workspace is already frozen.' });
    }

    const { rows } = await pool.query(
      `UPDATE boards SET status = 'frozen' WHERE id = $1 RETURNING *`,
      [id]
    );
    const frozen = rows[0];
    const io = req.app.get('io');
    const ownerName = await getUserName(req.user.id);
    const { rows: members } = await pool.query(`SELECT user_id FROM teams WHERE board_id = $1`, [id]);
    for (const m of members) {
      await notifyUser(io, {
        userId: m.user_id,
        message: `${ownerName} froze "${board.title}". The board is read-only until it is unfrozen.`,
        type: 'workspace_frozen',
        boardId: id,
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'board_frozen',
      entityType: 'board',
      entityId: id,
      boardId: id,
      details: { title: board.title },
    });

    res.json({ board: frozen, message: 'Workspace frozen. No one can edit tasks until you unfreeze it.' });
  } catch (e) {
    next(e);
  }
}

export async function unfreezeBoard(req, res, next) {
  try {
    const id = Number(req.params.id);
    const board = await getBoardIfMember(req.user.id, id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (board.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can unfreeze this workspace' });
    }
    if (!isBoardFrozen(board)) {
      return res.json({ board, message: 'Workspace is already active.' });
    }

    const { rows } = await pool.query(
      `UPDATE boards SET status = 'active' WHERE id = $1 RETURNING *`,
      [id]
    );

    const io = req.app.get('io');
    const ownerName = await getUserName(req.user.id);
    const { rows: members } = await pool.query(`SELECT user_id FROM teams WHERE board_id = $1`, [id]);
    for (const m of members) {
      await notifyUser(io, {
        userId: m.user_id,
        message: `${ownerName} unfroze "${board.title}". You can edit tasks again.`,
        type: 'workspace_unfrozen',
        boardId: id,
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'board_unfrozen',
      entityType: 'board',
      entityId: id,
      boardId: id,
      details: { title: board.title },
    });

    res.json({ board: rows[0], message: 'Workspace is active again.' });
  } catch (e) {
    next(e);
  }
}

export async function listActivity(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS user_name
       FROM activity_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.board_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [boardId]
    );
    res.json({ activities: rows });
  } catch (e) {
    next(e);
  }
}

export const inviteMemberValidators = [
  param('boardId').isInt(),
  body('email').optional({ values: 'null' }).isEmail().normalizeEmail(),
  body('userId').optional({ values: 'null' }).isInt(),
];

export const updateMemberRoleValidators = [
  param('boardId').isInt(),
  param('userId').isInt(),
  body('role').isIn(['member', 'admin']),
];


export async function inviteMember(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      await requireCanInvite(board, req.user.id);
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }

    const { email: emailRaw, userId: userIdRaw } = req.body;
    if (!emailRaw && userIdRaw == null) {
      return res.status(400).json({ error: 'Provide an email or select a user to invite' });
    }

    const role = 'member';
    let invited = null;
    let emailNorm = null;

    if (userIdRaw != null) {
      const targetId = Number(userIdRaw);
      const { rows } = await pool.query(
        `SELECT id, name, email FROM users WHERE id = $1`,
        [targetId]
      );
      invited = rows[0];
      if (!invited) return res.status(404).json({ error: 'User not found' });
      emailNorm = normalizeEmail(invited.email);
    } else {
      emailNorm = normalizeEmail(emailRaw);
      const { rows: users } = await pool.query(
        `SELECT id, name, email FROM users WHERE LOWER(email) = $1`,
        [emailNorm]
      );
      invited = users[0];
    }

    if (invited?.id === board.owner_id) {
      return res.status(400).json({ error: 'That person already owns this workspace' });
    }

    if (invited) {
      const { rows: already } = await pool.query(
        `SELECT 1 FROM teams WHERE board_id = $1 AND user_id = $2`,
        [boardId, invited.id]
      );
      if (already.length > 0) {
        return res.status(400).json({ error: 'That person is already on this workspace' });
      }
    }

    let inviteRow;
    try {
      const inserted = await pool.query(
        `INSERT INTO board_invites (board_id, email, role, invited_by, user_id, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (board_id, email) DO UPDATE SET
           role = EXCLUDED.role,
           invited_by = EXCLUDED.invited_by,
           user_id = COALESCE(EXCLUDED.user_id, board_invites.user_id),
           status = CASE
             WHEN board_invites.status = 'accepted' THEN
               CASE
                 WHEN EXISTS (
                   SELECT 1 FROM teams t
                   WHERE t.board_id = board_invites.board_id
                     AND t.user_id = COALESCE(EXCLUDED.user_id, board_invites.user_id)
                 ) THEN 'accepted'
                 ELSE 'pending'
               END
             WHEN board_invites.status = 'declined' THEN 'pending'
             ELSE 'pending'
           END
         RETURNING id, status`,
        [boardId, emailNorm, role, req.user.id, invited?.id ?? null]
      );
      inviteRow = inserted.rows[0];
      if (inviteRow.status === 'accepted') {
        const { rows: onTeam } = await pool.query(
          `SELECT 1 FROM teams WHERE board_id = $1 AND user_id = $2`,
          [boardId, invited?.id]
        );
        if (onTeam.length > 0) {
          return res.status(400).json({ error: 'That person is already on this workspace' });
        }
      }
    } catch (e) {
      if (e.code === '42P01' || e.code === '42703') {
        return res.status(503).json({
          error:
            'Invite database is not up to date. From the project folder run: npm run migrate --prefix server',
        });
      }
      throw e;
    }

    const io = req.app.get('io');
    if (invited) {
      try {
        await notifyUser(io, {
          userId: invited.id,
          message: `You were invited to "${board.title}". Accept the invite on your Workspaces page or in Inbox.`,
          type: 'board_invite',
          boardInviteId: inviteRow.id,
          boardId,
        });
      } catch (notifyErr) {
        console.error('Failed to create invite notification:', notifyErr.message);
      }
    }

    const act = await logActivity({
      userId: req.user.id,
      action: 'member_invited',
      entityType: 'board',
      entityId: boardId,
      boardId,
      details: { email: emailNorm, role, pending: true },
    });
    if (io) emitToBoard(io, boardId, 'activityAdded', act);

    res.status(201).json({
      ok: true,
      pending: true,
      message: invited
        ? `Invite sent. ${invited.name || invited.email} must accept from their Inbox.`
        : `Invite saved for ${emailNorm}. They will see it when they register.`,
      email: emailNorm,
    });
  } catch (e) {
    next(e);
  }
}

export async function listMembers(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const rows = await loadBoardMembers(boardId);
    const permissions = await getPermissionsForUser(board, req.user.id);
    let pendingOwnershipTransfer = null;
    if (permissions.isOwner) {
      try {
        const { rows: xfer } = await pool.query(
          `SELECT t.id, t.email, t.created_at, u.name AS to_name
           FROM ownership_transfers t
           LEFT JOIN users u ON u.id = t.to_user_id
           WHERE t.board_id = $1 AND t.status = 'pending'`,
          [boardId]
        );
        pendingOwnershipTransfer = xfer[0] || null;
      } catch (e) {
        if (e.code !== '42P01') throw e;
      }
    }
    let pendingInvites = [];
    if (permissions.canCancelInvites) {
      try {
        const pending = await pool.query(
          `SELECT id, email, user_id, role, created_at FROM board_invites
           WHERE board_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
          [boardId]
        );
        pendingInvites = pending.rows;
      } catch (e) {
        if (e.code !== '42P01') throw e;
      }
    }
    res.json({
      members: rows,
      pendingInvites,
      pendingOwnershipTransfer,
      ownerId: board.owner_id,
      permissions,
      isOwner: permissions.isOwner,
    });
  } catch (e) {
    next(e);
  }
}

export async function removeMember(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const memberId = Number(req.params.userId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
      await requireOwner(board, req.user.id, 'Only the owner can remove members');
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }
    if (memberId === board.owner_id) {
      return res.status(400).json({ error: 'Cannot remove the workspace owner' });
    }
    if (memberId === req.user.id) {
      return res.status(400).json({ error: 'Use another account to remove yourself, or delete the workspace' });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM teams WHERE board_id = $1 AND user_id = $2`,
      [boardId, memberId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Member not found on this workspace' });
    }

    await pool.query(
      `UPDATE tasks SET assigned_to = NULL
       WHERE assigned_to = $1
         AND list_id IN (SELECT id FROM lists WHERE board_id = $2)`,
      [memberId, boardId]
    );

    const io = req.app.get('io');
    await notifyUser(io, {
      userId: memberId,
      message: `You were removed from workspace "${board.title}"`,
      type: 'board_removed',
      boardId,
    });

    const act = await logActivity({
      userId: req.user.id,
      action: 'member_removed',
      entityType: 'board',
      entityId: boardId,
      boardId,
      details: { removedUserId: memberId },
    });
    if (io) emitToBoard(io, boardId, 'activityAdded', act);

    res.json({ ok: true, message: 'Member removed from workspace' });
  } catch (e) {
    next(e);
  }
}

export async function cancelPendingInvite(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const inviteId = Number(req.params.inviteId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      await requireCanCancelInvites(board, req.user.id);
      assertBoardWritable(board);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }

    const { rows: pending } = await pool.query(
      `SELECT id, email, user_id FROM board_invites
       WHERE id = $1 AND board_id = $2 AND status = 'pending'`,
      [inviteId, boardId]
    );
    if (!pending[0]) {
      return res.status(404).json({ error: 'Pending invite not found' });
    }

    await pool.query(`DELETE FROM board_invites WHERE id = $1`, [inviteId]);

    const io = req.app.get('io');
    const actorName = await getUserName(req.user.id);
    if (pending[0].user_id) {
      await notifyUser(io, {
        userId: pending[0].user_id,
        message: `${actorName} cancelled your invite to "${board.title}".`,
        type: 'invite_cancelled',
        boardId,
      });
      try {
        await pool.query(
          `UPDATE notifications SET read_status = TRUE
           WHERE user_id = $1 AND type = 'board_invite' AND board_invite_id = $2`,
          [pending[0].user_id, inviteId]
        );
      } catch {
        /* board_invite_id column may be missing on older DBs */
      }
    }

    res.json({ ok: true, message: 'Invite cancelled' });
  } catch (e) {
    next(e);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const boardId = Number(req.params.boardId);
    const memberId = Number(req.params.userId);
    const { role } = req.body;
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
      await requireOwner(board, req.user.id, 'Only the workspace owner can change admin roles');
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }
    if (memberId === board.owner_id) {
      return res.status(400).json({ error: 'Cannot change the owner role here. Transfer ownership instead.' });
    }

    const { rows } = await pool.query(
      `UPDATE teams SET role = $1
       WHERE board_id = $2 AND user_id = $3
       RETURNING user_id, role`,
      [role, boardId, memberId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Member not found on this workspace' });
    }

    const io = req.app.get('io');
    const ownerName = await getUserName(req.user.id);
    const label = role === 'admin' ? 'an admin' : 'a member';
    await notifyUser(io, {
      userId: memberId,
      message: `${ownerName} made you ${label} on "${board.title}".`,
      type: 'role_changed',
      boardId,
    });

    const act = await logActivity({
      userId: req.user.id,
      action: role === 'admin' ? 'member_promoted' : 'member_demoted',
      entityType: 'board',
      entityId: boardId,
      boardId,
      details: { memberId, role },
    });
    if (io) emitToBoard(io, boardId, 'activityAdded', act);

    res.json({ ok: true, message: `Role updated to ${role}.`, role });
  } catch (e) {
    next(e);
  }
}

