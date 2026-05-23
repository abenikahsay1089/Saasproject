-- Pending ownership transfers (recipient must accept)

CREATE TABLE IF NOT EXISTS ownership_transfers (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_transfer_board_pending
  ON ownership_transfers (board_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user
  ON ownership_transfers (to_user_id) WHERE status = 'pending';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS ownership_transfer_id INTEGER REFERENCES ownership_transfers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_ownership_transfer
  ON notifications (ownership_transfer_id);
