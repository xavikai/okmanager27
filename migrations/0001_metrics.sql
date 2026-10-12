CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  detection TEXT NOT NULL CHECK (detection IN ('confirmed-install','standalone-first-open')),
  source_host TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
