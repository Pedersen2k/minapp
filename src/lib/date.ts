const pad = (n: number) => String(n).padStart(2, '0')

export const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
export const MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86_400_000)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Kort, relativ dato: «I dag», «I morgen», «Fredag», «21. okt». */
export function formatDue(iso: string): string {
  const diff = diffDays(iso, todayISO())
  if (diff === 0) return 'I dag'
  if (diff === 1) return 'I morgen'
  if (diff === -1) return 'I går'
  const d = fromISO(iso)
  if (diff > 1 && diff < 7) return cap(WEEKDAYS[d.getDay()])
  const base = `${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)}`
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** Lang dato: «mandag 21. oktober». */
export function formatLong(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

/** ISO-ukenummer (uke 1 er uka med årets første torsdag). */
export function isoWeek(iso: string): number {
  const d = fromISO(iso)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

/** Første påskedag (anonym gregoriansk algoritme). */
function easterSunday(year: number): string {
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
  return `${year}-${pad(month)}-${pad(day)}`
}

const holidayCache = new Map<number, Map<string, string>>()

/** Norske helligdager (røde dager) for et år: dato (ISO) -> navn. */
export function holidaysOf(year: number): Map<string, string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const easter = easterSunday(year)
  const list: [string, string][] = [
    [`${year}-01-01`, 'Første nyttårsdag'],
    [addDays(easter, -3), 'Skjærtorsdag'],
    [addDays(easter, -2), 'Langfredag'],
    [easter, 'Første påskedag'],
    [addDays(easter, 1), 'Andre påskedag'],
    [`${year}-05-01`, 'Arbeidernes dag'],
    [`${year}-05-17`, 'Grunnlovsdagen'],
    [addDays(easter, 39), 'Kristi himmelfartsdag'],
    [addDays(easter, 49), 'Første pinsedag'],
    [addDays(easter, 50), 'Andre pinsedag'],
    [`${year}-12-25`, 'Første juledag'],
    [`${year}-12-26`, 'Andre juledag'],
  ]
  const map = new Map(list)
  holidayCache.set(year, map)
  return map
}

/** Navnet på helligdagen, eller undefined for vanlige dager. */
export function holidayName(iso: string): string | undefined {
  return holidaysOf(Number(iso.slice(0, 4))).get(iso)
}
