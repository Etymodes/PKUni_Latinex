-- Public learning community: verified account IDs stay server-side.
CREATE TABLE IF NOT EXISTS community_ai_usage (
    day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0 CHECK(count BETWEEN 0 AND 1000)
  );

CREATE TABLE IF NOT EXISTS community_ai_locks (
    lock_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, token TEXT NOT NULL, expires_at INTEGER NOT NULL
  );

CREATE TABLE IF NOT EXISTS community_state (
    user_id TEXT PRIMARY KEY, warnings INTEGER NOT NULL DEFAULT 0 CHECK(warnings BETWEEN 0 AND 4),
    muted_until INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS community_requests (
    user_id TEXT NOT NULL, client_id TEXT NOT NULL, fingerprint TEXT NOT NULL, message_id TEXT NOT NULL,
    outcome TEXT NOT NULL, warnings INTEGER NOT NULL, muted_until INTEGER NOT NULL,
    applied INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, client_id)
  );

CREATE TABLE IF NOT EXISTS community_messages (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, author_name TEXT NOT NULL,
    language TEXT NOT NULL CHECK(language IN ('la','ja')),
    channel TEXT NOT NULL CHECK(channel IN ('language','study')),
    text TEXT NOT NULL, detected_language TEXT, created_at INTEGER NOT NULL, deleted_at INTEGER
  );

CREATE INDEX IF NOT EXISTS community_room_time ON community_messages(language, channel, created_at, id);

CREATE TABLE IF NOT EXISTS community_limits (
    user_id TEXT NOT NULL, operation TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL,
    PRIMARY KEY(user_id, operation)
  );

CREATE TABLE IF NOT EXISTS community_translations (
    message_id TEXT NOT NULL, locale TEXT NOT NULL CHECK(locale IN ('en','zh-CN')),
    translation TEXT NOT NULL, detected_language TEXT, created_at INTEGER NOT NULL,
    PRIMARY KEY(message_id, locale)
  );

CREATE TABLE IF NOT EXISTS community_reports (
    message_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY(message_id, user_id)
  );
