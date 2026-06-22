import { NextRequest, NextResponse } from 'next/server'
import { pollReplies } from '@/lib/poll'

// POST /api/poll/replies
// Scans tracked threads for new inbound replies. Called on a schedule
// (Cloud Scheduler in prod; manual/loop in dev). If POLL_SECRET is set,
// requests must present it via the x-poll-secret header.
export async function POST(request: NextRequest) {
  const secret = process.env.POLL_SECRET
  if (secret && request.headers.get('x-poll-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await pollReplies()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
