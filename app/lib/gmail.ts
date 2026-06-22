import crypto from 'crypto'
import { google, gmail_v1 } from 'googleapis'
import { makeOAuthClient } from '@/lib/google'
import { encrypt, decrypt } from '@/lib/crypto'
import { supabase } from '@/lib/supabase'

// Loads the single connected account's tokens, returns an authenticated Gmail
// client. The OAuth2 client auto-refreshes the access token when it expires;
// we listen for that and persist the new access token back to gmail_tokens.
export async function getGmailClient(): Promise<{
  gmail: gmail_v1.Gmail
  fromEmail: string
}> {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('email, refresh_token, access_token, token_expiry')
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('No connected Gmail account. Connect one at /api/auth/google.')
  }

  const oauth2 = makeOAuthClient()
  oauth2.setCredentials({
    refresh_token: decrypt(data.refresh_token),
    access_token: data.access_token ?? undefined,
    expiry_date: data.token_expiry ? new Date(data.token_expiry).getTime() : undefined,
  })

  // Persist refreshed access tokens so we don't refresh on every request.
  oauth2.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {}
    if (tokens.access_token) update.access_token = tokens.access_token
    if (tokens.expiry_date) update.token_expiry = new Date(tokens.expiry_date).toISOString()
    // A refresh_token only reappears on re-consent; persist it (encrypted) if so.
    if (tokens.refresh_token) update.refresh_token = encrypt(tokens.refresh_token)
    if (Object.keys(update).length > 0) {
      await supabase.from('gmail_tokens').update(update).eq('email', data.email)
    }
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2 })
  return { gmail, fromEmail: data.email }
}

export interface GmailStatus {
  connected: boolean
  email: string | null
  connectedAt: string | null
  tokenExpiry: string | null
}

// Read-only connection status for the single connected Gmail account (v1).
// Mirrors GET /api/gmail/status but callable directly from server components.
export async function getGmailStatus(): Promise<GmailStatus> {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('email, connected_at, token_expiry')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return { connected: false, email: null, connectedAt: null, tokenExpiry: null }
  }
  return {
    connected: true,
    email: data.email,
    connectedAt: data.connected_at ?? null,
    tokenExpiry: data.token_expiry ?? null,
  }
}

export interface SendArgs {
  to: string
  subject: string
  body: string // plain text
  // Threading: pass both for a follow-up that stays in an existing thread.
  threadId?: string
  inReplyTo?: string // the Message-ID header of the message being replied to
  references?: string // accumulated References header
}

export interface SendResult {
  messageId: string // Gmail messageId
  threadId: string // Gmail threadId
  rfcMessageId: string // the RFC822 Message-ID header (for future threading)
}

// Builds an RFC 2822 plain-text message and sends it via Gmail.
export async function sendMessage(args: SendArgs): Promise<SendResult> {
  const { gmail, fromEmail } = await getGmailClient()

  // Generate our own Message-ID so we can thread replies later.
  const domain = fromEmail.split('@')[1] ?? 'mail.local'
  const rfcMessageId = `<${crypto.randomUUID()}@${domain}>`

  const headers = [
    `From: ${fromEmail}`,
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    `Message-ID: ${rfcMessageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ]
  if (args.inReplyTo) headers.push(`In-Reply-To: ${args.inReplyTo}`)
  if (args.references) headers.push(`References: ${args.references}`)

  const raw = `${headers.join('\r\n')}\r\n\r\n${args.body}`
  const encodedMessage = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      ...(args.threadId ? { threadId: args.threadId } : {}),
    },
  })

  if (!data.id || !data.threadId) {
    throw new Error('Gmail send returned no message/thread id')
  }
  return { messageId: data.id, threadId: data.threadId, rfcMessageId }
}
