import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080810',
      color: '#e8e8f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px',
    }}>
      <div style={{ maxWidth: '420px' }}>
        <div style={{ fontSize: '52px', marginBottom: '14px' }}>🎵</div>
        <h1 style={{
          fontSize: '72px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em',
          background: 'linear-gradient(180deg, #ffffff 0%, #b8b8d4 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>404</h1>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '12px', marginBottom: '6px' }}>Page not found</h2>
        <p style={{ color: '#9898b0', marginBottom: '24px', fontSize: '14px' }}>
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: '#00ff88', color: '#000', padding: '12px 24px',
          borderRadius: '10px', textDecoration: 'none', fontWeight: 800,
          fontSize: '14px',
        }}>
          Back to Next Up →
        </Link>
      </div>
    </div>
  )
}
