-- Run if you already applied schema.sql before profile fields existed:
-- psql -U postgres -d taskmanager -f database/migrations/001_profile_fields.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);
