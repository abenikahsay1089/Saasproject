import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import {
  assertBoardWritable,
  getBoardIfMember,
  handleBoardAccessError,
} from '../utils/boardAccess.js';
import { normalizeEmail } from '../utils/boardInvites.js';
import { requireOwner } from '../utils/boardRoles.js';
import { notifyUser } from '../services/notificationService.js';
import { getUserName } from '../utils/notifyHelpers.js';
import { executeOwnershipTransfer } from '../utils/executeOwnershipTransfer.js';
import { logActivity } from '../utils/activity.js';
import { emitToBoard } from '../sockets/boardSocket.js';

export const requestTransferValidators = [
  param('boardId').isInt(),
  body('email').isEmail().normalizeEmail(),
];

export const transferIdParam = [param('id').isInt()];

async function getPendingTransferForUser(transferId, userId, email) {
  const { rows } = await pool.query(
    `SELECT t.*, b.title AS board_title, u.name AS from_name
     FROM ownership_transfers t
     JOIN boards b ON b.id = t.board_id
     JOIN users u ON u.id = t.from_user_id
     WHERE t.id = $1 AND t.status = 'pending'
       AND (t.to_user_id = $2 OR LOWER(t.email) = $3)
       AND b.owner_id = t.from_user_id`,
    [transferId, userId, normalizeEmail(email)]
  );
  return rows[0] || null;
}

export async function requestOwnershipTransfer(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
      await requireOwner(board, req.user.id, 'Only the workspace owner can transfer ownership');
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }

    const emailNorm = normalizeEmail(req.body.email);
    const { rows: users } = await pool.query(
      `SELECT id, name, email FROM users WHERE LOWER(email) = $1`,
      [emailNorm]
    );
    const target = users[0];
    if (!target) {
      return res.status(404).json({
        error: 'No account found with that email. They must register and join this workspace first.',
      });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot transfer ownership to yourself' });
    }

    const { rows: onTeam } = await pool.query(
      `SELECT 1 FROM teams WHERE board_id = $1 AND user_id = $2`,
      [boardId, target.id]
    );
    if (!onTeam.length) {
      return res.status(400).json({
        error: 'That person must already be a member of this workspace before becoming owner.',
      });
    }

    const { rows: existing } = await pool.query(
      `SELECT id, to_user_id FROM ownership_transfers WHERE board_id = $1 AND status = 'pending'`,
      [boardId]
    );
    if (existing[0]) {
      return res.status(409).json({
        error: 'An ownership transfer is already pending for this workspace. Cancel it first to send a new one.',
        transferId: existing[0].id,
      });
    }

    let transferRow;
    try {
      const inserted = await pool.query(
        `INSERT INTO ownership_transfers (board_id, from_user_id, to_user_id, email, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
        [boardId, req.user.id, target.id, emailNorm]
      );
      transferRow = inserted.rows[0];
    } catch (e) {
      if (e.code === '42P01') {
        return res.status(503).json({
          error: 'Ownership transfer is not available. Run: npm run migrate --prefix server',
        });
      }
      if (e.code === '23505') {
        return res.status(409).json({ error: 'An ownership transfer is already pending for this workspace.' });
      }
      throw e;
    }

    const io = req.app.get('io');
    const ownerName = await getUserName(req.user.id);
    await notifyUser(io, {
      userId: target.id,
      message: `${ownerName} wants to transfer ownership of "${board.title}" to you. Accept or decline in your Inbox.`,
      type: 'ownership_transfer',
      ownershipTransferId: transferRow.id,
    });

    const act = await logActivity({
      userId: req.user.id,
      action: 'ownership_transfer_requested',
      entityType: 'board',
      entityId: boardId,
      boardId,
      details: { toUserId: target.id, email: emailNorm },
    });
    if (io) emitToBoard(io, boardId, 'activityAdded', act);

    res.status(201).json({
      ok: true,
      message: `Ownership transfer request sent to ${target.name || target.email}. They must accept from their Inbox.`,
      transferId: transferRow.id,
    });
  } catch (e) {
    next(e);
  }
}

export async function cancelOwnershipTransfer(req, res, next) {
  try {
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    try {
      assertBoardWritable(board);
      await requireOwner(board, req.user.id);
    } catch (e) {
      const handled = handleBoardAccessError(res, e);
      if (handled) return handled;
      return res.status(e.status || 403).json({ error: e.message });
    }

    const { rows } = await pool.query(
      `DELETE FROM ownership_transfers
       WHERE board_id = $1 AND status = 'pending' AND from_user_id = $2
       RETURNING id, to_user_id`,
      [boardId, req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'No pending ownership transfer for this workspace' });
    }

    const io = req.app.get('io');
    if (rows[0].to_user_id) {
      await notifyUser(io, {
        userId: rows[0].to_user_id,
        message: `The ownership transfer for "${board.title}" was cancelled.`,
        type: 'ownership_transfer',
      });
    }

    res.json({ ok: true, message: 'Ownership transfer request cancelled.' });
  } catch (e) {
    next(e);
  }
}

export async function listPendingOwnershipTransfers(req, res, next) {
  try {
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    if (!me[0]) return res.json({ transfers: [] });
    const emailNorm = normalizeEmail(me[0].email);
    const { rows } = await pool.query(
      `SELECT t.id, t.board_id, t.created_at, b.title AS board_title,
              u.name AS from_name
       FROM ownership_transfers t
       JOIN boards b ON b.id = t.board_id
       JOIN users u ON u.id = t.from_user_id
       WHERE t.status = 'pending'
         AND (t.to_user_id = $1 OR LOWER(t.email) = $2)
       ORDER BY t.created_at DESC`,
      [req.user.id, emailNorm]
    );
    res.json({ transfers: rows });
  } catch (e) {
    if (e.code === '42P01') return res.json({ transfers: [] });
    next(e);
  }
}

export async function acceptOwnershipTransfer(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const transferId = Number(req.params.id);
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    const transfer = await getPendingTransferForUser(transferId, req.user.id, me[0]?.email);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found or already handled' });
    }

    const { rows: boardCheck } = await pool.query(
      `SELECT owner_id, title FROM boards WHERE id = $1`,
      [transfer.board_id]
    );
    const board = boardCheck[0];
    if (!board || board.owner_id !== transfer.from_user_id) {
      return res.status(409).json({ error: 'This transfer is no longer valid' });
    }

    const { rows: onTeam } = await pool.query(
      `SELECT 1 FROM teams WHERE board_id = $1 AND user_id = $2`,
      [transfer.board_id, req.user.id]
    );
    if (!onTeam.length) {
      return res.status(400).json({ error: 'You must be a workspace member to become owner' });
    }

    await executeOwnershipTransfer(transfer.board_id, transfer.from_user_id, req.user.id);

    await pool.query(
      `UPDATE ownership_transfers SET status = 'accepted', to_user_id = $1 WHERE id = $2`,
      [req.user.id, transferId]
    );
    try {
      await pool.query(
        `UPDATE notifications SET read_status = TRUE
         WHERE ownership_transfer_id = $1 AND user_id = $2`,
        [transferId, req.user.id]
      );
    } catch {
      /* column may be missing */
    }

    const io = req.app.get('io');
    const newOwnerName = await getUserName(req.user.id);
    await notifyUser(io, {
      userId: req.user.id,
      message: `You are now the owner of "${transfer.board_title}".`,
      type: 'ownership_transferred',
    });
    await notifyUser(io, {
      userId: transfer.from_user_id,
      message: `${newOwnerName} accepted ownership of "${transfer.board_title}". You are now an admin.`,
      type: 'ownership_transferred',
    });

    const act = await logActivity({
      userId: req.user.id,
      action: 'ownership_transferred',
      entityType: 'board',
      entityId: transfer.board_id,
      boardId: transfer.board_id,
      details: { fromUserId: transfer.from_user_id, toUserId: req.user.id },
    });
    if (io) emitToBoard(io, transfer.board_id, 'activityAdded', act);

    res.json({
      ok: true,
      message: `You are now the owner of "${transfer.board_title}".`,
      boardId: transfer.board_id,
      ownerId: req.user.id,
    });
  } catch (e) {
    next(e);
  }
}

export async function declineOwnershipTransfer(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const transferId = Number(req.params.id);
    const { rows: me } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    const transfer = await getPendingTransferForUser(transferId, req.user.id, me[0]?.email);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found or already handled' });
    }

    await pool.query(`UPDATE ownership_transfers SET status = 'declined' WHERE id = $1`, [transferId]);
    try {
      await pool.query(
        `UPDATE notifications SET read_status = TRUE
         WHERE ownership_transfer_id = $1 AND user_id = $2`,
        [transferId, req.user.id]
      );
    } catch {
      /* ignore */
    }

    const io = req.app.get('io');
    const declinerName = await getUserName(req.user.id);
    await notifyUser(io, {
      userId: transfer.from_user_id,
      message: `${declinerName} declined ownership of "${transfer.board_title}".`,
      type: 'ownership_transfer',
    });

    res.json({ ok: true, message: 'Ownership transfer declined.' });
  } catch (e) {
    next(e);
  }
}
