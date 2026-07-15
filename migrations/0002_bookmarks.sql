CREATE TABLE IF NOT EXISTS bookmarks (
  user_email TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_email, question_id)
);
