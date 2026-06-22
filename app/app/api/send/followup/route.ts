import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateBulk, renderTemplate, type RenderableContact } from '@/lib/templates'
import { performSend } from '@/lib/queue'

// POST /api/send/followup
// Body: { contactId, subject, body, threadId, inReplyTo?, references? }
// Sends a message into an existing Gmail thread so it stays threaded in the
// recipient's inbox. Synchronous (a follow-up is a single message).
export async function POST(request: NextRequest) {
  let payload: {
    contactId?: string
    subject?: string
    body?: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { contactId, subject, body, threadId, inReplyTo, references } = payload
  if (!contactId || !subject?.trim() || !body?.trim() || !threadId) {
    return NextResponse.json(
      { error: 'contactId, subject, body and threadId are required' },
      { status: 400 }
    )
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, email, name, company')
    .eq('id', contactId)
    .single()
  if (error || !contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const validation = validateBulk(subject, body, [contact as RenderableContact])
  if (!validation.ok) {
    return NextResponse.json(
      { error: 'send_blocked', unknownTags: validation.unknownTags, offenders: validation.offenders },
      { status: 422 }
    )
  }

  try {
    const sentEmailId = await performSend({
      contactId: contact.id,
      to: (contact as RenderableContact).email,
      subject: renderTemplate(subject, contact as RenderableContact),
      body: renderTemplate(body, contact as RenderableContact),
      threadId,
      inReplyTo,
      references,
    })
    return NextResponse.json({ sent: 1, sentEmailId, threadId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
