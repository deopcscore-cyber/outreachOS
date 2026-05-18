const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// List campaigns
router.get('/', auth, (req, res) => {
  const campaigns = db.prepare(`
    SELECT c.*, COUNT(cp.id) as prospect_count
    FROM campaigns c
    LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.userId);
  res.json(campaigns);
});

// Create campaign
router.post('/', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO campaigns (user_id, name) VALUES (?, ?)').run(req.userId, name);
  res.json({ id: result.lastInsertRowid, name });
});

// Outbox — pending emails queued to send (must be before /:id to avoid matching 'outbox' as an id)
router.get('/outbox', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      cp.id as cp_id,
      cp.current_email_index,
      cp.next_send_at,
      cp.status,
      c.id as campaign_id,
      c.name as campaign_name,
      p.first_name, p.last_name, p.email as prospect_email,
      p.job_title, p.company,
      et.subject, et.body, et.sequence_index
    FROM campaign_prospects cp
    JOIN campaigns c ON c.id = cp.campaign_id
    JOIN prospects p ON p.id = cp.prospect_id
    LEFT JOIN email_templates et
      ON et.campaign_id = cp.campaign_id
      AND et.sequence_index = cp.current_email_index
      AND (et.prospect_id = cp.prospect_id OR et.prospect_id IS NULL)
    WHERE c.user_id = ?
      AND cp.status = 'pending'
      AND cp.unsubscribed = 0
    ORDER BY cp.next_send_at ASC
  `).all(req.userId);
  res.json(rows);
});

// Get campaign detail with prospects and email templates
router.get('/:id', auth, (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const prospects = db.prepare(`
    SELECT p.*, cp.status, cp.current_email_index, cp.next_send_at, cp.unsubscribed, cp.id as cp_id,
           cp.lead_status, cp.opened_count
    FROM campaign_prospects cp
    JOIN prospects p ON p.id = cp.prospect_id
    WHERE cp.campaign_id = ?
    ORDER BY
      CASE cp.lead_status WHEN 'hot' THEN 0 WHEN 'opened' THEN 1 WHEN 'replied' THEN 2 WHEN 'interested' THEN 3 ELSE 4 END,
      cp.opened_count DESC
  `).all(req.params.id);

  // Grab email templates (AI-generated per-prospect for index 0, shared follow-ups for index 1+)
  const templates = db.prepare('SELECT * FROM email_templates WHERE campaign_id = ? ORDER BY sequence_index').all(req.params.id);

  // Shared follow-ups (no prospect_id)
  const followUps = templates.filter(t => t.sequence_index > 0 && !t.prospect_id);

  // AI emails per prospect
  const aiEmails = {};
  for (const t of templates) {
    if (t.sequence_index === 0 && t.prospect_id) {
      aiEmails[t.prospect_id] = t;
    }
  }

  res.json({ campaign, prospects, followUps, aiEmails });
});

// Update campaign status
router.patch('/:id', auth, (req, res) => {
  const { status, name } = req.body;
  if (name) db.prepare('UPDATE campaigns SET name = ? WHERE id = ? AND user_id = ?').run(name, req.params.id, req.userId);
  if (status) db.prepare('UPDATE campaigns SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.userId);
  res.json({ ok: true });
});

// Delete campaign
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Save / update follow-up emails (sequence_index 1 and 2)
router.post('/:id/followups', auth, (req, res) => {
  const { followups } = req.body; // array of { sequence_index, subject, body, delay_days }
  const campaignId = req.params.id;

  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  for (const fu of followups) {
    if (fu.sequence_index < 1 || fu.sequence_index > 2) continue;
    db.prepare(`
      INSERT INTO email_templates (campaign_id, sequence_index, subject, body, delay_days, is_ai_generated, prospect_id)
      VALUES (?, ?, ?, ?, ?, 0, NULL)
      ON CONFLICT(campaign_id, sequence_index, prospect_id) DO UPDATE SET subject = excluded.subject, body = excluded.body, delay_days = excluded.delay_days
    `).run(campaignId, fu.sequence_index, fu.subject, fu.body, fu.delay_days || 3);
  }
  res.json({ ok: true });
});

// Update AI-generated email (email 1) for a specific prospect
router.patch('/:id/ai-email/:prospectId', auth, (req, res) => {
  const { subject, body } = req.body;
  db.prepare(
    'UPDATE email_templates SET subject = ?, body = ? WHERE campaign_id = ? AND prospect_id = ? AND sequence_index = 0'
  ).run(subject, body, req.params.id, req.params.prospectId);
  res.json({ ok: true });
});

// Update lead status for a prospect in a campaign
router.patch('/:id/prospects/:prospectId/status', auth, (req, res) => {
  const { lead_status } = req.body;
  const valid = ['pending', 'sent', 'opened', 'hot', 'replied', 'interested', 'not_interested'];
  if (!valid.includes(lead_status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE campaign_prospects SET lead_status = ? WHERE campaign_id = ? AND prospect_id = ?')
    .run(lead_status, req.params.id, req.params.prospectId);
  res.json({ ok: true });
});

// Remove prospect from campaign
router.delete('/:id/prospects/:prospectId', auth, (req, res) => {
  db.prepare('DELETE FROM campaign_prospects WHERE campaign_id = ? AND prospect_id = ?').run(req.params.id, req.params.prospectId);
  res.json({ ok: true });
});

module.exports = router;
