import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/database.js';
import { orderedPair, otherParticipantId } from '../utils/dmHelpers.js';
import { emitToUser } from '../sockets/boardSocket.js';
import { notifyUser } from '../services/notificationService.js';
import { getUserName, truncateSnippet } from '../utils/notifyHelpers.js';

export const conversationIdParam = [param('conversationId').isInt()];

export const openConversationValidators = [body('userId').isInt()];

export const sendDmValidators = [
  ...conversationIdParam,
  body('body').trim().isLength({ min: 1, max: 4000 }),
];

const MESSAGE_SELECT = `
  SELECT m.id, m.conversation_id, m.user_id, m.body, m.created_at,
         u.name AS author_name,
         u.username AS author_username,
         u.avatar_url AS author_avatar_url
  FROM dm_messages m
  JOIN users u ON u.id = m.user_id
`;

function mapMessage(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
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

function mapOtherUser(row) {
  return {
    id: row.other_user_id,
    name: row.other_name,
    username: row.other_username,
    avatar_url: row.other_avatar_url,
  };
}

async function getConversationForUser(userId, conversationId) {
  const { rows } = await pool.query(
    `SELECT * FROM dm_conversations
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [conversationId, userId]
  );
  return rows[0] || null;
}

async function loadOtherUser(otherUserId) {
  const { rows } = await pool.query(
    `SELECT id, name, username, avatar_url FROM users WHERE id = $1`,
    [otherUserId]
  );
  return rows[0] || null;
}

export async function listConversations(req, res, next) {
  try {
    const uid = req.user.id;
    const { rows } = await pool.query(
      `SELECT c.id, c.updated_at,
              CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
              u.name AS other_name,
              u.username AS other_username,
              u.avatar_url AS other_avatar_url,
              lm.body AS last_message_body,
              lm.created_at AS last_message_at,
              lm.user_id AS last_message_user_id
       FROM dm_conversations c
       JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
       LEFT JOIN LATERAL (
         SELECT body, created_at, user_id
         FROM dm_messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE c.user_a_id = $1 OR c.user_b_id = $1
       ORDER BY COALESCE(lm.created_at, c.updated_at) DESC`,
      [uid]
    );
    res.json({
      conversations: rows.map((row) => ({
        id: row.id,
        updated_at: row.updated_at,
        other_user: mapOtherUser(row),
        last_message: row.last_message_body
          ? {
              body: row.last_message_body,
              created_at: row.last_message_at,
              user_id: row.last_message_user_id,
            }
          : null,
      })),
    });
  } catch (e) {
    next(e);
  }
}

export async function openConversation(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.user.id;
    const otherId = Number(req.body.userId);
    if (otherId === uid) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }
    const otherUser = await loadOtherUser(otherId);
    if (!otherUser) return res.status(404).json({ error: 'User not found' });

    const [a, b] = orderedPair(uid, otherId);
    let conversation;
    const { rows: existing } = await pool.query(
      `SELECT * FROM dm_conversations WHERE user_a_id = $1 AND user_b_id = $2`,
      [a, b]
    );
    if (existing.length) {
      conversation = existing[0];
    } else {
      const { rows: created } = await pool.query(
        `INSERT INTO dm_conversations (user_a_id, user_b_id) VALUES ($1, $2) RETURNING *`,
        [a, b]
      );
      conversation = created[0];
    }

    res.json({
      conversation: {
        id: conversation.id,
        other_user: otherUser,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function listMessages(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.user.id;
    const conversationId = Number(req.params.conversationId);
    const conversation = await getConversationForUser(uid, conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const { rows } = await pool.query(
      `${MESSAGE_SELECT}
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    const otherUserId = otherParticipantId(conversation, uid);
    const otherUser = await loadOtherUser(otherUserId);

    res.json({
      conversation: { id: conversation.id, other_user: otherUser },
      messages: rows.map(mapMessage),
    });
  } catch (e) {
    next(e);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.user.id;
    const conversationId = Number(req.params.conversationId);
    const { body: text } = req.body;
    const conversation = await getConversationForUser(uid, conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { rows } = await pool.query(
      `INSERT INTO dm_messages (conversation_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, conversation_id, user_id, body, created_at`,
      [conversationId, uid, text]
    );
    await pool.query(`UPDATE dm_conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);

    const inserted = rows[0];
    const { rows: authorRows } = await pool.query(
      `SELECT name, username, avatar_url FROM users WHERE id = $1`,
      [uid]
    );
    const author = authorRows[0];
    const message = mapMessage({
      ...inserted,
      author_name: author.name,
      author_username: author.username,
      author_avatar_url: author.avatar_url,
    });

    const otherUserId = otherParticipantId(conversation, uid);
    const otherUser = await loadOtherUser(otherUserId);
    const payload = {
      message,
      conversationId,
      other_user: otherUser,
    };

    const io = req.app.get('io');
    if (io) {
      emitToUser(io, uid, 'dmMessage', payload);
      emitToUser(io, otherUserId, 'dmMessage', payload);
    }

    if (otherUserId !== uid) {
      const authorName = await getUserName(uid);
      await notifyUser(io, {
        userId: otherUserId,
        message: `${authorName} sent you a message: "${truncateSnippet(text)}"`,
        type: 'dm_message',
        conversationId,
      });
    }

    res.status(201).json({ message, conversation: { id: conversationId, other_user: otherUser } });
  } catch (e) {
    next(e);
  }
}
