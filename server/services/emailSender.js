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
  return text
    .replace(/\{first_name\}/gi, prospect.first_name || '')
    .replace(/\{last_name\}/gi, prospect.last_name || '')
    .replace(/\{company\}/gi, prospect.company || '')
    .replace(/\{job_title\}/gi, prospect.job_title || '');
}

function isWithinWindow(startTime, endTime) {
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= (sh * 60 + sm) && nowMins <= (eh * 60 + em);
}

// Base query for due prospects — shared between new and follow-up queries
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

  const startTime = settings.send_window_start || '09:00';
  const endTime = settings.send_window_end || '17:00';
  if (!isWithinWindow(startTime, endTime)) return;

  const transporter = createTransporter(settings);
  const today = new Date().toISOString().slice(0, 10);

  // --- Follow-ups (sequence_index > 0): no daily limit ---
  const followUpCPs = db.prepare(`
    SELECT cp.*, p.*, cp.id as cp_id, p.id as prospect_id, c.id as campaign_id
    ${DUE_WHERE}
      AND cp.current_email_index > 0
  `).all(userId, userId);

  for (const cp of followUpCPs) {
    try {
      await sendNextEmail(transporter, cp, settings);
    } catch (err) {
      console.error(`Follow-up failed for ${cp.email}:`, err.message);
    }
  }

  // --- New outreach (sequence_index = 0): respect daily limit ---
  const dailyLimit = Number(settings.daily_send_limit || 30);
  const newSentToday = db.prepare(`
    SELECT COUNT(*) as count
    FROM sent_emails se
    JOIN campaign_prospects cp ON cp.id = se.campaign_prospect_id
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.user_id = ? AND date(se.sent_at) = ? AND cp.current_email_index = 0
  `).get(userId, today);

  let remaining = dailyLimit - newSentToday.count;
  if (remaining <= 0) return;

  const newCPs = db.prepare(`
    SELECT cp.*, p.*, cp.id as cp_id, p.id as prospect_id, c.id as campaign_id
    ${DUE_WHERE}
      AND cp.current_email_index = 0
    LIMIT ?
  `).all(userId, userId, remaining);

  for (const cp of newCPs) {
    try {
      await sendNextEmail(transporter, cp, settings);
    } catch (err) {
      console.error(`Initial email failed for ${cp.email}:`, err.message);
    }
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

  // For follow-ups: reply to the original thread using stored subject + Message-ID
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

  // Thread headers — makes the follow-up appear inside the original conversation
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

    // After email 1, save Message-ID and subject for threading all follow-ups
    if (emailIndex === 0 && sentMessageId) {
      db.prepare(
        'UPDATE campaign_prospects SET thread_message_id = ?, thread_subject = ? WHERE id = ?'
      ).run(sentMessageId, subject, cp.cp_id);
    }

    // Schedule next email or mark complete
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
