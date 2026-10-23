PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY,
 payload_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','Contacted','Scheduled','Closed')),
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS requests_expiry ON requests(expires_at);
CREATE INDEX IF NOT EXISTS requests_created ON requests(created_at DESC, id);
CREATE TABLE IF NOT EXISTS outbox (
 request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','sent','dead')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 last_error TEXT,
 delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(state,next_at,lease_until);
CREATE TABLE IF NOT EXISTS simulated_deliveries (
 request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
 delivered_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deletion_ledger (
 request_id TEXT PRIMARY KEY,
 deleted_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_buckets (
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS request_outbox AFTER INSERT ON requests BEGIN
 INSERT INTO outbox(request_id,next_at) VALUES(NEW.id, NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS request_delete BEFORE DELETE ON requests BEGIN
 INSERT INTO deletion_ledger(request_id,deleted_at,expires_at)
 VALUES(OLD.id,unixepoch()*1000,unixepoch()*1000 + 2592000000)
 ON CONFLICT(request_id) DO UPDATE SET deleted_at=excluded.deleted_at, expires_at=excluded.expires_at;
END;
