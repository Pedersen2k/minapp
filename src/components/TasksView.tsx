import { AtSign, Check, RotateCcw, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addDays, formatDue, formatLong, todayISO } from '../lib/date'
import { labelColor } from '../lib/labels'
import { isInInbox } from '../lib/inbox'
import { byTaskOrder } from '../lib/order'
import { useEdit } from '../lib/ui-context'
import { useStore } from '../lib/store'
import type { Task, View } from '../lib/types'
import { Dashboard } from './Dashboard'
import { CalendarView } from './CalendarView'
import { InlineQuickAdd } from './QuickAdd'
import { ProjectsOverview, ProjectView } from './ProjectView'
import { List } from './TaskList'

// Datoliste (forfalt, senere): dato først, så manuell rekkefølge. Ellers bare manuell rekkefølge.
const byDueThenOrder = (a: Task, b: Task) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || byTaskOrder(a, b)

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

interface TasksViewProps {
  view: Exclude<View, { type: 'page' }>
  onNavigate: (v: View) => void
}

export function TasksView({ view, onNavigate }: TasksViewProps) {
  const store = useStore()
  const edit = useEdit()
  const today = todayISO()
  const open = store.tasks.filter((t) => !t.done).sort(byTaskOrder)

  if (view.type === 'today') {
    const overdue = open.filter((t) => t.due && t.due < today).sort(byDueThenOrder)
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
            <List tasks={overdue} container={{ kind: 'static', id: 'overdue' }} />
          </Section>
        )}
        <Section title={overdue.length > 0 ? 'I dag' : null}>
          <List tasks={todays} container={{ kind: 'due', date: today }} showDate={false} />
          <InlineQuickAdd defaults={{ due: today }} />
        </Section>
        {overdue.length + todays.length === 0 && <Empty text="Alt er gjort for i dag" />}
      </>
    )
  }

  if (view.type === 'calendar') {
    return (
      <>
        <Header title="Kalender" eyebrow="Planlegg dag for dag" />
        <CalendarView />
      </>
    )
  }

  if (view.type === 'upcoming') {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
    const later = open.filter((t) => t.due && t.due > days[days.length - 1]).sort(byDueThenOrder)
    return (
      <>
        <Header title="Kommende" eyebrow="De neste to ukene" />
        {days.map((d, i) => {
          const tasks = open.filter((t) => t.due === d)
          if (tasks.length === 0 && i > 6) return null
          return (
            <Section key={d} title={<><span className="text-fg">{formatDue(d)}</span> <span className="font-normal">· {formatLong(d)}</span></>}>
              <List tasks={tasks} container={{ kind: 'due', date: d }} showDate={false} />
              <InlineQuickAdd defaults={{ due: d }} />
            </Section>
          )
        })}
        {later.length > 0 && (
          <Section title="Senere">
            <List tasks={later} container={{ kind: 'static', id: 'later' }} />
          </Section>
        )}
      </>
    )
  }

  if (view.type === 'inbox') {
    const tasks = open.filter(isInInbox)
    return (
      <>
        <Header title="Innboks" eyebrow={tasks.length ? `${tasks.length} usortert${tasks.length === 1 ? '' : 'e'} · gi dato, prosjekt eller etikett for å sortere` : 'Skriv ned ting i farten, sorter senere'} />
        <List tasks={tasks} container={{ kind: 'inbox' }} showProject={false} />
        <InlineQuickAdd />
        {tasks.length === 0 && <Empty text="Innboksen er tom" />}
      </>
    )
  }

  if (view.type === 'dashboard') return <Dashboard />
  if (view.type === 'done') return <DoneView />
  if (view.type === 'trash') return <TrashView onNavigate={onNavigate} />

  if (view.type === 'label') {
    const tasks = open.filter((t) => t.labels?.includes(view.name))
    const color = labelColor(view.name)
    return (
      <>
        <Header
          title={view.name}
          eyebrow={`Etikett · ${tasks.length} ${tasks.length === 1 ? 'oppgave' : 'oppgaver'}`}
          icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}><AtSign size={20} /></span>}
          actions={
            <button onClick={() => edit.editLabel(view.name)} className="flex h-9 items-center gap-2 rounded-xl border border-glass-border bg-card px-3 text-[13px] font-medium hover:bg-card-hover">
              <Pencil size={15} /> <span className="hidden sm:inline">Rediger</span>
            </button>
          }
        />
        <List tasks={tasks} container={{ kind: 'static', id: `label:${view.name}` }} />
        {tasks.length === 0 && <Empty text="Ingen åpne oppgaver med denne etiketten" />}
      </>
    )
  }

  if (view.type === 'projects') return <ProjectsOverview onNavigate={onNavigate} />

  return <ProjectView key={view.id} id={view.id} onNavigate={onNavigate} />
}

/** Alle fullførte oppgaver, nyeste først, gruppert etter dagen de ble fullført. */
function DoneView() {
  const { tasks, projects } = useStore()
  const [projectFilter, setProjectFilter] = useState('')
  const [limit, setLimit] = useState(50)
  const done = tasks
    .filter((t) => t.done && (!projectFilter || t.projectId === projectFilter || (projectFilter === 'inbox' && !t.projectId)))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const shown = done.slice(0, limit)

  const groups: { day: string; tasks: Task[] }[] = []
  for (const t of shown) {
    const day = t.completedAt ? new Date(t.completedAt).toLocaleDateString('sv-SE') : 'ukjent' // sv-SE gir YYYY-MM-DD
    const g = groups[groups.length - 1]
    if (g?.day === day) g.tasks.push(t)
    else groups.push({ day, tasks: [t] })
  }

  return (
    <>
      <Header
        title="Fullført"
        eyebrow={`${done.length} ${done.length === 1 ? 'oppgave' : 'oppgaver'}`}
        icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#22a06b]/15 text-[#22a06b]"><Check size={20} strokeWidth={2.5} /></span>}
        actions={
          <select
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setLimit(50) }}
            aria-label="Filtrer på prosjekt"
            className="h-9 max-w-40 cursor-pointer rounded-xl border border-glass-border bg-card px-2.5 text-[13px] font-medium outline-none"
          >
            <option value="">Alle prosjekter</option>
            <option value="inbox">Innboks</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />
      {groups.map((g) => (
        <Section key={g.day} title={g.day === 'ukjent' ? 'Tidligere' : `${formatDue(g.day)} · ${formatLong(g.day)}`}>
          <List tasks={g.tasks} />
        </Section>
      ))}
      {done.length > limit && (
        <button onClick={() => setLimit(limit + 50)} className="w-full rounded-2xl border border-glass-border bg-card py-3 text-sm font-medium text-accent hover:bg-card-hover">
          Vis flere ({done.length - limit} til)
        </button>
      )}
      {done.length === 0 && <Empty text="Ingen fullførte oppgaver ennå" />}
    </>
  )
}

/** Sider i papirkurven. De kan gjenopprettes i 30 dager. */
function TrashView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { pages, restorePage, purgePages } = useStore()
  const trashed = pages.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  const daysLeft = (at: number) => Math.max(0, 30 - Math.floor((Date.now() - at) / 86_400_000))

  return (
    <>
      <Header
        title="Papirkurv"
        eyebrow={trashed.length ? `${trashed.length} ${trashed.length === 1 ? 'side' : 'sider'} · slettes for godt etter 30 dager` : 'Slettede sider havner her i 30 dager'}
        icon={<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted"><Trash2 size={19} /></span>}
        actions={
          trashed.length > 0 && (
            <button
              onClick={() => confirm(`Slette ${trashed.length === 1 ? 'siden' : `alle ${trashed.length} sidene`} for godt?`) && purgePages()}
              className="flex h-9 items-center gap-2 rounded-xl border border-glass-border bg-card px-3 text-[13px] font-medium text-[#e5484d] hover:bg-card-hover"
            >
              Tøm
            </button>
          )
        }
      />
      {trashed.length === 0 ? (
        <Empty text="Papirkurven er tom" />
      ) : (
        <ul className="flex flex-col gap-2">
          {trashed.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-glass-border bg-card px-4 py-3">
              <span className="text-xl">{p.icon}</span>
              <button onClick={() => onNavigate({ type: 'page', id: p.id })} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px] font-medium">{p.title || 'Uten tittel'}</span>
                <span className="block text-xs text-faint">Slettet {formatDue(new Date(p.deletedAt!).toLocaleDateString('sv-SE')).toLowerCase()} · {daysLeft(p.deletedAt!)} dager igjen</span>
              </button>
              <button onClick={() => restorePage(p.id)} aria-label="Gjenopprett" className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-accent hover:bg-hover">
                <RotateCcw size={14} /> <span className="hidden sm:inline">Gjenopprett</span>
              </button>
              <button
                onClick={() => purgePages([p.id])}
                aria-label="Slett for godt"
                title="Slett for godt"
                className="grid size-9 place-items-center rounded-xl text-faint hover:bg-hover hover:text-[#e5484d]"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
