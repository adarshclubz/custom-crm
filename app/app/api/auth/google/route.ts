import { makeOAuthClient, GMAIL_SCOPES } from '@/lib/google'

// GET /api/auth/google
// Kicks off the OAuth flow: redirect the user to Google's consent screen.
// access_type=offline + prompt=consent ensures we always receive a refresh token.
export async function GET() {
  const oauth2 = makeOAuthClient()
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
  })
  return Response.redirect(url, 302)
}
