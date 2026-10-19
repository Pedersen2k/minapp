import { Calendar, Clock, Flag, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDue } from '../lib/date'
import { parseQuickAdd } from '../lib/parse'
import { useStore } from '../lib/store'
import { Chip, Dot, PRIORITY_COLOR } from './ui'

export interface QuickAddDefaults {
  projectId?: string
  due?: string
}

interface Props {
  defaults?: QuickAddDefaults
  autoFocus?: boolean
  onCancel?: () => void
  onAdded?: () => void
}

/** Kortet med inndatafelt. Tolker dato, klokkeslett, #prosjekt og p1–p4 mens du skriver. */
export function QuickAdd({ defaults, autoFocus, onCancel, onAdded }: Props) {
  const { projects, addTask, addProject } = useStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => parseQuickAdd(text), [text])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const matchedProject = parsed.project
    ? projects.find((p) => p.name.toLowerCase() === parsed.project!.toLowerCase())
    : projects.find((p) => p.id === defaults?.projectId)
  const due = parsed.due ?? defaults?.due

  const submit = () => {
    if (!parsed.title) return
    let projectId = matchedProject?.id
    if (parsed.project && !matchedProject) {
      projectId = addProject(parsed.project.charAt(0).toUpperCase() + parsed.project.slice(1)).id
    }
    addTask({ title: parsed.title, due, time: parsed.time, priority: parsed.priority ?? 4, projectId })
    setText('')
    onAdded?.()
  }

  const hasMeta = due || parsed.time || parsed.project || matchedProject || parsed.priority

  return (
    <div className="animate-rise rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.15)]">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel?.()
        }}
        placeholder="Hva skal gjøres?"
        enterKeyHint="done"
        className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-faint"
      />
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
        {hasMeta ? (
          <>
            {due && (
              <Chip color="#22a06b">
                <Calendar size={12} /> {formatDue(due)}
              </Chip>
            )}
            {parsed.time && (
              <Chip color="#22a06b">
                <Clock size={12} /> {parsed.time}
              </Chip>
            )}
            {(parsed.project || matchedProject) && (
              <Chip className="bg-hover text-muted">
                <Dot color={matchedProject?.color ?? 'var(--accent)'} />
                {matchedProject ? matchedProject.name : `Nytt prosjekt: ${parsed.project}`}
              </Chip>
            )}
            {parsed.priority && parsed.priority < 4 && (
              <Chip color={PRIORITY_COLOR[parsed.priority]}>
                <Flag size={12} /> P{parsed.priority}
              </Chip>
            )}
          </>
        ) : (
          <span className="text-xs text-faint">Prøv: i morgen · fredag · 24.12 · kl 14 · #prosjekt · p1</span>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
        {onCancel && (
          <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-hover">
            Avbryt
          </button>
        )}
        <button
          onClick={submit}
          disabled={!parsed.title}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-40"
        >
          Legg til
        </button>
      </div>
    </div>
  )
}

/** Sammenfoldet «+ Legg til oppgave»-rad som åpner kortet. */
export function InlineQuickAdd({ defaults }: { defaults?: QuickAddDefaults }) {
  const [open, setOpen] = useState(false)
  if (open) return <QuickAdd defaults={defaults} autoFocus onCancel={() => setOpen(false)} />
  return (
    <button
      onClick={() => setOpen(true)}
      className="group flex w-full items-center gap-3 rounded-lg py-2 text-left text-sm text-muted transition hover:text-accent"
    >
      <span className="grid size-5 place-items-center rounded-full text-accent transition group-hover:bg-accent group-hover:text-white">
        <Plus size={16} />
      </span>
      Legg til oppgave
    </button>
  )
}
