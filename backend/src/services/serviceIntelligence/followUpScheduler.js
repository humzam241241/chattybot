/**
 * Follow-Up Scheduler
 * Schedules and manages automated follow-ups for estimates
 */

/**
 * Default follow-up schedule (hours after estimate sent)
 */
const DEFAULT_FOLLOW_UP_SCHEDULE = [
  { hours: 2, type: 'reminder', channel: 'sms' },
  { hours: 48, type: 'check_in', channel: 'email' },
  { hours: 168, type: 'check_in', channel: 'both' }, // 7 days
  { hours: 720, type: 'feedback', channel: 'email' }, // 30 days
];

/**
 * Schedule follow-ups for an estimate
 */
async function scheduleFollowUps(pool, siteId, estimateId, options = {}) {
  const { schedule = DEFAULT_FOLLOW_UP_SCHEDULE, baseTime = new Date() } = options;

  // Check if estimate exists and is in sent status
  const estimateResult = await pool.query(
    `SELECT e.*, sr.customer_name, sr.email, sr.phone
     FROM estimates e
     JOIN service_requests sr ON e.request_id = sr.id
     WHERE e.id = $1 AND e.site_id = $2`,
    [estimateId, siteId]
  );

  const estimate = estimateResult.rows[0];
  if (!estimate) {
    return { ok: false, error: 'Estimate not found' };
  }

  // Get site-specific schedule if configured
  let followUpSchedule = schedule;
  if (estimate.industry_id) {
    const configResult = await pool.query(
      `SELECT custom_follow_up_schedule FROM site_industry_config
       WHERE site_id = $1 AND industry_id = $2`,
      [siteId, estimate.industry_id]
    );
    if (configResult.rows[0]?.custom_follow_up_schedule?.length > 0) {
      followUpSchedule = configResult.rows[0].custom_follow_up_schedule;
    }
  }

  // Create follow-up records
  const followUps = [];
  for (const item of followUpSchedule) {
    const scheduledAt = new Date(baseTime);
    scheduledAt.setHours(scheduledAt.getHours() + item.hours);

    // Skip if customer doesn't have required contact method
    if (item.channel === 'email' && !estimate.email) continue;
    if (item.channel === 'sms' && !estimate.phone) continue;
    if (item.channel === 'both' && !estimate.email && !estimate.phone) continue;

    const result = await pool.query(
      `INSERT INTO estimate_follow_ups (
        site_id, estimate_id, scheduled_at, follow_up_type, channel, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [siteId, estimateId, scheduledAt, item.type, item.channel]
    );

    followUps.push(result.rows[0]);
  }

  return { ok: true, followUps };
}

/**
 * Get pending follow-ups that are due
 */
async function getDueFollowUps(pool, options = {}) {
  const { siteId, limit = 100 } = options;

  let query = `
    SELECT ef.*, e.price_low, e.price_high, e.job_type,
           sr.customer_name, sr.email, sr.phone,
           s.name as site_name, s.id as site_id
    FROM estimate_follow_ups ef
    JOIN estimates e ON ef.estimate_id = e.id
    JOIN service_requests sr ON e.request_id = sr.id
    JOIN sites s ON ef.site_id = s.id
    WHERE ef.status = 'pending'
      AND ef.scheduled_at <= NOW()
      AND e.status NOT IN ('accepted', 'declined', 'expired', 'cancelled')
  `;
  const params = [];

  if (siteId) {
    query += ` AND ef.site_id = $${params.length + 1}`;
    params.push(siteId);
  }

  query += ` ORDER BY ef.scheduled_at ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Generate follow-up message content
 */
function generateFollowUpMessage(followUp, estimate) {
  const templates = {
    reminder: {
      email: {
        subject: `Quick reminder: Your estimate is waiting`,
        body: `Hi ${estimate.customer_name || 'there'},\n\nJust a friendly reminder that your estimate is ready for review. Let us know if you have any questions!\n\nBest regards`,
      },
      sms: `Hi ${estimate.customer_name || 'there'}! Just checking in - did you get a chance to review your estimate? Let us know if you have questions!`,
    },
    check_in: {
      email: {
        subject: `Following up on your estimate`,
        body: `Hi ${estimate.customer_name || 'there'},\n\nWe wanted to follow up on the estimate we sent. Are you still interested in moving forward? We're happy to answer any questions or adjust the scope if needed.\n\nBest regards`,
      },
      sms: `Hi ${estimate.customer_name || 'there'}! Following up on your estimate. Still interested? We're here to help with any questions!`,
    },
    expiry_warning: {
      email: {
        subject: `Your estimate expires soon`,
        body: `Hi ${estimate.customer_name || 'there'},\n\nJust a heads up that your estimate will expire soon. If you'd like to proceed, please let us know and we can get you scheduled.\n\nBest regards`,
      },
      sms: `Hi ${estimate.customer_name || 'there'}! Your estimate expires soon. Let us know if you'd like to move forward!`,
    },
    feedback: {
      email: {
        subject: `We'd love your feedback`,
        body: `Hi ${estimate.customer_name || 'there'},\n\nWe noticed you received an estimate from us recently. We'd love to hear about your experience - did you find another solution, or is there anything we could have done better?\n\nYour feedback helps us improve!\n\nBest regards`,
      },
      sms: `Hi ${estimate.customer_name || 'there'}! We'd love your feedback on your recent estimate experience. What could we do better?`,
    },
  };

  const template = templates[followUp.follow_up_type] || templates.check_in;
  return template;
}

/**
 * Execute a follow-up
 */
async function executeFollowUp(pool, followUpId, options = {}) {
  const { mailer, twilioClient } = options;

  // Get follow-up details
  const followUpResult = await pool.query(
    `SELECT ef.*, e.price_low, e.price_high, e.job_type, e.id as estimate_id,
            sr.customer_name, sr.email, sr.phone,
            s.name as site_name, s.twilio_phone_number
     FROM estimate_follow_ups ef
     JOIN estimates e ON ef.estimate_id = e.id
     JOIN service_requests sr ON e.request_id = sr.id
     JOIN sites s ON ef.site_id = s.id
     WHERE ef.id = $1`,
    [followUpId]
  );

  const followUp = followUpResult.rows[0];
  if (!followUp) {
    return { ok: false, error: 'Follow-up not found' };
  }

  // Check if estimate is still active
  const estimateResult = await pool.query(
    `SELECT status FROM estimates WHERE id = $1`,
    [followUp.estimate_id]
  );
  const estimateStatus = estimateResult.rows[0]?.status;

  if (['accepted', 'declined', 'expired', 'cancelled'].includes(estimateStatus)) {
    // Skip this follow-up
    await pool.query(
      `UPDATE estimate_follow_ups SET status = 'skipped', updated_at = NOW() WHERE id = $1`,
      [followUpId]
    );
    return { ok: true, skipped: true, reason: `Estimate status is ${estimateStatus}` };
  }

  const message = generateFollowUpMessage(followUp, followUp);
  const results = { email: null, sms: null };

  // Send email
  if ((followUp.channel === 'email' || followUp.channel === 'both') && followUp.email && mailer) {
    try {
      await mailer.sendMail({
        to: followUp.email,
        subject: message.email.subject,
        text: message.email.body,
      });
      results.email = { ok: true };
    } catch (err) {
      results.email = { ok: false, error: err.message };
    }
  }

  // Send SMS
  if ((followUp.channel === 'sms' || followUp.channel === 'both') && followUp.phone && twilioClient) {
    try {
      await twilioClient.messages.create({
        body: message.sms,
        to: followUp.phone,
        from: followUp.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER,
      });
      results.sms = { ok: true };
    } catch (err) {
      results.sms = { ok: false, error: err.message };
    }
  }

  // Update follow-up status
  const success = results.email?.ok || results.sms?.ok;
  await pool.query(
    `UPDATE estimate_follow_ups SET 
       status = $2,
       sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END,
       error_message = $3,
       message_sent = $4
     WHERE id = $1`,
    [
      followUpId,
      success ? 'sent' : 'failed',
      success ? null : JSON.stringify(results),
      success ? JSON.stringify(message) : null,
    ]
  );

  return { ok: success, results };
}

/**
 * Cancel pending follow-ups for an estimate
 */
async function cancelFollowUps(pool, estimateId) {
  const result = await pool.query(
    `UPDATE estimate_follow_ups SET status = 'skipped'
     WHERE estimate_id = $1 AND status = 'pending'
     RETURNING id`,
    [estimateId]
  );
  return { cancelled: result.rowCount };
}

/**
 * Process all due follow-ups (for cron job)
 */
async function processDueFollowUps(pool, options = {}) {
  const dueFollowUps = await getDueFollowUps(pool, options);
  const results = [];

  for (const followUp of dueFollowUps) {
    const result = await executeFollowUp(pool, followUp.id, options);
    results.push({ id: followUp.id, ...result });
  }

  return { processed: results.length, results };
}

module.exports = {
  DEFAULT_FOLLOW_UP_SCHEDULE,
  scheduleFollowUps,
  getDueFollowUps,
  generateFollowUpMessage,
  executeFollowUp,
  cancelFollowUps,
  processDueFollowUps,
};
