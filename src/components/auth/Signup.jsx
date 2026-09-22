import { useState } from 'react'
import { supabase } from '../../services/supabase'
import './auth.css'

export default function Signup({ onSwitchToLogin, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSignup = async (event) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (signupError) {
      setError(signupError.message)
      return
    }

    if (data.session) {
      setMessage('Account created successfully.')

      if (onSuccess) {
        onSuccess(data.user)
      }

      return
    }

    setMessage(
      'Account created. Please check your email to confirm your account.',
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">AURAAN</div>

        <h1>Create your account</h1>

        <p className="auth-subtitle">
          Join AURAAN and keep your music personalized.
        </p>

        <form onSubmit={handleSignup} className="auth-form">
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>

            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>

            <input
              id="signup-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-confirm-password">
              Confirm password
            </label>

            <input
              id="signup-confirm-password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          {message && <div className="auth-success">{message}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          <span>Already have an account?</span>

          <button type="button" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}