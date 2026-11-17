import { Menu, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackupDialog } from './components/BackupDialog'
import { CommandPalette } from './components/CommandPalette'
import { LabelDialog, ProjectDialog } from './components/EditDialogs'
import { Login } from './components/Login'
import { PageEditor } from './components/PageEditor'
import { QuickAdd } from './components/QuickAdd'
import { Sidebar, type Theme } from './components/Sidebar'
import { TaskDetail } from './components/TaskDetail'
import { TasksView } from './components/TasksView'
import { DayCard, MobileDrawer } from './components/MobileDrawer'
import { UndoToast } from './components/UndoToast'
import { useAutoBackup } from './lib/backup'
import { readLaunch } from './lib/launch'
import { useVisibleViewport } from './lib/viewport'
import { todayISO } from './lib/date'
import { useRoute } from './lib/route'
import { useStore } from './lib/store'
import { DragProvider } from './lib/dnd'
import { EditContext, OpenTaskContext } from './lib/ui-context'

const THEME_KEY = 'minapp:theme'

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignorer
    }
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export default function App() {
  const { sync } = useStore()
  useTheme()
  if (sync.enabled && !sync.authReady) return null
  if (sync.enabled && !sync.session) return <Login />
  return <Workspace />
}

function Workspace() {
  const { pages, projects, tasks, labels, sync, addTask, addPage } = useStore()
  const { view, navigate, taskId, openTask, closeTask } = useRoute()
  const [backup, setBackup] = useState(false)
  const quickAddBox = useVisibleViewport()
  useAutoBackup({ tasks, projects, pages, labels }, sync.status === 'synced' || sync.status === 'local')
  const [theme, setTheme] = useTheme()
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)
  const [editing, setEditing] = useState<{ kind: 'project'; id: string } | { kind: 'label'; name: string } | null>(null)
  const editApi = useMemo(
    () => ({
      editProject: (id: string) => setEditing({ kind: 'project', id }),
      editLabel: (name: string) => setEditing({ kind: 'label', name }),
    }),
    [],
  )

  const go = useCallback(
    (v: Parameters<typeof navigate>[0]) => {
      navigate(v)
      setDrawer(false)
    },
    [navigate],
  )
  const toggleTheme = useCallback(
    () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'),
    [setTheme],
  )
  const openQuickAdd = useCallback(() => setQuickAdd(true), [])

  // Åpnet fra en snarvei på app-ikonet eller fra «Del» i en annen app.
  useEffect(() => {
    const launch = readLaunch()
    if (!launch) return
    if (launch.kind === 'new-task') setQuickAdd(true)
    else if (launch.kind === 'new-page') navigate({ type: 'page', id: addPage().id })
    else {
      const t = addTask({ ...launch.task, priority: 4 })
      navigate({ type: 'inbox' })
      setTimeout(() => openTask(t.id), 0)
    }
  }, [navigate, addPage, addTask, openTask])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) {
        e.preventDefault()
        setQuickAdd(true)
      } else if (e.key === 'Escape') {
        setQuickAdd(false)
        setDrawer(false)
        setBackup(false)
        closeTask()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTask])

  const page = view.type === 'page' ? pages.find((p) => p.id === view.id) : undefined
  const mobileTitle =
    view.type === 'page'
      ? page?.title || 'Uten tittel'
      : view.type === 'project'
        ? projects.find((p) => p.id === view.id)?.name ?? ''
        : view.type === 'label'
          ? `@${view.name}`
          : { inbox: 'Innboks', today: 'I dag', upcoming: 'Kommende', calendar: 'Kalender', done: 'Fullført', dashboard: 'Min dag', trash: 'Papirkurv', projects: 'Prosjekter' }[view.type]

  // Tavle og kalender trenger bredden; lister og sider leses best smalt.
  const wide = (view.type === 'project' && projects.find((p) => p.id === view.id)?.view === 'board') || view.type === 'calendar' || view.type === 'dashboard'
  // Prosjektsidene har kort i rutenett og trenger mer plass enn en vanlig liste.
  const medium = view.type === 'project' || view.type === 'projects'

  const quickAddDefaults =
    view.type === 'project' ? { projectId: view.id } : view.type === 'today' || view.type === 'dashboard' ? { due: todayISO() } : undefined

  return (
    <OpenTaskContext.Provider value={openTask}>
      <EditContext.Provider value={editApi}>
      <DragProvider>
      <div className="book-root flex h-full md:gap-4 md:p-4">
        {/* Sidemeny: flytende glasspanel på PC, skuff på mobil */}
        <aside className="glass hidden w-[264px] shrink-0 overflow-hidden rounded-3xl md:block">
          <Sidebar view={view} onNavigate={go} onSearch={() => setPalette(true)} onBackup={() => setBackup(true)} theme={theme} onTheme={setTheme} />
        </aside>
        <MobileDrawer open={drawer} onOpenChange={setDrawer} disabled={quickAdd || palette || !!taskId || !!editing || backup}>
          <Sidebar view={view} onNavigate={go} onSearch={() => { setDrawer(false); setPalette(true) }} onBackup={() => { setDrawer(false); setBackup(true) }} top={<DayCard />} theme={theme} onTheme={setTheme} />
        </MobileDrawer>

        <main className="book-page flex min-w-0 flex-1 flex-col md:glass md:overflow-hidden md:rounded-[28px]">
          <header className="pt-safe sticky top-0 z-30 md:hidden">
            <div className="flex h-14 items-center gap-2 px-4">
              <button onClick={() => setDrawer(true)} className="glass grid size-10 place-items-center rounded-xl" aria-label="Meny">
                <Menu size={19} />
              </button>
              <span className="flex-1 truncate text-center text-[15px] font-semibold">{view.type === 'page' ? mobileTitle : ''}</span>
              <button onClick={() => setPalette(true)} className="glass grid size-10 place-items-center rounded-xl" aria-label="Søk">
                <Search size={18} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className={`mx-auto w-full px-4 pt-4 pb-36 md:px-12 md:pt-14 md:pb-24 ${wide ? 'max-w-[1400px]' : medium ? 'max-w-[1120px]' : 'max-w-[720px]'}`}>
              {view.type === 'page' ? (
                page ? (
                  <PageEditor key={page.id} page={page} onDeleted={() => go({ type: 'today' })} />
                ) : (
                  <p className="text-muted">Fant ikke siden.</p>
                )
              ) : (
                <TasksView view={view} onNavigate={go} />
              )}
            </div>
          </div>
        </main>

        {/* Mobil: inndatalinje i glass nederst */}
        {view.type !== 'page' && !quickAdd && !taskId && (
          <div className="book-hide pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
            <button
              onClick={openQuickAdd}
              className="glass-strong pointer-events-auto flex w-full items-center gap-3 rounded-[26px] py-2 pr-2 pl-5 text-left transition active:scale-[0.98]"
            >
              <span className="flex-1 text-[15px] text-faint">Hva skal gjøres?</span>
              <span className="bg-accent-gradient grid size-11 place-items-center rounded-[18px] text-white shadow-[0_8px_18px_-6px_rgb(91_75_214/0.7)]">
                <Plus size={22} />
              </span>
            </button>
          </div>
        )}

        {quickAdd && (
          <div style={quickAddBox} className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:items-start md:pt-[18vh]" onMouseDown={() => setQuickAdd(false)}>
            <div className="w-full max-w-lg" onMouseDown={(e) => e.stopPropagation()}>
              <QuickAdd defaults={quickAddDefaults} autoFocus onCancel={() => setQuickAdd(false)} onAdded={() => setQuickAdd(false)} />
            </div>
          </div>
        )}

        {taskId && <TaskDetail taskId={taskId} onClose={closeTask} />}

        {backup && <BackupDialog onClose={() => setBackup(false)} />}

        <UndoToast raised={view.type !== 'page' && !quickAdd && !taskId} />

        {editing?.kind === 'project' && <ProjectDialog projectId={editing.id} onClose={() => setEditing(null)} onNavigate={go} />}
        {editing?.kind === 'label' && <LabelDialog key={editing.name} name={editing.name} onClose={() => setEditing(null)} onNavigate={go} />}

        {palette && (
          <CommandPalette onClose={() => setPalette(false)} onNavigate={go} onNewTask={openQuickAdd} onToggleTheme={toggleTheme} onOpenTask={openTask} />
        )}
      </div>
      </DragProvider>
      </EditContext.Provider>
    </OpenTaskContext.Provider>
  )
}
