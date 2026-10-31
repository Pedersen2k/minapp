import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { todayISO } from './date'
import { uid } from './id'
import { setLabelRegistry } from './labels'
import { descendantIds } from './projects'
import { nextOccurrence } from './recurrence'
import { seedData } from './seed'
import { useSync } from './sync'
import type { AppData, Label, Page, Project, Task } from './types'

const STORAGE_KEY = 'minapp:v1'
const TRASH_DAYS = 30

type Table = keyof AppData
const TABLES: Table[] = ['projects', 'tasks', 'pages', 'labels']
type AnyItem = AppData[Table][number]

/** Slik radene så ut før en endring: id → gammel rad, eller null hvis raden er ny. */
type Snapshot = Record<Table, Map<string, AnyItem | null>>

function snapshot(before: AppData, after: AppData): Snapshot {
  const snap = {} as Snapshot
  for (const t of TABLES) {
    const changed = new Map<string, AnyItem | null>()
    const now = new Map<string, AnyItem>((after[t] as AnyItem[]).map((x) => [x.id, x]))
    for (const x of before[t] as AnyItem[]) {
      if (now.get(x.id) !== x) changed.set(x.id, x)
      now.delete(x.id)
    }
    for (const id of now.keys()) changed.set(id, null)
    snap[t] = changed
  }
  return snap
}

/** Setter bare radene endringen rørte tilbake, så det som har skjedd siden (f.eks. fra en annen enhet) beholdes. */
function restore(d: AppData, snap: Snapshot): AppData {
  const next = { ...d }
  for (const t of TABLES) {
    const changed = snap[t]
    if (!changed.size) continue
    const list = (d[t] as AnyItem[]).filter((x) => !changed.has(x.id) || changed.get(x.id))
    const ids = new Set(list.map((x) => x.id))
    const out = list.map((x) => (changed.has(x.id) ? (changed.get(x.id) as AnyItem) : x))
    for (const [id, old] of changed) if (old && !ids.has(id)) out.push(old)
    ;(next as Record<Table, AnyItem[]>)[t] = out
  }
  return next
}

/** Siste endring som kan angres. `id` endres for hver ny, så meldingen vises på nytt. */
export interface UndoInfo {
  id: number
  label: string
}

export const PROJECT_COLORS = ['#6a5ae0', '#3b82f6', '#22a06b', '#e5484d', '#f59e0b', '#ec4899', '#14b8a6', '#8b8b93']

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { labels: [], ...(JSON.parse(raw) as Partial<AppData>) } as AppData
  } catch {
    // Ødelagt eller utilgjengelig lagring – start med eksempeldata.
  }
  return seedData()
}

/** Sider som har ligget i papirkurven lenger enn 30 dager, slettes for godt. */
function purgeTrash(d: AppData): AppData {
  const limit = Date.now() - TRASH_DAYS * 86_400_000
  const pages = d.pages.filter((p) => !p.deletedAt || p.deletedAt > limit)
  return pages.length === d.pages.length ? d : { ...d, pages }
}

function useStoreValue() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignorer (privat modus o.l.)
    }
  }, [data])

  const sync = useSync(data, setData)
  setLabelRegistry(data.labels)

  // Én gang ved oppstart. Gjøres som en vanlig endring, så slettingen også synkes.
  useEffect(() => setData(purgeTrash), [])

  // --- Angre ---
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  })
  const undoSnap = useRef<Snapshot | null>(null)
  const undoSeq = useRef(0)
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null)

  /** Gjør en endring som kan angres, og viser «Angre»-meldingen. */
  const undoable = useCallback((label: string, change: (d: AppData) => AppData) => {
    setData((d) => {
      const next = change(d)
      undoSnap.current = snapshot(d, next)
      return next
    })
    setUndoInfo({ id: ++undoSeq.current, label })
  }, [])

  const undo = useCallback(() => {
    const snap = undoSnap.current
    if (!snap) return
    undoSnap.current = null
    setUndoInfo(null)
    setData((d) => restore(d, snap))
  }, [])

  const dismissUndo = useCallback(() => setUndoInfo(null), [])

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'done'>) => {
    const t: Task = { ...task, id: uid(), createdAt: Date.now(), done: false }
    setData((d) => ({ ...d, tasks: [...d.tasks, t] }))
    return t
  }, [])

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  }, [])

  const toggleTask = useCallback((id: string) => {
    const task = dataRef.current.tasks.find((t) => t.id === id)
    // Avhuking kan angres. Å ta bort avhukingen igjen er lett å rette selv.
    const apply = task && !task.done ? (fn: (d: AppData) => AppData) => undoable(`«${short(task.title)}» er fullført`, fn) : setData
    apply((d) => ({
      ...d,
      tasks: d.tasks.map((t) => {
        if (t.id !== id) return t
        // Gjentakende oppgave: flytt til neste gang i stedet for å fullføre.
        if (!t.done && t.recurrence) {
          return {
            ...t,
            due: nextOccurrence(t.due, t.recurrence, todayISO()),
            subtasks: t.subtasks?.map((s) => ({ ...s, done: false })),
          }
        }
        return { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() }
      }),
    }))
  }, [undoable])

  const deleteTask = useCallback((id: string) => {
    const task = dataRef.current.tasks.find((t) => t.id === id)
    undoable(`«${short(task?.title ?? 'Oppgaven')}» er slettet`, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
  }, [undoable])

  const addProject = useCallback((name: string, opts: { color?: string; parentId?: string } = {}) => {
    const project: Project = {
      id: uid(),
      name,
      color: opts.color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      ...(opts.parentId ? { parentId: opts.parentId } : {}),
    }
    setData((d) => ({ ...d, projects: [...d.projects, project] }))
    return project
  }, [])

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }, [])

  // Sletter prosjektet, underprosjektene og alle oppgavene i dem.
  const deleteProject = useCallback((id: string) => {
    const name = dataRef.current.projects.find((p) => p.id === id)?.name ?? 'Prosjektet'
    undoable(`«${short(name)}» er slettet`, (d) => {
      const gone = new Set([id, ...descendantIds(d.projects, id)])
      return {
        ...d,
        projects: d.projects.filter((p) => !gone.has(p.id)),
        tasks: d.tasks.filter((t) => !t.projectId || !gone.has(t.projectId)),
      }
    })
  }, [undoable])

  /** Setter farge på en etikett (lager innstillingen hvis den ikke finnes). */
  const setLabelColor = useCallback((name: string, color: string) => {
    setData((d) => {
      const existing = d.labels.find((l) => l.name === name)
      const labels: Label[] = existing
        ? d.labels.map((l) => (l.name === name ? { ...l, color } : l))
        : [...d.labels, { id: uid(), name, color }]
      return { ...d, labels }
    })
  }, [])

  /** Gir etiketten nytt navn på alle oppgaver. Finnes det nye navnet fra før, slås de sammen. */
  const renameLabel = useCallback((from: string, to: string) => {
    if (!to || from === to) return
    setData((d) => {
      const target = d.labels.find((l) => l.name === to)
      const labels = target ? d.labels.filter((l) => l.name !== from) : d.labels.map((l) => (l.name === from ? { ...l, name: to } : l))
      const tasks = d.tasks.map((t) =>
        t.labels?.includes(from) ? { ...t, labels: [...new Set(t.labels.map((l) => (l === from ? to : l)))] } : t,
      )
      return { ...d, labels, tasks }
    })
  }, [])

  /** Fjerner etiketten fra alle oppgaver. Oppgavene beholdes. */
  const deleteLabel = useCallback((name: string) => {
    undoable(`Etiketten «${short(name)}» er fjernet`, (d) => ({
      ...d,
      labels: d.labels.filter((l) => l.name !== name),
      tasks: d.tasks.map((t) => {
        if (!t.labels?.includes(name)) return t
        const rest = t.labels.filter((l) => l !== name)
        return { ...t, labels: rest.length ? rest : undefined }
      }),
    }))
  }, [undoable])

  const addPage = useCallback(() => {
    const page: Page = { id: uid(), title: '', icon: '📄', blocks: [{ id: uid(), type: 'p', text: '' }], updatedAt: Date.now() }
    setData((d) => ({ ...d, pages: [...d.pages, page] }))
    return page
  }, [])

  const updatePage = useCallback((id: string, patch: Partial<Page>) => {
    setData((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }))
  }, [])

  /** Flytter siden til papirkurven. Den slettes for godt etter 30 dager. */
  const deletePage = useCallback((id: string) => {
    const title = dataRef.current.pages.find((p) => p.id === id)?.title || 'Uten tittel'
    undoable(`«${short(title)}» er lagt i papirkurven`, (d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === id ? { ...p, deletedAt: Date.now() } : p)),
    }))
  }, [undoable])

  const restorePage = useCallback((id: string) => {
    setData((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, deletedAt: undefined } : p)) }))
  }, [])

  /** Sletter sider i papirkurven for godt (alle hvis ingen id gis). Kan også angres. */
  const purgePages = useCallback((ids?: string[]) => {
    const gone = (p: Page) => !!p.deletedAt && (!ids || ids.includes(p.id))
    const n = dataRef.current.pages.filter(gone).length
    if (!n) return
    undoable(n === 1 ? 'Siden er slettet for godt' : `${n} sider er slettet for godt`, (d) => ({ ...d, pages: d.pages.filter((p) => !gone(p)) }))
  }, [undoable])

  /** Erstatter alt med innholdet i en sikkerhetskopi. Kan angres. */
  const replaceAll = useCallback((backup: AppData) => {
    undoable('Sikkerhetskopien er gjenopprettet', () => ({ ...backup, labels: backup.labels ?? [] }))
  }, [undoable])

  return useMemo(
    () => ({ ...data, sync, addTask, updateTask, toggleTask, deleteTask, addProject, updateProject, deleteProject, addPage, updatePage, deletePage, restorePage, purgePages, replaceAll, setLabelColor, renameLabel, deleteLabel, undoInfo, undo, dismissUndo }),
    [data, sync, addTask, updateTask, toggleTask, deleteTask, addProject, updateProject, deleteProject, addPage, updatePage, deletePage, restorePage, purgePages, replaceAll, setLabelColor, renameLabel, deleteLabel, undoInfo, undo, dismissUndo],
  )
}

const short = (s: string) => (s.length > 40 ? `${s.slice(0, 38)}…` : s)

type Store = ReturnType<typeof useStoreValue>

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore må brukes inne i StoreProvider')
  return s
}
