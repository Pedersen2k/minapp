import { AtSign, Check, ChevronRight, Columns3, FolderPlus, LayoutList, List as ListIcon, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addDays, formatDue, formatLong, todayISO } from '../lib/date'
import { defaultColumns } from '../lib/board'
import { labelColor } from '../lib/labels'
import { isInInbox } from '../lib/inbox'
import { byTaskOrder, sortByPosition } from '../lib/order'
import { childrenOf, depthOf, descendantIds, MAX_DEPTH } from '../lib/projects'
import { uid } from '../lib/id'
import { useEdit } from '../lib/ui-context'
import { useStore } from '../lib/store'
import type { Project, Section, Task, View } from '../lib/types'
import { BoardView } from './BoardView'
import { Dashboard } from './Dashboard'
import { CalendarView } from './CalendarView'
import { InlineQuickAdd } from './QuickAdd'
import { ProjectIcon } from './ProjectIcon'
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

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex shrink-0 rounded-xl border border-glass-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
            value === o.value ? 'bg-surface text-fg shadow-[0_2px_8px_-2px_rgb(60_50_140/0.25)]' : 'text-muted hover:text-fg'
          }`}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
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

  return <ProjectView key={view.id} id={view.id} onNavigate={onNavigate} />
}

/** Kort for et underprosjekt med fremdrift (teller med alle nivåer under). */
function SubprojectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { projects, tasks } = useStore()
  const ids = new Set([project.id, ...descendantIds(projects, project.id)])
  const all = tasks.filter((t) => t.projectId && ids.has(t.projectId))
  const open = all.filter((t) => !t.done)
  const next = tasks.filter((t) => t.projectId === project.id && !t.done).sort(byDueThenOrder)[0]
  const subCount = childrenOf(projects, project.id).length
  const pct = all.length ? ((all.length - open.length) / all.length) * 100 : 0
  return (
    <button onClick={onOpen} className="group rounded-[20px] border border-glass-border bg-card p-4 text-left transition hover:bg-card-hover">
      <span className="flex items-center gap-2">
        <ProjectIcon project={project} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold group-hover:text-accent">{project.name}</span>
        <ChevronRight size={15} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </span>
      <span className="mt-1 mb-3 block truncate text-[13px] text-muted">
        {open.length} åpne{next ? ` · neste: ${next.title}` : subCount ? ` · ${subCount} underprosjekt${subCount === 1 ? '' : 'er'}` : ''}
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-hover">
        <span className="block h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: project.color }} />
      </span>
      <span className="mt-2 block text-xs text-faint">{all.length - open.length} av {all.length} gjort</span>
    </button>
  )
}

/** En kategori (seksjon) inne i et prosjekt: sammenleggbar overskrift, oppgaver og hurtiglegging. */
function SectionBlock({ project, section, tasks }: { project: Project; section: Section; tasks: Task[] }) {
  const { updateProject, updateTask } = useStore()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const sections = project.sections ?? []
  const patch = (p: Partial<Section>) => updateProject(project.id, { sections: sections.map((s) => (s.id === section.id ? { ...s, ...p } : s)) })
  const rename = () => {
    if (renaming?.trim()) patch({ name: renaming.trim() })
    setRenaming(null)
  }
  const remove = () => {
    if (!confirm(`Slette kategorien «${section.name}»? Oppgavene blir liggende i prosjektet.`)) return
    for (const t of tasks) updateTask(t.id, { sectionId: undefined })
    updateProject(project.id, { sections: sections.filter((s) => s.id !== section.id) })
  }
  const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover'

  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        {renaming !== null ? (
          <input
            autoFocus
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename()
              if (e.key === 'Escape') setRenaming(null)
            }}
            className="flex-1 rounded-xl border border-accent bg-surface px-3 py-1.5 text-[15px] font-semibold outline-none"
          />
        ) : (
          <button onClick={() => patch({ collapsed: !section.collapsed })} className="flex min-w-0 items-center gap-1.5 text-left" aria-expanded={!section.collapsed}>
            <ChevronRight size={15} className={`shrink-0 text-muted transition ${section.collapsed ? '' : 'rotate-90'}`} />
            <h2 className={`truncate text-[15px] font-semibold ${section.collapsed ? 'text-muted' : ''}`}>{section.name}</h2>
            <span className="text-xs text-faint">{tasks.length}</span>
          </button>
        )}
        <span className="h-px flex-1 bg-line" />
        <div className="relative">
          <button onClick={() => setMenu(!menu)} aria-label={`Valg for ${section.name}`} className="grid size-7 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="glass-strong animate-rise absolute right-0 z-20 mt-1 w-48 rounded-2xl p-1.5">
                <button onClick={() => { setRenaming(section.name); setMenu(false) }} className={menuItem}>
                  <Pencil size={15} /> Gi nytt navn
                </button>
                <button onClick={() => { setMenu(false); remove() }} className={`${menuItem} text-[#e5484d]`}>
                  <Trash2 size={15} /> Slett kategori
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {!section.collapsed && (
        <>
          <List tasks={tasks} container={{ kind: 'section', projectId: project.id, sectionId: section.id }} showProject={false} />
          <InlineQuickAdd defaults={{ projectId: project.id, sectionId: section.id }} />
        </>
      )}
    </section>
  )
}

function ProjectView({ id, onNavigate }: { id: string; onNavigate: (v: View) => void }) {
  const { projects, tasks, addProject, updateProject, deleteProject } = useStore()
  const [showDone, setShowDone] = useState(false)
  const [menu, setMenu] = useState(false)
  const { editProject } = useEdit()
  const [newSub, setNewSub] = useState<string | null>(null)
  const [newSection, setNewSection] = useState<string | null>(null)
  const project = projects.find((p) => p.id === id)
  if (!project) return <Empty text="Fant ikke prosjektet" />

  const parent = project.parentId ? projects.find((p) => p.id === project.parentId) : undefined
  const subs = sortByPosition(childrenOf(projects, id))
  const canAddSub = depthOf(projects, id) < MAX_DEPTH
  const sections = project.sections ?? []
  const sectionIds = new Set(sections.map((s) => s.id))
  const mine = tasks.filter((t) => t.projectId === id)
  const open = mine.filter((t) => !t.done).sort(byTaskOrder)
  // Oppgaver med en kategori som ikke finnes lenger havner blant de uten kategori.
  const loose = open.filter((t) => !t.sectionId || !sectionIds.has(t.sectionId))
  const done = mine.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  const createSub = () => {
    const name = newSub?.trim()
    setNewSub(null)
    if (!name) return
    const p = addProject(name, { color: project.color, parentId: id })
    if (p) onNavigate({ type: 'project', id: p.id })
  }
  const createSection = () => {
    const name = newSection?.trim()
    setNewSection(null)
    if (name) updateProject(id, { sections: [...sections, { id: uid(), name }] })
  }

  const eyebrow = [
    parent?.name,
    subs.length ? `${subs.length} underprosjekt${subs.length === 1 ? '' : 'er'}` : '',
    `${open.length} åpne`,
    done.length ? `${done.length} fullført` : '',
  ].filter(Boolean).join(' · ')
  const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover'
  const nameInput = (value: string, set: (v: string | null) => void, commit: () => void, placeholder: string) => (
    <input
      autoFocus
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') set(null)
      }}
      placeholder={placeholder}
      className="w-full rounded-xl border border-accent bg-surface px-3 py-2 text-sm outline-none"
    />
  )

  return (
    <>
      <Header
        eyebrow={eyebrow}
        icon={<ProjectIcon project={project} size="lg" />}
        title={
          <button onClick={() => editProject(id)} className="group flex max-w-full items-center gap-2 text-left" title="Rediger prosjekt">
            <span className="truncate">{project.name}</span>
            <Pencil size={18} className="shrink-0 text-faint transition group-hover:text-accent" />
          </button>
        }
        actions={
          <div className="flex items-center gap-2">
          <Segmented
            value={project.view ?? 'list'}
            onChange={(v) => updateProject(id, v === 'board' && !project.columns?.length ? { view: v, columns: defaultColumns() } : { view: v })}
            options={[
              { value: 'list', label: 'Liste', icon: <ListIcon size={15} /> },
              { value: 'board', label: 'Tavle', icon: <Columns3 size={15} /> },
            ]}
          />
          <div className="relative">
            <button onClick={() => setMenu(!menu)} aria-label="Prosjektvalg" className="grid size-9 place-items-center rounded-xl border border-glass-border bg-card text-muted hover:bg-card-hover">
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="glass-strong animate-rise absolute right-0 z-20 mt-2 w-60 rounded-2xl p-1.5">
                  <button onClick={() => { editProject(id); setMenu(false) }} className={menuItem}>
                    <Pencil size={15} /> Rediger navn, ikon og farge
                  </button>
                  {canAddSub && (
                    <button onClick={() => { setNewSub(''); setMenu(false) }} className={menuItem}>
                      <FolderPlus size={15} /> Legg til underprosjekt
                    </button>
                  )}
                  <button onClick={() => { setNewSection(''); setMenu(false); if (project.view === 'board') updateProject(id, { view: 'list' }) }} className={menuItem}>
                    <LayoutList size={15} /> Legg til kategori
                  </button>
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
          </div>
        }
      />

      {(subs.length > 0 || newSub !== null) && (
        <section className="mb-8">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Underprosjekter</h2>
            {canAddSub && newSub === null && (
              <button onClick={() => setNewSub('')} className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                <Plus size={14} /> Underprosjekt
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subs.map((s) => (
              <SubprojectCard key={s.id} project={s} onOpen={() => onNavigate({ type: 'project', id: s.id })} />
            ))}
            {newSub !== null && (
              <div className="rounded-[20px] border border-dashed border-accent/40 p-3">{nameInput(newSub, setNewSub, createSub, 'Navn på underprosjekt')}</div>
            )}
          </div>
        </section>
      )}

      {project.view === 'board' ? (
        <BoardView project={project} />
      ) : (
      <>

      {(subs.length > 0 || sections.length > 0) && (loose.length > 0 || sections.length === 0) && (
        <h2 className="mb-2.5 px-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
          {sections.length ? 'Uten kategori' : `Oppgaver i ${project.name}`}
        </h2>
      )}
      <List tasks={loose} container={{ kind: 'section', projectId: id }} showProject={false} />
      {(sections.length === 0 || loose.length > 0) && <InlineQuickAdd defaults={{ projectId: id }} />}
      {open.length === 0 && subs.length === 0 && sections.length === 0 && done.length === 0 && newSub === null && <Empty text="Ingen oppgaver ennå" />}

      {sections.map((s) => (
        <SectionBlock key={s.id} project={project} section={s} tasks={open.filter((t) => t.sectionId === s.id)} />
      ))}

      <div className="mt-8 flex flex-wrap gap-2">
        {newSection !== null ? (
          <div className="w-full max-w-sm">{nameInput(newSection, setNewSection, createSection, 'Navn på kategori, f.eks. Innkjøp')}</div>
        ) : (
          <>
            <button onClick={() => setNewSection('')} className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-accent/30 px-3 py-2 text-[13px] font-medium text-accent hover:border-accent/60 hover:bg-accent-soft">
              <Plus size={15} /> Ny kategori
            </button>
            {canAddSub && subs.length === 0 && newSub === null && (
              <button onClick={() => setNewSub('')} className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-accent/30 px-3 py-2 text-[13px] font-medium text-accent hover:border-accent/60 hover:bg-accent-soft">
                <FolderPlus size={15} /> Underprosjekt
              </button>
            )}
          </>
        )}
      </div>

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
      )}
    </>
  )
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
