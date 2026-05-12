import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

export default function ShowPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [show, setShow] = useState(null)
  const [tokens, setTokens] = useState(parseInt(params.get('tokens') || '0'))
  const [requester, setRequester] = useState('')
  const [selectedSong, setSelectedSong] = useState('')
  const [customSong, setCustomSong] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(params.get('success') === 'true')
  const [error, setError] = useState('')
  const wsRef = useRef(null)

  const fetchShow = async () => {
    try {
      const res = await fetch('/api/show/' + slug)
      if (res.ok) setShow(await res.json())
    } catch (e) {}
  }

  useEffect(() => { fetchShow() }, [slug])

  useEffect(() => {
    if (!slug) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + slug)
    wsRef.current.onmessage = () => fetchShow()
    return () => wsRef.current?.close()
  }, [slug])

  const buyTokens = async (pkg) => {
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError(data.error || 'Checkout unavailable right now')
    } catch (e) { setError('Network error') }
  }

  const requestSong = async (e) => {
    e.preventDefault()
    if (tokens < 1) return setError('You need tokens to request a song')
    const title = customSong.trim() || selectedSong
    if (!title) return setError('Please select or enter a song')
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/queue/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, requester: requester.trim() || 'Anonymous' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTokens(t => t - 1)
      setSelectedSong(''); setCustomSong('')
      setSuccess(true); setTimeout(() => setSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  if (!show) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg)' }}>
      <Spinner />
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading show...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const packages = show.packages || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Hero */}
      <div style={{
        background: 'radial-gradient(ellipse 120% 80% at 50% -5%, rgba(0,255,136,0.1) 0%, transparent 65%)',
        borderBottom: '1px solid var(--border)',
        padding: '52px 20px 44px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '18px', padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px' }}>
          <div style={{ width: '18px', height: '18px', background: 'var(--neon)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>🎵</div>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Next Up</span>
        </div>

        <h1 style={{ fontSize: '38px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px', lineHeight: '1.1', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px' }}>
          {show.displayName}
        </h1>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: tokens > 0 ? 'rgba(0,255,136,0.08)' : 'var(--surface)',
          border: `1.5px solid ${tokens > 0 ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
          borderRadius: '24px',
          padding: '9px 20px',
          fontSize: '14px',
          fontWeight: 700,
          color: tokens > 0 ? 'var(--neon)' : 'var(--muted)',
          transition: 'all 0.3s ease',
        }}>
          🎟 {tokens} token{tokens !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Notifications */}
        {success && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            <p style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '16px' }}>🎵 Request sent!</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>You're in the queue. Enjoy the show!</p>
          </div>
        )}
        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* Request form */}
        {tokens > 0 ? (
          <div className="card" style={{ marginBottom: '28px', borderColor: 'rgba(0,255,136,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '18px' }}>Request a Song</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '3px' }}>Uses 1 token per request</p>
              </div>
              <span style={{ background: 'var(--neon-dim)', color: 'var(--neon)', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,255,136,0.2)', whiteSpace: 'nowrap' }}>
                🎟 {tokens} left
              </span>
            </div>
            <form onSubmit={requestSong} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                placeholder="Your name (optional)"
                value={requester}
                onChange={e => setRequester(e.target.value)}
              />
              {show.songs && show.songs.length > 0 && (
                <select value={selectedSong} onChange={e => { setSelectedSong(e.target.value); setCustomSong('') }}>
                  <option value="">Pick from setlist...</option>
                  {show.songs.map(s => (
                    <option key={s.id} value={s.title}>{s.title}{s.artist ? ' — ' + s.artist : ''}</option>
                  ))}
                </select>
              )}
              <input
                placeholder={show.songs?.length > 0 ? 'Or type any song...' : 'Song title...'}
                value={customSong}
                onChange={e => { setCustomSong(e.target.value); setSelectedSong('') }}
              />
              <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '14px', fontSize: '15px', borderRadius: '10px', marginTop: '4px' }}>
                {submitting ? 'Sending...' : '🎵 Send Request — 1 token'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '28px', textAlign: 'center', padding: '32px', border: '1.5px dashed var(--border)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎟</div>
            <p style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>No tokens yet</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Pick a package below to request songs</p>
          </div>
        )}

        {/* Token packages */}
        <div style={{ marginBottom: '8px' }}>
          <h2 style={{ fontWeight: 800, fontSize: '18px', marginBottom: '4px' }}>Get Tokens</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '18px' }}>
            Each token lets you request one song from {show.displayName}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {packages.map((pkg, i) => (
              <button
                key={pkg.id}
                onClick={() => buyTokens(pkg)}
                style={{
                  background: i === 1 ? 'rgba(0,255,136,0.04)' : 'var(--surface)',
                  border: `1.5px solid ${i === 1 ? 'rgba(0,255,136,0.25)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: 'var(--text)',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                {i === 1 && (
                  <span style={{ position: 'absolute', top: '-10px', right: '16px', background: 'var(--neon)', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Best value
                  </span>
                )}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '15px' }}>{pkg.name}</p>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '3px' }}>
                    {pkg.tokens} song request{pkg.tokens !== 1 ? 's' : ''}
                  </p>
                </div>
                <span style={{ color: 'var(--neon)', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                  ${(pkg.price / 100).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
