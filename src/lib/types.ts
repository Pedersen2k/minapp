export type Priority = 1 | 2 | 3 | 4

export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  done: boolean
  due?: string // YYYY-MM-DD
  time?: string // HH:MM
  priority: Priority
  projectId?: string
  notes?: string
  recurrence?: Recurrence
  subtasks?: Subtask[]
  labels?: string[]
  columnId?: string // kolonne på kanban-tavlen
  reminder?: number // minutter før klokkeslettet; mangler = ved tidspunktet, -1 = av
  position?: number // manuell rekkefølge; mangler den, brukes createdAt
  createdAt: number
  completedAt?: number
}

export interface Column {
  id: string
  name: string
  done?: boolean // oppgaver som slippes her, hukes av
}

export interface Project {
  id: string
  name: string
  color: string
  icon?: string // emoji; uten ikon vises en farget prikk
  parentId?: string
  position?: number
  view?: 'list' | 'board'
  columns?: Column[]
}

export type BlockType = 'p' | 'h1' | 'h2' | 'todo' | 'bullet' | 'quote'

export interface Block {
  id: string
  type: BlockType
  text: string
  checked?: boolean
}

export interface Page {
  id: string
  title: string
  icon: string
  blocks: Block[]
  position?: number
  updatedAt: number
}

/** Innstillinger for en etikett. Selve etikettene ligger som navn på oppgavene. */
export interface Label {
  id: string
  name: string
  color: string
}

export interface AppData {
  tasks: Task[]
  projects: Project[]
  pages: Page[]
  labels: Label[]
}

export type View =
  | { type: 'dashboard' }
  | { type: 'inbox' }
  | { type: 'today' }
  | { type: 'upcoming' }
  | { type: 'calendar' }
  | { type: 'done' }
  | { type: 'project'; id: string }
  | { type: 'label'; name: string }
  | { type: 'page'; id: string }
