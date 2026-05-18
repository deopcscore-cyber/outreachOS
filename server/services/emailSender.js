const nodemailer = require('nodemailer');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

function getSettings(userId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId);
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

function createTransporter(settings) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: settings.gmail_email,
      pass: settings.gmail_password,
    },
  });
}

function replacePlaceholders(text, prospect) {
  const tokens = {
    first_name: prospect.first_name || '',
    last_name: prospect.last_name || '',
    company: prospect.company || '',
    job_title: prospect.job_title || '',
    industry: prospect.industry || '',
    seniority: prospect.seniority || '',
    country: prospect.country || '',
  };
  let result = text;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
  }
  return result;
}

function isWithinWindow(startTime, endTime) {
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= (sh * 60 + sm) && nowMins <= (eh * 60 + em);
}

function setNextSendCooldown(userId) {
  const delayMinutes = Math.floor(Math.random() * 6) + 5; // random 5–10 min
  const nextAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
  db.prepare("INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, 'next_send_allowed_at', ?)")
    .run(userId, nextAt);
  return { nextAt, delayMinutes };
}

const DUE_WHERE = `
  FROM campaign_prospects cp
  JOIN prospects p ON p.id = cp.prospect_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE c.user_id = ?
    AND c.status = 'active'
    AND cp.status = 'pending'
    AND cp.unsubscribed = 0
    AND (cp.next_send_at IS NULL OR cp.next_send_at <= datetime('now'))
    AND p.email NOT IN (SELECT email FROM suppression_list WHERE user_id = ?)
`;

async function sendDueEmails() {
  const users = db.prepare('SELECT DISTINCT user_id FROM settings WHERE key = ? AND value != ""').all('gmail_email');
  for (const { user_id } of users) {
    try {
      await processUserEmails(user_id);
    } catch (err) {
      console.error(`Error processing emails for user ${user_id}:`, err.message);
    }
  }
}

async function processUserEmails(userId) {
  const settings = getSettings(userId);
  if (!settings.gmail_email || !settings.gmail_password) return;

  // Respect manual pause
  if (settings.sending_paused === 'true') return;

  // Sending time window (server runs UTC — set window in UTC in Settings)
  const startTime = settings.send_window_start || '09:00';
  const endTime = settings.send_window_end || '17:00';
  if (!isWithinWindow(startTime, endTime)) return;

  // Anti-spam cooldown — only allow one email per random 5–10 min window
  const nextAllowed = settings.next_send_allowed_at;
  if (nextAllowed && new Date(nextAllowed) > new Date()) return;

  const transporter = createTransporter(settings);

  // Priority 1: follow-ups (already scheduled, don't count against daily limit)
  const followUpCP = db.prepare(`
    SELECT cp.*, p.*, cp.id as cp_id, p.id as prospect_id, c.id as campaign_id
    ${DUE_WHERE}
      AND cp.current_email_index > 0
    ORDER BY cp.next_send_at ASC
    LIMIT 1
  `).get(userId, userId);

  if (followUpCP) {
    await sendNextEmail(transporter, followUpCP, settings);
    const { delayMinutes } = setNextSendCooldown(userId);
    console.log(`[Drip] Follow-up sent to ${followUpCP.email}. Next send in ~${delayMinutes} min.`);
    return;
  }

  // Priority 2: new outreach — respect daily limit
  const dailyLimit = Number(settings.daily_send_limit || 30);
  const today = new Date().toISOString().slice(0, 10);
  const newSentToday = db.prepare(`
    SELECT COUNT(*) as count FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND date(se.sent_at) = ? AND se.bounced = 0
  `).get(userId, today);

  if (newSentToday.count >= dailyLimit) {
    console.log(`[Drip] Daily limit (${dailyLimit}) reached for user ${userId}. Skipping.`);
    return;
  }

  const newCP = db.prepare(`
    SELECT cp.*, p.*, cp.id as cp_id, p.id as prospect_id, c.id as campaign_id
    ${DUE_WHERE}
      AND cp.current_email_index = 0
    ORDER BY cp.next_send_at ASC
    LIMIT 1
  `).get(userId, userId);

  if (newCP) {
    await sendNextEmail(transporter, newCP, settings);
    const { delayMinutes } = setNextSendCooldown(userId);
    console.log(`[Drip] New email sent to ${newCP.email}. Next send in ~${delayMinutes} min.`);
  }
}

async function sendNextEmail(transporter, cp, settings) {
  const emailIndex = cp.current_email_index;

  let template;
  if (emailIndex === 0) {
    template = db.prepare(
      'SELECT * FROM email_templates WHERE campaign_id = ? AND prospect_id = ? AND sequence_index = 0'
    ).get(cp.campaign_id, cp.prospect_id);
  } else {
    template = db.prepare(
      'SELECT * FROM email_templates WHERE campaign_id = ? AND sequence_index = ? AND prospect_id IS NULL'
    ).get(cp.campaign_id, emailIndex);
  }

  if (!template) {
    db.prepare('UPDATE campaign_prospects SET status = ? WHERE id = ?').run('completed', cp.cp_id);
    return;
  }

  const trackingId = uuidv4();
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
  const unsubUrl = `${baseUrl}/api/unsubscribe/opt-out?email=${encodeURIComponent(cp.email)}&uid=${trackingId}`;

  const isFollowUp = emailIndex > 0 && cp.thread_message_id;
  const subject = isFollowUp
    ? `Re: ${cp.thread_subject || replacePlaceholders(template.subject, cp)}`
    : replacePlaceholders(template.subject, cp);

  const bodyText = replacePlaceholders(template.body, cp);
  const html = bodyText.replace(/\n/g, '<br>')
    + `<br><br>---<br><a href="${unsubUrl}">Unsubscribe</a>`
    + `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`;

  const mailOptions = {
    from: settings.gmail_email,
    to: cp.email,
    subject,
    html,
  };

  if (isFollowUp) {
    mailOptions.inReplyTo = cp.thread_message_id;
    mailOptions.references = cp.thread_message_id;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    const sentMessageId = info.messageId || null;

    db.prepare(
      'INSERT INTO sent_emails (campaign_prospect_id, template_id, subject, body, tracking_id, message_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(cp.cp_id, template.id, subject, template.body, trackingId, sentMessageId);

    if (emailIndex === 0 && sentMessageId) {
      db.prepare(
        'UPDATE campaign_prospects SET thread_message_id = ?, thread_subject = ? WHERE id = ?'
      ).run(sentMessageId, subject, cp.cp_id);
    }

    // Update lead_status to 'sent' if still pending
    db.prepare(`
      UPDATE campaign_prospects SET lead_status = 'sent'
      WHERE id = ? AND lead_status = 'pending'
    `).run(cp.cp_id);

    const nextTemplate = db.prepare(
      'SELECT * FROM email_templates WHERE campaign_id = ? AND sequence_index = ? AND prospect_id IS NULL'
    ).get(cp.campaign_id, emailIndex + 1);

    if (nextTemplate) {
      const delayDays = nextTemplate.delay_days || 3;
      db.prepare(
        `UPDATE campaign_prospects SET current_email_index = ?, next_send_at = datetime('now', '+' || ? || ' days') WHERE id = ?`
      ).run(emailIndex + 1, delayDays, cp.cp_id);
    } else {
      db.prepare('UPDATE campaign_prospects SET status = ? WHERE id = ?').run('completed', cp.cp_id);
    }
  } catch (err) {
    db.prepare(
      'INSERT INTO sent_emails (campaign_prospect_id, template_id, subject, body, tracking_id, bounced) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(cp.cp_id, template.id, subject, template.body, trackingId);
    db.prepare('UPDATE campaign_prospects SET status = ? WHERE id = ?').run('bounced', cp.cp_id);
    throw err;
  }
}

module.exports = { sendDueEmails };
