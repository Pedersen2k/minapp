import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'

interface Props {
  ref?: (el: HTMLTextAreaElement | null) => void
  value: string
  placeholder?: string
  className?: string
  onChange: (v: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus?: () => void
  onBlur?: () => void
}

/** Tekstfelt som vokser med innholdet. */
export function AutoTextarea({ ref, value, onChange, className = '', ...rest }: Props) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value, className])
  return (
    <textarea
      ref={(el) => {
        inner.current = el
        ref?.(el)
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-faint ${className}`}
      {...rest}
    />
  )
}
