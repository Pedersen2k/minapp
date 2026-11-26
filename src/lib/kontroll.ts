import { useCallback, useEffect, useState } from 'react'
import { fetchKaskjerdaStatus, type KaskjerdaStatus } from './kaskjerda'
import { fetchPowerPrices, type PowerPrices } from './power'
import type { Task } from './types'

/** Datagrunnlag til kontrollvisningen i «Min dag». */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Antall fullførte oppgaver per dag, eldste først, siste tall er i dag. */
export function doneByDay(tasks: Task[], days: number): number[] {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.done && t.completedAt) {
      const k = dayKey(new Date(t.completedAt))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const out: number[] = []
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    out.push(counts.get(dayKey(d)) ?? 0)
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Aktivitetsrute: uker (eldste først) med sju dager hver, mandag først. -1 = dag som ikke har kommet. */
export function heatWeeks(tasks: Task[], weeks: number): number[][] {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.done && t.completedAt) {
      const k = dayKey(new Date(t.completedAt))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - (weeks - 1) * 7)
  const out: number[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: number[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      col.push(day > now ? -1 : (counts.get(dayKey(day)) ?? 0))
    }
    out.push(col)
  }
  return out
}

/** Datoetiketter for aksen under en graf over de siste `days` dagene. `endsAgo` er hvor mange dager siden siste punkt er (0 = i dag, 1 = i går). */
export function dayLabels(days: number, endsAgo = 0): { i: number; text: string }[] {
  const idx = [0, 0.25, 0.5, 0.75].map((f) => Math.round((days - 1) * f))
  const last = endsAgo === 0 ? 'i dag' : endsAgo === 1 ? 'i går' : dayText(endsAgo)
  return [...idx.map((i) => ({ i, text: dayText(days - 1 - i + endsAgo) })), { i: days - 1, text: last }]
}

function dayText(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }).replace('.', '')
}

/* ---------- Eksterne kilder (samme hurtigbuffer som kortene i kortvisningen) ---------- */

const KS_CACHE = 'minapp:kaskjerda-v2'
const KS_STALE_MS = 10 * 60 * 1000 // GitHub tillater 60 oppslag i timen uten innlogging
const KS_TRY = 'minapp:kaskjerda-try'
const POWER_CACHE = 'minapp:power'

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

/** Status for kaskjerda.no. `error` er sann når siste forsøk ikke fikk svar. */
export function useKaskjerda() {
  const [status, setStatus] = useState<KaskjerdaStatus | null>(() => read<KaskjerdaStatus>(KS_CACHE))
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchKaskjerdaStatus()
      .then((s) => {
        setStatus(s)
        setError(false)
        try {
          localStorage.setItem(KS_CACHE, JSON.stringify(s))
        } catch {
          /* full lagring er ikke kritisk */
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      // Også etter en feil venter vi før neste forsøk: GitHub stenger ute etter 60 oppslag i timen.
      const last = Math.max(read<KaskjerdaStatus>(KS_CACHE)?.fetchedAt ?? 0, Number(sessionStorage.getItem(KS_TRY) ?? 0))
      if (Date.now() - last > KS_STALE_MS) {
        sessionStorage.setItem(KS_TRY, String(Date.now()))
        load()
      }
    }
    tick()
    const t = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  return { status, error, loading, reload: load }
}

/** Strømpriser for i dag. Hentes én gang per dag. */
export function usePower() {
  const today = new Date().toDateString()
  const cached = read<{ day: string; data: PowerPrices }>(POWER_CACHE)
  const [prices, setPrices] = useState<PowerPrices | null>(cached?.day === today ? cached.data : null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (read<{ day: string }>(POWER_CACHE)?.day === today) return
    fetchPowerPrices()
      .then((data) => {
        setPrices(data)
        localStorage.setItem(POWER_CACHE, JSON.stringify({ day: today, data }))
      })
      .catch(() => setError(true))
  }, [today])

  return { prices, error }
}
