import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { uid } from './id'
import { seedData } from './seed'
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
      tasks: d.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() } : t,
      ),
    }))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
  }, [])

  const addProject = useCallback((name: string, color?: string) => {
    const project: Project = {
      id: uid(),
      name,
      color: color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
    }
    setData((d) => ({ ...d, projects: [...d.projects, project] }))
    return project
  }, [])

  const deleteProject = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      tasks: d.tasks.filter((t) => t.projectId !== id),
    }))
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
    () => ({ ...data, addTask, updateTask, toggleTask, deleteTask, addProject, deleteProject, addPage, updatePage, deletePage }),
    [data, addTask, updateTask, toggleTask, deleteTask, addProject, deleteProject, addPage, updatePage, deletePage],
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
