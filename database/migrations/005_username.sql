-- Unique @username for display and mentions

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

UPDATE users
SET username = 'user' || id::text
WHERE username IS NULL OR TRIM(username) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;
