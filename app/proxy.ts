import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Basic Auth gate for the temporary public deployment. Only the operator
// (BASIC_AUTH_USER / BASIC_AUTH_PASS) can reach the UI and the data APIs.
// The matcher below excludes the endpoints that external callers must reach
// without a browser login: Google's OAuth callback and the three cron workers
// (those workers enforce their own x-*-secret header auth).
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASS

  // If creds aren't configured, fail open rather than lock everyone out.
  if (!user || !pass) return NextResponse.next()

  const header = request.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    const decoded = atob(header.slice(6))
    const sep = decoded.indexOf(':')
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Custom CRM (temp)"' },
  })
}

export const config = {
  matcher: [
    // Everything except static assets, the OAuth callback, and the cron workers.
    '/((?!_next/static|_next/image|favicon.ico|api/auth/google/callback|api/queue/drain|api/poll/replies|api/followups/run).*)',
  ],
}
