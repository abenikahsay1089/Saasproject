-- Pending invites for emails that are not registered yet
CREATE TABLE IF NOT EXISTS board_invites (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (board_id, email)
);

CREATE INDEX IF NOT EXISTS idx_board_invites_email ON board_invites (LOWER(email));
