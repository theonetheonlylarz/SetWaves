import React from 'react'
import { Link } from 'react-router-dom'

const SUPPORT_EMAIL = 'larzgh44@gmail.com'

export default function ForgotPassword() {
  const mailto = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Next Up — password reset')
    + '&body=' + encodeURIComponent('Hi, I forgot my Next Up password.\n\nMy email on file is:\n\n')

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
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px' }}>Forgot your password?</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.55 }}>
            We're a small team and don't have automatic password resets yet.
            Email us and we'll get you back in within a few hours.
          </p>

          <a href={mailto}
            className="btn-primary"
            style={{ padding: '13px', fontSize: '15px', borderRadius: '10px', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            ✉️ Email support
          </a>

          <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--muted)' }}>
            or copy: <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{SUPPORT_EMAIL}</span>
          </p>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px' }}>
            <Link to="/login" style={{ color: 'var(--muted)' }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
