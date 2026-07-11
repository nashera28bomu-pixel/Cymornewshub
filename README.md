# Cymor News Hub

Kenyan and world news, pulled from real newsrooms, boiled down to a 3-bullet AI
digest, with push notifications for breaking stories — one Node.js site, a
landing page, and an installable app, no PC required to build or deploy.

---

## 1. What this is

- **Landing page** (`/`, `public/index.html`) — pitch page with a live wire
  ticker of breaking headlines and a button into the app.
- **App** (`/app.html`) — the actual newsroom: region toggle (Kenya / World /
  All), category tabs, a lead story + feed, a bottom-sheet article view with
  the AI summary, and a bell icon to turn on push notifications.
- **Backend** — Express API that:
  - Pulls Kenyan headlines via RSS (Nation, Standard, Citizen Digital, The
    Star, Tuko, Capital FM).
  - Pulls world headlines via the GNews API.
  - Stores everything in MongoDB Atlas, deduped by article URL.
  - Summarizes each new article with Gemini (3 bullets + a "why it matters"
    line), with a model fallback chain so a deprecated Gemini model name
    doesn't break the pipeline.
  - Sends a Web Push notification for anything published in the last ~25
    minutes and flagged as breaking.
  - Runs the whole fetch cycle on a cron schedule (default: every 20 min).

No build step, no framework, no bundler — vanilla HTML/CSS/JS on the frontend,
same as the rest of your projects, so it uploads fine from GitHub's mobile web
editor.

---

## 2. Before you start: accounts you need

You only need free tiers for all of these.

1. **MongoDB Atlas** — https://www.mongodb.com/cloud/atlas
   Create a free (M0) cluster, a database user, and allow access from
   anywhere (`0.0.0.0/0`) under Network Access so Render can reach it. Copy
   the connection string.
2. **GNews.io** — https://gnews.io
   Sign up, grab your API token from the dashboard. Free tier is 100
   requests/day, which is enough for the default 20-minute fetch cycle (6
   categories × ~72 cycles/day would exceed it — see the note in section 6 on
   tuning `FETCH_CRON` and `GNEWS_CATEGORIES` if you hit the limit).
3. **Google AI Studio (Gemini)** — https://aistudio.google.com/apikey
   Create a free API key for Gemini.
4. **Render** — https://render.com
   For deployment (free web service tier).

---

## 3. Project structure

```
cymor-news-hub/
├── server.js                  # Express entry point
├── package.json
├── .env.example                # copy to .env and fill in
├── config/db.js                # MongoDB connection
├── models/
│   ├── Article.js
│   └── Subscriber.js           # push subscriptions
├── services/
│   ├── rssSources.js           # Kenyan RSS feed list
│   ├── fetchNews.js            # main fetch/dedupe/summarize/notify pipeline
│   ├── summarize.js            # Gemini call with model fallback chain
│   └── pushNotify.js           # web-push sending + cleanup of dead subs
├── routes/api.js                # all /api/* endpoints
├── jobs/cron.js                 # node-cron scheduler
├── scripts/generateVapidKeys.js # one-off VAPID key generator
└── public/
    ├── index.html               # landing page
    ├── app.html                 # the app
    ├── manifest.json            # PWA manifest ("Add to Home Screen")
    ├── sw.js                    # service worker (push handling)
    ├── icons/icon-192.png, icon-512.png
    ├── css/tokens.css, landing.css, app.css
    └── js/landing.js, app.js, notifications.js
```

---

## 4. Environment variables

Copy `.env.example` to `.env` and fill in every value:

| Variable | What it's for |
|---|---|
| `PORT` | Defaults to 3000. Render sets its own `PORT` automatically. |
| `MONGODB_URI` | Your Atlas connection string. |
| `GNEWS_API_KEY` | From gnews.io. World news won't load without this. |
| `GEMINI_API_KEY` | From aistudio.google.com. Without this, articles save with no AI summary and the app just shows the raw description instead. |
| `GEMINI_MODELS` | Comma-separated fallback list, tried in order. Update this if Google renames/retires a model — you won't need to touch any code. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generate with `npm run generate-vapid` (see below). Required for push notifications. |
| `VAPID_CONTACT_EMAIL` | Any contact email, prefixed `mailto:`. Used by the push service to reach you if something's wrong with your usage. |
| `FETCH_CRON` | Cron expression for how often to pull fresh news. Default `*/20 * * * *` (every 20 min). |
| `ADMIN_TOKEN` | A long random string. Protects the manual "fetch now" endpoint. |

### Generating VAPID keys

VAPID keys let your server prove to browsers that it's allowed to send them
push notifications.

```bash
npm install
npm run generate-vapid
```

This prints a public and private key — paste both into `.env`.

---

## 5. Running it locally

```bash
npm install
cp .env.example .env
# fill in .env with your real values
npm start
```

Visit `http://localhost:3000` for the landing page, or
`http://localhost:3000/app.html` for the app directly.

The server runs one fetch cycle ~5 seconds after boot so you're not staring at
an empty feed, then again on the `FETCH_CRON` schedule.

**Note on push notifications locally:** browsers generally require HTTPS for
push to work, `localhost` is an exception most browsers allow, but if
notifications don't trigger locally, that's expected — test on your Render
deployment instead, which is HTTPS by default.

---

## 6. Deploying to Render (phone-first, no PC needed)

1. Push this project to a new GitHub repo (via the GitHub mobile app or
   mobile web editor — since there's no single giant file here needing manual
   splitting, a normal "Add file → Upload files" from your phone works fine
   as long as you keep the folder structure intact when uploading).
2. In Render: **New → Web Service**, connect the repo.
3. Environment: `Node`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add every variable from `.env` into Render's **Environment** tab (don't
   upload your real `.env` file to GitHub — keep it out of the repo, e.g.
   with a `.gitignore` entry).
7. Deploy. Render's free tier spins down after inactivity — the first request
   after a spin-down will be slow while it wakes up; the cron job also won't
   fire while the service is asleep, so your feed only refreshes on real
   traffic. If you want continuous updates, you'll need a paid Render
   instance or an external uptime pinger hitting `/health` periodically.

### If you hit the GNews free-tier limit (100 req/day)

The default setup calls 6 GNews categories per fetch cycle. At the default
20-minute schedule that's `6 × 72 = 432` requests/day — over the free limit.
Either:
- Increase `FETCH_CRON` to something like `*/45 * * * *` (32 cycles/day × 6 =
  192 — still over) or `every 2 hours` (`0 */2 * * *`, 12 cycles × 6 = 72,
  safely under), or
- Trim `GNEWS_CATEGORIES` in `services/fetchNews.js` down to fewer
  categories.

---

## 7. Keeping the Kenyan RSS feeds healthy

RSS feed URLs occasionally change when a publisher redesigns their site.
`services/rssSources.js` is the single place to fix this — if a source stops
returning items:

1. Open the outlet's homepage on desktop or "request desktop site" on mobile.
2. Check the footer for an "RSS" link, or try `<domain>/feed`, `<domain>/rss`.
3. Update the URL in `rssSources.js` and redeploy.

Failures are logged but never crash the fetch cycle — a broken feed just
means fewer Kenyan stories that cycle, not a dead app.

---

## 8. API reference (for your own debugging or future clients)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/news?region=&category=&page=&limit=` | Paginated article list |
| GET | `/api/news/breaking` | Latest 10 breaking items (powers the ticker) |
| GET | `/api/news/:id` | Single article |
| GET | `/api/categories` | List of valid category values |
| GET | `/api/vapid-public-key` | Public key for push subscription |
| POST | `/api/subscribe` | Save a browser's push subscription + preferences |
| POST | `/api/unsubscribe` | Remove a push subscription |
| POST | `/api/admin/fetch-now` | Manually trigger a fetch cycle (needs `x-admin-token` header) |
| GET | `/health` | Uptime check |

Manual fetch trigger example:

```bash
curl -X POST https://your-app.onrender.com/api/admin/fetch-now \
  -H "x-admin-token: your_admin_token_here"
```

---

## 9. How notifications work

1. The person taps the bell icon in the app, picks which regions/categories
   they care about (or leaves everything unselected for "all"), and taps
   **Turn on notifications**.
2. The browser asks for notification permission, then registers a push
   subscription which gets saved to MongoDB alongside their preferences.
3. Every fetch cycle, any article published in the last ~25 minutes gets
   flagged `isBreaking`. After it's saved and summarized, the server finds
   every subscriber whose preferences match and sends a push via the
   `web-push` library.
4. The service worker (`public/sw.js`) shows the OS-level notification even
   if the browser tab is closed. Tapping it opens `/app.html` straight to
   that article.

Dead/expired subscriptions (uninstalled app, cleared browser data) are
detected from push failures and cleaned out of the database automatically.

---

## 10. Design notes

The visual identity is a newsroom wire-service look — ink navy on stone
paper, press red for breaking news, a monospace "teletype" face for
timestamps and the scrolling wire ticker — deliberately different from the
cinema aesthetic used in Cymor Movie Hub, so the two apps don't feel like the
same template reused.

---

## 11. Things you'll likely want to add next

- Swap the free GNews tier for a paid plan (or add a second world-news
  source) if you outgrow 100 requests/day.
- An admin view for editing/removing bad articles (e.g. mis-tagged category).
- Bookmark/save-for-later using the same MongoDB + browser-fingerprint
  pattern you used elsewhere, if you want it without user accounts.
- Swahili-language summaries as a toggle, since Gemini can generate those
  from the same prompt with a language instruction added.
