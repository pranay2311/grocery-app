import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2'

// One form for both: an existing username logs in, a new one creates an account.
export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('start') // start | confirmCreate
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  async function finish(sessionPromise) {
    const session = await sessionPromise
    login(session)
    navigate(location.state?.from ?? '/', { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'confirmCreate') {
        await finish(api.register(username, password))
        return
      }
      const { exists } = await api.checkUsername(username)
      if (exists) {
        await finish(api.login(username, password))
      } else {
        if (password.length < 6) throw new Error('Password needs at least 6 characters')
        setMode('confirmCreate') // ask once, so a typo in the username doesn't silently create a new account
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <div className="text-center mb-6">
        <p className="text-5xl">🛒</p>
        <h2 className="text-2xl font-bold text-emerald-700 mt-2">Grocery Prices</h2>
        <p className="text-slate-500 text-sm mt-1">Scan receipts, compare prices, track spending</p>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <label className="block text-sm font-medium">
          Username
          <input
            className={`${input} mt-1`}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setMode('start')
            }}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            className={`${input} mt-1`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'confirmCreate' ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {mode === 'confirmCreate' && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            There's no account called <b>{username.trim().toLowerCase()}</b> yet. Create it with this password?
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={busy} className="w-full rounded-lg bg-emerald-600 text-on-accent px-4 py-2 font-medium disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'confirmCreate' ? 'Create account' : 'Continue'}
        </button>
        {mode === 'confirmCreate' && (
          <button type="button" onClick={() => setMode('start')} className="w-full text-sm text-slate-500">
            Back
          </button>
        )}
        <p className="text-xs text-slate-400 text-center">New here? Just pick a username and password.</p>
      </form>
    </div>
  )
}
