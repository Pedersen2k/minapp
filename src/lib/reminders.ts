import type { Task } from './types'

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: -1, label: 'Ingen' },
  { value: 0, label: 'Ved tidspunktet' },
  { value: 5, label: '5 min før' },
  { value: 15, label: '15 min før' },
  { value: 30, label: '30 min før' },
  { value: 60, label: '1 time før' },
  { value: 1440, label: '1 dag før' },
]

/** Minutter før klokkeslettet, eller null når oppgaven ikke skal varsles. */
export function reminderMinutes(t: Task): number | null {
  if (t.done || !t.due || !t.time) return null
  const m = t.reminder ?? 0
  return m < 0 ? null : m
}

/**
 * Tidspunktet varselet skal sendes, som UTC. Regnes ut her i appen fordi bare enheten
 * kjenner tidssonen din – serveren sammenligner bare med klokka.
 */
export function remindAt(t: Task): string | null {
  const m = reminderMinutes(t)
  if (m === null) return null
  const [y, mo, d] = t.due!.split('-').map(Number)
  const [h, mi] = t.time!.split(':').map(Number)
  return new Date(new Date(y, mo - 1, d, h, mi).getTime() - m * 60_000).toISOString()
}
