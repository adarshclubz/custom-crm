import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/gmail/status
// Read-only connection status for the single connected Gmail account (v1).
// Powers the Settings screen and the "no Gmail connected" warning in the
// create-campaign wizard.
export async function GET() {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('email, connected_at, token_expiry')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    email: data.email,
    connectedAt: data.connected_at,
    tokenExpiry: data.token_expiry,
  })
}
