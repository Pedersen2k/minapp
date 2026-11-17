import { Archive, ChevronRight, Columns3, FolderOpen, FolderPlus, LayoutList, List as ListIcon, MoreHorizontal, Pencil, Pin, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { defaultColumns } from '../lib/board'
import { addDays, diffDays, formatDue, fromISO, todayISO } from '../lib/date'
import { uid } from '../lib/id'
import { byTaskOrder, sortByPosition } from '../lib/order'
import { childrenOf, depthOf, descendantIds, MAX_DEPTH, topLevel } from '../lib/projects'
import { useStore } from '../lib/store'
import type { Project, Section, Task, View } from '../lib/types'
import { useEdit, useOpenTask } from '../lib/ui-context'
import { BoardView } from './BoardView'
import { InlineQuickAdd } from './QuickAdd'
import { List } from './TaskList'
import { PRIORITY_COLOR } from './ui'

const RED = '#e5484d'
const GREEN = '#22a06b'

// Forfalte først, så dato, så prioritet, så manuell rekkefølge.
const byUrgency = (a: Task, b: Task) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.priority - b.priority || byTaskOrder(a, b)

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Tall for et prosjekt med alle underprosjekter. */
function useProjectStats(project: Project) {
  const { projects, tasks } = useStore()
  const today = todayISO()
  const ids = new Set([project.id, ...descendantIds(projects, project.id)])
  const all = tasks.filter((t) => t.projectId && ids.has(t.projectId))
  const open = all.filter((t) => !t.done)
  const done = all.length - open.length
  const weekAgo = fromISO(addDays(today, -7)).getTime()
  return {
    all,
    open,
    done,
    pct: all.length ? Math.round((done / all.length) * 100) : 0,
    today: open.filter((t) => t.due === today).length,
    overdue: open.filter((t) => t.due && t.due < today).length,
    doneWeek: all.filter((t) => t.done && (t.completedAt ?? 0) > weekAgo).length,
    next: [...open].sort(byUrgency)[0] as Task | undefined,
  }
}

/** Ikonflis i prosjektets farge: emoji hvis prosjektet har det, ellers en mappe. */
function IconTile({ project, size = 44 }: { project: Project; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{ width: size, height: size, borderRadius: size * 0.32, background: tint(project.color, 16), color: project.color, fontSize: size * 0.5 }}
    >
      {project.icon ?? <FolderOpen size={size * 0.46} strokeWidth={1.9} />}
    </span>
  )
}

/** Fremdriftsring tegnet med SVG. */
function Ring({ pct, color, size = 76, stroke = 9, label = true }: { pct: number; color: string; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct} prosent fullført`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-500"
        />
      )}
      {label && (
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fill="var(--fg)" style={{ fontSize: size * 0.22, fontWeight: 800 }}>
          {pct}%
        </text>
      )}
    </svg>
  )
}

function Bar({ pct, color, className = 'h-1.5' }: { pct: number; color: string; className?: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-hover ${className}`}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </span>
  )
}

function Pill({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  const style: CSSProperties | undefined = color ? { color, background: tint(color, 13) } : undefined
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${color ? '' : 'bg-hover text-muted'} ${className}`} style={style}>{children}</span>
}

/** Datobrikke: rød når forfalt, grønn i dag, ellers nøytral. */
function DueChip({ due }: { due?: string }) {
  if (!due) return <Pill>Ingen dato</Pill>
  const today = todayISO()
  return <Pill color={due < today ? RED : due === today ? GREEN : undefined}>{due < today ? `Forfalt ${formatDue(due).toLowerCase()}` : formatDue(due)}</Pill>
}

/** Fullførte oppgaver per dag den siste uka, som små søyler. */
function WeekBars({ tasks, color }: { tasks: Task[]; color: string }) {
  const today = todayISO()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const counts = days.map((d) => tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toLocaleDateString('sv-SE') === d).length)
  const max = Math.max(1, ...counts)
  return (
    <span className="mt-1 flex h-[18px] items-end gap-[3px]" aria-hidden="true">
      {counts.map((n, i) => (
        <span key={i} className="w-1.5 rounded-sm" style={{ height: Math.max(3, (n / max) * 18), background: i === 6 ? color : tint(color, 40) }} />
      ))}
    </span>
  )
}

function Stat({ value, label, color }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] bg-card px-3.5 py-3" style={color ? { background: tint(color, 11) } : undefined}>
      <span className="text-[22px] leading-tight font-extrabold md:text-[26px]" style={color ? { color } : undefined}>{value}</span>
      <span className="truncate text-[12px] text-muted md:text-[13px]">{label}</span>
    </div>
  )
}

/** Linje fra start til frist: hvor mye av tiden som er brukt mot hvor mye som er gjort. */
function Timeline({ project, start, pct }: { project: Project; start: string; pct: number }) {
  const today = todayISO()
  const deadline = project.deadline!
  const total = Math.max(1, diffDays(deadline, start))
  const used = Math.min(100, Math.max(0, Math.round((diffDays(today, start) / total) * 100)))
  const status =
    today > deadline ? (pct === 100 ? 'Ferdig.' : 'Fristen er passert.') : pct === 100 ? 'Alt er gjort.' : pct + 5 >= used ? 'I rute.' : pct + 25 >= used ? 'Litt bak skjema.' : 'Bak skjema.'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs font-medium text-muted">
        <span>Start {formatDue(start).toLowerCase()}</span>
        <span>Frist {formatDue(deadline).toLowerCase()}</span>
      </div>
      <div className="relative h-2 rounded-full bg-hover">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${used}%`, background: tint(project.color, 40) }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: project.color }} />
        <div aria-hidden="true" className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-sm bg-fg" style={{ left: `${used}%` }} title="I dag" />
      </div>
      <span className="text-xs text-muted">{used} % av tiden er brukt, {pct} % av oppgavene er gjort. {status}</span>
    </div>
  )
}

/** Kort for et underprosjekt med fremdrift (teller med alle nivåer under). */
function SubprojectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const s = useProjectStats(project)
  return (
    <button
      onClick={onOpen}
      className="group flex w-[220px] shrink-0 snap-start flex-col gap-3 rounded-[20px] border border-glass-border bg-card p-4 text-left transition hover:bg-card-hover sm:w-auto"
    >
      <span className="flex items-center gap-2.5">
        <IconTile project={project} size={34} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold group-hover:text-accent">{project.name}</span>
        <Ring pct={s.pct} color={project.color} size={30} stroke={4} label={false} />
      </span>
      <span className="truncate text-[13px] text-muted">{s.next ? `Neste: ${s.next.title}` : s.all.length ? 'Alt er gjort' : 'Ingen oppgaver ennå'}</span>
      <span className="flex flex-wrap gap-1.5">
        {s.next && <DueChip due={s.next.due} />}
        <Pill>{s.done} av {s.all.length}</Pill>
      </span>
    </button>
  )
}

/** Et kort med oppgaver: en kategori, eller oppgavene uten kategori. */
function TaskCard({
  project,
  section,
  title,
  tasks,
  doneCount,
  className = '',
}: {
  project: Project
  section?: Section
  title: string
  tasks: Task[]
  doneCount: number
  className?: string
}) {
  const { updateProject, updateTask } = useStore()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const sections = project.sections ?? []
  const total = tasks.length + doneCount
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const collapsed = !!section?.collapsed

  const patch = (p: Partial<Section>) => section && updateProject(project.id, { sections: sections.map((s) => (s.id === section.id ? { ...s, ...p } : s)) })
  const rename = () => {
    if (renaming?.trim()) patch({ name: renaming.trim() })
    setRenaming(null)
  }
  const remove = () => {
    if (!section || !confirm(`Slette kategorien «${section.name}»? Oppgavene blir liggende i prosjektet.`)) return
    for (const t of tasks) updateTask(t.id, { sectionId: undefined })
    updateProject(project.id, { sections: sections.filter((s) => s.id !== section.id) })
  }
  const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover'

  return (
    <section className={`rounded-[24px] border border-glass-border bg-card p-2 ${className}`}>
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
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
            className="min-w-0 flex-1 rounded-xl border border-accent bg-surface px-3 py-1.5 text-[15px] font-semibold outline-none"
          />
        ) : section ? (
          <button onClick={() => patch({ collapsed: !collapsed })} className="flex min-w-0 items-center gap-1.5 py-1 text-left" aria-expanded={!collapsed}>
            <ChevronRight size={15} className={`shrink-0 text-muted transition ${collapsed ? '' : 'rotate-90'}`} />
            <h2 className={`truncate text-[16px] font-bold ${collapsed ? 'text-muted' : ''}`}>{title}</h2>
          </button>
        ) : (
          <h2 className="truncate py-1 text-[16px] font-bold">{title}</h2>
        )}
        {renaming === null && (collapsed && tasks.length === 0 && total > 0 ? <Pill color={GREEN}>Alt gjort</Pill> : <Pill>{tasks.length}</Pill>)}
        <span className="flex-1">{total > 0 && <Bar pct={pct} color={project.color} className="h-1" />}</span>
        {section && (
          <div className="relative">
            <button onClick={() => setMenu(!menu)} aria-label={`Valg for ${section.name}`} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
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
        )}
      </div>
      {!collapsed && (
        <>
          <List tasks={tasks} container={{ kind: 'section', projectId: project.id, sectionId: section?.id }} showProject={false} />
          <InlineQuickAdd defaults={{ projectId: project.id, sectionId: section?.id }} />
        </>
      )}
    </section>
  )
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="animate-fade flex flex-col items-center py-14 text-center">
      <div className="bg-accent-gradient mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-[0_10px_24px_-8px_rgb(91_75_214/0.6)]">
        <Sparkles size={26} />
      </div>
      <p className="font-semibold">{text}</p>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </div>
  )
}

export function ProjectView({ id, onNavigate }: { id: string; onNavigate: (v: View) => void }) {
  const { projects, tasks, addProject, updateProject, deleteProject, toggleTask } = useStore()
  const { editProject } = useEdit()
  const openTask = useOpenTask()
  const [showDone, setShowDone] = useState(false)
  const [menu, setMenu] = useState(false)
  const [newSub, setNewSub] = useState<string | null>(null)
  const [newSection, setNewSection] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('all')
  const project = projects.find((p) => p.id === id)
  const stats = useProjectStats(project ?? { id, name: '', color: '' })
  if (!project) return <EmptyState text="Fant ikke prosjektet" sub="Det kan være slettet på en annen enhet." />

  const today = todayISO()
  const parent = project.parentId ? projects.find((p) => p.id === project.parentId) : undefined
  const subs = sortByPosition(childrenOf(projects, id))
  const canAddSub = depthOf(projects, id) < MAX_DEPTH
  const sections = project.sections ?? []
  const sectionIds = new Set(sections.map((s) => s.id))
  const mine = tasks.filter((t) => t.projectId === id)
  const open = mine.filter((t) => !t.done).sort(byTaskOrder)
  const done = mine.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  // Oppgaver med en kategori som ikke finnes lenger havner blant de uten kategori.
  const inSection = (t: Task, s?: string) => (s ? t.sectionId === s : !t.sectionId || !sectionIds.has(t.sectionId))
  const loose = open.filter((t) => inSection(t))
  const looseDone = done.filter((t) => inSection(t)).length
  const isBoard = project.view === 'board'
  const daysLeft = project.deadline ? diffDays(project.deadline, today) : undefined
  const start = project.startDate ?? (stats.all.length ? new Date(Math.min(...stats.all.map((t) => t.createdAt))).toLocaleDateString('sv-SE') : undefined)

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
  const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover'
  const dashed = 'flex items-center justify-center gap-1.5 rounded-[20px] border-[1.5px] border-dashed border-accent/30 px-3 py-2.5 text-[13px] font-medium text-accent hover:border-accent/60 hover:bg-accent-soft'

  // Mobil: kategoriene blir faner. På PC vises alle kortene.
  const tabs = [
    { id: 'all', label: 'Alle', count: open.length },
    ...(sections.length && loose.length ? [{ id: 'loose', label: 'Uten kategori', count: loose.length }] : []),
    ...sections.map((s) => ({ id: s.id, label: s.name, count: open.filter((t) => t.sectionId === s.id).length })),
  ]
  const shown = (key: string) => (tab === 'all' || tab === key ? '' : 'hidden md:block')

  return (
    <>
      {/* Hode */}
      <section className="relative mb-4 flex flex-col gap-5 overflow-hidden rounded-[26px] border border-glass-border bg-card p-5 shadow-[var(--shadow)] md:mb-5 md:gap-6 md:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: project.color }} />
        <div className="flex flex-wrap items-start gap-4 md:gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3.5 md:items-start md:gap-4">
            <span className="md:hidden"><IconTile project={project} size={50} /></span>
            <span className="hidden md:block"><IconTile project={project} size={64} /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {parent && (
                <nav aria-label="Brødsmuler" className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
                  <button onClick={() => onNavigate({ type: 'project', id: parent.id })} className="truncate font-medium text-accent hover:underline">{parent.name}</button>
                  <ChevronRight size={13} className="shrink-0" />
                </nav>
              )}
              <h1 className="min-w-0">
                <button onClick={() => editProject(id)} className="group flex max-w-full items-center gap-2 text-left" title="Rediger prosjekt">
                  <span className="line-clamp-2 text-[24px] leading-tight font-extrabold tracking-[-0.02em] break-words md:line-clamp-1 md:text-[34px]">{project.name}</span>
                  <Pencil size={17} className="hidden shrink-0 text-faint transition group-hover:text-accent md:block" />
                </button>
              </h1>
              {project.description ? (
                <p className="line-clamp-2 text-[13px] text-muted md:text-[15px]">{project.description}</p>
              ) : (
                <button onClick={() => editProject(id)} className="hidden self-start text-[13px] text-faint hover:text-accent md:block">Legg til beskrivelse og frist</button>
              )}
              {project.deadline && (
                <p className="text-[13px] text-muted md:hidden">
                  Frist {formatDue(project.deadline).toLowerCase()}
                  {daysLeft !== undefined && daysLeft >= 0 && ` · ${plural(daysLeft, 'dag', 'dager')} igjen`}
                </p>
              )}
            </div>
            <span className="md:hidden"><Ring pct={stats.pct} color={project.color} size={56} stroke={7} /></span>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            <div role="radiogroup" aria-label="Visning" className="flex flex-1 rounded-[13px] bg-hover p-[3px] md:flex-none">
              {([
                { value: 'list', label: 'Liste', icon: <ListIcon size={15} /> },
                { value: 'board', label: 'Tavle', icon: <Columns3 size={15} /> },
              ] as const).map((o) => {
                const on = (project.view ?? 'list') === o.value
                return (
                  <button
                    key={o.value}
                    role="radio"
                    aria-checked={on}
                    onClick={() => updateProject(id, o.value === 'board' && !project.columns?.length ? { view: o.value, columns: defaultColumns() } : { view: o.value })}
                    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition md:h-8 ${on ? 'bg-surface text-fg shadow-[0_2px_8px_-2px_rgb(60_50_140/0.25)]' : 'text-muted hover:text-fg'}`}
                  >
                    {o.icon} {o.label}
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-label="Prosjektvalg" className="grid size-10 place-items-center rounded-xl border border-glass-border bg-card text-muted hover:bg-card-hover md:size-9">
                <MoreHorizontal size={18} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="glass-strong animate-rise absolute right-0 z-20 mt-2 w-64 rounded-2xl p-1.5">
                    <button onClick={() => { editProject(id); setMenu(false) }} className={menuItem}>
                      <Pencil size={15} /> Rediger navn, frist og farge
                    </button>
                    {canAddSub && (
                      <button onClick={() => { setNewSub(''); setMenu(false) }} className={menuItem}>
                        <FolderPlus size={15} /> Legg til underprosjekt
                      </button>
                    )}
                    <button onClick={() => { setNewSection(''); setMenu(false); if (isBoard) updateProject(id, { view: 'list' }) }} className={menuItem}>
                      <LayoutList size={15} /> Legg til kategori
                    </button>
                    <button onClick={() => { updateProject(id, { pinned: !project.pinned }); setMenu(false) }} className={menuItem}>
                      <Pin size={15} /> {project.pinned ? 'Løsne' : 'Fest i oversikten'}
                    </button>
                    <button onClick={() => { updateProject(id, { archived: !project.archived }); setMenu(false) }} className={menuItem}>
                      <Archive size={15} /> {project.archived ? 'Hent fra arkivet' : 'Arkiver'}
                    </button>
                    <div className="my-1 h-px bg-line" />
                    <button
                      onClick={() => {
                        setMenu(false)
                        if (confirm(`Slette «${project.name}»${subs.length ? ', underprosjektene' : ''} og alle oppgavene?`)) {
                          deleteProject(id)
                          onNavigate(parent ? { type: 'project', id: parent.id } : { type: 'projects' })
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
        </div>

        {project.archived && (
          <p className="flex items-center gap-2 rounded-2xl bg-hover px-3.5 py-2.5 text-[13px] text-muted">
            <Archive size={15} /> Prosjektet er arkivert og vises ikke i sidemenyen.
            <button onClick={() => updateProject(id, { archived: false })} className="ml-auto font-semibold text-accent hover:underline">Hent tilbake</button>
          </p>
        )}

        {stats.all.length > 0 && (
          <div className="flex flex-wrap items-stretch gap-3 md:gap-4">
            <div className="hidden flex-[1_1_280px] items-center gap-4 rounded-[18px] bg-card px-4 py-3.5 md:flex">
              <Ring pct={stats.pct} color={project.color} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{stats.done} av {stats.all.length} gjort</span>
                <span className="text-[13px] text-muted">{stats.doneWeek ? `${stats.doneWeek} fullført siste 7 dager` : 'Ingen fullført siste 7 dager'}</span>
                <WeekBars tasks={stats.all} color={project.color} />
              </div>
            </div>
            <div className="grid flex-[2_1_380px] grid-cols-3 gap-2 md:grid-cols-4 md:gap-2.5">
              <Stat value={stats.open.length} label="Åpne" />
              <Stat value={stats.today} label="I dag" color={stats.today ? GREEN : undefined} />
              <Stat value={stats.overdue} label="Forfalt" color={stats.overdue ? RED : undefined} />
              <span className="hidden md:contents">
                {daysLeft !== undefined ? (
                  <Stat value={Math.abs(daysLeft)} label={daysLeft >= 0 ? 'Dager til frist' : 'Dager over frist'} color={daysLeft < 0 ? RED : undefined} />
                ) : (
                  <Stat value={stats.done} label="Fullført" />
                )}
              </span>
            </div>
          </div>
        )}

        {project.deadline && start && start <= project.deadline && (
          <div className="hidden md:block">
            <Timeline project={project} start={start} pct={stats.pct} />
          </div>
        )}
      </section>

      {/* Neste opp */}
      {stats.next && !isBoard && (
        <div className="mb-6 flex items-center gap-3 rounded-[20px] bg-[#1f1d3a] px-4 py-3 text-white md:mb-7 md:px-5 dark:bg-[#2a2752]">
          <span className="hidden text-[11px] font-bold tracking-[0.08em] text-[#c9c3ff] uppercase sm:inline">Neste opp</span>
          <button
            onClick={() => toggleTask(stats.next!.id)}
            aria-label={`Fullfør: ${stats.next.title}`}
            className="size-[22px] shrink-0 rounded-full border-2 transition hover:bg-white/15"
            style={{ borderColor: stats.next.priority < 4 ? PRIORITY_COLOR[stats.next.priority] : '#b9b4e0' }}
          />
          <button onClick={() => openTask(stats.next!.id)} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold hover:underline">
            {stats.next.title}
          </button>
          {stats.next.due && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${stats.next.due < today ? 'bg-[#ff8a8d]/20 text-[#ffb8ba]' : stats.next.due === today ? 'bg-[#4ade80]/15 text-[#a7f3c0]' : 'bg-white/10 text-[#e6e4ff]'}`}>
              {stats.next.due < today ? `Forfalt ${formatDue(stats.next.due).toLowerCase()}` : formatDue(stats.next.due)}
            </span>
          )}
          {stats.next.projectId !== id && (
            <span className="hidden shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-[#e6e4ff] sm:inline">
              {projects.find((p) => p.id === stats.next!.projectId)?.name}
            </span>
          )}
        </div>
      )}

      {/* Underprosjekter */}
      {(subs.length > 0 || newSub !== null) && (
        <section className="mb-7">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold tracking-[0.06em] text-muted uppercase">Underprosjekter</h2>
            {canAddSub && newSub === null && (
              <button onClick={() => setNewSub('')} className="flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
                <Plus size={14} /> Underprosjekt
              </button>
            )}
          </div>
          <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
            {subs.map((s) => (
              <SubprojectCard key={s.id} project={s} onOpen={() => onNavigate({ type: 'project', id: s.id })} />
            ))}
            {newSub !== null && (
              <div className="w-[220px] shrink-0 rounded-[20px] border border-dashed border-accent/40 p-3 sm:w-auto">{nameInput(newSub, setNewSub, createSub, 'Navn på underprosjekt')}</div>
            )}
          </div>
        </section>
      )}

      {isBoard ? (
        <BoardView project={project} />
      ) : (
        <>
          {tabs.length > 2 && (
            <div role="tablist" aria-label="Kategorier" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition ${tab === t.id ? 'bg-fg text-bg' : 'border border-glass-border bg-card text-muted'}`}
                >
                  {t.label} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid items-start gap-3 md:gap-4 lg:grid-cols-2">
            {(sections.length === 0 || loose.length > 0) && (
              <TaskCard
                project={project}
                title={sections.length ? 'Uten kategori' : 'Oppgaver'}
                tasks={loose}
                doneCount={looseDone}
                className={`${sections.length === 0 ? 'lg:col-span-2' : ''} ${shown('loose')}`}
              />
            )}
            {sections.map((s) => (
              <TaskCard
                key={s.id}
                project={project}
                section={s}
                title={s.name}
                tasks={open.filter((t) => t.sectionId === s.id)}
                doneCount={done.filter((t) => t.sectionId === s.id).length}
                className={shown(s.id)}
              />
            ))}
            <div className={`flex flex-col gap-2 ${tab === 'all' ? '' : 'hidden md:flex'}`}>
              {newSection !== null ? (
                <div className="rounded-[20px] border border-dashed border-accent/40 p-3">{nameInput(newSection, setNewSection, createSection, 'Navn på kategori, f.eks. Innkjøp')}</div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setNewSection('')} className={`${dashed} flex-1`}>
                    <Plus size={15} /> Ny kategori
                  </button>
                  {canAddSub && subs.length === 0 && newSub === null && (
                    <button onClick={() => setNewSub('')} className={`${dashed} flex-1`}>
                      <FolderPlus size={15} /> Underprosjekt
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {open.length === 0 && subs.length === 0 && sections.length === 0 && done.length === 0 && newSub === null && (
            <EmptyState text="Ingen oppgaver ennå" sub="Legg til den første oppgaven over, eller del prosjektet inn i kategorier." />
          )}

          {done.length > 0 && (
            <div className="mt-8">
              <button onClick={() => setShowDone(!showDone)} className="mb-2.5 flex items-center gap-1 px-1 text-[13px] font-semibold text-muted hover:text-fg" aria-expanded={showDone}>
                <ChevronRight size={15} className={`transition ${showDone ? 'rotate-90' : ''}`} />
                {showDone ? 'Skjul' : 'Vis'} {plural(done.length, 'fullført', 'fullførte')}
              </button>
              {showDone && <List tasks={done} showProject={false} />}
            </div>
          )}
        </>
      )}
    </>
  )
}

/** Kort i oversikten. Festede prosjekter får større kort. */
function OverviewCard({ project, big, onOpen }: { project: Project; big?: boolean; onOpen: () => void }) {
  const { projects } = useStore()
  const s = useProjectStats(project)
  const subs = childrenOf(projects, project.id).filter((p) => !p.archived).length
  const sectionCount = project.sections?.length ?? 0
  const meta = [subs ? plural(subs, 'underprosjekt', 'underprosjekter') : '', sectionCount ? plural(sectionCount, 'kategori', 'kategorier') : ''].filter(Boolean).join(' · ')
  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-[24px] border border-glass-border bg-card text-left shadow-[var(--shadow)] transition hover:bg-card-hover ${big ? 'p-5' : 'p-4'}`}
    >
      {big && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[5px]" style={{ background: project.color }} />}
      <span className="flex items-center gap-3">
        <IconTile project={project} size={big ? 44 : 38} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-bold group-hover:text-accent ${big ? 'text-[17px]' : 'text-[15px]'}`}>{project.name}</span>
          {big && (project.description || meta) && <span className="truncate text-[13px] text-muted">{project.description || meta}</span>}
        </span>
        <span className={`font-extrabold ${big ? 'text-[22px]' : 'text-sm text-muted'}`}>{s.pct}%</span>
      </span>
      <Bar pct={s.pct} color={project.color} className={big ? 'h-1.5' : 'h-1'} />
      {big ? (
        <span className="flex flex-wrap gap-1.5">
          {s.overdue > 0 && <Pill color={RED}>{s.overdue} forfalt</Pill>}
          {s.today > 0 && <Pill color={GREEN}>{s.today} i dag</Pill>}
          <Pill>{plural(s.open.length, 'åpen', 'åpne')}</Pill>
          {project.deadline && <Pill>Frist {formatDue(project.deadline).toLowerCase()}</Pill>}
        </span>
      ) : (
        <span className="truncate text-[13px] text-muted">{s.next ? `Neste: ${s.next.title}` : s.all.length ? 'Alt er gjort' : 'Ingen oppgaver ennå'}</span>
      )}
    </button>
  )
}

type Sort = 'active' | 'deadline' | 'name'

/** «Alle prosjekter»: festede øverst, så resten. Arkiverte ligger sammenfoldet nederst. */
export function ProjectsOverview({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { projects, tasks, addProject } = useStore()
  const [sort, setSort] = useState<Sort>('active')
  const [showArchived, setShowArchived] = useState(false)
  const [newName, setNewName] = useState<string | null>(null)
  const today = todayISO()
  const weekEnd = addDays(today, 6)

  const roots = sortByPosition(topLevel(projects))
  const active = roots.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)
  const openIn = (p: Project) => {
    const ids = new Set([p.id, ...descendantIds(projects, p.id)])
    return tasks.filter((t) => !t.done && t.projectId && ids.has(t.projectId))
  }
  const sorters: Record<Sort, (a: Project, b: Project) => number> = {
    active: (a, b) => openIn(b).length - openIn(a).length,
    deadline: (a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
    name: (a, b) => a.name.localeCompare(b.name, 'nb'),
  }
  const sorted = [...active].sort(sorters[sort])
  const pinned = sorted.filter((p) => p.pinned)
  const rest = sorted.filter((p) => !p.pinned)
  const openTotal = tasks.filter((t) => !t.done && t.projectId && !projects.find((p) => p.id === t.projectId)?.archived).length

  // Hvor mye som forfaller denne uka (inkludert forfalte), per hovedprosjekt.
  const week = active
    .map((p) => ({ project: p, count: openIn(p).filter((t) => t.due && t.due <= weekEnd).length }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count)
  const weekTotal = week.reduce((n, w) => n + w.count, 0)

  const create = () => {
    const name = newName?.trim()
    setNewName(null)
    if (!name) return
    const p = addProject(name)
    if (p) onNavigate({ type: 'project', id: p.id })
  }
  const go = (p: Project) => () => onNavigate({ type: 'project', id: p.id })
  const heading = 'mb-2.5 px-1 text-xs font-bold tracking-[0.06em] text-muted uppercase'

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-muted">
            {plural(active.length, 'prosjekt', 'prosjekter')} · {plural(openTotal, 'åpen oppgave', 'åpne oppgaver')}
          </p>
          <h1 className="text-[32px] leading-tight font-bold tracking-[-0.03em] md:text-[36px]">Prosjekter</h1>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div role="radiogroup" aria-label="Sorter" className="flex flex-1 rounded-[13px] bg-hover p-[3px] sm:flex-none">
            {([['active', 'Aktive'], ['deadline', 'Frist'], ['name', 'Navn']] as const).map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={sort === v}
                onClick={() => setSort(v)}
                className={`h-9 flex-1 rounded-[10px] px-3 text-[13px] font-semibold transition sm:h-8 ${sort === v ? 'bg-surface text-fg shadow-[0_2px_8px_-2px_rgb(60_50_140/0.25)]' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setNewName('')} className="bg-accent-gradient flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold text-white sm:h-9">
            <Plus size={16} /> <span className="hidden sm:inline">Nytt prosjekt</span><span className="sm:hidden">Nytt</span>
          </button>
        </div>
      </header>

      {newName !== null && (
        <div className="mb-5 max-w-sm">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={create}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') setNewName(null)
            }}
            placeholder="Navn på prosjekt"
            className="w-full rounded-xl border border-accent bg-surface px-3 py-2.5 text-sm outline-none"
          />
        </div>
      )}

      {weekTotal > 0 && (
        <section className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[24px] border border-glass-border bg-card px-5 py-4">
          <div className="flex-[1_1_220px]">
            <h2 className="text-[15px] font-bold">Denne uka</h2>
            <p className="text-[13px] text-muted">
              {plural(weekTotal, 'oppgave', 'oppgaver')} forfaller, fordelt på {plural(week.length, 'prosjekt', 'prosjekter')}
            </p>
          </div>
          <div className="flex flex-[2_1_360px] flex-col gap-2">
            <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={week.map((w) => `${w.project.name} ${w.count}`).join(', ')}>
              {week.map((w) => (
                <button key={w.project.id} onClick={go(w.project)} title={`${w.project.name}: ${w.count}`} aria-hidden="true" tabIndex={-1} className="h-full transition hover:opacity-80" style={{ flex: w.count, background: w.project.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {week.map((w) => (
                <button key={w.project.id} onClick={go(w.project)} className="flex items-center gap-1.5 hover:text-fg">
                  <span className="size-2 rounded-[3px]" style={{ background: w.project.color }} />
                  {w.project.name} {w.count}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section className="mb-7">
          <h2 className={heading}>Festet</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            {pinned.map((p) => <OverviewCard key={p.id} project={p} big onOpen={go(p)} />)}
          </div>
        </section>
      )}

      <section className="mb-7">
        {pinned.length > 0 && <h2 className={heading}>Alle</h2>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => <OverviewCard key={p.id} project={p} big={pinned.length === 0} onOpen={go(p)} />)}
          <button onClick={() => setNewName('')} className="flex min-h-[104px] items-center justify-center gap-1.5 rounded-[24px] border-[1.5px] border-dashed border-accent/35 text-[14px] font-semibold text-accent hover:border-accent/60 hover:bg-accent-soft">
            <Plus size={16} /> Nytt prosjekt
          </button>
        </div>
      </section>

      {active.length === 0 && <EmptyState text="Ingen prosjekter ennå" sub="Samle oppgaver som hører sammen i et prosjekt." />}

      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(!showArchived)} className="mb-2.5 flex items-center gap-1 px-1 text-[13px] font-semibold text-muted hover:text-fg" aria-expanded={showArchived}>
            <ChevronRight size={15} className={`transition ${showArchived ? 'rotate-90' : ''}`} />
            {showArchived ? 'Skjul' : 'Vis'} {plural(archived.length, 'arkivert prosjekt', 'arkiverte prosjekter')}
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 gap-3 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((p) => <OverviewCard key={p.id} project={p} onOpen={go(p)} />)}
            </div>
          )}
        </div>
      )}
    </>
  )
}
