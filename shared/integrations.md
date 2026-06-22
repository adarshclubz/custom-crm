# Shared: Integrations Setup

External services and the credentials/config each needs. Status: 📝 Updated — SendGrid dropped, Gmail-only.

## Gmail (all sends: 1:1 and bulk + reply detection)

- **OAuth2 app** registered in Google Cloud Console (same GCP project as deployment).
- **Scopes:**
  - `https://www.googleapis.com/auth/gmail.send` — send all emails (1:1 and bulk personalized)
  - `https://www.googleapis.com/auth/gmail.readonly` — poll threads for replies
- **OAuth client:** Web application; authorized redirect URI → deployed
  `/api/auth/google/callback`. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Tokens:** store refresh token securely (encrypted, server-side) for the connected
  sending account. Single connected account for v1.
- **Consent screen:** scopes are sensitive → may need Google verification before production;
  internal/testing users work during development.
- **Sending limits:** ~500/day (Gmail) or 2,000/day (Google Workspace). Enforced by a
  configurable daily cap in the app. Sends are staggered with a random 60–180 s delay
  between each one to protect domain reputation.
- **Threading:** every send captures `threadId` from the Gmail API response, stored in
  `sent_emails.thread_id`. Follow-up sends pass `In-Reply-To` + `References` headers so
  replies stay threaded in the recipient's inbox.

## Deliverability requirements (one-time setup, outside the codebase)

- SPF, DKIM, and DMARC records must be configured on the sending domain before any
  bulk outreach. Without these, even small sends land in spam.
- The connected Gmail account should be warmed up gradually (ramp from low volume over
  1–2 weeks) before running large bulk sends.

## Environment variables

```
# Database
DATABASE_URL=                      # Supabase Postgres connection string
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Gmail / Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=         # e.g. https://yourdomain.com/api/auth/google/callback

# App
APP_BASE_URL=                      # public URL (used in OAuth redirect)
DAILY_SEND_CAP=100                 # max emails per day (default 100, configurable)
SEND_DELAY_MIN_SECONDS=60          # min stagger delay between sends
SEND_DELAY_MAX_SECONDS=180         # max stagger delay between sends
```

## Open questions
- Reply detection: polling cron vs Gmail push notifications (Pub/Sub `watch`)? Polling for v1.
- Single connected Gmail account for v1, or multi-account from the start?
- Where do Gmail refresh tokens live — DB column (encrypted) vs GCP Secret Manager?
