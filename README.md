# OutreachOS

A full-stack B2B cold email outreach tool with AI-powered personalised email generation.

## Tech Stack

- **Frontend**: React 18 + Tailwind CSS (Vite)
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Email**: Nodemailer + Gmail SMTP
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Prospect data**: Prospeo API

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd outreachos
npm run install:all
```

### 2. Configure environment

The `.env` file in the root is pre-created. Edit it if needed:

```
PORT=3001
JWT_SECRET=change_this_to_a_long_random_secret
```

### 3. Run the app

```bash
npm run dev
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

### 4. First-time setup in the app

1. Register an account at `/register`
2. Go to **Settings** and fill in:
   - Gmail email + App Password
   - Prospeo API key
   - Anthropic API key
   - Review/edit the AI system prompt
   - Set your daily send limit and time window

---

## Getting API Keys

### Gmail App Password
1. Enable 2FA on your Google account
2. Go to [myaccount.google.com](https://myaccount.google.com) → Security → App passwords
3. Create an app password for "Mail"
4. Use the 16-character password in Settings

### Prospeo API Key
1. Sign up at [prospeo.io](https://prospeo.io)
2. Go to Dashboard → API
3. Copy your API key

### Anthropic API Key
1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to API Keys → Create Key
3. Copy the `sk-ant-...` key

---

## Features

| Feature | Description |
|---|---|
| Auth | JWT-based login/register with protected routes |
| Dashboard | Daily send stats, open/reply rates, queue size, pause toggle |
| Prospect Search | Prospeo API integration with job title / industry / country filters |
| AI Emails | Claude generates personalised email 1 per prospect automatically |
| Campaigns | Create campaigns, view/edit AI emails, add follow-ups (email 2 & 3) |
| Personalisation | `{first_name}` `{company}` `{job_title}` tokens in follow-ups |
| Sending | Hourly cron job, respects daily limit and time window |
| Tracking | Open tracking via 1x1 pixel, bounce detection |
| Analytics | Per-campaign stats + Chart.js bar chart by email sequence |
| Suppression | Opt-out page, manual add/remove, auto-block before every send |

---

## Email Sequence

- **Email 1** — AI-generated, personalised per prospect. Editable before send.
- **Email 2** — Manual follow-up, configurable delay (default 3 days)
- **Email 3** — Manual follow-up, configurable delay (default 7 days)

All emails include an unsubscribe footer link. Replies with "unsubscribe" are caught and suppressed.

---

## Production Notes

- Set `BASE_URL` in `.env` to your public domain for tracking pixel and unsubscribe links to work
- Use a process manager like PM2 for the Node server in production
- Build the frontend: `cd client && npm run build` — serve the `dist/` folder statically from Express
