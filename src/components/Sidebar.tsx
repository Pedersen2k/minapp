import { CalendarRange, Inbox, Monitor, Moon, Plus, Search, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import type { View } from '../lib/types'
import { Dot, Kbd, modKey } from './ui'

export type Theme = 'light' | 'dark' | 'system'

interface Props {
  view: View
  onNavigate: (v: View) => void
  onSearch: () => void
  theme: Theme
  onTheme: (t: Theme) => void
}

function NavItem({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm transition ${
        active ? 'bg-accent-soft font-medium text-accent' : 'text-fg/80 hover:bg-hover'
      }`}
    >
      <span className={`grid w-5 place-items-center ${active ? '' : 'text-muted'}`}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className={`text-xs ${active ? '' : 'text-faint'}`}>{count}</span> : null}
    </button>
  )
}

function SectionTitle({ children, onAdd, label }: { children: ReactNode; onAdd: () => void; label: string }) {
  return (
    <div className="group mt-6 mb-1 flex items-center justify-between px-2.5">
      <span className="text-xs font-semibold text-muted">{children}</span>
      <button onClick={onAdd} aria-label={label} className="grid size-6 place-items-center rounded-md text-muted transition hover:bg-hover hover:text-fg md:opacity-0 md:group-hover:opacity-100">
        <Plus size={15} />
      </button>
    </div>
  )
}

export function Sidebar({ view, onNavigate, onSearch, theme, onTheme }: Props) {
  const { tasks, projects, pages, addProject, addPage } = useStore()
  const [newProject, setNewProject] = useState<string | null>(null)
  const today = todayISO()
  const open = tasks.filter((t) => !t.done)
  const is = (v: View) => view.type === v.type && (!('id' in v) || ('id' in view && view.id === v.id))

  const themeIcon = { light: <Sun size={15} />, dark: <Moon size={15} />, system: <Monitor size={15} /> }
  const themeLabel = { light: 'Lys', dark: 'Mørk', system: 'System' }
  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

  return (
    <nav className="pt-safe flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <img src="/icon.svg" alt="" className="size-7 rounded-lg" />
        <span className="text-[15px] font-semibold tracking-tight">Minapp</span>
      </div>

      <div className="px-3">
        <button onClick={onSearch} className="mb-3 flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-muted transition hover:border-faint">
          <Search size={15} />
          <span className="flex-1 text-left">Søk</span>
          <span className="hidden md:inline"><Kbd>{modKey} K</Kbd></span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <NavItem active={is({ type: 'inbox' })} icon={<Inbox size={17} />} label="Innboks" count={open.filter((t) => !t.projectId).length} onClick={() => onNavigate({ type: 'inbox' })} />
        <NavItem active={is({ type: 'today' })} icon={<Sun size={17} />} label="I dag" count={open.filter((t) => t.due && t.due <= today).length} onClick={() => onNavigate({ type: 'today' })} />
        <NavItem active={is({ type: 'upcoming' })} icon={<CalendarRange size={17} />} label="Kommende" onClick={() => onNavigate({ type: 'upcoming' })} />

        <SectionTitle label="Nytt prosjekt" onAdd={() => setNewProject('')}>Prosjekter</SectionTitle>
        {projects.map((p) => (
          <NavItem
            key={p.id}
            active={is({ type: 'project', id: p.id })}
            icon={<Dot color={p.color} />}
            label={p.name}
            count={open.filter((t) => t.projectId === p.id).length}
            onClick={() => onNavigate({ type: 'project', id: p.id })}
          />
        ))}
        {newProject !== null && (
          <input
            autoFocus
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            onBlur={() => setNewProject(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProject.trim()) {
                const p = addProject(newProject.trim())
                setNewProject(null)
                onNavigate({ type: 'project', id: p.id })
              }
              if (e.key === 'Escape') setNewProject(null)
            }}
            placeholder="Navn på prosjekt"
            className="mt-1 w-full rounded-lg border border-accent bg-surface px-2.5 py-1.5 text-sm outline-none"
          />
        )}

        <SectionTitle label="Ny side" onAdd={() => onNavigate({ type: 'page', id: addPage().id })}>Sider</SectionTitle>
        {pages.map((p) => (
          <NavItem
            key={p.id}
            active={is({ type: 'page', id: p.id })}
            icon={<span className="text-[15px]">{p.icon}</span>}
            label={p.title || 'Uten tittel'}
            onClick={() => onNavigate({ type: 'page', id: p.id })}
          />
        ))}
      </div>

      <div className="pb-safe border-t border-line px-3 py-2">
        <button onClick={() => onTheme(nextTheme[theme])} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-hover">
          {themeIcon[theme]} Tema: {themeLabel[theme]}
        </button>
      </div>
    </nav>
  )
}
