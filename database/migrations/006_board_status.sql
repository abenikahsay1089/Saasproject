-- Workspace lifecycle: active (default) or frozen (read-only)

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_boards_status ON boards (status);
