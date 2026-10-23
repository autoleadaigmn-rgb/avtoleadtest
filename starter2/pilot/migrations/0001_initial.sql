PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY,
 payload_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','Contacted','Scheduled','Closed')),
 version INTEGER NOT NULL DEFAULT 1,
 notify_to TEXT NOT NULL,
 email_subject TEXT NOT NULL,
 email_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_expiry ON requests(expires_at);
CREATE INDEX IF NOT EXISTS requests_created ON requests(created_at DESC,id);
CREATE TABLE IF NOT EXISTS outbox (
 request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','sent','dead')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL,
 first_attempt_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 last_error TEXT,
 provider_id TEXT,
 delivered_at INTEGER,
 recipient TEXT NOT NULL,
 subject TEXT NOT NULL,
 body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(state,next_at,lease_until);
CREATE TABLE IF NOT EXISTS deletion_ledger (request_id TEXT PRIMARY KEY,deleted_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_buckets (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS request_outbox AFTER INSERT ON requests BEGIN
 INSERT INTO outbox(request_id,next_at,recipient,subject,body) VALUES(NEW.id,NEW.created_at,NEW.notify_to,NEW.email_subject,NEW.email_text);
END;
CREATE TRIGGER IF NOT EXISTS request_delete BEFORE DELETE ON requests BEGIN
 INSERT INTO deletion_ledger(request_id,deleted_at,expires_at) VALUES(OLD.id,unixepoch()*1000,unixepoch()*1000 + 2592000000)
 ON CONFLICT(request_id) DO UPDATE SET deleted_at=excluded.deleted_at,expires_at=excluded.expires_at;
END;
