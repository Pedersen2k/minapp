import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Shortcut {
  id: string
  name: string
  url: string
}

export interface Settings {
  gmailScriptUrl?: string
  gmailKey?: string
  weather?: { name: string; lat: number; lon: number }
  notes?: string
  shortcuts?: Shortcut[]
  dashboard?: DashboardLayout
}

/** Brukerens oppsett av «Min dag»: rekkefølge, skjulte kort og størrelse per kort. */
export interface DashboardLayout {
  order: string[]
  hidden: string[]
  sizes: Record<string, 'small' | 'wide'>
}

export const DEFAULT_WEATHER = { name: 'Ålesund', lat: 62.4723, lon: 6.1549 }

const CACHE_KEY = 'minapp:settings'

function cached(): Settings {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Settings
  } catch {
    return {}
  }
}

/**
 * Brukerinnstillinger i Supabase (én rad per bruker), med lokal kopi så dashboardet
 * også virker uten nett. Uten Supabase lagres de bare lokalt.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cached)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('settings')
      .select('data')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setSettings(data.data as Settings)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.data))
      })
  }, [])

  const save = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...cached(), ...patch }
    setSettings(next)
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    if (supabase) {
      const { error } = await supabase.from('settings').upsert({ data: next, updated_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
    }
  }, [])

  return { settings, save }
}
