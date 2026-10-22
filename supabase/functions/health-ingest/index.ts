// Minapp: tar imot helsedata fra en iOS-snarvei (Apple Helse) og lagrer én rad per dag.
//
// Kalles med POST og hodet x-health-key. Kroppen er JSON, alle felt er valgfrie, og bare
// feltene som sendes oppdateres (så flere snarveier kan fylle ut hver sin del):
//   { "day": "2026-10-22", "steps": 8421, "active_kcal": 512, "exercise_min": 34,
//     "distance_km": 6.3, "sleep_h": 7.4, "resting_hr": 58, "weight_kg": 81.2 }
//
// Hemmeligheter (Edge Functions → Secrets): HEALTH_KEY (lang tilfeldig streng) og
// HEALTH_USER_ID (din bruker-id fra Authentication → Users). Deployes med --no-verify-jwt.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// feltnavn (= kolonnenavn) -> [største tillatte verdi, antall desimaler]
const FIELDS: Record<string, [number, number]> = {
  steps: [200_000, 0],
  active_kcal: [20_000, 0],
  exercise_min: [1_440, 0],
  distance_km: [500, 2],
  sleep_h: [24, 2],
  resting_hr: [250, 0],
  weight_kg: [500, 1],
}

/** Snarveier sender ofte tall som tekst, gjerne med komma som desimaltegn. */
function toNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const osloToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date())

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Bruk POST' }, 405)
  const key = Deno.env.get('HEALTH_KEY')
  if (!key || req.headers.get('x-health-key') !== key) return json({ error: 'Ingen tilgang' }, 403)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'Ugyldig JSON' }, 400)

  const day = body.day ?? osloToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'Ugyldig dato (bruk ÅÅÅÅ-MM-DD)' }, 400)

  const row: Record<string, unknown> = { user_id: Deno.env.get('HEALTH_USER_ID'), day, updated_at: new Date().toISOString() }
  for (const [field, [max, decimals]] of Object.entries(FIELDS)) {
    if (body[field] === undefined || body[field] === null || body[field] === '') continue
    const n = toNumber(body[field])
    if (n === null || n < 0 || n > max) return json({ error: `Ugyldig verdi for ${field}` }, 400)
    row[field] = Number(n.toFixed(decimals))
  }

  const { error } = await db.from('health_days').upsert(row)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, day })
})
