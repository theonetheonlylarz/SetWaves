import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImportSongsModal from './ImportSongsModal'
import { playRequestChime, isNotifMuted, setNotifMuted } from '../utils/notificationSound'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'Jazz', 'Electronic', 'Latin', 'Indie', 'Other']

const TIER_META = {
  STANDARD:  { icon: '🎵', label: 'Standard',  color: 'var(--neon)',  bg: 'var(--neon-dim)' },
  PRIORITY:  { icon: '⚡', label: 'Move Up',    color: '#f59e0b',      bg: 'rgba(245,158,11,0.1)' },
  PLAY_NEXT: { icon: '🔥', label: 'Play Next',  color: '#ef4444',      bg: 'rgba(239,68,68,0.1)' },
}

function SortableSongRow({ song, idx, total, onToggle, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (song.active ? 1 : 0.4),
    zIndex: isDragging ? 10 : 'auto',
    boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,136,0.35)' : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="card"
      data-dragging={isDragging || undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px', gap: '8px', transition: 'opacity 0.2s' }}>
        <button {...attributes} {...listeners}
          aria-label="Drag to reorder"
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'grab', padding: '4px 6px', minHeight: 0, fontSize: '18px', lineHeight: 1, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
          ⋮⋮
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          <button onClick={() => onMove(song.id, 'up')} disabled={idx === 0} title="Move up"
            style={{ background: 'var(--surface2)', color: idx === 0 ? 'var(--muted)' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '5px', width: '24px', height: '18px', minHeight: 0, padding: 0, fontSize: '10px', fontWeight: 700, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1, lineHeight: 1 }}>↑</button>
          <button onClick={() => onMove(song.id, 'down')} disabled={idx === total - 1} title="Move down"
            style={{ background: 'var(--surface2)', color: idx === total - 1 ? 'var(--muted)' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '5px', width: '24px', height: '18px', minHeight: 0, padding: 0, fontSize: '10px', fontWeight: 700, cursor: idx === total - 1 ? 'not-allowed' : 'pointer', opacity: idx === total - 1 ? 0.4 : 1, lineHeight: 1 }}>↓</button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
          <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
            {song.artist && <span>{song.artist} · </span>}
            <span style={{ background: 'var(--surface2)', padding: '1px 7px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }}>{song.genre || 'Other'}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => onToggle(song)} className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }}>{song.active ? 'Hide' : 'Show'}</button>
          <button onClick={() => onDelete(song.id)} style={{ background: 'rgba(255,91,91,0.1)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function ShareRow({ url, displayName }) {
  const [copied, setCopied] = useState(false)
  const shareText = 'Request a song at my show on Next Up 🎵'
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: (displayName ? displayName + ' on Next Up' : 'Next Up'), text: shareText, url })
    } catch {}
  }
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  const smsUrl = 'sms:?&body=' + encodeURIComponent(shareText + ' ' + url)
  const mailUrl = 'mailto:?subject=' + encodeURIComponent(shareText) + '&body=' + encodeURIComponent(shareText + '\n\n' + url)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
      {canShare && (
        <button onClick={handleNativeShare} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
          📤 Share link
        </button>
      )}
      <button onClick={handleCopy} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '13px' }}>
        {copied ? '✓ Copied!' : '📋 Copy link'}
      </button>
      <a href={smsUrl} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
        💬 Text
      </a>
      <a href={mailUrl} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
        ✉️ Email
      </a>
      <a href={url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
        🔗 Open
      </a>
    </div>
  )
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [queue, setQueue] = useState([])
  const [pendingQueue, setPendingQueue] = useState([])
  const [songs, setSongs] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [tips, setTips] = useState([])
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('inbox')
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
  const [importOpen, setImportOpen] = useState(false)
  const [notifMuted, setNotifMutedState] = useState(() => isNotifMuted())
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const wsRef = useRef(null)
  const prevPendingCount = useRef(null)
  const token = localStorage.getItem('token')
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
      const pending = Array.isArray(pendingData) ? pendingData : []
      const newCount = pending.length
      if (prevPendingCount.current !== null && newCount > prevPendingCount.current) {
        playRequestChime()
      }
      prevPendingCount.current = newCount
      setPendingQueue(pending)
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

  useEffect(() => {
    fetchAll().then(() => {
      fetch('/api/profile', { headers }).then(r => r.json()).then(p => fetchVotes(p.slug)).catch(() => {})
    })
    fetch('/api/qrcode', { headers }).then(r => r.json()).then(d => setQr(d))
    fetchShoutouts()
    fetchStats()
    fetchTips()
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
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + profile.id)
    wsRef.current.onmessage = (evt) => {
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

  const persistSongOrder = async (orderedSongs) => {
    await fetch('/api/songs/reorder', { method: 'PUT', headers, body: JSON.stringify({ ids: orderedSongs.map(s => s.id) }) })
    fetchAll()
  }

  const moveSong = async (id, direction) => {
    const idx = songs.findIndex(s => s.id === id)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= songs.length) return
    const next = [...songs]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setSongs(next) // optimistic
    persistSongOrder(next)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex(s => s.id === active.id)
    const newIndex = songs.findIndex(s => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(songs, oldIndex, newIndex)
    setSongs(next) // optimistic
    persistSongOrder(next)
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

  const TABS = [
    { id: 'inbox', label: 'Inbox', badge: pendingQueue.length },
    { id: 'queue', label: 'Queue', badge: activeQueue.length },
    { id: 'shoutouts', label: '📣 Shoutouts', badge: unreadShoutouts },
    { id: 'tips', label: '💰 Tips', badge: 0 },
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
        <div className="dash-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {totalEarned !== null && (
            <div className="dash-earnings-badge" style={{ fontSize: '12px', color: 'var(--neon)', background: 'var(--neon-dim)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '20px', padding: '4px 12px', fontWeight: 700 }}>
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
        {error && error !== 'CONNECT_NOT_ENABLED' && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}
        {error === 'CONNECT_NOT_ENABLED' && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '16px' }}>
            <p style={{ fontWeight: 800, fontSize: '15px', color: 'var(--amber)', marginBottom: '6px' }}>⚠️ Stripe Connect not activated</p>
            <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '10px' }}>
              Your Stripe account needs Connect enabled before performers can receive payouts. This is a one-time platform setup — it takes about 2 minutes.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <a href="https://dashboard.stripe.com/connect" target="_blank" rel="noreferrer"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.5)', borderRadius: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '13px', padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}>
                → Enable Stripe Connect
              </a>
              <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
            </div>
          </div>
        )}

        {stripeStatusMsg && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '14px' }}>✅ {stripeStatusMsg}</span>
            <button onClick={() => setStripeStatusMsg('')} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        )}

        {stripeEnabled && !stripeOnboarded && (
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.08) 100%)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-md)', padding: '20px 22px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)', marginBottom: '6px' }}>💳 Connect your payout account</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.5' }}>
                  Link a bank account or debit card to receive payouts from fan coin purchases.<br />
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>You keep 90% of every transaction.</span> Powered by Stripe — takes ~2 minutes.
                </p>
              </div>
              <button onClick={connectStripe} disabled={connectingStripe}
                style={{ background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.5)', borderRadius: '10px', color: '#818cf8', fontWeight: 800, fontSize: '14px', padding: '11px 22px', cursor: connectingStripe ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
                {connectingStripe ? '⏳ Redirecting...' : '→ Set Up Payments'}
              </button>
            </div>
          </div>
        )}


        <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: genreVoteEnabled ? '14px' : 0 }}>
            {(() => {
              const stripeBlocked = stripeEnabled && !stripeOnboarded && !queueOpen
              return (
                <button onClick={toggleQueue} disabled={togglingQueue}
                  title={stripeBlocked ? 'Connect a payout account to open the queue' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '10px', border: '1.5px solid', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minHeight: '38px',
                    background: stripeBlocked ? 'rgba(245,158,11,0.08)' : queueOpen ? 'rgba(0,255,136,0.08)' : 'rgba(255,91,91,0.08)',
                    borderColor: stripeBlocked ? 'rgba(245,158,11,0.4)' : queueOpen ? 'rgba(0,255,136,0.35)' : 'rgba(255,91,91,0.35)',
                    color: stripeBlocked ? 'var(--amber)' : queueOpen ? 'var(--neon)' : 'var(--red)' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: stripeBlocked ? 'var(--amber)' : queueOpen ? 'var(--neon)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                  {stripeBlocked ? '⚠️ Setup Required' : queueOpen ? 'Queue Open' : 'Queue Closed'}
                </button>
              )
            })()}
            <button onClick={toggleGenreVoteEnabled}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '10px', border: '1.5px solid', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minHeight: '38px',
                background: genreVoteEnabled ? 'rgba(139,92,246,0.1)' : 'var(--surface2)',
                borderColor: genreVoteEnabled ? 'rgba(139,92,246,0.4)' : 'var(--border)',
                color: genreVoteEnabled ? 'var(--purple)' : 'var(--muted)' }}>
              🎭 {genreVoteEnabled ? 'Vibe Vote On' : 'Vibe Vote Off'}
            </button>
            <div style={{ flex: 1, display: 'flex', gap: '6px', minWidth: '180px' }}>
              <input placeholder="Now playing..." value={nowPlayingInput} onChange={e => setNowPlayingInput(e.target.value.slice(0, 80))} onKeyDown={e => e.key === 'Enter' && saveNowPlaying()} style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }} />
              <button onClick={() => saveNowPlaying()} disabled={savingNowPlaying} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap', minHeight: '38px' }}>
                {savingNowPlaying ? '...' : 'Set'}
              </button>
              {nowPlayingText && <button onClick={() => { setNowPlayingInput(''); saveNowPlaying('') }} className="btn-secondary" style={{ padding: '8px 10px', fontSize: '12px', minHeight: '38px' }}>✕</button>}
            </div>
          </div>

          {genreVoteEnabled && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>🎭 Pick genres fans can vote on</p>
                {voteResults.length > 0 && (
                  <button onClick={resetVotes} disabled={resetingVotes} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', fontSize: '11px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '28px' }}>
                    {resetingVotes ? '...' : 'Reset Votes'}
                  </button>
                )}
              </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Live results</p>
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
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', background: 'var(--surface)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: '1 1 auto', minWidth: '70px', padding: '8px 10px', borderRadius: '9px', background: tab === t.id ? 'var(--surface2)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontSize: '13px', fontWeight: 600, border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent', boxShadow: tab === t.id ? '0 1px 6px rgba(0,0,0,0.3)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.label}
              {t.badge > 0 && <span style={{ background: t.id === 'shoutouts' ? '#ef4444' : 'var(--neon)', color: '#fff', fontSize: '11px', fontWeight: 800, borderRadius: '10px', padding: '1px 7px', marginLeft: '4px' }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {(() => {
          const steps = [
            { done: songs.length > 0, label: 'Add songs to your setlist', action: 'Import songs', go: () => { setTab('songs'); setImportOpen(true) } },
            { done: !stripeEnabled || stripeOnboarded, label: 'Connect Stripe for payouts', action: 'Connect', go: () => setTab('settings') },
            { done: queueOpen, label: 'Open your queue for fans', action: 'Open queue', go: () => toggleQueue() },
          ]
          const remaining = steps.filter(s => !s.done)
          if (remaining.length === 0) return null
          return (
            <div className="card fade-up" style={{ marginBottom: '20px', borderColor: 'rgba(0,255,136,0.2)', background: 'linear-gradient(135deg, rgba(0,255,136,0.05) 0%, rgba(0,255,136,0.01) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>🚀 Finish setup ({steps.length - remaining.length}/{steps.length})</h3>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>{remaining.length} step{remaining.length === 1 ? '' : 's'} left</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 12px', background: step.done ? 'rgba(0,255,136,0.04)' : 'var(--surface2)', border: '1px solid ' + (step.done ? 'rgba(0,255,136,0.18)' : 'var(--border)'), borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: step.done ? 'var(--neon)' : 'transparent', border: '1.5px solid ' + (step.done ? 'var(--neon)' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', color: '#000', fontWeight: 900 }}>
                        {step.done ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: '13px', color: step.done ? 'var(--muted)' : 'var(--text)', textDecoration: step.done ? 'line-through' : 'none', fontWeight: 600 }}>{step.label}</span>
                    </div>
                    {!step.done && (
                      <button onClick={step.go} style={{ background: 'var(--neon-dim)', color: 'var(--neon)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {step.action} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {tab === 'inbox' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>📬</div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>No pending requests</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>New song requests will appear here for you to approve</p>
              </div>
            ) : pendingQueue.map((item, i) => {
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
                        <span style={{ fontSize: '10px', color: tierInfo.color, fontWeight: 700, background: tierInfo.bg, padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>{tierInfo.label}</span>
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                        from <span style={{ color: 'var(--text-secondary)' }}>{item.requester}</span>
                        <span style={{ marginLeft: '8px', color: tierInfo.color, fontSize: '11px', fontWeight: 600 }}>{tierInfo.icon} {item.tokens} coins</span>
                      </p>
                      {item.dedication && (
                        <p style={{ color: '#a78bfa', fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                          Dedicated to: "{item.dedication}"
                        </p>
                      )}
                      <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '3px' }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="queue-item-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                    <button onClick={() => acceptQueueItem(item.id)} style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--neon)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '7px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      Accept
                    </button>
                    <button onClick={() => denyQueueItem(item.id)} style={{ background: 'rgba(255,91,91,0.08)', color: 'var(--red)', border: '1px solid rgba(255,91,91,0.15)', borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Deny
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'tips' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>💰</div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>No tips yet</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Fans can send you tips from your show page</p>
              </div>
            ) : tips.map(tip => (
              <div key={tip.id} className="card" style={{ padding: '16px 18px', borderLeft: '3px solid #eab308' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', color: '#eab308' }}>
                      💰 {tip.coins} coins
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      from <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{tip.fromName}</span>
                      <span style={{ marginLeft: '8px', color: 'var(--muted)' }}>{new Date(tip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    {tip.message && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', fontStyle: 'italic' }}>"{tip.message}"</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  <div className="queue-item-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, margin: 0 }}>Add songs fans can request from your setlist</p>
                <button onClick={() => setImportOpen(true)} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
                  📥 Import songs
                </button>
              </div>
              <form onSubmit={addSong} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input placeholder="Song title" value={newSong.title} onChange={e => setNewSong(p => ({ ...p, title: e.target.value }))} style={{ flex: '2 1 160px' }} />
                <input placeholder="Artist (optional)" value={newSong.artist} onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))} style={{ flex: '2 1 120px' }} />
                <select value={newSong.genre} onChange={e => setNewSong(p => ({ ...p, genre: e.target.value }))} style={{ flex: '1 1 110px' }}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '11px 18px' }}>+ Add</button>
              </form>
            </div>
            {songs.length > 1 && (
              <p style={{ color: 'var(--muted)', fontSize: '11px', textAlign: 'center', marginBottom: '6px', letterSpacing: '0.02em' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>⋮⋮</span> Drag any song to reorder · long-press on mobile
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>No songs yet. Add your first one above.</p>}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {songs.map((song, idx) => (
                    <SortableSongRow
                      key={song.id}
                      song={song}
                      idx={idx}
                      total={songs.length}
                      onToggle={toggleSong}
                      onDelete={deleteSong}
                      onMove={moveSong}
                    />
                  ))}
                </SortableContext>
              </DndContext>
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
                  <p className="qr-url-display" style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', fontFamily: 'monospace', background: 'var(--surface2)', display: 'block', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', overflowWrap: 'break-word', wordBreak: 'break-all' }}>{qr.url}</p>
                  <ShareRow url={qr.url} displayName={profile.displayName} />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{notifMuted ? '🔕' : '🔔'} Request Sounds</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{notifMuted ? 'Silent. Turn on so you don\'t miss requests while playing.' : 'Plays a short chime when a new song request arrives.'}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => playRequestChime()} className="btn-secondary" style={{ fontSize: '12px', padding: '7px 12px', whiteSpace: 'nowrap' }}>
                    Test
                  </button>
                  <button onClick={() => { const next = !notifMuted; setNotifMuted(next); setNotifMutedState(next) }}
                    className="btn-secondary" style={{ fontSize: '12px', padding: '7px 14px', whiteSpace: 'nowrap',
                    background: notifMuted ? 'var(--surface2)' : 'rgba(0,255,136,0.1)',
                    color: notifMuted ? 'var(--muted)' : 'var(--neon)',
                    borderColor: notifMuted ? 'var(--border)' : 'rgba(0,255,136,0.3)' }}>
                    {notifMuted ? 'Unmute' : 'Mute'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Song Request Pricing</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '18px' }}>Set coin costs for each tier · 1 coin = $1 · <span style={{ color: 'var(--neon)', fontWeight: 700 }}>you keep 90%</span>, platform takes 10%</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#eab308', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Min Tip (coins)</label>
                    <input type="number" min="1" max="100" value={tipCostSetting} onChange={e => setTipCostSetting(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>

                <div>
                  <button onClick={savePricing} className="btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={savingPricing}>
                    {savingPricing ? 'Saving...' : pricingSaved ? 'Saved' : 'Save Pricing'}
                  </button>
                </div>
              </div>
            </div>

            {stripeEnabled && (
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Payouts</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
                  You keep <span style={{ color: 'var(--neon)', fontWeight: 700 }}>90%</span> of every coin spent at your show. The platform takes 10%. Payouts go to your connected bank or debit card.
                </p>

                {pendingEarningsCents > 0 && (
                  <div style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <p style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Available to pay out</p>
                      <p style={{ color: 'var(--neon)', fontWeight: 900, fontSize: '24px' }}>${(pendingEarningsCents / 100).toFixed(2)}</p>
                    </div>
                    {stripeOnboarded ? (
                      <>
                        <button onClick={requestPayout} disabled={requestingPayout}
                          style={{ background: 'rgba(0,255,136,0.12)', border: '1.5px solid rgba(0,255,136,0.35)', borderRadius: '9px', color: 'var(--neon)', fontWeight: 800, fontSize: '14px', padding: '11px 22px', cursor: requestingPayout ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                          {requestingPayout ? '⏳ Sending...' : '→ Pay Out Now'}
                        </button>
                        {payoutMsg && (
                          <p style={{ color: payoutMsg.startsWith('✓') ? '#00ff88' : '#ef4444', fontSize: '13px', marginTop: '8px', fontWeight: 700 }}>
                            {payoutMsg}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>Connect a payout account below to withdraw</p>
                    )}
                  </div>
                )}

                {pendingEarningsCents === 0 && stripeOnboarded && (
                  <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '13px' }}>$0.00 pending — earnings will appear here as fans spend coins at your show.</p>
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
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '13px' }}>⚠️ No payout account — earnings are accumulating but can't be transferred yet.</span>
                    </div>
                    <button onClick={connectStripe} disabled={connectingStripe}
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.4)', borderRadius: '9px', color: '#818cf8', fontWeight: 700, fontSize: '13px', padding: '9px 18px', cursor: connectingStripe ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {connectingStripe ? '⏳ Redirecting...' : '→ Connect Account'}
                    </button>
                  </div>
                )}
              </div>
            )}

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

            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Need help? <a href="mailto:larzgh44@gmail.com?subject=Next Up" style={{ color: 'var(--neon)' }}>Email support</a>
            </p>
          </div>
        )}
      </main>

      <ImportSongsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingSongs={songs}
        token={token}
        onImported={() => fetchAll()}
      />

      <style>{`
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 430px) {
  .dash-header-actions { flex-wrap: wrap; justify-content: flex-end; gap: 6px !important; }
  .dash-header-actions a { font-size: 12px !important; padding: 5px 10px !important; }
  .dash-header-actions .btn-secondary { font-size: 12px !important; padding: 5px 8px !important; }
  .dash-earnings-badge { display: none !important; }
  .pricing-grid { grid-template-columns: 1fr !important; }
  .queue-item-actions { flex-direction: column !important; align-items: stretch !important; gap: 4px !important; min-width: 72px; }
  .queue-item-actions button { width: 100% !important; }
  .qr-url-display { display: block !important; text-align: left !important; }
}
`}</style>
    </div>
  )
                                                                                }
