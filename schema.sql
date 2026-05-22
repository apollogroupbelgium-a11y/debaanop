CREATE TABLE IF NOT EXISTS access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  expires_at INTEGER,
  amount TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_access_token ON access_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_access_tokens_payment_id ON access_tokens(payment_id);
