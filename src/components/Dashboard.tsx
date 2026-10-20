import { Check, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Copy, ExternalLink, Mail, Newspaper, RefreshCw, Settings2, Sun, Wind, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import scriptCode from '../../integrations/google-apps-script/Code.gs?raw'
import { formatLong, todayISO } from '../lib/date'
import { byTaskOrder } from '../lib/order'
import { DEFAULT_WEATHER, useSettings, type Settings } from '../lib/settings'
import { useStore } from '../lib/store'
import { fetchWeather, weatherKind, weatherText, type Weather, type WeatherKind } from '../lib/weather'
import { InlineQuickAdd } from './QuickAdd'
import { List } from './TaskList'

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

function Card({ title, icon, action, children, className = '' }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-glass-border bg-card p-4 md:p-5 ${className}`}>
      <header className="mb-3 flex items-center gap-2.5">
        <span className="text-muted">{icon}</span>
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
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
  const nextReminder = todays.find((t) => t.time && t.time > new Date().toTimeString().slice(0, 5))

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

  const refresh = (
    <button onClick={loadFeed} disabled={loading} aria-label="Oppdater" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
      <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
    </button>
  )

  return (
    <>
      <header className="mb-7">
        <p className="mb-1 text-sm font-medium text-muted first-letter:uppercase">{formatLong(today)}</p>
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.03em] md:text-[36px]">{greeting()}</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          {overdue.length + todays.length === 0
            ? 'Ingen oppgaver i dag – nyt dagen.'
            : `${todays.length} ${todays.length === 1 ? 'oppgave' : 'oppgaver'} i dag${overdue.length ? `, ${overdue.length} forfalt` : ''}${doneToday ? ` · ${doneToday} gjort` : ''}`}
          {nextReminder && ` · neste kl ${nextReminder.time}: ${nextReminder.title}`}
        </p>
      </header>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Venstre: oppgaver */}
        <div className="flex flex-col gap-4 md:gap-5">
          <Card title="I dag" icon={<Check size={17} />}>
            {overdue.length > 0 && (
              <>
                <p className="mb-2 px-1 text-xs font-semibold text-[#e5484d]">Forfalt</p>
                <List tasks={overdue} container={{ kind: 'static', id: 'dash-overdue' }} />
              </>
            )}
            <List tasks={todays} container={{ kind: 'due', date: today }} showDate={false} />
            <InlineQuickAdd defaults={{ due: today }} />
          </Card>
        </div>

        {/* Høyre: vær og e-post */}
        <div className="flex flex-col gap-4 md:gap-5">
          <Card title={`Været i ${place.name}`} icon={<CloudSun size={17} />}>
            {weather ? (
              <>
                <div className="flex items-center gap-4">
                  {WEATHER_ICON[weatherKind(weather.code)](44)}
                  <div className="flex-1">
                    <p className="text-4xl font-bold tracking-tight">{weather.temp}°</p>
                    <p className="text-sm text-muted">{weatherText(weather.code)}</p>
                  </div>
                  <div className="text-right text-[13px] text-muted">
                    <p>
                      <span className="font-semibold text-fg">{weather.max}°</span> / {weather.min}°
                    </p>
                    <p>Nedbør {weather.rain}%</p>
                    <p className="inline-flex items-center gap-1">
                      <Wind size={12} /> {weather.wind} m/s
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-6 gap-1 border-t border-line pt-3 text-center">
                  {weather.hours.map((h) => (
                    <div key={h.time} className="flex flex-col items-center gap-1 text-xs">
                      <span className="text-muted">{h.time.slice(0, 2)}</span>
                      {WEATHER_ICON[weatherKind(h.code)](18)}
                      <span className="font-semibold">{h.temp}°</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-sm text-muted">{weatherError ? 'Kunne ikke hente været akkurat nå.' : 'Henter været …'}</p>
            )}
          </Card>

          <Card
            title={feed?.unread ? `E-post · ${feed.unread} uleste` : 'E-post'}
            icon={<Mail size={17} />}
            action={
              connected && (
                <div className="flex items-center">
                  {refresh}
                  <button onClick={() => setSetup(true)} aria-label="Gmail-oppsett" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
                    <Settings2 size={15} />
                  </button>
                </div>
              )
            }
          >
            {!connected ? (
              <div className="py-2 text-center">
                <p className="mb-3 text-sm text-muted">Se de siste uleste e-postene dine her hver morgen.</p>
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
              <p className="py-4 text-sm text-muted">Henter e-post …</p>
            ) : feed.mails.length === 0 ? (
              <p className="py-4 text-sm text-muted">Ingen uleste e-poster. Innboksen er under kontroll.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {feed.mails.map((m) => (
                  <li key={m.id}>
                    <a href={m.url} target="_blank" rel="noreferrer" className="block rounded-xl px-2 py-2.5 hover:bg-hover">
                      <div className="flex items-baseline gap-2">
                        <span className="flex-1 truncate text-sm font-semibold">{m.from}</span>
                        <span className="shrink-0 text-xs text-faint">{timeAgo(m.date)}</span>
                      </div>
                      <p className="truncate text-sm">{m.subject}</p>
                      <p className="truncate text-xs text-muted">{m.snippet}</p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Nyheter over hele bredden */}
        <Card title="Nyheter" icon={<Newspaper size={17} />} action={connected && refresh} className="lg:col-span-2">
          {!connected ? (
            <p className="py-2 text-sm text-muted">Nyheter fra NRK hentes av det samme skriptet som e-posten. Koble til Gmail for å se dem.</p>
          ) : feed?.newsError ? (
            <p className="text-sm text-[#e5484d]">Kunne ikke hente nyheter akkurat nå.</p>
          ) : !feed?.news ? (
            <p className="py-4 text-sm text-muted">Henter nyheter …</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {feed.news.map((n) => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noreferrer" className="flex gap-3 rounded-2xl p-2 hover:bg-hover">
                    {n.image ? (
                      <img src={n.image} alt="" loading="lazy" className="size-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-hover text-faint">
                        <Newspaper size={22} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase">
                        {n.source} · {timeAgo(n.date)}
                      </p>
                      <p className="line-clamp-2 text-sm leading-snug font-semibold">{n.title}</p>
                      {n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.summary}</p>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {setup && <GmailSetup settings={settings} onSave={save} onClose={() => setSetup(false)} />}
    </>
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
