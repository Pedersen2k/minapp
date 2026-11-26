import { ExternalLink, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ago, statusLevel, type KaskjerdaStatus, type Level } from '../lib/kaskjerda'
import { dayLabels, doneByDay, heatWeeks, useKaskjerda, usePower } from '../lib/kontroll'
import { cheapestAndPriciest, formatKr } from '../lib/power'
import type { Task } from '../lib/types'
import { AreaChart, Bars, HeatGrid, Ring, Spark } from './charts'

interface Props {
  tasks: Task[]
  /** Uleste e-poster, eller null når Gmail ikke er koblet til. */
  unread: number | null
  /** Dagens plan, ferdig tegnet av Dashboard. */
  planList: ReactNode
  planCount: number
  doneToday: number
  overdue: number
  greeting: string
  dateText: string
  hint: string
}

const TONE: Record<Level, string> = { ok: 'var(--k-good)', warn: 'var(--k-warn)', bad: 'var(--k-bad)' }
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const HOURS = [0, 6, 12, 18, 23].map((i) => ({ i, text: String(i).padStart(2, '0') }))

/** Kontrollvisningen i «Min dag»: Cockpit på PC og Radar på mobil, med samme tall. */
export function Kontroll(props: Props) {
  const { tasks, unread, doneToday, overdue, planCount } = props
  const ks = useKaskjerda()
  const power = usePower()

  const done28 = doneByDay(tasks, 28)
  const done14 = done28.slice(-14)
  const weekNow = sum(done28.slice(-7))
  const weekPrev = sum(done28.slice(-14, -7))
  const hour = new Date().getHours()
  const total = doneToday + planCount

  const runs = ks.status?.runs ?? null
  const finished = runs?.filter((r) => r.result !== 'progress') ?? []
  const okShare = finished.length ? finished.filter((r) => r.result === 'success').length / finished.length : null
  const verdict = ks.status ? statusLevel(ks.status) : null
  const alertCount = ks.status?.alerts?.length ?? null
  const attention = (alertCount ?? 0) + (runs?.[0]?.result === 'failure' ? 1 : 0)
  const priceNow = power.prices?.hours[hour]

  const alerts = <AlertList status={ks.status} error={ks.error} />
  const powerBars = power.prices && (
    <Bars values={power.prices.hours} highlight={hour} w={260} h={74} xLabels={HOURS} color="var(--k-c2)" label="Strømpris per time i dag" />
  )
  const heat = <HeatGrid weeks={heatWeeks(tasks, 26)} cell={11} label="Fullførte oppgaver per dag, siste 26 uker" />
  const runStrip = <RunStrip status={ks.status} />

  return (
    <div className="kontroll">
      {/* ---------- PC: Cockpit ---------- */}
      <div className="hidden flex-col gap-3 md:flex">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-medium text-muted first-letter:uppercase">{props.dateText}</p>
            <h1 className="text-[34px] leading-tight font-bold tracking-[-0.03em]">{props.greeting}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {verdict && <Pill tone={verdict.level}>{verdict.label}</Pill>}
            {attention > 0 && <Pill tone="warn">{attention} trenger deg</Pill>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
          <Kpi title="Åpne varsler" value={alertCount === null ? '–' : String(alertCount)} note={ks.error ? 'Fikk ikke svar' : 'kaskjerda.no'} tone={alertCount ? 'warn' : 'ok'} hot={!!alertCount} />
          <Kpi title="Kjøringer ok" value={okShare === null ? '–' : String(Math.round(okShare * 100))} unit={okShare === null ? '' : '%'} note={finished.length ? `${finished.filter((r) => r.result === 'success').length} av ${finished.length}` : 'Ingen data'} tone={okShare === null || okShare === 1 ? 'ok' : 'warn'} spark={runs?.length ? [...runs].reverse().map((r) => (r.result === 'success' ? 2 : r.result === 'failure' ? 0 : 1)) : undefined} sparkColor="var(--k-good)" />
          <Kpi title="Oppgaver i dag" value={String(doneToday)} unit={`/ ${total}`} note={overdue ? `${overdue} forfalt` : 'Ingen forfalte'} tone={overdue ? 'bad' : 'ok'} spark={done14} sparkColor="var(--k-c3)" />
          <Kpi title="Denne uka" value={String(weekNow)} unit="fullført" note={weekPrev ? `${weekNow >= weekPrev ? '▲' : '▼'} ${Math.abs(weekNow - weekPrev)} mot uka før` : 'Første uke'} tone={weekNow >= weekPrev ? 'ok' : 'warn'} />
          <Kpi title="Uleste e-post" value={unread === null ? '–' : String(unread)} note={unread === null ? 'Ikke koblet til' : 'i innboksen'} tone="ok" />
          <Kpi title="Strøm nå" value={priceNow === undefined ? '–' : formatKr(priceNow)} unit="kr" note={power.prices ? `dyrest kl. ${String(cheapestAndPriciest(power.prices.hours).dear).padStart(2, '0')}` : power.error ? 'Utilgjengelig' : 'Henter …'} tone="ok" spark={power.prices?.hours} sparkColor="var(--k-c2)" />
        </div>

        <div className="grid gap-3 xl:grid-cols-[2.4fr_1fr]">
          <Panel title="Fullførte oppgaver · 28 dager" action={<span className="k-sub">{sum(done28)} totalt</span>}>
            <AreaChart values={done28} w={760} h={250} xLabels={dayLabels(28)} label="Fullførte oppgaver per dag, siste 28 dager" />
          </Panel>
          <Panel title="GitHub · varsler" hot={attention > 0} action={<RefreshBtn loading={ks.loading} onClick={ks.reload} />}>
            {alerts}
          </Panel>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1.25fr]">
          <Panel title="Dagens plan">
            {props.planList}
          </Panel>
          <Panel title="Kjøringer" action={<span className="k-sub">siste 12</span>}>
            {runStrip}
            <KsFacts status={ks.status} />
          </Panel>
          <Panel title="Strøm i dag" action={<span className="k-sub">kr/kWh</span>}>
            {powerBars ?? <p className="text-sm text-muted">{power.error ? 'Kunne ikke hente strømpriser.' : 'Henter strømpriser …'}</p>}
          </Panel>
          <Panel title="Aktivitet" action={<span className="k-sub">26 uker</span>}>
            {heat}
          </Panel>
        </div>
      </div>

      {/* ---------- Mobil: Radar ---------- */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="px-1">
          <p className="text-sm font-medium text-muted first-letter:uppercase">{props.dateText}</p>
          <h1 className="text-[30px] leading-tight font-bold tracking-[-0.03em]">{props.greeting}</h1>
          <p className="mt-0.5 text-sm text-muted">{attention > 0 ? `${attention} ting trenger deg` : props.hint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RingCard share={okShare ?? 0} text={okShare === null ? '–' : `${Math.round(okShare * 100)}%`} color="var(--k-c2)" title="kaskjerda.no" note={verdict?.label ?? 'Henter …'} />
          <RingCard share={total ? doneToday / total : 0} text={`${doneToday}/${total}`} color="var(--k-c1)" title="Oppgaver i dag" note={overdue ? `${overdue} forfalt` : 'Ingen forfalte'} />
          <RingCard share={priceNow !== undefined && power.prices ? priceNow / Math.max(...power.prices.hours) : 0} text={priceNow === undefined ? '–' : formatKr(priceNow)} color="var(--k-c3)" title="Strøm nå" note="kr/kWh" />
          <RingCard share={weekNow / Math.max(1, weekNow, weekPrev)} text={String(weekNow)} color="var(--k-c1)" title="Denne uka" note={weekPrev ? `uka før: ${weekPrev}` : 'fullført'} />
        </div>
        <Panel title="GitHub · varsler" hot={attention > 0} action={<RefreshBtn loading={ks.loading} onClick={ks.reload} />}>
          {alerts}
        </Panel>
        <Panel title="Dagens plan">{props.planList}</Panel>
        <Panel title="Fullførte oppgaver · 28 dager">
          <AreaChart values={done28} w={300} h={130} xLabels={[dayLabels(28)[0], dayLabels(28)[4]]} label="Fullførte oppgaver per dag, siste 28 dager" />
        </Panel>
        <Panel title="Aktivitet · 26 uker">{heat}</Panel>
        <Panel title="Strøm i dag" action={<span className="k-sub">kr/kWh</span>}>
          {powerBars ?? <p className="text-sm text-muted">{power.error ? 'Kunne ikke hente strømpriser.' : 'Henter strømpriser …'}</p>}
        </Panel>
        {unread !== null && <p className="px-1 text-center text-xs text-faint">{unread} uleste e-poster</p>}
      </div>
    </div>
  )
}

/* ---------- Delte deler ---------- */

function Panel({ title, action, hot, className = '', children }: { title: string; action?: ReactNode; hot?: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={`k-card min-w-0 ${hot ? 'k-hot' : ''} ${className}`}>
      <h2 className="k-ttl">
        <span className="truncate">{title}</span>
        {action}
      </h2>
      {children}
    </section>
  )
}

function Kpi({ title, value, unit, note, tone, spark, sparkColor, hot }: { title: string; value: string; unit?: string; note: string; tone: Level; spark?: number[]; sparkColor?: string; hot?: boolean }) {
  return (
    <div className={`k-card min-w-0 gap-1 ${hot ? 'k-hot' : ''}`}>
      <p className="k-ttl !mb-0">{title}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="k-num text-[28px] leading-none">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
      <p className="truncate text-[11px] font-semibold" style={{ color: tone === 'ok' ? 'var(--k-mut)' : TONE[tone] }}>
        {note}
      </p>
      {spark && spark.length > 1 && (
        <div className="mt-1">
          <Spark values={spark} color={sparkColor} />
        </div>
      )}
    </div>
  )
}

function RingCard({ share, text, color, title, note }: { share: number; text: string; color: string; title: string; note: string }) {
  return (
    <div className="k-card items-center text-center">
      <div className="w-[88px]">
        <Ring share={share} text={text} color={color} label={`${title}: ${text}`} />
      </div>
      <p className="mt-1 text-[13px] font-semibold">{title}</p>
      <p className="text-[11px] text-muted">{note}</p>
    </div>
  )
}

function Pill({ tone, children }: { tone: Level; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${TONE[tone]} 16%, transparent)`, color: TONE[tone] }}>
      <span className="size-1.5 rounded-full" style={{ background: TONE[tone] }} />
      {children}
    </span>
  )
}

function RefreshBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} aria-label="Oppdater" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
    </button>
  )
}

function AlertList({ status, error }: { status: KaskjerdaStatus | null; error: boolean }) {
  if (!status) return <p className="text-sm text-muted">{error ? 'Fikk ikke kontakt med GitHub.' : 'Henter varsler …'}</p>
  const rows: { level: Level; title: string; meta: string; url?: string }[] = []
  for (const a of status.alerts ?? []) rows.push({ level: 'warn', title: a.title, meta: 'skjer-i-alesund · åpent', url: a.url })
  const last = status.runs?.[0]
  if (last?.result === 'failure') rows.push({ level: 'bad', title: 'Siste kjøring feilet', meta: `oppdater.yml · ${ago(last.at)}`, url: last.url })
  if (status.alerts === null) rows.push({ level: 'warn', title: 'Fikk ikke hente varsler fra GitHub', meta: 'prøver igjen automatisk' })
  if (!rows.length) rows.push({ level: 'ok', title: 'Ingen åpne varsler', meta: statusLevel(status).detail })
  return (
    <ul>
      {rows.map((r, i) => {
        const body = (
          <>
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: TONE[r.level], boxShadow: r.level === 'ok' ? undefined : `0 0 8px ${TONE[r.level]}` }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] leading-snug font-semibold">{r.title}</span>
              <span className="block text-[11px] text-muted">{r.meta}</span>
            </span>
            {r.url && <ExternalLink size={12} className="mt-1 shrink-0 text-faint" />}
          </>
        )
        const cls = `flex gap-2.5 py-2 ${i ? 'border-t border-[var(--k-line)]' : ''}`
        return (
          <li key={i}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className={`${cls} hover:opacity-80`}>
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RunStrip({ status }: { status: KaskjerdaStatus | null }) {
  const runs = status?.runs
  if (!runs?.length) return <p className="text-sm text-muted">{status ? 'Ingen kjøringer å vise.' : 'Henter …'}</p>
  const color = { success: 'var(--k-good)', failure: 'var(--k-bad)', progress: 'var(--k-mut)' }
  return (
    <div className="flex gap-[3px]" role="img" aria-label="Siste kjøringer, eldste til venstre">
      {[...runs].reverse().map((r, i) => (
        <span key={i} title={`${ago(r.at)}`} className="h-4 flex-1 rounded-[3px]" style={{ background: color[r.result] }} />
      ))}
    </div>
  )
}

function KsFacts({ status }: { status: KaskjerdaStatus | null }) {
  if (!status) return null
  return (
    <div className="mt-4 grid gap-3">
      <div>
        <p className="k-ttl !mb-0.5">Programmets alder</p>
        <p className="k-num text-xl">{status.programAt ? ago(status.programAt).replace(' siden', '') : '–'}</p>
      </div>
      <p className="text-xs text-muted">
        Nye arrangementer siste døgn: <b className="text-fg">+{status.newCount}</b>
      </p>
    </div>
  )
}
