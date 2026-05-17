const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE user_id = ?').all(req.userId);

  const result = campaigns.map(campaign => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN bounced = 1 THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN replied = 1 THEN 1 ELSE 0 END) as replied
      FROM sent_emails se
      JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
      WHERE cp.campaign_id = ?
    `).get(campaign.id);

    // Per-sequence stats
    const bySequence = db.prepare(`
      SELECT
        et.sequence_index,
        COUNT(*) as sent,
        SUM(CASE WHEN se.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
      FROM sent_emails se
      JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
      LEFT JOIN email_templates et ON et.id = se.template_id
      WHERE cp.campaign_id = ?
      GROUP BY et.sequence_index
    `).all(campaign.id);

    return { ...campaign, stats, bySequence };
  });

  res.json(result);
});

// Dashboard stats
router.get('/dashboard', auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // Only count initial emails (index 0) against the daily limit — follow-ups are unlimited
  const sentToday = db.prepare(`
    SELECT COUNT(*) as count FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND date(se.sent_at) = ? AND cp.current_email_index = 0
  `).get(req.userId, today);

  const dailyLimit = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'daily_send_limit'").get(req.userId);

  const openRate = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
    FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ?
  `).get(req.userId);

  const replyRate = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN replied = 1 THEN 1 ELSE 0 END) as replied
    FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ?
  `).get(req.userId);

  const inQueue = db.prepare(`
    SELECT COUNT(*) as count FROM campaign_prospects cp
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND cp.status = 'pending' AND cp.unsubscribed = 0
  `).get(req.userId);

  res.json({
    sent_today: sentToday.count,
    daily_limit: Number(dailyLimit?.value || 30),
    open_rate: openRate.total > 0 ? Math.round((openRate.opened / openRate.total) * 100) : 0,
    reply_rate: replyRate.total > 0 ? Math.round((replyRate.replied / replyRate.total) * 100) : 0,
    prospects_in_queue: inQueue.count,
  });
});

module.exports = router;
