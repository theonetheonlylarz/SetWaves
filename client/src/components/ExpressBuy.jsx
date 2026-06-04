import React, { useEffect, useState, useMemo } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js'

// Cache the Stripe.js loader keyed on the publishable key so we never load it twice.
const stripePromiseCache = new Map()
function getStripePromise(publishableKey) {
  if (!publishableKey) return null
  if (!stripePromiseCache.has(publishableKey)) {
    stripePromiseCache.set(publishableKey, loadStripe(publishableKey))
  }
  return stripePromiseCache.get(publishableKey)
}

// Quick-pick amounts shown above the Apple Pay button
const QUICK_AMOUNTS = [1, 5, 10, 25]

function ExpressForm({ slug, coins, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [supportsExpress, setSupportsExpress] = useState(null)

  if (!stripe || !elements) {
    return <div style={{ height: '46px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '12px' }}>Loading express checkout…</div>
  }

  const handleConfirm = async (event) => {
    try {
      // Create the PaymentIntent now that we know an express method was tapped
      const res = await fetch('/api/stripe/payment-intent/' + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins }),
      })
      const data = await res.json()
      if (!res.ok || !data.clientSecret) {
        onError && onError(data.error || 'Could not start payment')
        return
      }
      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: window.location.origin + '/show/' + slug,
        },
        redirect: 'if_required',
      })
      if (confirmError) {
        onError && onError(confirmError.message || 'Payment failed')
        return
      }
      // Verify + grant coins immediately (don't wait for webhook)
      const verifyRes = await fetch('/api/stripe/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: data.paymentIntentId }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        onError && onError(verifyData.error || 'Could not verify payment')
        return
      }
      onSuccess && onSuccess({ coins: verifyData.tokens, sessionId: verifyData.sessionId })
    } catch (e) {
      onError && onError(e.message || 'Payment failed')
    }
  }

  return (
    <>
      <ExpressCheckoutElement
        onReady={(e) => { setReady(true); setSupportsExpress(Boolean(e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean))) }}
        onConfirm={handleConfirm}
        options={{ buttonHeight: 46, paymentMethods: { applePay: 'always', googlePay: 'always', link: 'auto' } }}
      />
      {ready && supportsExpress === false && (
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'center' }}>
          Apple Pay / Google Pay not available on this browser. Scroll down to buy with a card.
        </p>
      )}
    </>
  )
}

export default function ExpressBuy({ slug, publishableKey, onSuccess, onError }) {
  const [coins, setCoins] = useState(1)
  const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey])

  if (!publishableKey || !stripePromise) return null

  const amountCents = coins * 100

  return (
    <div style={{
      background: 'rgba(0,255,136,0.04)',
      border: '1px solid rgba(0,255,136,0.18)',
      borderRadius: '12px',
      padding: '14px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neon)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          ⚡ One-tap buy
        </p>
        <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
          ${coins}.00 = 🪙 {coins} coin{coins === 1 ? '' : 's'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
        {QUICK_AMOUNTS.map(n => (
          <button key={n} onClick={() => setCoins(n)}
            style={{
              padding: '8px 4px', minHeight: '36px', borderRadius: '8px',
              background: coins === n ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (coins === n ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.08)'),
              color: coins === n ? '#00ff88' : '#e8e8f5',
              fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            }}>
            ${n}
          </button>
        ))}
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          mode: 'payment',
          amount: amountCents,
          currency: 'usd',
          appearance: { theme: 'night', variables: { colorPrimary: '#00ff88', colorBackground: '#0f0f1a', colorText: '#e8e8f5', borderRadius: '8px' } },
        }}
        key={amountCents}
      >
        <ExpressForm slug={slug} coins={coins} onSuccess={onSuccess} onError={onError} />
      </Elements>
    </div>
  )
}
