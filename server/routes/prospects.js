const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { generateEmail } = require('../services/aiGenerator');

// Search via Prospeo API
router.post('/search', auth, async (req, res) => {
  const { job_title, industry, country, limit = 20 } = req.body;
  const maxResults = Math.min(Number(limit), 100);

  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'prospeo_api_key'").get(req.userId);
  const apiKey = apiKeyRow?.value;
  if (!apiKey) return res.status(400).json({ error: 'Prospeo API key not configured in Settings' });

  try {
    // Build filters for /search-person
    const filters = {};
    if (job_title) filters.person_job_title = { include: [job_title] };
    if (industry) filters.company_industry = { include: [industry] };
    if (country) {
      const countryName = country === 'UK' ? 'United Kingdom' : country === 'US' ? 'United States' : country;
      filters.person_location_search = { include: [countryName] };
    }

    // Collect up to maxResults across pages
    const collected = [];
    let page = 1;

    while (collected.length < maxResults) {
      const searchRes = await fetch('https://api.prospeo.io/search-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KEY': apiKey },
        body: JSON.stringify({ page, filters }),
      });

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        return res.status(searchRes.status).json({ error: `Prospeo search error: ${errText}` });
      }

      const searchData = await searchRes.json();
      if (searchData.error || !searchData.results?.length) break;

      collected.push(...searchData.results);
      if (searchData.results.length < (searchData.pagination?.per_page ?? 25)) break;
      page++;
    }

    const candidates = collected.slice(0, maxResults);

    // Enrich each person to get their email
    const enriched = await Promise.all(
      candidates.map(async (item) => {
        const person = item.person ?? item;
        const company = item.company ?? {};
        const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');
        const website = company.website ?? '';

        if (!fullName || !website) return null;

        try {
          const enrichRes = await fetch('https://api.prospeo.io/enrich-person', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-KEY': apiKey },
            body: JSON.stringify({ only_verified_email: true, data: { full_name: fullName, company_website: website } }),
          });

          if (!enrichRes.ok) return null;
          const enrichData = await enrichRes.json();
          if (enrichData.error) return null;
          const emailObj = enrichData.person?.email ?? enrichData.email ?? null;
          const email = emailObj?.email ?? (typeof emailObj === 'string' ? emailObj : null);
          if (!email || email.includes('*')) return null;

          return {
            first_name: person.first_name ?? '',
            last_name: person.last_name ?? '',
            email,
            job_title: person.job_title ?? '',
            company: company.name ?? '',
            industry: company.industry ?? '',
            seniority: person.seniority ?? '',
            country: person.location ?? company.location ?? '',
          };
        } catch {
          return null;
        }
      })
    );

    const results = enriched.filter(Boolean);
    res.json({ results });
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

  // Link prospect to campaign — if already linked, treat as success
  const alreadyLinked = db.prepare('SELECT id FROM campaign_prospects WHERE campaign_id = ? AND prospect_id = ?').get(campaign_id, prospectId);
  if (!alreadyLinked) {
    db.prepare(
      "INSERT INTO campaign_prospects (campaign_id, prospect_id, next_send_at) VALUES (?, ?, datetime('now'))"
    ).run(campaign_id, prospectId);
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

// Update prospect notes
router.patch('/:id/notes', auth, (req, res) => {
  const { notes } = req.body;
  db.prepare('UPDATE prospects SET notes = ? WHERE id = ? AND user_id = ?')
    .run(notes ?? '', req.params.id, req.userId);
  res.json({ ok: true });
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
