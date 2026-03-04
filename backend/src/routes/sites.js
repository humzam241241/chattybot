const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { apiLimiter } = require('../middleware/rateLimiter');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// All site management routes require admin auth
router.use(adminAuth);
router.use(apiLimiter);

/** GET /sites — list all sites */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, company_name, domain, primary_color, tone, created_at FROM sites ORDER BY created_at DESC'
    );
    return res.json({ sites: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

/** GET /sites/:id — get single site */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sites WHERE id = $1', [req.params.id]);
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
    body('system_prompt').optional().isString().trim().isLength({ max: 2000 }),
    body('raffy_overrides').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { company_name, domain, primary_color, tone, system_prompt, raffy_overrides } = req.body;

    try {
      const id = uuidv4();
      const result = await pool.query(
        `INSERT INTO sites (id, company_name, domain, primary_color, tone, system_prompt, raffy_overrides, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, company_name, domain, primary_color || '#6366f1', tone || null, system_prompt || null, raffy_overrides || {}]
      );
      return res.status(201).json({ site: result.rows[0] });
    } catch (err) {
      console.error(err);
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
    body('system_prompt').optional().isString().trim().isLength({ max: 2000 }),
    body('raffy_overrides').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { company_name, domain, primary_color, tone, system_prompt, raffy_overrides } = req.body;

    try {
      const result = await pool.query(
        `UPDATE sites
         SET company_name = COALESCE($1, company_name),
             domain = COALESCE($2, domain),
             primary_color = COALESCE($3, primary_color),
             tone = COALESCE($4, tone),
             system_prompt = COALESCE($5, system_prompt),
             raffy_overrides = COALESCE($6, raffy_overrides)
         WHERE id = $7
         RETURNING *`,
        [company_name, domain, primary_color, tone, system_prompt, raffy_overrides, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ site: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update site' });
    }
  }
);

/** DELETE /sites/:id */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;
