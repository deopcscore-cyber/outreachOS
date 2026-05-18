const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'outreachos.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL,
    job_title TEXT,
    company TEXT,
    industry TEXT,
    seniority TEXT,
    country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    prospect_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    current_email_index INTEGER DEFAULT 0,
    next_send_at DATETIME,
    unsubscribed INTEGER DEFAULT 0,
    thread_message_id TEXT,
    thread_subject TEXT,
    UNIQUE(campaign_id, prospect_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (prospect_id) REFERENCES prospects(id)
  );

  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    sequence_index INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    delay_days INTEGER DEFAULT 0,
    is_ai_generated INTEGER DEFAULT 0,
    prospect_id INTEGER,
    UNIQUE(campaign_id, sequence_index, prospect_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (prospect_id) REFERENCES prospects(id)
  );

  CREATE TABLE IF NOT EXISTS sent_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_prospect_id INTEGER NOT NULL,
    template_id INTEGER,
    subject TEXT,
    body TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    opened_at DATETIME,
    tracking_id TEXT UNIQUE,
    message_id TEXT,
    bounced INTEGER DEFAULT 0,
    replied INTEGER DEFAULT 0,
    FOREIGN KEY (campaign_prospect_id) REFERENCES campaign_prospects(id)
  );

  CREATE TABLE IF NOT EXISTS suppression_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    reason TEXT DEFAULT 'unsubscribe',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Safe schema migrations — no-op if columns already exist
try { db.exec('ALTER TABLE prospects ADD COLUMN notes TEXT'); } catch {}
try { db.exec("ALTER TABLE campaign_prospects ADD COLUMN lead_status TEXT DEFAULT 'pending'"); } catch {}
try { db.exec('ALTER TABLE campaign_prospects ADD COLUMN opened_count INTEGER DEFAULT 0'); } catch {}

module.exports = db;
