CREATE TABLE IF NOT EXISTS game_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS game_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS game_sessions_expiry ON game_sessions(expires_at);
CREATE TABLE IF NOT EXISTS game_saves (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  data TEXT NOT NULL,
  compressed INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  version TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, slot)
);
