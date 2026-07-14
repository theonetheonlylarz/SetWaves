import React from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '60px', borderBottom: '1px solid var(--border)', background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-mark" style={{ width: '30px', height: '30px', fontSize: '14px', borderRadius: '7px' }}>🎵</div>
          <span className="logo-text" style={{ fontSize: '18px' }}>SetWaves</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/login" style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', background: 'transparent' }}>Sign in</Link>
          <Link to="/signup" style={{ padding: '7px 16px', borderRadius: '8px', background: 'var(--neon)', color: '#000', fontSize: '13px', fontWeight: 800, textDecoration: 'none' }}>Get Started</Link>
        </div>
      </nav>

      <div style={{ background: 'radial-gradient(ellipse 100% 60% at 50% -5%, rgba(0,255,136,0.12) 0%, transparent 60%)', textAlign: 'center', padding: '80px 24px 60px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '20px', fontSize: '12px', fontWeight: 700, color: 'var(--neon)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px' }}>
          🎤 Live Show Interaction
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 7vw, 64px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: '1.05', marginBottom: '20px', maxWidth: '700px', margin: '0 auto 20px' }}>
          Let fans request songs<br />
          <span style={{ color: 'var(--neon)' }}>in real time</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '18px', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto 36px' }}>
          Fans buy coins, request songs, send shoutouts, and tip you directly. You accept or deny requests from your dashboard. You keep 90%.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/signup" style={{ padding: '14px 32px', background: 'var(--neon)', color: '#000', fontWeight: 800, fontSize: '16px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block' }}>
            Start for free →
          </Link>
          <Link to="/login" style={{ padding: '14px 28px', background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: '16px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block' }}>
            Sign in
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {[
            { icon: '🎵', title: 'Song Requests', desc: 'Fans tap a song from your setlist (or type any song) and pay with coins. You see every request in your Inbox — accept or deny with one tap.' },
            { icon: '⚡', title: 'Priority Queue', desc: 'Fans can pay more to jump the queue or lock in Play Next. You control the limits per show.' },
            { icon: '📣', title: 'Shoutouts & Tips', desc: 'Fans send you a paid message or tip coins directly. Every dollar goes through Stripe — you get 90%.' },
            { icon: '🎭', title: 'Vibe Vote', desc: 'Let fans vote on which genre you play next. Live results update on everyone\'s screen in real time.' },
            { icon: '📱', title: 'QR Code Check-in', desc: 'Display a QR code at your show. Fans scan it and land directly on your live show page — no app download required.' },
            { icon: '💸', title: '90% Payout', desc: 'Connect your bank account or debit card once. Earnings accumulate as fans spend coins and you can withdraw anytime.' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.icon}</div>
              <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '60px 24px 80px', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontWeight: 900, fontSize: '32px', marginBottom: '12px' }}>Ready to go live?</h2>
        <p style={{ color: 'var(--muted)', fontSize: '16px', marginBottom: '28px' }}>Sign up in 30 seconds — no credit card required.</p>
        <Link to="/signup" style={{ padding: '14px 36px', background: 'var(--neon)', color: '#000', fontWeight: 800, fontSize: '16px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block' }}>
          Create performer account →
        </Link>
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: '12px' }}>© 2025 SetWaves · <Link to="/login" style={{ color: 'var(--muted)' }}>Performer Sign In</Link></p>
      </footer>
    </div>
  )
}
