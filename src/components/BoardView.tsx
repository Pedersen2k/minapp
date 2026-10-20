import { Check, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { columnOf } from '../lib/board'
import { uid } from '../lib/id'
import { byTaskOrder } from '../lib/order'
import { useStore } from '../lib/store'
import type { Column, Project } from '../lib/types'
import { InlineQuickAdd } from './QuickAdd'
import { List } from './TaskList'

/** Kanban-tavle for ett prosjekt. Kolonnene ligger på prosjektet, kolonnen per oppgave på oppgaven. */
export function BoardView({ project }: { project: Project }) {
  const { tasks, updateProject } = useStore()
  const columns = project.columns ?? []
  const mine = tasks.filter((t) => t.projectId === project.id)
  const [newColumn, setNewColumn] = useState<string | null>(null)

  const setColumns = (next: Column[]) => updateProject(project.id, { columns: next })
  const addColumn = () => {
    const name = newColumn?.trim()
    if (name) {
      // Nye kolonner legges før «Ferdig», så den alltid står til slutt.
      const doneIndex = columns.findIndex((c) => c.done)
      const next = [...columns]
      next.splice(doneIndex < 0 ? next.length : doneIndex, 0, { id: uid(), name })
      setColumns(next)
    }
    setNewColumn(null)
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0 [scrollbar-width:thin]">
      <div className="flex snap-x snap-mandatory items-start gap-4 md:snap-none">
        {columns.map((col) => {
          const colTasks = mine
            .filter((t) => columnOf(t, columns)?.id === col.id)
            .sort(col.done ? (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) : byTaskOrder)
          return (
            <BoardColumn
              key={col.id}
              column={col}
              count={colTasks.length}
              canDelete={!col.done && columns.filter((c) => !c.done).length > 1}
              onRename={(name) => setColumns(columns.map((c) => (c.id === col.id ? { ...c, name } : c)))}
              onDelete={() => setColumns(columns.filter((c) => c.id !== col.id))}
            >
              <List
                tasks={colTasks}
                container={{ kind: 'column', projectId: project.id, columnId: col.id, done: col.done }}
                showProject={false}
                className="min-h-16"
              />
              {!col.done && <InlineQuickAdd defaults={{ projectId: project.id, columnId: col.id }} />}
            </BoardColumn>
          )
        })}

        <div className="w-[82vw] max-w-72 shrink-0 snap-start md:w-72">
          {newColumn !== null ? (
            <input
              autoFocus
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              onBlur={addColumn}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addColumn()
                if (e.key === 'Escape') setNewColumn(null)
              }}
              placeholder="Navn på kolonne"
              className="w-full rounded-2xl border border-accent bg-surface px-4 py-3 text-sm outline-none"
            />
          ) : (
            <button
              onClick={() => setNewColumn('')}
              className="flex w-full items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-accent/30 px-4 py-3 text-sm font-medium text-accent transition hover:border-accent/60 hover:bg-accent-soft"
            >
              <Plus size={16} /> Ny kolonne
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ColumnProps {
  column: Column
  count: number
  canDelete: boolean
  onRename: (name: string) => void
  onDelete: () => void
  children: React.ReactNode
}

function BoardColumn({ column, count, canDelete, onRename, onDelete, children }: ColumnProps) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)

  return (
    <section className="w-[82vw] max-w-80 shrink-0 snap-start rounded-3xl border border-glass-border bg-card p-3 md:w-80">
      <header className="mb-3 flex items-center gap-2 px-1.5 pt-1">
        {column.done && (
          <span className="grid size-5 place-items-center rounded-full bg-[#22a06b] text-white">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {renaming ? (
          <input
            autoFocus
            defaultValue={column.name}
            onBlur={(e) => {
              if (e.target.value.trim()) onRename(e.target.value.trim())
              setRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.name}</h2>
        )}
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-muted">{count}</span>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} aria-label={`Valg for ${column.name}`} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover">
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="glass-strong animate-rise absolute right-0 z-20 mt-1 w-48 rounded-2xl p-1.5">
                <button onClick={() => { setRenaming(true); setMenu(false) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-hover">
                  <Pencil size={15} /> Gi nytt navn
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      setMenu(false)
                      if (confirm(`Slette kolonnen «${column.name}»? Oppgavene flyttes til første kolonne.`)) onDelete()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#e5484d] hover:bg-hover"
                  >
                    <Trash2 size={15} /> Slett kolonne
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>
      {children}
    </section>
  )
}
