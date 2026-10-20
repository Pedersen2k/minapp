import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EyeOff, GripVertical, Maximize2, Minimize2, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { DashboardLayout } from '../lib/settings'

export type CardId = 'hero' | 'weather' | 'power' | 'plan' | 'mail' | 'notes' | 'shortcuts' | 'news'

interface CardMeta {
  label: string
  size: 'small' | 'wide' // standardstørrelse
  compact?: boolean // små kort som får plass to i bredden også på mobil
}

export const CARD_META: Record<CardId, CardMeta> = {
  hero: { label: 'Hilsen og fremdrift', size: 'wide' },
  weather: { label: 'Vær', size: 'small', compact: true },
  power: { label: 'Strømpris', size: 'small', compact: true },
  plan: { label: 'Dagens plan', size: 'wide' },
  mail: { label: 'E-post', size: 'small' },
  notes: { label: 'Notatblokk', size: 'small' },
  shortcuts: { label: 'Snarveier', size: 'wide' },
  news: { label: 'Nyheter', size: 'wide' },
}

const DEFAULT_ORDER = Object.keys(CARD_META) as CardId[]

/** Fyller inn kort som er nye siden oppsettet ble lagret, og fjerner ukjente. */
function normalize(layout?: DashboardLayout): DashboardLayout {
  const known = (id: string): id is CardId => id in CARD_META
  const order = (layout?.order ?? []).filter(known)
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id)
  return { order, hidden: (layout?.hidden ?? []).filter(known), sizes: layout?.sizes ?? {} }
}

interface Props {
  cards: Record<CardId, ReactNode>
  layout?: DashboardLayout
  onLayout: (layout: DashboardLayout | undefined) => void
}

/**
 * Bento-rutenett (2 kolonner på mobil/nettbrett, 4 på brede skjermer) der brukeren kan
 * sortere, skjule og endre størrelse på kortene i «Tilpass»-modus.
 */
export function DashboardGrid({ cards, layout: saved, onLayout }: Props) {
  const layout = normalize(saved)
  const [editing, setEditing] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const visible = layout.order.filter((id) => !layout.hidden.includes(id)) as CardId[]
  const hidden = layout.order.filter((id) => layout.hidden.includes(id)) as CardId[]
  const sizeOf = (id: CardId) => layout.sizes[id] ?? CARD_META[id].size
  const update = (patch: Partial<DashboardLayout>) => onLayout({ ...layout, ...patch })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    update({ order: arrayMove(layout.order, layout.order.indexOf(String(active.id)), layout.order.indexOf(String(over.id))) })
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="-mb-1 flex items-center justify-end gap-2">
        {editing && (
          <button
            onClick={() => confirm('Tilbakestille Min dag til standardoppsettet?') && onLayout(undefined)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-hover hover:text-fg"
          >
            <RotateCcw size={14} /> Tilbakestill
          </button>
        )}
        <button
          onClick={() => setEditing(!editing)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition ${
            editing ? 'bg-accent-gradient text-white shadow-[0_6px_16px_-6px_rgb(91_75_214/0.7)]' : 'border border-glass-border bg-card text-muted hover:bg-card-hover hover:text-fg'
          }`}
        >
          <SlidersHorizontal size={14} /> {editing ? 'Ferdig' : 'Tilpass'}
        </button>
      </div>

      {editing && (
        <p className="animate-fade -mt-1 text-center text-[13px] text-muted">
          Dra kortene for å flytte dem · bytt størrelse eller skjul med knappene på kortet
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <div className="grid grid-flow-row-dense grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            {visible.map((id) => (
              <GridItem
                key={id}
                id={id}
                size={sizeOf(id)}
                editing={editing}
                onToggleSize={() => update({ sizes: { ...layout.sizes, [id]: sizeOf(id) === 'wide' ? 'small' : 'wide' } })}
                onHide={() => update({ hidden: [...layout.hidden, id] })}
              >
                {cards[id]}
              </GridItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editing && hidden.length > 0 && (
        <div className="animate-rise rounded-3xl border-[1.5px] border-dashed border-glass-border p-4">
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Skjulte kort</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((id) => (
              <button
                key={id}
                onClick={() => update({ hidden: layout.hidden.filter((h) => h !== id) })}
                className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-card px-3 py-2 text-sm font-medium hover:bg-card-hover"
              >
                <Plus size={14} className="text-accent" /> {CARD_META[id].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  id: CardId
  size: 'small' | 'wide'
  editing: boolean
  onToggleSize: () => void
  onHide: () => void
  children: ReactNode
}

// Knapper inne i et kort som kan dras: stopp «trykk ned» så de ikke starter et drag.
const noDrag = { onMouseDown: (e: React.MouseEvent) => e.stopPropagation(), onTouchStart: (e: React.TouchEvent) => e.stopPropagation() }

function GridItem({ id, size, editing, onToggleSize, onHide, children }: ItemProps) {
  const s = useSortable({ id, disabled: !editing })
  const span = size === 'wide' ? 'col-span-2' : CARD_META[id].compact ? 'col-span-1' : 'col-span-2 md:col-span-1'
  const btn = 'pointer-events-auto grid size-8 place-items-center rounded-xl bg-surface text-muted shadow-sm hover:text-accent'

  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition, zIndex: s.isDragging ? 10 : undefined }}
      className={`relative min-w-0 ${span} ${editing ? 'cursor-grab touch-manipulation select-none active:cursor-grabbing' : ''} ${s.isDragging ? 'scale-[1.02] opacity-90' : ''}`}
      {...(editing ? { ...s.attributes, ...s.listeners } : {})}
    >
      <div className={`h-full transition ${editing ? 'pointer-events-none scale-[0.98] opacity-70' : ''}`}>{children}</div>
      {editing && (
        <div className="animate-fade pointer-events-none absolute inset-0 flex items-start justify-between gap-2 rounded-3xl bg-accent-soft p-2.5 ring-2 ring-accent/50 ring-inset">
          <span className="flex min-w-0 items-center gap-1 rounded-xl bg-surface px-2.5 py-1.5 text-[13px] font-semibold shadow-sm">
            <GripVertical size={14} className="shrink-0 text-faint" />
            <span className="truncate">{CARD_META[id].label}</span>
          </span>
          <span className="flex shrink-0 gap-1.5">
            <button {...noDrag} onClick={onToggleSize} aria-label={size === 'wide' ? 'Gjør smal' : 'Gjør bred'} title={size === 'wide' ? 'Gjør smal' : 'Gjør bred'} className={btn}>
              {size === 'wide' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button {...noDrag} onClick={onHide} aria-label="Skjul kort" title="Skjul kort" className={btn}>
              <EyeOff size={14} />
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
