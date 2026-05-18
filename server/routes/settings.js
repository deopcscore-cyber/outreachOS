const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

function getSettings(userId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId);
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

router.get('/', auth, (req, res) => {
  res.json(getSettings(req.userId));
});

router.post('/', auth, (req, res) => {
  const allowed = [
    'daily_send_limit', 'send_window_start', 'send_window_end',
    'gmail_email', 'gmail_password', 'prospeo_api_key',
    'anthropic_api_key', 'ai_system_prompt',
    'ebook_url', 'ebook_email_subject', 'ebook_email_body',
    'sending_paused',
  ];
  const upsert = db.prepare('INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value');
  for (const key of allowed) {
    if (key in req.body) upsert.run(req.userId, key, String(req.body[key]));
  }
  res.json({ ok: true });
});

// Why isn't email sending? Returns a full diagnostic breakdown
router.get('/diagnostics', auth, (req, res) => {
  const s = getSettings(req.userId);
  const issues = [];
  const info = {};

  // Gmail
  if (!s.gmail_email || !s.gmail_password) issues.push('Gmail not configured in Settings');
  else info.gmail = s.gmail_email;

  // Sending paused
  if (s.sending_paused === 'true') issues.push('Sending is manually paused');

  // Time window — server runs UTC
  const now = new Date();
  const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
  const [sh, sm] = (s.send_window_start || '09:00').split(':').map(Number);
  const [eh, em] = (s.send_window_end || '17:00').split(':').map(Number);
  const nowMins = utcH * 60 + utcM;
  const inWindow = nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
  info.server_time_utc = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')} UTC`;
  info.send_window = `${s.send_window_start || '09:00'}–${s.send_window_end || '17:00'} UTC`;
  if (!inWindow) issues.push(`Outside sending window (now: ${info.server_time_utc}, window: ${info.send_window})`);

  // Cooldown
  const nextAt = s.next_send_allowed_at;
  if (nextAt && new Date(nextAt) > now) {
    const mins = Math.ceil((new Date(nextAt) - now) / 60000);
    info.cooldown = `Next send in ~${mins} min`;
  } else {
    info.cooldown = 'Ready to send';
  }

  // Active campaigns
  const activeCamp = db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE user_id = ? AND status = 'active'").get(req.userId);
  info.active_campaigns = activeCamp.c;
  if (!activeCamp.c) issues.push('No active campaigns — resume or create one');

  // Due emails
  const due = db.prepare(`
    SELECT COUNT(*) as c FROM campaign_prospects cp
    JOIN campaigns c ON c.id = cp.campaign_id
    JOIN prospects p ON p.id = cp.prospect_id
    WHERE c.user_id = ? AND c.status = 'active'
      AND cp.status = 'pending' AND cp.unsubscribed = 0
      AND (cp.next_send_at IS NULL OR cp.next_send_at <= datetime('now'))
      AND p.email NOT IN (SELECT email FROM suppression_list WHERE user_id = ?)
  `).get(req.userId, req.userId);
  info.emails_due = due.c;
  if (!due.c && activeCamp.c) issues.push('No emails due right now — prospects may be scheduled for later');

  // Daily limit
  const today = new Date().toISOString().slice(0, 10);
  const sent = db.prepare(`
    SELECT COUNT(*) as c FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND date(se.sent_at) = ? AND se.bounced = 0
  `).get(req.userId, today);
  const limit = Number(s.daily_send_limit || 30);
  info.sent_today = sent.c;
  info.daily_limit = limit;
  if (sent.c >= limit) issues.push(`Daily limit of ${limit} emails reached for today`);

  res.json({ ok: issues.length === 0, issues, info });
});

// Clear the cooldown and fire a send immediately
router.post('/trigger-send', auth, async (req, res) => {
  // Clear cooldown
  db.prepare("DELETE FROM settings WHERE user_id = ? AND key = 'next_send_allowed_at'").run(req.userId);
  // Ensure not paused
  db.prepare("DELETE FROM settings WHERE user_id = ? AND key = 'sending_paused'").run(req.userId);

  const { sendDueEmails } = require('../services/emailSender');
  try {
    await sendDueEmails();
    res.json({ ok: true, message: 'Send triggered — check your Gmail sent folder.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
