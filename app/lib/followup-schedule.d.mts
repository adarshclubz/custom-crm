// Types for the dependency-free scheduling helpers in followup-schedule.mjs.
export function weekdayInTz(d: Date, tz?: string): number
export function isWeekend(d: Date, tz?: string): boolean
export function addBusinessDays(fromMs: number, days: number, tz?: string): number
export function dueAtMs(fromMs: number, waitDays: number, unitSeconds: number): number
