require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const startCron = require('./jobs/cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Landing page is the default route; the app itself lives at /app.html
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[server] Cymor News Hub running on port ${PORT}`);
      startCron();
    });
  } catch (err) {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
