import { ExternalLink, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { countryName, pageLabel, useBesok, weekChange, type Besok, type BesokState } from '../lib/besok'
import { ago, statusLevel, type KaskjerdaStatus, type Level } from '../lib/kaskjerda'
import { dayLabels, doneByDay, heatWeeks, useKaskjerda, usePower } from '../lib/kontroll'
import { DEFAULT_THRESHOLDS, evaluateSignals, type ContextFilter, type Signal, type Thresholds } from '../lib/kontekst'
import { cheapestAndPriciest, formatKr } from '../lib/power'
import type { Task } from '../lib/types'
import { AreaChart, Bars, HeatGrid, Ring, Spark } from './charts'

/** Post til domenet kaskjerda.no fra Gmail-skriptet. Null når Gmail ikke er koblet til. */
export interface KaskjerdaMail {
  unread?: number
  mails?: { id: string; from: string; subject: string; url: string; date: string }[]
  error?: string
}

/** Uleste GitHub-varsler i Gmail. Null når Gmail ikke er koblet til. */
export type GithubMail = KaskjerdaMail

interface Props {
  tasks: Task[]
  githubMail: GithubMail | null
  kaskjerdaMail: KaskjerdaMail | null
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
  context: ContextFilter
  onContext: (f: ContextFilter) => void
  hasJobProjects: boolean
  thresholds?: Thresholds
  onThresholds: (t: Thresholds) => void
  dismissed: string[]
  onDismiss: (ids: string[]) => void
}

const TONE: Record<Level, string> = { ok: 'var(--k-good)', warn: 'var(--k-warn)', bad: 'var(--k-bad)' }
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const HOURS = [0, 6, 12, 18, 23].map((i) => ({ i, text: String(i).padStart(2, '0') }))

/** Kontrollvisningen i «Min dag»: Cockpit på PC og Radar på mobil, med samme tall. */
export function Kontroll(props: Props) {
  const { tasks, unread, doneToday, overdue, planCount } = props
  const ks = useKaskjerda()
  const power = usePower()
  const besok = useBesok()
  const b = besok.data
  const visits = b ? weekChange(b.views) : null

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
  // Jobb viser bare det som hører til jobb: kaskjerda.no, besøk og strøm er private kilder.
  const jobb = props.context === 'jobb'
  const active = evaluateSignals({ thresholds: props.thresholds, visits: jobb ? null : visits, runs: jobb ? null : runs, overdue })
  // «Forfalt» telles ulikt i Alt, Jobb og Privat, så en avvisning gjelder bare der den ble gjort.
  const keyOf = (x: Signal) => (x.id === 'forfalt' ? `forfalt-${props.context}` : x.id)
  const signals = active.filter((x) => !props.dismissed.includes(keyOf(x)))
  const lastRunCovered = active.some((x) => x.id === 'kjoringer') // da er «siste kjøring feilet» allerede med som varsel (eller avvist)
  const { dismissed, onDismiss } = props
  const activeKeys = active.map(keyOf)
  const dismissedNow = dismissed.filter((k) => activeKeys.includes(k))
  // Et avvist varsel som ikke lenger er aktivt, slettes fra listen, så det vises igjen neste gang terskelen nås.
  // Bare varsler som vurderes i denne visningen røres, og vi venter til dataene er hentet.
  // Mangler kjøringer eller besøkstall (feil, ikke hentet ennå), vurderes ikke de varslene, og avvisningene beholdes.
  const evaluated = [`forfalt-${props.context}`, ...(jobb ? [] : [...(runs ? ['kjoringer'] : []), ...(visits ? ['besok'] : [])])]
  const settled = besok.state !== 'loading' && !ks.loading
  const stale = dismissed.filter((k) => evaluated.includes(k) && !activeKeys.includes(k))
  useEffect(() => {
    if (settled && stale.length) onDismiss(dismissed.filter((k) => !stale.includes(k)))
  }, [settled, stale.join(','), dismissed.join(',')]) // eslint-disable-line
  const ghMails = jobb ? [] : (props.githubMail?.mails ?? [])
  const attention = jobb ? signals.length : (alertCount ?? 0) + ghMails.length + (!lastRunCovered && runs?.[0]?.result === 'failure' ? 1 : 0) + signals.length
  const [editing, setEditing] = useState(false)
  const priceNow = power.prices?.hours[hour]

  const alerts = <AlertList status={ks.status} error={ks.error} signals={signals} github={!jobb} mails={ghMails} mailInfo={jobb ? undefined : props.githubMail} onDismiss={(id) => onDismiss([...dismissed, id === 'forfalt' ? `forfalt-${props.context}` : id])} dismissedCount={dismissedNow.length} onRestore={() => onDismiss(dismissed.filter((k) => !dismissedNow.includes(k)))} />
  const powerBars = power.prices && (
    <Bars values={power.prices.hours} highlight={hour} w={260} h={74} xLabels={HOURS} color="var(--k-c2)" label="Strømpris per time i dag" />
  )
  const heat = <HeatGrid weeks={heatWeeks(tasks, 26)} cell={11} label="Fullførte oppgaver per dag, siste 26 uker" />
  const runStrip = <RunStrip status={ks.status} />

  const kpiTasks = <Kpi title="Oppgaver i dag" value={String(doneToday)} unit={`/ ${total}`} note={overdue ? `${overdue} forfalt` : 'Ingen forfalte'} tone={overdue ? 'bad' : 'ok'} spark={done14} sparkColor="var(--k-c3)" />
  const kpiWeek = <Kpi title="Denne uka" value={String(weekNow)} unit="fullført" note={weekPrev ? `${weekNow >= weekPrev ? '▲' : '▼'} ${Math.abs(weekNow - weekPrev)} mot uka før` : 'Første uke'} tone={weekNow >= weekPrev ? 'ok' : 'warn'} />
  const kpiMail = <Kpi title="Uleste e-post" value={unread === null ? '–' : String(unread)} note={unread === null ? 'Ikke koblet til' : 'i innboksen'} tone="ok" />
  const km = props.kaskjerdaMail
  const kpiKMail = (
    <Kpi
      title="Post kaskjerda.no"
      value={!km ? '–' : km.error || km.unread === undefined ? '–' : String(km.unread)}
      note={!km ? 'Ikke koblet til' : km.error ? 'Fikk ikke svar' : km.unread === undefined ? 'Oppdater Gmail-skriptet' : 'uleste'}
      tone="ok"
    />
  )
  const kpiOverdue = <Kpi title="Forfalt" value={String(overdue)} note={overdue ? 'frist passert' : 'Ingen forfalte'} tone={overdue ? 'bad' : 'ok'} hot={overdue > 0} />
  const heading = (size: string) => (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <p className="text-sm font-medium text-muted first-letter:uppercase">{props.dateText}</p>
        <h1 className={`${size} leading-tight font-bold tracking-[-0.03em]`}>{props.greeting}</h1>
      </div>
    </div>
  )
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <ContextChips value={props.context} onChange={props.onContext} />
      <button onClick={() => setEditing(true)} aria-label="Terskler for varsler" title="Terskler for varsler" className="grid size-8 place-items-center rounded-xl border border-glass-border bg-card text-muted hover:bg-card-hover hover:text-fg">
        <SlidersHorizontal size={14} />
      </button>
      {!jobb && verdict && <Pill tone={verdict.level}>{verdict.label}</Pill>}
      {attention > 0 && <Pill tone="warn">{attention} trenger deg</Pill>}
    </div>
  )
  const noJobb = jobb && !props.hasJobProjects && (
    <div className="k-card text-sm text-muted">Ingen prosjekter er merket som jobb ennå. Åpne et prosjekt, velg «Rediger» og sett «Hører til» til Jobb, så dukker oppgavene opp her.</div>
  )
  const signalPanel = (
    <Panel title="Varsler" hot={attention > 0} action={jobb ? undefined : <RefreshBtn loading={ks.loading} onClick={ks.reload} />}>
      {alerts}
    </Panel>
  )

  return (
    <div className="kontroll">
      {/* ---------- PC: Cockpit ---------- */}
      <div className="hidden flex-col gap-3 md:flex">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {heading('text-[34px]')}
          {controls}
        </div>
        {noJobb}

        {jobb ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {kpiTasks}
              {kpiOverdue}
              {kpiWeek}
              {kpiMail}
            </div>
            <div className={`grid gap-3 ${signals.length ? 'xl:grid-cols-[2.4fr_1fr]' : ''}`}>
              <Panel title="Fullførte oppgaver · 28 dager" action={<span className="k-sub">{sum(done28)} totalt</span>}>
                <AreaChart values={done28} w={760} h={250} xLabels={dayLabels(28)} label="Fullførte oppgaver per dag, siste 28 dager" />
              </Panel>
              {signals.length > 0 && signalPanel}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr]">
              <Panel title="Dagens plan">{props.planList}</Panel>
              <Panel title="Aktivitet" action={<span className="k-sub">26 uker</span>}>
                {heat}
              </Panel>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-7">
              <Kpi title="Åpne varsler" value={alertCount === null ? '–' : String(alertCount)} note={ks.error ? 'Fikk ikke svar' : 'kaskjerda.no'} tone={alertCount ? 'warn' : 'ok'} hot={!!alertCount} />
              <Kpi title="Kjøringer ok" value={okShare === null ? '–' : String(Math.round(okShare * 100))} unit={okShare === null ? '' : '%'} note={finished.length ? `${finished.filter((r) => r.result === 'success').length} av ${finished.length}` : 'Ingen data'} tone={okShare === null || okShare === 1 ? 'ok' : 'warn'} spark={runs?.length ? [...runs].reverse().map((r) => (r.result === 'success' ? 2 : r.result === 'failure' ? 0 : 1)) : undefined} sparkColor="var(--k-good)" />
              {kpiTasks}
              <Kpi
                title="Besøk 7 d"
                value={visits ? String(visits.now) : '–'}
                note={visits ? (visits.pct === null ? 'Ingen uke å sammenligne med' : `${visits.pct >= 0 ? '▲' : '▼'} ${Math.abs(visits.pct)} % mot uka før`) : BESOK_NOTE[besok.state]}
                tone={visits && visits.pct !== null && visits.pct < -30 ? 'bad' : 'ok'}
                spark={b?.views.slice(-14)}
                sparkColor="var(--k-c1)"
              />
              {kpiMail}
              {kpiKMail}
              <Kpi title="Strøm nå" value={priceNow === undefined ? '–' : formatKr(priceNow)} unit="kr" note={power.prices ? `dyrest kl. ${String(cheapestAndPriciest(power.prices.hours).dear).padStart(2, '0')}` : power.error ? 'Utilgjengelig' : 'Henter …'} tone="ok" spark={power.prices?.hours} sparkColor="var(--k-c2)" />
            </div>

            <div className="grid gap-3 xl:grid-cols-[2.4fr_1fr]">
              {b ? (
                <Panel title="Sidevisninger kaskjerda.no · 28 dager" action={<span className="k-sub">i dag så langt: {b.today}</span>}>
                  <AreaChart values={b.views} w={760} h={250} xLabels={dayLabels(b.views.length, 1)} flags={peakFlag(b.views)} label="Sidevisninger per dag, siste 28 dager" />
                </Panel>
              ) : (
                <Panel title="Fullførte oppgaver · 28 dager" action={<span className="k-sub">{sum(done28)} totalt</span>}>
                  <AreaChart values={done28} w={760} h={250} xLabels={dayLabels(28)} label="Fullførte oppgaver per dag, siste 28 dager" />
                </Panel>
              )}
              {signalPanel}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1.25fr]">
              <Panel title="Dagens plan">{props.planList}</Panel>
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

            {besok.state === 'ready' && b ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Panel title="Fullførte oppgaver · 28 dager" action={<span className="k-sub">{sum(done28)} totalt</span>}>
                  <AreaChart values={done28} w={420} h={170} xLabels={dayLabels(28)} color="var(--k-c3)" label="Fullførte oppgaver per dag, siste 28 dager" />
                </Panel>
                <Panel title="Mest leste sider" action={<span className="k-sub">28 d</span>}>
                  <BesokFacts b={b} />
                </Panel>
                <Panel title="Besøk per time" action={<span className="k-sub">norsk tid</span>}>
                  <Bars values={b.hourly} highlight={b.hourly.indexOf(Math.max(...b.hourly))} w={420} h={150} xLabels={HOURS} label="Besøk per time på døgnet, siste 28 dager" />
                </Panel>
              </div>
            ) : (
              <BesokHint state={besok.state} message={besok.message} />
            )}
          </>
        )}
      </div>

      {/* ---------- Mobil: Radar ---------- */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex flex-col gap-2">
          {heading('text-[30px]')}
          {controls}
          <p className="px-1 text-sm text-muted">{attention > 0 ? `${attention} ting trenger deg` : props.hint}</p>
        </div>
        {noJobb}
        <div className="grid grid-cols-2 gap-3">
          {!jobb && <RingCard share={okShare ?? 0} text={okShare === null ? '–' : `${Math.round(okShare * 100)}%`} color="var(--k-c2)" title="kaskjerda.no" note={verdict?.label ?? 'Henter …'} />}
          <RingCard share={total ? doneToday / total : 0} text={`${doneToday}/${total}`} color="var(--k-c1)" title="Oppgaver i dag" note={overdue ? `${overdue} forfalt` : 'Ingen forfalte'} />
          {!jobb && <RingCard share={priceNow !== undefined && power.prices ? priceNow / Math.max(...power.prices.hours) : 0} text={priceNow === undefined ? '–' : formatKr(priceNow)} color="var(--k-c3)" title="Strøm nå" note="kr/kWh" />}
          {visits && !jobb ? (
            <RingCard share={visits.now / Math.max(1, visits.now, visits.prev)} text={String(visits.now)} color="var(--k-c1)" title="Besøk 7 d" note={visits.pct === null ? 'kaskjerda.no' : `${visits.pct >= 0 ? '▲' : '▼'} ${Math.abs(visits.pct)} % mot uka før`} />
          ) : (
            <RingCard share={weekNow / Math.max(1, weekNow, weekPrev)} text={String(weekNow)} color="var(--k-c1)" title="Denne uka" note={weekPrev ? `uka før: ${weekPrev}` : 'fullført'} />
          )}
        </div>
        {(!jobb || signals.length > 0) && signalPanel}
        {!jobb && km && (
          <Panel title="Post til kaskjerda.no" action={<span className="k-sub">{km.unread === undefined ? '' : `${km.unread} uleste`}</span>}>
            {km.error ? (
              <p className="text-sm text-muted">Fikk ikke hentet posten: {km.error}</p>
            ) : km.unread === undefined ? (
              <p className="text-sm text-muted">Oppdater Gmail-skriptet for å se posten her. Se oppsettet under «Koble til Gmail».</p>
            ) : !km.mails?.length ? (
              <p className="text-sm text-muted">Ingen uleste.</p>
            ) : (
              <ul>
                {km.mails.slice(0, 4).map((m, i) => (
                  <li key={m.id} className={i ? 'border-t border-[var(--k-line)]' : ''}>
                    <a href={m.url} target="_blank" rel="noreferrer" className="block py-2 hover:opacity-80">
                      <span className="block truncate text-[13.5px] font-semibold">{m.subject}</span>
                      <span className="block truncate text-[11px] text-muted">{m.from}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {b && !jobb && (
          <Panel title="Sidevisninger · 28 dager" action={<span className="k-sub">i dag: {b.today}</span>}>
            <AreaChart values={b.views} w={300} h={130} xLabels={[dayLabels(b.views.length, 1)[0], dayLabels(b.views.length, 1)[4]]} flags={peakFlag(b.views)} label="Sidevisninger per dag, siste 28 dager" />
          </Panel>
        )}
        <Panel title="Dagens plan">{props.planList}</Panel>
        {b && !jobb && (
          <Panel title="Mest leste sider" action={<span className="k-sub">28 d</span>}>
            <BesokFacts b={b} compact />
          </Panel>
        )}
        <Panel title="Fullførte oppgaver · 28 dager">
          <AreaChart values={done28} w={300} h={130} xLabels={[dayLabels(28)[0], dayLabels(28)[4]]} label="Fullførte oppgaver per dag, siste 28 dager" />
        </Panel>
        <Panel title="Aktivitet · 26 uker">{heat}</Panel>
        {!jobb && (
          <Panel title="Strøm i dag" action={<span className="k-sub">kr/kWh</span>}>
            {powerBars ?? <p className="text-sm text-muted">{power.error ? 'Kunne ikke hente strømpriser.' : 'Henter strømpriser …'}</p>}
          </Panel>
        )}
        {unread !== null && <p className="px-1 text-center text-xs text-faint">{unread} uleste e-poster</p>}
      </div>

      {editing && <ThresholdDialog thresholds={props.thresholds} onSave={props.onThresholds} onClose={() => setEditing(false)} />}
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

function AlertList({ status, error, signals, github, mails, mailInfo, onDismiss, dismissedCount, onRestore }: { mails: NonNullable<GithubMail['mails']>; mailInfo?: GithubMail | null; status: KaskjerdaStatus | null; error: boolean; signals: Signal[]; github: boolean; onDismiss: (id: string) => void; dismissedCount: number; onRestore: () => void }) {
  const rows: { level: Level; title: string; meta: string; url?: string; id?: string }[] = signals.map((x) => ({ level: x.level, title: x.title, meta: x.meta, id: x.id }))
  if (github) {
    if (!status && !rows.length) return <p className="text-sm text-muted">{error ? 'Fikk ikke kontakt med GitHub.' : 'Henter varsler …'}</p>
    for (const a of status?.alerts ?? []) rows.push({ level: 'warn', title: a.title, meta: 'skjer-i-alesund · åpent', url: a.url })
    for (const m of mails) rows.push({ level: 'warn', title: m.subject, meta: `GitHub · ${m.from}`, url: m.url })
    if (mailInfo && (mailInfo.error || mailInfo.unread === undefined)) rows.push({ level: 'warn', title: mailInfo.error ? 'Fikk ikke hente GitHub-post fra Gmail' : 'Oppdater Gmail-skriptet for GitHub-varsler', meta: 'Min dag → Koble til Gmail' })
    const last = status?.runs?.[0]
    if (last?.result === 'failure' && !signals.some((x) => x.id === 'kjoringer')) rows.push({ level: 'bad', title: 'Siste kjøring feilet', meta: `oppdater.yml · ${ago(last.at)}`, url: last.url })
    if (status && status.alerts === null) rows.push({ level: 'warn', title: 'Fikk ikke hente varsler fra GitHub', meta: 'prøver igjen automatisk' })
    if (status && !rows.length) rows.push({ level: 'ok', title: 'Ingen åpne varsler', meta: statusLevel(status).detail })
  }
  if (!rows.length) rows.push({ level: 'ok', title: 'Ingen varsler', meta: 'Alt innenfor tersklene' })
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
        const dismiss = r.id && (
          <button onClick={() => onDismiss(r.id!)} aria-label={`Avvis varselet: ${r.title}`} title="Avvis. Kommer tilbake først når terskelen nås på nytt." className="-mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
            <X size={14} />
          </button>
        )
        const cls = `flex gap-2.5 py-2 ${i ? 'border-t border-[var(--k-line)]' : ''}`
        return (
          <li key={i} className={dismiss ? 'flex items-start' : undefined}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className={`${cls} hover:opacity-80`}>
                {body}
              </a>
            ) : (
              <div className={`${cls} ${dismiss ? 'min-w-0 flex-1' : ''}`}>{body}</div>
            )}
            {dismiss && <span className={i ? 'mt-px border-t border-transparent pt-1.5' : 'pt-1.5'}>{dismiss}</span>}
          </li>
        )
      })}
      {dismissedCount > 0 && (
        <li className="border-t border-[var(--k-line)] pt-2 text-xs text-muted">
          {dismissedCount} avvist ·{' '}
          <button onClick={onRestore} className="font-semibold text-accent hover:underline">
            Vis igjen
          </button>
        </li>
      )}
    </ul>
  )
}

function ContextChips({ value, onChange }: { value: ContextFilter; onChange: (f: ContextFilter) => void }) {
  return (
    <div role="group" aria-label="Vis oppgaver fra" className="flex gap-0.5 rounded-xl border border-glass-border bg-card p-0.5 text-[13px] font-semibold">
      {(['alt', 'jobb', 'privat'] as const).map((f) => (
        <button key={f} onClick={() => onChange(f)} aria-pressed={value === f} className={`rounded-lg px-3 py-1 transition ${value === f ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}>
          {f === 'alt' ? 'Alt' : f === 'jobb' ? 'Jobb' : 'Privat'}
        </button>
      ))}
    </div>
  )
}

/** Terskler som gir varsler. 0 slår en terskel av. */
function ThresholdDialog({ thresholds, onSave, onClose }: { thresholds?: Thresholds; onSave: (t: Thresholds) => void; onClose: () => void }) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }
  const [besokFall, setBesokFall] = useState(String(t.besokFall))
  const [kjoringerFeil, setKjoringerFeil] = useState(String(t.kjoringerFeil))
  const [forfalt, setForfalt] = useState(String(t.forfalt))
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0))
  const field = 'w-24 rounded-xl border border-glass-border bg-surface px-3 py-2 text-right text-sm outline-none focus:border-accent'
  const row = (id: string, label: string, hint: string, value: string, set: (v: string) => void, unit: string) => (
    <div className="flex items-center gap-3 py-2">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </label>
      <input id={id} type="number" min={0} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} className={field} />
      <span className="w-8 text-xs text-muted">{unit}</span>
    </div>
  )
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label="Terskler for varsler" onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise flex max-h-[85dvh] w-full max-w-md flex-col rounded-[28px] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Terskler for varsler</h2>
          <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">Når en terskel nås, dukker det opp et varsel i «Min dag». Skriv 0 for å slå en terskel av.</p>
        {row('t-besok', 'Besøket faller', 'Siste 7 dager mot de 7 før', besokFall, setBesokFall, '%')}
        {row('t-kjoringer', 'Kjøringer feiler', 'Mislykkede kjøringer på rad', kjoringerFeil, setKjoringerFeil, 'stk')}
        {row('t-forfalt', 'Forfalte oppgaver', 'Antall med frist som er passert', forfalt, setForfalt, 'stk')}
        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <button onClick={() => { onSave({}); onClose() }} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-hover">Tilbakestill</button>
          <button
            onClick={() => { onSave({ besokFall: num(besokFall), kjoringerFeil: num(kjoringerFeil), forfalt: num(forfalt) }); onClose() }}
            className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
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

const BESOK_NOTE: Record<BesokState, string> = { loading: 'Henter …', ready: '', setup: 'Ikke satt opp ennå', error: 'Fikk ikke svar', off: 'Krever Supabase' }

/** Merke på toppdagen, plassert så teksten holder seg innenfor grafen. */
function peakFlag(values: number[]) {
  const i = values.indexOf(Math.max(...values))
  return [{ i, text: `Topp: ${values[i]}`, color: 'var(--k-c3)', anchor: i > values.length / 2 ? ('end' as const) : ('start' as const) }]
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="my-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[12.5px]">
      <span className="truncate">{label}</span>
      <span className="k-num">{value}</span>
      <span className="col-span-2 h-[5px] overflow-hidden rounded-full bg-[var(--k-line)]">
        <span className="block h-full rounded-full bg-[var(--k-c1)]" style={{ width: `${Math.round((value / max) * 100)}%` }} />
      </span>
    </div>
  )
}

/** Mest leste sider, og fordeling på nettleser og land. */
function BesokFacts({ b, compact }: { b: Besok; compact?: boolean }) {
  const pages = new Map<string, number>()
  for (const p of b.pages) pages.set(pageLabel(p.path), (pages.get(pageLabel(p.path)) ?? 0) + p.count)
  const rows = [...pages].sort((x, y) => y[1] - x[1]).slice(0, compact ? 3 : 4)
  const share = (list: { name: string; count: number }[], n: number) => {
    const t = list.reduce((a, x) => a + x.count, 0)
    return list.slice(0, n).map((x) => ({ label: x.name, pct: t ? Math.round((x.count / t) * 100) : 0 }))
  }
  return (
    <>
      {rows.map(([label, n]) => (
        <Bar key={label} label={label} value={n} max={rows[0][1]} />
      ))}
      {!compact && (
        <p className="mt-3 text-[11px] text-muted">
          {share(b.browsers, 2).map((x) => `${x.label} ${x.pct} %`).join(' · ')}
          <br />
          {share(b.countries.map((c) => ({ ...c, name: countryName(c.name) })), 2).map((x) => `${x.label} ${x.pct} %`).join(' · ')}
        </p>
      )}
    </>
  )
}

/** Vises der besøkstall mangler, så det er tydelig hva som må gjøres. */
function BesokHint({ state, message }: { state: BesokState; message: string }) {
  if (state === 'loading' || state === 'ready' || state === 'off') return null
  return (
    <div className="k-card text-sm">
      <p className="k-ttl">Besøkstall</p>
      {state === 'setup' ? (
        <p className="text-muted">
          Besøkstall fra GoatCounter er ikke satt opp. Legg inn hemmeligheten <code>GOATCOUNTER_TOKEN</code> i Supabase (Edge Functions → Secrets) og last siden på nytt.
        </p>
      ) : (
        <p className="text-muted">
          Fikk ikke hentet besøkstall akkurat nå. Prøver igjen automatisk.
          {message && <span className="mt-1 block text-xs text-faint">{message}</span>}
        </p>
      )}
    </div>
  )
}
