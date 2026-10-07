-- One current community avatar per verified account; messages retain canonical author IDs.
CREATE TABLE IF NOT EXISTS community_profiles (
    user_id TEXT PRIMARY KEY, avatar_kind TEXT NOT NULL CHECK(avatar_kind IN ('initials','preset')),
    avatar_value TEXT NOT NULL CHECK(length(avatar_value) BETWEEN 1 AND 32), updated_at INTEGER NOT NULL
  );
