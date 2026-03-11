const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampMin(n, min) {
  if (n === null || n === undefined) return n;
  if (min === null || min === undefined) return n;
  return Math.max(n, min);
}

function pickBestPricingRow(rows, { roofType, urgency }) {
  const rt = normalizeText(roofType) || null;
  const ur = normalizeText(urgency) || null;

  // Specificity scoring: exact match > null (wildcard)
  function scoreRow(r) {
    const rowRt = r.roof_type ? normalizeText(r.roof_type) : null;
    const rowUr = r.urgency ? normalizeText(r.urgency) : null;

    // If row demands a value that doesn't match, discard by low score
    if (rowRt && rt && rowRt !== rt) return -1;
    if (rowRt && !rt) return -1;
    if (rowUr && ur && rowUr !== ur) return -1;
    if (rowUr && !ur) return -1;

    const roofScore = rowRt ? 2 : 1;
    const urgScore = rowUr ? 2 : 1;
    return roofScore * 10 + urgScore; // roof slightly weighted
  }

  let best = null;
  let bestScore = -1;
  for (const r of rows) {
    const s = scoreRow(r);
    if (s > bestScore) {
      best = r;
      bestScore = s;
    }
  }
  return bestScore >= 0 ? best : null;
}

async function loadPricingRows({ siteId, serviceType }) {
  const st = normalizeText(serviceType);
  if (!st) return [];

  // Prefer tenant overrides; fall back to templates.
  // We pull both, then pick the best match.
  if (siteId) {
    const r = await pool.query(
      `SELECT
         id,
         service_type,
         roof_type,
         urgency,
         price_low_per_sqft,
         price_high_per_sqft,
         price_low_flat,
         price_high_flat,
         min_charge_low,
         min_charge_high,
         timeline_estimate,
         recommended_service
       FROM roofing_pricing
       WHERE site_id = $1
         AND lower(service_type) = $2`,
      [siteId, st]
    );
    if (r.rows.length) return r.rows;
  }

  const t = await pool.query(
    `SELECT
       id,
       service_type,
       roof_type,
       urgency,
       price_low_per_sqft,
       price_high_per_sqft,
       price_low_flat,
       price_high_flat,
       min_charge_low,
       min_charge_high,
       timeline_estimate,
       recommended_service
     FROM roofing_pricing_templates
     WHERE lower(service_type) = $1
       AND region = 'ON'`,
    [st]
  );
  return t.rows;
}

function buildExplanation({ serviceType, roofSize, roofType, urgency, pricingRow, priceLow, priceHigh }) {
  const parts = [];
  parts.push(`Service: ${serviceType}.`);
  if (roofType) parts.push(`Roof type: ${roofType}.`);
  if (urgency) parts.push(`Urgency: ${urgency}.`);

  const rs = toNumberOrNull(roofSize);
  const loSq = toNumberOrNull(pricingRow?.price_low_per_sqft);
  const hiSq = toNumberOrNull(pricingRow?.price_high_per_sqft);
  const loFlat = toNumberOrNull(pricingRow?.price_low_flat);
  const hiFlat = toNumberOrNull(pricingRow?.price_high_flat);
  const minLo = toNumberOrNull(pricingRow?.min_charge_low);
  const minHi = toNumberOrNull(pricingRow?.min_charge_high);

  if (rs && loSq && hiSq) {
    parts.push(`Estimated using ${rs} sq ft × $${loSq.toFixed(2)}–$${hiSq.toFixed(2)}/sq ft.`);
  } else if (loFlat !== null && hiFlat !== null) {
    parts.push(`Estimated using a flat service range of $${loFlat.toFixed(0)}–$${hiFlat.toFixed(0)}.`);
  }

  if (minLo !== null || minHi !== null) {
    const minText =
      minLo !== null && minHi !== null
        ? `$${minLo.toFixed(0)}–$${minHi.toFixed(0)}`
        : `$${(minLo ?? minHi).toFixed(0)}`;
    parts.push(`Minimum service charge may apply (${minText}).`);
  }

  parts.push(`Range shown: $${priceLow.toFixed(0)}–$${priceHigh.toFixed(0)} (CAD).`);
  return parts.join(' ');
}

/**
 * generateQuote({ serviceType, roofSize, roofType, urgency, notes, siteId })
 *
 * Returns:
 * {
 *   quote_id,
 *   price_low,
 *   price_high,
 *   timeline_estimate,
 *   recommended_service,
 *   explanation
 * }
 */
async function generateQuote({ serviceType, roofSize, roofType, urgency, notes, siteId }) {
  const st = normalizeText(serviceType);
  if (!st) {
    const err = new Error('serviceType required');
    err.status = 400;
    throw err;
  }

  const rows = await loadPricingRows({ siteId: siteId || null, serviceType: st });
  const pricing = pickBestPricingRow(rows, { roofType, urgency });
  if (!pricing) {
    const err = new Error('No pricing configured for this service');
    err.status = 404;
    throw err;
  }

  const rs = toNumberOrNull(roofSize);
  const loSq = toNumberOrNull(pricing.price_low_per_sqft);
  const hiSq = toNumberOrNull(pricing.price_high_per_sqft);
  const loFlat = toNumberOrNull(pricing.price_low_flat);
  const hiFlat = toNumberOrNull(pricing.price_high_flat);
  const minLo = toNumberOrNull(pricing.min_charge_low);
  const minHi = toNumberOrNull(pricing.min_charge_high);

  let priceLow = null;
  let priceHigh = null;

  if (rs !== null && loSq !== null && hiSq !== null) {
    priceLow = rs * loSq;
    priceHigh = rs * hiSq;
  } else if (loFlat !== null && hiFlat !== null) {
    priceLow = loFlat;
    priceHigh = hiFlat;
  } else {
    const err = new Error('Pricing configuration is incomplete');
    err.status = 500;
    throw err;
  }

  priceLow = clampMin(priceLow, minLo);
  priceHigh = clampMin(priceHigh, minHi);

  // Safety: ensure high >= low
  if (priceHigh < priceLow) priceHigh = priceLow;

  const quoteId = uuidv4();
  const timelineEstimate = pricing.timeline_estimate || null;
  const recommendedService = pricing.recommended_service || serviceType;
  const explanation = buildExplanation({
    serviceType,
    roofSize,
    roofType,
    urgency,
    pricingRow: pricing,
    priceLow,
    priceHigh,
  });

  if (siteId) {
    await pool.query(
      `INSERT INTO quotes (
         id, site_id, service_type, roof_size, roof_type, urgency, notes,
         price_low, price_high, timeline_estimate, recommended_service, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, NOW()
       )`,
      [
        quoteId,
        siteId,
        serviceType,
        rs,
        roofType || null,
        urgency || null,
        notes || null,
        priceLow,
        priceHigh,
        timelineEstimate,
        recommendedService,
      ]
    );
  }

  return {
    quote_id: quoteId,
    price_low: Number(priceLow),
    price_high: Number(priceHigh),
    timeline_estimate: timelineEstimate,
    recommended_service: recommendedService,
    explanation,
  };
}

async function getQuoteById({ quoteId, siteId }) {
  const q = await pool.query(
    `SELECT
       id,
       site_id,
       service_type,
       roof_size,
       roof_type,
       urgency,
       notes,
       price_low,
       price_high,
       timeline_estimate,
       recommended_service,
       created_at
     FROM quotes
     WHERE id = $1
       AND ($2::uuid IS NULL OR site_id = $2::uuid)`,
    [quoteId, siteId || null]
  );
  return q.rows?.[0] || null;
}

module.exports = {
  generateQuote,
  getQuoteById,
};

