import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
      <div>
        <h1 style={{ fontSize: '80px', fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>404</h1>
        <h2 style={{ fontSize: '24px', marginTop: '16px', marginBottom: '8px' }}>Page Not Found</h2>
        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>The page you are looking for does not exist.</p>
        <Link to="/dashboard" style={{ background: '#7c3aed', color: 'white', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>Go Home</Link>
      </div>
    </div>
  )
}
