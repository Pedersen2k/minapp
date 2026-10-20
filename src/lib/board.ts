import { uid } from './id'
import type { Column, Task } from './types'

export const defaultColumns = (): Column[] => [
  { id: uid(), name: 'Å gjøre' },
  { id: uid(), name: 'Pågår' },
  { id: uid(), name: 'Ferdig', done: true },
]

/**
 * Hvilken kolonne en oppgave står i. Fullførte oppgaver står alltid i «ferdig»-kolonnen
 * (også når de er huket av et annet sted), og oppgaver uten gyldig kolonne i den første.
 */
export function columnOf(task: Task, columns: Column[]): Column | undefined {
  const doneCol = columns.find((c) => c.done)
  if (task.done && doneCol) return doneCol
  const own = columns.find((c) => c.id === task.columnId && !c.done)
  return own ?? columns.find((c) => !c.done) ?? columns[0]
}
