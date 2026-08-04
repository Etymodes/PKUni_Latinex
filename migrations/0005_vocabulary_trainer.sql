ALTER TABLE user_preferences
  ADD COLUMN vocab_mode TEXT NOT NULL DEFAULT 'context';

INSERT OR IGNORE INTO app_migrations (version) VALUES ('vocabulary-trainer-v1');
