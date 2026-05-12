import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Auth({ initialTab }) {
  const [tab, setTab] = useState(initialTab || 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = tab === 'login' ? '/api/login' : '/api/register'
      const body = tab === 'login'
        ? { email, password }
        : { email, password, displayName }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t) => { setTab(t); setError('') }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0,255,136,0.07) 0%, transparent 65%)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div className="logo-mark">🎵</div>
            <span className="logo-text" style={{ fontSize: '28px' }}>Next Up</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>
            {tab === 'login' ? 'Welcome back' : 'Start taking song requests tonight'}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 32px' }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--surface2)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '28px',
          }}>
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([t, label]) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: tab === t ? 'var(--surface)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--muted)',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Stage Name
                </label>
                <input
                  type="text"
                  placeholder="How fans will see you"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus={tab === 'login'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <p className="error">{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '13px', fontSize: '15px', marginTop: '4px', borderRadius: '10px' }}
            >
              {loading ? 'Loading...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {tab === 'login' && (
            <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px' }}>
              <a href="/forgot-password" style={{ color: 'var(--muted)' }}>Forgot password?</a>
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
          Are you a fan?<br />
          <span style={{ color: 'var(--text-secondary)' }}>Scan the QR code at your performer's show.</span>
        </p>
      </div>
    </div>
  )
}
