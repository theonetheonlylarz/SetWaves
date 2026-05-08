const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PACKAGES = [
  { id: 'starter', name: 'Starter', tokens: 5, price: 500 },
  { id: 'fan', name: 'Fan Pack', tokens: 12, price: 1000 },
  { id: 'superfan', name: 'Superfan', tokens: 30, price: 2000 }
];

router.get('/packages', (req, res) => res.json(PACKAGES));

router.post('/session', async (req, res) => {
  try {
    const { packageId, showSlug } = req.body;
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });
    const base = process.env.CLIENT_URL || 'https://setwaves-production.up.railway.app';
    const performer = await prisma.user.findUnique({ where: { slug: showSlug } });
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: pkg.name + ' - ' + pkg.tokens + ' Tokens' }, unit_amount: pkg.price }, quantity: 1 }],
      mode: 'payment',
      success_url: base + '/show/' + showSlug + '?success=true&tokens=' + pkg.tokens,
      cancel_url: base + '/show/' + showSlug,
      metadata: { packageId, tokens: String(pkg.tokens), showSlug }
    };
    if (performer?.stripeAccountId && performer?.stripeOnboarded) {
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.floor(pkg.price * 0.10),
        transfer_data: { destination: performer.stripeAccountId }
      };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
