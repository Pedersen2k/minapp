import { Menu, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { Login } from './components/Login'
import { PageEditor } from './components/PageEditor'
import { QuickAdd } from './components/QuickAdd'
import { Sidebar, type Theme } from './components/Sidebar'
import { TasksView } from './components/TasksView'
import { todayISO } from './lib/date'
import { useRoute } from './lib/route'
import { useStore } from './lib/store'

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
  const { pages, projects } = useStore()
  const [view, navigate] = useRoute()
  const [theme, setTheme] = useTheme()
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)

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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = view.type === 'page' ? pages.find((p) => p.id === view.id) : undefined
  const mobileTitle =
    view.type === 'page'
      ? page?.title || 'Uten tittel'
      : view.type === 'project'
        ? projects.find((p) => p.id === view.id)?.name ?? ''
        : { inbox: 'Innboks', today: 'I dag', upcoming: 'Kommende' }[view.type]

  const quickAddDefaults =
    view.type === 'project' ? { projectId: view.id } : view.type === 'today' ? { due: todayISO() } : undefined

  return (
    <div className="flex h-full">
      {/* Sidemeny: fast på PC, skuff på mobil */}
      <aside className="hidden w-[264px] shrink-0 border-r border-line md:block">
        <Sidebar view={view} onNavigate={go} onSearch={() => setPalette(true)} theme={theme} onTheme={setTheme} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="animate-fade absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <aside className="animate-rise absolute inset-y-0 left-0 w-[82%] max-w-[300px] shadow-2xl">
            <Sidebar view={view} onNavigate={go} onSearch={() => { setDrawer(false); setPalette(true) }} theme={theme} onTheme={setTheme} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md md:hidden">
          <div className="flex h-12 items-center gap-2 px-2">
            <button onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Meny">
              <Menu size={20} />
            </button>
            <span className="flex-1 truncate text-center text-[15px] font-semibold">{mobileTitle}</span>
            <button onClick={() => setPalette(true)} className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Søk">
              <Search size={19} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-5 pt-6 pb-32 md:px-10 md:pt-14">
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

      {view.type !== 'page' && (
        <button
          onClick={openQuickAdd}
          aria-label="Ny oppgave"
          className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-95 md:hidden"
        >
          <Plus size={26} />
        </button>
      )}

      {quickAdd && (
        <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 backdrop-blur-[2px] md:items-start md:pt-[18vh]" onMouseDown={() => setQuickAdd(false)}>
          <div className="w-full max-w-lg" onMouseDown={(e) => e.stopPropagation()}>
            <QuickAdd defaults={quickAddDefaults} autoFocus onCancel={() => setQuickAdd(false)} onAdded={() => setQuickAdd(false)} />
          </div>
        </div>
      )}

      {palette && (
        <CommandPalette onClose={() => setPalette(false)} onNavigate={go} onNewTask={openQuickAdd} onToggleTheme={toggleTheme} />
      )}
    </div>
  )
}
