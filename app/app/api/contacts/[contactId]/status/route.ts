import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MANUAL_STATUSES, type ContactStatus } from '@/lib/status'

// PATCH /api/contacts/[contactId]/status
// Body: { status: "meeting" | "converted" }
// Human override for the manual-only lead stages. Set directly (a human may
// deliberately move a lead up or down between these), unlike automated events.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params

  let payload: { status?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = payload.status as ContactStatus
  if (!status || !MANUAL_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${MANUAL_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('contacts')
    .update({ status })
    .eq('id', contactId)
    .select('id, email, status')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json({ contact: data })
}
