import type { Page, Project, Task } from './types'

/** Oppgavens plass i manuell rekkefølge. Uten egen verdi brukes tidspunktet den ble laget. */
export const taskOrder = (t: Task) => t.position ?? t.createdAt

export const byTaskOrder = (a: Task, b: Task) => taskOrder(a) - taskOrder(b)

/** Prosjekter og sider: egen verdi, ellers plassen i listen. */
export function sortByPosition<T extends Project | Page>(list: T[]): T[] {
  return list
    .map((item, i) => ({ item, key: item.position ?? (i + 1) * 1000 }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}

/**
 * Gir oppgavene i `ordered` stigende plasser ved å stokke om de plassverdiene de allerede har.
 * Slik beholder de sin plass i andre visninger, og bare de som faktisk flyttet seg endres.
 * Returnerer nye plassverdier for oppgavene som må oppdateres.
 */
export function reassignTaskPositions(ordered: Task[]): Map<string, number> {
  const slots = ordered.map(taskOrder).sort((a, b) => a - b)
  // Like verdier (f.eks. oppgaver laget samme millisekund) gjøres strengt stigende.
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1
  const changes = new Map<string, number>()
  ordered.forEach((t, i) => {
    if (taskOrder(t) !== slots[i]) changes.set(t.id, slots[i])
  })
  return changes
}

/** Ny rekkefølge for søsken (prosjekter/sider): 1000, 2000, 3000 … */
export function renumber<T extends { id: string; position?: number }>(ordered: T[]): Map<string, number> {
  const changes = new Map<string, number>()
  ordered.forEach((x, i) => {
    const pos = (i + 1) * 1000
    if (x.position !== pos) changes.set(x.id, pos)
  })
  return changes
}
