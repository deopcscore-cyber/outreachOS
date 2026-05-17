const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get suppression list
router.get('/', auth, (req, res) => {
  const list = db.prepare('SELECT * FROM suppression_list WHERE user_id = ? ORDER BY added_at DESC').all(req.userId);
  res.json(list);
});

// Add to suppression list
router.post('/', auth, (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    db.prepare('INSERT OR IGNORE INTO suppression_list (user_id, email, reason) VALUES (?, ?, ?)').run(req.userId, email, reason || 'manual');
    // Mark any campaign_prospects as unsubscribed
    db.prepare(`
      UPDATE campaign_prospects SET unsubscribed = 1
      WHERE prospect_id IN (SELECT id FROM prospects WHERE user_id = ? AND email = ?)
    `).run(req.userId, email);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove from suppression list
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM suppression_list WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Public unsubscribe endpoint (no auth — linked from email footer)
router.get('/opt-out', (req, res) => {
  const { email, uid } = req.query;
  if (!email) return res.status(400).send('Missing email');

  // Find user from sent email tracking id
  let userId = null;
  if (uid) {
    const sentEmail = db.prepare('SELECT cp.* FROM sent_emails se JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id WHERE se.tracking_id = ?').get(uid);
    if (sentEmail) {
      const prospect = db.prepare('SELECT user_id FROM prospects WHERE id = ?').get(sentEmail.prospect_id);
      if (prospect) userId = prospect.user_id;
    }
  }

  if (userId) {
    db.prepare('INSERT OR IGNORE INTO suppression_list (user_id, email, reason) VALUES (?, ?, ?)').run(userId, email, 'unsubscribe');
    db.prepare(`
      UPDATE campaign_prospects SET unsubscribed = 1
      WHERE prospect_id IN (SELECT id FROM prospects WHERE user_id = ? AND email = ?)
    `).run(userId, email);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Unsubscribed</title><style>body{font-family:sans-serif;text-align:center;padding:60px;color:#374151}</style></head>
    <body>
      <h2>You've been unsubscribed</h2>
      <p>${email} has been removed from our mailing list.</p>
    </body>
    </html>
  `);
});

module.exports = router;
