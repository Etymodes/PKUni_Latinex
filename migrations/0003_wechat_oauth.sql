CREATE TABLE IF NOT EXISTS wechat_oauth_transactions (
  transaction_hash TEXT PRIMARY KEY,
  upstream_state TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wechat_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  profile TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wechat_oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
