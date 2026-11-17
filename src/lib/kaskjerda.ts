/**
 * Status for kaskjerda.no («Skjer i Ålesund»), samme kilder som kaskjerda.no/status/:
 * åpne GitHub-varsler («tilsyn»), siste kjøringer av oppdater.yml, programmets alder
 * (data/events.json) og planlistene (data/status.json). Alt er offentlig og CORS-åpent.
 */
export const KASKJERDA_STATUS_URL = 'https://kaskjerda.no/status/'
const SITE = 'https://kaskjerda.no'
const API = 'https://api.github.com/repos/Pedersen2k/skjer-i-alesund'

export type RunResult = 'success' | 'failure' | 'progress'

export interface KaskjerdaStatus {
  alerts: { title: string; url: string }[] | null // null = fikk ikke svar fra GitHub
  runs: { result: RunResult; at: string; url: string }[] | null
  events: number | null
  programAt: string | null // ISO, når programmet sist ble hentet
  newCount: number // arrangementer lagt til siste døgn
  newest: { title: string; addedAt: string }[] // de nyeste, nyeste først
  next: { title: string; text: string }[]
  upcoming: Deadline[] // dagens punkter i planlisten, ellers de første som kommer
  fetchedAt: number
}

export interface Deadline {
  who: string
  title: string
  days: number // 0 = i dag
}

export type Level = 'ok' | 'warn' | 'bad'

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(String(res.status))
  return res.json() as Promise<T>
}
const gh = <T>(path: string) => json<T>(API + path, { headers: { Accept: 'application/vnd.github+json' } })
const orNull = <T>(p: Promise<T>) => p.catch(() => null)

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

/**
 * Dager fra i dag til en dato i planlisten («17. nov.», «~7. nov.»). Faste og vage
 * punkter («Hver mandag», «Mid-nov.») gir null. Datoer langt tilbake regnes som neste år.
 */
export function daysUntil(text: string, now = new Date()): number | null {
  const m = /^~?\s*(\d{1,2})\.\s*([a-zæøå]{3})/i.exec(text.trim())
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  if (!m || month < 0) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = new Date(now.getFullYear(), month, Number(m[1]))
  if (today.getTime() - date.getTime() > 180 * 86_400_000) date.setFullYear(date.getFullYear() + 1)
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

/** Dagens punkter, eller punktene på den første datoen som kommer. */
function upcoming(calendar: [string, string, string, string][]): Deadline[] {
  const dated = calendar.flatMap(([when, who, title]) => {
    const days = daysUntil(when)
    return days != null && days >= 0 ? [{ who, title, days }] : []
  })
  const first = Math.min(...dated.map((d) => d.days))
  return dated.filter((d) => d.days === first)
}

/**
 * Hva varselet gjelder, fra første linje i teksten: «Sjekk kategorien på nye arrangementer».
 * Samme regel som Edge Function kaskjerda-tilsyn bruker for oppgavetittelen.
 */
export function alertTitle(title: string, body: string | null): string {
  const line = (body ?? '')
    .split('\n')
    .map((l) => l.replace(/[#*_`>]/g, '').trim())
    .find((l) => l.length > 0)
  const cut = line?.split(/\s\(|:\s/)[0].trim()
  return cut ? (cut.length <= 90 ? cut : `${cut.slice(0, 87)}…`) : title
}

export async function fetchKaskjerdaStatus(): Promise<KaskjerdaStatus> {
  type Issue = { title: string; body: string | null; html_url: string; pull_request?: unknown }
  type Run = { status: string; conclusion: string | null; created_at: string; html_url: string }
  type Events = { events: { title: string; addedAt?: string }[]; meta: { updatedAt: string } }
  type Plan = { next: [string, string][]; calendar: [string, string, string, string][] }

  const [issues, runs, events, plan] = await Promise.all([
    orNull(gh<Issue[]>('/issues?state=open&per_page=50')),
    orNull(gh<{ workflow_runs: Run[] }>('/actions/workflows/oppdater.yml/runs?per_page=12')),
    orNull(json<Events>(`${SITE}/data/events.json`, { cache: 'no-store' })),
    orNull(json<Plan>(`${SITE}/data/status.json`, { cache: 'no-store' })),
  ])
  if (!issues && !runs && !events && !plan) throw new Error('Fikk ikke kontakt')

  const added = (events?.events ?? []).filter((e) => e.addedAt).sort((a, b) => (a.addedAt! < b.addedAt! ? 1 : -1))
  const dayAgo = Date.now() - 86_400_000
  return {
    alerts: issues && issues.filter((i) => !i.pull_request && /tilsyn/i.test(i.title)).map((i) => ({ title: alertTitle(i.title, i.body), url: i.html_url })),
    runs:
      runs &&
      runs.workflow_runs.map((r) => ({
        result: r.status !== 'completed' ? 'progress' : r.conclusion === 'success' ? 'success' : r.conclusion === 'failure' ? 'failure' : 'progress',
        at: r.created_at,
        url: r.html_url,
      })),
    events: events?.events.length ?? null,
    programAt: events?.meta.updatedAt ?? null,
    newCount: added.filter((e) => new Date(e.addedAt!).getTime() > dayAgo).length,
    newest: added.slice(0, 3).map((e) => ({ title: e.title, addedAt: e.addedAt! })),
    next: (plan?.next ?? []).map(([title, text]) => ({ title, text })),
    upcoming: upcoming(plan?.calendar ?? []),
    fetchedAt: Date.now(),
  }
}

/** Samme vurdering som banneret på statussiden. */
export function statusLevel(s: KaskjerdaStatus): { level: Level; label: string; detail: string } {
  if (s.alerts === null && s.runs === null) return { level: 'warn', label: 'Ukjent', detail: 'Fikk ikke kontakt med GitHub' }
  const bad: string[] = []
  if (s.alerts?.length) bad.push(`${s.alerts.length} åpent varsel`)
  if (s.runs?.[0]?.result === 'failure') bad.push('siste kjøring feilet')
  if (bad.length) return { level: 'bad', label: 'Trenger tilsyn', detail: bad.join(' · ') }
  const hours = s.programAt ? (Date.now() - new Date(s.programAt).getTime()) / 3_600_000 : 0
  const h = new Date().getHours()
  if (hours > 5 && h >= 8 && h <= 22) return { level: 'warn', label: 'Sjekk programmet', detail: `Over ${Math.round(hours)} timer gammelt` }
  return { level: 'ok', label: 'Alt i orden', detail: 'Ingen varsler, siste kjøring gikk fint' }
}

export function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(0, m)} min siden`
  if (m < 1440) return `${Math.round(m / 60)} t siden`
  return `${Math.round(m / 1440)} d siden`
}

export const inDays = (n: number) => (n === 0 ? 'I dag' : n === 1 ? 'I morgen' : `Om ${n} dager`)
