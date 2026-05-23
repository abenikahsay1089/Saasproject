import { param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import { normalizeEmail } from '../utils/boardInvites.js';
import { logActivity } from '../utils/activity.js';
import { notifyUser } from '../services/notificationService.js';
import { getUserName, notifyWorkspaceStakeholders } from '../utils/notifyHelpers.js';

async function getInviteForUser(inviteId, userId, email) {
  const { rows } = await pool.query(
    `SELECT i.*, b.title AS board_title
     FROM board_invites i
     JOIN boards b ON b.id = i.board_id
     WHERE i.id = $1 AND i.status = 'pending'
       AND (i.user_id = $2 OR LOWER(i.email) = $3)`,
    [inviteId, userId, normalizeEmail(email)]
  );
  return rows[0] || null;
}

export const inviteIdParam = [param('id').isInt()];

export async function listPendingInvites(req, res, next) {
  try {
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    if (!me[0]) return res.json({ invites: [] });
    const emailNorm = normalizeEmail(me[0].email);
    const { rows } = await pool.query(
      `SELECT i.id, i.board_id, i.role, i.created_at, b.title AS board_title,
              inv.name AS inviter_name
       FROM board_invites i
       JOIN boards b ON b.id = i.board_id
       LEFT JOIN users inv ON inv.id = i.invited_by
       WHERE i.status = 'pending'
         AND (i.user_id = $1 OR LOWER(i.email) = $2)
       ORDER BY i.created_at DESC`,
      [req.user.id, emailNorm]
    );
    res.json({ invites: rows });
  } catch (e) {
    if (e.code === '42P01') return res.json({ invites: [] });
    if (e.code === '42703') {
      return res.status(503).json({
        error: 'Invite schema outdated. Run database/migrations/003_invite_accept_flow.sql',
      });
    }
    next(e);
  }
}

export async function acceptInvite(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const inviteId = Number(req.params.id);
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    const invite = await getInviteForUser(inviteId, req.user.id, me[0]?.email);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already handled' });
    }

    await pool.query(
      `INSERT INTO teams (board_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'member'`,
      [invite.board_id, req.user.id]
    );
    await pool.query(
      `UPDATE board_invites SET status = 'accepted', user_id = $1 WHERE id = $2`,
      [req.user.id, inviteId]
    );
    await pool.query(
      `UPDATE notifications SET read_status = TRUE WHERE board_invite_id = $1 AND user_id = $2`,
      [inviteId, req.user.id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'invite_accepted',
      entityType: 'board',
      entityId: invite.board_id,
      boardId: invite.board_id,
      details: { boardTitle: invite.board_title },
    });

    const io = req.app.get('io');
    const accepterName = await getUserName(req.user.id);

    await notifyUser(io, {
      userId: req.user.id,
      message: `You joined "${invite.board_title}". Open it from Workspaces.`,
      type: 'invite_accepted',
      boardId: invite.board_id,
    });

    await notifyWorkspaceStakeholders(io, {
      boardId: invite.board_id,
      invitedBy: invite.invited_by,
      excludeUserId: req.user.id,
      message: `${accepterName} accepted the invite and joined "${invite.board_title}".`,
      type: 'invite_accepted',
    });

    res.json({
      ok: true,
      message: `You joined "${invite.board_title}".`,
      boardId: invite.board_id,
    });
  } catch (e) {
    next(e);
  }
}

export async function declineInvite(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const inviteId = Number(req.params.id);
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    const invite = await getInviteForUser(inviteId, req.user.id, me[0]?.email);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already handled' });
    }

    await pool.query(`UPDATE board_invites SET status = 'declined', user_id = $1 WHERE id = $2`, [
      req.user.id,
      inviteId,
    ]);
    await pool.query(
      `UPDATE notifications SET read_status = TRUE WHERE board_invite_id = $1 AND user_id = $2`,
      [inviteId, req.user.id]
    );

    const io = req.app.get('io');
    const declinerName = await getUserName(req.user.id);

    await notifyUser(io, {
      userId: req.user.id,
      message: `You declined the invite to "${invite.board_title}".`,
      type: 'invite_declined',
      boardId: invite.board_id,
    });

    await notifyWorkspaceStakeholders(io, {
      boardId: invite.board_id,
      invitedBy: invite.invited_by,
      excludeUserId: req.user.id,
      message: `${declinerName} declined the invite to "${invite.board_title}".`,
      type: 'invite_declined',
    });

    res.json({ ok: true, message: 'Invite declined.' });
  } catch (e) {
    next(e);
  }
}
