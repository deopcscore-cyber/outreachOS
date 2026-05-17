const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

async function generateEmail(userId, prospect) {
  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'anthropic_api_key'").get(userId);
  const systemPromptRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'ai_system_prompt'").get(userId);

  const apiKey = apiKeyRow?.value;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  const systemPrompt = systemPromptRow?.value || 'You are a professional cold email writer.';

  const client = new Anthropic({ apiKey });

  const userMessage = `Write a cold email for the following prospect:

Name: ${prospect.first_name} ${prospect.last_name}
Job Title: ${prospect.job_title || 'Unknown'}
Company: ${prospect.company || 'Unknown'}
Industry: ${prospect.industry || 'Unknown'}
Seniority: ${prospect.seniority || 'Unknown'}
Country: ${prospect.country || 'Unknown'}

Return your response in exactly this JSON format (no markdown, raw JSON only):
{
  "subject": "the email subject line",
  "body": "the full email body text"
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = message.content[0].text.trim();
  // Strip markdown code blocks if present
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(jsonText);
  return { subject: parsed.subject, body: parsed.body };
}

module.exports = { generateEmail };
