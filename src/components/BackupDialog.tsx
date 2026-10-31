import { CloudUpload, Download, ExternalLink, FileUp, HardDriveDownload, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import scriptCode from '../../integrations/google-apps-script/Code.gs?raw'
import {
  counts,
  downloadBackup,
  driveReady,
  fetchDriveBackup,
  listDriveBackups,
  makeBackup,
  OldScriptError,
  parseBackup,
  uploadToDrive,
  type Backup,
  type DriveBackup,
} from '../lib/backup'
import { useSettings } from '../lib/settings'
import { useStore } from '../lib/store'
import { CopyButton } from './ui'

const when = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/** Eksport, import og sikkerhetskopi til Google Drive. */
export function BackupDialog({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const { settings, save } = useSettings()
  const data = { tasks: store.tasks, projects: store.projects, pages: store.pages, labels: store.labels }
  const connected = driveReady(settings)

  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [oldScript, setOldScript] = useState(false)
  const [list, setList] = useState<DriveBackup[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof OldScriptError) setOldScript(true)
      else setMessage({ text: e instanceof Error ? e.message : 'Noe gikk galt', error: true })
    } finally {
      setBusy(null)
    }
  }

  const loadList = useCallback(async () => {
    try {
      setList(await listDriveBackups(settings))
      setOldScript(false)
    } catch (e) {
      if (e instanceof OldScriptError) setOldScript(true)
      else setMessage({ text: e instanceof Error ? e.message : 'Kunne ikke hente listen', error: true })
    }
  }, [settings])

  useEffect(() => {
    if (connected) loadList()
  }, [connected, loadList])

  const restore = (backup: Backup, from: string) => {
    if (!confirm(`Erstatte alt i appen med kopien fra ${from}?\n\nKopien har ${counts(backup.data)}. Nå har du ${counts(data)}.\n\nDu kan angre rett etterpå.`)) return
    store.replaceAll(backup.data)
    onClose()
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-label="Sikkerhetskopi" onMouseDown={(e) => e.stopPropagation()} className="glass-strong animate-rise max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[28px] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Sikkerhetskopi</h2>
          <button onClick={onClose} aria-label="Lukk" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-sm text-muted">Nå: {counts(data)}.</p>

        <Section title="Google Drive" icon={<CloudUpload size={16} />}>
          {!connected ? (
            <p className="text-sm text-muted">
              Bruker det samme Google-skriptet som e-posten. Koble til under <b>Min dag → E-post → Koble til Gmail</b> først.
            </p>
          ) : oldScript ? (
            <UpdateScript onRetry={() => run('list', loadList)} busy={busy === 'list'} />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                {settings.backupAt ? <>Siste kopi: <b className="text-fg">{when(settings.backupAt)}</b></> : 'Ingen kopi tatt ennå.'} Lagres i mappen «Minapp sikkerhetskopier». De 30 siste dagene beholdes.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run('upload', async () => {
                      const { savedAt } = await uploadToDrive(settings, makeBackup(data, settings))
                      await save({ backupAt: savedAt })
                      setMessage({ text: 'Lagret i Google Drive' })
                      await loadList()
                    })
                  }
                  className="bg-accent-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === 'upload' ? <RefreshCw size={15} className="animate-spin" /> : <CloudUpload size={15} />} Ta kopi nå
                </button>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover">
                  <input
                    type="checkbox"
                    checked={settings.autoBackup !== false}
                    onChange={(e) => save({ autoBackup: e.target.checked })}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Automatisk hver dag
                </label>
              </div>

              {list && list.length > 0 && (
                <ul className="mt-4 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-glass-border bg-card">
                  {list.slice(0, 7).map((b) => (
                    <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium first-letter:uppercase">{when(b.updated)}</span>
                        <span className="text-xs text-faint">{kb(b.size)}</span>
                      </span>
                      <a href={b.url} target="_blank" rel="noreferrer" aria-label="Åpne i Drive" title="Åpne i Drive" className="grid size-8 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg">
                        <ExternalLink size={14} />
                      </a>
                      <button
                        disabled={!!busy}
                        onClick={() => run(b.id, async () => restore(await fetchDriveBackup(settings, b.id), when(b.updated)))}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-hover disabled:opacity-50"
                      >
                        {busy === b.id ? 'Henter …' : 'Gjenopprett'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>

        <Section title="Fil på denne enheten" icon={<HardDriveDownload size={16} />}>
          <p className="mb-3 text-sm text-muted">Last ned alt som én JSON-fil, eller hent inn en fil du har lastet ned før.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadBackup(makeBackup(data, settings))} className="flex items-center gap-2 rounded-xl border border-glass-border bg-card px-4 py-2 text-sm font-semibold hover:bg-card-hover">
              <Download size={15} /> Last ned
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-glass-border bg-card px-4 py-2 text-sm font-semibold hover:bg-card-hover">
              <FileUp size={15} /> Gjenopprett fra fil
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  restore(parseBackup(await file.text()), `filen «${file.name}»`)
                } catch (err) {
                  setMessage({ text: err instanceof Error ? err.message : 'Kunne ikke lese filen', error: true })
                }
              }}
            />
          </div>
        </Section>

        {message && <p className={`mt-4 text-sm ${message.error ? 'text-[#e5484d]' : 'text-[#22a06b]'}`}>{message.text}</p>}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-line p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Skriptet er fra før sikkerhetskopi fantes: lim inn ny kode og publiser en ny versjon (samme adresse). */
function UpdateScript({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  const step = 'grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent'
  return (
    <div className="text-sm">
      <p className="mb-3 text-muted">Skriptet i Google må oppdateres én gang for å kunne lagre i Drive. Adressen og nøkkelen er de samme.</p>
      <ol className="flex flex-col gap-3">
        <li className="flex gap-2.5">
          <span className={step}>1</span>
          <div className="flex-1">
            <p className="mb-1.5">
              Åpne{' '}
              <a href="https://script.google.com/home" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
                skriptet ditt <ExternalLink size={12} />
              </a>
              , slett koden og lim inn den nye:
            </p>
            <CopyButton text={scriptCode} label="Kopier koden" />
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className={step}>2</span>
          <p className="flex-1">
            Lagre, velg <code className="rounded bg-hover px-1">test</code> og klikk <b>Kjør</b>. Gi tillatelse til Google Drive når du blir spurt.
          </p>
        </li>
        <li className="flex gap-2.5">
          <span className={step}>3</span>
          <p className="flex-1">
            <b>Implementer → Administrer implementeringer</b> → blyanten → Versjon: <b>Ny versjon</b> → <b>Implementer</b>.
          </p>
        </li>
      </ol>
      <button onClick={onRetry} disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl border border-glass-border bg-card px-4 py-2 font-semibold hover:bg-card-hover disabled:opacity-50">
        <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Prøv igjen
      </button>
    </div>
  )
}
