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
const CLIENT_URL = process.env.APP_URL || process.env.CLIENT_URL || `http://localhost:${PORT}`;

let stripeInstance = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripeInstance = Stripe(process.env.STRIPE_SECRET_KEY);
}

app.use(cors());
app.use(express.json());

// WebSocket clients map: userId -> Set of ws connections
const wsClients = {};
function broadcast(userId, msg) {
  if (wsClients[userId]) {
    wsClients[userId].forEach(ws => {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    });
  }
}

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── AUTH ────────────────────────────────────────────────────
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
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, slug: user.slug, displayName: user.displayName, stripeOnboarded: user.stripeOnboarded } });
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  // Always respond with success to avoid exposing whether an email is registered
  res.json({ message: 'If that email is registered, a password reset link has been sent.' });
});

app.get('/api/profile', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, slug: user.slug, displayName: user.displayName, stripeOnboarded: user.stripeOnboarded });
});

app.put('/api/profile', auth, async (req, res) => {
  const { displayName } = req.body;
  const user = await prisma.user.update({ where: { id: req.userId }, data: { displayName } });
  res.json({ id: user.id, email: user.email, slug: user.slug, displayName: user.displayName });
});

// ── SONGS ────────────────────────────────────────────────────
app.get('/api/songs', auth, async (req, res) => {
  const songs = await prisma.song.findMany({ where: { userId: req.userId }, orderBy: { order: 'asc' } });
  res.json(songs);
});

app.post('/api/songs', auth, async (req, res) => {
  const { title, artist } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const count = await prisma.song.count({ where: { userId: req.userId } });
  const song = await prisma.song.create({ data: { title, artist: artist || '', userId: req.userId, order: count } });
  res.json(song);
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

// ── QUEUE ────────────────────────────────────────────────────
app.get('/api/queue', auth, async (req, res) => {
  const queue = await prisma.queueItem.findMany({
    where: { userId: req.userId, played: false },
    orderBy: [{ tier: 'desc' }, { createdAt: 'asc' }]
  });
  res.json(queue);
});

app.put('/api/queue/:id/played', auth, async (req, res) => {
  await prisma.queueItem.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { played: true } });
  broadcast(req.userId, { type: 'PLAYED', id: req.params.id });
  res.json({ success: true });
});

app.delete('/api/queue/:id', auth, async (req, res) => {
  await prisma.queueItem.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  broadcast(req.userId, { type: 'REMOVED', id: req.params.id });
  res.json({ success: true });
});

// ── PUBLIC SHOW ───────────────────────────────────────────────
app.get('/api/show/:slug', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { slug: req.params.slug },
    include: { songs: { where: { active: true }, orderBy: { order: 'asc' } } }
  });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const packages = await prisma.tokenPackage.findMany({ where: { active: true }, orderBy: { price: 'asc' } });
  res.json({ displayName: user.displayName, slug: user.slug, songs: user.songs, stripeOnboarded: user.stripeOnboarded, packages });
});

app.post('/api/queue/:slug', async (req, res) => {
  const { songTitle, requester, tier } = req.body;
  if (!songTitle) return res.status(400).json({ error: 'Song title required' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const item = await prisma.queueItem.create({
    data: { songTitle, requester: requester || 'Anonymous', tier: tier || 'STANDARD', tokens: tier === 'PREMIUM' ? 5 : 1, userId: user.id }
  });
  broadcast(user.id, { type: 'NEW_REQUEST', item });
  res.json(item);
});

// ── QR CODE ───────────────────────────────────────────────────
app.get('/api/qrcode', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const url = `${CLIENT_URL}/show/${user.slug}`;
  const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qrCode, url });
});

// ── STRIPE ────────────────────────────────────────────────────
app.post('/api/stripe/connect', auth, async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  try {
    const account = await stripeInstance.accounts.create({ type: 'express' });
    await prisma.user.update({ where: { id: req.userId }, data: { stripeAccountId: account.id } });
    const link = await stripeInstance.accountLinks.create({
      account: account.id,
      refresh_url: `${CLIENT_URL}/dashboard?stripe=refresh`,
      return_url: `${CLIENT_URL}/dashboard?stripe=success`,
      type: 'account_onboarding'
    });
    res.json({ url: link.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stripe/checkout/:slug', async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const { packageId, fanId } = req.body;
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const pkg = await prisma.tokenPackage.findUnique({ where: { id: packageId } });
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  try {
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: `${pkg.tokens} tokens` }, unit_amount: pkg.price }, quantity: 1 }],
      mode: 'payment',
      success_url: `${CLIENT_URL}/show/${user.slug}?tokens=${pkg.tokens}&fanId=${fanId}`,
      cancel_url: `${CLIENT_URL}/show/${user.slug}`
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WEBSOCKET ──────────────────────────────────────────────────
app.ws('/ws/:userId', (ws, req) => {
  const { userId } = req.params;
  if (!wsClients[userId]) wsClients[userId] = new Set();
  wsClients[userId].add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED' }));
  ws.on('close', () => {
    if (wsClients[userId]) {
      wsClients[userId].delete(ws);
      if (!wsClients[userId].size) delete wsClients[userId];
    }
  });
});

// ── STATIC FILES ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── STARTUP ────────────────────────────────────────────────────
async function main() {
  await new Promise(resolve => {
    exec('npx prisma db push --accept-data-loss', (err, stdout, stderr) => {
      if (err) console.error('prisma db push error:', err.message);
      else console.log('DB schema synced');
      resolve();
    });
  });

  try {
    const count = await prisma.tokenPackage.count();
    if (count === 0) {
      await prisma.tokenPackage.createMany({
        data: [
          { name: 'Starter', tokens: 5, price: 199 },
          { name: 'Popular', tokens: 15, price: 499 },
          { name: 'VIP', tokens: 50, price: 1499 }
        ]
      });
      console.log('Default token packages seeded');
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }

  app.listen(PORT, () => console.log(`SetWaves running on port ${PORT}`));
}

main().catch(console.error);
