import { useState } from 'react'
import { supabase } from '../../services/supabase'

export default function AuthScreen({ onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleEmailAuth = async (event) => {
    event.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your name.')
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        })

        if (signUpError) {
          throw signUpError
        }

        setMessage(
          'Account created. Please check your email if confirmation is required.',
        )
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (signInError) {
          throw signInError
        }

        onClose?.()
      }
    } catch (authError) {
      setError(authError?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        })

      if (googleError) {
        throw googleError
      }
    } catch (authError) {
      setError(authError?.message || 'Unable to continue with Google.')
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode((currentMode) =>
      currentMode === 'login' ? 'signup' : 'login',
    )
    setError('')
    setMessage('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#15171d] p-6 shadow-2xl sm:p-8">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        ) : null}

        <div className="mb-7">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            {mode === 'login'
              ? 'Sign in to continue listening.'
              : 'Create an account to save your music and build your library.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3 font-medium text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg font-bold">G</span>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-gray-500">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'signup' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-[#0b0c10] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-white/30 disabled:opacity-50"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-[#0b0c10] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-white/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
              minLength={6}
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-[#0b0c10] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-white/30 disabled:opacity-50"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {mode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            disabled={loading}
            className="font-medium text-white underline underline-offset-4 hover:text-gray-300 disabled:opacity-50"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}