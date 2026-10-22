import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface HealthDay {
  day: string
  steps: number | null
  active_kcal: number | null
  exercise_min: number | null
  distance_km: number | null
  sleep_h: number | null
  resting_hr: number | null
  weight_kg: number | null
  updated_at: string
}

const CACHE_KEY = 'minapp:health'
const DAYS = 7

function cached(): HealthDay[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as HealthDay[]
  } catch {
    return []
  }
}

/** De siste dagene med helsedata (nyeste først), med lokal kopi så kortet virker uten nett. */
export function useHealth() {
  const [days, setDays] = useState<HealthDay[]>(cached)
  const [loaded, setLoaded] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    const load = () =>
      supabase!
        .from('health_days')
        .select('day, steps, active_kcal, exercise_min, distance_km, sleep_h, resting_hr, weight_kg, updated_at')
        .order('day', { ascending: false })
        .limit(DAYS)
        .then(({ data }) => {
          if (data) {
            setDays(data as HealthDay[])
            localStorage.setItem(CACHE_KEY, JSON.stringify(data))
          }
          setLoaded(true)
        })
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return { days, loaded }
}
