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
  createdAt: number
  completedAt?: number
}

export interface Project {
  id: string
  name: string
  color: string
  parentId?: string
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
  updatedAt: number
}

export interface AppData {
  tasks: Task[]
  projects: Project[]
  pages: Page[]
}

export type View =
  | { type: 'inbox' }
  | { type: 'today' }
  | { type: 'upcoming' }
  | { type: 'project'; id: string }
  | { type: 'page'; id: string }
