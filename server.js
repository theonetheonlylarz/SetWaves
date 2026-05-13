require('dotenv').config();
const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
expressWs(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'setwaves-secret-key-change-in-production';
const CLIENT_URL = process.env.CLIENT_URL || process.env.APP_URL || ('http://localhost:' + PORT);

let stripeInstance = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripeInstance = Stripe(process.env.STRIPE_SECRET_KEY);
}

// STRIPE WEBHOOK (must be before express.json)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(400).send('Webhook secret not configured');
  let event;
  try {
    event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { slug, coins } = session.metadata || {};
    if (slug && coins) {
      try {
        await prisma.tokenGrant.upsert({
          where: { stripeSessionId: session.id },
          update: {},
          create: { stripeSessionId: session.id, tokens: parseInt(coins, 10), slug },
        });
        console.log('Coin grant: ' + coins + ' coins for show ' + slug);
      } catch (e) { console.error('Coin grant error:', e.message); }
    }
  }
  res.json({ received: true });
});

app.use(cors());
app.use(express.json());

const wsClients = {};
function broadcast(key, msg) {
  if (wsClients[key]) {
    wsClients[key].forEach(ws => {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    });
  }
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

app.post('/api/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const slug = base + '-' + Math.random().toString(36).slice(2, 7);
  try {
    const user = await prisma.user.create({
      data: { email, password: hashed, slug, displayName: displayName || base }
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, slug: user.slug, displayName: user.displayName } });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, slug: user.slug, displayName: user.displayName, stripeOnboarded: user.stripeOnboarded } });
});

app.post('/api/forgot-password', async (req, res) => {
  if (!req.body.email) return res.status(400).json({ error: 'Email required' });
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

app.get('/api/profile', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: user.id,
    email: user.email,
    slug: user.slug,
    displayName: user.displayName,
    stripeOnboarded: user.stripeOnboarded,
    queueCoinCost: user.queueCoinCost,
    queueJumpCost: user.queueJumpCost,
  });
});

app.put('/api/profile', auth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { displayName: req.body.displayName } });
  res.json({ id: user.id, email: user.email, slug: user.slug, displayName: user.displayName });
});

app.put('/api/pricing', auth, async (req, res) => {
  const cost = parseInt(req.body.queueCoinCost, 10);
  const jumpCost = parseInt(req.body.queueJumpCost, 10);
  const data = {};
  if (!isNaN(cost)) {
    if (cost < 1 || cost > 100) return res.status(400).json({ error: 'Coin cost must be between 1 and 100' });
    data.queueCoinCost = cost;
  }
  if (!isNaN(jumpCost)) {
    if (jumpCost < 1 || jumpCost > 100) return res.status(400).json({ error: 'Jump cost must be between 1 and 100' });
    data.queueJumpCost = jumpCost;
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid pricing provided' });
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ queueCoinCost: user.queueCoinCost, queueJumpCost: user.queueJumpCost });
});

app.get('/api/songs', auth, async (req, res) => {
  res.json(await prisma.song.findMany({ where: { userId: req.userId }, orderBy: { order: 'asc' } }));
});

app.post('/api/songs', auth, async (req, res) => {
  const { title, artist } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const count = await prisma.song.count({ where: { userId: req.userId } });
  res.json(await prisma.song.create({ data: { title, artist: artist || '', userId: req.userId, order: count } }));
});

app.delete('/api/songs/:id', auth, async (req, res) => {
  await prisma.song.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.json({ success: true });
});

app.patch('/api/songs/:id', auth, async (req, res) => {
  const { active, order } = req.body;
  const data = {};
  if (active !== undefined) data.active = active;
  if (order !== undefined) data.order = order;
  await prisma.song.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  res.json({ success: true });
});

app.get('/api/queue', auth, async (req, res) => {
  res.json(await prisma.queueItem.findMany({
    where: { userId: req.userId, played: false },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  }));
});

app.put('/api/queue/:id/played', auth, async (req, res) => {
  await prisma.queueItem.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { played: true } });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  broadcast(req.userId, { type: 'QUEUE_UPDATE' });
  if (user) broadcast(user.slug, { type: 'QUEUE_UPDATE' });
  res.json({ success: true });
});

app.delete('/api/queue/:id', auth, async (req, res) => {
  await prisma.queueItem.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  broadcast(req.userId, { type: 'QUEUE_UPDATE' });
  if (user) broadcast(user.slug, { type: 'QUEUE_UPDATE' });
  res.json({ success: true });
});

app.get('/api/show/:slug', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { slug: req.params.slug },
      include: {
        songs: { where: { active: true }, orderBy: { order: 'asc' } },
        queue: {
          where: { played: false },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        },
      }
    });
    if (!user) return res.status(404).json({ error: 'Performer not found' });
    res.json({
      displayName: user.displayName,
      slug: user.slug,
      songs: user.songs,
      queue: user.queue,
      queueCoinCost: user.queueCoinCost,
      queueJumpCost: user.queueJumpCost,
      stripeOnboarded: user.stripeOnboarded,
      stripeEnabled: !!stripeInstance,
    });
  } catch (e) {
    console.error('Show error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/queue/:slug', async (req, res) => {
  const { songTitle, requester, priority } = req.body;
  if (!songTitle) return res.status(400).json({ error: 'Song title required' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const isPriority = !!priority;
  const tokenCost = isPriority ? user.queueJumpCost : user.queueCoinCost;
  const item = await prisma.queueItem.create({
    data: {
      songTitle,
      requester: requester || 'Anonymous',
      tier: isPriority ? 'PRIORITY' : 'STANDARD',
      tokens: tokenCost,
      priority: isPriority,
      userId: user.id,
    }
  });
  broadcast(user.id, { type: 'QUEUE_UPDATE' });
  broadcast(user.slug, { type: 'QUEUE_UPDATE' });
  res.json(item);
});

app.get('/api/qrcode', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const url = CLIENT_URL + '/show/' + user.slug;
  const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qrCode, url });
});

app.post('/api/stripe/connect', auth, async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  try {
    const account = await stripeInstance.accounts.create({ type: 'express' });
    await prisma.user.update({ where: { id: req.userId }, data: { stripeAccountId: account.id } });
    const link = await stripeInstance.accountLinks.create({
      account: account.id,
      refresh_url: CLIENT_URL + '/dashboard?stripe=refresh',
      return_url: CLIENT_URL + '/dashboard?stripe=success',
      type: 'account_onboarding'
    });
    res.json({ url: link.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stripe/checkout/:slug', async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const coins = parseInt(req.body.coins, 10);
  if (isNaN(coins) || coins < 1 || coins > 999)
    return res.status(400).json({ error: 'Coin amount must be 1-999' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const amountCents = coins * 100;
  try {
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: coins + ' Coin' + (coins !== 1 ? 's' : '') + ' - Next Up' },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: { slug: user.slug, coins: String(coins) },
      success_url: CLIENT_URL + '/show/' + user.slug + '?grant={CHECKOUT_SESSION_ID}',
      cancel_url: CLIENT_URL + '/show/' + user.slug,
    };
    if (user.stripeOnboarded && user.stripeAccountId) {
      sessionParams.application_fee_amount = Math.floor(amountCents * 0.10);
      sessionParams.transfer_data = { destination: user.stripeAccountId };
    }
    const session = await stripeInstance.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tokens/redeem/:sessionId', async (req, res) => {
  try {
    const grant = await prisma.tokenGrant.findUnique({ where: { stripeSessionId: req.params.sessionId } });
    if (!grant)
      return res.status(404).json({ error: 'Grant not found - payment may still be processing, try again.' });
    if (grant.redeemed)
      return res.status(409).json({ error: 'Already redeemed', tokens: grant.tokens });
    await prisma.tokenGrant.update({ where: { id: grant.id }, data: { redeemed: true } });
    res.json({ tokens: grant.tokens, slug: grant.slug });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.ws('/ws/:key', (ws, req) => {
  const { key } = req.params;
  if (!wsClients[key]) wsClients[key] = new Set();
  wsClients[key].add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED' }));
  ws.on('close', () => {
    if (wsClients[key]) {
      wsClients[key].delete(ws);
      if (!wsClients[key].size) delete wsClients[key];
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
      if (err) res.status(200).send('<html><body><p>App is loading, please refresh.</p></body></html>');
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

async function main() {
  await new Promise(resolve => {
    exec('npx prisma db push --accept-data-loss', (err) => {
      if (err) console.error('prisma db push error:', err.message);
      else console.log('DB schema synced');
      resolve();
    });
  });
  app.listen(PORT, () => console.log('Next Up running on port ' + PORT + ' - CLIENT_URL: ' + CLIENT_URL));
}
main().catch(console.error);
