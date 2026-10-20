import { Check, Heading1, Heading2, List, ListTodo, Quote, Trash2, Type } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AutoTextarea } from './AutoTextarea'
import { uid } from '../lib/id'
import { useStore } from '../lib/store'
import type { Block, BlockType, Page } from '../lib/types'

const ICONS = ['📄', '📝', '📚', '💡', '🎯', '🗂️', '🏠', '💼', '✈️', '🍳', '💪', '🌱', '🎨', '🎵', '💰', '🧠', '👋', '⭐', '🔥', '📅']

const BLOCK_OPTIONS: { type: BlockType; label: string; keys: string; icon: ReactNode }[] = [
  { type: 'p', label: 'Tekst', keys: 'tekst text p', icon: <Type size={16} /> },
  { type: 'h1', label: 'Overskrift 1', keys: 'overskrift heading h1 tittel', icon: <Heading1 size={16} /> },
  { type: 'h2', label: 'Overskrift 2', keys: 'overskrift heading h2', icon: <Heading2 size={16} /> },
  { type: 'todo', label: 'Sjekkliste', keys: 'sjekkliste todo oppgave checkbox', icon: <ListTodo size={16} /> },
  { type: 'bullet', label: 'Punktliste', keys: 'punktliste liste bullet', icon: <List size={16} /> },
  { type: 'quote', label: 'Sitat', keys: 'sitat quote', icon: <Quote size={16} /> },
]

const SHORTCUTS: [RegExp, BlockType][] = [
  [/^##\s/, 'h2'],
  [/^#\s/, 'h1'],
  [/^\[\s?\]\s/, 'todo'],
  [/^[-*]\s/, 'bullet'],
  [/^>\s/, 'quote'],
]

const STYLE: Record<BlockType, string> = {
  p: 'text-[15px] leading-7',
  h1: 'text-2xl font-bold tracking-tight leading-9',
  h2: 'text-lg font-semibold leading-8',
  todo: 'text-[15px] leading-7',
  bullet: 'text-[15px] leading-7',
  quote: 'text-[15px] leading-7 italic text-muted',
}

const SPACING: Record<BlockType, string> = {
  p: 'mt-0.5',
  h1: 'mt-6',
  h2: 'mt-4',
  todo: 'mt-0.5',
  bullet: 'mt-0.5',
  quote: 'my-2',
}

const PLACEHOLDER: Record<BlockType, string> = {
  p: 'Skriv, eller trykk «/» for å velge blokktype …',
  h1: 'Overskrift 1',
  h2: 'Overskrift 2',
  todo: 'Gjøremål',
  bullet: 'Liste',
  quote: 'Sitat',
}

export function PageEditor({ page, onDeleted }: { page: Page; onDeleted: () => void }) {
  const { updatePage, deletePage } = useStore()
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const pendingFocus = useRef<{ id: string; pos: number } | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState<string | null>(null)
  const [iconPicker, setIconPicker] = useState(false)
  const blocks = page.blocks

  // Flytter markøren etter at blokkene er rendret på nytt (ny blokk, sammenslåing osv.).
  useLayoutEffect(() => {
    const f = pendingFocus.current
    if (!f) return
    pendingFocus.current = null
    const el = refs.current.get(f.id)
    if (el) {
      el.focus()
      el.setSelectionRange(f.pos, f.pos)
    }
  })
  const setFocus = (f: { id: string; pos: number }) => {
    pendingFocus.current = f
    // Hvis ingenting endres i data (bare markørflytting), tving en rerender.
    forceRender((n) => n + 1)
  }
  const [, forceRender] = useState(0)

  const setBlocks = (next: Block[]) => updatePage(page.id, { blocks: next })
  const patch = (id: string, p: Partial<Block>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)))

  const slashFor = (b: Block) =>
    b.type === 'p' && b.text.startsWith('/') && slashDismissed !== b.id
      ? BLOCK_OPTIONS.filter((o) => o.keys.includes(b.text.slice(1).toLowerCase().trim()))
      : null

  const applyType = (b: Block, type: BlockType) => {
    patch(b.id, { type, text: '', checked: false })
    setFocus({ id: b.id, pos: 0 })
  }

  const onChange = (b: Block, text: string) => {
    if (b.type === 'p') {
      for (const [re, type] of SHORTCUTS) {
        if (re.test(text)) {
          patch(b.id, { type, text: text.replace(re, '') })
          setFocus({ id: b.id, pos: 0 })
          return
        }
      }
    }
    if (!text.startsWith('/')) setSlashDismissed(null)
    setSlashIndex(0)
    patch(b.id, { text })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, b: Block, index: number) => {
    const el = e.currentTarget
    const start = el.selectionStart
    const atStart = start === 0 && el.selectionEnd === 0

    const options = slashFor(b)
    if (options && options.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % options.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + options.length) % options.length); return }
      if (e.key === 'Enter') { e.preventDefault(); applyType(b, options[Math.min(slashIndex, options.length - 1)].type); return }
      if (e.key === 'Escape') { setSlashDismissed(b.id); return }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const isList = b.type === 'todo' || b.type === 'bullet'
      if ((isList || b.type === 'quote') && b.text === '') {
        patch(b.id, { type: 'p' })
        return
      }
      const next: Block = { id: uid(), type: isList ? b.type : 'p', text: b.text.slice(start), checked: false }
      setBlocks([...blocks.slice(0, index), { ...b, text: b.text.slice(0, start) }, next, ...blocks.slice(index + 1)])
      setFocus({ id: next.id, pos: 0 })
      return
    }

    if (e.key === 'Backspace' && atStart) {
      if (b.type !== 'p') {
        e.preventDefault()
        patch(b.id, { type: 'p' })
        return
      }
      if (index > 0) {
        e.preventDefault()
        const prev = blocks[index - 1]
        setBlocks([...blocks.slice(0, index - 1), { ...prev, text: prev.text + b.text }, ...blocks.slice(index + 1)])
        setFocus({ id: prev.id, pos: prev.text.length })
      }
      return
    }

    if (e.key === 'ArrowUp' && atStart && index > 0) {
      e.preventDefault()
      const prev = blocks[index - 1]
      setFocus({ id: prev.id, pos: prev.text.length })
    }
    if (e.key === 'ArrowDown' && start === b.text.length && index < blocks.length - 1) {
      e.preventDefault()
      setFocus({ id: blocks[index + 1].id, pos: 0 })
    }
  }

  // Klikk under siste blokk: fokuser den, eller lag en ny tom tekstblokk.
  const onClickBelow = () => {
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'p' && last.text === '') {
      setFocus({ id: last.id, pos: 0 })
    } else {
      const nb: Block = { id: uid(), type: 'p', text: '' }
      setBlocks([...blocks, nb])
      setFocus({ id: nb.id, pos: 0 })
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="group/header relative mb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIconPicker(!iconPicker)}
            className="-ml-1 rounded-lg p-1 text-5xl leading-none transition hover:bg-hover"
            aria-label="Velg ikon"
          >
            {page.icon}
          </button>
          <button
            onClick={() => {
              if (confirm('Slette denne siden?')) {
                deletePage(page.id)
                onDeleted()
              }
            }}
            className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-hover hover:text-[#e5484d] md:opacity-0 md:group-hover/header:opacity-100"
            aria-label="Slett side"
          >
            <Trash2 size={16} />
          </button>
        </div>
        {iconPicker && (
          <div className="animate-rise absolute z-20 mt-1 grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface p-2 shadow-xl">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => {
                  updatePage(page.id, { icon: ic })
                  setIconPicker(false)
                }}
                className="grid size-10 place-items-center rounded-lg text-2xl hover:bg-hover"
              >
                {ic}
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        value={page.title}
        onChange={(e) => updatePage(page.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && blocks[0]) {
            e.preventDefault()
            setFocus({ id: blocks[0].id, pos: 0 })
          }
        }}
        placeholder="Uten tittel"
        autoFocus={page.title === ''}
        className="mb-4 w-full bg-transparent text-[34px] font-bold tracking-tight outline-none placeholder:text-faint"
      />

      <div>
        {blocks.map((b, i) => {
          const options = slashFor(b)
          return (
            <div key={b.id} className={`relative flex items-start gap-2.5 ${SPACING[b.type]} ${b.type === 'quote' ? 'border-l-[3px] border-accent/50 pl-4' : ''}`}>
              {b.type === 'todo' && (
                <button
                  onClick={() => patch(b.id, { checked: !b.checked })}
                  className={`mt-[5px] grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition ${
                    b.checked ? 'border-accent bg-accent' : 'border-faint hover:border-accent'
                  }`}
                  aria-label="Huk av"
                >
                  {b.checked && <Check size={12} strokeWidth={3.5} className="animate-pop text-white" />}
                </button>
              )}
              {b.type === 'bullet' && <span className="mt-[13px] ml-1.5 size-[5px] shrink-0 rounded-full bg-fg" />}
              <AutoTextarea
                ref={(el) => {
                  if (el) refs.current.set(b.id, el)
                  else refs.current.delete(b.id)
                }}
                value={b.text}
                placeholder={focusedId === b.id ? PLACEHOLDER[b.type] : b.type === 'h1' || b.type === 'h2' ? PLACEHOLDER[b.type] : ''}
                onFocus={() => setFocusedId(b.id)}
                onBlur={() => setFocusedId((f) => (f === b.id ? null : f))}
                onChange={(t) => onChange(b, t)}
                onKeyDown={(e) => onKeyDown(e, b, i)}
                className={`${STYLE[b.type]} ${b.type === 'todo' && b.checked ? 'text-faint line-through' : ''}`}
              />
              {options && options.length > 0 && focusedId === b.id && (
                <div className="animate-rise absolute top-full left-0 z-20 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-xl">
                  <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">Blokker</p>
                  {options.map((o, oi) => (
                    <button
                      key={o.type}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        applyType(b, o.type)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
                        oi === Math.min(slashIndex, options.length - 1) ? 'bg-hover' : ''
                      }`}
                    >
                      <span className="grid size-7 place-items-center rounded-md border border-line text-muted">{o.icon}</span>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div onClick={onClickBelow} className="min-h-32 flex-1 cursor-text" />
    </div>
  )
}
