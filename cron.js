const cron = require('node-cron');
const { runFetchCycle } = require('../services/fetchNews');

function startCron() {
  const schedule = process.env.FETCH_CRON || '*/20 * * * *';

  if (!cron.validate(schedule)) {
    console.warn(`[cron] Invalid FETCH_CRON "${schedule}", falling back to every 20 minutes.`);
  }

  cron.schedule(cron.validate(schedule) ? schedule : '*/20 * * * *', () => {
    console.log('[cron] Running scheduled news fetch...');
    runFetchCycle().catch((err) => console.error('[cron] fetch cycle crashed:', err));
  });

  console.log(`[cron] News fetch scheduled: "${schedule}"`);

  // Run one cycle shortly after boot so the app isn't empty on first load.
  setTimeout(() => {
    runFetchCycle().catch((err) => console.error('[cron] initial fetch crashed:', err));
  }, 5000);
}

module.exports = startCron;
