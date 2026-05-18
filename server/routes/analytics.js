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

  const sentToday = db.prepare(`
    SELECT COUNT(*) as count FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND date(se.sent_at) = ? AND se.bounced = 0
  `).get(req.userId, today);

  const dailyLimit = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'daily_send_limit'").get(req.userId);

  const openRate = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
    FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ?
  `).get(req.userId);

  const replyRate = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN replied = 1 THEN 1 ELSE 0 END) as replied
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

  const warmLeads = db.prepare(`
    SELECT COUNT(*) as count FROM campaign_prospects cp
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND cp.lead_status IN ('opened', 'hot') AND cp.unsubscribed = 0
  `).get(req.userId);

  // Next scheduled send time from cooldown
  const nextSendRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'next_send_allowed_at'").get(req.userId);

  res.json({
    sent_today: sentToday.count,
    daily_limit: Number(dailyLimit?.value || 30),
    open_rate: openRate.total > 0 ? Math.round((openRate.opened / openRate.total) * 100) : 0,
    reply_rate: replyRate.total > 0 ? Math.round((replyRate.replied / replyRate.total) * 100) : 0,
    prospects_in_queue: inQueue.count,
    warm_leads: warmLeads.count,
    next_send_at: nextSendRow?.value || null,
  });
});

// Warm leads — opened but not replied/unsubscribed
router.get('/warm-leads', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      p.id as prospect_id,
      p.first_name, p.last_name, p.email, p.job_title, p.company, p.notes,
      cp.id as cp_id,
      cp.campaign_id,
      cp.lead_status,
      cp.opened_count,
      cp.status as cp_status,
      cp.current_email_index,
      c.name as campaign_name,
      COUNT(DISTINCT se.id) as emails_sent,
      MAX(se.opened_at) as last_opened_at,
      MIN(se.sent_at) as first_sent_at
    FROM campaign_prospects cp
    JOIN prospects p ON p.id = cp.prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    LEFT JOIN sent_emails se ON se.campaign_prospect_id = cp.id
    WHERE c.user_id = ?
      AND cp.unsubscribed = 0
      AND cp.lead_status IN ('opened', 'hot', 'replied', 'interested')
    GROUP BY cp.id
    ORDER BY
      CASE cp.lead_status WHEN 'hot' THEN 0 WHEN 'interested' THEN 1 WHEN 'replied' THEN 2 ELSE 3 END,
      cp.opened_count DESC,
      last_opened_at DESC
  `).all(req.userId);
  res.json(rows);
});

module.exports = router;
