import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useState, type ReactNode } from 'react'
import { todayISO } from './date'
import { INBOX_PATCH } from './inbox'
import { reassignTaskPositions, renumber, sortByPosition } from './order'
import { useStore } from './store'
import type { Page, Project, Task } from './types'

/**
 * Hvor en oppgaveliste hører hjemme. Å slippe en oppgave i en annen beholder endrer den:
 * en dag i Kommende gir ny dato, et prosjekt gir nytt prosjekt, osv.
 */
export type TaskContainer =
  | { kind: 'due'; date: string }
  | { kind: 'project'; id: string }
  | { kind: 'inbox' }
  | { kind: 'column'; projectId: string; columnId: string; done?: boolean }
  | { kind: 'static'; id: string } // bare omsortering, f.eks. «Forfalt» og etikettvisninger

export function containerKey(c: TaskContainer): string {
  switch (c.kind) {
    case 'due':
      return `due:${c.date}`
    case 'project':
      return `project:${c.id}`
    case 'inbox':
      return 'inbox'
    case 'column':
      return `column:${c.columnId}`
    case 'static':
      return `static:${c.id}`
  }
}

export type DragData =
  | { type: 'task'; task: Task; container: TaskContainer; items: Task[] }
  | { type: 'container'; container: TaskContainer; items: Task[] }
  | { type: 'project'; project: Project }
  | { type: 'page'; page: Page }
  | { type: 'nav'; target: 'inbox' | 'today' }

function patchFor(c: TaskContainer): Partial<Task> {
  if (c.kind === 'due') return { due: c.date }
  if (c.kind === 'project') return { projectId: c.id }
  if (c.kind === 'inbox') return INBOX_PATCH
  if (c.kind === 'column') {
    // Ferdig-kolonnen huker av; ut av den gjør oppgaven åpen igjen.
    return c.done ? { done: true, completedAt: Date.now() } : { columnId: c.columnId, done: false, completedAt: undefined }
  }
  return {}
}

// Pekeren avgjør først (treffer menyen presist); ellers største overlapp.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

export function DragProvider({ children }: { children: ReactNode }) {
  const { projects, pages, updateTask, toggleTask, updateProject, updatePage } = useStore()
  const [active, setActive] = useState<DragData | null>(null)

  // Mus: dra etter 6 px, så vanlige klikk fortsatt åpner oppgaven.
  // Berøring: hold fingeren i et kvart sekund, så scrolling ikke forveksles med dra.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    setActive((e.active.data.current as DragData) ?? null)
    navigator.vibrate?.(10)
  }

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null)
    const from = a.data.current as DragData | undefined
    const to = over?.data.current as DragData | undefined
    if (!from || !to || a.id === over?.id) return

    if (from.type === 'task') {
      const task = from.task
      if (to.type === 'project') return updateTask(task.id, { projectId: to.project.id })
      if (to.type === 'nav') return updateTask(task.id, to.target === 'inbox' ? INBOX_PATCH : { due: todayISO() })
      if (to.type !== 'task' && to.type !== 'container') return
      // Gjentakende oppgave til «Ferdig»: flytt den til neste gang i stedet for å avslutte den.
      if (to.container.kind === 'column' && to.container.done && !task.done && task.recurrence) return toggleTask(task.id)

      const sameContainer = containerKey(to.container) === containerKey(from.container)
      const list = to.items.filter((t) => t.id !== task.id)
      const overIndex = to.type === 'task' ? to.items.findIndex((t) => t.id === to.task.id) : -1
      let index = overIndex < 0 ? list.length : overIndex
      if (sameContainer) {
        const fromIndex = from.items.findIndex((t) => t.id === task.id)
        const moved = arrayMove(from.items, fromIndex, overIndex < 0 ? from.items.length - 1 : overIndex)
        index = moved.findIndex((t) => t.id === task.id)
      }
      list.splice(index, 0, task)

      const positions = reassignTaskPositions(list)
      const containerPatch = sameContainer ? {} : patchFor(to.container)
      for (const t of list) {
        const patch: Partial<Task> = t.id === task.id ? { ...containerPatch } : {}
        if (positions.has(t.id)) patch.position = positions.get(t.id)
        if (Object.keys(patch).length) updateTask(t.id, patch)
      }
      return
    }

    if (from.type === 'project' && to.type === 'project') {
      if ((from.project.parentId ?? null) !== (to.project.parentId ?? null)) return
      const siblings = sortByPosition(projects.filter((p) => (p.parentId ?? null) === (from.project.parentId ?? null)))
      const ordered = arrayMove(siblings, siblings.findIndex((p) => p.id === from.project.id), siblings.findIndex((p) => p.id === to.project.id))
      renumber(ordered).forEach((position, id) => updateProject(id, { position }))
      return
    }

    if (from.type === 'page' && to.type === 'page') {
      const list = sortByPosition(pages)
      const ordered = arrayMove(list, list.findIndex((p) => p.id === from.page.id), list.findIndex((p) => p.id === to.page.id))
      renumber(ordered).forEach((position, id) => updatePage(id, { position }))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      {children}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {active?.type === 'task' && (
          <div className="glass-strong flex rotate-[1.5deg] items-center gap-3 rounded-2xl px-4 py-3 text-[15px]">
            <span className="size-5 shrink-0 rounded-full border-2 border-accent" />
            <span className="truncate">{active.task.title}</span>
          </div>
        )}
        {active?.type === 'project' && (
          <div className="glass-strong flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: active.project.color }} />
            {active.project.name}
          </div>
        )}
        {active?.type === 'page' && (
          <div className="glass-strong flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-semibold">
            <span>{active.page.icon}</span>
            {active.page.title || 'Uten tittel'}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
