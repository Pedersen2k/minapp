import { Bell, Check, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Copy, ExternalLink, Mail, RefreshCw, Settings2, Sun, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import scriptCode from '../../integrations/google-apps-script/Code.gs?raw'
import { formatDue, formatLong, todayISO } from '../lib/date'
import { byTaskOrder } from '../lib/order'
import { DEFAULT_WEATHER, useSettings, type Settings } from '../lib/settings'
import { useStore } from '../lib/store'
import type { Task } from '../lib/types'
import { useOpenTask } from '../lib/ui-context'
import { fetchWeather, weatherKind, weatherText, type Weather, type WeatherKind } from '../lib/weather'
import { InlineQuickAdd } from './QuickAdd'
import { TaskCheckbox, useCompleteTask } from './TaskItem'

interface MailItem {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
  url: string
}

interface NewsItem {
  source: string
  title: string
  link: string
  summary: string
  date: string
  image: string | null
}

interface Feed {
  unread?: number
  mails?: MailItem[]
  news?: NewsItem[]
  mailError?: string
  newsError?: string
  error?: string
  updated?: string
}

const FEED_CACHE = 'minapp:feed'
const PENDING_KEY = 'minapp:pending-gmail-key'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 10) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 23) return 'God kveld'
  return 'God natt'
}

/** «12 min siden», «kl 08:14», «i går», «18. okt». */
function timeAgo(iso: string): string {
  const d = new Date(iso)
  const min = Math.round((Date.now() - d.getTime()) / 60_000)
  if (min < 1) return 'nå'
  if (min < 60) return `${min} min siden`
  if (d.toDateString() === new Date().toDateString()) return `kl ${d.toTimeString().slice(0, 5)}`
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'i går'
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

const WEATHER_ICON: Record<WeatherKind, (size: number) => ReactNode> = {
  sun: (s) => <Sun size={s} className="text-[#f59e0b]" />,
  partly: (s) => <CloudSun size={s} className="text-[#f59e0b]" />,
  cloud: (s) => <Cloud size={s} className="text-muted" />,
  fog: (s) => <CloudFog size={s} className="text-muted" />,
  rain: (s) => <CloudRain size={s} className="text-[#3b82f6]" />,
  snow: (s) => <CloudSnow size={s} className="text-[#0ea5e9]" />,
  storm: (s) => <CloudLightning size={s} className="text-[#8b5cf6]" />,
}

export function Dashboard() {
  const { tasks } = useStore()
  const { settings, save } = useSettings()
  const today = todayISO()
  const open = tasks.filter((t) => !t.done)
  const overdue = open.filter((t) => t.due && t.due < today).sort((a, b) => a.due!.localeCompare(b.due!) || byTaskOrder(a, b))
  const todays = open.filter((t) => t.due === today).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || byTaskOrder(a, b))
  const doneToday = tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length
  const progress = doneToday + overdue.length + todays.length ? doneToday / (doneToday + overdue.length + todays.length) : 0

  // E-post og nyheter fra Apps Script-et. Siste svar vises med en gang mens nytt hentes.
  const [feed, setFeed] = useState<Feed | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(FEED_CACHE) ?? 'null') as Feed | null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [setup, setSetup] = useState(false)
  const connected = !!(settings.gmailScriptUrl && settings.gmailKey)

  const loadFeed = useCallback(async () => {
    if (!settings.gmailScriptUrl || !settings.gmailKey) return
    setLoading(true)
    try {
      const res = await fetch(`${settings.gmailScriptUrl}?key=${encodeURIComponent(settings.gmailKey)}`)
      const data = (await res.json()) as Feed
      setFeed(data)
      if (!data.error) localStorage.setItem(FEED_CACHE, JSON.stringify(data))
    } catch {
      setFeed((f) => ({ ...f, error: navigator.onLine ? 'Kunne ikke nå Gmail-skriptet. Sjekk adressen i oppsettet.' : 'Du er ikke på nett.' }))
    } finally {
      setLoading(false)
    }
  }, [settings.gmailScriptUrl, settings.gmailKey])

  useEffect(() => {
    // Henter når dashboardet åpnes (og når tilkoblingen endres).
    loadFeed()
  }, [loadFeed])

  const place = settings.weather ?? DEFAULT_WEATHER
  const [weather, setWeather] = useState<Weather | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  useEffect(() => {
    fetchWeather(place.lat, place.lon)
      .then(setWeather)
      .catch(() => setWeatherError(true))
  }, [place.lat, place.lon])

  const plan = [...overdue, ...todays]
  const sectionTitle = 'mb-3 flex h-7 items-center justify-between px-1 text-xs font-semibold tracking-wide text-muted uppercase'
  const box = 'rounded-[22px] border border-glass-border bg-card'

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="mb-1 text-sm font-medium text-muted first-letter:uppercase">{formatLong(today)}</p>
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.03em] md:text-[36px]">{greeting()}</h1>
      </header>

      {/* Vær og fremdrift */}
      <div className="grid grid-cols-2 gap-3 md:gap-3.5">
        <div className="flex items-center gap-3 rounded-[22px] border border-glass-border bg-[linear-gradient(135deg,rgb(125_211_252/0.32),var(--card))] p-4 md:gap-4 md:px-5">
          <span className="shrink-0">{weather ? WEATHER_ICON[weatherKind(weather.code)](34) : <CloudSun size={34} className="text-muted" />}</span>
          <div className="min-w-0">
            <p className="text-[26px] leading-none font-bold">{weather ? `${weather.temp}°` : '–'}</p>
            <p className="mt-1 truncate text-[13px] text-muted">
              {weather ? (
                <>
                  {weatherText(weather.code)}
                  <span className="hidden sm:inline"> i {place.name}</span> · {weather.max}°/{weather.min}°
                </>
              ) : weatherError ? (
                'Utilgjengelig'
              ) : (
                'Henter …'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[22px] border border-glass-border bg-[linear-gradient(135deg,rgb(139_125_245/0.26),var(--card))] p-4 md:gap-4 md:px-5">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full md:size-11"
            style={{ background: `conic-gradient(var(--accent) 0 ${progress * 100}%, var(--accent-soft) ${progress * 100}% 100%)` }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-surface md:size-8">
              {progress === 1 && <Check size={15} strokeWidth={3} className="text-accent" />}
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[26px] leading-none font-bold">
              {doneToday} av {doneToday + plan.length}
            </p>
            <p className="mt-1 truncate text-[13px] text-muted">
              gjort<span className="hidden sm:inline"> i dag</span>
              {overdue.length ? <span className="text-[#e5484d]"> · {overdue.length} forfalt</span> : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Dagens plan som tidslinje */}
      <section>
        <h2 className={sectionTitle}>Dagens plan</h2>
        {plan.length > 0 && (
          <ul className={`${box} mb-2.5 px-4 md:px-5`}>
            {plan.map((t) => (
              <PlanRow key={t.id} task={t} overdue={!!t.due && t.due < today} />
            ))}
          </ul>
        )}
        <InlineQuickAdd defaults={{ due: today }} />
      </section>

      {/* E-post og nyheter side om side */}
      <div className="grid gap-7 md:grid-cols-2 md:gap-3.5">
        <section className="min-w-0">
          <h2 className={sectionTitle}>
            <span>Uleste e-poster</span>
            {connected && (
              <span className="flex items-center gap-1 normal-case">
                {feed?.unread ? (
                  <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {feed.unread} i Gmail →
                  </a>
                ) : null}
                <button onClick={loadFeed} disabled={loading} aria-label="Oppdater" className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setSetup(true)} aria-label="Gmail-oppsett" className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg">
                  <Settings2 size={13} />
                </button>
              </span>
            )}
          </h2>
          <div className={`${box} px-4 py-1.5`}>
            {!connected ? (
              <div className="py-4 text-center">
                <Mail size={22} className="mx-auto mb-2 text-faint" />
                <p className="mb-3 text-sm text-muted">Se de siste uleste e-postene dine her hver morgen.</p>
                <button onClick={() => setSetup(true)} className="bg-accent-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white">
                  Koble til Gmail
                </button>
              </div>
            ) : feed?.error || feed?.mailError ? (
              <p className="py-3 text-sm text-[#e5484d]">
                {feed.error === 'Ingen tilgang'
                  ? 'Ingen tilgang: nøkkelen i skriptet (skriptegenskapen KEY) er ikke den samme som i appen. Åpne oppsettet med tannhjulet og kopier nøkkelen derfra.'
                  : (feed.error ?? 'Gmail svarte med en feil. Prøv igjen, eller sjekk skriptet.')}
              </p>
            ) : !feed?.mails ? (
              <p className="py-3 text-sm text-muted">Henter e-post …</p>
            ) : feed.mails.length === 0 ? (
              <p className="py-3 text-sm text-muted">Ingen uleste e-poster.</p>
            ) : (
              <ul>
                {feed.mails.slice(0, 4).map((m, i) => (
                  <li key={m.id} className={i ? 'border-t border-line' : ''}>
                    <a href={m.url} target="_blank" rel="noreferrer" className="-mx-2 block rounded-xl px-2 py-2.5 hover:bg-hover">
                      <p className="flex items-baseline gap-2 text-[13px] font-semibold">
                        <span className="flex-1 truncate">{m.from}</span>
                        <span className="shrink-0 text-xs font-normal text-faint">{timeAgo(m.date)}</span>
                      </p>
                      <p className="truncate text-[13px] text-muted">{m.subject}</p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <h2 className={sectionTitle}>
            <span>Nyheter</span>
            {connected && (
              <a href="https://www.nrk.no/mr/" target="_blank" rel="noreferrer" className="normal-case text-accent hover:underline">
                NRK →
              </a>
            )}
          </h2>
          <div className={`${box} overflow-hidden`}>
            {!connected ? (
              <p className="p-4 text-sm text-muted">Nyheter fra NRK hentes av det samme skriptet som e-posten. Koble til Gmail for å se dem.</p>
            ) : feed?.newsError ? (
              <p className="p-4 text-sm text-[#e5484d]">Kunne ikke hente nyheter akkurat nå.</p>
            ) : !feed?.news?.length ? (
              <p className="p-4 text-sm text-muted">{feed?.news ? 'Ingen nyheter akkurat nå.' : 'Henter nyheter …'}</p>
            ) : (
              <>
                <TopStory item={feed.news[0]} />
                <ul className="px-4 pb-1.5">
                  {feed.news.slice(1, 4).map((n, i) => (
                    <li key={n.link} className={i ? 'border-t border-line' : ''}>
                      <a href={n.link} target="_blank" rel="noreferrer" className="-mx-2 block rounded-xl px-2 py-2.5 hover:bg-hover">
                        <p className="line-clamp-2 text-[13px] leading-snug font-semibold">{n.title}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-faint">
                          {n.source} · {timeAgo(n.date)}
                        </p>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </div>

      {setup && <GmailSetup settings={settings} onSave={save} onClose={() => setSetup(false)} />}
    </div>
  )
}

/** Én rad i dagens plan: tidspunkt, avhuking og tittel. Klikk åpner oppgaven. */
function PlanRow({ task, overdue }: { task: Task; overdue: boolean }) {
  const openTask = useOpenTask()
  const { checked, completing, complete } = useCompleteTask(task)
  return (
    <li
      onClick={() => openTask(task.id)}
      className={`flex cursor-pointer items-center gap-3.5 border-b border-line py-3 transition last:border-b-0 md:gap-4 ${completing ? 'opacity-40' : ''}`}
    >
      <span className={`w-12 shrink-0 text-[13px] font-semibold ${overdue ? 'text-[#e5484d]' : task.time ? 'text-accent' : 'font-normal text-faint'}`}>
        {overdue ? formatDue(task.due!) : (task.time ?? 'I dag')}
      </span>
      <TaskCheckbox task={task} checked={checked} onClick={complete} size={18} />
      <span className={`min-w-0 flex-1 truncate text-[14.5px] ${checked ? 'text-faint line-through' : ''}`}>{task.title}</span>
      {task.reminder !== -1 && task.time && <Bell size={13} className="shrink-0 text-faint" aria-label="Påminnelse" />}
    </li>
  )
}

/** Toppsaken med bilde og tittel over. */
function TopStory({ item }: { item: NewsItem }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer" className="group relative block h-32 overflow-hidden">
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <span className="bg-accent-gradient absolute inset-0" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-3.5">
        <span className="mb-0.5 block text-[11px] font-semibold tracking-wide text-white/80 uppercase">
          {item.source} · {timeAgo(item.date)}
        </span>
        <span className="line-clamp-2 text-[15px] leading-snug font-bold text-white">{item.title}</span>
      </span>
    </a>
  )
}

function randomKey(): string {
  return [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-glass-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-hover"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Kopiert' : label}
    </button>
  )
}

/** Steg-for-steg-oppsett av Apps Script-et som henter e-post og nyheter. */
function GmailSetup({ settings, onSave, onClose }: { settings: Settings; onSave: (p: Partial<Settings>) => Promise<void>; onClose: () => void }) {
  // Nøkkelen må være den samme fra den vises til den lagres, også om vinduet lukkes og åpnes igjen.
  const [key] = useState(() => {
    if (settings.gmailKey) return settings.gmailKey
    const pending = localStorage.getItem(PENDING_KEY) ?? randomKey()
    localStorage.setItem(PENDING_KEY, pending)
    return pending
  })
  const [url, setUrl] = useState(settings.gmailScriptUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const valid = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim())

  const step = 'grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent'

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label="Koble til Gmail" onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[28px] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Koble til Gmail</h2>
          <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-sm text-muted">Et lite skript på din egen Google-konto henter uleste e-poster (bare avsender, emne og utdrag) og nyheter fra NRK. Gjøres én gang, på PC.</p>

        <ol className="flex flex-col gap-4 text-sm">
          <li className="flex gap-3">
            <span className={step}>1</span>
            <div className="min-w-0 flex-1">
              <p>
                Åpne{' '}
                <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
                  nytt Apps Script-prosjekt <ExternalLink size={12} />
                </a>{' '}
                og logg inn med Gmail-kontoen din.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className={step}>2</span>
            <div className="min-w-0 flex-1">
              <p className="mb-2">Slett koden som står der, og lim inn denne:</p>
              <CopyButton text={scriptCode} label="Kopier koden" />
            </div>
          </li>
          <li className="flex gap-3">
            <span className={step}>3</span>
            <div className="min-w-0 flex-1">
              <p className="mb-2">
                Klikk tannhjulet <b>Prosjektinnstillinger</b> til venstre → <b>Legg til skriptegenskap</b>. Egenskap: <code className="rounded bg-hover px-1">KEY</code>, verdi:
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-hover px-2 py-1.5 text-xs">{key}</code>
                <CopyButton text={key} label="Kopier" />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className={step}>4</span>
            <p className="min-w-0 flex-1">
              Gå tilbake til <b>Redigeringsprogram</b>, velg funksjonen <code className="rounded bg-hover px-1">test</code> øverst og klikk <b>Kjør</b>. Gi tillatelse når Google spør (velg «Avansert» → «Gå til … (utrygt)» – det er ditt eget skript).
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>5</span>
            <p className="min-w-0 flex-1">
              Klikk <b>Implementer → Ny implementering</b> → tannhjul → <b>Nettapp</b>. Kjør som: <b>Meg</b>. Hvem har tilgang: <b>Alle</b>. Klikk <b>Implementer</b> og kopier <b>nettapp-adressen</b>.
            </p>
          </li>
          <li className="flex gap-3">
            <span className={step}>6</span>
            <div className="min-w-0 flex-1">
              <p className="mb-2">Lim inn adressen her:</p>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec"
                aria-label="Nettapp-adresse"
                className="w-full rounded-xl border border-glass-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              {url && !valid && <p className="mt-1 text-xs text-[#e5484d]">Adressen skal starte med https://script.google.com/macros/s/ og slutte med /exec.</p>}
            </div>
          </li>
        </ol>

        {error && <p className="mt-4 text-sm text-[#e5484d]">{error}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          {settings.gmailScriptUrl ? (
            <button
              onClick={async () => {
                await onSave({ gmailScriptUrl: undefined, gmailKey: undefined })
                localStorage.removeItem(FEED_CACHE)
                onClose()
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium text-[#e5484d] hover:bg-hover"
            >
              Koble fra
            </button>
          ) : (
            <span />
          )}
          <button
            disabled={!valid}
            onClick={async () => {
              try {
                await onSave({ gmailScriptUrl: url.trim(), gmailKey: key })
                localStorage.removeItem(PENDING_KEY)
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Kunne ikke lagre')
              }
            }}
            className="bg-accent-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  )
}
