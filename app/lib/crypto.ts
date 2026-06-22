import crypto from 'crypto'

// AES-256-GCM encryption for secrets at rest (Gmail refresh tokens).
// Key comes from TOKEN_ENCRYPTION_KEY: a 32-byte value as 64 hex chars.
// Stored format: ivHex:authTagHex:cipherHex

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  }
  return key
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, cipherHex] = payload.split(':')
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Malformed encrypted payload')
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
