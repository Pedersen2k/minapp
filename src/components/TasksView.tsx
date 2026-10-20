import { Check, ChevronRight, FolderPlus, MoreHorizontal, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addDays, formatDue, formatLong, todayISO } from '../lib/date'
import { childrenOf } from '../lib/projects'
import { PROJECT_COLORS, useStore } from '../lib/store'
import type { Task, View } from '../lib/types'
import { InlineQuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'

function sortTasks(a: Task, b: Task): number {
  return (
    (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
    (a.time ?? '99').localeCompare(b.time ?? '99') ||
    a.priority - b.priority ||
    a.createdAt - b.createdAt
  )
}

function Header({ title, eyebrow, icon, actions }: { title: ReactNode; eyebrow?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-medium text-muted first-letter:uppercase">{eyebrow}</p>}
        <h1 className="flex items-center gap-3 text-[32px] leading-tight font-bold tracking-[-0.03em] md:text-[36px]">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
      </div>
      {actions}
    </header>
  )
}

function Section({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="animate-fade flex flex-col items-center py-14 text-center">
      <div className="bg-accent-gradient mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-[0_10px_24px_-8px_rgb(91_75_214/0.6)]">
        <Sparkles size={26} />
      </div>
      <p className="font-semibold">{text}</p>
      <p className="mt-1 text-sm text-muted">Nyt øyeblikket – eller legg til noe nytt.</p>
    </div>
  )
}

function List({ tasks, showProject, showDate }: { tasks: Task[]; showProject?: boolean; showDate?: boolean }) {
  if (tasks.length === 0) return null
  return (
    <ul className="mb-2.5 flex flex-col gap-2">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} showProject={showProject} showDate={showDate} />
      ))}
    </ul>
  )
}

/** Fremdriftsring: «2 av 5 gjort i dag». */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0
  return (
    <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-glass-border bg-card px-4 py-2.5 sm:flex">
      <span
        className="grid size-9 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--accent) 0 ${pct * 100}%, var(--accent-soft) ${pct * 100}% 100%)` }}
      >
        <span className="grid size-[26px] place-items-center rounded-full bg-surface">
          {total > 0 && done === total && <Check size={14} strokeWidth={3} className="text-accent" />}
        </span>
      </span>
      <span className="text-[13px] text-muted">
        <b className="text-fg">{done} av {total}</b> gjort i dag
      </span>
    </div>
  )
}

export function TasksView({ view, onNavigate }: { view: Exclude<View, { type: 'page' }>; onNavigate: (v: View) => void }) {
  const store = useStore()
  const today = todayISO()
  const open = store.tasks.filter((t) => !t.done).sort(sortTasks)

  if (view.type === 'today') {
    const overdue = open.filter((t) => t.due && t.due < today)
    const todays = open.filter((t) => t.due === today)
    const doneToday = store.tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length
    return (
      <>
        <Header title="I dag" eyebrow={formatLong(today)} actions={<Progress done={doneToday} total={doneToday + overdue.length + todays.length} />} />
        {overdue.length > 0 && (
          <Section
            title={<span className="text-[#e5484d]">Forfalt</span>}
            extra={
              <button onClick={() => overdue.forEach((t) => store.updateTask(t.id, { due: today }))} className="text-xs font-semibold text-accent hover:underline">
                Flytt til i dag
              </button>
            }
          >
            <List tasks={overdue} />
          </Section>
        )}
        <Section title={overdue.length > 0 ? 'I dag' : null}>
          <List tasks={todays} showDate={false} />
          <InlineQuickAdd defaults={{ due: today }} />
        </Section>
        {overdue.length + todays.length === 0 && <Empty text="Alt er gjort for i dag" />}
      </>
    )
  }

  if (view.type === 'upcoming') {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
    const later = open.filter((t) => t.due && t.due > days[days.length - 1])
    return (
      <>
        <Header title="Kommende" eyebrow="De neste to ukene" />
        {days.map((d, i) => {
          const tasks = open.filter((t) => t.due === d)
          if (tasks.length === 0 && i > 6) return null
          return (
            <Section key={d} title={<><span className="text-fg">{formatDue(d)}</span> <span className="font-normal">· {formatLong(d)}</span></>}>
              <List tasks={tasks} showDate={false} />
              <InlineQuickAdd defaults={{ due: d }} />
            </Section>
          )
        })}
        {later.length > 0 && (
          <Section title="Senere">
            <List tasks={later} />
          </Section>
        )}
      </>
    )
  }

  if (view.type === 'inbox') {
    const tasks = open.filter((t) => !t.projectId)
    return (
      <>
        <Header title="Innboks" eyebrow={`${tasks.length} ${tasks.length === 1 ? 'oppgave' : 'oppgaver'}`} />
        <List tasks={tasks} showProject={false} />
        <InlineQuickAdd />
        {tasks.length === 0 && <Empty text="Innboksen er tom" />}
      </>
    )
  }

  return <ProjectView key={view.id} id={view.id} onNavigate={onNavigate} />
}

function ProjectView({ id, onNavigate }: { id: string; onNavigate: (v: View) => void }) {
  const { projects, tasks, addProject, updateProject, deleteProject } = useStore()
  const [showDone, setShowDone] = useState(false)
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newSub, setNewSub] = useState<string | null>(null)
  const project = projects.find((p) => p.id === id)
  if (!project) return <Empty text="Fant ikke prosjektet" />

  const parent = project.parentId ? projects.find((p) => p.id === project.parentId) : undefined
  const subs = childrenOf(projects, id)
  const mine = tasks.filter((t) => t.projectId === id)
  const open = mine.filter((t) => !t.done).sort(sortTasks)
  const done = mine.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  const createSub = () => {
    if (newSub?.trim()) addProject(newSub.trim(), { color: project.color, parentId: id })
    setNewSub(null)
  }

  const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover'

  return (
    <>
      <Header
        eyebrow={parent ? parent.name : `${open.length} åpne · ${done.length} fullført`}
        icon={<span className="size-3.5 shrink-0 rounded-full" style={{ background: project.color, boxShadow: `0 0 0 5px color-mix(in srgb, ${project.color} 18%, transparent)` }} />}
        title={
          renaming ? (
            <input
              autoFocus
              defaultValue={project.name}
              onBlur={(e) => {
                if (e.target.value.trim()) updateProject(id, { name: e.target.value.trim() })
                setRenaming(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setRenaming(false)
              }}
              className="w-full bg-transparent outline-none"
            />
          ) : (
            project.name
          )
        }
        actions={
          <div className="relative">
            <button onClick={() => setMenu(!menu)} aria-label="Prosjektvalg" className="grid size-9 place-items-center rounded-xl border border-glass-border bg-card text-muted hover:bg-card-hover">
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="glass-strong animate-rise absolute right-0 z-20 mt-2 w-60 rounded-2xl p-1.5">
                  <button onClick={() => { setRenaming(true); setMenu(false) }} className={menuItem}>
                    <Pencil size={15} /> Gi nytt navn
                  </button>
                  {!project.parentId && (
                    <button onClick={() => { setNewSub(''); setMenu(false) }} className={menuItem}>
                      <FolderPlus size={15} /> Legg til underprosjekt
                    </button>
                  )}
                  <p className="px-3 pt-2 pb-1.5 text-xs font-semibold text-muted">Farge</p>
                  <div className="grid grid-cols-8 gap-1 px-2 pb-2">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateProject(id, { color: c })}
                        aria-label={`Farge ${c}`}
                        className="grid size-6 place-items-center rounded-full transition hover:scale-110"
                        style={{ background: c }}
                      >
                        {project.color === c && <Check size={13} strokeWidth={3} className="text-white" />}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <button
                    onClick={() => {
                      const extra = subs.length ? ', underprosjektene' : ''
                      if (confirm(`Slette «${project.name}»${extra} og alle oppgavene?`)) {
                        deleteProject(id)
                        onNavigate(parent ? { type: 'project', id: parent.id } : { type: 'inbox' })
                      }
                    }}
                    className={`${menuItem} text-[#e5484d]`}
                  >
                    <Trash2 size={15} /> Slett prosjekt
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      <List tasks={open} showProject={false} />
      <InlineQuickAdd defaults={{ projectId: id }} />
      {open.length === 0 && subs.length === 0 && done.length === 0 && <Empty text="Ingen oppgaver ennå" />}

      {/* Underprosjekter vises som egne seksjoner */}
      {subs.map((s) => {
        const subOpen = tasks.filter((t) => t.projectId === s.id && !t.done).sort(sortTasks)
        return (
          <section key={s.id} className="mt-9">
            <button onClick={() => onNavigate({ type: 'project', id: s.id })} className="group mb-2.5 flex items-center gap-2.5 px-1">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <h2 className="text-[15px] font-semibold group-hover:text-accent">{s.name}</h2>
              <span className="text-xs text-faint">{subOpen.length}</span>
              <ChevronRight size={15} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
            <List tasks={subOpen} showProject={false} />
            <InlineQuickAdd defaults={{ projectId: s.id }} />
          </section>
        )
      })}

      {newSub !== null && (
        <div className="mt-9 flex items-center gap-2.5 px-1">
          <span className="size-2 rounded-full" style={{ background: project.color }} />
          <input
            autoFocus
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onBlur={createSub}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createSub()
              if (e.key === 'Escape') setNewSub(null)
            }}
            placeholder="Navn på underprosjekt"
            className="flex-1 rounded-xl border border-accent bg-surface px-3 py-2 text-sm outline-none"
          />
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-10">
          <button onClick={() => setShowDone(!showDone)} className="mb-2.5 flex items-center gap-1 px-1 text-[13px] font-semibold text-muted">
            <ChevronRight size={15} className={`transition ${showDone ? 'rotate-90' : ''}`} />
            Fullførte ({done.length})
          </button>
          {showDone && <List tasks={done} showProject={false} />}
        </div>
      )}
    </>
  )
}
