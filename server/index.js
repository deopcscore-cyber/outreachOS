require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { sendDueEmails } = require('./services/emailSender');

const app = express();
app.use(cors());
app.use(express.json());

// Serve built React frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/unsubscribe', require('./routes/unsubscribe'));

// Tracking pixel — updates open status and lead_status
app.get('/api/track/open/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const updated = db.prepare(
    "UPDATE sent_emails SET opened_at = datetime('now') WHERE tracking_id = ? AND opened_at IS NULL"
  ).run(trackingId);

  if (updated.changes > 0) {
    const se = db.prepare('SELECT campaign_prospect_id FROM sent_emails WHERE tracking_id = ?').get(trackingId);
    if (se) {
      // Increment open count and promote lead_status (don't overwrite replied/interested/not_interested)
      db.prepare(`
        UPDATE campaign_prospects
        SET
          opened_count = opened_count + 1,
          lead_status = CASE
            WHEN lead_status IN ('replied', 'interested', 'not_interested') THEN lead_status
            WHEN (opened_count + 1) >= 2 THEN 'hot'
            ELSE 'opened'
          END
        WHERE id = ?
      `).run(se.campaign_prospect_id);
    }
  }

  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': pixel.length, 'Cache-Control': 'no-store' });
  res.end(pixel);
});

// Catch-all: serve React app for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Drip send — runs every minute, sends at most one email per 5–10 min per user
cron.schedule('* * * * *', async () => {
  try {
    await sendDueEmails();
  } catch (err) {
    console.error('[Cron] Error:', err.message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OutreachOS server running on http://localhost:${PORT}`);
});
