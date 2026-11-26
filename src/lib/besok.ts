import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Besøkstall fra GoatCounter, hentet av Edge Function «goatcounter-stats» (nøkkelen ligger på serversiden). */
export interface Besok {
  days: string[] // YYYY-MM-DD, eldste først, siste er i går
  views: number[]
  today: number // så langt i dag
  hourly: number[] // lokal tid, 24 tall
  pages: { path: string; count: number }[]
  browsers: { name: string; count: number }[]
  countries: { name: string; count: number }[]
  total: number
  fetchedAt: number
}

/** 'ready' har tall, 'setup' mangler nøkkel på serveren, 'error' fikk ikke svar, 'off' kjører uten Supabase. */
export type BesokState = 'loading' | 'ready' | 'setup' | 'error' | 'off'

const CACHE = 'minapp:besok'
const STALE_MS = 30 * 60 * 1000 // tallene er daglige, så en halvtime er mer enn nok

function cached(): Besok | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? 'null') as Besok | null
  } catch {
    return null
  }
}

export function useBesok() {
  const [data, setData] = useState<Besok | null>(cached)
  const [state, setState] = useState<BesokState>(cached() ? 'ready' : supabase ? 'loading' : 'off')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: res, error } = await supabase.functions.invoke('goatcounter-stats')
    if (error || !res) return setState((s) => (s === 'ready' ? s : 'error'))
    if (res.configured === false) return setState('setup')
    if (res.error) return setState((s) => (s === 'ready' ? s : 'error'))
    setData(res as Besok)
    setState('ready')
    try {
      localStorage.setItem(CACHE, JSON.stringify(res))
    } catch {
      /* full lagring er ikke kritisk */
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const tick = () => {
      if (document.visibilityState === 'visible' && Date.now() - (cached()?.fetchedAt ?? 0) > STALE_MS) load()
    }
    tick()
    const t = window.setInterval(tick, 5 * 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  return { data: state === 'setup' ? null : data, state }
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

/** Siste 7 dager mot de 7 før, i prosent (null når det ikke finnes noe å sammenligne med). */
export function weekChange(views: number[]): { now: number; prev: number; pct: number | null } {
  const now = sum(views.slice(-7))
  const prev = sum(views.slice(-14, -7))
  return { now, prev, pct: prev ? Math.round(((now - prev) / prev) * 100) : null }
}

const COUNTRY: Record<string, string> = { Norway: 'Norge', 'United States': 'USA', Sweden: 'Sverige', Denmark: 'Danmark', Germany: 'Tyskland', 'United Kingdom': 'Storbritannia' }
export const countryName = (n: string) => COUNTRY[n] ?? n

/** «/arrangement/…» er en enkeltside per arrangement og leses best samlet. */
export const pageLabel = (path: string) => (path === '/' ? 'Forsiden' : path.startsWith('/arrangement/') ? 'Enkeltarrangementer' : path)
