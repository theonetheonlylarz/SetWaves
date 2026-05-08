const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const QRCode = require('qrcode');

router.get('/:slug', async (req, res) => {
  if (req.params.slug === 'dashboard') return res.status(400).json({ error: 'Invalid slug' });
  const user = await prisma.user.findUnique({
    where: { slug: req.params.slug },
    include: { songs: { where: { active: true }, orderBy: { order: 'asc' } }, queue: { where: { played: false }, orderBy: { createdAt: 'asc' } } }
  });
  if (!user) return res.status(404).json({ error: 'Show not found' });
  res.json({ slug: user.slug, displayName: user.displayName, songs: user.songs, queue: user.queue });
});

router.post('/:slug/request', async (req, res) => {
  try {
    const { songTitle, requester, tier, tokens } = req.body;
    const user = await prisma.user.findUnique({ where: { slug: req.params.slug } });
    if (!user) return res.status(404).json({ error: 'Show not found' });
    const item = await prisma.queueItem.create({ data: { songTitle, requester: requester || 'Anonymous', tier: tier || 'STANDARD', tokens: tokens || 1, userId: user.id } });
    req.app.broadcast(req.params.slug, { type: 'NEW_REQUEST', item });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { songs: { orderBy: { order: 'asc' } }, queue: { where: { played: false }, orderBy: { createdAt: 'asc' } } }
  });
  res.json(user);
});

router.patch('/dashboard/settings', auth, async (req, res) => {
  const { displayName } = req.body;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { displayName } });
  res.json(user);
});

router.post('/dashboard/songs', auth, async (req, res) => {
  const { title, artist } = req.body;
  const song = await prisma.song.create({ data: { title, artist: artist || '', userId: req.user.id } });
  res.json(song);
});

router.patch('/dashboard/songs/:id', auth, async (req, res) => {
  const song = await prisma.song.update({ where: { id: req.params.id }, data: req.body });
  res.json(song);
});

router.delete('/dashboard/songs/:id', auth, async (req, res) => {
  await prisma.song.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.patch('/dashboard/queue/:id', auth, async (req, res) => {
  const item = await prisma.queueItem.update({ where: { id: req.params.id }, data: { played: true } });
  req.app.broadcast(req.user.slug, { type: 'QUEUE_UPDATE' });
  res.json(item);
});

router.post('/dashboard/queue/reorder', auth, (req, res) => res.json({ ok: true }));

router.get('/dashboard/qr', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const base = process.env.CLIENT_URL || 'https://setwaves-production.up.railway.app';
  const url = base + '/show/' + user.slug;
  const qr = await QRCode.toDataURL(url);
  res.json({ qr, url });
});

module.exports = router;
