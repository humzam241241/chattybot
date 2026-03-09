const cron = require('node-cron');
const pool = require('../config/database');

function startResetUsageCron() {
  // 0 0 1 * *  => at 00:00 on day-of-month 1
  cron.schedule('0 0 1 * *', async () => {
    try {
      const r = await pool.query(
        `UPDATE sites
         SET messages_used = 0,
             updated_at = NOW()`
      );
      console.log(`[UsageReset] Monthly reset complete. Sites updated: ${r.rowCount}`);
    } catch (err) {
      console.error('[UsageReset] Failed monthly reset:', err.message);
    }
  });

  console.log('[UsageReset] Cron scheduled: 0 0 1 * *');
}

module.exports = { startResetUsageCron };

