import { addDays, fromISO, toISO } from './date'
import type { Recurrence } from './types'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: 'Hver dag',
  weekdays: 'Hver ukedag',
  weekly: 'Hver uke',
  biweekly: 'Annenhver uke',
  monthly: 'Hver måned',
  yearly: 'Hvert år',
}

function addMonths(iso: string, n: number): string {
  const d = fromISO(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  // 31. januar + 1 måned blir siste dag i februar, ikke 3. mars.
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}

function step(iso: string, rule: Recurrence): string {
  switch (rule) {
    case 'daily':
      return addDays(iso, 1)
    case 'weekdays': {
      let next = addDays(iso, 1)
      while ([0, 6].includes(fromISO(next).getDay())) next = addDays(next, 1)
      return next
    }
    case 'weekly':
      return addDays(iso, 7)
    case 'biweekly':
      return addDays(iso, 14)
    case 'monthly':
      return addMonths(iso, 1)
    case 'yearly':
      return addMonths(iso, 12)
  }
}

/** Neste forekomst etter `due`, men aldri i fortiden (en oppgave som er forfalt i to uker hopper frem til i dag eller senere). */
export function nextOccurrence(due: string | undefined, rule: Recurrence, today: string): string {
  let next = step(due ?? today, rule)
  while (next < today) next = step(next, rule)
  return next
}
