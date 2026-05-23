-- Private 1:1 direct messages between any TaskFlow users
CREATE TABLE dm_conversations (
  id SERIAL PRIMARY KEY,
  user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE dm_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_conversations_user_a ON dm_conversations (user_a_id);
CREATE INDEX idx_dm_conversations_user_b ON dm_conversations (user_b_id);
CREATE INDEX idx_dm_conversations_updated ON dm_conversations (updated_at DESC);
CREATE INDEX idx_dm_messages_conversation_created ON dm_messages (conversation_id, created_at ASC);
