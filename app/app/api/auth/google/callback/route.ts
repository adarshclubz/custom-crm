import { NextRequest } from 'next/server'
import { google } from 'googleapis'
import { makeOAuthClient } from '@/lib/google'
import { encrypt } from '@/lib/crypto'
import { supabase } from '@/lib/supabase'

// GET /api/auth/google/callback?code=...
// Google redirects here after consent. Exchange the code for tokens, read the
// connected account's email, encrypt the refresh token, and upsert into
// gmail_tokens. Single connected account for v1.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const error = params.get('error')
  if (error) {
    return redirectToDashboard(`gmail_error=${encodeURIComponent(error)}`)
  }

  const code = params.get('code')
  if (!code) {
    return redirectToDashboard('gmail_error=missing_code')
  }

  try {
    const oauth2 = makeOAuthClient()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
      // Happens if the account was already consented without prompt=consent.
      return redirectToDashboard('gmail_error=no_refresh_token')
    }

    // Identify which Gmail account just connected. Gmail's own getProfile
    // returns the address using only the gmail scopes we already requested.
    oauth2.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
    const email = profile.emailAddress
    if (!email) {
      return redirectToDashboard('gmail_error=no_email')
    }

    const { error: dbError } = await supabase.from('gmail_tokens').upsert(
      {
        email,
        refresh_token: encrypt(tokens.refresh_token),
        access_token: tokens.access_token ?? null,
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      },
      { onConflict: 'email' }
    )
    if (dbError) {
      return redirectToDashboard(`gmail_error=${encodeURIComponent(dbError.message)}`)
    }

    return redirectToDashboard(`gmail_connected=${encodeURIComponent(email)}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return redirectToDashboard(`gmail_error=${encodeURIComponent(message)}`)
  }
}

function redirectToDashboard(query: string): Response {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  return Response.redirect(`${base}/?${query}`, 302)
}
