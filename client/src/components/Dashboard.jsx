import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'Jazz', 'Electronic', 'Latin', 'Indie', 'Other']

const TIER_META = {
  STANDARD:  { icon: '🎵', label: 'Standard',  color: 'var(--neon)',  bg: 'var(--neon-dim)' },
  PRIORITY:  { icon: '⚡', label: 'Move Up',    color: '#f59e0b',      bg: 'rgba(245,158,11,0.1)' },
  PLAY_NEXT: { icon: '🔥', label: 'Play Next',  color: '#ef4444',      bg: 'rgba(239,68,68,0.1)' },
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [queue, setQueue] = useState([])
  const [songs, setSongs] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('queue')
  const [newSong, setNewSong] = useState({ title: '', artist: '', genre: 'Other' })
  const [qr, setQr] = useState(null)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coinCost, setCoinCost] = useState(1)
  const [jumpCost, setJumpCost] = useState(5)
  const [maxJumps, setMaxJumps] = useState(2)
  const [playNextCost, setPlayNextCost] = useState(15)
  const [maxPlayNext, setMaxPlayNext] = useState(1)
  const [shoutoutCost, setShoutoutCost] = useState(10)
  const [savingPricing, setSavingPricing] = useState(false)
  const [pricingSaved, setPricingSaved] = useState(false)
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
      setCoinCost(profileData.queueCoinCost ?? 1)
      setJumpCost(profileData.queueJumpCost ?? 5)
      setMaxJumps(profileData.maxJumpsPerSession ?? 2)
      setPlayNextCost(profileData.playNextCost ?? 15)
      setMaxPlayNext(profileData.maxPlayNextPerSession ?? 1)
      setShoutoutCost(profileData.shoutoutCost ?? 10)
      setQueue(Array.isArray(queueData) ? queueData : [])
      setSongs(Array.isArray(songsData) ? songsData : [])
    } catch (e) { setError(e.message) }
  }

  const fetchShoutouts = async () => {
    try {
      const res = await fetch('/api/shoutouts', { headers })
      if (res.ok) setShoutouts(await res.json())
    } catch {}
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats', { headers })
      if (res.ok) setStats(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchAll()
    fetch('/api/qrcode', { headers }).then(r => r.json()).then(d => setQr(d))
    fetchShoutouts()
    fetchStats()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + profile.id)
    wsRef.current.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'QUEUE_UPDATE') fetchAll()
        if (msg.type === 'SHOUTOUT_NEW') { fetchShoutouts(); fetchStats() }
        if (msg.type === 'SHOUTOUT_READ') fetchShoutouts()
      } catch { fetchAll() }
    }
    return () => wsRef.current?.close()
  }, [profile?.id])

  const logout = () => { localStorage.clear(); navigate('/login') }

  const markPlayed = async (id) => {
    await fetch('/api/queue/' + id + '/played', { method: 'PUT', headers })
    fetchAll()
    fetchStats()
  }

  const removeFromQueue = async (id) => {
    await fetch('/api/queue/' + id, { method: 'DELETE', headers })
    fetchAll()
  }

  const addSong = async (e) => {
    e.preventDefault()
    if (!newSong.title.trim()) return
    await fetch('/api/songs', { method: 'POST', headers, body: JSON.stringify(newSong) })
    setNewSong({ title: '', artist: '', genre: 'Other' })
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
    setSaving(true)
    await fetch('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ displayName }) })
    setSaving(false)
    setEditingName(false)
    fetchAll()
  }

  const savePricing = async () => {
    const costVal = parseInt(coinCost, 10)
    const jumpVal = parseInt(jumpCost, 10)
    const maxVal = parseInt(maxJumps, 10)
    const playNextVal = parseInt(playNextCost, 10)
    const maxPlayNextVal = parseInt(maxPlayNext, 10)
    const shoutoutVal = parseInt(shoutoutCost, 10)
    if (!costVal || costVal < 1 || costVal > 100) return
    if (!jumpVal || jumpVal < 1 || jumpVal > 100) return
    if (!maxVal || maxVal < 1 || maxVal > 20) return
    if (!playNextVal || playNextVal < 1 || playNextVal > 200) return
    if (!maxPlayNextVal || maxPlayNextVal < 1 || maxPlayNextVal > 10) return
    if (!shoutoutVal || shoutoutVal < 1 || shoutoutVal > 100) return
    setSavingPricing(true)
    await fetch('/api/pricing', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        queueCoinCost: costVal,
        queueJumpCost: jumpVal,
        maxJumpsPerSession: maxVal,
        playNextCost: playNextVal,
        maxPlayNextPerSession: maxPlayNextVal,
        shoutoutCost: shoutoutVal,
      })
    })
    setSavingPricing(false)
    setPricingSaved(true)
    setTimeout(() => setPricingSaved(false), 2500)
    fetchAll()
  }

  const markShoutoutRead = async (id) => {
    await fetch('/api/shoutout/' + id + '/read', { method: 'PUT', headers })
    fetchShoutouts()
  }

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', background: 'var(--bg)' }}>
      <Spinner />
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  const activeQueue = queue.filter(i => !i.played)
  const unreadShoutouts = shoutouts.filter(s => !s.read).length
  const totalEarned = stats ? (stats.totalCoins * 0.9).toFixed(2) : null

  const TABS = [
    { id: 'queue', label: 'Queue', badge: activeQueue.length },
    { id: 'shoutouts', label: '📣 Shoutouts', badge: unreadShoutouts },
    { id: 'songs', label: 'Setlist' },
    { id: 'qr', label: 'QR Code' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'rgba(15,15,26,0.85)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-mark" style={{ width: '28px', height: '28px', fontSize: '13px', borderRadius: '6px' }}>🎵</div>
          <div>
            <div className="logo-text" style={{ fontSize: '16px', lineHeight: '1.2' }}>Next Up</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.01em' }}>{profile.displayName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {totalEarned !== null && (
            <div style={{ fontSize: '12px', color: 'var(--neon)', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '20px', padding: '4px 12px', fontWeight: 700 }}>
              {'$' + totalEarned + ' earned'}
            </div>
          )}
          <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer"
            style={{ fontSize: '13px', color: 'var(--neon)', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--neon-dim)', borderRadius: '7px', fontWeight: 600, border: '1px solid rgba(0,255,136,0.2)', textDecoration: 'none', transition: 'all 0.15s' }}>
            View Show
          </a>
          <button onClick={logout} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Sign out</button>
        </div>
      </header>

      <main style={{ maxWidth: '820px', margin: '0 auto', padding: '28px 20px' }}>
        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', background: 'var(--surface)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: '1 1 auto', minWidth: '70px', padding: '8px 10px', borderRadius: '9px', background: tab === t.id ? 'var(--surface2)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontSize: '13px', fontWeight: 600, border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent', boxShadow: tab === t.id ? '0 1px 6px rgba(0,0,0,0.3)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.label}
              {t.badge > 0 && <span style={{ background: t.id === 'shoutouts' ? '#ef4444' : 'var(--neon)', color: '#fff', fontSize: '11px', fontWeight: 800, borderRadius: '10px', padding: '1px 7px', marginLeft: '4px' }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === 'queue' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>🎤</div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>Queue is empty</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Share your show link so fans can request songs</p>
                <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: '20px', padding: '9px 18px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '8px', color: 'var(--neon)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                  Open Fan Page
                </a>
              </div>
            ) : activeQueue.map((item, i) => {
              const tierInfo = TIER_META[item.tier] || TIER_META.STANDARD
              return (
                <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', borderLeft: '3px solid ' + tierInfo.color, animation: 'fadeUp 0.2s ease ' + (i * 0.04) + 's both' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '38px', height: '38px', background: tierInfo.bg, border: '1px solid ' + tierInfo.color + '40', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                      {tierInfo.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, fontSize: '15px' }}>{item.songTitle}</p>
                        {item.tier !== 'STANDARD' && (
                          <span style={{ fontSize: '10px', color: tierInfo.color, fontWeight: 700, background: tierInfo.bg, padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>{tierInfo.label}</span>
                        )}
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                        from <span style={{ color: 'var(--text-secondary)' }}>{item.requester}</span>
                        <span style={{ marginLeft: '8px', color: tierInfo.color, fontSize: '11px', fontWeight: 600 }}>
                          {tierInfo.icon} {item.tokens}
                        </span>
                      </p>
                      {item.dedication && (
                        <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                          {'"' + item.dedication + '"'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                    <button onClick={() => markPlayed(item.id)} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      Played
                    </button>
                    <button onClick={() => removeFromQueue(item.id)} style={{ background: 'rgba(255,91,91,0.08)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      x
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'shoutouts' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {shoutouts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>📣</div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>No shoutouts yet</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Fans can send paid shoutouts from your show page</p>
              </div>
            ) : shoutouts.map(s => (
              <div key={s.id} className="card" style={{ padding: '16px 18px', borderLeft: '3px solid ' + (s.read ? 'var(--border)' : '#ef4444'), background: s.read ? 'var(--surface)' : 'rgba(239,68,68,0.04)', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                      {!s.read && <span style={{ color: '#ef4444', marginRight: '6px', fontSize: '10px', fontWeight: 800, background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: '6px' }}>NEW</span>}
                      "{s.message}"
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      from <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{s.fromName}</span>
                      <span style={{ marginLeft: '8px', color: '#ef4444', fontWeight: 600 }}>📣 {s.coins} coins</span>
                      <span style={{ marginLeft: '8px', color: 'var(--muted)' }}>{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                  {!s.read && (
                    <button onClick={() => markShoutoutRead(s.id)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', flexShrink: 0 }}>
                      Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'songs' && (
          <div className="fade-up">
            <div className="card" style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px', fontWeight: 500 }}>Add songs fans can request from your setlist</p>
              <form onSubmit={addSong} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="Song title" value={newSong.title} onChange={e => setNewSong(p => ({ ...p, title: e.target.value }))} style={{ flex: '2 1 160px' }} />
                <input placeholder="Artist (optional)" value={newSong.artist} onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))} style={{ flex: '2 1 120px' }} />
                <select value={newSong.genre} onChange={e => setNewSong(p => ({ ...p, genre: e.target.value }))} style={{ flex: '1 1 110px' }}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '11px 18px' }}>+ Add</button>
              </form>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>No songs yet. Add your first one above.</p>}
              {songs.map(song => (
                <div key={song.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', opacity: song.active ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>{song.title}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                      {song.artist && <span>{song.artist} · </span>}
                      <span style={{ background: 'var(--surface2)', padding: '1px 7px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }}>{song.genre || 'Other'}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleSong(song)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>{song.active ? 'Hide' : 'Show'}</button>
                    <button onClick={() => deleteSong(song.id)} style={{ background: 'rgba(255,91,91,0.1)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'qr' && (
          <div className="fade-up">
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              {qr ? (
                <>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, marginBottom: '28px' }}>Display at your show — fans scan to request songs</p>
                  <div style={{ display: 'inline-block', background: '#fff', padding: '16px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 0 40px rgba(0,255,136,0.1)' }}>
                    <img src={qr.qrCode} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', fontFamily: 'monospace', background: 'var(--surface2)', display: 'inline-block', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>{qr.url}</p>
                  <div style={{ marginTop: '4px' }}>
                    <a href={qr.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Open Fan Page</a>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <Spinner />
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Generating QR code...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Display Name</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>Shown to fans on your public show page</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={() => setEditingName(true)} placeholder="Your stage name" />
                {editingName && <button onClick={saveName} className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Song Request Pricing</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '18px' }}>Set coin costs for each tier (1 coin = $1 · you keep 90%)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🎵 Add to Queue (coins)</label>
                    <input type="number" min="1" max="100" value={coinCost} onChange={e => setCoinCost(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Move Up cost (coins)</label>
                    <input type="number" min="1" max="100" value={jumpCost} onChange={e => setJumpCost(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🚦 Max Move Ups/session</label>
                    <input type="number" min="1" max="20" value={maxJumps} onChange={e => setMaxJumps(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#ef4444', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔥 Play Next cost (coins)</label>
                    <input type="number" min="1" max="200" value={playNextCost} onChange={e => setPlayNextCost(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#ef4444', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔒 Max Play Next/session</label>
                    <input type="number" min="1" max="10" value={maxPlayNext} onChange={e => setMaxPlayNext(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📣 Shoutout cost (coins)</label>
                    <input type="number" min="1" max="100" value={shoutoutCost} onChange={e => setShoutoutCost(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>

                <div>
                  <button onClick={savePricing} className="btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={savingPricing}>
                    {savingPricing ? 'Saving...' : pricingSaved ? 'Saved' : 'Save Pricing'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Your Show Link</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>Share with fans or display alongside your QR code</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {window?.location?.origin + '/show/' + profile.slug}
                </div>
                <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer" style={{ flexShrink: 0, padding: '10px 14px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: 'var(--neon)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Open</a>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }'}</style>
    </div>
  )
                                                                                }
