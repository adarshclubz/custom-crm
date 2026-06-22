import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE /api/gmail
// Disconnect the connected Gmail account by removing its stored tokens.
// Single connected account for v1, so this clears all rows.
export async function DELETE() {
  const { error } = await supabase
    .from('gmail_tokens')
    .delete()
    .not('id', 'is', null)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
