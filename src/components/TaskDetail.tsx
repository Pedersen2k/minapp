import { AtSign, Calendar, Clock, Flag, FolderOpen, Inbox, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { formatDue, MONTHS, todayISO } from '../lib/date'
import { uid } from '../lib/id'
import { allLabels, labelColor, normalizeLabel } from '../lib/labels'
import { projectTree } from '../lib/projects'
import { RECURRENCE_LABEL } from '../lib/recurrence'
import { useStore } from '../lib/store'
import type { Priority, Recurrence, Subtask, Task } from '../lib/types'
import { AutoTextarea } from './AutoTextarea'
import { TaskCheckbox, useCompleteTask } from './TaskItem'
import { Dot, PRIORITY_COLOR } from './ui'

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="flex w-32 shrink-0 items-center gap-2.5 text-sm text-muted">
        {icon}
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm">{children}</div>
    </div>
  )
}

const control =
  'rounded-xl border border-transparent bg-transparent px-2.5 py-1.5 text-sm text-fg outline-none transition hover:bg-hover focus:border-accent'

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Fjern" className="grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg">
      <X size={14} />
    </button>
  )
}

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, projects, updateTask, deleteTask } = useStore()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null
  return <Panel key={task.id} task={task} projects={projects} onClose={onClose} update={(p) => updateTask(task.id, p)} remove={() => deleteTask(task.id)} />
}

interface PanelProps {
  task: Task
  projects: ReturnType<typeof useStore>['projects']
  onClose: () => void
  update: (patch: Partial<Task>) => void
  remove: () => void
}

function Panel({ task, projects, onClose, update, remove }: PanelProps) {
  const { checked, complete } = useCompleteTask(task)
  const [newSub, setNewSub] = useState('')
  const subtasks = task.subtasks ?? []
  const project = projects.find((p) => p.id === task.projectId)
  const created = new Date(task.createdAt)

  const setSubtasks = (next: Subtask[]) => update({ subtasks: next.length ? next : undefined })
  const addSubtask = () => {
    const title = newSub.trim()
    if (!title) return
    setSubtasks([...subtasks, { id: uid(), title, done: false }])
    setNewSub('')
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Oppgavedetaljer">
      <div className="animate-fade absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="glass-strong animate-sheet absolute inset-x-2 bottom-2 flex max-h-[90dvh] flex-col rounded-[28px] md:inset-y-4 md:right-4 md:left-auto md:max-h-none md:w-[460px]">
        {/* Topplinje */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 md:px-6 md:pt-5">
          <span className="mx-auto mb-1 h-1 w-10 rounded-full bg-line md:hidden" />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 md:px-6">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
            {project ? <Dot color={project.color} /> : <Inbox size={13} />}
            {project?.name ?? 'Innboks'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (confirm('Slette denne oppgaven?')) {
                  remove()
                  onClose()
                }
              }}
              aria-label="Slett oppgave"
              className="grid size-8 place-items-center rounded-lg text-faint hover:bg-hover hover:text-[#e5484d]"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pb-safe flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          {/* Tittel og beskrivelse */}
          <div className="mt-3 flex items-start gap-3">
            <div className="pt-1.5">
              <TaskCheckbox task={task} checked={checked} onClick={complete} size={20} />
            </div>
            <AutoTextarea
              value={task.title}
              onChange={(v) => update({ title: v.replace(/\n/g, ' ') })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              onBlur={() => !task.title.trim() && update({ title: 'Uten tittel' })}
              className={`text-xl leading-8 font-semibold tracking-tight ${checked ? 'text-faint line-through' : ''}`}
            />
          </div>
          <div className="mt-1 pl-8">
            <AutoTextarea
              value={task.notes ?? ''}
              onChange={(v) => update({ notes: v || undefined })}
              placeholder="Legg til beskrivelse …"
              className="min-h-12 text-[15px] leading-6 text-fg/90"
            />
          </div>

          {/* Egenskaper */}
          <div className="mt-5 rounded-2xl border border-glass-border bg-card px-4">
            <Row icon={<Calendar size={16} />} label="Dato">
              <input type="date" value={task.due ?? ''} onChange={(e) => update({ due: e.target.value || undefined })} className={control} aria-label="Dato" />
              {task.due && <ClearButton onClick={() => update({ due: undefined, recurrence: undefined })} />}
            </Row>
            <Row icon={<Clock size={16} />} label="Klokkeslett">
              <input type="time" value={task.time ?? ''} onChange={(e) => update({ time: e.target.value || undefined })} className={control} aria-label="Klokkeslett" />
              {task.time && <ClearButton onClick={() => update({ time: undefined })} />}
            </Row>
            <Row icon={<Repeat size={16} />} label="Gjentakelse">
              <select
                value={task.recurrence ?? ''}
                onChange={(e) => {
                  const recurrence = (e.target.value || undefined) as Recurrence | undefined
                  update({ recurrence, due: recurrence && !task.due ? todayISO() : task.due })
                }}
                className={`${control} cursor-pointer text-right`}
                aria-label="Gjentakelse"
              >
                <option value="">Ingen</option>
                {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                  <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>
                ))}
              </select>
            </Row>
            <Row icon={<Flag size={16} />} label="Prioritet">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => update({ priority: p })}
                  aria-label={`Prioritet ${p}`}
                  aria-pressed={task.priority === p}
                  className={`grid size-8 place-items-center rounded-lg transition ${task.priority === p ? 'bg-hover ring-1 ring-line' : 'hover:bg-hover'}`}
                >
                  <Flag size={15} style={{ color: PRIORITY_COLOR[p] }} fill={p < 4 ? PRIORITY_COLOR[p] : 'none'} />
                </button>
              ))}
            </Row>
            <Row icon={<AtSign size={16} />} label="Etiketter">
              <LabelEditor labels={task.labels ?? []} onChange={(labels) => update({ labels: labels.length ? labels : undefined })} />
            </Row>
            <Row icon={<FolderOpen size={16} />} label="Prosjekt">
              <select
                value={task.projectId ?? ''}
                onChange={(e) => update({ projectId: e.target.value || undefined })}
                className={`${control} cursor-pointer text-right`}
                aria-label="Prosjekt"
              >
                <option value="">Innboks</option>
                {projectTree(projects).map(({ project: p, depth }) => (
                  <option key={p.id} value={p.id}>{`${'\u00a0\u00a0\u00a0'.repeat(depth)}${p.name}`}</option>
                ))}
              </select>
            </Row>
          </div>

          {/* Underoppgaver */}
          <div className="mt-7">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[13px] font-semibold">Underoppgaver</h3>
              {subtasks.length > 0 && (
                <span className="text-xs text-muted">
                  {subtasks.filter((s) => s.done).length} av {subtasks.length}
                </span>
              )}
            </div>
            {subtasks.length > 0 && (
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-accent-soft">
                <div className="bg-accent-gradient h-full rounded-full transition-all" style={{ width: `${(subtasks.filter((s) => s.done).length / subtasks.length) * 100}%` }} />
              </div>
            )}
            <ul>
              {subtasks.map((s) => (
                <li key={s.id} className="group flex items-start gap-3 py-1.5">
                  <button
                    onClick={() => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                    aria-label={s.done ? 'Marker som ikke fullført' : 'Fullfør underoppgave'}
                    className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] transition ${s.done ? 'border-accent bg-accent' : 'border-faint hover:border-accent'}`}
                  >
                    {s.done && <span className="size-1.5 rounded-full bg-white" />}
                  </button>
                  <input
                    value={s.title}
                    onChange={(e) => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    onBlur={(e) => !e.target.value.trim() && setSubtasks(subtasks.filter((x) => x.id !== s.id))}
                    className={`flex-1 bg-transparent text-[15px] leading-6 outline-none ${s.done ? 'text-faint line-through' : ''}`}
                  />
                  <button
                    onClick={() => setSubtasks(subtasks.filter((x) => x.id !== s.id))}
                    aria-label="Slett underoppgave"
                    className="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg md:opacity-0 md:group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 py-1.5">
              <Plus size={16} className="text-accent" />
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                onBlur={addSubtask}
                placeholder="Legg til underoppgave"
                enterKeyHint="enter"
                className="flex-1 bg-transparent text-[15px] leading-6 outline-none placeholder:text-faint"
              />
            </div>
          </div>

          <p className="mt-8 text-xs text-faint">
            Opprettet {created.getDate()}. {MONTHS[created.getMonth()]} {created.getFullYear()}
            {task.recurrence && task.due && <> · Neste gang: {formatDue(task.due).toLowerCase()}</>}
          </p>
        </div>
      </aside>
    </div>
  )
}

function LabelEditor({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const { tasks } = useStore()
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const query = normalizeLabel(text)
  const suggestions = allLabels(tasks)
    .map((l) => l.name)
    .filter((n) => !labels.includes(n) && n.includes(query))
    .slice(0, 6)

  const add = (name: string) => {
    const n = normalizeLabel(name)
    if (n && !labels.includes(n)) onChange([...labels, n])
    setText('')
  }

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1.5 py-1">
      {labels.map((l) => (
        <span key={l} className="inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium" style={{ color: labelColor(l), background: `color-mix(in srgb, ${labelColor(l)} 12%, transparent)` }}>
          @{l}
          <button onClick={() => onChange(labels.filter((x) => x !== l))} aria-label={`Fjern ${l}`} className="grid size-4 place-items-center rounded-full hover:bg-black/10">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault()
            add(text)
          }
          if (e.key === 'Backspace' && !text && labels.length) onChange(labels.slice(0, -1))
        }}
        placeholder={labels.length ? '' : 'Legg til …'}
        aria-label="Ny etikett"
        className="w-24 bg-transparent px-1 py-1 text-right text-sm outline-none placeholder:text-faint"
      />
      {focused && (suggestions.length > 0 || query) && (
        <div className="glass-strong animate-rise absolute top-full right-0 z-10 mt-1 w-52 rounded-2xl p-1.5">
          {suggestions.map((n) => (
            <button key={n} onMouseDown={(e) => { e.preventDefault(); add(n) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-hover">
              <AtSign size={13} style={{ color: labelColor(n) }} /> {n}
            </button>
          ))}
          {query && !suggestions.includes(query) && !labels.includes(query) && (
            <button onMouseDown={(e) => { e.preventDefault(); add(query) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm text-accent hover:bg-hover">
              <Plus size={13} /> Ny etikett «{query}»
            </button>
          )}
        </div>
      )}
    </div>
  )
}
