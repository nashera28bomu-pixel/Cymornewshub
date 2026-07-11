const express = require('express');
const Article = require('../models/Article');
const Subscriber = require('../models/Subscriber');
const { runFetchCycle } = require('../services/fetchNews');

const router = express.Router();

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/news?region=kenya|world&category=&page=1&limit=20
router.get('/news', async (req, res) => {
  try {
    const { region, category, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const filter = {};
    if (region && ['kenya', 'world'].includes(region)) filter.region = region;
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const [articles, total] = await Promise.all([
      Article.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Article.countDocuments(filter)
    ]);

    res.json({ articles, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[api] /news failed:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

// GET /api/news/breaking - latest breaking items for the wire ticker
router.get('/news/breaking', async (req, res) => {
  try {
    const articles = await Article.find({ isBreaking: true })
      .sort({ publishedAt: -1 })
      .limit(10)
      .select('title link region category publishedAt')
      .lean();
    res.json({ articles });
  } catch (err) {
    console.error('[api] /news/breaking failed:', err);
    res.status(500).json({ error: 'Failed to load breaking news' });
  }
});

// GET /api/news/:id
router.get('/news/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).lean();
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json({ article });
  } catch (err) {
    res.status(400).json({ error: 'Invalid article id' });
  }
});

// GET /api/categories
router.get('/categories', (req, res) => {
  res.json({
    categories: ['top', 'politics', 'business', 'sports', 'technology', 'entertainment', 'health', 'world']
  });
});

// GET /api/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications are not configured on this server yet.' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/subscribe
// body: { subscription: PushSubscriptionJSON, regions: [], categories: [], breakingOnly: bool }
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, regions = [], categories = [], breakingOnly = false } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }

    await Subscriber.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        regions,
        categories,
        breakingOnly,
        lastSeenAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[api] /subscribe failed:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/unsubscribe  body: { endpoint }
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await Subscriber.deleteOne({ endpoint });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// POST /api/admin/fetch-now - manual trigger, protected by ADMIN_TOKEN header
router.post('/admin/fetch-now', requireAdmin, async (req, res) => {
  try {
    const result = await runFetchCycle();
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[api] manual fetch failed:', err);
    res.status(500).json({ error: 'Fetch cycle failed' });
  }
});

module.exports = router;
