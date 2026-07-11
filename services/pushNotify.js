const webpush = require('web-push');
const Subscriber = require('../models/Subscriber');

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys are not set - push notifications are disabled. Run "npm run generate-vapid".');
    return false;
  }
  webpush.setVapidDetails(VAPID_CONTACT_EMAIL || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/**
 * Sends a push payload to every subscriber whose preferences match the
 * article's region/category (or who has no preferences set, meaning "all").
 * Dead subscriptions (410/404) are cleaned up automatically.
 */
async function notifySubscribers(article) {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const query = {
    $and: [
      { $or: [{ regions: { $size: 0 } }, { regions: article.region }] },
      { $or: [{ categories: { $size: 0 } }, { categories: article.category }] }
    ]
  };
  if (article.isBreaking !== true) {
    query.$and.push({ breakingOnly: false });
  }

  const subscribers = await Subscriber.find(query).lean();
  if (subscribers.length === 0) return { sent: 0, removed: 0 };

  const payload = JSON.stringify({
    title: article.isBreaking ? `🔴 BREAKING: ${article.title}` : article.title,
    body: article.aiSummary ? article.aiSummary.split('\n')[0].replace(/^- /, '') : article.description?.slice(0, 120),
    url: `/app.html?article=${article._id}`,
    icon: '/icons/icon-192.png',
    tag: article.region
  });

  let sent = 0;
  const deadEndpoints = [];

  await Promise.all(
    subscribers.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          deadEndpoints.push(sub.endpoint);
        } else {
          console.warn('[push] send failed:', err.statusCode, err.message);
        }
      }
    })
  );

  if (deadEndpoints.length) {
    await Subscriber.deleteMany({ endpoint: { $in: deadEndpoints } });
  }

  return { sent, removed: deadEndpoints.length };
}

module.exports = { notifySubscribers, ensureConfigured };
