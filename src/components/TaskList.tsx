import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { containerKey, type TaskContainer } from '../lib/dnd'
import type { Task } from '../lib/types'
import { TaskItem } from './TaskItem'

/** Sorterbar oppgaveliste. Hele listen er også et slippområde, så tomme dager og prosjekter kan ta imot oppgaver. */
export function List({ tasks, container, showProject, showDate, className = '' }: { tasks: Task[]; container?: TaskContainer; showProject?: boolean; showDate?: boolean; className?: string }) {
  const key = container ? containerKey(container) : 'none'
  const { setNodeRef, isOver } = useDroppable({ id: `list:${key}`, data: { type: 'container', container, items: tasks }, disabled: !container })
  return (
    <SortableContext id={key} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={`flex flex-col gap-2 rounded-2xl transition ${className} ${tasks.length ? 'mb-2.5' : 'min-h-2'} ${isOver && !tasks.length ? 'min-h-14 bg-accent-soft' : ''}`}>
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} container={container} items={tasks} showProject={showProject} showDate={showDate} />
        ))}
      </ul>
    </SortableContext>
  )
}

