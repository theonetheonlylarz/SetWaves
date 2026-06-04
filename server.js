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
const JWT_SECRET = process.env.JWT_SECRET || 'nextup-secret-key-change-in-production';
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
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const { slug, coins } = intent.metadata || {};
    if (slug && coins) {
      try {
        await prisma.tokenGrant.upsert({
          where: { stripeSessionId: 'pi_' + intent.id },
          update: {},
          create: { stripeSessionId: 'pi_' + intent.id, tokens: parseInt(coins, 10), slug },
        });
        console.log('Coin grant (Apple/Google Pay): ' + coins + ' coins for show ' + slug);
      } catch (e) { console.error('PI grant error:', e.message); }
    }
  }
  if (event.type === 'account.updated') {
    const account = event.data.object;
    if (account.charges_enabled && account.details_submitted) {
      try {
        await prisma.user.updateMany({ where: { stripeAccountId: account.id }, data: { stripeOnboarded: true } });
      } catch (e) { console.error('Account update error:', e.message); }
    }
  }
  res.json({ received: true });
});

app.use(cors());
app.use(express.json());

const wsClients = {};
function broadcast(key, msg) {
  if (wsClients[key]) {
    wsClients[key].forEach(ws => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); });
  }
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'fan') return res.status(401).json({ error: 'Not a performer token' });
    req.userId = payload.userId;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function fanAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'fan') return res.status(401).json({ error: 'Not a fan token' });
    req.fanId = payload.fanId;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function optionalFanId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return (payload.role === 'fan') ? payload.fanId : null;
  } catch { return null; }
}

app.post('/api/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = base + '-' + Math.random().toString(36).slice(2, 7);
    const user = await prisma.user.create({ data: { email, password: hashed, slug, displayName: displayName || base } });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, slug: user.slug, displayName: user.displayName } });
  } catch (e) {
    console.error('[register] error:', e.message);
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed — ' + e.message });
  }
});
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, slug: user.slug, displayName: user.displayName, stripeOnboarded: user.stripeOnboarded } });
  } catch (e) {
    console.error('[login] error:', e.message);
    res.status(500).json({ error: 'Login failed — ' + e.message });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  if (!req.body.email) return res.status(400).json({ error: 'Email required' });
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});
// -- FAN AUTH --

app.post('/api/fan/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const fan = await prisma.fan.create({ data: { email, passwordHash } });
    const token = jwt.sign({ fanId: fan.id, role: 'fan' }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, fan: { email: fan.email, coinBalance: fan.coinBalance } });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/fan/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const fan = await prisma.fan.findUnique({ where: { email } });
    if (!fan || !(await bcrypt.compare(password, fan.passwordHash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ fanId: fan.id, role: 'fan' }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, fan: { email: fan.email, coinBalance: fan.coinBalance } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/fan/me', fanAuth, async (req, res) => {
  try {
    const fan = await prisma.fan.findUnique({ where: { id: req.fanId } });
    if (!fan) return res.status(404).json({ error: 'Account not found' });
    res.json({ email: fan.email, coinBalance: fan.coinBalance });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch account' }); }
});

app.put('/api/fan/balance', fanAuth, async (req, res) => {
  const { coinBalance } = req.body;
  if (typeof coinBalance !== 'number' || coinBalance < 0)
    return res.status(400).json({ error: 'Invalid balance' });
  try {
    const fan = await prisma.fan.update({
      where: { id: req.fanId },
      data: { coinBalance: Math.max(0, Math.floor(coinBalance)) },
    });
    res.json({ coinBalance: fan.coinBalance });
  } catch (e) { res.status(500).json({ error: 'Failed to update balance' }); }
});

// -- PERFORMER PROFILE & SETTINGS --

app.get('/api/profile', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, slug: user.slug, displayName: user.displayName,
    stripeOnboarded: user.stripeOnboarded, queueCoinCost: user.queueCoinCost,
    queueJumpCost: user.queueJumpCost, maxJumpsPerSession: user.maxJumpsPerSession,
    playNextCost: user.playNextCost, maxPlayNextPerSession: user.maxPlayNextPerSession,
    shoutoutCost: user.shoutoutCost, tipCost: user.tipCost,
    queueOpen: user.queueOpen, nowPlaying: user.nowPlaying,
    pendingEarningsCents: user.pendingEarningsCents,
    genreVoteEnabled: user.genreVoteEnabled, genreVoteOptions: user.genreVoteOptions,
    stripeEnabled: !!stripeInstance });
});

app.put('/api/profile', auth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { displayName: req.body.displayName } });
  res.json({ id: user.id, email: user.email, slug: user.slug, displayName: user.displayName });
});

app.put('/api/pricing', auth, async (req, res) => {
  const cost = parseInt(req.body.queueCoinCost, 10);
  const jumpCost = parseInt(req.body.queueJumpCost, 10);
  const maxJumps = parseInt(req.body.maxJumpsPerSession, 10);
  const playNextCost = parseInt(req.body.playNextCost, 10);
  const maxPlayNext = parseInt(req.body.maxPlayNextPerSession, 10);
  const shoutoutCost = parseInt(req.body.shoutoutCost, 10);
  const tipCostVal = parseInt(req.body.tipCost, 10);
  const data = {};
  if (!isNaN(cost) && cost >= 1 && cost <= 100) data.queueCoinCost = cost;
  if (!isNaN(jumpCost) && jumpCost >= 1 && jumpCost <= 100) data.queueJumpCost = jumpCost;
  if (!isNaN(maxJumps) && maxJumps >= 1 && maxJumps <= 20) data.maxJumpsPerSession = maxJumps;
  if (!isNaN(playNextCost) && playNextCost >= 1 && playNextCost <= 200) data.playNextCost = playNextCost;
  if (!isNaN(maxPlayNext) && maxPlayNext >= 1 && maxPlayNext <= 10) data.maxPlayNextPerSession = maxPlayNext;
  if (!isNaN(shoutoutCost) && shoutoutCost >= 1 && shoutoutCost <= 100) data.shoutoutCost = shoutoutCost;
  if (!isNaN(tipCostVal) && tipCostVal >= 1 && tipCostVal <= 100) data.tipCost = tipCostVal;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid pricing provided' });
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ queueCoinCost: user.queueCoinCost, queueJumpCost: user.queueJumpCost,
    maxJumpsPerSession: user.maxJumpsPerSession, playNextCost: user.playNextCost,
    maxPlayNextPerSession: user.maxPlayNextPerSession, shoutoutCost: user.shoutoutCost,
    tipCost: user.tipCost });
});

app.put('/api/show/status', auth, async (req, res) => {
  const { queueOpen } = req.body;
  if (typeof queueOpen !== 'boolean') return res.status(400).json({ error: 'queueOpen must be boolean' });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (queueOpen && stripeInstance && !user.stripeOnboarded)
    return res.status(402).json({ error: 'Connect a payout account before opening the queue' });
  const updated = await prisma.user.update({ where: { id: req.userId }, data: { queueOpen } });
  broadcast(req.userId, { type: 'SHOW_STATUS', queueOpen });
  broadcast(updated.slug, { type: 'SHOW_STATUS', queueOpen });
  res.json({ queueOpen: updated.queueOpen });
});

app.put('/api/now-playing', auth, async (req, res) => {
  const nowPlaying = (req.body.nowPlaying || '').trim().slice(0, 80) || null;
  const user = await prisma.user.update({ where: { id: req.userId }, data: { nowPlaying } });
  broadcast(req.userId, { type: 'NOW_PLAYING', nowPlaying });
  broadcast(user.slug, { type: 'NOW_PLAYING', nowPlaying });
  res.json({ nowPlaying: user.nowPlaying });
});

// -- SONGS --

app.get('/api/songs', auth, async (req, res) => {
  res.json(await prisma.song.findMany({ where: { userId: req.userId }, orderBy: { order: 'asc' } }));
});

app.post('/api/songs', auth, async (req, res) => {
  const { title, artist, genre } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const count = await prisma.song.count({ where: { userId: req.userId } });
  res.json(await prisma.song.create({ data: { title, artist: artist || '', genre: genre || 'Other', userId: req.userId, order: count } }));
});

app.post('/api/songs/bulk', auth, async (req, res) => {
  const { songs } = req.body;
  if (!Array.isArray(songs) || songs.length === 0)
    return res.status(400).json({ error: 'songs array required' });
  if (songs.length > 500)
    return res.status(400).json({ error: 'Maximum 500 songs per import' });
  const cleaned = [];
  for (const s of songs) {
    const title = (s.title || '').toString().trim();
    if (!title) continue;
    cleaned.push({
      title: title.slice(0, 200),
      artist: ((s.artist || '').toString().trim()).slice(0, 200),
      genre: ((s.genre || 'Other').toString().trim()).slice(0, 40) || 'Other',
    });
  }
  if (cleaned.length === 0) return res.status(400).json({ error: 'No valid songs provided' });
  const startOrder = await prisma.song.count({ where: { userId: req.userId } });
  const data = cleaned.map((s, i) => ({ ...s, userId: req.userId, order: startOrder + i }));
  try {
    const result = await prisma.song.createMany({ data });
    res.json({ count: result.count });
  } catch (e) {
    console.error('Bulk song import error:', e.message);
    res.status(500).json({ error: 'Failed to import songs' });
  }
});

// -- SPOTIFY IMPORT (no API credentials needed - uses public embed page) --
app.get('/api/import/sources', auth, (req, res) => {
  // Spotify import now uses the public embed page, no credentials needed
  res.json({ spotify: true });
});

app.post('/api/songs/import/spotify', auth, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Spotify URL required' });
  const match = url.match(/playlist[\/:]([a-zA-Z0-9]+)/);
  if (!match) return res.status(400).json({ error: "That doesn't look like a Spotify playlist link" });
  const playlistId = match[1];
  try {
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const r = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    if (!r.ok) return res.status(400).json({ error: `Could not reach Spotify (HTTP ${r.status}). Make sure the playlist is public.` });
    const html = await r.text();
    const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!ndMatch) return res.status(400).json({ error: 'Could not parse Spotify embed page. The playlist may be private.' });
    const nextData = JSON.parse(ndMatch[1]);
    const trackList = nextData?.props?.pageProps?.state?.data?.entity?.trackList;
    if (!trackList || !Array.isArray(trackList) || trackList.length === 0)
      return res.status(404).json({ error: 'No tracks found. Make sure the playlist is public and has songs.' });
    const tracks = trackList.map(item => ({
      title: item.title,
      artist: item.subtitle || '',
    }));
    res.json({ tracks });
  } catch (e) {
    console.error('Spotify import error:', e.message);
    res.status(500).json({ error: e.message || 'Spotify import failed' });
  }
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

app.put('/api/songs/reorder', auth, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  try {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.song.updateMany({ where: { id, userId: req.userId }, data: { order: index } })
      )
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Reorder error:', e.message);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

// -- QUEUE --

app.get('/api/queue', auth, async (req, res) => {
  res.json(await prisma.queueItem.findMany({
    where: { userId: req.userId, played: false, status: 'ACCEPTED' },
    orderBy: [{ tierOrder: 'desc' }, { createdAt: 'asc' }],
  }));
});

app.get('/api/queue/pending', auth, async (req, res) => {
  try {
    res.json(await prisma.queueItem.findMany({
      where: { userId: req.userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
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

app.put('/api/queue/:id/accept', auth, async (req, res) => {
  try {
    const item = await prisma.queueItem.findFirst({
      where: { id: req.params.id, userId: req.userId, status: 'PENDING' }
    });
    if (!item) return res.status(404).json({ error: 'Request not found or already processed' });
    if (item.fanId) {
      const fan = await prisma.fan.findUnique({ where: { id: item.fanId } });
      if (!fan || fan.coinBalance < item.tokens) {
        await prisma.queueItem.delete({ where: { id: item.id } });
        const u = await prisma.user.findUnique({ where: { id: req.userId } });
        broadcast(req.userId, { type: 'QUEUE_UPDATE' });
        if (u) broadcast(u.slug, { type: 'QUEUE_UPDATE' });
        return res.status(402).json({ error: 'Fan has insufficient coins — request removed' });
      }
      await prisma.fan.update({ where: { id: item.fanId }, data: { coinBalance: { decrement: item.tokens } } });
    }
    const [updated, user] = await Promise.all([
      prisma.queueItem.update({ where: { id: item.id }, data: { status: 'ACCEPTED' } }),
      prisma.user.update({ where: { id: req.userId }, data: { pendingEarningsCents: { increment: item.tokens * 90 } } }),
    ]);
    broadcast(req.userId, { type: 'QUEUE_UPDATE' });
    if (user) broadcast(user.slug, { type: 'QUEUE_UPDATE' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/queue/:id/deny', auth, async (req, res) => {
  try {
    const item = await prisma.queueItem.findFirst({
      where: { id: req.params.id, userId: req.userId, status: 'PENDING' }
    });
    if (!item) return res.status(404).json({ error: 'Request not found or already processed' });
    await prisma.queueItem.delete({ where: { id: item.id } });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    broadcast(req.userId, { type: 'QUEUE_UPDATE' });
    if (user) broadcast(user.slug, { type: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// -- SHOW (PUBLIC) --

app.get('/api/show/:slug', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { slug: req.params.slug },
      include: {
        songs: { where: { active: true }, orderBy: { order: 'asc' } },
        queue: { where: { played: false, status: 'ACCEPTED' }, orderBy: [{ tierOrder: 'desc' }, { createdAt: 'asc' }] },
      }
    });
    if (!user) return res.status(404).json({ error: 'Performer not found' });
    res.json({ displayName: user.displayName, slug: user.slug, songs: user.songs, queue: user.queue,
      queueCoinCost: user.queueCoinCost, queueJumpCost: user.queueJumpCost,
      maxJumpsPerSession: user.maxJumpsPerSession, playNextCost: user.playNextCost,
      maxPlayNextPerSession: user.maxPlayNextPerSession, shoutoutCost: user.shoutoutCost,
      stripeOnboarded: user.stripeOnboarded, stripeEnabled: !!stripeInstance,
      tipCost: user.tipCost, queueOpen: user.queueOpen, nowPlaying: user.nowPlaying,
      genreVoteEnabled: user.genreVoteEnabled, genreVoteOptions: user.genreVoteOptions });
  } catch (e) { console.error('Show error:', e.message); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/queue/:slug', async (req, res) => {
  const { songTitle, requester, tier, dedication } = req.body;
  if (!songTitle) return res.status(400).json({ error: 'Song title required' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  if (!user.queueOpen) return res.status(403).json({ error: 'The queue is currently closed' });
  const requestedTier = tier || 'STANDARD';
  const isPriority = requestedTier === 'PRIORITY';
  const isPlayNext = requestedTier === 'PLAY_NEXT';
  const requesterName = (requester || 'Anonymous').trim();
  const fanId = optionalFanId(req);
  if ((isPriority || isPlayNext) && !fanId)
    return res.status(401).json({ error: 'Please sign in to use Move Up or Play Next' });
  if (isPriority) {
    const jumpCount = await prisma.queueItem.count({ where: { userId: user.id, tier: 'PRIORITY', played: false, requester: requesterName } });
    if (jumpCount >= user.maxJumpsPerSession)
      return res.status(429).json({ error: "You've reached the Move Up limit for this show", limit: user.maxJumpsPerSession });
  }
  if (isPlayNext) {
    const playNextCount = await prisma.queueItem.count({ where: { userId: user.id, tier: 'PLAY_NEXT', played: false, requester: requesterName } });
    if (playNextCount >= user.maxPlayNextPerSession)
      return res.status(429).json({ error: "You've reached the Play Next limit for this show", limit: user.maxPlayNextPerSession });
  }
  const tierOrder = isPlayNext ? 2 : isPriority ? 1 : 0;
  const tokenCost = isPlayNext ? user.playNextCost : isPriority ? user.queueJumpCost : user.queueCoinCost;
  if (fanId) {
    const fan = await prisma.fan.findUnique({ where: { id: fanId } });
    if (!fan || fan.coinBalance < tokenCost)
      return res.status(402).json({ error: 'Insufficient coins' });
  }
  try {
    const item = await prisma.queueItem.create({
      data: { songTitle, requester: requesterName,
        dedication: (dedication && dedication.trim()) ? dedication.trim().slice(0, 60) : null,
        tier: requestedTier, tierOrder, tokens: tokenCost, priority: isPriority || isPlayNext,
        status: 'PENDING', fanId: fanId || null, userId: user.id }
    });
    broadcast(user.id, { type: 'QUEUE_UPDATE' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// -- STATS --

app.get('/api/stats', auth, async (req, res) => {
  try {
    const queueResult = await prisma.queueItem.aggregate({ where: { userId: req.userId, status: 'ACCEPTED' }, _sum: { tokens: true }, _count: true });
    const shoutoutResult = await prisma.shoutout.aggregate({ where: { userId: req.userId }, _sum: { coins: true }, _count: true });
    const tipResult = await prisma.tip.aggregate({ where: { userId: req.userId }, _sum: { coins: true }, _count: true });
    res.json({ totalCoins: (queueResult._sum.tokens || 0) + (shoutoutResult._sum.coins || 0) + (tipResult._sum.coins || 0),
      totalRequests: queueResult._count || 0, totalShoutouts: shoutoutResult._count || 0, totalTips: tipResult._count || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -- SHOUTOUTS --

app.post('/api/shoutout/:slug', async (req, res) => {
  const { message, fromName } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  if (message.length > 120) return res.status(400).json({ error: 'Message too long (max 120 chars)' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const fanId = optionalFanId(req);
  if (fanId) {
    const fan = await prisma.fan.findUnique({ where: { id: fanId } });
    if (!fan || fan.coinBalance < user.shoutoutCost)
      return res.status(402).json({ error: 'Insufficient coins' });
    await prisma.fan.update({ where: { id: fanId }, data: { coinBalance: { decrement: user.shoutoutCost } } });
  }
  try {
    const [shoutout] = await Promise.all([
      prisma.shoutout.create({
        data: { message: message.trim(), fromName: (fromName || 'Anonymous').trim().slice(0, 40),
          coins: user.shoutoutCost, fanId: fanId || null, userId: user.id }
      }),
      user.shoutoutCost > 0
        ? prisma.user.update({ where: { id: user.id }, data: { pendingEarningsCents: { increment: user.shoutoutCost * 90 } } })
        : Promise.resolve(),
    ]);
    broadcast(user.id, { type: 'SHOUTOUT_NEW' });
    res.json(shoutout);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tip/:slug', async (req, res) => {
  const coins = parseInt(req.body.coins, 10);
  const { fromName, message } = req.body;
  if (isNaN(coins) || coins < 1) return res.status(400).json({ error: 'Invalid tip amount' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  if (coins < user.tipCost) return res.status(400).json({ error: 'Minimum tip is ' + user.tipCost + ' coins' });
  const fanId = optionalFanId(req);
  if (fanId) {
    const fan = await prisma.fan.findUnique({ where: { id: fanId } });
    if (!fan || fan.coinBalance < coins) return res.status(402).json({ error: 'Insufficient coins' });
    await prisma.fan.update({ where: { id: fanId }, data: { coinBalance: { decrement: coins } } });
  }
  try {
    const [tip] = await Promise.all([
      prisma.tip.create({
        data: { coins, fromName: (fromName || 'Anonymous').trim().slice(0, 40),
          message: message ? message.trim().slice(0, 120) : null, fanId: fanId || null, userId: user.id }
      }),
      prisma.user.update({ where: { id: user.id }, data: { pendingEarningsCents: { increment: coins * 90 } } }),
    ]);
    broadcast(user.id, { type: 'TIP_NEW' });
    res.json(tip);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tips', auth, async (req, res) => {
  try {
    res.json(await prisma.tip.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shoutouts', auth, async (req, res) => {
  try {
    res.json(await prisma.shoutout.findMany({ where: { userId: req.userId }, orderBy: [{ read: 'asc' }, { createdAt: 'desc' }] }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/shoutout/:id/read', auth, async (req, res) => {
  try {
    await prisma.shoutout.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { read: true } });
    broadcast(req.userId, { type: 'SHOUTOUT_READ' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -- QR CODE --

app.get('/api/qrcode', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const url = CLIENT_URL + '/show/' + user.slug;
  const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qrCode, url });
});

// -- GENRE VOTING --

app.put('/api/show/genre-vote', auth, async (req, res) => {
  try {
    const data = {};
    if (typeof req.body.enabled === 'boolean') data.genreVoteEnabled = req.body.enabled;
    if (Array.isArray(req.body.options)) data.genreVoteOptions = JSON.stringify(req.body.options.slice(0, 12));
    const user = await prisma.user.update({ where: { id: req.userId }, data });
    broadcast(req.userId, { type: 'VOTE_UPDATE' });
    broadcast(user.slug, { type: 'VOTE_UPDATE' });
    res.json({ genreVoteEnabled: user.genreVoteEnabled, genreVoteOptions: user.genreVoteOptions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/votes/:slug', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const rows = await prisma.genreVote.groupBy({
      by: ['genre'], where: { userId: user.id }, _count: { genre: true },
      orderBy: { _count: { genre: 'desc' } }
    });
    const total = rows.reduce((s, r) => s + r._count.genre, 0);
    res.json({ votes: rows.map(r => ({ genre: r.genre, count: r._count.genre, pct: total ? Math.round(r._count.genre / total * 100) : 0 })), total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/votes/:slug', async (req, res) => {
  const { genre, voterKey } = req.body;
  if (!genre || !voterKey) return res.status(400).json({ error: 'genre and voterKey required' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (!user.genreVoteEnabled) return res.status(403).json({ error: 'Voting is not enabled' });
  let options = [];
  try { options = JSON.parse(user.genreVoteOptions); } catch {}
  if (!options.includes(genre)) return res.status(400).json({ error: 'Invalid genre' });
  const fanId = optionalFanId(req);
  try {
    await prisma.genreVote.upsert({
      where: { voterKey_userId: { voterKey, userId: user.id } },
      update: { genre, fanId: fanId || null },
      create: { genre, voterKey, fanId: fanId || null, userId: user.id }
    });
    broadcast(user.id, { type: 'VOTE_UPDATE' });
    broadcast(user.slug, { type: 'VOTE_UPDATE' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/votes', auth, async (req, res) => {
  try {
    await prisma.genreVote.deleteMany({ where: { userId: req.userId } });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    broadcast(req.userId, { type: 'VOTE_UPDATE' });
    if (user) broadcast(user.slug, { type: 'VOTE_UPDATE' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -- COIN PACKAGES --

const COIN_PACKAGES = [
  { id: 'starter',   name: 'Starter',    coins: 5,   price: 5,   emoji: '🎵', description: 'Good for 1–2 requests' },
  { id: 'popular',   name: 'Popular',    coins: 15,  price: 15,  emoji: '⚡', description: 'Jump the queue 3x' },
  { id: 'superfan',  name: 'Super Fan',  coins: 50,  price: 50,  emoji: '🔥', description: 'Full night of requests' },
  { id: 'vip',       name: 'VIP',        coins: 100, price: 100, emoji: '👑', description: 'Play Next + tips + shoutouts' },
];

app.get('/api/packages/:slug', async (req, res) => {
  res.json(COIN_PACKAGES);
});

// -- STRIPE --

app.post('/api/stripe/connect', auth, async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  try {
    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await stripeInstance.accounts.create({ type: 'express' });
      accountId = account.id;
      await prisma.user.update({ where: { id: req.userId }, data: { stripeAccountId: accountId } });
    }
    const link = await stripeInstance.accountLinks.create({
      account: accountId,
      refresh_url: CLIENT_URL + '/dashboard?stripe=refresh',
      return_url: CLIENT_URL + '/dashboard?stripe=success',
      type: 'account_onboarding',
    });
    res.json({ url: link.url });
  } catch (e) {
    console.error('[stripe/connect] error:', e.message);
    if (e.message && (e.message.includes('signed up for Connect') || e.message.includes('connect'))) {
      return res.status(400).json({ error: 'CONNECT_NOT_ENABLED' });
    }
    res.status(500).json({ error: 'Could not start Stripe setup — please try again' });
  }
});

app.get('/api/stripe/connect/return', auth, async (req, res) => {
if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
try {
const user = await prisma.user.findUnique({ where: { id: req.userId } });
if (!user || !user.stripeAccountId) return res.json({ connected: false, onboarded: false });
const account = await stripeInstance.accounts.retrieve(user.stripeAccountId);
const onboarded = !!(account.charges_enabled && account.details_submitted);
await prisma.user.update({ where: { id: req.userId }, data: { stripeOnboarded: onboarded } });
res.json({ connected: true, onboarded, chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted });
} catch (e) {
console.error('[stripe/connect/return] error:', e.message);
res.status(500).json({ error: e.message });
}
});

app.post('/api/stripe/payout', auth, async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user.stripeOnboarded || !user.stripeAccountId)
      return res.status(400).json({ error: 'Connect a payout account first' });
    if (!user.pendingEarningsCents || user.pendingEarningsCents < 100)
      return res.status(400).json({ error: 'Minimum payout is $1.00' });
    const transfer = await stripeInstance.transfers.create({
      amount: user.pendingEarningsCents,
      currency: 'usd',
      destination: user.stripeAccountId,
      description: 'Next Up earnings payout',
    });
    await prisma.user.update({ where: { id: req.userId }, data: { pendingEarningsCents: 0 } });
    res.json({ success: true, amountCents: transfer.amount, transferId: transfer.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stripe/status', auth, async (req, res) => {
  if (!stripeInstance) return res.json({ connected: false, onboarded: false });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user.stripeAccountId) return res.json({ connected: false, onboarded: false });
    const account = await stripeInstance.accounts.retrieve(user.stripeAccountId);
    const onboarded = !!(account.charges_enabled && account.details_submitted);
    if (onboarded !== user.stripeOnboarded) {
      await prisma.user.update({ where: { id: req.userId }, data: { stripeOnboarded: onboarded } });
    }
    res.json({ connected: true, onboarded, chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stripe/checkout/:slug', async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const coins = parseInt(req.body.coins, 10);
  if (isNaN(coins) || coins < 1 || coins > 999) return res.status(400).json({ error: 'Coin amount must be 1-999' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const amountCents = coins * 100;
  try {
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: coins + ' Coin' + (coins !== 1 ? 's' : '') + ' for ' + (user.displayName || 'Next Up') }, unit_amount: amountCents }, quantity: 1 }],
      mode: 'payment', metadata: { slug: user.slug, coins: String(coins) },
      success_url: CLIENT_URL + '/show/' + user.slug + '?grant={CHECKOUT_SESSION_ID}',
      cancel_url: CLIENT_URL + '/show/' + user.slug,
    };
    // Route payment directly to performer's connected Stripe account
    if (user.stripeAccountId && user.stripeOnboarded) {
      const platformFeeCents = Math.round(amountCents * 0.10); // 10% platform fee
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: user.stripeAccountId,
        },
      };
    }
    const session = await stripeInstance.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public Stripe config (publishable key) - safe to expose
app.get('/api/stripe/public-config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

// Create a PaymentIntent for Apple Pay / Google Pay / Link / Card on the show page
app.post('/api/stripe/payment-intent/:slug', async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const coins = parseInt(req.body.coins, 10);
  if (isNaN(coins) || coins < 1 || coins > 999) return res.status(400).json({ error: 'Coin amount must be 1-999' });
  const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
  if (!user) return res.status(404).json({ error: 'Performer not found' });
  const amountCents = coins * 100;
  try {
    const params = {
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { slug: user.slug, coins: String(coins) },
      description: coins + ' Coin' + (coins !== 1 ? 's' : '') + ' for ' + (user.displayName || 'Next Up'),
    };
    if (user.stripeAccountId && user.stripeOnboarded) {
      params.application_fee_amount = Math.round(amountCents * 0.10);
      params.transfer_data = { destination: user.stripeAccountId };
    }
    const intent = await stripeInstance.paymentIntents.create(params);
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: amountCents });
  } catch (e) {
    console.error('PaymentIntent create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// After Apple Pay confirms, verify the PaymentIntent and grant coins immediately.
// This is also handled by the webhook, but doing it here makes the UX instant.
app.post('/api/stripe/verify-payment', async (req, res) => {
  if (!stripeInstance) return res.status(400).json({ error: 'Stripe not configured' });
  const { paymentIntentId } = req.body || {};
  if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });
  try {
    const intent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed', status: intent.status });
    const { slug, coins } = intent.metadata || {};
    if (!slug || !coins) return res.status(400).json({ error: 'Missing metadata on PaymentIntent' });
    const grantKey = 'pi_' + intent.id;
    const grant = await prisma.tokenGrant.upsert({
      where: { stripeSessionId: grantKey },
      update: {},
      create: { stripeSessionId: grantKey, tokens: parseInt(coins, 10), slug },
    });
    res.json({ tokens: grant.tokens, slug: grant.slug, sessionId: grantKey });
  } catch (e) {
    console.error('verify-payment error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tokens/redeem/:sessionId', async (req, res) => {
  try {
    const grant = await prisma.tokenGrant.findUnique({ where: { stripeSessionId: req.params.sessionId } });
    if (!grant) return res.status(404).json({ error: 'Grant not found - payment may still be processing, try again.' });
    if (grant.redeemed) return res.status(409).json({ error: 'Already redeemed', tokens: grant.tokens });
    await prisma.tokenGrant.update({ where: { id: grant.id }, data: { redeemed: true } });
    let fanBalance = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const payload = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
        if (payload.role === 'fan' && payload.fanId) {
          const fan = await prisma.fan.update({ where: { id: payload.fanId }, data: { coinBalance: { increment: grant.tokens } } });
          fanBalance = fan.coinBalance;
        }
      } catch {}
    }
    res.json({ tokens: grant.tokens, slug: grant.slug, fanBalance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -- WEBSOCKET --

app.ws('/ws/:key', (ws, req) => {
  const { key } = req.params;
  if (!wsClients[key]) wsClients[key] = new Set();
  wsClients[key].add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED' }));
  ws.on('close', () => {
    if (wsClients[key]) { wsClients[key].delete(ws); if (!wsClients[key].size) delete wsClients[key]; }
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
      if (err) res.status(200).send('<html><body><p>App is loading, please refresh.</p></body></html>');
    });
  } else { res.status(404).json({ error: 'Not found' }); }
});

app.listen(PORT, () => {
  console.log('Next Up running on port ' + PORT + ' - CLIENT_URL: ' + CLIENT_URL);
  exec('npx prisma db push --accept-data-loss', (err, stdout, stderr) => {
    if (err) console.error('[prisma db push] FAILED:', stderr || err.message);
    else console.log('[prisma db push] schema synced');
  });
});
