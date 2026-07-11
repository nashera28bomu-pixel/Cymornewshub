const axios = require('axios');
const Parser = require('rss-parser');
const Article = require('../models/Article');
const rssSources = require('./rssSources');
const { summarizeArticle } = require('./summarize');
const { notifySubscribers } = require('./pushNotify');

const parser = new Parser({ timeout: 12000 });

const GNEWS_CATEGORIES = ['world', 'business', 'technology', 'sports', 'health', 'entertainment'];
const BREAKING_WINDOW_MS = 25 * 60 * 1000; // articles published in the last 25 min are eligible for a push

function isRecentEnoughToBeBreaking(publishedAt) {
  return Date.now() - new Date(publishedAt).getTime() <= BREAKING_WINDOW_MS;
}

function extractImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  const mediaContent = item['media:content'];
  if (mediaContent?.$?.url) return mediaContent.$.url;
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : '';
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Pulls every configured Kenyan RSS feed and returns normalized article docs (not yet saved). */
async function fetchKenyanFeeds() {
  const results = [];

  for (const outlet of rssSources) {
    for (const feed of outlet.feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);
        for (const item of parsed.items.slice(0, 20)) {
          if (!item.link || !item.title) continue;
          results.push({
            title: item.title.trim(),
            link: item.link,
            description: stripHtml(item.contentSnippet || item.summary || item.content || '').slice(0, 400),
            imageUrl: extractImage(item),
            source: outlet.source,
            region: 'kenya',
            category: feed.category,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date()
          });
        }
      } catch (err) {
        console.warn(`[fetchNews] Kenyan feed failed: ${outlet.source} (${feed.url}) -> ${err.message}`);
      }
    }
  }

  return results;
}

/** Pulls world headlines from GNews across a handful of categories. */
async function fetchWorldNews() {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.warn('[fetchNews] GNEWS_API_KEY missing - skipping world news.');
    return [];
  }

  const results = [];

  for (const category of GNEWS_CATEGORIES) {
    try {
      const { data } = await axios.get('https://gnews.io/api/v4/top-headlines', {
        params: { category, lang: 'en', max: 10, apikey: apiKey },
        timeout: 12000
      });

      for (const item of data.articles || []) {
        if (!item.url || !item.title) continue;
        results.push({
          title: item.title.trim(),
          link: item.url,
          description: (item.description || '').slice(0, 400),
          imageUrl: item.image || '',
          source: item.source?.name ? `${item.source.name} / GNews` : 'GNews',
          region: 'world',
          category: category === 'world' ? 'world' : category,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date()
        });
      }
    } catch (err) {
      console.warn(`[fetchNews] GNews category "${category}" failed -> ${err.response?.status || err.message}`);
    }
  }

  return results;
}

/**
 * Full pipeline: fetch both sources, insert only genuinely new articles
 * (deduped by link), summarize them with Gemini, flag breaking news, and
 * push a notification for each new breaking item.
 * Returns a summary object for logging / the admin trigger endpoint.
 */
async function runFetchCycle() {
  const started = Date.now();
  const [kenyan, world] = await Promise.all([fetchKenyanFeeds(), fetchWorldNews()]);
  const candidates = [...kenyan, ...world];

  let inserted = 0;
  let notified = 0;

  for (const candidate of candidates) {
    const exists = await Article.exists({ link: candidate.link });
    if (exists) continue;

    const isBreaking = isRecentEnoughToBeBreaking(candidate.publishedAt) && candidate.category !== 'entertainment';

    const article = await Article.create({ ...candidate, isBreaking });
    inserted += 1;

    // Summarize in the background-ish (awaited, but per-article failures are non-fatal)
    const summary = await summarizeArticle(article.title, article.description);
    if (summary) {
      article.aiSummary = summary;
      article.aiSummaryStatus = 'done';
    } else {
      article.aiSummaryStatus = 'failed';
    }
    await article.save();

    if (isBreaking) {
      try {
        const { sent } = await notifySubscribers(article);
        if (sent > 0) {
          article.notifiedAt = new Date();
          await article.save();
          notified += sent;
        }
      } catch (err) {
        console.warn('[fetchNews] notify failed:', err.message);
      }
    }
  }

  const durationMs = Date.now() - started;
  console.log(`[fetchNews] cycle done in ${durationMs}ms - fetched ${candidates.length}, inserted ${inserted}, pushes sent ${notified}`);

  return { fetched: candidates.length, inserted, notified, durationMs };
}

module.exports = { runFetchCycle };
