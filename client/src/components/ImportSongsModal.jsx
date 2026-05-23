import React, { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { parseSongList } from '../utils/parseSongList'
import templates from '../data/setlistTemplates.json'

class ModalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('ImportSongsModal crashed:', err, info) }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }} onClick={this.props.onClose}>
          <div style={{
            background: '#0f0f1a', color: '#e8e8f5', border: '1px solid rgba(255,91,91,0.4)',
            borderRadius: '12px', padding: '24px', maxWidth: '420px', textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚠️</div>
            <p style={{ fontWeight: 700, marginBottom: '8px' }}>The import dialog hit an error</p>
            <p style={{ fontSize: '12px', color: '#9898b0', marginBottom: '14px', wordBreak: 'break-word' }}>
              {String(this.state.err && this.state.err.message || this.state.err)}
            </p>
            <button onClick={this.props.onClose} style={{
              background: '#00ff88', color: '#000', border: 'none', borderRadius: '8px',
              padding: '10px 20px', fontWeight: 800, cursor: 'pointer',
            }}>Close</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'Jazz', 'Electronic', 'Latin', 'Indie', 'Other']

const SOURCE_TABS = [
  { id: 'paste',    label: 'Paste a list' },
  { id: 'spotify',  label: 'Spotify playlist' },
  { id: 'file',     label: 'Upload file' },
  { id: 'template', label: 'Quick-start' },
]

const dupeKey = (title, artist) =>
  (title || '').toLowerCase().trim() + '||' + (artist || '').toLowerCase().trim()

export default function ImportSongsModal(props) {
  if (!props.open) return null
  return createPortal(
    <ModalErrorBoundary onClose={props.onClose}>
      <ImportSongsModalInner {...props} />
    </ModalErrorBoundary>,
    document.body,
  )
}

function ImportSongsModalInner({ open, onClose, existingSongs, token, onImported }) {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState('paste')
  const [pasteText, setPasteText] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [parsed, setParsed] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bulkGenre, setBulkGenre] = useState('Other')
  const [successCount, setSuccessCount] = useState(null)
  const fileInputRef = useRef(null)

  const existingKeys = useMemo(() => {
    const set = new Set()
    for (const s of existingSongs || []) set.add(dupeKey(s.title, s.artist))
    return set
  }, [existingSongs])

  if (!open) return null

  const reset = () => {
    setStep(1); setSource('paste'); setPasteText(''); setSpotifyUrl('')
    setParsed([]); setError(''); setBulkGenre('Other'); setSuccessCount(null)
  }
  const close = () => { reset(); onClose && onClose() }

  const goPreview = (rows) => {
    if (!rows || rows.length === 0) {
      setError('No songs found. Check your input and try again.')
      return
    }
    setError('')
    setParsed(rows.map(r => {
      const title = (r.title || '').trim()
      const artist = (r.artist || '').trim()
      return {
        title, artist,
        genre: r.genre || 'Other',
        include: true,
        isDuplicate: existingKeys.has(dupeKey(title, artist)),
      }
    }).filter(r => r.title))
    setStep(2)
  }

  const handlePasteContinue = () => goPreview(parseSongList(pasteText))

  const handleSpotifyContinue = async () => {
    if (!spotifyUrl.trim()) { setError('Paste a Spotify playlist link'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/songs/import/spotify', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: spotifyUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Spotify import failed')
      goPreview(data.tracks || [])
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const text = await file.text()
      const Papa = (await import('papaparse')).default
      const parsedCsv = Papa.parse(text, { header: true, skipEmptyLines: true })
      let rows = []
      const fields = (parsedCsv.meta && parsedCsv.meta.fields) || []
      if (fields.length > 1 && Array.isArray(parsedCsv.data) && parsedCsv.data.length) {
        const lower = fields.map(f => (f || '').toLowerCase().trim())
        const titleKey = fields[lower.findIndex(f => /title|song|track|name/.test(f))]
        const artistKey = fields[lower.findIndex(f => /artist|by/.test(f))]
        const genreKey = fields[lower.findIndex(f => /genre|category/.test(f))]
        if (titleKey) {
          rows = parsedCsv.data
            .map(row => ({
              title: (row[titleKey] || '').toString(),
              artist: artistKey ? (row[artistKey] || '').toString() : '',
              genre: genreKey ? (row[genreKey] || 'Other').toString() : 'Other',
            }))
            .filter(r => r.title.trim())
        }
      }
      if (rows.length === 0) rows = parseSongList(text)
      goPreview(rows)
    } catch (e) { setError('Could not read file: ' + e.message) }
    finally { setBusy(false) }
  }

  const updateRow = (i, patch) => {
    setParsed(prev => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      if (patch.title !== undefined || patch.artist !== undefined) {
        next[i].isDuplicate = existingKeys.has(dupeKey(next[i].title, next[i].artist))
      }
      return next
    })
  }

  const applyGenreToAll = () => setParsed(prev => prev.map(p => ({ ...p, genre: bulkGenre })))
  const uncheckDuplicates = () => setParsed(prev => prev.map(p => p.isDuplicate ? { ...p, include: false } : p))

  const handleImport = async () => {
    const toImport = parsed.filter(p => p.include && p.title.trim())
    if (toImport.length === 0) { setError('No songs selected to import'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/songs/bulk', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songs: toImport.map(p => ({ title: p.title.trim(), artist: p.artist.trim(), genre: p.genre })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setSuccessCount(data.count || toImport.length)
      onImported && onImported(data.count || toImport.length)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const stats = useMemo(() => {
    const total = parsed.length
    const included = parsed.filter(p => p.include).length
    const dupes = parsed.filter(p => p.isDuplicate && p.include).length
    return { total, included, dupes, excluded: total - included }
  }, [parsed])

  // ---------- styles (consistent with Dashboard) ----------
  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.78)',
    WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
    zIndex: 2000, display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '16px',
    overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  }
  const panelStyle = {
    background: '#0f0f1a', color: '#e8e8f5',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
    width: '100%', maxWidth: '720px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 30px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
    position: 'relative',
  }
  const headerStyle = {
    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  }
  const bodyStyle = { padding: '20px', overflowY: 'auto', flex: '1 1 auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }
  const footerStyle = {
    padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(0,0,0,0.25)', flexShrink: 0,
  }

  // ---------- success state ----------
  if (successCount !== null) {
    return (
      <div style={overlayStyle} onClick={close}>
        <div style={panelStyle} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', marginBottom: '14px' }}>🎉</div>
            <p style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
              {successCount} song{successCount === 1 ? '' : 's'} added to your setlist
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
              Fans can now request them from your show page.
            </p>
            <button onClick={close} className="btn-primary">Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} onClick={close}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Import Songs</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {step === 1 ? 'Pick how you want to add songs' : 'Review and edit before importing'}
            </div>
          </div>
          <button onClick={close} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>Close</button>
        </div>

        <div style={bodyStyle}>
          {error && <div className="error" style={{ marginBottom: '14px' }}>{error}</div>}

          {step === 1 && (
            <>
              <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', background: 'var(--surface2)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {SOURCE_TABS.map(t => (
                  <button key={t.id} onClick={() => { setSource(t.id); setError('') }}
                    style={{
                      flex: '1 1 auto', minWidth: '90px', padding: '8px 10px', borderRadius: '8px',
                      background: source === t.id ? 'var(--surface)' : 'transparent',
                      color: source === t.id ? 'var(--text)' : 'var(--muted)',
                      fontSize: '12px', fontWeight: 600,
                      border: source === t.id ? '1px solid var(--border)' : '1px solid transparent',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>{t.label}</button>
                ))}
              </div>

              {source === 'paste' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                    Paste your setlist below — one song per line. We'll split title and artist automatically.
                  </p>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`Wonderwall - Oasis
Hotel California - Eagles
Piano Man by Billy Joel
Free Bird`}
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder="Paste your songs here…"
                    rows={10}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </div>
              )}

              {source === 'spotify' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
                    Paste a public Spotify playlist link. In Spotify: ⋯ → Share → Copy link to playlist.
                  </p>
                  <input
                    value={spotifyUrl}
                    onChange={e => setSpotifyUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/…"
                    style={{ width: '100%' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                    Playlist must be public. Private or collaborative playlists won't work.
                  </p>
                </div>
              )}

              {source === 'file' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
                    Upload a .csv, .tsv, or .txt file. CSV columns are auto-detected (Title, Artist, Genre).
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={e => handleFile(e.target.files && e.target.files[0])}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {source === 'template' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                    Pick a starter setlist. You can edit or remove songs in the next step.
                  </p>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {templates.map(tpl => (
                      <button
                        key={tpl.name}
                        onClick={() => goPreview(tpl.songs)}
                        style={{
                          textAlign: 'left', background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', color: 'var(--text)',
                        }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{tpl.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          {tpl.description} · {tpl.songs.length} songs
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '14px', fontSize: '12px', color: 'var(--muted)' }}>
                <span><strong style={{ color: 'var(--text)' }}>{stats.included}</strong> ready</span>
                {stats.dupes > 0 && (
                  <span style={{ color: '#f59e0b' }}>
                    <strong>{stats.dupes}</strong> duplicate{stats.dupes === 1 ? '' : 's'}{' '}
                    <button onClick={uncheckDuplicates}
                      style={{ background: 'transparent', border: 'none', color: '#f59e0b', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
                      uncheck all
                    </button>
                  </span>
                )}
                {stats.excluded > 0 && <span>{stats.excluded} excluded</span>}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>Apply genre:</span>
                  <select value={bulkGenre} onChange={e => setBulkGenre(e.target.value)} style={{ padding: '4px 6px', fontSize: '12px' }}>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button onClick={applyGenreToAll} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>Apply to all</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {parsed.map((row, i) => (
                  <div key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 1fr 1fr 120px 28px',
                      gap: '6px', alignItems: 'center',
                      background: row.isDuplicate ? 'rgba(245,158,11,0.06)' : 'var(--surface2)',
                      border: '1px solid ' + (row.isDuplicate ? 'rgba(245,158,11,0.3)' : 'var(--border)'),
                      borderRadius: '8px', padding: '6px 8px',
                      opacity: row.include ? 1 : 0.45,
                    }}>
                    <input type="checkbox" checked={row.include}
                      onChange={e => updateRow(i, { include: e.target.checked })} />
                    <input value={row.title} placeholder="Title"
                      onChange={e => updateRow(i, { title: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: '13px' }} />
                    <input value={row.artist} placeholder="Artist"
                      onChange={e => updateRow(i, { artist: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: '13px' }} />
                    <select value={row.genre}
                      onChange={e => updateRow(i, { genre: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: '12px' }}>
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <span title={row.isDuplicate ? 'Already in your setlist' : ''}
                      style={{ textAlign: 'center', fontSize: '14px' }}>
                      {row.isDuplicate ? '⚠️' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={footerStyle}>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {step === 2 ? `Step 2 of 2 — Preview` : `Step 1 of 2 — Source`}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="btn-secondary" disabled={busy}>Back</button>
            )}
            {step === 1 && source === 'paste' && (
              <button onClick={handlePasteContinue} className="btn-primary" disabled={busy || !pasteText.trim()}>Continue</button>
            )}
            {step === 1 && source === 'spotify' && (
              <button onClick={handleSpotifyContinue} className="btn-primary" disabled={busy || !spotifyUrl.trim()}>
                {busy ? 'Fetching…' : 'Continue'}
              </button>
            )}
            {step === 1 && source === 'file' && busy && (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Parsing file…</span>
            )}
            {step === 2 && (
              <button onClick={handleImport} className="btn-primary" disabled={busy || stats.included === 0}>
                {busy ? 'Importing…' : `Import ${stats.included} song${stats.included === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
