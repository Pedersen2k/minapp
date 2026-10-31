import { RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { modKey } from './ui'

const SHOW_MS = 6000

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/**
 * Melding nederst etter sletting og avhuking, med «Angre».
 * Forsvinner etter noen sekunder, men holdes oppe så lenge pekeren er over den.
 * Ctrl/⌘ + Z angrer også (når du ikke skriver i et felt).
 */
export function UndoToast({ raised }: { raised: boolean }) {
  const { undoInfo, undo, dismissUndo } = useStore()
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!undoInfo || paused) return
    const t = setTimeout(dismissUndo, SHOW_MS)
    return () => clearTimeout(t)
  }, [undoInfo, paused, dismissUndo])

  useEffect(() => {
    if (!undoInfo) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoInfo, undo])

  if (!undoInfo) return null

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 md:bottom-6 ${
        raised ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
      }`}
    >
      <div
        key={undoInfo.id}
        role="status"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="animate-rise pointer-events-auto relative flex max-w-md items-center gap-2 overflow-hidden rounded-2xl bg-[#1d1b2e] py-1.5 pr-1.5 pl-4 text-sm text-white shadow-[0_16px_40px_-12px_rgb(20_16_60/0.6)] dark:bg-[#2c2a40]"
      >
        <span className="line-clamp-2 min-w-0 flex-1 py-1 leading-snug">{undoInfo.label}</span>
        <button onClick={undo} className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-[#b9b0ff] hover:bg-white/10">
          <RotateCcw size={14} /> Angre
          <span className="hidden text-xs font-normal text-white/40 md:inline">{modKey} Z</span>
        </button>
        <button onClick={dismissUndo} aria-label="Lukk" className="grid size-8 shrink-0 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white">
          <X size={15} />
        </button>
        {!paused && <span key={`bar-${undoInfo.id}`} className="animate-undo-bar absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#b9b0ff]/60" />}
      </div>
    </div>
  )
}
