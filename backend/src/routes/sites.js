const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const { userAuth, requirePaidOrTrial } = require('../middleware/userAuth');
const { clearSettingsCache } = require('../services/raffySettings');
const { normalizePhoneE164 } = require('../utils/phone');

const router = express.Router();

router.use(userAuth);
router.use(requirePaidOrTrial);
router.use(apiLimiter);

function normalizeTwilioNumberInput(raw) {
  if (raw === undefined) return undefined; // omitted
  if (raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const withoutPrefix = s.replace(/^whatsapp:/i, '');
  return normalizePhoneE164(withoutPrefix);
}

function isValidE164OrNull(v) {
  if (v === null || v === undefined) return true;
  return /^\+\d{10,15}$/.test(String(v));
}

/** GET /sites — list sites (all for admin, owned for users) */
router.get('/', async (req, res) => {
  try {
    const params = [];
    let whereClause = '';
    
    if (!req.user?.is_admin && req.user?.id) {
      params.push(req.user.id);
      whereClause = `WHERE s.owner_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        s.id, 
        s.company_name, 
        s.domain, 
        s.primary_color, 
        s.tone, 
        s.twilio_phone,
        s.twilio_whatsapp,
        s.owner_id,
        s.created_at,
        COALESCE(l.lead_count, 0)::int as lead_count,
        COALESCE(c.conversation_count, 0)::int as conversation_count
      FROM sites s
      LEFT JOIN (
        SELECT site_id, COUNT(*) as lead_count 
        FROM leads 
        GROUP BY site_id
      ) l ON s.id = l.site_id
      LEFT JOIN (
        SELECT site_id, COUNT(*) as conversation_count 
        FROM conversations 
        GROUP BY site_id
      ) c ON s.id = c.site_id
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);
    return res.json({ sites: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

/** GET /sites/:id — get single site (owned check for non-admins) */
router.get('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let query = 'SELECT * FROM sites WHERE id = $1';
    
    if (!req.user?.is_admin && req.user?.id) {
      params.push(req.user.id);
      query += ` AND owner_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ site: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch site' });
  }
});

/** POST /sites — create site */
router.post(
  '/',
  [
    body('company_name').isString().trim().isLength({ min: 1, max: 200 }),
    body('domain').isURL({ require_protocol: false }).withMessage('Valid domain required'),
    body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('tone').optional().isString().trim().isLength({ max: 200 }),
    body('system_prompt').optional().isString().trim().isLength({ max: 8000 }),
    body('raffy_overrides').optional().isObject(),
    body('twilio_phone')
      .optional({ nullable: true })
      .customSanitizer(normalizeTwilioNumberInput)
      .custom((v) => {
        if (!isValidE164OrNull(v)) throw new Error('twilio_phone must be E.164 (e.g. +15551234567)');
        return true;
      }),
    body('twilio_whatsapp')
      .optional({ nullable: true })
      .customSanitizer(normalizeTwilioNumberInput)
      .custom((v) => {
        if (!isValidE164OrNull(v)) throw new Error('twilio_whatsapp must be E.164 (e.g. +15551234567)');
        return true;
      }),
    body('report_email')
      .optional({ nullable: true })
      .customSanitizer((v) => (v === undefined ? undefined : v === null ? null : String(v).trim()))
      .custom((v) => {
        if (v === undefined || v === null || v === '') return true;
        // Basic email format check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) throw new Error('report_email must be a valid email');
        return true;
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { company_name, domain, primary_color, tone, system_prompt, raffy_overrides, twilio_phone, twilio_whatsapp, report_email } = req.body;

    try {
      const id = uuidv4();
      const ownerId = req.user?.id || null;
      const stripeCustomerId = req.user?.stripe_customer_id || null;
      const billingPlan = 'starter';
      const result = await pool.query(
        `INSERT INTO sites (id, company_name, domain, primary_color, tone, system_prompt, raffy_overrides, twilio_phone, twilio_whatsapp, report_email, owner_id, stripe_customer_id, billing_plan, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING *`,
        [
          id,
          company_name,
          domain,
          primary_color || '#6366f1',
          tone || null,
          system_prompt || null,
          raffy_overrides || {},
          twilio_phone ?? null,
          twilio_whatsapp ?? null,
          report_email ? String(report_email).trim() : null,
          ownerId,
          stripeCustomerId,
          billingPlan,
        ]
      );
      return res.status(201).json({ site: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err && err.code === '23505') {
        return res.status(409).json({ error: 'That Twilio number is already assigned to another site.' });
      }
      return res.status(500).json({ error: 'Failed to create site' });
    }
  }
);

/** PUT /sites/:id — update site */
router.put(
  '/:id',
  [
    body('company_name').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('domain').optional().isURL({ require_protocol: false }),
    body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('tone').optional().isString().trim().isLength({ max: 200 }),
    body('system_prompt').optional().isString().trim().isLength({ max: 8000 }),
    body('raffy_overrides').optional().isObject(),
    body('twilio_phone')
      .optional({ nullable: true })
      .customSanitizer(normalizeTwilioNumberInput)
      .custom((v) => {
        if (!isValidE164OrNull(v)) throw new Error('twilio_phone must be E.164 (e.g. +15551234567)');
        return true;
      }),
    body('twilio_whatsapp')
      .optional({ nullable: true })
      .customSanitizer(normalizeTwilioNumberInput)
      .custom((v) => {
        if (!isValidE164OrNull(v)) throw new Error('twilio_whatsapp must be E.164 (e.g. +15551234567)');
        return true;
      }),
    body('report_email')
      .optional({ nullable: true })
      .customSanitizer((v) => (v === undefined ? undefined : v === null ? null : String(v).trim()))
      .custom((v) => {
        if (v === undefined || v === null || v === '') return true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) throw new Error('report_email must be a valid email');
        return true;
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const allowed = [
        'company_name',
        'domain',
        'primary_color',
        'tone',
        'system_prompt',
        'raffy_overrides',
        'twilio_phone',
        'twilio_whatsapp',
        'report_email',
      ];

      const setParts = [];
      const params = [];
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          params.push(req.body[key]);
          setParts.push(`${key} = $${params.length}`);
        }
      }

      if (setParts.length === 0) {
        return res.status(400).json({ error: 'No fields provided to update' });
      }

      params.push(req.params.id);
      const idParam = `$${params.length}`;
      let ownerCheck = '';
      if (!req.user?.is_admin && req.user?.id) {
        params.push(req.user.id);
        ownerCheck = ` AND owner_id = $${params.length}`;
      }

      const result = await pool.query(
        `UPDATE sites
         SET ${setParts.join(', ')}
         WHERE id = ${idParam}${ownerCheck}
         RETURNING *`,
        params
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      
      clearSettingsCache(req.params.id);
      
      return res.json({ site: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err && err.code === '23505') {
        return res.status(409).json({ error: 'That Twilio number is already assigned to another site.' });
      }
      return res.status(500).json({ error: 'Failed to update site' });
    }
  }
);

/** DELETE /sites/:id */
router.delete('/:id', async (req, res) => {
  try {
    const params = [req.params.id];
    let ownerCheck = '';
    
    if (!req.user?.is_admin && req.user?.id) {
      params.push(req.user.id);
      ownerCheck = ` AND owner_id = $${params.length}`;
    }
    
    await pool.query(`DELETE FROM sites WHERE id = $1${ownerCheck}`, params);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;
