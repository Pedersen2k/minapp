import { useEffect, useLayoutEffect, useRef } from 'react'
import { useSettings, type Settings } from './settings'
import type { AppData } from './types'

/**
 * Sikkerhetskopi av alle oppgaver, prosjekter, sider og etiketter.
 * Lagres som JSON-fil på enheten, eller i Google Drive via det samme Apps Script-et
 * som henter e-post (se integrations/google-apps-script/Code.gs).
 */

export interface Backup {
  app: 'minapp'
  version: 1
  exportedAt: string
  data: AppData
  /** Innstillinger uten nøkkelen til skriptet. */
  settings?: Omit<Settings, 'gmailKey' | 'gmailScriptUrl'>
}

export interface DriveBackup {
  id: string
  name: string
  updated: string
  size: number
  url: string
}

/** Automatisk kopi tas når appen åpnes og forrige er eldre enn dette. */
export const AUTO_BACKUP_MS = 20 * 60 * 60 * 1000

export function makeBackup(data: AppData, settings: Settings): Backup {
  // Nøkkelen og adressen til skriptet skal ikke ligge i en fil som kan deles videre.
  const { gmailKey: _key, gmailScriptUrl: _url, ...rest } = settings
  return { app: 'minapp', version: 1, exportedAt: new Date().toISOString(), data, settings: rest }
}

export function counts(d: AppData): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  return [n(d.tasks.length, 'oppgave', 'oppgaver'), n(d.projects.length, 'prosjekt', 'prosjekter'), n(d.pages.filter((p) => !p.deletedAt).length, 'side', 'sider')].join(', ')
}

/** Leser en sikkerhetskopi og sjekker at den har riktig form før den tas i bruk. */
export function parseBackup(value: unknown): Backup {
  const b = (typeof value === 'string' ? JSON.parse(value) : value) as Partial<Backup>
  const d = b?.data as Partial<AppData> | undefined
  if (b?.app !== 'minapp' || !d || !Array.isArray(d.tasks) || !Array.isArray(d.projects) || !Array.isArray(d.pages)) {
    throw new Error('Filen er ikke en sikkerhetskopi fra Minapp')
  }
  return { ...b, data: { tasks: d.tasks, projects: d.projects, pages: d.pages, labels: Array.isArray(d.labels) ? d.labels : [] } } as Backup
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `minapp-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const driveReady = (s: Settings) => !!(s.gmailScriptUrl && s.gmailKey)

/** Skriptet må ha den nye koden med sikkerhetskopi. Det gamle svarer med e-post i stedet. */
export class OldScriptError extends Error {
  constructor() {
    super('Skriptet i Google må oppdateres for å lagre sikkerhetskopier')
  }
}

async function call<T>(s: Settings, init?: RequestInit, params = ''): Promise<T> {
  const res = await fetch(`${s.gmailScriptUrl}?key=${encodeURIComponent(s.gmailKey!)}${params}`, init)
  if (!res.ok) throw new Error(`Google svarte ${res.status}`)
  // Uten doPost/ny kode svarer Google med en HTML-side i stedet for JSON.
  const json = (await res.json().catch(() => {
    throw new OldScriptError()
  })) as T & { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

export async function uploadToDrive(s: Settings, backup: Backup): Promise<{ savedAt: string }> {
  // text/plain gir en «enkel» forespørsel uten CORS-forhånds­sjekk, som Apps Script ikke svarer på.
  const res = await call<{ ok?: boolean; savedAt?: string; unread?: number }>(s, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: s.gmailKey, backup }),
  })
  if (!res.ok || !res.savedAt) throw new OldScriptError()
  return { savedAt: res.savedAt }
}

export async function listDriveBackups(s: Settings): Promise<DriveBackup[]> {
  const res = await call<{ backups?: DriveBackup[] }>(s, undefined, '&action=backups')
  if (!res.backups) throw new OldScriptError()
  return res.backups
}

/** Tar en kopi til Drive når appen åpnes, hvis forrige er mer enn et knapt døgn gammel. */
export function useAutoBackup(data: AppData, ready: boolean) {
  const { settings, save } = useSettings()
  const tried = useRef(false)
  const latest = useRef(data)
  useLayoutEffect(() => {
    latest.current = data
  })
  const due = ready && driveReady(settings) && settings.autoBackup !== false && Date.now() - Date.parse(settings.backupAt ?? '0') > AUTO_BACKUP_MS

  useEffect(() => {
    if (!due || tried.current) return
    // Vent litt, så synken rekker å hente det nyeste fra andre enheter først.
    const t = setTimeout(async () => {
      tried.current = true
      try {
        const { savedAt } = await uploadToDrive(settings, makeBackup(latest.current, settings))
        await save({ backupAt: savedAt })
      } catch (e) {
        console.warn('Automatisk sikkerhetskopi feilet', e)
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [due, settings, save])
}

export async function fetchDriveBackup(s: Settings, id: string): Promise<Backup> {
  const res = await call<{ backup?: unknown }>(s, undefined, `&action=backup&id=${encodeURIComponent(id)}`)
  if (!res.backup) throw new OldScriptError()
  return parseBackup(res.backup)
}
