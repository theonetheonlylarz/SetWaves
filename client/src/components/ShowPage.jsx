import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

const COIN_PRESETS = [5, 10, 25, 50]
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
  const [coins, setCoins] = useState(getStoredCoins)
  const [fanToken, setFanToken] = useState(getStoredFanToken)
  const [fanEmail, setFanEmail] = useState('')
  const [fanBalance, setFanBalance] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
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
    try { const res = await fetch('/api/show/' + slug); if (res.ok) setShow(await res.json()) } catch {}
  }
  useEffect(() => { fetchShow() }, [slug])

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

  useEffect(() => {
    if (!slug) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + slug)
    wsRef.current.onmessage = (evt) => {
      try { const msg = JSON.parse(evt.data); if (msg.type === 'QUEUE_UPDATE' || !msg.type) fetchShow() } catch { fetchShow() }
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
      setFanToken(data.token); setFanEmail(data.fan.email); setFanBalance(data.fan.coinBalance)
      if (coins > 0 && data.fan.coinBalance === 0) {
        const newBal = coins; setFanBalance(newBal); setCoins(0)
        fetch('/api/fan/balance', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
          body: JSON.stringify({ coinBalance: newBal }),
        }).catch(() => {})
      }
      setShowAuthModal(false); setAuthEmail(''); setAuthPassword('')
    } catch (err) { setAuthError(err.message) }
    finally { setAuthLoading(false) }
  }

  const handleFanLogout = () => {
    localStorage.removeItem(FAN_TOKEN_KEY); setFanToken(null); setFanEmail(''); setFanBalance(null)
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
      const res = await fetch('/api/queue/' + slug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, requester: requester.trim() || 'Anonymous', tier, dedication: dedication.trim().slice(0, 60) || undefined })
      })
      const data = await res.json()
      if (res.status === 429) { setError(data.error || "You've reached the limit for this show"); return }
      if (!res.ok) throw new Error(data.error)
      updateCoins(c => c - deductCost)
      if (tier === 'PRIORITY') { const next = jumpsUsed + 1; setJumpsUsed(next); try { localStorage.setItem('nextup_jumps_' + slug, String(next)) } catch {} }
      if (tier === 'PLAY_NEXT') { const next = playNextUsed + 1; setPlayNextUsed(next); try { localStorage.setItem('nextup_playnext_' + slug, String(next)) } catch {} }
      setSelectedSong(''); setCustomSong(''); setDedication('')
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
      const res = await fetch('/api/shoutout/' + slug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: shoutoutMsg.trim(), fromName: shoutoutName.trim() || 'Anonymous' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateCoins(c => c - shoutoutCost); setShoutoutMsg(''); setShoutoutName('')
      setShoutoutSuccess(true); setTimeout(() => setShoutoutSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSendingShoutout(false) }
  }

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
              <input type="email" placeholder="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required autoFocus />
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
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{fanEmail}</span>
              <button onClick={handleFanLogout} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
            </div>
          ) : (
            <button onClick={() => { setShowAuthModal(true); setAuthError('') }}
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Sign in
            </button>
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
      </div>
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '28px 20px 60px' }}>
        {redeeming && (<div style={{ background: 'rgba(0,255,136,0.04)', border: '1.5px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: '14px', textAlign: 'center' }}><p style={{ color: 'var(--neon)', fontWeight: 600, fontSize: '14px' }}>⏳ Confirming your payment...</p></div>)}
        {success && (<div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}><p style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '16px' }}>🎵 Request sent!</p><p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>You're in the queue!</p></div>)}
        {shoutoutSuccess && (<div style={{ background: 'rgba(139,92,246,0.08)', border: '1.5px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}><p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '16px' }}>📣 Shoutout sent!</p><p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>The performer will see your message!</p></div>)}
        {error && <div className="error" style={{ marginBottom: '14px' }}>{error}</div>}

        {buyMode ? (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div><h2 style={{ fontWeight: 800, fontSize: '18px', marginBottom: '3px' }}>Get Coins</h2><p style={{ color: 'var(--muted)', fontSize: '13px' }}>🪙 $1 per coin · no expiry</p></div>
              <button onClick={() => { setBuyMode(false); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {COIN_PRESETS.map(n => (
                <button key={n} onClick={() => buyCoins(n)} disabled={buying}
                  style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 12px', cursor: 'pointer', color: 'var(--text)', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(0,255,136,0.4)'; e.currentTarget.style.background='rgba(0,255,136,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--surface2)'; }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--neon)' }}>🪙 {n}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>${'$'}{n}.00</div>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Custom amount</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" min="1" max="999" placeholder="How many coins?" value={customCoins} onChange={e => setCustomCoins(e.target.value)} onKeyDown={e => e.key === 'Enter' && customCoins && buyCoins(customCoins)} style={{ flex: 1 }} />
                <button onClick={() => buyCoins(customCoins)} className="btn-primary" disabled={!customCoins || buying} style={{ flexShrink: 0, padding: '0 18px', whiteSpace: 'nowrap' }}>
                  {buying ? '...' : (customCoins && parseInt(customCoins) > 0 ? 'Pay $' + parseInt(customCoins) : 'Buy')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {hasEnough ? (
              <div className="card" style={{ marginBottom: '24px', borderColor: 'rgba(0,255,136,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div><h2 style={{ fontWeight: 800, fontSize: '18px' }}>Request a Song</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '3px' }}>
                      <span style={{ color: 'var(--neon)', fontWeight: 700 }}>🎵 {cost}</span>{" · "}
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚡ {jumpCost}</span>{" · "}
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>🔥 {playNextCost}</span>
                    </p>
                  </div>
                  <span style={{ background: 'var(--neon-dim)', color: 'var(--neon)', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,255,136,0.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>🪙 {effectiveCoins} left</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input placeholder="Your name (optional)" value={requester} onChange={e => setRequester(e.target.value)} />
                  {availableGenres.length > 2 && (<div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{availableGenres.map(g => (<button key={g} onClick={() => setGenreFilter(g)} style={{ padding: '4px 11px', fontSize: '12px', fontWeight: 700, borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit', background: genreFilter === g ? 'var(--neon-dim)' : 'var(--surface2)', border: '1px solid ' + (genreFilter === g ? 'rgba(0,255,136,0.3)' : 'var(--border)'), color: genreFilter === g ? 'var(--neon)' : 'var(--muted)', transition: 'all 0.15s' }}>{g}</button>))}</div><button onClick={() => setSortAZ(v => !v)} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginLeft: '6px', background: sortAZ ? 'rgba(139,92,246,0.12)' : 'var(--surface2)', border: '1px solid ' + (sortAZ ? 'rgba(139,92,246,0.4)' : 'var(--border)'), color: sortAZ ? '#a78bfa' : 'var(--muted)', transition: 'all 0.15s' }}>A-Z</button></div></div>)}
                  {filteredSongs.length > 0 && (<select value={selectedSong} onChange={e => { setSelectedSong(e.target.value); setCustomSong('') }}><option value="">Pick from setlist...</option>{filteredSongs.map(s => (<option key={s.id} value={s.title}>{s.title}{s.artist ? ' - ' + s.artist : ''}</option>))}</select>)}
                  <input placeholder={show.songs?.length > 0 ? 'Or type any song...' : 'Song title...'} value={customSong} onChange={e => { setCustomSong(e.target.value); setSelectedSong('') }} />
                  <div style={{ position: 'relative' }}><input placeholder="Dedicate this song to someone? (optional)" value={dedication} onChange={e => setDedication(e.target.value.slice(0, 60))} style={{ paddingRight: '48px' }} />{dedication.length > 0 && (<span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: dedication.length >= 55 ? '#ef4444' : 'var(--muted)', fontWeight: 600, pointerEvents: 'none' }}>{60 - dedication.length}</span>)}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleRequest('STANDARD')} disabled={submitting || !canStandard} style={tierButtonStyle('STANDARD', canStandard && !submitting)}><div style={{ fontSize: '18px', marginBottom: '2px' }}>🎵</div><div style={{ fontSize: '12px' }}>Add to Queue</div><div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>🪙 {cost}</div></button>
                    <button type="button" onClick={() => handleRequest('PRIORITY')} disabled={submitting || !canPriority} style={tierButtonStyle('PRIORITY', canPriority && !submitting)}><div style={{ fontSize: '18px', marginBottom: '2px' }}>⚡</div><div style={{ fontSize: '12px' }}>Move Up</div><div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{jumpsUsed >= maxJumps ? 'Limit reached' : '🪙 ' + jumpCost + ' (' + (maxJumps - jumpsUsed) + ' left)'}</div></button>
                    <button type="button" onClick={() => handleRequest('PLAY_NEXT')} disabled={submitting || !canPlayNext} style={tierButtonStyle('PLAY_NEXT', canPlayNext && !submitting)}><div style={{ fontSize: '18px', marginBottom: '2px' }}>🔥</div><div style={{ fontSize: '12px' }}>Play Next</div><div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{playNextUsed >= maxPlayNext ? 'Limit reached' : '🪙 ' + playNextCost}</div></button>
                  </div>
                  {submitting && (<div style={{ textAlign: 'center', padding: '8px' }}><Spinner /></div>)}
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}><button onClick={() => { setBuyMode(true); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>+ Get more coins</button></div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: '24px', textAlign: 'center', padding: '36px 24px', border: '1.5px dashed var(--border)' }}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>🪙</div>
                <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>{effectiveCoins === 0 ? 'No coins yet' : 'Need ' + (cost - effectiveCoins) + ' more coin' + (cost - effectiveCoins !== 1 ? 's' : '')}</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '22px' }}>{cost === 1 ? 'Get coins to request songs · $1 each' : cost + ' coins needed per request · $1 each'}</p>
                <button onClick={() => { setBuyMode(true); setError('') }} className="btn-primary" style={{ padding: '13px 32px', fontSize: '15px' }}>🪙 Get Coins</button>
              </div>
            )}
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
                {!canShoutout && effectiveCoins < shoutoutCost && (<div style={{ textAlign: 'center' }}><button onClick={() => { setBuyMode(true); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>+ Get more coins</button></div>)}
              </div>
            </div>
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
      <style>{'@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }'}</style>
    </div>
  )
}
