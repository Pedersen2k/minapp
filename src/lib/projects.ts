import type { Project } from './types'

export const topLevel = (projects: Project[]) => projects.filter((p) => !p.parentId)
export const childrenOf = (projects: Project[], id: string) => projects.filter((p) => p.parentId === id)

export function descendantIds(projects: Project[], id: string): string[] {
  return childrenOf(projects, id).flatMap((c) => [c.id, ...descendantIds(projects, c.id)])
}

/** Prosjekter i trerekkefølge med dybde, for menyer og nedtrekkslister. */
export function projectTree(projects: Project[]): { project: Project; depth: number }[] {
  const walk = (list: Project[], depth: number): { project: Project; depth: number }[] =>
    list.flatMap((p) => [{ project: p, depth }, ...walk(childrenOf(projects, p.id), depth + 1)])
  return walk(topLevel(projects), 0)
}

// «#budsjett-2027» skal treffe prosjektet «Budsjett 2027».
const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')
export const findProjectByTag = (projects: Project[], tag: string) => projects.find((p) => normalize(p.name) === normalize(tag))

/** Maks antall nivåer: hovedprosjekt → underprosjekt → under-underprosjekt. */
export const MAX_DEPTH = 3

export function depthOf(projects: Project[], id: string): number {
  let depth = 1
  let p = projects.find((x) => x.id === id)
  while (p?.parentId) {
    depth++
    p = projects.find((x) => x.id === p!.parentId)
  }
  return depth
}

/** Hvor mange nivåer et prosjekt og alle underprosjektene tar (1 = ingen underprosjekter). */
export function heightOf(projects: Project[], id: string): number {
  const kids = childrenOf(projects, id)
  return kids.length ? 1 + Math.max(...kids.map((k) => heightOf(projects, k.id))) : 1
}

/** Mulige foreldre for et prosjekt uten å gå over MAX_DEPTH, og aldri seg selv eller egne underprosjekter. */
export function possibleParents(projects: Project[], id: string): Project[] {
  const excluded = new Set([id, ...descendantIds(projects, id)])
  const h = heightOf(projects, id)
  return projects.filter((p) => !excluded.has(p.id) && depthOf(projects, p.id) + h <= MAX_DEPTH)
}
