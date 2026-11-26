import type { Level } from './kaskjerda'
import type { Context, Project, Task } from './types'

/** Jobb og privat i kontrollvisningen, og terskler som gir varsler. */

export type ContextFilter = 'alt' | Context

/** Jobb for et prosjekt (eller hovedprosjektet over det). Uten valg regnes alt som privat. */
export function contextOf(projectId: string | undefined, projects: Project[]): Context {
  let p = projects.find((x) => x.id === projectId)
  for (let depth = 0; p && depth < 5; depth++) {
    if (p.context) return p.context
    p = p.parentId ? projects.find((x) => x.id === p!.parentId) : undefined
  }
  return 'privat'
}

export function filterTasks(tasks: Task[], projects: Project[], filter: ContextFilter): Task[] {
  return filter === 'alt' ? tasks : tasks.filter((t) => contextOf(t.projectId, projects) === filter)
}

/** Er noen prosjekter merket som jobb? Ellers er jobbvisningen tom, og det må vi si fra om. */
export const hasJobProjects = (projects: Project[]) => projects.some((p) => contextOf(p.id, projects) === 'jobb')

/** 0 = av. */
export interface Thresholds {
  besokFall?: number // prosent fall i besøk, siste 7 dager mot de 7 før
  kjoringerFeil?: number // antall mislykkede kjøringer på rad
  forfalt?: number // antall forfalte oppgaver
}

export const DEFAULT_THRESHOLDS: Required<Thresholds> = { besokFall: 50, kjoringerFeil: 2, forfalt: 5 }

export interface Signal {
  id: 'kjoringer' | 'besok' | 'forfalt'
  level: Level
  title: string
  meta: string
}

interface Input {
  thresholds?: Thresholds
  visits: { now: number; prev: number; pct: number | null } | null
  runs: { result: string }[] | null // nyeste først
  overdue: number
}

/** Varsler fra terskler. Rekkefølgen er den viktigste først. */
export function evaluateSignals({ thresholds, visits, runs, overdue }: Input): Signal[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }
  const out: Signal[] = []

  let failing = 0
  for (const r of runs ?? []) {
    if (r.result === 'failure') failing++
    else if (r.result === 'success') break
  }
  if (t.kjoringerFeil > 0 && failing >= t.kjoringerFeil) out.push({ id: 'kjoringer', level: 'bad', title: `${failing} kjøringer på rad har feilet`, meta: `kaskjerda.no · terskel ${t.kjoringerFeil}` })

  // Under 20 besøk uka før er tallene for små til at et prosentfall betyr noe.
  if (t.besokFall > 0 && visits && visits.pct !== null && visits.prev >= 20 && visits.pct <= -t.besokFall) {
    out.push({ id: 'besok', level: 'warn', title: `Besøket har falt ${Math.abs(visits.pct)} % mot uka før`, meta: `${visits.now} mot ${visits.prev} besøk · terskel ${t.besokFall} %` })
  }

  if (t.forfalt > 0 && overdue >= t.forfalt) out.push({ id: 'forfalt', level: 'warn', title: `${overdue} forfalte oppgaver`, meta: `terskel ${t.forfalt}` })
  return out
}
