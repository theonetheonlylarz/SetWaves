import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

const COINS_KEY = 'nextup_coins'
const FAN_TOKEN_KEY = 'nextup_fan_token'

const TIER_META = {
  STANDARD: { icon: '🎵', label: 'Add to Queue', color: 'var(--neon)', bg: 'var(--neon-dim)', border: 'rgba(0,255,136,0.3)' },
  PRIORITY: { icon: '⚡', label: 'Move Up', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.4)' },
  PLAY_NEXT: { icon: '🔥', label: 'Play Next', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.4)' },
}

function getStoredCoins() {
  try { return Math.max(0, parseInt(localStorage.getItem(COINS_KEY) || '0', 10)) } catch { return 0 }
}
function storeCoins(n) {
  try { localStorage.setItem(COINS_KEY, String(Math.max(0, n))) } catch {}
}
function getStoredFanToken() {
  try { return localStorage.getItem(FAN_TOKEN_KEY) || null } catch { return null }
}

export default function ShowPage() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState(null)
  const [showNotFound, setShowNotFound] = useState(false)
  const [coins, setCoins] = useState(getStoredCoins)
  const [fanToken, setFanToken] = useState(getStoredFanToken)
  const [fanEmail, setFanEmail] = useState('')
  const [fanBalance, setFanBalance] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [fanDisplayName, setFanDisplayName] = useState(() => localStorage.getItem('nextup_fan_name') || '')
  const [authError, setAuthError] = useState('')
  const effectiveCoins = (fanToken && fanBalance !== null) ? fanBalance : coins
  const [redeeming, setRedeeming] = useState(false)
  const [requester, setRequester] = useState('')
  const [selectedSong, setSelectedSong] = useState('')
  const [customSong, setCustomSong] = useState('')
  const [dedication, setDedication] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [buyMode, setBuyMode] = useState(false)
  const [customCoins, setCustomCoins] = useState('')
  const [buying, setBuying] = useState(false)
  const [genreFilter, setGenreFilter] = useState('All')
  const [sortAZ, setSortAZ] = useState(false)
  const [jumpsUsed, setJumpsUsed] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem('nextup_jumps_' + slug) || '0', 10)) } catch { return 0 }
  })
  const [playNextUsed, setPlayNextUsed] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem('nextup_playnext_' + slug) || '0', 10)) } catch { return 0 }
  })
  const [shoutoutMsg, setShoutoutMsg] = useState('')
  const [shoutoutName, setShoutoutName] = useState('')
  const [sendingShoutout, setSendingShoutout] = useState(false)
  const [shoutoutSuccess, setShoutoutSuccess] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [tipMessage, setTipMessage] = useState('')
  const [tipName, setTipName] = useState('')
  const [sendingTip, setSendingTip] = useState(false)
  const [tipSuccess, setTipSuccess] = useState(false)
  const [packages, setPackages] = useState([])
  const [voteResults, setVoteResults] = useState([])
  const [myVote, setMyVote] = useState(() => { try { return localStorage.getItem('nextup_vote_' + slug) || null } catch { return null } })
  const [castingVote, setCastingVote] = useState(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [voterKey] = useState(() => {
    const k = 'nextup_vk_' + slug
    try { let v = localStorage.getItem(k); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v) } return v }
    catch { return Math.random().toString(36).slice(2) }
  })
  const wsRef = useRef(null)

  useEffect(() => { storeCoins(coins) }, [coins])

  useEffect(() => {
    if (!fanToken) { setFanBalance(null); setFanEmail(''); return }
    fetch('/api/fan/me', { headers: { Authorization: 'Bearer ' + fanToken } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setFanEmail(data.email); setFanBalance(data.coinBalance); }
        else { localStorage.removeItem(FAN_TOKEN_KEY); setFanToken(null); }
      }).catch(() => {})
  }, [fanToken])

  const updateCoins = (updater) => {
    if (fanToken && fanBalance !== null) {
      const newBalance = typeof updater === 'function' ? updater(fanBalance) : updater
      const clamped = Math.max(0, newBalance)
      setFanBalance(clamped)
      fetch('/api/fan/balance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fanToken },
        body: JSON.stringify({ coinBalance: clamped }),
      }).catch(() => {})
    } else { setCoins(updater) }
  }

  const fetchShow = async () => {
    try {
      const res = await fetch('/api/show/' + slug)
      if (res.ok) setShow(await res.json())
      else if (res.status === 404) setShowNotFound(true)
    } catch {}
  }
  const fetchVotes = async () => {
    try { const res = await fetch('/api/votes/' + slug); if (res.ok) { const d = await res.json(); setVoteResults(d.votes || []) } } catch {}
  }
  useEffect(() => { fetchShow(); fetchVotes() }, [slug])

  useEffect(() => {
    const grantId = params.get('grant')
    if (!grantId) return
    setRedeeming(true)
    let attempts = 0
    const tryRedeem = async () => {
      try {
        const headers = {}
        if (fanToken) headers['Authorization'] = 'Bearer ' + fanToken
        const res = await fetch('/api/tokens/redeem/' + grantId, { headers })
        const data = await res.json()
        if (res.ok) {
          if (fanToken && data.fanBalance !== null && data.fanBalance !== undefined) {
            setFanBalance(data.fanBalance)
          } else { updateCoins(c => c + data.tokens) }
          setRedeeming(false)
          const next = new URLSearchParams(params); next.delete('grant')
          setParams(next, { replace: true })
        } else if (res.status === 409) {
          setRedeeming(false)
          const next = new URLSearchParams(params); next.delete('grant')
          setParams(next, { replace: true })
        } else if (res.status === 404 && attempts < 8) { attempts++; setTimeout(tryRedeem, 1500)
        } else { setError('Redemption failed — your payment was received. Contact the performer for help.'); setRedeeming(false) }
      } catch {
        if (attempts < 8) { attempts++; setTimeout(tryRedeem, 1500) }
        else { setError('Network error during redemption.'); setRedeeming(false) }
      }
    }
    tryRedeem()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshFanBalance = () => {
    if (!fanToken) return
    fetch('/api/fan/me', { headers: { Authorization: 'Bearer ' + fanToken } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFanBalance(data.coinBalance) })
      .catch(() => {})
  }

  useEffect(() => {
    document.body.style.overflow = requestOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [requestOpen])

  useEffect(() => {
    if (!slug) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + slug)
    wsRef.current.onerror = () => {}
    wsRef.current.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'QUEUE_UPDATE' || !msg.type) { fetchShow(); refreshFanBalance() }
        if (msg.type === 'SHOW_STATUS' || msg.type === 'NOW_PLAYING') fetchShow()
        if (msg.type === 'VOTE_UPDATE') fetchVotes()
      } catch { fetchShow() }
    }
    return () => wsRef.current?.close()
  }, [slug])

  const handleFanAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true); setAuthError('')
    try {
      const endpoint = authMode === 'signup' ? '/api/fan/register' : '/api/fan/login'
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Auth failed')
      localStorage.setItem(FAN_TOKEN_KEY, data.token)
      if (authMode === 'signup' && authDisplayName.trim()) {
        localStorage.setItem('nextup_fan_name', authDisplayName.trim())
        setFanDisplayName(authDisplayName.trim())
      }
      setFanToken(data.token); setFanEmail(data.fan.email); setFanBalance(data.fan.coinBalance)
      if (coins > 0 && data.fan.coinBalance === 0) {
        const newBal = coins; setFanBalance(newBal); setCoins(0)
        fetch('/api/fan/balance', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
          body: JSON.stringify({ coinBalance: newBal }),
        }).catch(() => {})
      }
      setShowAuthModal(false); setAuthEmail(''); setAuthPassword(''); setAuthDisplayName('')
    } catch (err) { setAuthError(err.message) }
    finally { setAuthLoading(false) }
  }

  const handleFanLogout = () => {
    localStorage.removeItem(FAN_TOKEN_KEY); localStorage.removeItem('nextup_fan_name'); setFanToken(null); setFanEmail(''); setFanBalance(null); setFanDisplayName('')
  }

  const openBuyMode = () => {
    setBuyMode(true); setError('')
    if (packages.length === 0 && slug) {
      fetch('/api/packages/' + slug).then(r => r.ok ? r.json() : []).then(setPackages).catch(() => {})
    }
  }

  const buyCoins = async (amount) => {
    if (!show?.stripeEnabled) return setError('Payments are not available for this show right now.')
    const n = parseInt(amount, 10)
    if (isNaN(n) || n < 1) return setError('Enter a valid coin amount')
    setBuying(true); setError('')
    try {
      const res = await fetch('/api/stripe/checkout/' + slug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coins: n })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError(data.error || 'Checkout unavailable right now')
    } catch { setError('Network error') }
    finally { setBuying(false) }
  }

  const handleRequest = async (tier) => {
    const cost = show?.queueCoinCost || 1; const jumpCost = show?.queueJumpCost || 5
    const playNextCost = show?.playNextCost || 15; const maxJumps = show?.maxJumpsPerSession || 2
    const maxPlayNext = show?.maxPlayNextPerSession || 1
    let deductCost = cost
    if (tier === 'PRIORITY') deductCost = jumpCost
    if (tier === 'PLAY_NEXT') deductCost = playNextCost
    if (effectiveCoins < deductCost) return setError('You need ' + deductCost + ' coin' + (deductCost !== 1 ? 's' : '') + ' for this option')
    if (tier === 'PRIORITY' && jumpsUsed >= maxJumps) return setError("You've reached the Move Up limit for this show (" + maxJumps + '/' + maxJumps + ')')
    if (tier === 'PLAY_NEXT' && playNextUsed >= maxPlayNext) return setError("You've already used Play Next for this show (" + maxPlayNext + '/' + maxPlayNext + ')')
    const title = customSong.trim() || selectedSong
    if (!title) return setError('Please select or enter a song')
    setSubmitting(true); setError('')
    try {
      const reqHeaders = { 'Content-Type': 'application/json' }
      if (fanToken) reqHeaders['Authorization'] = 'Bearer ' + fanToken
      const res = await fetch('/api/queue/' + slug, {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ songTitle: title, requester: requester.trim() || 'Anonymous', tier, dedication: dedication.trim().slice(0, 60) || undefined })
      })
      const data = await res.json()
      if (res.status === 429) { setError(data.error || "You've reached the limit for this show"); return }
      if (!res.ok) throw new Error(data.error)
      if (tier === 'PRIORITY') { const next = jumpsUsed + 1; setJumpsUsed(next); try { localStorage.setItem('nextup_jumps_' + slug, String(next)) } catch {} }
      if (tier === 'PLAY_NEXT') { const next = playNextUsed + 1; setPlayNextUsed(next); try { localStorage.setItem('nextup_playnext_' + slug, String(next)) } catch {} }
      setSelectedSong(''); setCustomSong(''); setDedication('')
      setRequestOpen(false)
      setSuccess(true); setTimeout(() => setSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  const handleShoutout = async () => {
    if (!shoutoutMsg.trim()) return setError('Please enter a shoutout message')
    const shoutoutCost = show?.shoutoutCost || 10
    if (effectiveCoins < shoutoutCost) return setError('You need ' + shoutoutCost + ' coins to send a shoutout')
    setSendingShoutout(true); setError('')
    try {
      const reqHeaders = { 'Content-Type': 'application/json' }
      if (fanToken) reqHeaders['Authorization'] = 'Bearer ' + fanToken
      const res = await fetch('/api/shoutout/' + slug, {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ message: shoutoutMsg.trim(), fromName: (requester.trim() || shoutoutName.trim()) || 'Anonymous' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (fanToken) { refreshFanBalance() } else { updateCoins(c => c - shoutoutCost) }
      setShoutoutMsg(''); setShoutoutName('')
      setShoutoutSuccess(true); setTimeout(() => setShoutoutSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSendingShoutout(false) }
  }

  const castVote = async (genre) => {
    setCastingVote(genre)
    try {
      const h = { 'Content-Type': 'application/json' }
      if (fanToken) h['Authorization'] = 'Bearer ' + fanToken
      const res = await fetch('/api/votes/' + slug, { method: 'POST', headers: h, body: JSON.stringify({ genre, voterKey }) })
      if (res.ok) { setMyVote(genre); try { localStorage.setItem('nextup_vote_' + slug, genre) } catch {}; fetchVotes() }
    } catch {}
    setCastingVote(null)
  }

  const handleTip = async () => {
    const amount = parseInt(tipAmount, 10)
    const tipCost = show?.tipCost || 1
    if (isNaN(amount) || amount < tipCost) return setError('Minimum tip is ' + tipCost + ' coins')
    if (effectiveCoins < amount) return setError('You need ' + amount + ' coins to tip that amount')
    setSendingTip(true); setError('')
    try {
      const reqHeaders = { 'Content-Type': 'application/json' }
      if (fanToken) reqHeaders['Authorization'] = 'Bearer ' + fanToken
      const res = await fetch('/api/tip/' + slug, {
        method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ coins: amount, fromName: tipName.trim() || 'Anonymous', message: tipMessage.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (fanToken) { refreshFanBalance() } else { updateCoins(c => c - amount) }
      setTipAmount(''); setTipMessage(''); setTipName('')
      setTipSuccess(true); setTimeout(() => setTipSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSendingTip(false) }
  }

  if (showNotFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'var(--bg)', textAlign: 'center', padding: '24px', overflowX: 'hidden', maxWidth: '100vw', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '52px', marginBottom: '4px' }}>🎵</div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)' }}>Show not found</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '280px' }}>This performer link doesn't exist or may have changed. Try scanning the QR code again.</p>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )

  if (!show) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg)' }}>
      <Spinner /><p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading show...</p>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )

  const cost = show.queueCoinCost || 1; const jumpCost = show.queueJumpCost || 5
  const playNextCost = show.playNextCost || 15; const maxJumps = show.maxJumpsPerSession || 2
  const maxPlayNext = show.maxPlayNextPerSession || 1; const shoutoutCost = show.shoutoutCost || 10
  const hasEnough = effectiveCoins >= cost; const liveQueue = show.queue || []
  const availableGenres = ['All', ...[...new Set((show.songs || []).map(s => s.genre).filter(Boolean))].sort()]
  let filteredSongs = (show.songs || []).filter(s => genreFilter === 'All' || s.genre === genreFilter)
  if (sortAZ) filteredSongs = [...filteredSongs].sort((a, b) => a.title.localeCompare(b.title))

  const tierButtonStyle = (tier, enabled) => {
    const meta = TIER_META[tier]
    return { padding: '12px 8px', fontSize: '14px', borderRadius: '10px',
      background: enabled ? meta.bg : 'var(--surface2)', border: '1.5px solid ' + (enabled ? meta.border : 'var(--border)'),
      color: enabled ? meta.color : 'var(--muted)', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed',
      transition: 'all 0.15s', fontFamily: 'inherit', flex: 1, textAlign: 'center', lineHeight: '1.3' }
  }

  const canStandard = effectiveCoins >= cost; const canPriority = effectiveCoins >= jumpCost && jumpsUsed < maxJumps
  const canPlayNext = effectiveCoins >= playNextCost && playNextUsed < maxPlayNext; const canShoutout = effectiveCoins >= shoutoutCost

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAuthModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 800, fontSize: '20px' }}>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '22px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>x</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
              {authMode === 'login' ? 'Sign in to keep your coin balance across devices.' : 'Create a free account so your coins never disappear.'}
            </p>
            <form onSubmit={handleFanAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {authMode === 'signup' && (
                <input type="text" placeholder="Display name (e.g. your first name)" value={authDisplayName} onChange={e => setAuthDisplayName(e.target.value)} autoFocus />
              )}
              <input type="email" placeholder="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required autoFocus={authMode !== 'signup'} />
              <input type="password" placeholder={authMode === 'signup' ? 'Password (min 6 chars)' : 'Password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
              {authError && (
                <div style={{ background: 'rgba(255,91,91,0.08)', border: '1px solid rgba(255,91,91,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#ff5b5b' }}>{authError}</div>
              )}
              <button type="submit" className="btn-primary" disabled={authLoading} style={{ padding: '13px', fontSize: '15px', marginTop: '4px' }}>
                {authLoading ? '...' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError('') }}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -5%, rgba(0,255,136,0.1) 0%, transparent 65%)', borderBottom: '1px solid var(--border)', padding: '48px 20px 36px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          {fanToken ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{fanDisplayName || fanEmail}</span>
              <button onClick={handleFanLogout} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); setAuthError('') }}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Sign in
              </button>
              <button onClick={() => { setAuthMode('signup'); setShowAuthModal(true); setAuthError('') }}
                style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.35)', borderRadius: '8px', color: 'var(--neon)', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                Create account
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '16px', padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px' }}>
          <div style={{ width: '18px', height: '18px', background: 'var(--neon)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>🎵</div>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Next Up</span>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px', lineHeight: '1.1', margin: '0 auto 16px', maxWidth: '480px' }}>{show.displayName}</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: effectiveCoins > 0 ? 'rgba(0,255,136,0.08)' : 'var(--surface)', border: '1.5px solid ' + (effectiveCoins > 0 ? 'rgba(0,255,136,0.3)' : 'var(--border)'), borderRadius: '24px', padding: '8px 18px', fontSize: '14px', fontWeight: 700, color: effectiveCoins > 0 ? 'var(--neon)' : 'var(--muted)', transition: 'all 0.3s ease' }}>
          {redeeming ? '⏳ Adding coins...' : '🪙 ' + effectiveCoins + ' coin' + (effectiveCoins !== 1 ? 's' : '')}
        </div>
        {fanToken
          ? <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px' }}>💾 Balance saved to your account</p>
          : <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px' }}>
              <button onClick={() => { setShowAuthModal(true); setAuthError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--neon)', fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Sign in</button>
              {' '}to save coins across devices
            </p>
        }
        {show.nowPlaying && (
          <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '24px', padding: '7px 16px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--neon)', borderRadius: '50%', display: 'inline-block', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Now Playing</span>
            <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700 }}>{show.nowPlaying}</span>
          </div>
        )}
        {!show.queueOpen && (
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,91,91,0.06)', border: '1px solid rgba(255,91,91,0.2)', borderRadius: '24px', padding: '6px 14px' }}>
            <span style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 700 }}>🚫 Queue is closed</span>
          </div>
        )}
      </div>
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '28px 20px 60px' }}>
        {redeeming && (<div style={{ background: 'rgba(0,255,136,0.04)', border: '1.5px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: '14px', textAlign: 'center' }}><p style={{ color: 'var(--neon)', fontWeight: 600, fontSize: '14px' }}>⏳ Confirming your payment...</p></div>)}
        {success && (<div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}><p style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '16px' }}>🎵 Request submitted!</p><p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>Awaiting the performer's approval — coins charged on acceptance.</p></div>)}
        {shoutoutSuccess && (<div style={{ background: 'rgba(139,92,246,0.08)', border: '1.5px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}><p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '16px' }}>📣 Shoutout sent!</p><p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>The performer will see your message!</p></div>)}
        {tipSuccess && (<div style={{ background: 'rgba(234,179,8,0.08)', border: '1.5px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}><p style={{ color: '#eab308', fontWeight: 700, fontSize: '16px' }}>💰 Tip sent!</p><p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>Thanks for supporting the performer!</p></div>)}
        {error && <div className="error" style={{ marginBottom: '14px' }}>{error}</div>}

        {show.genreVoteEnabled && (() => {
          let opts = []
          try { opts = JSON.parse(show.genreVoteOptions || '[]') } catch {}
          const total = voteResults.reduce((s, v) => s + v.count, 0)
          return (
            <div className="card" style={{ marginBottom: '20px', borderColor: 'rgba(139,92,246,0.2)', background: 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, var(--surface) 100%)' }}>
              <div style={{ marginBottom: '14px' }}>
                <p style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>🎭 Vote for Tonight's Vibe</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Pick a genre — the performer plays what wins{total > 0 ? ' · ' + total + ' vote' + (total !== 1 ? 's' : '') + ' so far' : ''}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: voteResults.length > 0 ? '16px' : 0 }}>
                {opts.map(g => (
                  <button key={g} onClick={() => castVote(g)} disabled={!!castingVote}
                    className={'chip' + (myVote === g ? ' vote-active' : '')}
                    style={{ fontSize: '14px', padding: '8px 18px', minHeight: '38px', fontWeight: myVote === g ? 800 : 600 }}>
                    {castingVote === g ? '...' : myVote === g ? '✓ ' + g : g}
                  </button>
                ))}
              </div>
              {voteResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  {voteResults.map((v, i) => (
                    <div key={v.genre}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '13px', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--neon)' : 'var(--text-secondary)' }}>
                          {i === 0 ? '🥇 ' : ''}{v.genre}{myVote === v.genre ? ' ← your vote' : ''}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>{v.pct}%</span>
                      </div>
                      <div className="vote-bar-track">
                        <div className={'vote-bar-fill' + (i === 0 ? ' leader' : '')} style={{ width: v.pct + '%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {buyMode ? (
          <div className="card" style={{ marginBottom: '24px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '18px', marginBottom: '3px' }}>Get Coins</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>🪙 $1 per coin · no expiry</p>
                <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>✨ Your balance works at <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>any show on Next Up</span> — leftover coins never disappear.</p>
              </div>
              <button onClick={() => { setBuyMode(false); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>×</button>
            </div>
            <div className="sp-coin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', boxSizing: 'border-box', padding: '0', margin: '12px 0' }}>
              {(packages.length > 0 ? packages : [
                { id: 'starter', name: 'Starter', coins: 5, price: 5, emoji: '🎵', description: 'Good for 1–2 requests' },
                { id: 'popular', name: 'Popular', coins: 15, price: 15, emoji: '⚡', description: 'Jump the queue 3x' },
                { id: 'superfan', name: 'Super Fan', coins: 50, price: 50, emoji: '🔥', description: 'Full night of requests' },
                { id: 'vip', name: 'VIP', coins: 100, price: 100, emoji: '👑', description: 'Play Next + shoutouts' },
              ]).map(pkg => (
                                <button key={pkg.id} onClick={() => buyCoins(pkg.coins)} disabled={buying}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', minHeight: '80px', width: '100%', boxSizing: 'border-box', overflow: 'hidden', textAlign: 'left', gap: '3px', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{pkg.emoji} {pkg.name}</span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#00ff88', lineHeight: 1 }}>{pkg.coins}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3' }}>{pkg.description}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginTop: 'auto' }}>${pkg.price}.00</span>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Custom amount</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input type="number" min="1" placeholder="Enter coins" value={customCoins} onChange={e => setCustomCoins(e.target.value)} style={{ width: '100%', height: '48px', fontSize: '16px', padding: '0 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', boxSizing: 'border-box' }} />
                {customCoins && parseInt(customCoins) > 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>= ${parseInt(customCoins).toFixed(2)}</p>
                )}
                <button onClick={() => buyCoins(customCoins)} className="btn-primary" disabled={!customCoins || buying} style={{ width: '100%', height: '48px', background: '#00ff88', color: '#000', fontWeight: 800, fontSize: '15px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
                  {buying ? '...' : (customCoins && parseInt(customCoins) > 0 ? `Buy ${parseInt(customCoins)} coin${parseInt(customCoins) !== 1 ? 's' : ''} — $${parseInt(customCoins)}.00` : 'Buy')}
                </button>
              </div>
            </div>
        ) : (
          <>
            {/* ── Request bottom-sheet modal ── */}
            {requestOpen && (
              <div onClick={e => { if (e.target === e.currentTarget) { setRequestOpen(false); setError(''); setShoutoutMsg('') } }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '8px 0 0', width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--border)', borderBottom: 'none' }}>
                  <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 20px' }} />
                  <div style={{ padding: '0 20px 40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div>
                        <h2 style={{ fontWeight: 800, fontSize: '18px' }}>Request a Song</h2>
                        <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>
                          <span style={{ color: 'var(--neon)', fontWeight: 700 }}>🎵 {cost}</span>{' · '}
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚡ {jumpCost}</span>{' · '}
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>🔥 {playNextCost}</span>
                        </p>
                      </div>
                      <button onClick={() => { setRequestOpen(false); setError(''); setShoutoutMsg('') }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                    </div>

                    {/* Selected song display or custom input */}
                    {selectedSong ? (
                      <div style={{ background: 'var(--neon-dim)', border: '1.5px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--neon)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSong}</p>
                          {show.songs?.find(s => s.title === selectedSong)?.artist && (
                            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '2px' }}>{show.songs.find(s => s.title === selectedSong).artist}</p>
                          )}
                        </div>
                        <button onClick={() => setSelectedSong('')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0 }}>change</button>
                      </div>
                    ) : (
                      <input placeholder="Type a song title..." value={customSong} onChange={e => { setCustomSong(e.target.value); setSelectedSong('') }} style={{ marginBottom: '10px' }} autoFocus />
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input placeholder="Your name (optional)" value={requester} onChange={e => setRequester(e.target.value)} />
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Dedication (optional)</label>
                        <div style={{ position: 'relative' }}>
                          <input placeholder="e.g. 'Happy Birthday Sarah! 🎂'" value={dedication} onChange={e => setDedication(e.target.value.slice(0, 60))} style={{ paddingRight: '48px', borderColor: dedication ? 'rgba(167,139,250,0.4)' : undefined }} />
                          {dedication.length > 0 && (<span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: dedication.length >= 55 ? '#ef4444' : 'var(--muted)', fontWeight: 600, pointerEvents: 'none' }}>{60 - dedication.length}</span>)}
                        </div>
                      </div>
                      {error && <div className="error">{error}</div>}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => handleRequest('STANDARD')} disabled={submitting || !canStandard} style={tierButtonStyle('STANDARD', canStandard && !submitting)}>
                          <div style={{ fontSize: '20px', marginBottom: '3px' }}>🎵</div>
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>Add to Queue</div>
                          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>🪙 {cost}</div>
                        </button>
                        <button type="button" onClick={() => handleRequest('PRIORITY')} disabled={submitting || !canPriority} style={tierButtonStyle('PRIORITY', canPriority && !submitting)}>
                          <div style={{ fontSize: '20px', marginBottom: '3px' }}>⚡</div>
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>Move Up</div>
                          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{jumpsUsed >= maxJumps ? 'Limit reached' : '🪙 ' + jumpCost + ' (' + (maxJumps - jumpsUsed) + ' left)'}</div>
                        </button>
                        <button type="button" onClick={() => handleRequest('PLAY_NEXT')} disabled={submitting || !canPlayNext} style={tierButtonStyle('PLAY_NEXT', canPlayNext && !submitting)}>
                          <div style={{ fontSize: '20px', marginBottom: '3px' }}>🔥</div>
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>Play Next</div>
                          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{playNextUsed >= maxPlayNext ? 'Limit reached' : '🪙 ' + playNextCost}</div>
                        </button>
                      </div>
                      {!hasEnough && (
                        <button onClick={() => { setRequestOpen(false); openBuyMode() }} className="btn-primary" style={{ padding: '13px', fontSize: '15px' }}>🪙 Get Coins to Request</button>
                      )}
                      {submitting && (<div style={{ textAlign: 'center', padding: '8px' }}><Spinner /></div>)}

                      {/* Shoutout add-on */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '2px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', marginBottom: '8px' }}>
                          📣 Add a Shoutout <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(optional · 🪙 {shoutoutCost} coins)</span>
                        </p>
                        {shoutoutSuccess ? (
                          <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#a78bfa', fontWeight: 700, textAlign: 'center' }}>📣 Shoutout sent!</div>
                        ) : (
                          <>
                            <textarea placeholder="Send the performer a message with your request..." value={shoutoutMsg} onChange={e => setShoutoutMsg(e.target.value.slice(0, 120))} rows={2} style={{ resize: 'none', minHeight: '60px' }} />
                            {shoutoutMsg.trim() && (
                              <button type="button" onClick={handleShoutout} disabled={sendingShoutout || !canShoutout} style={{ marginTop: '8px', padding: '11px', fontSize: '13px', borderRadius: '10px', width: '100%', background: canShoutout ? 'rgba(139,92,246,0.12)' : 'var(--surface2)', border: '1.5px solid ' + (canShoutout ? 'rgba(139,92,246,0.4)' : 'var(--border)'), color: canShoutout ? '#a78bfa' : 'var(--muted)', fontWeight: 700, cursor: canShoutout ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                                {sendingShoutout ? '⏳ Sending...' : canShoutout ? '📣 Send Shoutout · 🪙 ' + shoutoutCost : 'Need ' + shoutoutCost + ' coins'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button onClick={() => openBuyMode()} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>+ Get more coins · 🪙 {effectiveCoins} left</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Setlist card ── */}
            <div className="card" style={{ marginBottom: '24px', borderColor: show.queueOpen ? 'rgba(0,255,136,0.15)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: '18px' }}>🎵 Tonight's Setlist</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>{show.queueOpen ? 'Tap a song to request it' : 'Queue is closed — check back soon'}</p>
                </div>
                <span style={{ background: show.queueOpen ? 'var(--neon-dim)' : 'rgba(255,91,91,0.08)', color: show.queueOpen ? 'var(--neon)' : 'var(--red)', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid ' + (show.queueOpen ? 'rgba(0,255,136,0.2)' : 'rgba(255,91,91,0.2)'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {show.queueOpen ? '🪙 ' + effectiveCoins + ' coins' : '🚫 Closed'}
                </span>
              </div>

              {/* Genre + sort filter */}
              {availableGenres.length > 1 && (
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Filter by Genre</label>
                    <button onClick={() => setSortAZ(v => !v)} style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit', background: sortAZ ? 'rgba(139,92,246,0.12)' : 'transparent', border: '1px solid ' + (sortAZ ? 'rgba(139,92,246,0.4)' : 'var(--border)'), color: sortAZ ? '#a78bfa' : 'var(--muted)', transition: 'all 0.15s' }}>A–Z</button>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {availableGenres.map(g => (
                      <button key={g} onClick={() => setGenreFilter(g)} style={{ padding: '5px 13px', fontSize: '12px', fontWeight: 700, borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit', background: genreFilter === g ? 'var(--neon-dim)' : 'var(--surface)', border: '1.5px solid ' + (genreFilter === g ? 'rgba(0,255,136,0.4)' : 'var(--border)'), color: genreFilter === g ? 'var(--neon)' : 'var(--text-secondary)', transition: 'all 0.15s', minHeight: '30px' }}>{g}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Song list */}
              {filteredSongs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: show.queueOpen ? '12px' : 0 }}>
                  {filteredSongs.map(song => (
                    <button key={song.id}
                      onClick={() => { if (!show.queueOpen) return; if (!hasEnough) { openBuyMode(); return; } setSelectedSong(song.title); setCustomSong(''); setError(''); setRequestOpen(true) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: show.queueOpen ? 'pointer' : 'default', transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit', width: '100%', opacity: show.queueOpen ? 1 : 0.5 }}
                      onMouseEnter={e => { if (show.queueOpen) { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}>
                      <div style={{ width: '36px', height: '36px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🎵</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
                        {song.artist && <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>}
                      </div>
                      {song.genre && song.genre !== 'Other' && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2px 8px', flexShrink: 0 }}>{song.genre}</span>
                      )}
                      {show.queueOpen && <span style={{ color: 'var(--neon)', fontSize: '20px', flexShrink: 0, lineHeight: 1 }}>›</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px 24px', color: 'var(--muted)', fontSize: '14px', marginBottom: show.queueOpen ? '12px' : 0 }}>
                  {show.songs?.length > 0 ? 'No songs in this genre' : 'No setlist uploaded yet'}
                </div>
              )}

              {show.queueOpen && (
                <button onClick={() => { if (!hasEnough) { openBuyMode(); return; } setSelectedSong(''); setCustomSong(''); setError(''); setRequestOpen(true) }}
                  style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 700, borderRadius: 'var(--radius-md)', background: 'transparent', border: '1.5px dashed var(--border)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.35)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                  🎤 Request a song not on this list
                </button>
              )}
            </div>

            {/* ── Shoutout card ── */}
            <div className="card" style={{ marginBottom: '24px', borderColor: 'rgba(139,92,246,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div><h2 style={{ fontWeight: 800, fontSize: '17px' }}>📣 Send a Shoutout</h2><p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>Send a message to the performer · <span style={{ color: '#a78bfa', fontWeight: 700 }}>🪙 {shoutoutCost} coins</span></p></div>
                {canShoutout && (<span style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(139,92,246,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>🪙 {effectiveCoins} left</span>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Your name (optional)" value={shoutoutName} onChange={e => setShoutoutName(e.target.value)} />
                <textarea placeholder="Your message to the performer..." value={shoutoutMsg} onChange={e => setShoutoutMsg(e.target.value.slice(0, 120))} rows={3} style={{ resize: 'vertical', minHeight: '72px' }} />
                <button type="button" onClick={handleShoutout} disabled={sendingShoutout || !shoutoutMsg.trim() || !canShoutout} style={{ padding: '12px', fontSize: '14px', borderRadius: '10px', background: (canShoutout && shoutoutMsg.trim()) ? 'rgba(139,92,246,0.12)' : 'var(--surface2)', border: '1.5px solid ' + ((canShoutout && shoutoutMsg.trim()) ? 'rgba(139,92,246,0.4)' : 'var(--border)'), color: (canShoutout && shoutoutMsg.trim()) ? '#a78bfa' : 'var(--muted)', fontWeight: 700, cursor: (canShoutout && shoutoutMsg.trim()) ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                  {sendingShoutout ? '⏳ Sending...' : !canShoutout ? ('Need ' + shoutoutCost + ' coins · 🪙 ' + (shoutoutCost - effectiveCoins) + ' more') : ('📣 Send Shoutout · 🪙 ' + shoutoutCost + ' coins')}
                </button>
                {!canShoutout && (<div style={{ textAlign: 'center' }}><button onClick={() => openBuyMode()} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>+ Get more coins</button></div>)}
              </div>
            </div>

            {/* ── Tip card ── */}
            {(() => {
              const tipCost = show?.tipCost || 1
              const canTip = effectiveCoins >= tipCost
              const tipAmountNum = parseInt(tipAmount, 10)
              const tipValid = !isNaN(tipAmountNum) && tipAmountNum >= tipCost && effectiveCoins >= tipAmountNum
              return (
                <div className="card" style={{ marginBottom: '24px', borderColor: 'rgba(234,179,8,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div><h2 style={{ fontWeight: 800, fontSize: '17px' }}>💰 Send a Tip</h2><p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>Support the performer · <span style={{ color: '#eab308', fontWeight: 700 }}>min 🪙 {tipCost} coins</span></p></div>
                    {canTip && (<span style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(234,179,8,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>🪙 {effectiveCoins} left</span>)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Your name (optional)" value={tipName} onChange={e => setTipName(e.target.value)} />
                    <input type="number" min={tipCost} placeholder={'Coins to tip (min ' + tipCost + ')'} value={tipAmount} onChange={e => setTipAmount(e.target.value)} />
                    <textarea placeholder="Message (optional)" value={tipMessage} onChange={e => setTipMessage(e.target.value.slice(0, 120))} rows={2} style={{ resize: 'vertical', minHeight: '60px' }} />
                    <button type="button" onClick={handleTip} disabled={sendingTip || !tipValid} style={{ padding: '12px', fontSize: '14px', borderRadius: '10px', background: tipValid ? 'rgba(234,179,8,0.12)' : 'var(--surface2)', border: '1.5px solid ' + (tipValid ? 'rgba(234,179,8,0.4)' : 'var(--border)'), color: tipValid ? '#eab308' : 'var(--muted)', fontWeight: 700, cursor: tipValid ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                      {sendingTip ? '⏳ Sending...' : !canTip ? ('Need ' + tipCost + ' coins · 🪙 ' + (tipCost - effectiveCoins) + ' more') : tipAmountNum > 0 ? ('💰 Send Tip · 🪙 ' + tipAmountNum + ' coins') : '💰 Send Tip'}
                    </button>
                    {!canTip && (<div style={{ textAlign: 'center' }}><button onClick={() => openBuyMode()} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>+ Get more coins</button></div>)}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <h2 style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-secondary)' }}>🎶 Up Next</h2>
            <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', padding: '2px 8px' }}>{liveQueue.length}</span>
          </div>
          {liveQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 24px', background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎵</div>
              <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>No songs in queue yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Be the first to request one! 🎵</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {liveQueue.slice(0, 10).map((item, i) => {
                const tierColor = item.tier === 'PLAY_NEXT' ? '#ef4444' : item.tier === 'PRIORITY' ? '#f59e0b' : 'var(--border)'
                const tierIcon = item.tier === 'PLAY_NEXT' ? '🔥' : item.tier === 'PRIORITY' ? '⚡' : null
                const tierLabel = item.tier === 'PLAY_NEXT' ? 'Play Next' : item.tier === 'PRIORITY' ? 'Priority' : null
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid ' + (item.tier !== 'STANDARD' ? tierColor + '55' : 'var(--border)'), borderRadius: 'var(--radius-md)', opacity: i === 0 ? 1 : 0.7 }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, minWidth: '18px', textAlign: 'center', paddingTop: '2px' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.songTitle}</p>
                      <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '1px' }}>{item.requester}</p>
                      {item.dedication && (<p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{item.dedication}"</p>)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', flexShrink: 0 }}>
                      {tierLabel && (<span style={{ fontSize: '11px', color: tierColor, fontWeight: 700, background: tierColor + '18', padding: '2px 8px', borderRadius: '10px', border: '1px solid ' + tierColor + '33', whiteSpace: 'nowrap' }}>{tierIcon} {tierLabel}</span>)}
                      {i === 0 && (<span style={{ fontSize: '11px', color: 'var(--neon)', fontWeight: 700, background: 'var(--neon-dim)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.15)', whiteSpace: 'nowrap' }}>Playing soon</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 430px) {
  .sp-tier-row { flex-wrap: wrap !important; gap: 6px !important; }
  .sp-tier-row > * { flex: 1 1 calc(50% - 3px) !important; min-width: 0 !important; white-space: normal !important; justify-content: center !important; text-align: center !important; }
  .sp-coin-grid { gap: 8px !important; }
  .sp-coin-grid > * { padding: 10px 6px !important; }
  .sp-song-actions { flex-wrap: wrap !important; gap: 6px !important; }
  .sp-song-actions > * { flex: 1 1 auto !important; min-width: 80px !important; }
  .sp-header-title { font-size: 15px !important; }
  .sp-header-inner { padding: 0 12px !important; }
  .sp-genre-chips { gap: 6px !important; }
  .sp-genre-chips .chip { font-size: 11px !important; padding: 4px 9px !important; }
  .sp-main-pad { padding: 12px !important; }
  .sp-card { padding: 14px !important; }
  .sp-modal-inner { padding: 14px !important; border-radius: 12px !important; }
  .sp-queue-item { padding: 10px 12px !important; }
}'}</style>
    </div>
  )
}
