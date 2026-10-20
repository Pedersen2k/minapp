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
import { BentoCard, NotesCard, PowerCard, ShortcutsCard } from './DashboardCards'
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
const FEED_AT = 'minapp:feed-at'
const WEATHER_CACHE = 'minapp:weather'
const STALE_MS = 60 * 60 * 1000 // oppdater automatisk én gang i timen

function cachedWeather(): { at: number; data: Weather } | null {
  try {
    return JSON.parse(localStorage.getItem(WEATHER_CACHE) ?? 'null')
  } catch {
    return null
  }
}
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

  const [fetchedAt, setFetchedAt] = useState(() => Number(localStorage.getItem(FEED_AT) ?? 0))

  const loadFeed = useCallback(async () => {
    if (!settings.gmailScriptUrl || !settings.gmailKey) return
    setLoading(true)
    try {
      const res = await fetch(`${settings.gmailScriptUrl}?key=${encodeURIComponent(settings.gmailKey)}`)
      const data = (await res.json()) as Feed
      setFeed(data)
      if (!data.error) {
        const now = Date.now()
        localStorage.setItem(FEED_CACHE, JSON.stringify(data))
        localStorage.setItem(FEED_AT, String(now))
        setFetchedAt(now)
      }
    } catch {
      setFeed((f) => ({ ...f, error: navigator.onLine ? 'Kunne ikke nå Gmail-skriptet. Sjekk adressen i oppsettet.' : 'Du er ikke på nett.' }))
    } finally {
      setLoading(false)
    }
  }, [settings.gmailScriptUrl, settings.gmailKey])

  const place = settings.weather ?? DEFAULT_WEATHER
  const [weather, setWeather] = useState<Weather | null>(() => cachedWeather()?.data ?? null)
  const [weatherError, setWeatherError] = useState(false)
  const loadWeather = useCallback(() => {
    fetchWeather(place.lat, place.lon)
      .then((data) => {
        setWeather(data)
        setWeatherError(false)
        localStorage.setItem(WEATHER_CACHE, JSON.stringify({ at: Date.now(), data }))
      })
      .catch(() => setWeatherError(true))
  }, [place.lat, place.lon])

  // Automatisk oppdatering: når siden åpnes, når appen kommer tilbake i forgrunnen, og
  // ellers jevnlig – men bare når det som vises er eldre enn en time.
  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - Number(localStorage.getItem(FEED_AT) ?? 0) > STALE_MS) loadFeed()
      if (Date.now() - (cachedWeather()?.at ?? 0) > STALE_MS) loadWeather()
    }
    refreshIfStale()
    const timer = window.setInterval(refreshIfStale, 60_000)
    document.addEventListener('visibilitychange', refreshIfStale)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshIfStale)
    }
  }, [loadFeed, loadWeather])

  const plan = [...overdue, ...todays]
  const nowHm = new Date().toTimeString().slice(0, 5)
  const next = todays.find((t) => t.time && t.time > nowHm)
  const mailIcons = (
    <>
      {feed?.unread ? (
        <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {feed.unread} uleste →
        </a>
      ) : null}
      <button onClick={() => { loadFeed(); loadWeather() }} disabled={loading} aria-label="Oppdater" className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg">
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
      <button onClick={() => setSetup(true)} aria-label="Gmail-oppsett" className="grid size-7 place-items-center rounded-lg hover:bg-hover hover:text-fg">
        <Settings2 size={13} />
      </button>
    </>
  )

  // Bento: 2 kolonner på mobil/nettbrett, 4 på brede skjermer. Kortene spenner over 1–2 kolonner.
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {/* Hilsen og fremdrift */}
      <section className="col-span-2 flex items-center justify-between gap-4 rounded-3xl border border-glass-border bg-[linear-gradient(120deg,rgb(139_125_245/0.26),var(--card))] p-5 md:px-7 md:py-6">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-muted first-letter:uppercase">{formatLong(today)}</p>
          <h1 className="text-[30px] leading-tight font-bold tracking-[-0.03em] md:text-[38px]">{greeting()}</h1>
          <p className="mt-1 truncate text-sm text-muted">
            {next ? (
              <>
                Neste: <span className="text-fg">{next.title}</span> kl {next.time}
              </>
            ) : plan.length ? (
              `${plan.length} ${plan.length === 1 ? 'oppgave' : 'oppgaver'} igjen i dag`
            ) : (
              'Ingen oppgaver igjen i dag'
            )}
          </p>
        </div>
        <div className="shrink-0 text-center">
          <span
            className="grid size-16 place-items-center rounded-full md:size-[76px]"
            style={{ background: `conic-gradient(var(--accent) 0 ${progress * 100}%, var(--accent-soft) ${progress * 100}% 100%)` }}
          >
            <span className="grid size-12 place-items-center rounded-full bg-surface text-sm font-bold md:size-[58px] md:text-base">
              {progress === 1 ? <Check size={20} strokeWidth={3} className="text-accent" /> : `${doneToday}/${doneToday + plan.length}`}
            </span>
          </span>
          <p className="mt-1.5 text-xs text-muted">gjort i dag</p>
        </div>
      </section>

      {/* Vær */}
      <BentoCard title={place.name} className="bg-[linear-gradient(135deg,rgb(56_189_248/0.2),var(--card))]">
        {weather ? (
          <>
            <div className="flex items-center gap-2.5">
              {WEATHER_ICON[weatherKind(weather.code)](30)}
              <span className="text-[32px] leading-none font-bold tracking-tight md:text-4xl">{weather.temp}°</span>
            </div>
            <p className="mt-1.5 truncate text-[13px] text-muted">
              {weatherText(weather.code)} · {weather.max}°/{weather.min}°
            </p>
            <div className="mt-auto grid grid-cols-2 gap-x-2 gap-y-1 pt-3 text-xs text-muted sm:flex sm:justify-between">
              {weather.hours.slice(0, 4).map((h) => (
                <span key={h.time}>
                  {h.time.slice(0, 2)} · <b className="text-fg">{h.temp}°</b>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="py-3 text-sm text-muted">{weatherError ? 'Været er utilgjengelig.' : 'Henter været …'}</p>
        )}
      </BentoCard>

      {/* Strøm */}
      <PowerCard />

      {/* Dagens plan */}
      <BentoCard title="Dagens plan" className="col-span-2 xl:row-span-1">
        {plan.length > 0 && (
          <ul className="mb-3">
            {plan.map((t) => (
              <PlanRow key={t.id} task={t} overdue={!!t.due && t.due < today} />
            ))}
          </ul>
        )}
        <div className="mt-auto">
          <InlineQuickAdd defaults={{ due: today }} />
        </div>
      </BentoCard>

      {/* E-post */}
      <BentoCard title="E-post" action={connected && mailIcons} className="col-span-2 md:col-span-1">
        {!connected ? (
          <div className="flex flex-1 flex-col items-center justify-center py-3 text-center">
            <Mail size={22} className="mb-2 text-faint" />
            <p className="mb-3 text-sm text-muted">Se de siste uleste e-postene dine her.</p>
            <button onClick={() => setSetup(true)} className="bg-accent-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white">
              Koble til Gmail
            </button>
          </div>
        ) : feed?.error || feed?.mailError ? (
          <p className="text-sm text-[#e5484d]">
            {feed.error === 'Ingen tilgang'
              ? 'Ingen tilgang: nøkkelen i skriptet (skriptegenskapen KEY) er ikke den samme som i appen. Åpne oppsettet med tannhjulet og kopier nøkkelen derfra.'
              : (feed.error ?? 'Gmail svarte med en feil. Prøv igjen, eller sjekk skriptet.')}
          </p>
        ) : !feed?.mails ? (
          <p className="text-sm text-muted">Henter e-post …</p>
        ) : feed.mails.length === 0 ? (
          <p className="text-sm text-muted">Ingen uleste e-poster.</p>
        ) : (
          <ul>
            {feed.mails.slice(0, 5).map((m, i) => (
              <li key={m.id} className={i ? 'border-t border-line' : ''}>
                <a href={m.url} target="_blank" rel="noreferrer" className="-mx-2 block rounded-xl px-2 py-2 hover:bg-hover">
                  <p className="flex items-baseline gap-2 text-[13px] font-semibold">
                    <span className="flex-1 truncate">{m.from}</span>
                    <span className="shrink-0 text-[11px] font-normal text-faint">{timeAgo(m.date)}</span>
                  </p>
                  <p className="truncate text-[13px] text-muted">{m.subject}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      {/* Notatblokk */}
      <NotesCard settings={settings} onSave={save} className="col-span-2 md:col-span-1" />

      {/* Snarveier */}
      <ShortcutsCard settings={settings} onSave={save} className="col-span-2" />

      {/* Nyheter */}
      <BentoCard
        title="Nyheter"
        className="col-span-2"
        action={
          connected && (
            <a href="https://www.nrk.no/mr/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              NRK →
            </a>
          )
        }
      >
        {!connected ? (
          <p className="text-sm text-muted">Nyheter fra NRK hentes av det samme skriptet som e-posten. Koble til Gmail for å se dem.</p>
        ) : feed?.newsError ? (
          <p className="text-sm text-[#e5484d]">Kunne ikke hente nyheter akkurat nå.</p>
        ) : !feed?.news?.length ? (
          <p className="text-sm text-muted">{feed?.news ? 'Ingen nyheter akkurat nå.' : 'Henter nyheter …'}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {feed.news.slice(0, 3).map((n) => (
              <li key={n.link}>
                <a href={n.link} target="_blank" rel="noreferrer" className="group flex gap-3 sm:block">
                  <span className="relative block h-20 w-24 shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-full">
                    {n.image ? (
                      <img src={n.image} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="bg-accent-gradient block size-full" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="mt-0 block text-[11px] font-semibold tracking-wide text-accent uppercase sm:mt-2">
                      {n.source.replace('NRK Møre og Romsdal', 'NRK MR')} · {timeAgo(n.date)}
                    </span>
                    <span className="line-clamp-2 text-[13.5px] leading-snug font-semibold group-hover:text-accent">{n.title}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      {connected && fetchedAt > 0 && (
        <p className="col-span-2 text-center text-xs text-faint xl:col-span-4">
          Oppdatert kl {new Date(fetchedAt).toTimeString().slice(0, 5)} · oppdateres automatisk hver time
        </p>
      )}

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
                localStorage.removeItem(FEED_AT) // hent med en gang med den nye tilkoblingen
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
