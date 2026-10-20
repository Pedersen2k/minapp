// Minapp: sender påminnelser som varsler (web push).
//
// Kalles hvert minutt av en planlagt jobb (pg_cron) med hodet x-cron-secret, og sender varsel
// for oppgaver der remind_at er passert og det ikke er varslet ennå. Appen kan også kalle den
// med { "test": true } og brukerens innloggingstoken for å sende et testvarsel.
//
// Hemmeligheter (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
// SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY finnes automatisk.

import { createClient } from 'npm:@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

webpush.setVapidDetails(
  'https://github.com/Pedersen2k/minapp',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Payload {
  title: string
  body: string
  url: string
  tag?: string
}

/** Sender til alle enhetene til en bruker. Abonnement som er utløpt (404/410) slettes. */
async function sendToUser(userId: string, payload: Payload): Promise<number> {
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 60 * 60,
      })
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('Kunne ikke sende varsel', status, err)
    }
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))

  // Testvarsel fra appen: må være innlogget.
  if (body.test) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: 'Ikke innlogget' }, 401)
    const sent = await sendToUser(data.user.id, { title: 'Minapp', body: 'Varsler virker! Du får beskjed når oppgaver nærmer seg.', url: '/' })
    return json({ sent })
  }

  // Planlagt kjøring.
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'Ingen tilgang' }, 403)

  const now = new Date()
  // Varsler som er mer enn en time forsinket (f.eks. etter nedetid) hoppes over.
  const since = new Date(now.getTime() - 60 * 60 * 1000)
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, user_id, title, notes, time, remind_at, reminded_at')
    .eq('done', false)
    .lte('remind_at', now.toISOString())
    .gte('remind_at', since.toISOString())
  if (error) return json({ error: error.message }, 500)

  const pending = (tasks ?? []).filter((t) => !t.reminded_at || t.reminded_at < t.remind_at)
  for (const t of pending) {
    const detail = [t.time && `Kl ${t.time}`, t.notes].filter(Boolean).join(' · ')
    await sendToUser(t.user_id, { title: t.title, body: detail || 'Påminnelse', url: `/#/today?t=${t.id}`, tag: t.id })
    await db.from('tasks').update({ reminded_at: now.toISOString() }).eq('id', t.id)
  }
  return json({ sent: pending.length })
})
