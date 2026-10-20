import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AtSign, Bell, BellOff, BellRing, CalendarDays, CheckCircle2, Pencil, CalendarRange, Cloud, CloudOff, FilePlus, HardDrive, Inbox, LogOut, Monitor, Moon, Plus, RefreshCw, Search, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { todayISO } from '../lib/date'
import { allLabels, labelColor } from '../lib/labels'
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from '../lib/push'
import { sortByPosition } from '../lib/order'
import { childrenOf, topLevel } from '../lib/projects'
import { useEdit } from '../lib/ui-context'
import { useStore } from '../lib/store'
import type { Page, Project, View } from '../lib/types'
import { ProjectIcon } from './ProjectIcon'
import { Kbd, modKey } from './ui'

export type Theme = 'light' | 'dark' | 'system'

interface Props {
  view: View
  onNavigate: (v: View) => void
  onSearch: () => void
  theme: Theme
  onTheme: (t: Theme) => void
}

interface NavItemProps {
  active: boolean
  icon: ReactNode
  label: string
  count?: number
  onClick: () => void
  indent?: boolean
  dropHighlight?: boolean
  dnd?: { setNodeRef: (el: HTMLElement | null) => void; attributes: object; listeners?: object; style?: React.CSSProperties }
}

function NavItem({ active, icon, label, count, onClick, indent, dropHighlight, dnd }: NavItemProps) {
  return (
    <button
      ref={dnd?.setNodeRef}
      {...dnd?.attributes}
      {...dnd?.listeners}
      style={dnd?.style}
      onClick={onClick}
      className={`flex w-full touch-manipulation items-center gap-3 rounded-xl py-2 pr-3 text-left text-[14.5px] transition select-none ${indent ? 'pl-9' : 'pl-3'} ${
        dropHighlight ? 'bg-accent-soft ring-2 ring-accent/40' : active ? 'bg-card-hover font-semibold shadow-[0_4px_16px_-6px_rgb(60_50_140/0.25)]' : 'hover:bg-hover'
      }`}
    >
      <span className="grid w-5 shrink-0 place-items-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className={`text-xs ${active ? 'text-accent' : 'text-faint'}`}>{count}</span> : null}
    </button>
  )
}

/** Legger en blyant på raden ved hover (PC). På mobil redigeres fra overskriften i visningen. */
function WithEdit({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="group/edit relative">
      {children}
      <button
        onClick={onEdit}
        aria-label={`Rediger ${label}`}
        title="Rediger"
        className="absolute top-1/2 right-1.5 hidden size-7 -translate-y-1/2 place-items-center rounded-lg bg-surface text-muted shadow-sm hover:text-accent md:group-hover/edit:grid"
      >
        <Pencil size={13} />
      </button>
    </div>
  )
}

/** Prosjekt i menyen: kan sorteres blant søsken, og tar imot oppgaver som slippes på det. */
function SortableProject({ project, ...rest }: { project: Project } & Omit<NavItemProps, 'dnd' | 'dropHighlight'>) {
  const s = useSortable({ id: `nav-project:${project.id}`, data: { type: 'project', project } })
  const taskOver = s.isOver && s.active?.data.current?.type === 'task'
  return (
    <NavItem
      {...rest}
      dropHighlight={taskOver}
      dnd={{ setNodeRef: s.setNodeRef, attributes: s.attributes, listeners: s.listeners, style: { transform: CSS.Translate.toString(s.transform), transition: s.transition, opacity: s.isDragging ? 0.4 : undefined } }}
    />
  )
}

function SortablePage({ page, ...rest }: { page: Page } & Omit<NavItemProps, 'dnd' | 'dropHighlight'>) {
  const s = useSortable({ id: `nav-page:${page.id}`, data: { type: 'page', page } })
  return (
    <NavItem
      {...rest}
      dnd={{ setNodeRef: s.setNodeRef, attributes: s.attributes, listeners: s.listeners, style: { transform: CSS.Translate.toString(s.transform), transition: s.transition, opacity: s.isDragging ? 0.4 : undefined } }}
    />
  )
}

/** «Innboks» og «I dag» tar imot oppgaver: flytter til innboksen eller setter dato til i dag. */
function DroppableNav({ target, ...rest }: { target: 'inbox' | 'today' } & Omit<NavItemProps, 'dnd' | 'dropHighlight'>) {
  const d = useDroppable({ id: `nav-${target}`, data: { type: 'nav', target } })
  return <NavItem {...rest} dropHighlight={d.isOver && d.active?.data.current?.type === 'task'} dnd={{ setNodeRef: d.setNodeRef, attributes: {} }} />
}

function SectionTitle({ children, onAdd, label }: { children: ReactNode; onAdd: () => void; label: string }) {
  return (
    <div className="mt-6 mb-1 flex items-center justify-between pr-1 pl-3">
      <span className="text-xs font-semibold text-muted">{children}</span>
      <button onClick={onAdd} aria-label={label} title={label} className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-hover hover:text-accent">
        <Plus size={16} />
      </button>
    </div>
  )
}

export function Sidebar({ view, onNavigate, onSearch, theme, onTheme }: Props) {
  const { tasks, projects, pages, addProject, addPage } = useStore()
  const [newProject, setNewProject] = useState<string | null>(null)
  const today = todayISO()
  const open = tasks.filter((t) => !t.done)
  const is = (v: View) => JSON.stringify(v) === JSON.stringify(view)
  const countFor = (p: Project) => open.filter((t) => t.projectId === p.id).length
  // Bare etiketter som brukes på åpne oppgaver. Ubrukte finnes fortsatt i søket.
  const labels = allLabels(tasks).filter((l) => l.count > 0)
  const { editProject, editLabel } = useEdit()

  const themeIcon = { light: <Sun size={15} />, dark: <Moon size={15} />, system: <Monitor size={15} /> }
  const themeLabel = { light: 'Lys', dark: 'Mørk', system: 'System' }
  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

  const createProject = () => {
    if (!newProject?.trim()) return setNewProject(null)
    const p = addProject(newProject.trim())
    setNewProject(null)
    onNavigate({ type: 'project', id: p.id })
  }

  return (
    <nav className="pt-safe flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <span className="bg-accent-gradient grid size-8 place-items-center rounded-[10px] shadow-[0_6px_14px_-4px_rgb(91_75_214/0.6)]">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span className="text-base font-bold tracking-tight">Minapp</span>
      </div>

      <div className="px-3">
        <button onClick={onSearch} className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-glass-border bg-card px-3 py-2.5 text-sm text-muted transition hover:bg-card-hover">
          <Search size={15} />
          <span className="flex-1 text-left">Søk</span>
          <span className="hidden md:inline"><Kbd>{modKey} K</Kbd></span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <DroppableNav target="inbox" active={is({ type: 'inbox' })} icon={<Inbox size={18} className="text-accent" />} label="Innboks" count={open.filter((t) => !t.projectId).length} onClick={() => onNavigate({ type: 'inbox' })} />
        <DroppableNav target="today" active={is({ type: 'today' })} icon={<Sun size={18} className="text-[#f59e0b]" />} label="I dag" count={open.filter((t) => t.due && t.due <= today).length} onClick={() => onNavigate({ type: 'today' })} />
        <NavItem active={is({ type: 'upcoming' })} icon={<CalendarRange size={18} className="text-[#e5484d]" />} label="Kommende" onClick={() => onNavigate({ type: 'upcoming' })} />
        <NavItem active={is({ type: 'calendar' })} icon={<CalendarDays size={18} className="text-[#0ea5e9]" />} label="Kalender" onClick={() => onNavigate({ type: 'calendar' })} />
        <NavItem active={is({ type: 'done' })} icon={<CheckCircle2 size={18} className="text-[#22a06b]" />} label="Fullført" onClick={() => onNavigate({ type: 'done' })} />

        <SectionTitle label="Nytt prosjekt" onAdd={() => setNewProject('')}>Prosjekter</SectionTitle>
        <SortableContext items={sortByPosition(topLevel(projects)).map((p) => `nav-project:${p.id}`)} strategy={verticalListSortingStrategy}>
          {sortByPosition(topLevel(projects)).map((p) => {
            const kids = sortByPosition(childrenOf(projects, p.id))
            return (
              <div key={p.id}>
                <WithEdit label={p.name} onEdit={() => editProject(p.id)}>
                  <SortableProject project={p} active={is({ type: 'project', id: p.id })} icon={<ProjectIcon project={p} />} label={p.name} count={countFor(p)} onClick={() => onNavigate({ type: 'project', id: p.id })} />
                </WithEdit>
                <SortableContext items={kids.map((c) => `nav-project:${c.id}`)} strategy={verticalListSortingStrategy}>
                  {kids.map((c) => (
                    <WithEdit key={c.id} label={c.name} onEdit={() => editProject(c.id)}>
                      <SortableProject project={c} indent active={is({ type: 'project', id: c.id })} icon={<ProjectIcon project={c} size="sm" />} label={c.name} count={countFor(c)} onClick={() => onNavigate({ type: 'project', id: c.id })} />
                    </WithEdit>
                  ))}
                </SortableContext>
              </div>
            )
          })}
        </SortableContext>
        {newProject !== null ? (
          <input
            autoFocus
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            onBlur={createProject}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createProject()
              if (e.key === 'Escape') setNewProject(null)
            }}
            placeholder="Navn på prosjekt"
            className="mt-1 w-full rounded-xl border border-accent bg-surface px-3 py-2 text-sm outline-none"
          />
        ) : (
          <button onClick={() => setNewProject('')} className="flex w-full items-center gap-3 rounded-xl py-2 pl-3 text-left text-[14.5px] text-muted transition hover:bg-hover hover:text-accent">
            <span className="grid w-5 place-items-center"><Plus size={16} /></span>
            Nytt prosjekt
          </button>
        )}

        {labels.length > 0 && (
          <>
            <div className="mt-6 mb-1 pl-3 text-xs font-semibold text-muted">Etiketter</div>
            {labels.map((l) => (
              <WithEdit key={l.name} label={l.name} onEdit={() => editLabel(l.name)}>
                <NavItem active={is({ type: 'label', name: l.name })} icon={<AtSign size={16} style={{ color: labelColor(l.name) }} />} label={l.name} count={l.count} onClick={() => onNavigate({ type: 'label', name: l.name })} />
              </WithEdit>
            ))}
          </>
        )}

        <SectionTitle label="Ny side" onAdd={() => onNavigate({ type: 'page', id: addPage().id })}>Sider</SectionTitle>
        <SortableContext items={sortByPosition(pages).map((p) => `nav-page:${p.id}`)} strategy={verticalListSortingStrategy}>
          {sortByPosition(pages).map((p) => (
            <SortablePage key={p.id} page={p} active={is({ type: 'page', id: p.id })} icon={<span className="text-[15px]">{p.icon}</span>} label={p.title || 'Uten tittel'} onClick={() => onNavigate({ type: 'page', id: p.id })} />
          ))}
        </SortableContext>
        <button onClick={() => onNavigate({ type: 'page', id: addPage().id })} className="flex w-full items-center gap-3 rounded-xl py-2 pl-3 text-left text-[14.5px] text-muted transition hover:bg-hover hover:text-accent">
          <span className="grid w-5 place-items-center"><FilePlus size={16} /></span>
          Ny side
        </button>
      </div>

      <div className="pb-safe border-t border-line px-3 py-2">
        <button onClick={() => onTheme(nextTheme[theme])} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover">
          {themeIcon[theme]} Tema: {themeLabel[theme]}
        </button>
        <PushRow />
        <SyncRow />
      </div>
    </nav>
  )
}

const SYNC_LABEL = {
  local: { icon: <HardDrive size={15} />, text: 'Lagres bare på denne enheten' },
  syncing: { icon: <RefreshCw size={15} className="animate-spin" />, text: 'Synkroniserer …' },
  synced: { icon: <Cloud size={15} />, text: 'Synkronisert' },
  offline: { icon: <CloudOff size={15} />, text: 'Frakoblet – lagres lokalt' },
}

function SyncRow() {
  const { sync } = useStore()
  const { icon, text } = SYNC_LABEL[sync.status]
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted">
      <span className={sync.status === 'offline' ? 'text-[#f59e0b]' : ''}>{icon}</span>
      <span className="flex-1 truncate" title={sync.session?.user.email}>{text}</span>
      {sync.session && (
        <button onClick={() => confirm('Logge ut?') && sync.signOut()} aria-label="Logg ut" title="Logg ut" className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg">
          <LogOut size={15} />
        </button>
      )}
    </div>
  )
}

const PUSH_TEXT: Record<PushState, string> = {
  unsupported: 'Varsler støttes ikke her',
  'needs-install': 'Legg appen på hjemskjermen for varsler',
  denied: 'Varsler er blokkert i innstillingene',
  off: 'Slå på varsler',
  on: 'Varsler er på',
}

function PushRow() {
  const { sync } = useStore()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (!sync.enabled || state === null || state === 'unsupported') return null

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  const icon = state === 'on' ? <BellRing size={15} className="text-accent" /> : state === 'off' ? <Bell size={15} /> : <BellOff size={15} />

  return (
    <div className="px-3 py-1">
      <div className="flex items-center gap-2.5 py-1 text-sm text-muted">
        {icon}
        {state === 'off' ? (
          <button disabled={busy} onClick={() => run(async () => setState(await enablePush()))} className="flex-1 text-left font-medium text-accent hover:underline">
            {busy ? 'Slår på …' : PUSH_TEXT.off}
          </button>
        ) : (
          <span className="flex-1 truncate">{PUSH_TEXT[state]}</span>
        )}
        {state === 'on' && (
          <>
            <button
              disabled={busy}
              onClick={() => run(async () => setMessage((await sendTestPush()) ? 'Testvarsel sendt' : 'Fant ingen enheter'))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-hover"
            >
              Test
            </button>
            <button
              disabled={busy}
              onClick={() => run(async () => setState(await disablePush()))}
              aria-label="Slå av varsler"
              title="Slå av varsler på denne enheten"
              className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg"
            >
              <BellOff size={14} />
            </button>
          </>
        )}
      </div>
      {message && <p className="pb-1 pl-6 text-xs text-muted">{message}</p>}
    </div>
  )
}
