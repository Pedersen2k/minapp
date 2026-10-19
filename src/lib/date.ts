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
