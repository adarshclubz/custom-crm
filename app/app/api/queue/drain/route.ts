import { NextRequest, NextResponse } from 'next/server'
import { drainDueJobs } from '@/lib/queue'

// POST /api/queue/drain
// Processes all due send_jobs. Called every minute by the scheduler
// (Cloud Scheduler in prod; a local loop in dev). If QUEUE_DRAIN_SECRET is set,
// requests must present it via the x-drain-secret header.
export async function POST(request: NextRequest) {
  const secret = process.env.QUEUE_DRAIN_SECRET
  if (secret && request.headers.get('x-drain-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await drainDueJobs()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
