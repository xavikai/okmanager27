CREATE TABLE IF NOT EXISTS game_creator_users (
  user_id TEXT PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS game_presence (
  visitor_hash TEXT PRIMARY KEY,
  user_id TEXT REFERENCES game_users(id) ON DELETE CASCADE,
  seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS game_presence_seen ON game_presence(seen_at);
