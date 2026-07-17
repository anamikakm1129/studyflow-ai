import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, registerUser } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { extractErrorMessage } from '../utils/formatters.js'
import Logo from '../components/Logo.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const isSignUp = mode === 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        await registerUser({ email, password, full_name: fullName || undefined })
        toast.success('Account created!')
      }
      // Sign-in happens either way: right after registering, or directly
      // when in sign-in mode.
      const { token } = await loginUser({ email, password })
      await login(token)
      toast.success(isSignUp ? 'Welcome to StudyFlow AI!' : 'Welcome back!')
      navigate('/')
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          isSignUp ? 'Could not create your account. Please try again.' : 'Sign-in failed. Check your email and password.'
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '20px'
      }}
    >
      <Card as="form" onSubmit={handleSubmit} style={{ width: '380px', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
          <Logo size={32} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700 }}>
            StudyFlow AI
          </span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', margin: '16px 0 20px' }}>
          {isSignUp ? 'Create an account to get started with StudyFlow AI.' : 'Welcome back — pick up right where you left off.'}
        </p>

        {isSignUp && (
          <div className="field" style={{ marginBottom: '14px' }}>
            <label htmlFor="fullName">Name (optional)</label>
            <input
              id="fullName"
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}

        <div className="field" style={{ marginBottom: '14px' }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field" style={{ marginBottom: '18px' }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isSignUp ? 8 : undefined}
            required
          />
        </div>

        {error && (
          <div className="form-error" style={{ margin: '0 0 14px' }}>
            {error}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} style={{ width: '100%' }}>
          {isSubmitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </Card>
    </div>
  )
}
