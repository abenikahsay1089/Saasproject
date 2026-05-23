import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getBoardIfMember } from '../utils/boardAccess.js';

/**
 * Socket.io setup:
 * - JWT in handshake `auth.token` identifies the user.
 * - Clients join `user:<id>` for personal notifications.
 * - Clients emit `joinBoard` / `leaveBoard` with boardId to subscribe to board channels.
 *
 * Server broadcasts (from HTTP layer via io.to(`board:${id}`)):
 * - taskCreated, taskUpdated, taskMoved, taskAssigned, activityAdded, chatMessage, dmMessage
 */
export function registerBoardSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.userId = Number(payload.sub);
      socket.userEmail = payload.email;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    socket.join(`user:${uid}`);

    socket.on('joinBoard', async (boardId, cb) => {
      try {
        const id = Number(boardId);
        if (!id) {
          cb?.({ ok: false, error: 'Invalid board' });
          return;
        }
        const board = await getBoardIfMember(uid, id);
        if (!board) {
          cb?.({ ok: false, error: 'Forbidden' });
          return;
        }
        socket.join(`board:${id}`);
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on('leaveBoard', (boardId) => {
      const id = Number(boardId);
      if (id) socket.leave(`board:${id}`);
    });
  });
}

/**
 * @param {import('socket.io').Server} io
 * @param {number} boardId
 * @param {string} event
 * @param {unknown} payload
 */
export function emitToBoard(io, boardId, event, payload) {
  io.to(`board:${boardId}`).emit(event, payload);
}

/**
 * @param {import('socket.io').Server} io
 * @param {number} userId
 * @param {string} event
 * @param {unknown} payload
 */
export function emitToUser(io, userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}
