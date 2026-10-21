import { useDraggable, useDroppable } from '@dnd-kit/core'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import { addDays, formatLong, fromISO, holidayName, isoWeek, MONTHS, toISO, todayISO } from '../lib/date'
import { byTaskOrder } from '../lib/order'
import { useStore } from '../lib/store'
import type { Task } from '../lib/types'
import { useOpenTask } from '../lib/ui-context'
import { InlineQuickAdd } from './QuickAdd'
import { List } from './TaskList'
import { PRIORITY_COLOR } from './ui'

const GRID = 'grid grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] md:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]'
const WEEKDAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

/** Alle dager som vises i månedsrutenettet: hele uker fra mandag til søndag. */
function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const start = addDays(toISO(first), -((first.getDay() + 6) % 7))
  const last = new Date(year, month + 1, 0)
  const end = addDays(toISO(last), (7 - last.getDay()) % 7)
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

/** Månedskalender: dra oppgaver mellom dager, klikk en dag for å se den. */
export function CalendarView() {
  const { tasks } = useStore()
  const today = todayISO()
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [selected, setSelected] = useState(today)
  const [showUndated, setShowUndated] = useState(false)

  const days = monthGrid(cursor.year, cursor.month)
  const open = tasks.filter((t) => !t.done)
  const byDay = new Map<string, Task[]>()
  for (const t of open) if (t.due) byDay.set(t.due, [...(byDay.get(t.due) ?? []), t])
  for (const list of byDay.values()) list.sort(byTaskOrder)
  const undated = open.filter((t) => !t.due).sort(byTaskOrder)
  const selectedTasks = byDay.get(selected) ?? []

  const shift = (n: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + n, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {MONTHS[cursor.month].charAt(0).toUpperCase() + MONTHS[cursor.month].slice(1)} <span className="font-normal text-muted">{cursor.year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="Forrige måned" className="grid size-9 place-items-center rounded-xl border border-glass-border bg-card hover:bg-card-hover">
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => {
              setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })
              setSelected(today)
            }}
            className="h-9 rounded-xl border border-glass-border bg-card px-3 text-sm font-medium hover:bg-card-hover"
          >
            I dag
          </button>
          <button onClick={() => shift(1)} aria-label="Neste måned" className="grid size-9 place-items-center rounded-xl border border-glass-border bg-card hover:bg-card-hover">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-glass-border bg-card">
        <div className={`${GRID} border-b border-line`}>
          <div className="py-2 text-center text-[10px] font-semibold text-faint md:text-xs">Uke</div>
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted">{d}</div>
          ))}
        </div>
        <div className={GRID}>
          {days.map((d, i) => (
            <Fragment key={d}>
            {i % 7 === 0 && (
              <div className={`grid place-items-start justify-center pt-2 text-[10px] font-medium text-faint md:text-xs ${i >= days.length - 7 ? '' : 'border-b'} border-r border-line`}>
                {isoWeek(d)}
              </div>
            )}
            <DayCell
              date={d}
              tasks={byDay.get(d) ?? []}
              inMonth={fromISO(d).getMonth() === cursor.month}
              isToday={d === today}
              isSelected={d === selected}
              lastRow={i >= days.length - 7}
              onSelect={() => setSelected(d)}
            />
            </Fragment>
          ))}
        </div>
      </div>

      <section className="mt-7">
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold text-muted first-letter:uppercase">
          {selected === today ? 'I dag · ' : ''}
          {formatLong(selected)}
          {holidayName(selected) && <span className="font-normal text-[#e5484d]"> · {holidayName(selected)}</span>}
          <span className="font-normal text-faint"> · uke {isoWeek(selected)}</span>
        </h2>
        <List tasks={selectedTasks} container={{ kind: 'due', date: selected }} showDate={false} />
        <InlineQuickAdd key={selected} defaults={{ due: selected }} />
      </section>

      {undated.length > 0 && (
        <section className="mt-8">
          <button onClick={() => setShowUndated(!showUndated)} className="mb-2.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted">
            <ChevronDown size={15} className={`transition ${showUndated ? '' : '-rotate-90'}`} />
            Uten dato ({undated.length})
            <span className="hidden font-normal text-faint md:inline">· dra inn i kalenderen for å planlegge</span>
          </button>
          {showUndated && <List tasks={undated} container={{ kind: 'static', id: 'undated' }} />}
        </section>
      )}
    </div>
  )
}

interface DayCellProps {
  date: string
  tasks: Task[]
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  lastRow: boolean
  onSelect: () => void
}

function DayCell({ date, tasks, inMonth, isToday, isSelected, lastRow, onSelect }: DayCellProps) {
  const today = todayISO()
  const { setNodeRef, isOver } = useDroppable({ id: `cal-day:${date}`, data: { type: 'container', container: { kind: 'due', date }, items: tasks } })
  const weekday = (fromISO(date).getDay() + 6) % 7
  const shown = tasks.slice(0, 3)
  const holiday = holidayName(date)
  const red = holiday || weekday === 6

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`relative min-h-16 cursor-pointer p-1 transition md:min-h-28 md:p-1.5 ${lastRow ? '' : 'border-b'} ${weekday < 6 ? 'border-r' : ''} border-line ${
        isOver ? 'bg-accent-soft' : isSelected ? 'bg-hover' : 'hover:bg-hover'
      } ${inMonth ? '' : 'opacity-45'}`}
    >
      <div className="mb-1 flex min-w-0 justify-center md:justify-start" title={holiday}>
        <span
          className={`grid size-6 place-items-center rounded-full text-xs font-semibold md:size-7 md:text-[13px] ${
            isToday ? 'bg-accent-gradient text-white shadow-[0_4px_10px_-3px_rgb(91_75_214/0.6)]' : isSelected ? 'text-accent' : red ? 'text-[#e5484d]' : ''
          }`}
        >
          {fromISO(date).getDate()}
        </span>
        {holiday && <span className="ml-1.5 hidden truncate self-center text-[11px] font-medium text-[#e5484d] md:inline" title={holiday}>{holiday}</span>}
      </div>

      {/* PC: oppgavene som brikker. Mobil: prikker, siden rutene er små. */}
      <div className="hidden flex-col gap-1 md:flex">
        {shown.map((t) => (
          <TaskChip key={t.id} task={t} overdue={date < today} items={tasks} />
        ))}
        {tasks.length > 3 && <span className="px-1.5 text-[11px] font-medium text-muted">+{tasks.length - 3} til</span>}
      </div>
      <div className="flex flex-wrap justify-center gap-[3px] md:hidden">
        {tasks.slice(0, 4).map((t) => (
          <span key={t.id} className="size-[5px] rounded-full" style={{ background: date < today ? '#e5484d' : PRIORITY_COLOR[t.priority] === 'var(--faint)' ? 'var(--accent)' : PRIORITY_COLOR[t.priority] }} />
        ))}
      </div>
    </div>
  )
}

function TaskChip({ task, overdue, items }: { task: Task; overdue: boolean; items: Task[] }) {
  const openTask = useOpenTask()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal:${task.id}`,
    data: { type: 'task', task, container: { kind: 'due', date: task.due }, items },
  })
  const color = overdue ? '#e5484d' : PRIORITY_COLOR[task.priority] === 'var(--faint)' ? 'var(--accent)' : PRIORITY_COLOR[task.priority]
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        openTask(task.id)
      }}
      className={`truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium select-none ${isDragging ? 'opacity-30' : ''}`}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
      title={task.title}
    >
      {task.time && <span className="mr-1 opacity-70">{task.time}</span>}
      {task.title}
    </button>
  )
}
