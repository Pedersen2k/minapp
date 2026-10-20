import type { Label, Task } from './types'

export const LABEL_COLORS = ['#6a5ae0', '#0ea5e9', '#22a06b', '#f59e0b', '#ec4899', '#14b8a6', '#e5484d', '#8b5cf6']

// Egendefinerte farger, oppdatert av StoreProvider før hver rendring. Holdes her så
// labelColor() kan brukes overalt uten å sende etikettlisten gjennom alle komponenter.
let customColors = new Map<string, string>()
export function setLabelRegistry(labels: Label[]) {
  customColors = new Map(labels.map((l) => [l.name, l.color]))
}

/** Etikettens farge: egendefinert, ellers en fast farge avledet av navnet. */
export function labelColor(name: string): string {
  const custom = customColors.get(name)
  if (custom) return custom
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return LABEL_COLORS[h % LABEL_COLORS.length]
}

/** Alle etiketter i bruk, med antall åpne oppgaver, sortert alfabetisk. */
export function allLabels(tasks: Task[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of tasks) for (const l of t.labels ?? []) counts.set(l, (counts.get(l) ?? 0) + (t.done ? 0 : 1))
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'no'))
}

export const normalizeLabel = (s: string) => s.trim().replace(/^@/, '').toLowerCase().replace(/\s+/g, '-')
