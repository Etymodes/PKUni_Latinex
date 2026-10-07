CREATE TABLE IF NOT EXISTS vocabulary_reviews (
  user_email TEXT NOT NULL,
  event_id TEXT NOT NULL,
  language TEXT NOT NULL,
  answered_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(user_email, event_id)
);

CREATE INDEX IF NOT EXISTS vocabulary_reviews_user_time
  ON vocabulary_reviews(user_email, answered_at, event_id);

CREATE INDEX IF NOT EXISTS vocabulary_reviews_user_language_time
  ON vocabulary_reviews(user_email, language, answered_at, event_id);

CREATE TABLE IF NOT EXISTS vocab_imports (
  user_email TEXT NOT NULL,
  migration_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(user_email, migration_id)
);
