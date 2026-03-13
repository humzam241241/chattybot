/**
 * Quote Sender Service
 * Sends estimates to customers via email/SMS
 */

const { getEstimate, updateEstimateStatus } = require('./estimateGenerator');

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate quote email HTML
 */
function generateQuoteEmailHtml(estimate, site, quoteUrl) {
  const priceRange = estimate.price_low === estimate.price_high
    ? formatCurrency(estimate.price_low)
    : `${formatCurrency(estimate.price_low)} - ${formatCurrency(estimate.price_high)}`;

  const timeline = estimate.timeline_days_min === estimate.timeline_days_max
    ? `${estimate.timeline_days_min} day${estimate.timeline_days_min > 1 ? 's' : ''}`
    : `${estimate.timeline_days_min}-${estimate.timeline_days_max} days`;

  const inclusions = estimate.inclusions || [];
  const exclusions = estimate.exclusions || [];
  const riskWarnings = estimate.risk_warnings || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Estimate from ${site.name || 'Our Team'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0f172a; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px 24px; }
    .price-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .price { font-size: 36px; font-weight: 700; color: #0f172a; }
    .price-label { font-size: 14px; color: #64748b; margin-top: 4px; }
    .timeline { font-size: 16px; color: #475569; margin-top: 12px; }
    .section { margin: 24px 0; }
    .section-title { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .scope { background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 14px; color: #475569; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; font-size: 14px; color: #475569; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; font-size: 14px; color: #92400e; margin: 16px 0; }
    .disclaimer { background: #f1f5f9; border-radius: 8px; padding: 16px; font-size: 13px; color: #64748b; margin: 24px 0; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .valid-until { font-size: 13px; color: #64748b; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Estimate</h1>
    </div>
    <div class="content">
      <p>Hi ${estimate.customer_name || 'there'},</p>
      <p>Thank you for reaching out! Based on your request, here's our preliminary estimate:</p>

      <div class="price-box">
        <div class="price">${priceRange}</div>
        <div class="price-label">Preliminary Estimate</div>
        <div class="timeline">Estimated timeline: ${timeline}</div>
      </div>

      <div class="section">
        <div class="section-title">Scope of Work</div>
        <div class="scope">${estimate.scope_of_work || 'Details to be confirmed during inspection.'}</div>
      </div>

      ${inclusions.length > 0 ? `
      <div class="section">
        <div class="section-title">What's Included</div>
        <ul>
          ${inclusions.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${exclusions.length > 0 ? `
      <div class="section">
        <div class="section-title">Not Included</div>
        <ul>
          ${exclusions.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${riskWarnings.length > 0 ? `
      <div class="warning">
        <strong>Please Note:</strong>
        <ul style="margin-top: 8px;">
          ${riskWarnings.map(warning => `<li>${warning}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="disclaimer">
        <strong>Important:</strong> This is a preliminary estimate based on the information provided. 
        Final pricing will be confirmed after an on-site inspection. Actual costs may vary based on 
        conditions discovered during the inspection.
      </div>

      <div class="cta">
        <a href="${quoteUrl}">View Full Estimate & Schedule</a>
      </div>

      ${estimate.valid_until ? `
      <div class="valid-until">
        This estimate is valid until ${new Date(estimate.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      ` : ''}

      <p>Questions? Just reply to this email or give us a call.</p>
      <p>Best regards,<br>${site.name || 'The Team'}</p>
    </div>
    <div class="footer">
      <p>${site.name || ''}</p>
      ${site.phone ? `<p>${site.phone}</p>` : ''}
      ${site.email ? `<p>${site.email}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate quote SMS text
 */
function generateQuoteSmsText(estimate, site, quoteUrl) {
  const priceRange = estimate.price_low === estimate.price_high
    ? formatCurrency(estimate.price_low)
    : `${formatCurrency(estimate.price_low)}-${formatCurrency(estimate.price_high)}`;

  return `Hi ${estimate.customer_name || 'there'}! Your estimate from ${site.name || 'us'} is ready: ${priceRange} (preliminary). View details & schedule: ${quoteUrl}`;
}

/**
 * Send estimate to customer
 */
async function sendEstimate(pool, estimateId, siteId, options = {}) {
  const { channel = 'email', mailer, twilioClient } = options;

  // Get estimate with customer details
  const estimate = await getEstimate(pool, estimateId, siteId);
  if (!estimate) {
    return { ok: false, error: 'Estimate not found' };
  }

  // Get site details
  const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [siteId]);
  const site = siteResult.rows[0];
  if (!site) {
    return { ok: false, error: 'Site not found' };
  }

  // Generate quote URL
  const baseUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
  const quoteUrl = `${baseUrl}/quote/${estimate.id}`;

  const results = { email: null, sms: null };

  // Send email
  if ((channel === 'email' || channel === 'both') && estimate.email && mailer) {
    try {
      const html = generateQuoteEmailHtml(estimate, site, quoteUrl);
      await mailer.sendMail({
        to: estimate.email,
        subject: `Your Estimate from ${site.name || 'Our Team'}`,
        html,
      });
      results.email = { ok: true };
    } catch (err) {
      console.error('[quoteSender] Email error:', err.message);
      results.email = { ok: false, error: err.message };
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && estimate.phone && twilioClient) {
    try {
      const text = generateQuoteSmsText(estimate, site, quoteUrl);
      await twilioClient.messages.create({
        body: text,
        to: estimate.phone,
        from: site.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER,
      });
      results.sms = { ok: true };
    } catch (err) {
      console.error('[quoteSender] SMS error:', err.message);
      results.sms = { ok: false, error: err.message };
    }
  }

  // Update estimate status
  const sentVia = [];
  if (results.email?.ok) sentVia.push('email');
  if (results.sms?.ok) sentVia.push('sms');

  if (sentVia.length > 0) {
    await pool.query(
      `UPDATE estimates SET status = 'sent', sent_at = NOW(), sent_via = $3, updated_at = NOW()
       WHERE id = $1 AND site_id = $2`,
      [estimateId, siteId, sentVia.join(',')]
    );

    await pool.query(
      `UPDATE service_requests SET status = 'sent', updated_at = NOW()
       WHERE id = (SELECT request_id FROM estimates WHERE id = $1)`,
      [estimateId]
    );
  }

  return {
    ok: sentVia.length > 0,
    results,
    quoteUrl,
  };
}

/**
 * Record that customer viewed the estimate
 */
async function recordEstimateView(pool, estimateId) {
  const result = await pool.query(
    `UPDATE estimates SET viewed_at = COALESCE(viewed_at, NOW()), status = 
       CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [estimateId]
  );
  return result.rows[0];
}

/**
 * Record customer response to estimate
 */
async function recordCustomerResponse(pool, estimateId, siteId, response, responseText) {
  const status = response === 'accept' ? 'accepted' : 'declined';

  const result = await pool.query(
    `UPDATE estimates SET 
       status = $3,
       customer_response = $4,
       customer_response_at = NOW(),
       updated_at = NOW()
     WHERE id = $1 AND site_id = $2
     RETURNING *`,
    [estimateId, siteId, status, responseText || response]
  );

  // Update service request
  const newRequestStatus = response === 'accept' ? 'booked' : 'declined';
  await pool.query(
    `UPDATE service_requests SET status = $2, updated_at = NOW()
     WHERE id = (SELECT request_id FROM estimates WHERE id = $1)`,
    [estimateId, newRequestStatus]
  );

  return result.rows[0];
}

module.exports = {
  formatCurrency,
  generateQuoteEmailHtml,
  generateQuoteSmsText,
  sendEstimate,
  recordEstimateView,
  recordCustomerResponse,
};
