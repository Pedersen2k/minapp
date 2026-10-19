import type { ReactNode } from 'react'
import type { Priority } from '../lib/types'

export const PRIORITY_COLOR: Record<Priority, string> = {
  1: '#e5484d',
  2: '#f59e0b',
  3: '#3b82f6',
  4: 'var(--faint)',
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted">
      {children}
    </kbd>
  )
}

export function Chip({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${className}`}
      style={color ? { color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
    >
      {children}
    </span>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const modKey = isMac ? '⌘' : 'Ctrl'
