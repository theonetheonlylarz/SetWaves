// Pleasant two-note chime generated via Web Audio API.
// No audio asset needed; works on every modern browser.
// Respects a localStorage mute toggle so the performer can silence it.

const MUTE_KEY = 'nextup_notif_muted'

export function isNotifMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function setNotifMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch {}
}

let audioCtx = null
function getCtx() {
  if (audioCtx) return audioCtx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  audioCtx = new Ctx()
  return audioCtx
}

function blip(freq, startAt, duration) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(ctx.destination)
  const start = ctx.currentTime + startAt
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

export function playRequestChime() {
  if (isNotifMuted()) return
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  // Two ascending notes: E5 -> A5 (classic "ding!" feel)
  blip(659.25, 0, 0.18)
  blip(880, 0.12, 0.22)
}
