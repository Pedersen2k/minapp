/**
 * Appen kan åpnes med parametere i adressen:
 * - fra snarveiene på app-ikonet (manifest «shortcuts»): ?action=new eller ?action=page
 * - fra «Del» i en annen app (manifest «share_target»): ?title=…&text=…&url=…
 *   (Dette virker også fra en iOS-snarvei som åpner adressen.)
 * Parameterne leses én gang og fjernes, så de ikke gjentas ved oppdatering.
 */

export type Launch =
  | { kind: 'new-task' }
  | { kind: 'new-page' }
  | { kind: 'share'; task: { title: string; notes?: string } }

const URL_RE = /https?:\/\/\S+/

let handled = false

export function readLaunch(): Launch | null {
  if (handled) return null
  handled = true
  const q = new URLSearchParams(location.search)
  if (![...q.keys()].length) return null
  history.replaceState(null, '', location.pathname + location.hash)

  const action = q.get('action')
  if (action === 'new') return { kind: 'new-task' }
  if (action === 'page') return { kind: 'new-page' }
  return shared(q.get('title') ?? '', q.get('text') ?? '', q.get('url') ?? '')
}

/** Mange apper legger lenken i «text» og lar «url» stå tom. */
export function shared(title: string, text: string, url: string): Launch | null {
  title = title.trim()
  text = text.trim()
  url = url.trim() || text.match(URL_RE)?.[0] || ''
  const rest = text.replace(url, '').trim()
  let name = title || rest.split('\n')[0].trim()
  if (!name && url) {
    try {
      name = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      name = url
    }
  }
  if (!name) return null
  const notes = [url, rest && rest !== name ? rest : ''].filter(Boolean).join('\n\n')
  return { kind: 'share', task: { title: name.slice(0, 200), ...(notes ? { notes } : {}) } }
}
