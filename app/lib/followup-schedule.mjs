// Pure, dependency-free scheduling math for automated follow-ups.
//
// Kept as plain ESM (no imports beyond Intl/Date) so the exact code the engine
// uses can also be exercised by a plain `node` verification script — see
// scripts/verify_followup_schedule.mjs. lib/followups.ts consumes dueAtMs().
//
// Business-day rule: automated follow-up steps count only Mon-Fri, skipping
// Saturday/Sunday as observed in Indian Standard Time (Asia/Kolkata).

const TZ = 'Asia/Kolkata'

// Weekday of an instant (0=Sun .. 6=Sat) as seen in `tz`. Resolving the weekday
// in IST — not the server's UTC clock — is what makes a Friday-night-UTC instant
// that is already Saturday in IST count as a weekend (and vice versa).
export function weekdayInTz(d, tz = TZ) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

export function isWeekend(d, tz = TZ) {
  const wd = weekdayInTz(d, tz)
  return wd === 0 || wd === 6 // Sun or Sat, in IST
}

// Advance `fromMs` by `days` working days, counting only Mon-Fri. Time-of-day is
// preserved (we add whole 24h calendar days and skip any that land on a weekend).
export function addBusinessDays(fromMs, days, tz = TZ) {
  let cursor = fromMs
  let remaining = Math.round(days)
  while (remaining > 0) {
    cursor += 86_400 * 1000 // +1 calendar day, same wall-clock time
    if (!isWeekend(new Date(cursor), tz)) remaining--
  }
  return cursor
}

// Due time (ms) for a follow-up step. `unitSeconds` is passed in so the caller
// controls the dev fast-mode knob: only genuine 24h days skip weekends; a
// compressed "day" (used to watch a chain fire in seconds) falls back to raw
// elapsed time, where weekend semantics would be meaningless.
export function dueAtMs(fromMs, waitDays, unitSeconds) {
  return unitSeconds === 86_400
    ? addBusinessDays(fromMs, waitDays)
    : fromMs + waitDays * unitSeconds * 1000
}
