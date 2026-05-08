const router = require('express').Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/stripe', auth, async (req, res) => {
  res.json({ message: 'Stripe Connect coming soon. Set up STRIPE_CLIENT_ID env var.' });
});

module.exports = router;
