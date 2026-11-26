import { useId } from 'react'

/*
 * Små SVG-grafer til kontrollvisningen i «Min dag». Alle bruker fargene --k-* (se index.css)
 * og tegnes i en fast viewBox som skalerer til bredden, så teksten holder samme størrelse.
 */

const gridMax = (values: number[]) => Math.max(4, Math.ceil(Math.max(0, ...values) / 4) * 4)

export interface Flag {
  i: number
  text: string
  color?: string
  anchor?: 'start' | 'end'
}

interface AreaProps {
  values: number[]
  w?: number
  h?: number
  color?: string
  xLabels?: { i: number; text: string }[]
  flags?: Flag[]
  label: string
}

/** Flate med linje, rutenett, tallakse og valgfrie merker for enkeltdager. */
export function AreaChart({ values, w = 600, h = 200, color = 'var(--k-c1)', xLabels = [], flags = [], label }: AreaProps) {
  const id = useId().replace(/:/g, '')
  const L = 26
  const R = 8
  const T = flags.length ? 26 : 10
  const B = xLabels.length ? 20 : 6
  const iw = w - L - R
  const ih = h - T - B
  const max = gridMax(values)
  const n = values.length
  const x = (i: number) => L + (n > 1 ? (iw * i) / (n - 1) : 0)
  const y = (v: number) => T + ih * (1 - v / max)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = values[n - 1] ?? 0

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((k) => {
        const yy = T + (ih * k) / 4
        return (
          <g key={k}>
            <line x1={L} x2={w - R} y1={yy} y2={yy} stroke="var(--k-line)" strokeDasharray={k < 4 ? '2 4' : undefined} />
            <text x={L - 6} y={yy + 3} textAnchor="end" className="k-ax">
              {Math.round(max * (1 - k / 4))}
            </text>
          </g>
        )
      })}
      <path d={`${line} L${x(n - 1)} ${T + ih} L${x(0)} ${T + ih} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {flags.map((f) => (
        <g key={f.i}>
          <line x1={x(f.i)} x2={x(f.i)} y1={T - 4} y2={T + ih} stroke={f.color ?? 'var(--k-mut)'} strokeDasharray="3 3" />
          <circle cx={x(f.i)} cy={y(values[f.i] ?? 0)} r="3.5" fill="var(--k-card)" stroke={f.color ?? 'var(--k-mut)'} strokeWidth="2" />
          <text x={f.anchor === 'end' ? x(f.i) + 4 : x(f.i) - 4} y="13" textAnchor={f.anchor === 'end' ? 'end' : 'start'} className="k-ax" style={{ fill: f.color, fontWeight: 600 }}>
            {f.text}
          </text>
        </g>
      ))}
      {n > 0 && (
        <>
          <circle cx={x(n - 1)} cy={y(last)} r="8" fill={color} opacity="0.2" />
          <circle cx={x(n - 1)} cy={y(last)} r="4" fill={color} />
        </>
      )}
      {xLabels.map((t) => (
        <text key={t.i} x={x(t.i)} y={h - 5} textAnchor={t.i === 0 ? 'start' : t.i === n - 1 ? 'end' : 'middle'} className="k-ax">
          {t.text}
        </text>
      ))}
    </svg>
  )
}

/** Liten kurve uten akser, til nøkkeltall. */
export function Spark({ values, color = 'var(--k-c1)', w = 120, h = 30 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const id = useId().replace(/:/g, '')
  const hi = Math.max(...values)
  const lo = Math.min(...values)
  const x = (i: number) => 2 + ((w - 4) * i) / Math.max(1, values.length - 1)
  const y = (v: number) => 3 + (h - 6) * (1 - (v - lo) / (hi - lo || 1))
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const end = values.length - 1
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${x(end)} ${h} L${x(0)} ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={x(end)} cy={y(values[end])} r="2.4" fill={color} />
    </svg>
  )
}

/** Søyler med én uthevet (for eksempel nåværende time). */
export function Bars({
  values,
  highlight = -1,
  color = 'var(--k-c1)',
  w = 260,
  h = 80,
  xLabels = [],
  label,
}: {
  values: number[]
  highlight?: number
  color?: string
  w?: number
  h?: number
  xLabels?: { i: number; text: string }[]
  label: string
}) {
  const gap = 2
  const bw = (w - gap * (values.length - 1)) / values.length
  const base = xLabels.length ? 14 : 0
  const ih = h - base
  const max = Math.max(...values, 0.0001)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={label}>
      {values.map((v, i) => {
        const bh = Math.max(1.5, (ih * v) / max)
        return <rect key={i} x={i * (bw + gap)} y={ih - bh} width={bw} height={bh} rx="2" fill={i === highlight ? 'var(--k-acc)' : color} opacity={i === highlight ? 1 : 0.55} />
      })}
      {xLabels.map((t) => (
        <text key={t.i} x={t.i * (bw + gap) + bw / 2} y={h - 1} textAnchor="middle" className="k-ax">
          {t.text}
        </text>
      ))}
    </svg>
  )
}

/** Ring som viser andel (0–1) med tekst i midten. */
export function Ring({ share, text, color = 'var(--k-c1)', label }: { share: number; text: string; color?: string; label: string }) {
  const s = 100
  const sw = 11
  const r = (s - sw) / 2
  const c = 2 * Math.PI * r
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width="100%" role="img" aria-label={label}>
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="var(--k-line)" strokeWidth={sw} />
      <circle
        cx={s / 2}
        cy={s / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, Math.max(0, share))} ${c}`}
        transform={`rotate(-90 ${s / 2} ${s / 2})`}
      />
      <text x={s / 2} y={s / 2 + 7} textAnchor="middle" fontSize={text.length > 3 ? 20 : 24} fontWeight="700" fill="var(--k-fg)" className="k-num">
        {text}
      </text>
    </svg>
  )
}

/** Aktivitetsrute: én kolonne per uke, én rad per ukedag. -1 = dag som ikke har kommet. */
export function HeatGrid({ weeks, cell = 11, label }: { weeks: number[][]; cell?: number; label: string }) {
  const gap = 3
  const max = Math.max(1, ...weeks.flat())
  const w = weeks.length * (cell + gap)
  const h = 7 * (cell + gap)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={label}>
      {weeks.map((wk, i) =>
        wk.map((n, j) =>
          n < 0 ? null : (
            <rect
              key={`${i}-${j}`}
              x={i * (cell + gap)}
              y={j * (cell + gap)}
              width={cell}
              height={cell}
              rx={cell > 9 ? 3 : 2}
              fill={n ? 'var(--k-c1)' : 'var(--k-line)'}
              opacity={n ? 0.25 + 0.75 * Math.min(1, n / max) : 1}
            />
          ),
        ),
      )}
    </svg>
  )
}
