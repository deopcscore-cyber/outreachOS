const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hash);

    // Insert default settings
    const defaults = [
      ['daily_send_limit', '30'],
      ['send_window_start', '09:00'],
      ['send_window_end', '17:00'],
      ['ai_system_prompt', `You are a professional outreach specialist writing personalised cold emails for B2B prospecting. Your goal is to write a compelling, empathetic cold email explaining why the prospect should consider building a second income stream alongside their primary career.\n\nKey angles to use:\n- Job insecurity and industry volatility in their sector\n- The income ceiling that comes with relying on one employer\n- The risk of depending on a single source of income\n- How professionals in their role and seniority can benefit from diversified income\n\nTone: professional, empathetic, conversational — not salesy. It should feel like a thoughtful message from someone who did their research, not a template blast.\n\nAlways include:\n1. A compelling subject line\n2. A personalised opening that references their role and company\n3. A concise value proposition (2-3 sentences)\n4. A soft call to action\n5. Professional sign-off\n\nKeep the email under 200 words. Do not use buzzwords or corporate jargon.`],
      ['gmail_email', ''],
      ['gmail_password', ''],
      ['prospeo_api_key', ''],
      ['anthropic_api_key', ''],
    ];
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)');
    for (const [key, value] of defaults) {
      insertSetting.run(result.lastInsertRowid, key, value);
    }

    const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
