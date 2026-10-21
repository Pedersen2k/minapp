import { addDays, toISO } from './date'

/** Første påskedag (Gregoriansk kalender, Meeus/Jones/Butcher). */
function easter(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return toISO(new Date(year, month - 1, day))
}

const cache = new Map<number, Map<string, string>>()

/** Norske helligdager og merkedager for et år: dato (ISO) -> navn. */
export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year)
  if (hit) return hit
  const p = easter(year)
  const fixed = (m: number, d: number) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const map = new Map<string, string>([
    [fixed(1, 1), 'Første nyttårsdag'],
    [addDays(p, -7), 'Palmesøndag'],
    [addDays(p, -3), 'Skjærtorsdag'],
    [addDays(p, -2), 'Langfredag'],
    [p, 'Første påskedag'],
    [addDays(p, 1), 'Andre påskedag'],
    [fixed(5, 1), 'Arbeidernes dag'],
    [fixed(5, 17), 'Grunnlovsdagen'],
    [addDays(p, 39), 'Kristi himmelfartsdag'],
    [addDays(p, 49), 'Første pinsedag'],
    [addDays(p, 50), 'Andre pinsedag'],
    [fixed(12, 24), 'Julaften'],
    [fixed(12, 25), 'Første juledag'],
    [fixed(12, 26), 'Andre juledag'],
    [fixed(12, 31), 'Nyttårsaften'],
  ])
  cache.set(year, map)
  return map
}

export const holidayName = (iso: string): string | undefined => holidaysOf(Number(iso.slice(0, 4))).get(iso)

/** ISO-ukenummer (uke 1 inneholder årets første torsdag). */
export function isoWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7)
}
