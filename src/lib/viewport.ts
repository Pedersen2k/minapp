import { useEffect, useState, type CSSProperties } from 'react'

/**
 * Plasserer et fast overlegg over den synlige delen av skjermen.
 *
 * På iPhone krymper ikke siden når tastaturet kommer opp: et overlegg med «fixed inset-0» blir
 * liggende bak tastaturet, og nettleseren scroller for å vise feltet. visualViewport sier hvor
 * mye som faktisk synes, så kortet nederst kan stå rett over tastaturet.
 */
export function useVisibleViewport(): CSSProperties | undefined {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const keyboard = window.innerHeight - vv.height > 80
      setBox(keyboard ? { top: vv.offsetTop, height: vv.height } : null)
      // iOS har kanskje scrollet hele siden for å vise feltet; legg den tilbake.
      if (keyboard && window.scrollY) window.scrollTo(0, 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return box ? { top: box.top, height: box.height, bottom: 'auto', paddingBottom: 12 } : undefined
}
