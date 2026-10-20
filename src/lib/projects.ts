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
