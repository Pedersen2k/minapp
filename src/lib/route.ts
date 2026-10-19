import { useEffect, useState } from 'react'
import type { View } from './types'

function parseHash(hash: string): View {
  const [, kind, id] = hash.replace(/^#/, '').split('/')
  if (kind === 'project' && id) return { type: 'project', id }
  if (kind === 'page' && id) return { type: 'page', id }
  if (kind === 'inbox' || kind === 'upcoming') return { type: kind }
  return { type: 'today' }
}

export function viewToHash(v: View): string {
  return v.type === 'project' || v.type === 'page' ? `#/${v.type}/${v.id}` : `#/${v.type}`
}

/** Visningen lagres i URL-en, så tilbake-knappen/-sveipet fungerer på mobil. */
export function useRoute(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => parseHash(location.hash))
  useEffect(() => {
    const onHash = () => setView(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [view, (v) => { location.hash = viewToHash(v) }]
}
