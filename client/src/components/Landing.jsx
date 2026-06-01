import React from 'react'
import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🎵',
    title: 'Fans request, you earn',
    body: 'They scan your QR code, buy coins, and pay to add songs, move up the queue, or play next.',
  },
  {
    icon: '⚡',
    title: 'Live queue, no chaos',
    body: 'Priority requests rise to the top automatically. Approve or deny anything you don\'t want to play.',
  },
  {
    icon: '💰',
    title: 'Keep 90% — instant payouts',
    body: 'Connect Stripe once. Every coin spent at your show is yours. Cash out any time, straight to your bank.',
  },
]

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#080810', color: '#e8e8f5' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lpFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .lp-fade { animation: lpFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .lp-hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,255,136,0.13) 0%, transparent 60%);
        }
        .lp-cta-primary:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 32px rgba(0,255,136,0.35); }
        .lp-cta-ghost:hover { border-color: rgba(255,255,255,0.25); color: #e8e8f5; }
        .lp-feature:hover { border-color: rgba(0,255,136,0.25); }
        @media (max-width: 600px) {
          .lp-hero h1 { font-size: 38px !important; line-height: 1.05 !important; }
          .lp-hero p { font-size: 15px !important; }
          .lp-features { grid-template-columns: 1fr !important; }
          .lp-cta-row { flex-direction: column !important; }
          .lp-cta-row > * { width: 100% !important; }
        }
      ` }} />

      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,8,16,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: '#00ff88', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
              boxShadow: '0 2px 12px rgba(0,255,136,0.35)', color: '#000',
            }}>🎵</div>
            <span style={{
              fontWeight: 900, fontSize: '18px', letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #fff 0%, #00ff88 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Next Up</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link to="/login" style={{
              color: '#9898b0', textDecoration: 'none', padding: '8px 14px',
              fontSize: '14px', fontWeight: 600, borderRadius: '8px',
            }}>Sign in</Link>
            <Link to="/signup" className="lp-cta-primary" style={{
              background: '#00ff88', color: '#000', textDecoration: 'none', padding: '8px 16px',
              fontSize: '14px', fontWeight: 800, borderRadius: '8px', transition: 'all 0.15s',
            }}>Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero-glow">
        <div className="lp-hero lp-fade" style={{
          maxWidth: '780px', margin: '0 auto', padding: '80px 20px 60px', textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)',
            borderRadius: '999px', padding: '5px 14px', marginBottom: '24px',
            fontSize: '12px', fontWeight: 700, color: '#00ff88', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span>🎤</span> For live performers
          </div>
          <h1 style={{
            fontSize: '56px', fontWeight: 900, letterSpacing: '-0.04em',
            lineHeight: '1.05', marginBottom: '20px',
            background: 'linear-gradient(180deg, #ffffff 0%, #b8b8d4 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Get paid for every song request.
          </h1>
          <p style={{
            fontSize: '17px', color: '#9898b0', lineHeight: 1.55, marginBottom: '32px',
            maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto',
          }}>
            Next Up is a digital tip jar and song-request queue for bar musicians, wedding bands, DJs,
            and piano bar artists. Fans scan your QR, buy coins, and pay to hear what they want.
          </p>
          <div className="lp-cta-row" style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', marginBottom: '14px' }}>
            <Link to="/signup" className="lp-cta-primary" style={{
              background: '#00ff88', color: '#000', textDecoration: 'none',
              padding: '14px 28px', fontSize: '15px', fontWeight: 800, borderRadius: '10px',
              transition: 'all 0.18s', display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}>
              Start free — no credit card
              <span style={{ fontSize: '18px' }}>→</span>
            </Link>
            <Link to="/login" className="lp-cta-ghost" style={{
              border: '1px solid rgba(255,255,255,0.12)', color: '#9898b0',
              textDecoration: 'none', padding: '14px 24px', fontSize: '15px',
              fontWeight: 700, borderRadius: '10px', transition: 'all 0.15s',
            }}>I have an account</Link>
          </div>
          <p style={{ fontSize: '12px', color: '#56566e' }}>
            Free to set up · You keep 90% · Cash out any time
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '1080px', margin: '0 auto', padding: '20px 20px 80px' }}>
        <div className="lp-features" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
        }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="lp-feature lp-fade" style={{
              background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '24px',
              animationDelay: (0.1 + i * 0.07) + 's', transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '14px', color: '#9898b0', lineHeight: 1.55 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#00ff88', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            How it works
          </p>
          <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '36px', lineHeight: 1.15 }}>
            Set up in five minutes. Earn from your next gig.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            {[
              ['Sign up & name your show', 'Free account. Pick a stage name and you get a personalized show link + QR code.'],
              ['Build your setlist', 'Import from Spotify, paste a list, upload a CSV, or pick a starter template.'],
              ['Connect Stripe for payouts', 'Free, takes 2 minutes. Your 90% lands in your bank.'],
              ['Display your QR at the show', 'Fans scan, buy coins, and start requesting. You approve from the inbox.'],
            ].map(([title, body], i) => (
              <div key={title} style={{
                display: 'flex', gap: '16px', alignItems: 'flex-start',
                background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px', padding: '18px 20px',
              }}>
                <div style={{
                  flexShrink: 0, width: '32px', height: '32px',
                  background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#00ff88', fontWeight: 800, fontSize: '14px',
                }}>{i + 1}</div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, marginBottom: '3px' }}>{title}</p>
                  <p style={{ fontSize: '13px', color: '#9898b0', lineHeight: 1.5 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ maxWidth: '780px', margin: '0 auto', padding: '70px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '12px', lineHeight: 1.2 }}>
          Your next show pays for itself.
        </h2>
        <p style={{ fontSize: '15px', color: '#9898b0', marginBottom: '28px', lineHeight: 1.55 }}>
          No setup fees. No monthly subscription. You keep 90% of every coin spent at your show.
        </p>
        <Link to="/signup" className="lp-cta-primary" style={{
          background: '#00ff88', color: '#000', textDecoration: 'none',
          padding: '15px 32px', fontSize: '16px', fontWeight: 800, borderRadius: '10px',
          display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.18s',
        }}>
          Create your show
          <span style={{ fontSize: '18px' }}>→</span>
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 20px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '12px', color: '#56566e' }}>
          © {new Date().getFullYear()} Next Up · Built for live performers
        </p>
      </footer>
    </div>
  )
}
