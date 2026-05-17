const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(req.userId);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

router.post('/', auth, (req, res) => {
  const allowed = [
    'daily_send_limit', 'send_window_start', 'send_window_end',
    'gmail_email', 'gmail_password', 'prospeo_api_key',
    'anthropic_api_key', 'ai_system_prompt',
  ];
  const upsert = db.prepare('INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value');
  for (const key of allowed) {
    if (key in req.body) {
      upsert.run(req.userId, key, String(req.body[key]));
    }
  }
  res.json({ ok: true });
});

module.exports = router;
