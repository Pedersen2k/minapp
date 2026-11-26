// Minapp: henter besøkstall fra GoatCounter til kontrollvisningen i «Min dag».
//
// Kalles fra appen av en innlogget bruker (Supabase sjekker innloggingen, så uten gyldig
// innlogging kommer ingen inn). API-nøkkelen ligger på serversiden og når aldri nettleseren.
//
// Hemmeligheter (Edge Functions → Secrets):
// - GOATCOUNTER_TOKEN: API-nøkkel fra GoatCounter (Innstillinger → API) med lesetilgang.
// - GOATCOUNTER_SITE: delen foran .goatcounter.com, for eksempel «kaskjerda». Valgfri, standard «kaskjerda».
//
// Svar: { configured: false } når nøkkelen mangler, ellers tall for de siste 28 hele dagene.

const SITE = Deno.env.get('GOATCOUNTER_SITE') ?? 'kaskjerda'
const DAYS = 28

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function gc<T>(path: string, query: Record<string, string>, token: string): Promise<T> {
  const url = `https://${SITE}.goatcounter.com/api/v0/${path}?${new URLSearchParams(query)}`
  // redirect: 'manual' fordi GoatCounter sender ukjente nøkler til innloggingssiden (HTML), og da ville vi bare fått en uforståelig lesefeil.
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'manual' })
  console.log(`goatcounter ${path} -> ${res.status} ${res.headers.get('content-type') ?? 'ingen type'}`)
  if (res.status >= 300 && res.status < 400) throw new Error(`GoatCounter godtok ikke nøkkelen (sendte til innlogging, status ${res.status}). Lag en ny nøkkel med «Read statistics» og legg den inn på nytt.`)
  if (res.status === 401 || res.status === 403) throw new Error(`GoatCounter godtok ikke nøkkelen (status ${res.status}). Sjekk at den har «Read statistics».`)
  if (!res.ok) throw new Error(`GoatCounter svarte ${res.status} på ${path}`)
  // Leser som tekst og prøver JSON uansett content-type; ved feil tas starten av svaret med i meldingen.
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`GoatCounter svarte ikke med tall (${res.status}, ${res.headers.get('content-type') ?? 'ingen type'}) på ${path}: ${text.replace(/\s+/g, ' ').slice(0, 80)}`)
  }
}

/** Timer foran UTC i Norge akkurat nå (1 om vinteren, 2 om sommeren). */
function osloOffset(): number {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Oslo' }).format(new Date()))
  return (h - new Date().getUTCHours() + 24) % 24
}

const startOfDayUtc = (daysAgo: number) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Fjerner mellomrom, linjeskift og anførselstegn som lett følger med når nøkkelen limes inn.
  const token = Deno.env.get('GOATCOUNTER_TOKEN')?.trim().replace(/^["']|["']$/g, '')
  if (!token) return json({ configured: false })

  try {
    const start = startOfDayUtc(DAYS)
    const end = startOfDayUtc(0) // til og med i går: en halv dag i dag ville sett ut som et fall
    const range = { start, end }
    const [total, today, hits, browsers, locations] = await Promise.all([
      gc<{ total: number; stats: { day: string; daily: number; hourly: number[] }[] }>('stats/total', range, token),
      gc<{ total: number }>('stats/total', { start: end, end: new Date().toISOString() }, token),
      gc<{ hits: { path: string; count: number }[] }>('stats/hits', { ...range, limit: '8' }, token),
      gc<{ stats: { name: string; count: number }[] }>('stats/browsers', { ...range, limit: '5' }, token),
      gc<{ stats: { name: string; count: number }[] }>('stats/locations', { ...range, limit: '5' }, token),
    ])

    // GoatCounter tar med selve sluttdagen (i dag, med 0), den skal ikke være med i grafen.
    const stats = total.stats.filter((s) => s.day < end.slice(0, 10)).slice(-DAYS)
    const offset = osloOffset()
    const hourly = Array<number>(24).fill(0)
    for (const day of stats) day.hourly.forEach((n, h) => (hourly[(h + offset) % 24] += n))

    return json({
      configured: true,
      fetchedAt: Date.now(),
      days: stats.map((s) => s.day),
      views: stats.map((s) => s.daily),
      today: today.total,
      hourly, // lokal tid
      pages: hits.hits.filter((h) => h.path.startsWith('/')).slice(0, 5).map((h) => ({ path: h.path, count: h.count })),
      browsers: browsers.stats.filter((b) => b.name).map((b) => ({ name: b.name, count: b.count })),
      countries: locations.stats.filter((l) => l.name).map((l) => ({ name: l.name, count: l.count })),
      total: total.total,
    })
  } catch (e) {
    console.error('goatcounter-stats feilet:', e instanceof Error ? e.message : e)
    return json({ configured: true, error: e instanceof Error ? e.message : 'Ukjent feil' })
  }
})
