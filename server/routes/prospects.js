const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { generateEmail } = require('../services/aiGenerator');

// Search via Prospeo API
router.post('/search', auth, async (req, res) => {
  const { job_title, industry, country, limit = 20 } = req.body;

  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'prospeo_api_key'").get(req.userId);
  const apiKey = apiKeyRow?.value;
  if (!apiKey) return res.status(400).json({ error: 'Prospeo API key not configured in Settings' });

  try {
    const response = await fetch('https://api.prospeo.io/domain-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': apiKey,
      },
      body: JSON.stringify({
        job_title,
        industry,
        country: country === 'UK' ? 'United Kingdom' : 'United States',
        limit: Math.min(Number(limit), 100),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Prospeo error: ${errText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reach Prospeo API' });
  }
});

// Get all prospects for this user
router.get('/', auth, (req, res) => {
  const prospects = db.prepare('SELECT * FROM prospects WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(prospects);
});

// Save a prospect
router.post('/', auth, (req, res) => {
  const { first_name, last_name, email, job_title, company, industry, seniority, country } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const existing = db.prepare('SELECT id FROM prospects WHERE user_id = ? AND email = ?').get(req.userId, email);
  if (existing) return res.json({ id: existing.id, already_exists: true });

  const result = db.prepare(
    'INSERT INTO prospects (user_id, first_name, last_name, email, job_title, company, industry, seniority, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, first_name, last_name, email, job_title, company, industry, seniority, country);

  res.json({ id: result.lastInsertRowid });
});

// Add prospect to campaign and generate AI email
router.post('/:id/add-to-campaign', auth, async (req, res) => {
  const { campaign_id } = req.body;
  const prospectId = Number(req.params.id);

  const prospect = db.prepare('SELECT * FROM prospects WHERE id = ? AND user_id = ?').get(prospectId, req.userId);
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(campaign_id, req.userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Link prospect to campaign
  try {
    db.prepare(
      'INSERT OR IGNORE INTO campaign_prospects (campaign_id, prospect_id, next_send_at) VALUES (?, ?, datetime("now"))'
    ).run(campaign_id, prospectId);
  } catch (err) {
    return res.status(400).json({ error: 'Prospect already in this campaign' });
  }

  // Generate AI email
  let aiResult = null;
  let aiError = null;
  try {
    aiResult = await generateEmail(req.userId, prospect);
    db.prepare(
      'INSERT INTO email_templates (campaign_id, prospect_id, sequence_index, subject, body, delay_days, is_ai_generated) VALUES (?, ?, 0, ?, ?, 0, 1)'
    ).run(campaign_id, prospectId, aiResult.subject, aiResult.body);
  } catch (err) {
    aiError = err.message === 'MISSING_API_KEY' ? 'Anthropic API key not set — you can write email 1 manually.' : err.message;
  }

  res.json({ ok: true, ai_email: aiResult, ai_error: aiError });
});

// Regenerate AI email for a prospect in a campaign
router.post('/:id/regenerate-email', auth, async (req, res) => {
  const { campaign_id } = req.body;
  const prospectId = Number(req.params.id);

  const prospect = db.prepare('SELECT * FROM prospects WHERE id = ? AND user_id = ?').get(prospectId, req.userId);
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  try {
    const aiResult = await generateEmail(req.userId, prospect);
    db.prepare(
      `INSERT OR IGNORE INTO email_templates (campaign_id, prospect_id, sequence_index, subject, body, delay_days, is_ai_generated)
       VALUES (?, ?, 0, ?, ?, 0, 1)`
    ).run(campaign_id, prospectId, aiResult.subject, aiResult.body);

    // Update existing
    db.prepare(
      'UPDATE email_templates SET subject = ?, body = ? WHERE campaign_id = ? AND prospect_id = ? AND sequence_index = 0'
    ).run(aiResult.subject, aiResult.body, campaign_id, prospectId);

    res.json({ ok: true, ai_email: aiResult });
  } catch (err) {
    const msg = err.message === 'MISSING_API_KEY' ? 'Anthropic API key not configured' : err.message;
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
