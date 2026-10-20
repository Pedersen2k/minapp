import { AtSign, Check, Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { LABEL_COLORS, labelColor, normalizeLabel } from '../lib/labels'
import { descendantIds, topLevel } from '../lib/projects'
import { PROJECT_COLORS, useStore } from '../lib/store'
import type { View } from '../lib/types'

export const PROJECT_ICONS = [
  '🏠', '💼', '❤️', '💪', '🏃', '🍳', '🛒', '✈️', '🚗', '💰', '📚', '🎓',
  '🎯', '💡', '🧠', '🎨', '🎵', '🎮', '🌱', '🐶', '👶', '🎉', '🔧', '📅',
  '📝', '📦', '🧾', '🏡', '⚽', '🎁', '☕', '⭐',
]

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[28px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const fieldLabel = 'mb-2 block text-xs font-semibold text-muted'

function ColorPicker({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Farge ${c}`}
          aria-pressed={value === c}
          className={`grid size-9 place-items-center rounded-full transition hover:scale-110 ${value === c ? 'ring-2 ring-fg/70 ring-offset-2 ring-offset-transparent' : ''}`}
          style={{ background: c }}
        >
          {value === c && <Check size={16} strokeWidth={3} className="text-white" />}
        </button>
      ))}
    </div>
  )
}

/** Navn, ikon, farge og plassering for et prosjekt. Endringer lagres med en gang. */
export function ProjectDialog({ projectId, onClose, onNavigate }: { projectId: string; onClose: () => void; onNavigate: (v: View) => void }) {
  const { projects, updateProject, deleteProject } = useStore()
  const project = projects.find((p) => p.id === projectId)
  const [name, setName] = useState(project?.name ?? '')
  if (!project) return null

  const hasChildren = projects.some((p) => p.parentId === project.id)
  // Kan legges under et annet hovedprosjekt (ett nivå), men ikke under seg selv eller egne underprosjekter.
  const parents = topLevel(projects).filter((p) => p.id !== project.id && !descendantIds(projects, project.id).includes(p.id))
  const saveName = () => name.trim() && name.trim() !== project.name && updateProject(project.id, { name: name.trim() })

  return (
    <Dialog title="Rediger prosjekt" onClose={() => { saveName(); onClose() }}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `color-mix(in srgb, ${project.color} 16%, transparent)` }}>
          {project.icon ?? <span className="size-4 rounded-full" style={{ background: project.color }} />}
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Navn"
          placeholder="Navn på prosjekt"
          className="min-w-0 flex-1 rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-[15px] font-semibold outline-none focus:border-accent"
        />
      </div>

      <label className={fieldLabel}>Farge</label>
      <ColorPicker colors={PROJECT_COLORS} value={project.color} onChange={(color) => updateProject(project.id, { color })} />

      <label className={`${fieldLabel} mt-5`}>Ikon</label>
      <div className="grid grid-cols-8 gap-1">
        <button
          onClick={() => updateProject(project.id, { icon: undefined })}
          aria-label="Ingen ikon"
          aria-pressed={!project.icon}
          className={`grid aspect-square place-items-center rounded-xl text-xs text-muted hover:bg-hover ${!project.icon ? 'bg-hover ring-1 ring-accent' : ''}`}
        >
          <span className="size-3 rounded-full" style={{ background: project.color }} />
        </button>
        {PROJECT_ICONS.map((ic) => (
          <button
            key={ic}
            onClick={() => updateProject(project.id, { icon: ic })}
            aria-pressed={project.icon === ic}
            className={`grid aspect-square place-items-center rounded-xl text-xl hover:bg-hover ${project.icon === ic ? 'bg-hover ring-1 ring-accent' : ''}`}
          >
            {ic}
          </button>
        ))}
      </div>

      {!hasChildren && (
        <>
          <label className={`${fieldLabel} mt-5`} htmlFor="parent">Ligger under</label>
          <select
            id="parent"
            value={project.parentId ?? ''}
            onChange={(e) => updateProject(project.id, { parentId: e.target.value || undefined })}
            className="w-full cursor-pointer rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Ingen – eget hovedprosjekt</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <button
          onClick={() => {
            if (confirm(`Slette «${project.name}»${hasChildren ? ', underprosjektene' : ''} og alle oppgavene?`)) {
              deleteProject(project.id)
              onClose()
              onNavigate(project.parentId ? { type: 'project', id: project.parentId } : { type: 'inbox' })
            }
          }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#e5484d] hover:bg-hover"
        >
          <Trash2 size={15} /> Slett
        </button>
        <button onClick={() => { saveName(); onClose() }} className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white">
          Ferdig
        </button>
      </div>
    </Dialog>
  )
}

/** Navn og farge for en etikett. Nytt navn oppdateres på alle oppgaver. */
export function LabelDialog({ name: initial, onClose, onNavigate }: { name: string; onClose: () => void; onNavigate: (v: View) => void }) {
  const { tasks, renameLabel, setLabelColor, deleteLabel } = useStore()
  const [name, setName] = useState(initial)
  const color = labelColor(initial)
  const count = tasks.filter((t) => t.labels?.includes(initial)).length

  const save = () => {
    const next = normalizeLabel(name)
    if (next && next !== initial) {
      renameLabel(initial, next)
      onNavigate({ type: 'label', name: next })
    }
    onClose()
  }

  return (
    <Dialog title="Rediger etikett" onClose={save}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          <AtSign size={22} />
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          aria-label="Navn"
          className="min-w-0 flex-1 rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-[15px] font-semibold outline-none focus:border-accent"
        />
      </div>
      <p className="-mt-3 mb-5 text-xs text-muted">Brukes på {count} {count === 1 ? 'oppgave' : 'oppgaver'}. Nytt navn endres på alle.</p>

      <label className={fieldLabel}>Farge</label>
      <ColorPicker colors={LABEL_COLORS} value={color} onChange={(c) => setLabelColor(initial, c)} />

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <button
          onClick={() => {
            if (confirm(`Fjerne etiketten «${initial}» fra alle oppgaver? Oppgavene beholdes.`)) {
              deleteLabel(initial)
              onClose()
              onNavigate({ type: 'today' })
            }
          }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#e5484d] hover:bg-hover"
        >
          <Trash2 size={15} /> Slett etikett
        </button>
        <button onClick={save} className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white">
          Ferdig
        </button>
      </div>
    </Dialog>
  )
}
