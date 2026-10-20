import type { PostgrestError, Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { remindAt } from './reminders'
import { supabase } from './supabase'
import type { AppData, Label, Page, Project, Task } from './types'

/**
 * Lokal-først synk mot Supabase.
 *
 * Alle endringer skjer først lokalt (lagret i localStorage). En diff mellom forrige og ny
 * tilstand gir en kø av operasjoner som sendes til Supabase i rekkefølge. Køen overlever
 * at appen lukkes, så endringer gjort uten nett sendes når nettet er tilbake.
 * Endringer fra andre enheter kommer inn via sanntid og når appen får fokus igjen.
 */

type Table = 'projects' | 'tasks' | 'pages' | 'labels'
type Row = Record<string, unknown>
type Item = Task | Project | Page | Label

interface Op {
  table: Table
  kind: 'upsert' | 'delete'
  id: string
  row?: Row
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline'

// Prosjekter først, så oppgaver som peker på dem finnes når de lastes opp.
const TABLES: Table[] = ['projects', 'tasks', 'pages', 'labels']
const QUEUE_KEY = 'minapp:queue'
const OWNER_KEY = 'minapp:owner'
const REMIND_BACKFILL_KEY = 'minapp:remind-backfill'

const iso = (ms: number) => new Date(ms).toISOString()
const ms = (s: unknown) => new Date(s as string).getTime()

function toRow(table: Table, item: Item): Row {
  const now = new Date().toISOString()
  if (table === 'labels') {
    const l = item as Label
    return { id: l.id, name: l.name, color: l.color, updated_at: now }
  }
  if (table === 'projects') {
    const p = item as Project
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      parent_id: p.parentId ?? null,
      icon: p.icon ?? null,
      position: p.position ?? null,
      view: p.view ?? null,
      columns: p.columns ?? [],
      updated_at: now,
    }
  }
  if (table === 'tasks') {
    const t = item as Task
    return {
      id: t.id,
      title: t.title,
      done: t.done,
      due: t.due ?? null,
      time: t.time ?? null,
      priority: t.priority,
      project_id: t.projectId ?? null,
      notes: t.notes ?? null,
      recurrence: t.recurrence ?? null,
      subtasks: t.subtasks ?? [],
      labels: t.labels ?? [],
      column_id: t.columnId ?? null,
      reminder: t.reminder ?? null,
      remind_at: remindAt(t),
      position: t.position ?? null,
      created_at: iso(t.createdAt),
      completed_at: t.completedAt ? iso(t.completedAt) : null,
      updated_at: now,
    }
  }
  const p = item as Page
  return { id: p.id, title: p.title, icon: p.icon, blocks: p.blocks, position: p.position ?? null, updated_at: iso(p.updatedAt) }
}

function fromRow(table: Table, r: Row): Item {
  if (table === 'labels') return { id: r.id, name: r.name, color: r.color } as Label
  if (table === 'projects') {
    const p = { id: r.id, name: r.name, color: r.color } as Project
    if (r.parent_id) p.parentId = r.parent_id as string
    if (r.position != null) p.position = r.position as number
    if (r.icon) p.icon = r.icon as string
    if (r.view) p.view = r.view as Project['view']
    if (Array.isArray(r.columns) && r.columns.length > 0) p.columns = r.columns as Project['columns']
    return p
  }
  if (table === 'tasks') {
    const t: Task = {
      id: r.id as string,
      title: r.title as string,
      done: r.done as boolean,
      priority: r.priority as Task['priority'],
      createdAt: ms(r.created_at),
    }
    if (r.due) t.due = r.due as string
    if (r.time) t.time = r.time as string
    if (r.project_id) t.projectId = r.project_id as string
    if (r.completed_at) t.completedAt = ms(r.completed_at)
    if (r.notes) t.notes = r.notes as string
    if (r.recurrence) t.recurrence = r.recurrence as Task['recurrence']
    if (Array.isArray(r.subtasks) && r.subtasks.length > 0) t.subtasks = r.subtasks as Task['subtasks']
    if (Array.isArray(r.labels) && r.labels.length > 0) t.labels = r.labels as string[]
    if (r.column_id) t.columnId = r.column_id as string
    if (r.reminder != null) t.reminder = r.reminder as number
    if (r.position != null) t.position = r.position as number
    return t
  }
  const page = { id: r.id, title: r.title, icon: r.icon, blocks: r.blocks, updatedAt: ms(r.updated_at) } as Page
  if (r.position != null) page.position = r.position as number
  return page
}

// Sammenligner uavhengig av nøkkelrekkefølge, og behandler tomme felt (undefined, '', []) som like.
const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
function same(a: Item, b: Item): boolean {
  const norm = (x: Item) => JSON.stringify(Object.entries(x).filter(([, v]) => !isEmpty(v)).sort(([k1], [k2]) => k1.localeCompare(k2)))
  return norm(a) === norm(b)
}

function loadQueue(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Op[]
  } catch {
    return []
  }
}

function saveQueue(q: Op[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // ignorer
  }
}

// Feil fra databasen (f.eks. ugyldige data) blir ikke bedre av å prøve igjen; nettverksfeil gjør det.
const isPermanent = (e: PostgrestError) => !!e.code && /^(PGRST|[0-9A-Z]{5}$)/.test(e.code)

export function useSync(data: AppData, setData: Dispatch<SetStateAction<AppData>>) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [status, setStatus] = useState<SyncStatus>(supabase ? 'syncing' : 'local')
  const userId = session?.user.id

  const queue = useRef<Op[]>(loadQueue())
  const inFlight = useRef(false)
  const prev = useRef(data)
  const remoteItems = useRef(new WeakSet<object>())
  const remoteDeleted = useRef(new Set<string>())
  const flushTimer = useRef<number | undefined>(undefined)
  const retryTimer = useRef<number | undefined>(undefined)
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const hasPending = (id: string) => queue.current.some((q) => q.id === id)

  // --- Innlogging ---
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // --- Sending av køen ---
  const flush = useCallback(async () => {
    if (!supabase || !userId || inFlight.current) return
    inFlight.current = true
    try {
      while (queue.current.length > 0) {
        setStatus('syncing')
        const op = queue.current[0]
        const { error } =
          op.kind === 'upsert'
            ? await supabase.from(op.table).upsert({ ...op.row, user_id: userId })
            : await supabase.from(op.table).delete().eq('id', op.id)
        if (error && !isPermanent(error)) {
          setStatus('offline')
          clearTimeout(retryTimer.current)
          retryTimer.current = window.setTimeout(() => flushRef.current(), 10_000)
          return
        }
        if (error) console.error('Synk: hoppet over operasjon som ble avvist', op, error)
        queue.current.shift()
        saveQueue(queue.current)
      }
      setStatus('synced')
    } finally {
      inFlight.current = false
    }
  }, [userId])
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const enqueue = useCallback((ops: Op[]) => {
    for (const op of ops) {
      // Slå sammen med en ventende upsert av samme rad (f.eks. hvert tastetrykk på en side),
      // men aldri med en operasjon som er under sending.
      if (op.kind === 'upsert') {
        let last = -1
        queue.current.forEach((q, i) => {
          if (q.table === op.table && q.id === op.id) last = i
        })
        const busy = inFlight.current && last === 0
        if (last >= 0 && !busy && queue.current[last].kind === 'upsert') {
          queue.current[last] = op
          continue
        }
      }
      queue.current.push(op)
    }
    saveQueue(queue.current)
    clearTimeout(flushTimer.current)
    flushTimer.current = window.setTimeout(() => flushRef.current(), 600)
  }, [])

  // --- Lokale endringer → kø ---
  useEffect(() => {
    const before = prev.current
    prev.current = data
    if (!supabase || before === data) return
    const ops: Op[] = []
    for (const table of TABLES) {
      const old = new Map<string, Item>(before[table].map((x) => [x.id, x]))
      const ids = new Set<string>()
      for (const item of data[table] as Item[]) {
        ids.add(item.id)
        if (old.get(item.id) !== item && !remoteItems.current.has(item)) {
          ops.push({ table, kind: 'upsert', id: item.id, row: toRow(table, item) })
        }
      }
      for (const id of old.keys()) {
        if (ids.has(id)) continue
        if (remoteDeleted.current.delete(id)) continue
        ops.push({ table, kind: 'delete', id })
      }
    }
    if (ops.length) enqueue(ops)
  }, [data, enqueue])

  // --- Hent alt fra Supabase ---
  const pull = useCallback(async () => {
    if (!supabase || !userId) return
    await flushRef.current()
    const results = await Promise.all(TABLES.map((t) => supabase!.from(t).select('*')))
    if (results.some((r) => r.error)) {
      setStatus('offline')
      return
    }
    const remote = Object.fromEntries(
      TABLES.map((t, i) => [t, (results[i].data as Row[]).map((r) => fromRow(t, r))]),
    ) as unknown as AppData

    const firstLogin = localStorage.getItem(OWNER_KEY) !== userId
    localStorage.setItem(OWNER_KEY, userId)
    const remoteEmpty = TABLES.every((t) => remote[t].length === 0)

    if (firstLogin && remoteEmpty) {
      // Første innlogging med tom database: last opp det som finnes lokalt.
      const d = prev.current
      enqueue(TABLES.flatMap((t) => (d[t] as Item[]).map((x) => ({ table: t, kind: 'upsert' as const, id: x.id, row: toRow(t, x) }))))
      return
    }

    setData((d) => {
      const next = { ...d }
      let changed = false
      for (const t of TABLES) {
        const local = new Map<string, Item>((d[t] as Item[]).map((x) => [x.id, x]))
        const merged: Item[] = []
        for (const r of remote[t] as Item[]) {
          const l = local.get(r.id)
          if (l && (hasPending(r.id) || same(l, r))) merged.push(l)
          else {
            remoteItems.current.add(r)
            merged.push(r)
            changed = true
          }
          local.delete(r.id)
        }
        // Lokale rader som ikke finnes i databasen: behold hvis de venter på opplasting, ellers slettet et annet sted.
        for (const [id, l] of local) {
          if (hasPending(id)) merged.push(l)
          else {
            remoteDeleted.current.add(id)
            changed = true
          }
        }
        ;(next as Record<Table, Item[]>)[t] = merged
      }
      return changed ? next : d
    })
    // Engangs: gi eksisterende oppgaver med klokkeslett et varslingstidspunkt i databasen.
    if (!localStorage.getItem(REMIND_BACKFILL_KEY)) {
      localStorage.setItem(REMIND_BACKFILL_KEY, '1')
      const timed = prev.current.tasks.filter((t) => remindAt(t))
      if (timed.length) enqueue(timed.map((t) => ({ table: 'tasks' as const, kind: 'upsert' as const, id: t.id, row: toRow('tasks', t) })))
    }
    if (queue.current.length === 0) setStatus('synced')
  }, [userId, enqueue, setData])

  // --- Sanntid og gjenoppfrisking ---
  useEffect(() => {
    if (!supabase || !userId) return
    pull()

    const channel = supabase
      .channel('minapp-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const t = payload.table as Table
        if (!TABLES.includes(t)) return
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (!id || hasPending(id)) return
          setData((d) => {
            if (!(d[t] as Item[]).some((x) => x.id === id)) return d
            remoteDeleted.current.add(id)
            return { ...d, [t]: (d[t] as Item[]).filter((x) => x.id !== id) }
          })
          return
        }
        const item = fromRow(t, payload.new as Row)
        if (hasPending(item.id)) return
        setData((d) => {
          const list = d[t] as Item[]
          const i = list.findIndex((x) => x.id === item.id)
          if (i >= 0 && same(list[i], item)) return d
          remoteItems.current.add(item)
          const nextList = i >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
          return { ...d, [t]: nextList }
        })
      })
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') pull()
    }
    const onOnline = () => pull()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      supabase!.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [userId, pull, setData])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  return useMemo(() => ({ enabled: !!supabase, session, authReady, status, signOut }), [session, authReady, status, signOut])
}
