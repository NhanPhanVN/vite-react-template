CREATE TABLE IF NOT EXISTS messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL CHECK (length(username) BETWEEN 1 AND 40),
	message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
	ON messages (created_at DESC, id DESC);
