import type { Task } from './types'

/** Innboksen er for det som ikke er sortert ennå: ingen dato, intet prosjekt, ingen etikett. */
export const isInInbox = (t: Task) => !t.projectId && !t.due && !t.labels?.length

/** Å flytte en oppgave til innboksen gjør den usortert igjen. */
export const INBOX_PATCH: Partial<Task> = { projectId: undefined, sectionId: undefined, columnId: undefined, due: undefined, time: undefined, recurrence: undefined, labels: undefined }
