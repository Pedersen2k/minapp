import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('Invalid login credentials')
          ? 'Feil e-post eller passord.'
          : navigator.onLine
            ? `Kunne ikke logge inn: ${error.message}`
            : 'Du er ikke på nett.',
      )
    }
  }

  const field =
    'w-full rounded-xl border border-glass-border bg-surface px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft'

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="glass animate-rise w-full max-w-sm rounded-[28px] p-8">
        <img src="/icon.svg" alt="" className="mb-6 size-12 rounded-2xl shadow-[0_10px_24px_-8px_rgb(91_75_214/0.6)]" />
        <h1 className="text-[26px] font-bold tracking-tight">Velkommen tilbake</h1>
        <p className="mt-1 mb-8 text-sm text-muted">Logg inn for å synke oppgaver og sider mellom enhetene dine.</p>

        <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="email">E-post</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${field} mb-4`} />

        <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="password">Passord</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />

        {error && <p className="mt-3 text-sm text-[#e5484d]">{error}</p>}

        <button type="submit" disabled={busy} className="bg-accent-gradient mt-6 w-full rounded-xl py-2.5 text-[15px] font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {busy ? 'Logger inn …' : 'Logg inn'}
        </button>
      </form>
    </div>
  )
}
