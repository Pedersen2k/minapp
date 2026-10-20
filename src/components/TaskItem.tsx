import { Calendar, Check, Clock, ListChecks, Repeat, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDue, todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import type { Task } from '../lib/types'
import { useOpenTask } from '../lib/ui-context'
import { Dot, PRIORITY_COLOR } from './ui'

interface Props {
  task: Task
  showProject?: boolean
  showDate?: boolean
}

export function TaskCheckbox({ task, checked, onClick, size = 20 }: { task: Task; checked: boolean; onClick: () => void; size?: number }) {
  const color = PRIORITY_COLOR[task.priority]
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={checked ? 'Marker som ikke fullført' : 'Fullfør'}
      className="mt-px grid shrink-0 place-items-center rounded-full border-2 transition hover:scale-110"
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: checked ? color : `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {checked && <Check size={size * 0.55} strokeWidth={3.5} className="animate-pop text-white" />}
    </button>
  )
}

/** Håndterer avhuking med en kort animasjon før oppgaven forsvinner eller flyttes. */
export function useCompleteTask(task: Task) {
  const { toggleTask } = useStore()
  const [completing, setCompleting] = useState(false)
  const complete = () => {
    if (task.done) {
      toggleTask(task.id)
      return
    }
    setCompleting(true)
    setTimeout(() => {
      toggleTask(task.id)
      setCompleting(false)
    }, 450)
  }
  return { checked: task.done || completing, completing, complete }
}

export function TaskItem({ task, showProject = true, showDate = true }: Props) {
  const { projects, updateTask, deleteTask } = useStore()
  const openTask = useOpenTask()
  const { checked, completing, complete } = useCompleteTask(task)
  const dateRef = useRef<HTMLInputElement>(null)
  const project = projects.find((p) => p.id === task.projectId)
  const today = todayISO()
  const overdue = !task.done && task.due !== undefined && task.due < today
  const subtasks = task.subtasks ?? []
  const subDone = subtasks.filter((s) => s.done).length

  const openDatePicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = dateRef.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }

  return (
    <li
      onClick={() => openTask(task.id)}
      className={`group flex cursor-pointer items-start gap-3 rounded-2xl border border-glass-border px-4 py-3 transition-all duration-300 hover:bg-card-hover ${
        completing && !task.done ? 'scale-[0.98] opacity-40' : ''
      } ${overdue ? '' : 'bg-card'}`}
      style={overdue ? { background: 'color-mix(in srgb, #e5484d 9%, var(--card))' } : undefined}
    >
      <TaskCheckbox task={task} checked={checked} onClick={complete} />

      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug break-words ${checked ? 'text-faint line-through' : ''}`}>{task.title}</p>
        {task.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{task.notes}</p>}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs empty:hidden">
          {showDate && task.due && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-[#e5484d]' : task.due === today ? 'text-[#22a06b]' : 'text-muted'}`}>
              <Calendar size={12} /> {formatDue(task.due)}
              {task.recurrence && <Repeat size={11} className="ml-0.5" />}
            </span>
          )}
          {!showDate && task.recurrence && (
            <span className="inline-flex items-center text-muted">
              <Repeat size={12} />
            </span>
          )}
          {task.time && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Clock size={12} /> {task.time}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className={`inline-flex items-center gap-1 ${subDone === subtasks.length ? 'text-[#22a06b]' : 'text-muted'}`}>
              <ListChecks size={12} /> {subDone}/{subtasks.length}
            </span>
          )}
          {showProject && project && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Dot color={project.color} /> {project.name}
            </span>
          )}
        </div>
      </div>

      {/* Hurtighandlinger ved hover på PC. På mobil brukes detaljpanelet. */}
      <div className="relative hidden items-center gap-0.5 transition md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <button onClick={openDatePicker} aria-label="Endre dato" className="grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
          <Calendar size={15} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteTask(task.id)
          }}
          aria-label="Slett"
          className="grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-[#e5484d]"
        >
          <Trash2 size={15} />
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          value={task.due ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateTask(task.id, { due: e.target.value || undefined })}
          className="pointer-events-none absolute size-0 opacity-0"
        />
      </div>
    </li>
  )
}
