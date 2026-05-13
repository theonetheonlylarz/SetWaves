import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

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
  const [saving, setSaving] = useState(false)
  const [coinCost, setCoinCost] = useState(1)
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
      setQueue(Array.isArray(queueData) ? queueData : [])
      setSongs(Array.isArray(songsData) ? songsData : [])
    } catch (e) { setError(e.message) }
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
    if (!newSong.title.trim()) return
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
    setSaving(true)
    await fetch('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ displayName }) })
    setSaving(false)
    setEditingName(false)
    fetchAll()
  }

  const savePricing = async () => {
    const val = parseInt(coinCost, 10)
    if (!val || val < 1 || val > 100) return
    setSavingPricing(true)
    await fetch('/api/pricing', { method: 'PUT', headers, body: JSON.stringify({ queueCoinCost: val }) })
    setSavingPricing(false)
    setPricingSaved(true)
    setTimeout(() => setPricingSaved(false), 2500)
    fetchAll()
  }

  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', background: 'var(--bg)' }}>
      <Spinner />
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  const activeQueue = queue.filter(i => !i.played)

  const TABS = [
    { id: 'queue', label: 'Queue', badge: activeQueue.length },
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
          <a
            href={'/show/' + profile.slug}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '13px',
              color: 'var(--neon)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              background: 'var(--neon-dim)',
              borderRadius: '7px',
              fontWeight: 600,
              border: '1px solid rgba(0,255,136,0.2)',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            View Show ↗
          </a>
          <button onClick={logout} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '820px', margin: '0 auto', padding: '28px 20px' }}>
        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '24px',
          background: 'var(--surface)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '9px',
                background: tab === t.id ? 'var(--surface2)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: tab === t.id ? '0 1px 6px rgba(0,0,0,0.3)' : 'none',
                transition: 'all 0.15s',
                gap: '6px',
              }}
            >
              {t.label}
              {t.badge > 0 && (
                <span style={{ background: 'var(--neon)', color: '#000', fontSize: '11px', fontWeight: 800, borderRadius: '10px', padding: '1px 7px', marginLeft: '2px' }}>
                  {t.badge}
                </span>
              )}
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
                  Open Fan Page ↗
                </a>
              </div>
            ) : activeQueue.map((item, i) => (
              <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderLeft: '3px solid var(--neon)', animation: 'fadeUp 0.2s ease ' + (i * 0.04) + 's both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🎵</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '15px' }}>{item.songTitle}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                      from <span style={{ color: 'var(--text-secondary)' }}>{item.requester}</span>
                      <span style={{ marginLeft: '8px', color: 'var(--border-active)', fontSize: '11px', fontWeight: 600 }}>🪙 {item.tokens}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => markPlayed(item.id)} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 14px', flexShrink: 0 }}>
                  ✓ Played
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'songs' && (
          <div className="fade-up">
            <div className="card" style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px', fontWeight: 500 }}>
                Add songs fans can request from your setlist
              </p>
              <form onSubmit={addSong} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  placeholder="Song title"
                  value={newSong.title}
                  onChange={e => setNewSong(p => ({ ...p, title: e.target.value }))}
                  style={{ flex: '2 1 160px' }}
                />
                <input
                  placeholder="Artist (optional)"
                  value={newSong.artist}
                  onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))}
                  style={{ flex: '2 1 140px' }}
                />
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '11px 18px' }}>
                  + Add
                </button>
              </form>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.length === 0 && (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>No songs yet. Add your first one above.</p>
              )}
              {songs.map(song => (
                <div key={song.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', opacity: song.active ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>{song.title}</p>
                    {song.artist && <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>{song.artist}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleSong(song)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                      {song.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deleteSong(song.id)} style={{ background: 'rgba(255,91,91,0.1)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                      Delete
                    </button>
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
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, marginBottom: '28px' }}>
                    Display at your show — fans scan to request songs
                  </p>
                  <div style={{ display: 'inline-block', background: '#fff', padding: '16px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 0 40px rgba(0,255,136,0.1)' }}>
                    <img src={qr.qrCode} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', fontFamily: 'monospace', background: 'var(--surface2)', display: 'inline-block', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    {qr.url}
                  </p>
                  <div style={{ marginTop: '4px' }}>
                    <a href={qr.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                      Open Fan Page ↗
                    </a>
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
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onFocus={() => setEditingName(true)}
                  placeholder="Your stage name"
                />
                {editingName && (
                  <button onClick={saveName} className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Song Request Price</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                How many coins fans must spend to request a song (1 coin = $1)
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '16px', opacity: 0.75 }}>
                {'At $1 per coin, each request costs fans $' + coinCost + ' · Platform keeps 10%, you receive 90%'}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={coinCost}
                  onChange={e => setCoinCost(e.target.value)}
                  style={{ width: '100px' }}
                />
                <button
                  onClick={savePricing}
                  className="btn-primary"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  disabled={savingPricing}
                >
                  {savingPricing ? 'Saving...' : pricingSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Your Show Link</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>Share with fans or display alongside your QR code</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {window?.location?.origin + '/show/' + profile.slug}
                </div>
                <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer" style={{ flexShrink: 0, padding: '10px 14px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: 'var(--neon)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Open ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
