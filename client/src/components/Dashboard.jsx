import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [queue, setQueue] = useState([])
  const [songs, setSongs] = useState([])
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

  const fetchAll = async () => {
    try {
      const [profileRes, queueRes, songsRes] = await Promise.all([
        fetch('/api/profile', { headers }),
        fetch('/api/queue', { headers }),
        fetch('/api/songs', { headers })
      ])
      if (profileRes.status === 401) { localStorage.clear(); navigate('/login'); return }
      const profileData = await profileRes.json()
      const queueData = await queueRes.json()
      const songsData = await songsRes.json()
      setProfile(profileData)
      setDisplayName(profileData.displayName)
      setQueue(Array.isArray(queueData) ? queueData : [])
      setSongs(Array.isArray(songsData) ? songsData : [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    fetchAll()
    fetch('/api/qrcode', { headers }).then(r => r.json()).then(d => setQr(d))
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + profile.id)
    wsRef.current.onmessage = () => fetchAll()
    return () => wsRef.current?.close()
  }, [profile?.id])

  const logout = () => { localStorage.clear(); navigate('/login') }

  const markPlayed = async (id) => {
    await fetch('/api/queue/' + id + '/played', { method: 'PUT', headers })
    fetchAll()
  }

  const addSong = async (e) => {
    e.preventDefault()
    if (!newSong.title) return
    await fetch('/api/songs', { method: 'POST', headers, body: JSON.stringify(newSong) })
    setNewSong({ title: '', artist: '' })
    fetchAll()
  }

  const toggleSong = async (song) => {
    await fetch('/api/songs/' + song.id, { method: 'PATCH', headers, body: JSON.stringify({ active: !song.active }) })
    fetchAll()
  }

  const deleteSong = async (id) => {
    if (!confirm('Delete this song?')) return
    await fetch('/api/songs/' + id, { method: 'DELETE', headers })
    fetchAll()
  }

  const saveName = async () => {
    await fetch('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ displayName }) })
    setEditingName(false)
    fetchAll()
  }

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Loading...</p>
    </div>
  )

  const activeQueue = queue.filter(i => !i.played)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--neon)' }}>🎵 SetWaves</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Dashboard — {profile.displayName}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href={'/show/' + profile.slug} target="_blank" style={{ fontSize: '13px', color: 'var(--neon)' }}>View Show</a>
          <button onClick={logout} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Logout</button>
        </div>
      </div>
      {error && <p className="error" style={{ marginBottom: '16px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['queue', 'songs', 'qr', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--neon)' : 'var(--border)', color: tab === t ? '#000' : 'var(--text)', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 600 }}>
            {t}{t === 'queue' ? ' (' + activeQueue.length + ')' : ''}
          </button>
        ))}
      </div>
      {tab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeQueue.length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>No requests yet. Share your show link!</p>
          )}
          {activeQueue.map(item => (
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
            {songs.map(song => (
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
              <img src={qr.qrCode} alt="QR Code" style={{ maxWidth: '280px', borderRadius: '12px' }} />
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
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '24px' }}>Show URL: /show/{profile.slug}</p>
        </div>
      )}
    </div>
  )
}
