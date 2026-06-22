import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE /api/contacts/[contactId]
// Remove a contact. FK cascades clean up sent_emails / campaign_recipients /
// email_events for this contact.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params

  const { data, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .select('id')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
