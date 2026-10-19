import { ChevronRight, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addDays, formatDue, formatLong, todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import type { Task, View } from '../lib/types'
import { InlineQuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'
import { Dot } from './ui'

function sortTasks(a: Task, b: Task): number {
  return (
    (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
    (a.time ?? '99').localeCompare(b.time ?? '99') ||
    a.priority - b.priority ||
    a.createdAt - b.createdAt
  )
}

function Header({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-[26px] font-bold tracking-tight">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

function Section({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-1 flex items-center justify-between border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="animate-fade flex flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Sparkles size={26} />
      </div>
      <p className="font-medium">{text}</p>
      <p className="mt-1 text-sm text-muted">Nyt øyeblikket – eller legg til noe nytt.</p>
    </div>
  )
}

function List({ tasks, showProject, showDate }: { tasks: Task[]; showProject?: boolean; showDate?: boolean }) {
  return (
    <ul>
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} showProject={showProject} showDate={showDate} />
      ))}
    </ul>
  )
}

export function TasksView({ view, onNavigate }: { view: Exclude<View, { type: 'page' }>; onNavigate: (v: View) => void }) {
  const store = useStore()
  const today = todayISO()
  const open = store.tasks.filter((t) => !t.done).sort(sortTasks)

  if (view.type === 'today') {
    const overdue = open.filter((t) => t.due && t.due < today)
    const todays = open.filter((t) => t.due === today)
    return (
      <>
        <Header title="I dag" subtitle={formatLong(today)} />
        {overdue.length > 0 && (
          <Section
            title={<span className="text-[#e5484d]">Forfalt</span>}
            extra={
              <button
                onClick={() => overdue.forEach((t) => store.updateTask(t.id, { due: today }))}
                className="text-xs font-medium text-accent hover:underline"
              >
                Flytt til i dag
              </button>
            }
          >
            <List tasks={overdue} />
          </Section>
        )}
        <Section title={`${formatDue(today)} · ${formatLong(today)}`}>
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
        <Header title="Kommende" subtitle="De neste to ukene" />
        {days.map((d, i) => {
          const tasks = open.filter((t) => t.due === d)
          if (tasks.length === 0 && i > 6) return null
          return (
            <Section key={d} title={<><span>{formatDue(d)}</span> <span className="font-normal text-muted">· {formatLong(d)}</span></>}>
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
        <Header title="Innboks" subtitle={`${tasks.length} ${tasks.length === 1 ? 'oppgave' : 'oppgaver'}`} />
        <List tasks={tasks} showProject={false} />
        <InlineQuickAdd />
        {tasks.length === 0 && <Empty text="Innboksen er tom" />}
      </>
    )
  }

  return <ProjectView id={view.id} onNavigate={onNavigate} />
}

function ProjectView({ id, onNavigate }: { id: string; onNavigate: (v: View) => void }) {
  const { projects, tasks, deleteProject } = useStore()
  const [showDone, setShowDone] = useState(false)
  const [menu, setMenu] = useState(false)
  const project = projects.find((p) => p.id === id)
  if (!project) return <Empty text="Fant ikke prosjektet" />

  const mine = tasks.filter((t) => t.projectId === id)
  const open = mine.filter((t) => !t.done).sort(sortTasks)
  const done = mine.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return (
    <>
      <Header
        title={project.name}
        icon={<Dot color={project.color} />}
        subtitle={`${open.length} åpne · ${done.length} fullført`}
        actions={
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <div className="animate-rise absolute right-0 z-10 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-xl">
                <button
                  onClick={() => {
                    if (confirm(`Slette «${project.name}» og alle oppgavene?`)) {
                      deleteProject(id)
                      onNavigate({ type: 'inbox' })
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#e5484d] hover:bg-hover"
                >
                  <Trash2 size={15} /> Slett prosjekt
                </button>
              </div>
            )}
          </div>
        }
      />
      <List tasks={open} showProject={false} />
      <InlineQuickAdd defaults={{ projectId: id }} />
      {done.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDone(!showDone)} className="flex items-center gap-1 text-[13px] font-semibold text-muted">
            <ChevronRight size={15} className={`transition ${showDone ? 'rotate-90' : ''}`} />
            Fullførte ({done.length})
          </button>
          {showDone && <List tasks={done} showProject={false} />}
        </div>
      )}
    </>
  )
}
