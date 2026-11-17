// Minapp: gjør varsler om tilsyn på kaskjerda.no til oppgaver.
//
// Kalles hvert 15. minutt av en planlagt jobb (pg_cron) med hodet x-cron-secret. Henter
// GitHub-issues i Pedersen2k/skjer-i-alesund med «tilsyn» i tittelen:
// - åpne issues blir oppgaver i I dag (én per issue, fast id, så de aldri lages to ganger).
//   Klokkeslettet settes til nå, så send-reminders sender push-varsel med en gang.
// - issues som er lukket, hukes av i Minapp.
//
// Hemmeligheter (Edge Functions → Secrets): CRON_SECRET. Valgfritt: MINAPP_USER_ID (ellers
// brukes den eneste brukeren i prosjektet) og GITHUB_TOKEN (høyere grense hos GitHub).

import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const REPO = 'Pedersen2k/skjer-i-alesund'
const LABEL = 'kaskjerda'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Issue {
  number: number
  title: string
  body: string | null
  html_url: string
  created_at: string
  pull_request?: unknown
}

async function issues(state: 'open' | 'closed'): Promise<Issue[]> {
  const since = state === 'closed' ? `&since=${new Date(Date.now() - 7 * 86_400_000).toISOString()}` : ''
  const token = Deno.env.get('GITHUB_TOKEN')
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues?state=${state}&per_page=50${since}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'minapp', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`GitHub svarte ${res.status}`)
  return ((await res.json()) as Issue[]).filter((i) => !i.pull_request && /tilsyn/i.test(i.title))
}

/** Fast oppgave-id per issue (UUID laget av en SHA-1-hash), så samme issue alltid gir samme oppgave. */
async function taskId(issue: number): Promise<string> {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${REPO}#${issue}`)))]
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

/** Kort tittel fra første linje i issue-teksten: «Sjekk kategorien på nye arrangementer». */
function shortTitle(i: Issue): string {
  const line = (i.body ?? '')
    .split('\n')
    .map((l) => l.replace(/[#*_`>]/g, '').trim())
    .find((l) => l.length > 0)
  const cut = line?.split(/\s\(|:\s/)[0].trim()
  const text = cut && cut.length <= 90 ? cut : cut ? `${cut.slice(0, 87)}…` : i.title
  return `Kaskjerda: ${text}`
}

/** Dato og klokkeslett nå i Norge. */
function osloNow(): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

async function userId(): Promise<string> {
  const fixed = Deno.env.get('MINAPP_USER_ID')
  if (fixed) return fixed
  const { data, error } = await db.auth.admin.listUsers({ perPage: 2 })
  if (error) throw error
  if (data.users.length !== 1) throw new Error('Sett MINAPP_USER_ID når prosjektet har flere brukere')
  return data.users[0].id
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'Ingen tilgang' }, 403)

  try {
    const [open, closed, user] = await Promise.all([issues('open'), issues('closed'), userId()])
    const now = osloNow()

    // Nye oppgaver. Finnes oppgaven fra før (også om den er huket av), røres den ikke.
    const rows = await Promise.all(
      open.map(async (i) => ({
        id: await taskId(i.number),
        user_id: user,
        title: shortTitle(i),
        notes: `${(i.body ?? '').trim().slice(0, 1500)}\n\n${i.html_url}`,
        due: now.date,
        time: now.time,
        priority: 2,
        labels: [LABEL],
        remind_at: new Date().toISOString(),
      })),
    )
    let created = 0
    if (rows.length) {
      const { data, error } = await db.from('tasks').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id')
      if (error) throw error
      created = data?.length ?? 0
    }

    // Lukkede issues: huk av oppgavene som fortsatt står åpne.
    let completed = 0
    if (closed.length) {
      const ids = await Promise.all(closed.map((i) => taskId(i.number)))
      const stamp = new Date().toISOString()
      const { data, error } = await db
        .from('tasks')
        .update({ done: true, completed_at: stamp, updated_at: stamp })
        .in('id', ids)
        .eq('done', false)
        .select('id')
      if (error) throw error
      completed = data?.length ?? 0
    }

    return json({ open: open.length, created, completed })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
