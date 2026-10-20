import { AtSign, LayoutGrid, CalendarDays, CalendarRange, CheckCircle2, FilePlus, Inbox, ListPlus, Moon, Search, Sun } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { formatDue, todayISO } from '../lib/date'
import { allLabels, labelColor } from '../lib/labels'
import { useStore } from '../lib/store'
import type { View } from '../lib/types'
import { ProjectIcon } from './ProjectIcon'

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: ReactNode
  run: () => void
}

interface Props {
  onClose: () => void
  onNavigate: (v: View) => void
  onNewTask: () => void
  onToggleTheme: () => void
  onOpenTask: (id: string) => void
}

export function CommandPalette({ onClose, onNavigate, onNewTask, onToggleTheme, onOpenTask }: Props) {
  const { projects, pages, tasks, addPage } = useStore()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const items = useMemo(() => {
    const go = (v: View) => () => onNavigate(v)
    const all: Item[] = [
      { id: 'dashboard', group: 'Gå til', label: 'Min dag', icon: <LayoutGrid size={16} />, run: go({ type: 'dashboard' }) },
      { id: 'today', group: 'Gå til', label: 'I dag', icon: <Sun size={16} />, run: go({ type: 'today' }) },
      { id: 'inbox', group: 'Gå til', label: 'Innboks', icon: <Inbox size={16} />, run: go({ type: 'inbox' }) },
      { id: 'upcoming', group: 'Gå til', label: 'Kommende', icon: <CalendarRange size={16} />, run: go({ type: 'upcoming' }) },
      { id: 'done', group: 'Gå til', label: 'Fullført', icon: <CheckCircle2 size={16} />, run: go({ type: 'done' }) },
      { id: 'calendar', group: 'Gå til', label: 'Kalender', icon: <CalendarDays size={16} />, run: go({ type: 'calendar' }) },
      ...projects.map((p) => ({ id: p.id, group: 'Prosjekter', label: p.name, icon: <ProjectIcon project={p} />, run: go({ type: 'project', id: p.id }) })),
      ...allLabels(tasks).map((l) => ({ id: `label-${l.name}`, group: 'Etiketter', label: `@${l.name}`, icon: <AtSign size={16} style={{ color: labelColor(l.name) }} />, run: go({ type: 'label', name: l.name }) })),
      ...pages.map((p) => ({ id: p.id, group: 'Sider', label: p.title || 'Uten tittel', icon: <span>{p.icon}</span>, run: go({ type: 'page', id: p.id }) })),
      { id: 'new-task', group: 'Handlinger', label: 'Ny oppgave', hint: 'Q', icon: <ListPlus size={16} />, run: onNewTask },
      { id: 'new-page', group: 'Handlinger', label: 'Ny side', icon: <FilePlus size={16} />, run: () => onNavigate({ type: 'page', id: addPage().id }) },
      { id: 'theme', group: 'Handlinger', label: 'Bytt lys/mørk modus', icon: <Moon size={16} />, run: onToggleTheme },
    ]
    const q = query.trim().toLowerCase()
    if (!q) return all
    const matches = all.filter((i) => i.label.toLowerCase().includes(q))
    const taskMatches: Item[] = tasks
      .filter((t) => !t.done && t.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t) => {
        const project = projects.find((p) => p.id === t.projectId)
        return {
          id: t.id,
          group: 'Oppgaver',
          label: t.title,
          hint: t.due ? formatDue(t.due) : undefined,
          icon: <CheckCircle2 size={16} />,
          run: () => {
            onNavigate(project ? { type: 'project', id: project.id } : t.due ? (t.due <= todayISO() ? { type: 'today' } : { type: 'upcoming' }) : t.labels?.length ? { type: 'label', name: t.labels[0] } : { type: 'inbox' })
            // Vent til visningen er byttet, så detaljpanelet legges oppå riktig liste.
            setTimeout(() => onOpenTask(t.id), 0)
          },
        }
      })
    const pageText: Item[] = pages
      .filter((p) => !p.title.toLowerCase().includes(q) && p.blocks.some((b) => b.text.toLowerCase().includes(q)))
      .map((p) => ({
        id: `text-${p.id}`,
        group: 'Innhold i sider',
        label: p.title || 'Uten tittel',
        hint: p.blocks.find((b) => b.text.toLowerCase().includes(q))?.text.slice(0, 40),
        icon: <span>{p.icon}</span>,
        run: go({ type: 'page', id: p.id }),
      }))
    return [...matches, ...taskMatches, ...pageText]
  }, [query, projects, pages, tasks, addPage, onNavigate, onNewTask, onToggleTheme, onOpenTask])

  const run = (item?: Item) => {
    if (!item) return
    onClose()
    item.run()
  }

  let lastGroup = ''

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise w-full max-w-lg overflow-hidden rounded-3xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
              if (e.key === 'Enter') run(items[index])
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Søk eller skriv en kommando …"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">Ingen treff</p>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            return (
              <div key={item.id}>
                {header && <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{header}</p>}
                <button
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(item)}
                  ref={(el) => { if (i === index) el?.scrollIntoView({ block: 'nearest' }) }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === index ? 'bg-hover' : ''}`}
                >
                  <span className="grid w-4 place-items-center text-muted">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="max-w-[40%] truncate text-xs text-faint">{item.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
