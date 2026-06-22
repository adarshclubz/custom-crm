import { NextRequest, NextResponse } from 'next/server'
import { runDueFollowups } from '@/lib/followups'

// POST /api/followups/run
// Processes all due automated follow-up steps. Called every ~minute by the
// scheduler (Cloud Scheduler in prod; a loop/manual call in dev). If
// FOLLOWUP_SECRET is set, requests must present it via the x-followup-secret header.
export async function POST(request: NextRequest) {
  const secret = process.env.FOLLOWUP_SECRET
  if (secret && request.headers.get('x-followup-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDueFollowups()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
