/**
 * User Auth Middleware
 * 
 * Supports two auth modes:
 * 1. Bearer token (ADMIN_SECRET) - Legacy admin, full access
 * 2. JWT (Supabase session) - User auth with ownership filtering
 */
const { timingSafeEqual } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/database');

const adminSecret = process.env.ADMIN_SECRET || '';
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function isAdminToken(token) {
  if (!adminSecret || adminSecret.length < 16) return false;
  try {
    const a = Buffer.from(token.padEnd(adminSecret.length));
    const b = Buffer.from(adminSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function getOrCreateAppUser(supabaseUser) {
  const { id, email } = supabaseUser;
  
  const existing = await pool.query('SELECT * FROM app_users WHERE id = $1', [id]);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }
  
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  
  const result = await pool.query(
    `INSERT INTO app_users (id, email, trial_ends_at, subscription_status, created_at)
     VALUES ($1, $2, $3, 'trialing', NOW())
     ON CONFLICT (id) DO UPDATE SET email = $2
     RETURNING *`,
    [id, email.toLowerCase(), trialEndsAt]
  );
  
  return result.rows[0];
}

async function userAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.slice(7);
  
  if (isAdminToken(token)) {
    req.user = { isAdmin: true, isSuperAdmin: true };
    req.isAdmin = true;
    return next();
  }
  
  if (!supabase) {
    return res.status(500).json({ error: 'Auth not configured' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const appUser = await getOrCreateAppUser(user);
    const isAdmin = adminEmails.includes(user.email.toLowerCase()) || appUser.is_admin;
    
    req.user = {
      id: user.id,
      email: user.email,
      isAdmin,
      appUser,
    };
    req.isAdmin = isAdmin;
    req.ownerId = user.id;
    
    next();
  } catch (err) {
    console.error('[UserAuth] Error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

function requirePaidOrTrial(req, res, next) {
  if (req.isAdmin) return next();
  
  const appUser = req.user?.appUser;
  if (!appUser) {
    return res.status(403).json({ error: 'Account required' });
  }
  
  const status = appUser.subscription_status;
  const trialEndsAt = appUser.trial_ends_at ? new Date(appUser.trial_ends_at) : null;
  const now = new Date();
  
  const hasAccess = 
    status === 'active' || 
    status === 'lifetime' ||
    (status === 'trialing' && trialEndsAt && trialEndsAt > now);
  
  if (!hasAccess) {
    return res.status(403).json({ 
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
      trialExpired: status === 'trialing' && trialEndsAt && trialEndsAt <= now
    });
  }
  
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { userAuth, requirePaidOrTrial, requireAdmin, getOrCreateAppUser };
