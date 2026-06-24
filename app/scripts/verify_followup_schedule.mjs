// Test gate for the business-day follow-up scheduling math.
//
// Imports the SAME helpers the engine uses (lib/followup-schedule.mjs) — no
// logic duplication — and asserts golden cases. Run:
//
//   node scripts/verify_followup_schedule.mjs
//
// Exits non-zero if any case fails.

import { dueAtMs, isWeekend, addBusinessDays } from '../lib/followup-schedule.mjs'

const DAY = 86_400 // real-day unit (seconds)

// Reference week: 2026-06-01 is a Monday, so:
//   Thu 06-04, Fri 06-05, Sat 06-06, Sun 06-07, Mon 06-08, Tue 06-09, Fri 06-12
// 10:00 IST == 04:30 UTC (IST = UTC+5:30, no DST).
const istMorning = (day) => Date.parse(`2026-06-${day}T04:30:00.000Z`)

let failures = 0
function check(name, actual, expected) {
  const a = typeof actual === 'string' ? actual : String(actual)
  const e = typeof expected === 'string' ? expected : String(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) console.log(`        expected ${e}\n        actual   ${a}`)
}

const iso = (ms) => new Date(ms).toISOString()

// 1. Fri 10:00 IST + 2 business days -> Tue 10:00 IST (skips Sat+Sun).
check('Fri +2 -> Tue', iso(dueAtMs(istMorning('05'), 2, DAY)), '2026-06-09T04:30:00.000Z')

// 2. Thu 10:00 IST + 1 -> Fri 10:00 IST (no weekend in the way).
check('Thu +1 -> Fri', iso(dueAtMs(istMorning('04'), 1, DAY)), '2026-06-05T04:30:00.000Z')

// 3. Fri 10:00 IST + 1 -> Mon 10:00 IST (skips weekend).
check('Fri +1 -> Mon', iso(dueAtMs(istMorning('05'), 1, DAY)), '2026-06-08T04:30:00.000Z')

// 4. Fri 10:00 IST + 5 -> next Fri 10:00 IST (skips exactly one weekend).
check('Fri +5 -> next Fri', iso(dueAtMs(istMorning('05'), 5, DAY)), '2026-06-12T04:30:00.000Z')

// 5. IST/UTC boundary — weekday must be judged in IST, not UTC:
//    Fri 20:00 UTC == Sat 01:30 IST  -> weekend (UTC-based check would say Fri/false).
check('Fri 20:00 UTC is weekend in IST', isWeekend(new Date('2026-06-05T20:00:00.000Z')), 'true')
//    Sun 20:00 UTC == Mon 01:30 IST  -> NOT weekend (UTC-based check would say Sun/true).
check('Sun 20:00 UTC is weekday in IST', isWeekend(new Date('2026-06-07T20:00:00.000Z')), 'false')

// 6. Fast-mode passthrough: unit != 86400 disables weekend skipping (raw elapsed).
const t = istMorning('05')
check('fast-mode raw elapsed', dueAtMs(t, 2, 5), t + 2 * 5 * 1000)

// 7. addBusinessDays never lands on a weekend (spot-check across a week of starts).
for (let d = 1; d <= 7; d++) {
  const start = Date.parse(`2026-06-0${d}T04:30:00.000Z`)
  const landed = new Date(addBusinessDays(start, 1))
  check(`+1 business day from 06-0${d} is a weekday`, isWeekend(landed), 'false')
}

console.log('')
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('All checks passed.')
