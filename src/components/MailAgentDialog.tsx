import { ExternalLink, MailCheck, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import scriptCode from '../../integrations/google-apps-script/Code.gs?raw'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { View } from '../lib/types'
import { CopyButton } from './ui'

interface RunResult {
  checked: number
  tasks: number
  notes: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Av/på og «Gå gjennom nå» for e-postassistenten (Edge Function mail-agent). */
export function MailAgentDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const { sync, pages } = useStore()
  const { settings, save } = useSettings()
  const connected = !!(settings.gmailScriptUrl && settings.gmailKey)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const notesPage = pages.find((p) => p.title === 'Fra e-posten' && !p.deletedAt)

  const toggle = async (on: boolean) => {
    // Tidssonen trengs for at påminnelser fra e-post skal komme til riktig tid.
    await save({ mailAgent: on, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  }

  const runNow = async () => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (!settings.timeZone) await save({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      const { data, error } = await supabase.functions.invoke('mail-agent', { body: { run: true } })
      if (error) {
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? error.message)
      }
      setResult(data as RunResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  const step = 'grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent'

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label="E-postassistent" onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[28px] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <MailCheck size={19} className="text-accent" /> E-postassistent
          </h2>
          <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Går gjennom ny e-post hver time. Det du må gjøre blir oppgaver i innboksen med etiketten <b className="text-fg">@e-post</b>, med dato og påminnelse når e-posten har det. Ting som er verdt å huske skrives på siden <b className="text-fg">Fra e-posten</b>.
        </p>

        {!sync.enabled ? (
          <p className="text-sm text-muted">Krever innlogging med Supabase-synk.</p>
        ) : !connected ? (
          <p className="text-sm text-muted">Koble til Gmail under <b>Min dag → E-post → Koble til Gmail</b> først.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-glass-border bg-card px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">Gå gjennom e-posten hver time</span>
                <span className="text-xs text-muted">Bare nye e-poster fra de siste to døgnene, uten reklame</span>
              </span>
              <input type="checkbox" checked={!!settings.mailAgent} onChange={(e) => toggle(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={runNow} disabled={busy} className="bg-accent-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Leser e-posten …' : 'Gå gjennom nå'}
              </button>
              {notesPage && (
                <button onClick={() => { onClose(); onNavigate({ type: 'page', id: notesPage.id }) }} className="rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-hover">
                  Åpne notatene
                </button>
              )}
            </div>

            {result && (
              <p className="mt-3 text-sm text-[#22a06b]">
                {result.checked === 0
                  ? 'Ingen nye e-poster siden sist.'
                  : `Leste ${plural(result.checked, 'ny e-post', 'nye e-poster')}: ${plural(result.tasks, 'oppgave', 'oppgaver')} og ${plural(result.notes, 'notat', 'notater')}.`}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-[#e5484d]">{error}</p>}
          </>
        )}

        <details className="mt-5 rounded-2xl border border-line p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Oppsett (gjøres én gang, på PC)</summary>
          <ol className="mt-3 flex flex-col gap-3 text-muted">
            <li className="flex gap-2.5">
              <span className={step}>1</span>
              <div className="flex-1">
                <p className="mb-1.5">
                  Oppdater{' '}
                  <a href="https://script.google.com/home" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
                    Google-skriptet <ExternalLink size={12} />
                  </a>
                  : lim inn ny kode, lagre, og publiser en ny versjon under <b>Implementer → Administrer implementeringer</b>.
                </p>
                <CopyButton text={scriptCode} label="Kopier koden" />
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className={step}>2</span>
              <p className="flex-1">
                I Supabase: kjør <code className="rounded bg-hover px-1">supabase/migrations/011_epostassistent.sql</code>, legg inn hemmeligheten <code className="rounded bg-hover px-1">ANTHROPIC_API_KEY</code> under Edge Functions → Secrets, og publiser funksjonen <code className="rounded bg-hover px-1">mail-agent</code>.
              </p>
            </li>
            <li className="flex gap-2.5">
              <span className={step}>3</span>
              <p className="flex-1">
                Kjør den nye delen av <code className="rounded bg-hover px-1">supabase/cron.sql</code> for å gå gjennom e-posten hver time.
              </p>
            </li>
          </ol>
          <p className="mt-3 text-xs text-faint">E-postene sendes til Claude (Anthropic) for å bli lest. Skriptet sender bare tekst, aldri vedlegg.</p>
        </details>
      </div>
    </div>
  )
}
