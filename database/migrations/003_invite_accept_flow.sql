-- Invites require acceptance before joining a board

ALTER TABLE board_invites
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS board_invite_id INTEGER REFERENCES board_invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_board_invites_user_pending
  ON board_invites (user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_board_invite ON notifications (board_invite_id);
