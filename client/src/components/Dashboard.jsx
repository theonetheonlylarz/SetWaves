import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('queue')
  const [newSong, setNewSong] = useState({ title: '', artist: '' })
  const [qr, setQr] = useState(null)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const navigate = useNavigate()
  const wsRef = useRef(null)
  const token = localStorage.getItem('token')
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  const fetchData = async () => {
    try {
      const res = await fetch(API + '/show/dashboard/me', { headers })
      if (res.status === 401) { localStorage.clear(); navigate('/login'); return }
      const d = await res.json()
      setData(d); setDisplayName(d.displayName)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    fetchData()
    fetch(API + '/show/dashboard/qr', { headers }).then(r => r.json()).then(d => setQr(d))
  }, [])

  useEffect(() => {
    if (!data?.slug) return
    const wsBase = (API || window.location.origin).replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + data.slug)
    wsRef.current.onmessage = () => fetchData()
    return () => wsRef.current?.close()
  }, [data?.slug])

  const logout = () => { localStorage.clear(); navigate('/login') }

  const markPlayed = async (id) => {
    await fetch(API + '/show/dashboard/queue/' + id, { method: 'PATCH', headers })
    fetchData()
  }

  const addSong = async (e) => {
    e.preventDefault()
    if (!newSong.title) return
    await fetch(API + '/show/dashboard/songs', { method: 'POST', headers, body: JSON.stringify(newSong) })
    setNewSong({ title: '', artist: '' }); fetchData()
  }

  const toggleSong = async (song) => {
    await fetch(API + '/show/dashboard/songs/' + song.id, { method: 'PATCH', headers, body: JSON.stringify({ active: !song.active }) })
    fetchData()
  }

  const deleteSong = async (id) => {
    if (!confirm('Delete this song?')) return
    await fetch(API + '/show/dashboard/songs/' + id, { method: 'DELETE', headers })
    fetchData()
  }

  const saveName = async () => {
    await fetch(API + '/show/dashboard/settings', { method: 'PATCH', headers, body: JSON.stringify({ displayName }) })
    setEditingName(false); fetchData()
  }

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--neon)' }}>🎵 SetWaves</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Dashboard — {data.displayName}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href={'/show/' + data.slug} target="_blank" style={{ fontSize: '13px', color: 'var(--neon)' }}>View Show</a>
          <button onClick={logout} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Logout</button>
        </div>
      </div>

      {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['queue', 'songs', 'qr', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? 'var(--neon)' : 'var(--border)',
            color: tab === t ? '#000' : 'var(--text)',
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            textTransform: 'capitalize', fontWeight: 600
          }}>
            {t}{t === 'queue' ? ' (' + data.queue.filter(i => !i.played).length + ')' : ''}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.queue.filter(i => !i.played).length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>No requests yet. Share your show link!</p>
          )}
          {data.queue.filter(i => !i.played).map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{item.songTitle}</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>from {item.requester} · {item.tokens} token{item.tokens !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => markPlayed(item.id)} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Done</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'songs' && (
        <div>
          <form onSubmit={addSong} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input placeholder="Song title" value={newSong.title} onChange={e => setNewSong(p => ({ ...p, title: e.target.value }))} style={{ flex: 2, minWidth: '150px' }} />
            <input placeholder="Artist (optional)" value={newSong.artist} onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))} style={{ flex: 2, minWidth: '150px' }} />
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Add Song</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.songs.map(song => (
              <div key={song.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: song.active ? 1 : 0.5 }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{song.title}</p>
                  {song.artist && <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{song.artist}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => toggleSong(song)} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>{song.active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => deleteSong(song.id)} style={{ background: '#7f1d1d', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'qr' && (
        <div className="card" style={{ textAlign: 'center' }}>
          {qr ? (
            <>
              <p style={{ marginBottom: '16px', color: 'var(--muted)' }}>Share this QR code at your show</p>
              <img src={qr.qr} alt="QR Code" style={{ maxWidth: '280px', borderRadius: '12px' }} />
              <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--muted)' }}>{qr.url}</p>
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Loading QR code...</p>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Display Name</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={() => setEditingName(true)} />
            {editingName && <button onClick={saveName} className="btn-primary">Save</button>}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '24px' }}>Show URL: /show/{data.slug}</p>
        </div>
      )}
    </div>
  )
}
