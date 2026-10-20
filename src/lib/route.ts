import { useCallback, useEffect, useRef, useState } from 'react'
import type { View } from './types'

interface Route {
  view: View
  taskId: string | null
}

// Format: #/today, #/project/<id>, #/page/<id>, med valgfri ?t=<oppgave-id> for åpent detaljpanel.
function parseHash(hash: string): Route {
  const [path, query] = hash.replace(/^#/, '').split('?')
  const [, kind, id] = path.split('/')
  const taskId = new URLSearchParams(query).get('t')
  let view: View = { type: 'today' }
  if (kind === 'project' && id) view = { type: 'project', id }
  else if (kind === 'page' && id) view = { type: 'page', id }
  else if (kind === 'label' && id) view = { type: 'label', name: decodeURIComponent(id) }
  else if (kind === 'inbox' || kind === 'upcoming' || kind === 'calendar') view = { type: kind }
  return { view, taskId }
}

export function viewToHash(v: View): string {
  if (v.type === 'project' || v.type === 'page') return `#/${v.type}/${v.id}`
  if (v.type === 'label') return `#/label/${encodeURIComponent(v.name)}`
  return `#/${v.type}`
}

/** Visning og åpen oppgave lagres i URL-en, så tilbake-knappen/-sveipet fungerer på mobil. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  const openedInApp = useRef(false)

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((v: View) => {
    openedInApp.current = false
    location.hash = viewToHash(v)
  }, [])

  const openTask = useCallback((id: string) => {
    const base = viewToHash(parseHash(location.hash).view)
    if (parseHash(location.hash).taskId) {
      // Bytt oppgave uten å lage et nytt steg i historikken.
      history.replaceState(null, '', `${base}?t=${id}`)
      setRoute(parseHash(location.hash))
    } else {
      openedInApp.current = true
      location.hash = `${base}?t=${id}`
    }
  }, [])

  const closeTask = useCallback(() => {
    if (!parseHash(location.hash).taskId) return
    if (openedInApp.current) {
      openedInApp.current = false
      history.back()
    } else {
      history.replaceState(null, '', viewToHash(parseHash(location.hash).view))
      setRoute(parseHash(location.hash))
    }
  }, [])

  return { view: route.view, taskId: route.taskId, navigate, openTask, closeTask }
}
