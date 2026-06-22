// Merge-tag rendering for plain-text emails. Tags look like {{name}}.
// Resolved on our side (no provider templating). Supported fields map to
// contact columns; extend MERGE_FIELDS to add more.

export const MERGE_FIELDS = ['name', 'company'] as const
export type MergeField = (typeof MERGE_FIELDS)[number]

// Minimal shape a contact needs for rendering.
export interface RenderableContact {
  id: string
  email: string
  name?: string | null
  company?: string | null
}

const TAG_RE = /\{\{\s*(\w+)\s*\}\}/g

// Every distinct tag referenced across the given text(s).
export function extractTags(...texts: string[]): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    for (const match of text.matchAll(TAG_RE)) {
      found.add(match[1])
    }
  }
  return [...found]
}

// A value is "missing" if null/undefined or blank after trimming.
function isMissing(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

// Which referenced fields does this contact lack a usable value for?
export function missingFieldsFor(
  contact: RenderableContact,
  tags: string[]
): string[] {
  return tags.filter((tag) => {
    if (!MERGE_FIELDS.includes(tag as MergeField)) return false // unknown tag: not a data gap
    return isMissing(contact[tag as MergeField])
  })
}

export interface BulkValidation {
  ok: boolean
  unknownTags: string[] // referenced tags we don't support
  offenders: { id: string; email: string; missing: string[] }[]
}

// Gatekeeper for bulk sends: validate every contact has values for every
// referenced (and supported) tag. If any offenders exist, the caller must
// block the entire send.
export function validateBulk(
  subject: string,
  body: string,
  contacts: RenderableContact[]
): BulkValidation {
  const tags = extractTags(subject, body)
  const unknownTags = tags.filter((t) => !MERGE_FIELDS.includes(t as MergeField))

  const offenders = contacts
    .map((c) => ({ id: c.id, email: c.email, missing: missingFieldsFor(c, tags) }))
    .filter((o) => o.missing.length > 0)

  return { ok: offenders.length === 0 && unknownTags.length === 0, unknownTags, offenders }
}

// Substitute supported tags for one contact. Assumes validation already passed.
export function renderTemplate(text: string, contact: RenderableContact): string {
  return text.replace(TAG_RE, (whole, tag: string) => {
    if (MERGE_FIELDS.includes(tag as MergeField)) {
      return (contact[tag as MergeField] ?? '').toString()
    }
    return whole // leave unknown tags untouched
  })
}
