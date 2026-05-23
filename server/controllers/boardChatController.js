import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import { getBoardIfMember } from '../utils/boardAccess.js';
import { emitToBoard } from '../sockets/boardSocket.js';
import {
  getBoardMeta,
  notifyBoardMembers,
  truncateSnippet,
} from '../utils/notifyHelpers.js';

export const boardChatBoardId = [param('boardId').isInt()];

export const sendMessageValidators = [
  ...boardChatBoardId,
  body('body').trim().isLength({ min: 1, max: 4000 }),
];

const MESSAGE_SELECT = `
  SELECT m.id, m.board_id, m.user_id, m.body, m.created_at,
         u.name AS author_name,
         u.username AS author_username,
         u.avatar_url AS author_avatar_url
  FROM board_messages m
  JOIN users u ON u.id = m.user_id
`;

function mapMessage(row) {
  return {
    id: row.id,
    board_id: row.board_id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      name: row.author_name,
      username: row.author_username,
      avatar_url: row.author_avatar_url,
    },
  };
}

export async function listMessages(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const boardId = Number(req.params.boardId);
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Workspace not found' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const { rows } = await pool.query(
      `${MESSAGE_SELECT}
       WHERE m.board_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [boardId, limit]
    );
    res.json({ messages: rows.map(mapMessage) });
  } catch (e) {
    next(e);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const boardId = Number(req.params.boardId);
    const { body: text } = req.body;
    const board = await getBoardIfMember(req.user.id, boardId);
    if (!board) return res.status(404).json({ error: 'Workspace not found' });

    const { rows } = await pool.query(
      `INSERT INTO board_messages (board_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, board_id, user_id, body, created_at`,
      [boardId, req.user.id, text]
    );
    const inserted = rows[0];
    const { rows: authorRows } = await pool.query(
      `SELECT name, username, avatar_url FROM users WHERE id = $1`,
      [req.user.id]
    );
    const author = authorRows[0];
    const message = mapMessage({
      ...inserted,
      author_name: author.name,
      author_username: author.username,
      author_avatar_url: author.avatar_url,
    });

    const io = req.app.get('io');
    if (io) emitToBoard(io, boardId, 'chatMessage', { message, boardId });

    const boardMeta = await getBoardMeta(boardId);
    const workspace = boardMeta?.title || 'a workspace';
    await notifyBoardMembers(io, boardId, {
      excludeUserId: req.user.id,
      message: `${author.name} posted in team chat on "${workspace}": "${truncateSnippet(text)}"`,
      type: 'workspace_chat',
      boardId,
    });

    res.status(201).json({ message });
  } catch (e) {
    next(e);
  }
}
