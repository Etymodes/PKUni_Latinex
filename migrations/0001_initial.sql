CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  question_id TEXT NOT NULL,
  status TEXT NOT NULL,
  level TEXT,
  category TEXT,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS attempts_user_question
  ON attempts(user_email, question_id, answered_at);

CREATE TABLE IF NOT EXISTS vocab_stats (
  user_email TEXT NOT NULL,
  lemma TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_email, lemma)
);

CREATE TABLE IF NOT EXISTS question_overrides (
  id TEXT PRIMARY KEY,
  payload TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
