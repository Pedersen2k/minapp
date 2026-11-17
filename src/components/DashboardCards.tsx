import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ExternalLink, Pencil, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { uid } from '../lib/id'
import { ago, fetchKaskjerdaStatus, KASKJERDA_STATUS_URL, statusLevel, type KaskjerdaStatus, type Level } from '../lib/kaskjerda'
import { cheapestAndPriciest, fetchPowerPrices, formatKr, POWER_AREA, type PowerPrices } from '../lib/power'
import type { Settings, Shortcut } from '../lib/settings'

export const bentoTitle = 'flex h-6 items-center justify-between gap-2 text-xs font-semibold tracking-wide text-muted uppercase'

export function BentoCard({ title, action, children, className = '', style }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-3xl border border-glass-border bg-card p-4 md:p-5 ${className}`} style={style}>
      {(title || action) && (
        <h2 className={`${bentoTitle} mb-3`}>
          <span className="truncate">{title}</span>
          {action && <span className="flex shrink-0 items-center gap-1 normal-case">{action}</span>}
        </h2>
      )}
      {children}
    </section>
  )
}

/* ---------- Strømpris ---------- */

const POWER_CACHE = 'minapp:power'

function cachedPower(): { day: string; data: PowerPrices } | null {
  try {
    return JSON.parse(localStorage.getItem(POWER_CACHE) ?? 'null')
  } catch {
    return null
  }
}

export function PowerCard({ className = '' }: { className?: string }) {
  const today = new Date().toDateString()
  const [prices, setPrices] = useState<PowerPrices | null>(() => (cachedPower()?.day === today ? cachedPower()!.data : null))
  const [error, setError] = useState(false)
  const hour = new Date().getHours()

  useEffect(() => {
    // Prisene endres bare én gang i døgnet, så de hentes én gang per dag.
    if (cachedPower()?.day === today) return
    fetchPowerPrices()
      .then((data) => {
        setPrices(data)
        localStorage.setItem(POWER_CACHE, JSON.stringify({ day: today, data }))
      })
      .catch(() => setError(true))
  }, [today])

  const max = prices ? Math.max(...prices.hours) : 1
  const { cheap, dear } = prices ? cheapestAndPriciest(prices.hours) : { cheap: 0, dear: 0 }
  const span = (h: number) => `${String(h).padStart(2, '0')}–${String(h + 2).padStart(2, '0')}`

  return (
    <BentoCard title={`Strøm nå · ${POWER_AREA}`} className={`bg-[linear-gradient(135deg,rgb(34_160_107/0.18),var(--card))] ${className}`}>
      {prices ? (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold tracking-tight md:text-4xl">{formatKr(prices.hours[hour])}</span>
            <span className="text-[13px] text-muted">kr/kWh</span>
          </p>
          <div className="mt-3 flex h-10 items-end gap-[2px]" aria-label="Pris per time i dag" role="img">
            {prices.hours.map((p, h) => (
              <span
                key={h}
                title={`${String(h).padStart(2, '0')}:00 · ${formatKr(p)} kr`}
                className="flex-1 rounded-[2px]"
                style={{
                  height: `${Math.max(8, (p / max) * 100)}%`,
                  background: h === hour ? 'var(--accent)' : h < hour ? 'var(--line)' : p >= max * 0.8 ? '#e5484d99' : p <= max * 0.55 ? '#22a06b99' : 'var(--faint)',
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            <span className="whitespace-nowrap">
              Billigst <b className="text-[#22a06b]">{span(cheap)}</b>
            </span>{' '}
            · <span className="whitespace-nowrap">
              dyrest <b className="text-[#e5484d]">{span(dear)}</b>
            </span>
          </p>
        </>
      ) : (
        <p className="py-3 text-sm text-muted">{error ? 'Kunne ikke hente strømpriser.' : 'Henter strømpriser …'}</p>
      )}
      <p className="mt-auto hidden pt-2 text-[10px] text-faint sm:block">Spotpris inkl. mva, uten nettleie · hvakosterstrommen.no</p>
    </BentoCard>
  )
}

/* ---------- kaskjerda.no-status ---------- */

const KS_CACHE = 'minapp:kaskjerda'
const KS_STALE_MS = 10 * 60 * 1000 // GitHub tillater 60 oppslag i timen uten innlogging

function cachedKaskjerda(): KaskjerdaStatus | null {
  try {
    return JSON.parse(localStorage.getItem(KS_CACHE) ?? 'null')
  } catch {
    return null
  }
}

const LEVEL_COLOR: Record<Level, string> = { ok: '#22a06b', warn: '#f59e0b', bad: '#e5484d' }
const RUN_COLOR = { success: '#22a06b', failure: '#e5484d', progress: 'var(--faint)' }
const RUN_TEXT = { success: 'fint', failure: 'feilet', progress: 'pågår' }

export function KaskjerdaCard({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<KaskjerdaStatus | null>(cachedKaskjerda)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    fetchKaskjerdaStatus()
      .then((s) => {
        setStatus(s)
        setError(false)
        try {
          localStorage.setItem(KS_CACHE, JSON.stringify(s))
        } catch {
          /* full lagring er ikke kritisk */
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && Date.now() - (cachedKaskjerda()?.fetchedAt ?? 0) > KS_STALE_MS) load()
    }
    tick()
    const t = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const verdict = status && statusLevel(status)
  const iconBtn = 'grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg'

  return (
    <BentoCard
      title="kaskjerda.no"
      action={
        <>
          <button onClick={load} disabled={loading} aria-label="Oppdater status" title="Oppdater" className={iconBtn}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href={KASKJERDA_STATUS_URL} target="_blank" rel="noopener" aria-label="Åpne statussiden" title="Åpne statussiden" className={iconBtn}>
            <ExternalLink size={13} />
          </a>
        </>
      }
      className={`bg-[linear-gradient(135deg,rgb(20_184_166/0.16),var(--card))] ${className}`}
    >
      {status && verdict ? (
        <>
          <p className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[verdict.level] }} aria-hidden />
            <span className="text-lg leading-tight font-bold">{verdict.label}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted">{verdict.detail}</p>

          {status.alerts?.map((a) => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener" className="mt-2 block truncate rounded-lg bg-[#e5484d]/10 px-2.5 py-1.5 text-[13px] font-medium text-[#e5484d] hover:underline">
              {a.title}
            </a>
          ))}

          {status.runs && status.runs.length > 0 && (
            <div className="mt-3 flex gap-[3px]" role="img" aria-label={`Siste ${status.runs.length} kjøringer, nyeste til venstre`}>
              {status.runs.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener"
                  title={`${ago(r.at)} · ${RUN_TEXT[r.result]}`}
                  className="h-3 flex-1 rounded-[3px]"
                  style={{ background: RUN_COLOR[r.result] }}
                />
              ))}
            </div>
          )}

          <p className="mt-2 text-xs text-muted">
            {status.events != null && (
              <>
                <b className="text-fg">{status.events}</b> arrangementer
              </>
            )}
            {status.programAt && <> · hentet {ago(status.programAt)}</>}
          </p>

          {(status.today.length > 0 || status.next.length > 0) && (
            <div className="mt-auto space-y-1 border-t border-glass-border pt-2.5 text-[13px]">
              {status.today.map((t) => (
                <p key={t.title} className="truncate">
                  <span className="font-semibold text-accent">I dag</span> · {t.title} <span className="text-faint">({t.who})</span>
                </p>
              ))}
              {status.next[0] && (
                <p className="truncate" title={status.next[0].text}>
                  <span className="font-semibold text-muted">Neste</span> · {status.next[0].title}
                </p>
              )}
            </div>
          )}
          {error && <p className="mt-1 text-[11px] text-faint">Viser forrige status, fikk ikke oppdatert.</p>}
        </>
      ) : (
        <p className="py-3 text-sm text-muted">{error ? 'Kunne ikke hente status.' : 'Henter status …'}</p>
      )}
    </BentoCard>
  )
}

/* ---------- Notatblokk ---------- */

export function NotesCard({ settings, onSave, className = '' }: { settings: Settings; onSave: (p: Partial<Settings>) => Promise<void>; className?: string }) {
  const [text, setText] = useState(settings.notes ?? '')
  const [saved, setSaved] = useState(true)
  const timer = useRef<number | undefined>(undefined)
  const editing = useRef(false)

  // Oppdater fra andre enheter, men aldri midt i skrivingen.
  useEffect(() => {
    if (!editing.current) setText(settings.notes ?? '')
  }, [settings.notes])

  const change = (v: string) => {
    editing.current = true
    setText(v)
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      await onSave({ notes: v }).catch(() => {})
      setSaved(true)
      editing.current = false
    }, 800)
  }

  return (
    <BentoCard
      title={<span className="text-[#b8930f] dark:text-[#e7c75b]">Notatblokk</span>}
      action={<span className="text-[11px] font-medium text-faint">{saved ? 'Lagret' : 'Lagrer …'}</span>}
      className={`border-[#facc15]/25 bg-[#facc15]/[0.07] ${className}`}
    >
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder="Skriv ned noe raskt …"
        aria-label="Notatblokk"
        className="min-h-36 w-full flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
      />
    </BentoCard>
  )
}

/* ---------- Snarveier ---------- */

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`)

const TILE_COLORS = ['#6a5ae0', '#0ea5e9', '#22a06b', '#f59e0b', '#ec4899', '#14b8a6', '#e5484d', '#8b5cf6']
const tileColor = (s: string) => TILE_COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % TILE_COLORS.length]

function ShortcutIcon({ shortcut }: { shortcut: Shortcut }) {
  const [failed, setFailed] = useState(false)
  const host = hostOf(shortcut.url)
  return (
    <span className="grid size-12 place-items-center overflow-hidden rounded-2xl border border-glass-border bg-surface shadow-sm md:size-[52px]">
      {failed ? (
        <span className="grid size-full place-items-center text-lg font-bold text-white" style={{ background: tileColor(host) }}>
          {shortcut.name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" className="size-7" onError={() => setFailed(true)} />
      )}
    </span>
  )
}

function SortableShortcut({ shortcut, editMode, onEdit }: { shortcut: Shortcut; editMode: boolean; onEdit: () => void }) {
  const s = useSortable({ id: shortcut.id, disabled: !editMode })
  const body = (
    <>
      <ShortcutIcon shortcut={shortcut} />
      <span className="w-full truncate text-center text-xs">{shortcut.name}</span>
    </>
  )
  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition, opacity: s.isDragging ? 0.5 : undefined }}
      className="relative"
      {...(editMode ? { ...s.attributes, ...s.listeners } : {})}
    >
      {editMode ? (
        <button onClick={onEdit} className="flex w-full animate-[pulse_2.5s_ease-in-out_infinite] flex-col items-center gap-1.5 rounded-2xl p-1.5 hover:bg-hover">
          {body}
          <span className="absolute top-0 right-1 grid size-5 place-items-center rounded-full bg-accent text-white shadow">
            <Pencil size={10} />
          </span>
        </button>
      ) : (
        <a href={shortcut.url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 rounded-2xl p-1.5 transition hover:-translate-y-0.5 hover:bg-hover">
          {body}
        </a>
      )}
    </div>
  )
}

export function ShortcutsCard({ settings, onSave, className = '' }: { settings: Settings; onSave: (p: Partial<Settings>) => Promise<void>; className?: string }) {
  const shortcuts = settings.shortcuts ?? []
  const [editMode, setEditMode] = useState(false)
  const [editing, setEditing] = useState<Shortcut | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )
  const setShortcuts = (next: Shortcut[]) => onSave({ shortcuts: next })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setShortcuts(arrayMove(shortcuts, shortcuts.findIndex((s) => s.id === active.id), shortcuts.findIndex((s) => s.id === over.id)))
  }

  return (
    <BentoCard
      title="Snarveier"
      className={className}
      action={
        <>
          {shortcuts.length > 0 && (
            <button onClick={() => setEditMode(!editMode)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${editMode ? 'bg-accent text-white' : 'text-accent hover:bg-hover'}`}>
              {editMode ? 'Ferdig' : 'Rediger'}
            </button>
          )}
          <button onClick={() => setImporting(true)} title="Importer bokmerker" aria-label="Importer bokmerker" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <Upload size={14} />
          </button>
          <button onClick={() => setEditing('new')} title="Ny snarvei" aria-label="Ny snarvei" className="grid size-7 place-items-center rounded-lg text-accent hover:bg-hover">
            <Plus size={16} />
          </button>
        </>
      }
    >
      {shortcuts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <p className="text-sm text-muted">Samle nettstedene du bruker mest her.</p>
          <div className="flex gap-2">
            <button onClick={() => setEditing('new')} className="bg-accent-gradient rounded-xl px-3.5 py-2 text-sm font-semibold text-white">
              Legg til snarvei
            </button>
            <button onClick={() => setImporting(true)} className="rounded-xl border border-glass-border bg-surface px-3.5 py-2 text-sm font-semibold">
              Importer bokmerker
            </button>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shortcuts.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1">
              {shortcuts.map((s) => (
                <SortableShortcut key={s.id} shortcut={s} editMode={editMode} onEdit={() => setEditing(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {editMode && <p className="mt-2 text-center text-xs text-muted">Dra for å sortere · trykk for å redigere</p>}

      {editing && (
        <ShortcutDialog
          shortcut={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            setShortcuts(editing === 'new' ? [...shortcuts, s] : shortcuts.map((x) => (x.id === s.id ? s : x)))
            setEditing(null)
          }}
          onDelete={(id) => {
            setShortcuts(shortcuts.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}
      {importing && (
        <ImportDialog
          existing={shortcuts}
          onClose={() => setImporting(false)}
          onImport={(added) => {
            setShortcuts([...shortcuts, ...added])
            setImporting(false)
          }}
        />
      )}
    </BentoCard>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise flex max-h-[85dvh] w-full max-w-md flex-col rounded-[28px] p-5">
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

const input = 'w-full rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent'

function ShortcutDialog({ shortcut, onClose, onSave, onDelete }: { shortcut: Shortcut | null; onClose: () => void; onSave: (s: Shortcut) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState(shortcut?.name ?? '')
  const [url, setUrl] = useState(shortcut?.url ?? '')
  const valid = url.trim().includes('.')
  const save = () => {
    if (!valid) return
    const full = normalizeUrl(url)
    onSave({ id: shortcut?.id ?? uid(), url: full, name: name.trim() || hostOf(full) })
  }
  return (
    <Modal title={shortcut ? 'Rediger snarvei' : 'Ny snarvei'} onClose={onClose}>
      <label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor="sc-url">Adresse</label>
      <input id="sc-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="nrk.no" className={`${input} mb-4`} />
      <label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor="sc-name">Navn</label>
      <input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder={valid ? hostOf(normalizeUrl(url)) : 'NRK'} className={input} />
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        {shortcut ? (
          <button onClick={() => onDelete(shortcut.id)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#e5484d] hover:bg-hover">
            <Trash2 size={15} /> Slett
          </button>
        ) : (
          <span />
        )}
        <button disabled={!valid} onClick={save} className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Lagre
        </button>
      </div>
    </Modal>
  )
}

/** Leser en eksportert bokmerkefil (HTML fra Chrome, Edge, Firefox eller Safari). */
function parseBookmarks(html: string): { name: string; url: string }[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Set<string>()
  return [...doc.querySelectorAll('a[href]')]
    .map((a) => ({ name: (a.textContent ?? '').trim(), url: a.getAttribute('href') ?? '' }))
    .filter((b) => /^https?:\/\//.test(b.url) && !seen.has(b.url) && seen.add(b.url))
}

function ImportDialog({ existing, onClose, onImport }: { existing: Shortcut[]; onClose: () => void; onImport: (s: Shortcut[]) => void }) {
  const [items, setItems] = useState<{ name: string; url: string }[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const have = new Set(existing.map((s) => s.url))
  const shown = (items ?? []).filter((b) => !have.has(b.url) && `${b.name} ${b.url}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <Modal title="Importer bokmerker" onClose={onClose}>
      {!items ? (
        <>
          <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>
              I Chrome eller Edge: åpne <b className="text-fg">Bokmerkebehandling</b> (Ctrl+Shift+O).
            </li>
            <li>
              Klikk <b className="text-fg">⋮</b> og velg <b className="text-fg">Eksporter bokmerker</b>.
            </li>
            <li>Velg filen her. Den leses bare på denne enheten og lastes ikke opp noe sted.</li>
          </ol>
          <label className="bg-accent-gradient flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white">
            <Upload size={16} /> Velg bokmerkefil (.html)
            <input
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) setItems(parseBookmarks(await file.text()))
              }}
            />
          </label>
        </>
      ) : (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Søk i ${items.length} bokmerker …`} aria-label="Søk i bokmerker" className={`${input} mb-3`} />
          <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto">
            {shown.map((b) => {
              const on = picked.has(b.url)
              return (
                <li key={b.url}>
                  <button
                    onClick={() => setPicked((p) => (p.has(b.url) ? new Set([...p].filter((u) => u !== b.url)) : new Set(p).add(b.url)))}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover"
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] ${on ? 'border-accent bg-accent text-white' : 'border-faint'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(b.url))}&sz=32`} alt="" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{b.name || hostOf(b.url)}</span>
                      <span className="block truncate text-xs text-faint">{hostOf(b.url)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">Ingen bokmerker å vise.</li>}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-muted">{picked.size} valgt</span>
            <button
              disabled={!picked.size}
              onClick={() =>
                onImport(
                  (items ?? [])
                    .filter((b) => picked.has(b.url))
                    .map((b) => ({ id: uid(), url: b.url, name: (b.name || hostOf(b.url)).slice(0, 40) })),
                )
              }
              className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Legg til
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

