import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function ShowPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [show, setShow] = useState(null)
  const [packages, setPackages] = useState([])
  const [tokens, setTokens] = useState(parseInt(params.get('tokens') || '0'))
  const [requester, setRequester] = useState('')
  const [selectedSong, setSelectedSong] = useState('')
  const [customSong, setCustomSong] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(params.get('success') === 'true')
  const [error, setError] = useState('')
  const wsRef = useRef(null)

  const fetchShow = async () => {
    const res = await fetch(API + '/show/' + slug)
    if (res.ok) setShow(await res.json())
  }

  useEffect(() => {
    fetchShow()
    fetch(API + '/tokens/packages').then(r => r.json()).then(setPackages)
  }, [slug])

  useEffect(() => {
    if (!slug) return
    const wsBase = (API || window.location.origin).replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + slug)
    wsRef.current.onmessage = () => fetchShow()
    return () => wsRef.current?.close()
  }, [slug])

  const buyTokens = async (pkg) => {
    const res = await fetch(API + '/tokens/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: pkg.id, showSlug: slug })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setError(data.error || 'Failed to start checkout')
  }

  const requestSong = async (e) => {
    e.preventDefault()
    if (tokens < 1) return setError('You need tokens to request a song')
    const title = customSong || selectedSong
    if (!title) return setError('Please select or enter a song')
    setSubmitting(true); setError('')
    try {
      const res = await fetch(API + '/show/' + slug + '/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, requester: requester || 'Anonymous', tokens: 1 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTokens(t => t - 1); setSelectedSong(''); setCustomSong('')
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!show) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--neon)' }}>🎵 SetWaves</h1>
        <h2 style={{ fontSize: '20px', marginTop: '8px', color: 'var(--text)' }}>{show.displayName}</h2>
        <div style={{ display: 'inline-block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 16px', marginTop: '12px', fontSize: '14px', color: 'var(--text)' }}>
          {tokens} token{tokens !== 1 ? 's' : ''}
        </div>
      </div>

      {success && (
        <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid var(--neon)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--neon)', textAlign: 'center' }}>
          🎵 Request sent!
        </div>
      )}
      {error && <p className="error" style={{ marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

      {tokens > 0 ? (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Request a Song</h3>
          <form onSubmit={requestSong} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input placeholder="Your name (optional)" value={requester} onChange={e => setRequester(e.target.value)} />
            {show.songs.length > 0 && (
              <select value={selectedSong} onChange={e => { setSelectedSong(e.target.value); setCustomSong('') }}>
                <option value="">Pick from setlist...</option>
                {show.songs.map(s => (
                  <option key={s.id} value={s.title}>{s.title}{s.artist ? ' - ' + s.artist : ''}</option>
                ))}
              </select>
            )}
            <input placeholder="Or type any song..." value={customSong} onChange={e => { setCustomSong(e.target.value); setSelectedSong('') }} />
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Sending...' : 'Request (1 token)'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '4px' }}>Get tokens to request songs</p>
        </div>
      )}

      <div>
        <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Get Tokens</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {packages.map(pkg => (
            <button key={pkg.id} onClick={() => buyTokens(pkg)} style={{
              background: 'var(--surface)',
              border: '1px solid var(--neon)',
              borderRadius: '10px',
              padding: '14px 16px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--text)'
            }}>
              <span style={{ fontWeight: 600 }}>{pkg.name} — {pkg.tokens} tokens</span>
              <span style={{ color: 'var(--neon)', fontWeight: 700 }}>${(pkg.price / 100).toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {show.queue.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--muted)' }}>Up Next</h3>
          {show.queue.map(item => (
            <div key={item.id} style={{
              padding: '10px 14px',
              borderLeft: '3px solid var(--neon)',
              marginBottom: '8px',
              background: 'var(--surface)',
              borderRadius: '0 8px 8px 0'
            }}>
              <p style={{ fontWeight: 600 }}>{item.songTitle}</p>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>requested by {item.requester}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
