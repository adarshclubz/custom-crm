import { google } from 'googleapis'

// Scopes: send all email + read threads for reply detection.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
]

// A fresh OAuth2 client configured from env. Used for both the consent
// redirect and the code-for-token exchange.
export function makeOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}
