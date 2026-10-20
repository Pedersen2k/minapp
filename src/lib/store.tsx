import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { todayISO } from './date'
import { uid } from './id'
import { descendantIds } from './projects'
import { nextOccurrence } from './recurrence'
import { seedData } from './seed'
import { useSync } from './sync'
import type { AppData, Page, Project, Task } from './types'

const STORAGE_KEY = 'minapp:v1'

export const PROJECT_COLORS = ['#6a5ae0', '#3b82f6', '#22a06b', '#e5484d', '#f59e0b', '#ec4899', '#14b8a6', '#8b8b93']

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    // Ødelagt eller utilgjengelig lagring – start med eksempeldata.
  }
  return seedData()
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

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'done'>) => {
    const t: Task = { ...task, id: uid(), createdAt: Date.now(), done: false }
    setData((d) => ({ ...d, tasks: [...d.tasks, t] }))
    return t
  }, [])

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  }, [])

  const toggleTask = useCallback((id: string) => {
    setData((d) => ({
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
  }, [])

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
  }, [])

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
    setData((d) => {
      const gone = new Set([id, ...descendantIds(d.projects, id)])
      return {
        ...d,
        projects: d.projects.filter((p) => !gone.has(p.id)),
        tasks: d.tasks.filter((t) => !t.projectId || !gone.has(t.projectId)),
      }
    })
  }, [])

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

  const deletePage = useCallback((id: string) => {
    setData((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== id) }))
  }, [])

  return useMemo(
    () => ({ ...data, sync, addTask, updateTask, toggleTask, deleteTask, addProject, updateProject, deleteProject, addPage, updatePage, deletePage }),
    [data, sync, addTask, updateTask, toggleTask, deleteTask, addProject, updateProject, deleteProject, addPage, updatePage, deletePage],
  )
}

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
