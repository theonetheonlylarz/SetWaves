import React, { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMessage('')
    if (!email || !email.includes('@')) return setError('Please enter a valid email address.')
    setLoading(true)
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage(data.message || 'If that email exists, a reset link has been sent.')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div className="logo-mark">🎵</div>
            <span className="logo-text" style={{ fontSize: '26px' }}>Next Up</span>
          </div>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px' }}>Reset Password</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '13px', fontSize: '15px', borderRadius: '10px' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
            <Link to="/login" style={{ color: 'var(--muted)' }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
