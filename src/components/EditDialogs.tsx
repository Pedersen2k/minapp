import { AtSign, Check, Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { LABEL_COLORS, labelColor, normalizeLabel } from '../lib/labels'
import { possibleParents, projectTree } from '../lib/projects'
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
  const [description, setDescription] = useState(project?.description ?? '')
  if (!project) return null

  const hasChildren = projects.some((p) => p.parentId === project.id)
  // Kan legges under et annet hovedprosjekt (ett nivå), men ikke under seg selv eller egne underprosjekter.
  const allowed = new Set(possibleParents(projects, project.id).map((p) => p.id))
  const parents = projectTree(projects).filter(({ project: p }) => allowed.has(p.id))
  const saveName = () => {
    if (name.trim() && name.trim() !== project.name) updateProject(project.id, { name: name.trim() })
    if (description.trim() !== (project.description ?? '')) updateProject(project.id, { description: description.trim() || undefined })
  }
  const dateInput = 'w-full min-w-0 cursor-pointer rounded-xl border border-glass-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent'
  const toggle = (on: boolean, label: string, hint: string, change: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? 'bg-accent' : 'bg-hover ring-1 ring-line'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </label>
  )

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

      <label className={fieldLabel} htmlFor="project-description">Beskrivelse</label>
      <textarea
        id="project-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveName}
        rows={2}
        placeholder="Hva er målet med prosjektet?"
        className="mb-5 w-full resize-none rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={fieldLabel} htmlFor="project-start">Start</label>
          <input id="project-start" type="date" value={project.startDate ?? ''} max={project.deadline} onChange={(e) => updateProject(project.id, { startDate: e.target.value || undefined })} className={dateInput} />
        </div>
        <div className="min-w-0">
          <label className={fieldLabel} htmlFor="project-deadline">Frist</label>
          <input id="project-deadline" type="date" value={project.deadline ?? ''} min={project.startDate} onChange={(e) => updateProject(project.id, { deadline: e.target.value || undefined })} className={dateInput} />
        </div>
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

      {(parents.length > 0 || project.parentId) && (
        <>
          <label className={`${fieldLabel} mt-5`} htmlFor="parent">Ligger under</label>
          <select
            id="parent"
            value={project.parentId ?? ''}
            onChange={(e) => updateProject(project.id, { parentId: e.target.value || undefined })}
            className="w-full cursor-pointer rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Ingen – eget hovedprosjekt</option>
            {parents.map(({ project: p, depth }) => (
              <option key={p.id} value={p.id}>{`${'\u00a0\u00a0\u00a0'.repeat(depth)}${p.name}`}</option>
            ))}
          </select>
        </>
      )}

      <div className="mt-5 border-t border-line pt-3">
        {toggle(!!project.pinned, 'Fest prosjektet', 'Vises øverst i «Alle prosjekter»', (v) => updateProject(project.id, { pinned: v }))}
        {toggle(!!project.archived, 'Arkiver', 'Skjules fra sidemenyen, men beholder alle oppgaver', (v) => updateProject(project.id, { archived: v }))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
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
