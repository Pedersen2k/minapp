import { Bell, Inbox } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { todayISO } from '../lib/date'
import { isInInbox } from '../lib/inbox'
import { useStore } from '../lib/store'

/** Så nær venstre kant (px) må fingeren starte for å dra menyen inn. */
const EDGE = 24
/** Fart (px/ms) som avgjør retningen uansett hvor langt du har dratt. */
const FLICK = 0.35
/** Hvor langt innholdet flyttes når menyen er helt åpen (andel av skjermbredden). Samme tall som i index.css. */
const TRAVEL = 0.72
/** Tid for animasjonen når fingeren slipper. Samme som i index.css. */
const SETTLE_MS = 380

interface Drag {
  startX: number
  startY: number
  startT: number
  base: number // hvor menyen sto da dragningen startet (0 = lukket, 1 = åpen)
  lastX: number
  lastT: number
  claimed: boolean // vi har bestemt at dette er en sidelengs dragning
}

/**
 * Sidemenyen på mobil («Dagbok»): innholdet vris bort som et bokomslag, og bak ligger
 * dagens oversikt og menyen. Dras inn fra venstre kant og ut igjen mot venstre, og følger
 * fingeren underveis. Knappen i toppen åpner den også.
 *
 * Selve vridningen gjøres i CSS (.book-page i index.css) ut fra --drawer-p på <html>,
 * og bare mens menyen er i bruk, så faste elementer i innholdet ellers oppfører seg normalt.
 */
export function MobileDrawer({ open, onOpenChange, disabled, children }: { open: boolean; onOpenChange: (open: boolean) => void; disabled?: boolean; children: ReactNode }) {
  const drag = useRef<Drag | null>(null)
  const [progress, setProgress] = useState<number | null>(null) // 0–1 mens fingeren drar
  const openRef = useRef(open)
  const disabledRef = useRef(disabled)
  useLayoutEffect(() => {
    openRef.current = open
    disabledRef.current = disabled
  })

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const width = () => window.innerWidth * TRAVEL

    const onStart = (e: TouchEvent) => {
      if (!mobile.matches || disabledRef.current || e.touches.length !== 1) return
      const t = e.touches[0]
      // Lukket: bare fra kanten. Åpen: hvor som helst (på menyen eller bakgrunnen).
      if (!openRef.current && t.clientX > EDGE) return
      drag.current = { startX: t.clientX, startY: t.clientY, startT: e.timeStamp, base: openRef.current ? 1 : 0, lastX: t.clientX, lastT: e.timeStamp, claimed: false }
    }

    const onMove = (e: TouchEvent) => {
      const d = drag.current
      if (!d) return
      const t = e.touches[0]
      const dx = t.clientX - d.startX
      const dy = t.clientY - d.startY
      if (!d.claimed) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Mest loddrett, eller feil vei: la siden scrolle som vanlig.
        if (Math.abs(dy) > Math.abs(dx) || (d.base === 0 && dx < 0) || (d.base === 1 && dx > 0)) {
          drag.current = null
          return
        }
        d.claimed = true
      }
      e.preventDefault()
      d.lastX = t.clientX
      d.lastT = e.timeStamp
      setProgress(Math.min(1, Math.max(0, d.base + dx / width())))
    }

    const onEnd = (e: TouchEvent) => {
      const d = drag.current
      drag.current = null
      if (!d?.claimed) return
      const end = e.changedTouches[0]?.clientX ?? d.lastX
      const p = Math.min(1, Math.max(0, d.base + (end - d.startX) / width()))
      const speed = (end - d.startX) / Math.max(1, e.timeStamp - d.startT)
      const next = speed > FLICK ? true : speed < -FLICK ? false : p > 0.5
      setProgress(null)
      if (next !== openRef.current) onOpenChange(next)
    }

    const onCancel = () => {
      drag.current = null
      setProgress(null)
    }

    // touchmove må kunne stoppe scrolling, derfor ikke passiv.
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onCancel)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
    }
  }, [onOpenChange])

  const p = progress ?? (open ? 1 : 0)
  const dragging = progress !== null

  // Styr vridningen av innholdet. Attributtet fjernes først når lukkeanimasjonen er ferdig.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--drawer-p', p.toFixed(4))
    if (p > 0 || dragging) {
      root.dataset.drawer = dragging ? 'drag' : 'on'
      return
    }
    if (!root.dataset.drawer) return
    root.dataset.drawer = 'on'
    const t = setTimeout(() => delete root.dataset.drawer, SETTLE_MS)
    return () => clearTimeout(t)
  }, [p, dragging])

  // Trykk på det vridde innholdet lukker menyen i stedet for å trykke på det som står der.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.book-page')) return
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(false)
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [open, onOpenChange])

  const visible = p > 0

  return (
    <div
      className={`dark fixed inset-0 z-0 text-fg md:hidden ${visible ? '' : 'pointer-events-none invisible'}`}
      style={{ background: 'radial-gradient(120% 70% at 0% 0%, #3446a8 0, transparent 60%), radial-gradient(80% 60% at 100% 100%, #6b3fa8 0, transparent 60%), #10142e' }}
      aria-hidden={!open}
    >
      <aside
        inert={!open}
        className="h-full w-[70%] max-w-[300px] origin-left"
        style={{
          opacity: 0.2 + p * 0.8,
          transform: `scale(${0.92 + p * 0.08})`,
          transition: dragging ? 'none' : `opacity ${SETTLE_MS}ms ease, transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.9, 0.25, 1)`,
        }}
      >
        {children}
      </aside>
    </div>
  )
}

/** Dagens oversikt øverst i mobilmenyen: fremdrift, neste avtale og innboksen. */
export function DayCard() {
  const { tasks } = useStore()
  const today = todayISO()
  const startOfDay = new Date(`${today}T00:00`).getTime()
  const doneToday = tasks.filter((t) => t.done && (t.completedAt ?? 0) >= startOfDay).length
  const left = tasks.filter((t) => !t.done && t.due && t.due <= today)
  const total = doneToday + left.length
  const now = new Date().toTimeString().slice(0, 5)
  const next = left.filter((t) => t.due === today && t.time && t.time >= now).sort((a, b) => a.time!.localeCompare(b.time!))[0]
  const inbox = tasks.filter((t) => !t.done && isInInbox(t)).length
  const date = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-3 mb-3 grid gap-2.5 rounded-[20px] border border-white/15 bg-white/10 p-4 text-white">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[28px] leading-none font-extrabold tracking-tight tabular-nums">
            {doneToday}/{total}
          </div>
          <div className="mt-1 text-xs text-white/65 first-letter:uppercase">gjort i dag · {date}</div>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8fa2ff] to-[#d3a6ff] transition-[width] duration-500" style={{ width: `${total ? (doneToday / total) * 100 : 0}%` }} />
      </div>
      {next ? (
        <div className="flex items-center gap-2 text-[12.5px] text-white/85">
          <Bell size={13} className="shrink-0" />
          <span className="truncate">Neste: {next.title} kl. {next.time}</span>
        </div>
      ) : (
        <div className="text-[12.5px] text-white/70">{left.length ? `${left.length} igjen i dag` : 'Ingenting igjen i dag'}</div>
      )}
      {inbox > 0 && (
        <div className="flex items-center gap-2 text-[12.5px] text-white/70">
          <Inbox size={13} className="shrink-0" /> {inbox} i innboksen
        </div>
      )}
    </div>
  )
}
