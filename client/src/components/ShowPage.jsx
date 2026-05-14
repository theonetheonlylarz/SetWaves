import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const Spinner = () => (
  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--neon)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
)

const COIN_PRESETS = [5, 10, 25, 50]
const COINS_KEY = 'nextup_coins'

function getStoredCoins() {
  try { return Math.max(0, parseInt(localStorage.getItem(COINS_KEY) || '0', 10)) } catch { return 0 }
}
function storeCoins(n) {
  try { localStorage.setItem(COINS_KEY, String(Math.max(0, n))) } catch {}
}

export default function ShowPage() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const [show, setShow] = useState(null)
  const [coins, setCoins] = useState(getStoredCoins)
  const [redeeming, setRedeeming] = useState(false)
  const [requester, setRequester] = useState('')
  const [selectedSong, setSelectedSong] = useState('')
  const [customSong, setCustomSong] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [buyMode, setBuyMode] = useState(false)
  const [customCoins, setCustomCoins] = useState('')
  const [buying, setBuying] = useState(false)
  const [jumpsUsed, setJumpsUsed] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem('nextup_jumps_' + slug) || '0', 10)) } catch { return 0 }
  })
  const wsRef = useRef(null)

  // Keep localStorage in sync
  useEffect(() => { storeCoins(coins) }, [coins])

  const fetchShow = async () => {
    try {
      const res = await fetch('/api/show/' + slug)
      if (res.ok) setShow(await res.json())
    } catch {}
  }

  useEffect(() => { fetchShow() }, [slug])

  // Secure grant redemption after Stripe checkout (?grant=SESSION_ID)
  useEffect(() => {
    const grantId = params.get('grant')
    if (!grantId) return
    setRedeeming(true)
    let attempts = 0
    const tryRedeem = async () => {
      try {
        const res = await fetch('/api/tokens/redeem/' + grantId)
        const data = await res.json()
        if (res.ok) {
          setCoins(c => c + data.tokens)
          setRedeeming(false)
          const next = new URLSearchParams(params)
          next.delete('grant')
          setParams(next, { replace: true })
        } else if (res.status === 409) {
          setRedeeming(false)
          const next = new URLSearchParams(params)
          next.delete('grant')
          setParams(next, { replace: true })
        } else if (res.status === 404 && attempts < 8) {
          attempts++
          setTimeout(tryRedeem, 1500)
        } else {
          setError('Redemption failed — your payment was received. Contact the performer for help.')
          setRedeeming(false)
        }
      } catch {
        if (attempts < 8) { attempts++; setTimeout(tryRedeem, 1500) }
        else { setError('Network error during redemption.'); setRedeeming(false) }
      }
    }
    tryRedeem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // WebSocket via slug — fan page gets live queue updates
  useEffect(() => {
    if (!slug) return
    const wsBase = window.location.origin.replace(/^http/, 'ws')
    wsRef.current = new WebSocket(wsBase + '/ws/' + slug)
    wsRef.current.onmessage = () => fetchShow()
    return () => wsRef.current?.close()
  }, [slug])

  const buyCoins = async (amount) => {
    if (!show?.stripeEnabled) return setError('Payments are not available for this show right now.')
    const n = parseInt(amount, 10)
    if (isNaN(n) || n < 1) return setError('Enter a valid coin amount')
    setBuying(true); setError('')
    try {
      const res = await fetch('/api/stripe/checkout/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins: n })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError(data.error || 'Checkout unavailable right now')
    } catch { setError('Network error') }
    finally { setBuying(false) }
  }

  const handleRequest = async (priority) => {
    const cost = show?.queueCoinCost || 1
    const jumpCost = show?.queueJumpCost || 5
    const deductCost = priority ? jumpCost : cost
    if (coins < deductCost) {
      return setError('You need ' + deductCost + ' coin' + (deductCost !== 1 ? 's' : '') + ' for this option')
    }
    const title = customSong.trim() || selectedSong
    if (!title) return setError('Please select or enter a song')
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/queue/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, requester: requester.trim() || 'Anonymous', priority })
      })
      const data = await res.json()
      if (res.status === 429) {
        setError(data.error || "You've reached the jump limit for this show")
        return
      }
      if (!res.ok) throw new Error(data.error)
      setCoins(c => c - deductCost)
      if (priority) {
        const next = jumpsUsed + 1
        setJumpsUsed(next)
        try { localStorage.setItem('nextup_jumps_' + slug, String(next)) } catch {}
      }
      setSelectedSong(''); setCustomSong('')
      setSuccess(true); setTimeout(() => setSuccess(false), 5000)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  if (!show) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg)' }}>
      <Spinner />
      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading show...</p>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )

  const cost = show.queueCoinCost || 1
  const jumpCost = show.queueJumpCost || 5
  const maxJumps = show.maxJumpsPerSession || 2
  const hasEnough = coins >= cost
  const hasEnoughForJump = coins >= jumpCost
  const jumpLimitReached = jumpsUsed >= maxJumps
  const liveQueue = show.queue || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Hero */}
      <div style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -5%, rgba(0,255,136,0.1) 0%, transparent 65%)', borderBottom: '1px solid var(--border)', padding: '48px 20px 36px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '16px', padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px' }}>
          <div style={{ width: '18px', height: '18px', background: 'var(--neon)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>🎵</div>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Next Up</span>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px', lineHeight: '1.1', margin: '0 auto 16px', maxWidth: '480px' }}>
          {show.displayName}
        </h1>
        {/* Coin balance pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: coins > 0 ? 'rgba(0,255,136,0.08)' : 'var(--surface)', border: '1.5px solid ' + (coins > 0 ? 'rgba(0,255,136,0.3)' : 'var(--border)'), borderRadius: '24px', padding: '8px 18px', fontSize: '14px', fontWeight: 700, color: coins > 0 ? 'var(--neon)' : 'var(--muted)', transition: 'all 0.3s ease' }}>
          {redeeming ? '⏳ Adding coins...' : '🪙 ' + coins + ' coin' + (coins !== 1 ? 's' : '')}
        </div>
      </div>

      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Alerts */}
        {redeeming && (
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1.5px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 18px', marginBottom: '14px', textAlign: 'center' }}>
            <p style={{ color: 'var(--neon)', fontWeight: 600, fontSize: '14px' }}>⏳ Confirming your payment...</p>
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1.5px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            <p style={{ color: 'var(--neon)', fontWeight: 700, fontSize: '16px' }}>🎵 Request sent!</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>You're in the queue!</p>
          </div>
        )}
        {error && <div className="error" style={{ marginBottom: '14px' }}>{error}</div>}

        {/* BUY COINS PANEL */}
        {buyMode ? (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '18px', marginBottom: '3px' }}>Get Coins</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>🪙 $1 per coin · no expiry</p>
              </div>
              <button onClick={() => { setBuyMode(false); setError('') }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>×</button>
            </div>

            {/* Preset grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {COIN_PRESETS.map(amt => (
                <button key={amt} onClick={() => buyCoins(amt)} disabled={buying}
                  style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 12px', cursor: 'pointer', color: 'var(--text)', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(0,255,136,0.4)'; e.currentTarget.style.background='rgba(0,255,136,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--surface2)'; }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--neon)' }}>🪙 {amt}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{'$' + amt + '.00'}</div>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Custom amount</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" min="1" max="999" placeholder="How many coins?" value={customCoins}
                  onChange={e => setCustomCoins(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && customCoins && buyCoins(customCoins)}
                  style={{ flex: 1 }} />
                <button onClick={() => buyCoins(customCoins)} className="btn-primary"
                  disabled={!customCoins || buying} style={{ flexShrink: 0, padding: '0 18px', whiteSpace: 'nowrap' }}>
                  {buying ? '...' : (customCoins && parseInt(customCoins) > 0 ? 'Pay $' + parseInt(customCoins) : 'Buy')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* REQUEST FORM or GET COINS CTA */}
            {hasEnough ? (
              <div className="card" style={{ marginBottom: '24px', borderColor: 'rgba(0,255,136,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: '18px' }}>Request a Song</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '3px' }}>
                      Standard: <span style={{ color: 'var(--neon)', fontWeight: 700 }}>🪙 {cost}</span>
                      {' · '}
                      Jump: <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚡ {jumpCost}</span>
                    </p>
                  </div>
                  <span style={{ background: 'var(--neon-dim)', color: 'var(--neon)', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,255,136,0.2)', whiteSpace: 'nowrap' }}>
                    🪙 {coins} left
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input placeholder="Your name (optional)" value={requester} onChange={e => setRequester(e.target.value)} />
                  {show.songs?.length > 0 && (
                    <select value={selectedSong} onChange={e => { setSelectedSong(e.target.value); setCustomSong('') }}>
                      <option value="">Pick from setlist...</option>
                      {show.songs.map(s => (
                        <option key={s.id} value={s.title}>{s.title}{s.artist ? ' — ' + s.artist : ''}</option>
                      ))}
                    </select>
                  )}
                  <input placeholder={show.songs?.length > 0 ? 'Or type any song...' : 'Song title...'}
                    value={customSong} onChange={e => { setCustomSong(e.target.value); setSelectedSong('') }} />

                  {/* Two action buttons */}
                  <button
                    type="button"
                    onClick={() => handleRequest(false)}
                    disabled={submitting}
                    className="btn-primary"
                    style={{ padding: '13px', fontSize: '15px', borderRadius: '10px' }}
                  >
                    {submitting ? 'Sending...' : '🎵 Add to Queue · 🪙 ' + cost + ' coin' + (cost !== 1 ? 's' : '')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequest(true)}
                    disabled={submitting || !hasEnoughForJump || jumpLimitReached}
                    style={{
                      padding: '13px',
                      fontSize: '15px',
                      borderRadius: '10px',
                      background: (hasEnoughForJump && !jumpLimitReached) ? 'rgba(245,158,11,0.12)' : 'var(--surface2)',
                      border: '1.5px solid ' + ((hasEnoughForJump && !jumpLimitReached) ? 'rgba(245,158,11,0.4)' : 'var(--border)'),
                      color: (hasEnoughForJump && !jumpLimitReached) ? '#f59e0b' : 'var(--muted)',
                      fontWeight: 700,
                      cursor: (hasEnoughForJump && !jumpLimitReached) ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {submitting ? '...' : jumpLimitReached
                      ? '⚡ Jump limit reached (' + maxJumps + '/' + maxJumps + ')'
                      : hasEnoughForJump
                        ? '⚡ Jump to Front · 🪙 ' + jumpCost + ' (max ' + maxJumps + '/session)'
                        : '⚡ Jump to Front · Need ' + (jumpCost - coins) + ' more coin' + (jumpCost - coins !== 1 ? 's' : '')}
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button onClick={() => { setBuyMode(true); setError('') }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                    + Get more coins
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: '24px', textAlign: 'center', padding: '36px 24px', border: '1.5px dashed var(--border)' }}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>🪙</div>
                <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>
                  {coins === 0 ? 'No coins yet' : 'Need ' + (cost - coins) + ' more coin' + (cost - coins !== 1 ? 's' : '')}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '22px' }}>
                  {cost === 1 ? 'Get coins to request songs · $1 each' : cost + ' coins needed per request · $1 each'}
                </p>
                <button onClick={() => { setBuyMode(true); setError('') }} className="btn-primary"
                  style={{ padding: '13px 32px', fontSize: '15px' }}>
                  🪙 Get Coins
                </button>
              </div>
            )}
          </>
        )}

        {/* LIVE QUEUE */}
        {liveQueue.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h2 style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-secondary)' }}>🎶 Up Next</h2>
              <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', padding: '2px 8px' }}>{liveQueue.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {liveQueue.slice(0, 8).map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid ' + (item.priority ? 'rgba(245,158,11,0.3)' : 'var(--border)'), borderRadius: 'var(--radius-md)', opacity: i === 0 ? 1 : 0.65 }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.songTitle}</p>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '1px' }}>{item.requester}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    {item.priority && (
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)', whiteSpace: 'nowrap' }}>⚡ Priority</span>
                    )}
                    {i === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--neon)', fontWeight: 700, background: 'var(--neon-dim)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.15)', whiteSpace: 'nowrap' }}>Playing soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }'}</style>
    </div>
  )
}
