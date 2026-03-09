const cron = require('node-cron');
const pool = require('../config/database');

function startUsageResetWorker() {
  // Runs daily at 00:10 (server time)
  cron.schedule('10 0 * * *', async () => {
    try {
      const r = await pool.query(
        `UPDATE site_subscriptions
         SET messages_used = 0,
             updated_at = NOW()
         WHERE current_period_end IS NOT NULL
           AND current_period_end < NOW()`
      );
      console.log(`[Usage] Daily reset complete. Subscriptions updated: ${r.rowCount}`);
    } catch (err) {
      console.error('[Usage] Daily reset failed:', err.message);
    }
  });

  console.log('[Usage] Reset worker scheduled: 10 0 * * *');
}

module.exports = { startUsageResetWorker };

