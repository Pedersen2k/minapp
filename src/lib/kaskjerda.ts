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
  next: { title: string; text: string }[]
  today: { who: string; title: string }[] // punkter i planlisten med dagens dato
  fetchedAt: number
}

export type Level = 'ok' | 'warn' | 'bad'

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(String(res.status))
  return res.json() as Promise<T>
}
const gh = <T>(path: string) => json<T>(API + path, { headers: { Accept: 'application/vnd.github+json' } })
const orNull = <T>(p: Promise<T>) => p.catch(() => null)

/** «17. nov.» slik datoene står i planlisten. */
function shortDate(d = new Date()): string {
  return `${d.getDate()}. ${d.toLocaleString('nb-NO', { month: 'short' }).replace('.', '')}.`
}

export async function fetchKaskjerdaStatus(): Promise<KaskjerdaStatus> {
  type Issue = { title: string; html_url: string; pull_request?: unknown }
  type Run = { status: string; conclusion: string | null; created_at: string; html_url: string }
  type Events = { events: unknown[]; meta: { updatedAt: string } }
  type Plan = { next: [string, string][]; calendar: [string, string, string, string][] }

  const [issues, runs, events, plan] = await Promise.all([
    orNull(gh<Issue[]>('/issues?state=open&per_page=50')),
    orNull(gh<{ workflow_runs: Run[] }>('/actions/workflows/oppdater.yml/runs?per_page=12')),
    orNull(json<Events>(`${SITE}/data/events.json`, { cache: 'no-store' })),
    orNull(json<Plan>(`${SITE}/data/status.json`, { cache: 'no-store' })),
  ])
  if (!issues && !runs && !events && !plan) throw new Error('Fikk ikke kontakt')

  const today = shortDate()
  return {
    alerts: issues && issues.filter((i) => !i.pull_request && /tilsyn/i.test(i.title)).map((i) => ({ title: i.title, url: i.html_url })),
    runs:
      runs &&
      runs.workflow_runs.map((r) => ({
        result: r.status !== 'completed' ? 'progress' : r.conclusion === 'success' ? 'success' : r.conclusion === 'failure' ? 'failure' : 'progress',
        at: r.created_at,
        url: r.html_url,
      })),
    events: events?.events.length ?? null,
    programAt: events?.meta.updatedAt ?? null,
    next: (plan?.next ?? []).map(([title, text]) => ({ title, text })),
    today: (plan?.calendar ?? []).filter((c) => c[0].replace('~', '').trim() === today).map((c) => ({ who: c[1], title: c[2] })),
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
