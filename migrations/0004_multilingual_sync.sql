CREATE TABLE IF NOT EXISTS attempts_by_language (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  language TEXT NOT NULL,
  question_id TEXT NOT NULL,
  status TEXT NOT NULL,
  level TEXT,
  category TEXT,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS attempts_by_language_user_question
  ON attempts_by_language(user_email, language, question_id, answered_at);

CREATE TABLE IF NOT EXISTS vocab_stats_by_language (
  user_email TEXT NOT NULL,
  language TEXT NOT NULL,
  lemma TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_email, language, lemma)
);

CREATE TABLE IF NOT EXISTS bookmarks_by_language (
  user_email TEXT NOT NULL,
  language TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_email, language, question_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_email TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO attempts_by_language
  (id, user_email, language, question_id, status, level, category, answered_at)
  SELECT id, user_email, 'la', question_id, status, level, category, answered_at FROM attempts;

INSERT OR IGNORE INTO vocab_stats_by_language
  (user_email, language, lemma, seen, correct, updated_at)
  SELECT user_email, 'la', lemma, seen, correct, updated_at FROM vocab_stats;

INSERT OR IGNORE INTO bookmarks_by_language
  (user_email, language, question_id, created_at)
  SELECT user_email, 'la', question_id, created_at FROM bookmarks;

INSERT OR IGNORE INTO app_migrations (version) VALUES ('multilingual-sync-v1');
