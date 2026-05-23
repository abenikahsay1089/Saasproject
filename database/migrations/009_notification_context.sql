-- Optional deep-link context on inbox items
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS board_id INTEGER REFERENCES boards(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES dm_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_board ON notifications (board_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON notifications (task_id);
