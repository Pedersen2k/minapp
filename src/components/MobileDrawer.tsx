import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Så nær venstre kant (px) må fingeren starte for å dra menyen inn. */
const EDGE = 24
/** Fart (px/ms) som avgjør retningen uansett hvor langt du har dratt. */
const FLICK = 0.35
const GAP = 8 // avstand fra skjermkanten når menyen er åpen

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
 * Sidemenyen på mobil. Dras inn med fingeren fra venstre kant og dras ut igjen mot venstre,
 * og følger fingeren underveis. Knappen i toppen åpner den også.
 */
export function MobileDrawer({ open, onOpenChange, disabled, children }: { open: boolean; onOpenChange: (open: boolean) => void; disabled?: boolean; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null)
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
    const width = () => (panel.current?.offsetWidth ?? 300) + GAP

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
  const visible = p > 0

  return (
    <div className={`fixed inset-0 z-40 md:hidden ${visible ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-black/30"
        style={{ opacity: p, transition: dragging ? 'none' : 'opacity 0.28s ease' }}
        onClick={() => onOpenChange(false)}
      />
      <aside
        ref={panel}
        inert={!open}
        className="glass-strong absolute inset-y-2 left-2 w-[82%] max-w-[300px] overflow-hidden rounded-3xl will-change-transform"
        style={{
          transform: `translateX(calc(${(p - 1) * 100}% - ${(1 - p) * (GAP + 16)}px))`,
          transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.2, 0.9, 0.25, 1)',
        }}
      >
        {children}
      </aside>
    </div>
  )
}
