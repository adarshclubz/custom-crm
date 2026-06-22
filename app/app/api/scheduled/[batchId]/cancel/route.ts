import { NextRequest, NextResponse } from 'next/server'
import { cancelScheduledBatch } from '@/lib/queue'

// POST /api/scheduled/[batchId]/cancel
// Cancels a still-pending scheduled batch. In-flight or already-sent jobs are
// left alone. If it was a campaign's initial scheduled send, the campaign
// reverts to 'draft'.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params
  try {
    const result = await cancelScheduledBatch(batchId)
    if (result.canceled === 0) {
      return NextResponse.json(
        { error: 'no pending jobs to cancel for this batch' },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
