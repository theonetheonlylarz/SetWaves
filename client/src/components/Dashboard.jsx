import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

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
  const [pendingQueue, setPendingQueue] = useState([])
  const [songs, setSongs] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [tips, setTips] = useState([])
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('live')
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
  const [tipCostSetting, setTipCostSetting] = useState(5)
  const [savingPricing, setSavingPricing] = useState(false)
  const [pricingSaved, setPricingSaved] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)
  const [togglingQueue, setTogglingQueue] = useState(false)
  const [nowPlayingInput, setNowPlayingInput] = useState('')
  const [nowPlayingText, setNowPlayingText] = useState('')
  const [savingNowPlaying, setSavingNowPlaying] = useState(false)
  const [genreVoteEnabled, setGenreVoteEnabled] = useState(false)
  const [genreVoteOptions, setGenreVoteOptions] = useState([])
  const [voteResults, setVoteResults] = useState([])
  const [resetingVotes, setResetingVotes] = useState(false)
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [stripeOnboarded, setStripeOnboarded] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState('')
  const [pendingEarningsCents, setPendingEarningsCents] = useState(0)
  const [stripeStatusMsg, setStripeStatusMsg] = useState('')
  const [payouts, setPayouts] = useState([])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const wsRef = useRef(null)
  const token = localStorage.getItem('token')
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  const fetchAll = async () => {
    try {
      const [profileRes, queueRes, songsRes, pendingRes] = await Promise.all([
        fetch('/api/profile', { headers }),
        fetch('/api/queue', { headers }),
        fetch('/api/songs', { headers }),
        fetch('/api/queue/pending', { headers }),
      ])
      if (profileRes.status === 401) { localStorage.clear(); navigate('/login'); return }
      const profileData = await profileRes.json()
      const queueData = await queueRes.json()
      const songsData = await songsRes.json()
      const pendingData = await pendingRes.json()
      setProfile(profileData)
      setDisplayName(profileData.displayName)
      setCoinCost(profileData.queueCoinCost ?? 1)
      setJumpCost(profileData.queueJumpCost ?? 5)
      setMaxJumps(profileData.maxJumpsPerSession ?? 2)
      setPlayNextCost(profileData.playNextCost ?? 15)
      setMaxPlayNext(profileData.maxPlayNextPerSession ?? 1)
      setShoutoutCost(profileData.shoutoutCost ?? 10)
      setTipCostSetting(profileData.tipCost ?? 5)
      setStripeEnabled(profileData.stripeEnabled ?? false)
      setStripeOnboarded(profileData.stripeOnboarded ?? false)
      setPendingEarningsCents(profileData.pendingEarningsCents ?? 0)
      setGenreVoteEnabled(profileData.genreVoteEnabled ?? false)
      try { setGenreVoteOptions(JSON.parse(profileData.genreVoteOptions || '[]')) } catch { setGenreVoteOptions([]) }
      setQueueOpen(profileData.queueOpen ?? true)
      setNowPlayingText(profileData.nowPlaying || '')
      setNowPlayingInput(profileData.nowPlaying || '')
      setQueue(Array.isArray(queueData) ? queueData : [])
      setSongs(Array.isArray(songsData) ? songsData : [])
      setPendingQueue(Array.isArray(pendingData) ? pendingData : [])
    } catch (e) { setError(e.message) }
  }

  const fetchVotes = async (slug) => {
    if (!slug) return
    try {
      const res = await fetch('/api/votes/' + slug, { headers })
      if (res.ok) { const d = await res.json(); setVoteResults(d.votes || []) }
    } catch {}
  }

  const fetchTips = async () => {
    try {
      const res = await fetch('/api/tips', { headers })
      if (res.ok) setTips(await res.json())
    } catch {}
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

  const fetchPayouts = async () => {
    try {
      const res = await fetch('/api/payouts', { headers })
      if (res.ok) setPayouts(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchAll().then(() => {
      fetch('/api/profile', { headers }).then(r => r.json()).then(p => fetchVotes(p.slug)).catch(() => {})
    })
    fetch('/api/qrcode', { headers }).then(r => r.json()).then(d => setQr(d))
    fetchShoutouts()
    fetchStats()
    fetchTips()
    fetchPayouts()
  }, [])

  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (!stripeParam) return
    const next = new URLSearchParams(searchParams); next.delete('stripe'); setSearchParams(next, { replace: true })
    if (stripeParam === 'success') {
      fetch('/api/stripe/status', { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.onboarded) { setStripeOnboarded(true); setStripeStatusMsg('Payment account connected!') }
          else { setStripeStatusMsg('Setup started — finish in your email from Stripe to start receiving payouts.') }
        }).catch(() => {})
    }
    if (stripeParam === 'refresh') {
      fetch('/api/stripe/connect', { method: 'POST', headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.url) window.location.href = data.url })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    let ws, reconnectTimer, dead = false
    const connect = () => {
      if (dead) return
      const wsBase = window.location.origin.replace(/^http/, 'ws')
      ws = new WebSocket(wsBase + '/ws/' + profile.id)
      wsRef.current = ws
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'QUEUE_UPDATE') fetchAll()
          if (msg.type === 'SHOUTOUT_NEW') { fetchShoutouts(); fetchStats() }
          if (msg.type === 'SHOUTOUT_READ') fetchShoutouts()
          if (msg.type === 'TIP_NEW') { fetchTips(); fetchStats() }
          if (msg.type === 'SHOW_STATUS') setQueueOpen(msg.queueOpen)
          if (msg.type === 'NOW_PLAYING') { setNowPlayingText(msg.nowPlaying || ''); setNowPlayingInput(msg.nowPlaying || '') }
          if (msg.type === 'VOTE_UPDATE') fetchVotes(profile?.slug)
        } catch { fetchAll() }
      }
      ws.onclose = () => { if (!dead) reconnectTimer = setTimeout(connect, 3000) }
      ws.onerror = () => {}
    }
    connect()
    return () => { dead = true; clearTimeout(reconnectTimer); ws?.close() }
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
    const tipCostVal = parseInt(tipCostSetting, 10)
    if (!costVal || costVal < 1 || costVal > 100) return
    if (!jumpVal || jumpVal < 1 || jumpVal > 100) return
    if (!maxVal || maxVal < 1 || maxVal > 20) return
    if (!playNextVal || playNextVal < 1 || playNextVal > 200) return
    if (!maxPlayNextVal || maxPlayNextVal < 1 || maxPlayNextVal > 10) return
    if (!shoutoutVal || shoutoutVal < 1 || shoutoutVal > 100) return
    if (!tipCostVal || tipCostVal < 1 || tipCostVal > 100) return
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
        tipCost: tipCostVal,
      })
    })
    setSavingPricing(false)
    setPricingSaved(true)
    setTimeout(() => setPricingSaved(false), 2500)
    fetchAll()
  }

  const requestPayout = async () => {
    setRequestingPayout(true)
    try {
      const res = await fetch('/api/stripe/payout', { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) { setPayoutMsg(data.error || 'Payout failed'); setTimeout(() => setPayoutMsg(''), 4000); return }
      setPendingEarningsCents(0)
      fetchPayouts()
      setPayoutMsg('✓ Paid out!')
      setTimeout(() => setPayoutMsg(''), 4000)
    } catch { setPayoutMsg('Network error'); setTimeout(() => setPayoutMsg(''), 4000) }
    finally { setRequestingPayout(false) }
  }

  const connectStripe = async () => {
    setConnectingStripe(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST', headers })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else if (data.error === 'CONNECT_NOT_ENABLED') {
        setError('CONNECT_NOT_ENABLED')
      } else {
        setError(data.error || 'Could not start Stripe setup')
      }
    } catch { setError('Network error') }
    finally { setConnectingStripe(false) }
  }

  const saveGenreVoteSettings = async (enabled, options) => {
    await fetch('/api/show/genre-vote', { method: 'PUT', headers, body: JSON.stringify({ enabled, options }) })
  }

  const toggleGenreVoteEnabled = async () => {
    const next = !genreVoteEnabled
    setGenreVoteEnabled(next)
    await saveGenreVoteSettings(next, genreVoteOptions)
    if (next && profile?.slug) fetchVotes(profile.slug)
  }

  const toggleGenreOption = async (genre) => {
    const next = genreVoteOptions.includes(genre)
      ? genreVoteOptions.filter(g => g !== genre)
      : [...genreVoteOptions, genre]
    setGenreVoteOptions(next)
    await saveGenreVoteSettings(genreVoteEnabled, next)
  }

  const resetVotes = async () => {
    setResetingVotes(true)
    await fetch('/api/votes', { method: 'DELETE', headers })
    setVoteResults([])
    setResetingVotes(false)
  }

  const toggleQueue = async () => {
    const next = !queueOpen
    if (next && stripeEnabled && !stripeOnboarded) {
      setError('Connect your payout account first — fans need somewhere for their money to go.')
      return
    }
    setTogglingQueue(true)
    setQueueOpen(next)
    const res = await fetch('/api/show/status', { method: 'PUT', headers, body: JSON.stringify({ queueOpen: next }) })
    const data = await res.json()
    if (!res.ok) { setQueueOpen(!next); setError(data.error || 'Failed to update queue status') }
    setTogglingQueue(false)
  }

  const saveNowPlaying = async (val) => {
    const text = val !== undefined ? val : nowPlayingInput
    setSavingNowPlaying(true)
    await fetch('/api/now-playing', { method: 'PUT', headers, body: JSON.stringify({ nowPlaying: text }) })
    setNowPlayingText(text)
    setSavingNowPlaying(false)
  }

  const acceptQueueItem = async (id) => {
    await fetch('/api/queue/' + id + '/accept', { method: 'PUT', headers })
    fetchAll(); fetchStats()
  }

  const denyQueueItem = async (id) => {
    await fetch('/api/queue/' + id + '/deny', { method: 'PUT', headers })
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
  const activityFeed = [
    ...shoutouts.map(s => ({ ...s, _type: 'shoutout' })),
    ...tips.map(t => ({ ...t, _type: 'tip' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const TABS = [
    { id: 'live', label: '🎤 Live', badge: pendingQueue.length },
    { id: 'activity', label: '📣 Activity', badge: unreadShoutouts },
    { id: 'setlist', label: 'Setlist' },
    { id: 'setup', label: 'Setup' },
  ]

  const stripeBlocked = stripeEnabled && !stripeOnboarded && !queueOpen

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'rgba(15,15,26,0.85)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        height: '54px',
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
            <div className="logo-text" style={{ fontSize: '16px', lineHeight: '1.2' }}>SetWaves</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{profile.displayName}</div>
          </div>
        </div>
        <div className="dash-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {totalEarned !== null && (
            <div className="dash-earnings-badge" style={{ fontSize: '12px', color: 'var(--neon)', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '20px', padding: '4px 12px', fontWeight: 700 }}>
              {'$' + totalEarned + ' earned'}
            </div>
          )}
          <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer"
            style={{ fontSize: '13px', color: 'var(--neon)', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--neon-dim)', borderRadius: '7px', fontWeight: 600, border: '1px solid rgba(0,255,136,0.2)', textDecoration: 'none' }}>
            Fan Page
          </a>
          <button onClick={logout} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Sign out</button>
        </div>
      </header>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px' }}>

        {error && error !== 'CONNECT_NOT_ENABLED' && (
          <div className="error" style={{ marginBottom: '14px' }}>{error}</div>
        )}

        {error === 'CONNECT_NOT_ENABLED' && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '14px' }}>
            <p style={{ fontWeight: 800, fontSize: '14px', color: 'var(--amber)', marginBottom: '6px' }}>⚠️ Stripe Connect not activated</p>
            <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.5', marginBottom: '10px' }}>
              Your Stripe account needs Connect enabled before you can receive payouts. Go to your Stripe dashboard to set it up.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <a href="https://dashboard.stripe.com/connect" target="_blank" rel="noreferrer"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.5)', borderRadius: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '13px', padding: '7px 14px', textDecoration: 'none' }}>
                → Enable Stripe Connect
              </a>
              <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
            </div>
          </div>
        )}

        {stripeStatusMsg && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '14px' }}>✅ {stripeStatusMsg}</span>
            <button onClick={() => setStripeStatusMsg('')} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        )}

        {stripeEnabled && !stripeOnboarded && (
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.08) 100%)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-md)', padding: '16px 18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>💳 Connect your payout account</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Link a bank or debit card · <span style={{ color: '#a78bfa', fontWeight: 700 }}>you keep 90%</span></p>
              </div>
              <button onClick={connectStripe} disabled={connectingStripe}
                style={{ background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.5)', borderRadius: '10px', color: '#818cf8', fontWeight: 800, fontSize: '14px', padding: '10px 20px', cursor: connectingStripe ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {connectingStripe ? '⏳ Redirecting...' : '→ Set Up Payments'}
              </button>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '3px', marginBottom: '20px', background: 'var(--surface)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '9px 8px', borderRadius: '9px', background: tab === t.id ? 'var(--surface2)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontSize: '13px', fontWeight: 600, border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent', boxShadow: tab === t.id ? '0 1px 6px rgba(0,0,0,0.3)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.label}
              {t.badge > 0 && <span style={{ background: t.id === 'activity' ? '#ef4444' : 'var(--neon)', color: t.id === 'activity' ? '#fff' : '#000', fontSize: '11px', fontWeight: 800, borderRadius: '10px', padding: '1px 6px', marginLeft: '5px' }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* LIVE TAB */}
        {tab === 'live' && (
          <div className="fade-up">
            {/* Queue control row */}
            <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={toggleQueue} disabled={togglingQueue}
                  title={stripeBlocked ? 'Connect a payout account to open the queue' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', border: '1.5px solid', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: stripeBlocked ? 'rgba(245,158,11,0.08)' : queueOpen ? 'rgba(0,255,136,0.08)' : 'rgba(255,91,91,0.08)',
                    borderColor: stripeBlocked ? 'rgba(245,158,11,0.4)' : queueOpen ? 'rgba(0,255,136,0.35)' : 'rgba(255,91,91,0.35)',
                    color: stripeBlocked ? 'var(--amber)' : queueOpen ? 'var(--neon)' : 'var(--red)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stripeBlocked ? 'var(--amber)' : queueOpen ? 'var(--neon)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                  {stripeBlocked ? '⚠️ Setup Required' : queueOpen ? 'Queue Open' : 'Queue Closed'}
                </button>
                <div style={{ flex: 1, display: 'flex', gap: '6px', minWidth: '160px' }}>
                  <input
                    placeholder="Now playing..."
                    value={nowPlayingInput}
                    onChange={e => setNowPlayingInput(e.target.value.slice(0, 80))}
                    onKeyDown={e => e.key === 'Enter' && saveNowPlaying()}
                    style={{ flex: 1, padding: '9px 12px', fontSize: '13px' }}
                  />
                  <button onClick={() => saveNowPlaying()} disabled={savingNowPlaying} className="btn-secondary" style={{ padding: '9px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {savingNowPlaying ? '...' : 'Set'}
                  </button>
                  {nowPlayingText && (
                    <button onClick={() => { setNowPlayingInput(''); saveNowPlaying('') }} className="btn-secondary" style={{ padding: '9px 10px', fontSize: '12px' }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* Pending requests */}
            {pendingQueue.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <p style={{ fontWeight: 800, fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Requests</p>
                  <span style={{ background: 'var(--neon)', color: '#000', fontSize: '11px', fontWeight: 800, borderRadius: '10px', padding: '1px 7px' }}>{pendingQueue.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingQueue.map((item) => {
                    const tierInfo = TIER_META[item.tier] || TIER_META.STANDARD
                    return (
                      <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderLeft: '3px solid ' + tierInfo.color }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '20px', flexShrink: 0 }}>{tierInfo.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{item.songTitle}</p>
                            <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                              {item.requester} · <span style={{ color: tierInfo.color, fontWeight: 600 }}>{item.tokens} coins</span>
                              {item.tier !== 'STANDARD' && <span style={{ marginLeft: '6px', color: tierInfo.color, fontSize: '11px', fontWeight: 700, background: tierInfo.bg, padding: '1px 6px', borderRadius: '5px' }}>{tierInfo.label}</span>}
                            </p>
                            {item.dedication && (
                              <p style={{ color: '#a78bfa', fontSize: '12px', marginTop: '3px', fontStyle: 'italic' }}>"{item.dedication}"</p>
                            )}
                          </div>
                        </div>
                        <div className="queue-item-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                          <button onClick={() => acceptQueueItem(item.id)}
                            style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--neon)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                            ✓ Accept
                          </button>
                          <button onClick={() => denyQueueItem(item.id)}
                            style={{ background: 'rgba(255,91,91,0.08)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Accepted queue */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <p style={{ fontWeight: 800, fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Up Next</p>
                {activeQueue.length > 0 && <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, borderRadius: '10px', padding: '1px 7px' }}>{activeQueue.length}</span>}
              </div>
              {activeQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontSize: '44px', marginBottom: '12px' }}>🎤</div>
                  <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
                    {pendingQueue.length > 0 ? 'Accept requests above to add them here' : 'No songs in queue yet'}
                  </p>
                  {pendingQueue.length === 0 && (
                    <a href={'/show/' + profile.slug} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '8px', color: 'var(--neon)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                      Open Fan Page →
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeQueue.map((item, i) => {
                    const tierInfo = TIER_META[item.tier] || TIER_META.STANDARD
                    return (
                      <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderLeft: '3px solid ' + tierInfo.color }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 800, minWidth: '22px', textAlign: 'center' }}>#{i + 1}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '14px' }}>{item.songTitle}</p>
                            <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '1px' }}>
                              {item.requester}
                              {item.tier !== 'STANDARD' && <span style={{ marginLeft: '6px', color: tierInfo.color, fontSize: '11px', fontWeight: 700 }}>{tierInfo.icon} {tierInfo.label}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="queue-item-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                          <button onClick={() => markPlayed(item.id)} className="btn-secondary" style={{ fontSize: '12px', padding: '7px 14px' }}>Played</button>
                          <button onClick={() => removeFromQueue(item.id)}
                            style={{ background: 'rgba(255,91,91,0.08)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '7px 10px', fontSize: '13px', cursor: 'pointer' }}>
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB — shoutouts + tips combined */}
        {tab === 'activity' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activityFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '14px' }}>📣</div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>No activity yet</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Shoutouts and tips from fans will appear here</p>
              </div>
            ) : activityFeed.map(item => (
              item._type === 'shoutout' ? (
                <div key={'s-' + item.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid ' + (item.read ? 'var(--border)' : '#ef4444'), background: item.read ? 'var(--surface)' : 'rgba(239,68,68,0.04)', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px' }}>📣</span>
                        {!item.read && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 800, background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: '6px' }}>NEW</span>}
                        <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                          {item.fromName} · {item.coins} coins · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontWeight: 600, fontSize: '14px', fontStyle: 'italic' }}>"{item.message}"</p>
                    </div>
                    {!item.read && (
                      <button onClick={() => markShoutoutRead(item.id)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', flexShrink: 0 }}>Read</button>
                    )}
                  </div>
                </div>
              ) : (
                <div key={'t-' + item.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #eab308' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: item.message ? '6px' : 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px' }}>💰</span>
                    <span style={{ color: '#eab308', fontWeight: 700, fontSize: '14px' }}>{item.coins} coin tip</span>
                    <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      from {item.fromName} · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {item.message && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>"{item.message}"</p>}
                </div>
              )
            ))}
          </div>
        )}

        {/* SETLIST TAB */}
        {tab === 'setlist' && (
          <div className="fade-up">
            <div className="card" style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Add songs fans can request. Toggle them on/off any time.</p>
              <form onSubmit={addSong} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="Song title" value={newSong.title} onChange={e => setNewSong(p => ({ ...p, title: e.target.value }))} style={{ flex: '2 1 150px' }} />
                <input placeholder="Artist (optional)" value={newSong.artist} onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))} style={{ flex: '2 1 110px' }} />
                <select value={newSong.genre} onChange={e => setNewSong(p => ({ ...p, genre: e.target.value }))} style={{ flex: '1 1 100px' }}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '11px 18px' }}>+ Add</button>
              </form>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.length === 0 && (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>No songs yet. Add your first one above.</p>
              )}
              {songs.map(song => (
                <div key={song.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', opacity: song.active ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>{song.title}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                      {song.artist && <span>{song.artist} · </span>}
                      <span style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px' }}>{song.genre || 'Other'}</span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleSong(song)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>{song.active ? 'Hide' : 'Show'}</button>
                    <button onClick={() => deleteSong(song.id)} style={{ background: 'rgba(255,91,91,0.1)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETUP TAB */}
        {tab === 'setup' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* QR + show link */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>Your Show Page</h3>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                {qr ? (
                  <>
                    <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', flexShrink: 0, boxShadow: '0 0 20px rgba(0,255,136,0.1)' }}>
                      <img src={qr.qrCode} alt="QR Code" style={{ width: '110px', height: '110px', display: 'block' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>Display this QR at your show — fans scan it to request songs. No app download needed.</p>
                      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', color: 'var(--muted)', fontFamily: 'monospace', marginBottom: '10px', overflowWrap: 'break-word', wordBreak: 'break-all' }}>
                        {qr.url}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <a href={qr.url} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '7px', color: 'var(--neon)', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>Open Fan Page</a>
                        <a href={qr.qrCode} download="setwaves-qr.png" style={{ padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>Download QR</a>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
                    <Spinner />
                    <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Generating QR code...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Display name */}
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Display Name</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>Shown to fans on your show page</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} onFocus={() => setEditingName(true)} placeholder="Your stage name" />
                {editingName && (
                  <button onClick={saveName} className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Coin Pricing</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>1 coin = $1 · <span style={{ color: 'var(--neon)', fontWeight: 700 }}>you keep 90%</span></p>
              <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🎵 Add to Queue</label>
                  <input type="number" min="1" max="100" value={coinCost} onChange={e => setCoinCost(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Move Up</label>
                  <input type="number" min="1" max="100" value={jumpCost} onChange={e => setJumpCost(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🚦 Max Move Ups</label>
                  <input type="number" min="1" max="20" value={maxJumps} onChange={e => setMaxJumps(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#ef4444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔥 Play Next</label>
                  <input type="number" min="1" max="200" value={playNextCost} onChange={e => setPlayNextCost(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#ef4444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔒 Max Play Next</label>
                  <input type="number" min="1" max="10" value={maxPlayNext} onChange={e => setMaxPlayNext(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📣 Shoutout</label>
                  <input type="number" min="1" max="100" value={shoutoutCost} onChange={e => setShoutoutCost(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#eab308', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Min Tip</label>
                  <input type="number" min="1" max="100" value={tipCostSetting} onChange={e => setTipCostSetting(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
              <button onClick={savePricing} className="btn-primary" disabled={savingPricing}>
                {savingPricing ? 'Saving...' : pricingSaved ? '✓ Saved' : 'Save Pricing'}
              </button>
            </div>

            {/* Payouts */}
            {stripeEnabled && (
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Payouts</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>
                  You keep <span style={{ color: 'var(--neon)', fontWeight: 700 }}>90%</span> of every coin spent. Payouts go to your connected bank or debit card.
                </p>

                {pendingEarningsCents > 0 && (
                  <div style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <p style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Ready to pay out</p>
                      <p style={{ color: 'var(--neon)', fontWeight: 900, fontSize: '24px' }}>${(pendingEarningsCents / 100).toFixed(2)}</p>
                    </div>
                    {stripeOnboarded ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        <button onClick={requestPayout} disabled={requestingPayout}
                          style={{ background: 'rgba(0,255,136,0.12)', border: '1.5px solid rgba(0,255,136,0.35)', borderRadius: '9px', color: 'var(--neon)', fontWeight: 800, fontSize: '14px', padding: '10px 20px', cursor: requestingPayout ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          {requestingPayout ? '⏳ Sending...' : '→ Pay Out Now'}
                        </button>
                        {payoutMsg && <p style={{ color: payoutMsg.startsWith('✓') ? '#00ff88' : '#ef4444', fontSize: '13px', fontWeight: 700 }}>{payoutMsg}</p>}
                      </div>
                    ) : (
                      <p style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>Connect a payout account below to withdraw</p>
                    )}
                  </div>
                )}

                {pendingEarningsCents === 0 && stripeOnboarded && (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '13px' }}>$0.00 pending — earnings appear here as fans spend coins.</p>
                  </div>
                )}

                {stripeOnboarded ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '8px', padding: '9px 14px', flex: 1 }}>
                      <span style={{ color: 'var(--neon)', fontSize: '16px' }}>✅</span>
                      <span style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '13px' }}>Payout account connected</span>
                    </div>
                    <button onClick={connectStripe} disabled={connectingStripe} className="btn-secondary" style={{ fontSize: '12px', padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      {connectingStripe ? '...' : 'Update'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '9px 14px', flex: 1 }}>
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '13px' }}>⚠️ No payout account — earnings accumulating but can't be transferred yet.</span>
                    </div>
                    <button onClick={connectStripe} disabled={connectingStripe}
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.4)', borderRadius: '9px', color: '#818cf8', fontWeight: 700, fontSize: '13px', padding: '9px 18px', cursor: connectingStripe ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {connectingStripe ? '⏳ Redirecting...' : '→ Connect Account'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Payout history */}
            {payouts.length > 0 && (
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>Payout History</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {payouts.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--neon)' }}>${(p.amountCents / 100).toFixed(2)}</p>
                        <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>{new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>{p.transferId.slice(0, 12)}…</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vibe vote */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: genreVoteEnabled ? '14px' : 0 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '3px' }}>🎭 Vibe Vote</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Let fans vote on which genre you play next</p>
                </div>
                <button onClick={toggleGenreVoteEnabled}
                  style={{ padding: '8px 16px', borderRadius: '9px', border: '1.5px solid', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    background: genreVoteEnabled ? 'rgba(139,92,246,0.1)' : 'var(--surface2)',
                    borderColor: genreVoteEnabled ? 'rgba(139,92,246,0.4)' : 'var(--border)',
                    color: genreVoteEnabled ? 'var(--purple)' : 'var(--muted)' }}>
                  {genreVoteEnabled ? 'On' : 'Off'}
                </button>
              </div>

              {genreVoteEnabled && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Pick genres fans can vote on</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: voteResults.length > 0 ? '14px' : 0 }}>
                    {GENRES.map(g => (
                      <button key={g} onClick={() => toggleGenreOption(g)}
                        className={'chip' + (genreVoteOptions.includes(g) ? ' active' : '')}
                        style={{ minHeight: '30px' }}>
                        {g}
                      </button>
                    ))}
                  </div>
                  {voteResults.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Live Results</p>
                        <button onClick={resetVotes} disabled={resetingVotes} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', fontSize: '11px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {resetingVotes ? '...' : 'Reset Votes'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {voteResults.map((v, i) => (
                          <div key={v.genre}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--neon)' : 'var(--text-secondary)' }}>{i === 0 ? '🥇 ' : ''}{v.genre}</span>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{v.count} vote{v.count !== 1 ? 's' : ''} · {v.pct}%</span>
                            </div>
                            <div className="vote-bar-track">
                              <div className={'vote-bar-fill' + (i === 0 ? ' leader' : '')} style={{ width: v.pct + '%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <style>{`
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.fade-up { animation: fadeUp 0.2s ease both; }
@media (max-width: 430px) {
  .dash-header-actions { flex-wrap: wrap; justify-content: flex-end; gap: 6px !important; }
  .dash-header-actions a { font-size: 12px !important; padding: 5px 10px !important; }
  .dash-header-actions .btn-secondary { font-size: 12px !important; padding: 5px 8px !important; }
  .dash-earnings-badge { display: none !important; }
  .pricing-grid { grid-template-columns: 1fr !important; }
  .queue-item-actions { flex-direction: column !important; align-items: stretch !important; gap: 4px !important; min-width: 72px; }
  .queue-item-actions button { width: 100% !important; }
}
`}</style>
    </div>
  )
}
