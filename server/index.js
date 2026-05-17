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

// Tracking pixel
app.get('/api/track/open/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  db.prepare("UPDATE sent_emails SET opened_at = datetime('now') WHERE tracking_id = ? AND opened_at IS NULL").run(trackingId);
  // 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': pixel.length, 'Cache-Control': 'no-store' });
  res.end(pixel);
});

// Catch-all: send index.html for any non-API route (React handles routing client-side)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Hourly email send job
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Running email send job...');
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
