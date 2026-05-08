import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMessage(''); setLoading(true)
    try {
      const res = await fetch(API + '/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage(data.message)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '8px', fontWeight: 700 }}>Forgot Password</h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Enter your email and we will send you a reset link.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#94a3b8' }}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  )
}
