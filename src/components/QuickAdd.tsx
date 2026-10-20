import { AtSign, Calendar, Clock, Flag, Plus, Repeat } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDue } from '../lib/date'
import { labelColor } from '../lib/labels'
import { parseQuickAdd } from '../lib/parse'
import { findProjectByTag } from '../lib/projects'
import { RECURRENCE_LABEL } from '../lib/recurrence'
import { useStore } from '../lib/store'
import { AutoTextarea } from './AutoTextarea'
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

/** Kortet med inndatafelt. Tolker dato, klokkeslett, gjentakelse, #prosjekt og p1–p4 mens du skriver. */
export function QuickAdd({ defaults, autoFocus, onCancel, onAdded }: Props) {
  const { projects, addTask, addProject } = useStore()
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => parseQuickAdd(text), [text])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const matchedProject = parsed.project ? findProjectByTag(projects, parsed.project) : projects.find((p) => p.id === defaults?.projectId)
  const due = parsed.due ?? defaults?.due

  const submit = () => {
    if (!parsed.title) return
    let projectId = matchedProject?.id
    if (parsed.project && !matchedProject) {
      projectId = addProject(parsed.project.charAt(0).toUpperCase() + parsed.project.slice(1)).id
    }
    addTask({
      title: parsed.title,
      notes: notes.trim() || undefined,
      due,
      time: parsed.time,
      priority: parsed.priority ?? 4,
      projectId,
      recurrence: parsed.recurrence,
      labels: parsed.labels,
    })
    setText('')
    setNotes('')
    inputRef.current?.focus()
    onAdded?.()
  }

  const hasMeta = due || parsed.time || parsed.project || matchedProject || parsed.priority || parsed.recurrence || parsed.labels

  return (
    <div className="glass-strong animate-rise rounded-[22px] p-4">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
          if (e.key === 'Escape') onCancel?.()
        }}
        placeholder="Hva skal gjøres?"
        enterKeyHint="done"
        className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-faint"
      />
      <AutoTextarea
        value={notes}
        onChange={setNotes}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          if (e.key === 'Escape') onCancel?.()
        }}
        placeholder="Beskrivelse"
        className="mt-1 max-h-40 text-sm leading-6 text-muted"
      />
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
        {hasMeta ? (
          <>
            {due && (
              <Chip color="#22a06b">
                <Calendar size={12} /> {formatDue(due)}
              </Chip>
            )}
            {parsed.recurrence && (
              <Chip color="#6a5ae0">
                <Repeat size={12} /> {RECURRENCE_LABEL[parsed.recurrence]}
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
            {parsed.labels?.map((l) => (
              <Chip key={l} color={labelColor(l)}>
                <AtSign size={12} /> {l}
              </Chip>
            ))}
            {parsed.priority && parsed.priority < 4 && (
              <Chip color={PRIORITY_COLOR[parsed.priority]}>
                <Flag size={12} /> P{parsed.priority}
              </Chip>
            )}
          </>
        ) : (
          <span className="text-xs text-faint">Prøv: i morgen · kl 14 · hver mandag · #prosjekt · @etikett · p1</span>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted hover:bg-hover">
            Avbryt
          </button>
        )}
        <button
          onClick={submit}
          disabled={!parsed.title}
          className="bg-accent-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(91_75_214/0.7)] transition disabled:opacity-40 disabled:shadow-none"
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
      className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-accent/30 px-4 py-3 text-left text-[15px] font-medium text-accent transition hover:border-accent/60 hover:bg-accent-soft"
    >
      <Plus size={18} />
      Legg til oppgave
    </button>
  )
}
