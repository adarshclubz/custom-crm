import { NextRequest, NextResponse } from 'next/server'
import { getThread } from '@/lib/conversations'

// GET /api/threads/[threadId]
// Full conversation: outbound sends + inbound replies merged in time order.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  try {
    const thread = await getThread(threadId)
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }
    return NextResponse.json(thread)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
