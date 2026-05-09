import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Auth({ initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const switchTab = (t) => {
    setTab(t)
    setEmail('')
    setPassword('')
    setConfirm('')
    setDisplayName('')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !email.includes('@')) return setError('Please enter a valid email address.')
    if (!password || password.length < 6) return setError('Password must be at least 6 characters.')
    if (tab === 'signup' && password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const endpoint = tab === 'login' ? '/api/login' : '/api/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Something went wrong.')
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32 }}>
        <h1 style={{ color: 'var(--neon)', fontSize: 32, marginBottom: 8, textAlign: 'center', fontWeight: 800 }}>🎵 SetWaves</h1>
        <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 24, fontSize: 14 }}>
          {tab === 'login' ? 'Sign in to your account' : 'Create your account'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={() => switchTab('login')} style={{ flex: 1, background: tab === 'login' ? 'var(--neon)' : 'var(--border)', color: tab === 'login' ? '#000' : 'var(--text)', fontWeight: 700, padding: '12px 0', borderRadius: 8 }}>
            Login
          </button>
          <button onClick={() => switchTab('signup')} style={{ flex: 1, background: tab === 'signup' ? 'var(--purple)' : 'var(--border)', color: '#fff', fontWeight: 700, padding: '12px 0', borderRadius: 8 }}>
            Sign Up
          </button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'signup' && (
            <input
              placeholder="Display Name (optional)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
          {tab === 'signup' && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 0' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ background: tab === 'login' ? 'var(--neon)' : 'var(--purple)', color: '#fff', marginTop: 4, padding: '14px', fontSize: 16, fontWeight: 700, borderRadius: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Loading...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {tab === 'login' && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to="/forgot-password" style={{ color: 'var(--muted)', fontSize: 13 }}>Forgot password?</Link>
          </div>
        )}
        {tab === 'signup' && (
          <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            By signing up you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--neon)' }}>Terms</a> and{' '}
            <a href="/privacy" style={{ color: 'var(--neon)' }}>Privacy Policy</a>
          </p>
        )}
      </div>
    </div>
  )
}
