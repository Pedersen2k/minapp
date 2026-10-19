import { Calendar, Check, Clock, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDue, todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import type { Task } from '../lib/types'
import { Dot, PRIORITY_COLOR } from './ui'

interface Props {
  task: Task
  showProject?: boolean
  showDate?: boolean
}

export function TaskItem({ task, showProject = true, showDate = true }: Props) {
  const { projects, toggleTask, updateTask, deleteTask } = useStore()
  const [completing, setCompleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const project = projects.find((p) => p.id === task.projectId)
  const checked = task.done || completing
  const color = PRIORITY_COLOR[task.priority]
  const today = todayISO()
  const overdue = !task.done && task.due !== undefined && task.due < today

  const onCheck = () => {
    if (task.done) {
      setCompleting(false)
      toggleTask(task.id)
    } else {
      // Kort pause så animasjonen rekker å vises før oppgaven forsvinner.
      setCompleting(true)
      setTimeout(() => toggleTask(task.id), 450)
    }
  }

  const openDatePicker = () => {
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
      className={`group flex items-start gap-3 border-b border-line py-2.5 transition-opacity duration-300 ${
        completing && !task.done ? 'opacity-40' : ''
      }`}
    >
      <button
        onClick={onCheck}
        aria-label={checked ? 'Marker som ikke fullført' : 'Fullfør'}
        className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition hover:scale-110"
        style={{
          borderColor: color,
          background: checked ? color : `color-mix(in srgb, ${color} 10%, transparent)`,
        }}
      >
        {checked && <Check size={11} strokeWidth={3.5} className="animate-pop text-white" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={task.title}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) updateTask(task.id, { title: v })
              // Litt forsinkelse så knappene rekker å motta trykket på mobil.
              setTimeout(() => setEditing(false), 150)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full bg-transparent text-[15px] leading-snug outline-none"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className={`cursor-text text-[15px] leading-snug break-words ${checked ? 'text-faint line-through' : ''}`}
          >
            {task.title}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs empty:hidden">
          {showDate && task.due && (
            <button
              onClick={openDatePicker}
              className={`inline-flex items-center gap-1 ${overdue ? 'text-[#e5484d]' : task.due === today ? 'text-[#22a06b]' : 'text-muted'}`}
            >
              <Calendar size={12} /> {formatDue(task.due)}
            </button>
          )}
          {task.time && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Clock size={12} /> {task.time}
            </span>
          )}
          {showProject && project && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Dot color={project.color} /> {project.name}
            </span>
          )}
        </div>
      </div>

      {/* På mobil vises handlingene bare når oppgaven redigeres, for et roligere uttrykk. */}
      <div className={`relative items-center gap-0.5 transition md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 ${editing ? 'flex' : 'hidden'}`}>
        <button
          onClick={openDatePicker}
          aria-label="Endre dato"
          className="grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg"
        >
          <Calendar size={15} />
        </button>
        <button
          onClick={() => deleteTask(task.id)}
          aria-label="Slett"
          className="grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-[#e5484d]"
        >
          <Trash2 size={15} />
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          value={task.due ?? ''}
          onChange={(e) => updateTask(task.id, { due: e.target.value || undefined })}
          className="pointer-events-none absolute size-0 opacity-0"
        />
      </div>
    </li>
  )
}
