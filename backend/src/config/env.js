/**
 * Environment Configuration & Validation
 * 
 * Validates required environment variables at startup.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
];

const OPTIONAL_VARS = [
  'NODE_ENV',
  'PORT',
  'ADMIN_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'LEAD_NOTIFICATION_EMAIL',
  'ADMIN_DASHBOARD_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOWED_ORIGINS',
  'INGEST_MAX_PAGES',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_WHATSAPP_NUMBER',
  'TWILIO_DEFAULT_SITE_ID',
  'ANTHROPIC_API_KEY',
  'CLAUDE_VISION_MODEL',
];

/**
 * Validate environment variables
 * @param {boolean} strict - throw on missing required vars
 * @returns {Object} validation result
 */
function validateEnvironment(strict = false) {
  const missing = [];
  const present = [];
  const optional = [];

  for (const key of REQUIRED_VARS) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  for (const key of OPTIONAL_VARS) {
    if (process.env[key]) {
      optional.push(key);
    }
  }

  const result = {
    valid: missing.length === 0,
    required: { present, missing },
    optional,
  };

  if (strict && missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return result;
}

/**
 * Log environment status
 */
function logEnvironmentStatus() {
  const result = validateEnvironment();
  
  console.log('[ENV] Environment validation:');
  console.log(`  Required: ${result.required.present.length}/${REQUIRED_VARS.length} configured`);
  
  if (result.required.missing.length > 0) {
    console.warn(`  MISSING: ${result.required.missing.join(', ')}`);
  }
  
  console.log(`  Optional: ${result.optional.length}/${OPTIONAL_VARS.length} configured`);
  
  // Check specific features
  const hasEmail = ['RESEND_API_KEY', 'EMAIL_FROM'].every((k) => process.env[k]);
  const hasSupabase = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .every(k => process.env[k]);
  
  console.log(`  Features:`);
  console.log(`    - Email notifications: ${hasEmail ? '✓' : '○'}`);
  console.log(`    - Supabase storage: ${hasSupabase ? '✓' : '○'}`);
  console.log(`    - Admin dashboard URL: ${process.env.ADMIN_DASHBOARD_URL ? '✓' : '○'}`);
  
  return result;
}

/**
 * Get environment value with default
 * @param {string} key
 * @param {any} defaultValue
 * @returns {string}
 */
function getEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Get environment value as integer
 * @param {string} key
 * @param {number} defaultValue
 * @returns {number}
 */
function getEnvInt(key, defaultValue = 0) {
  const val = process.env[key];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get environment value as boolean
 * @param {string} key
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function getEnvBool(key, defaultValue = false) {
  const val = process.env[key];
  if (!val) return defaultValue;
  return ['true', '1', 'yes'].includes(val.toLowerCase());
}

module.exports = {
  REQUIRED_VARS,
  OPTIONAL_VARS,
  validateEnvironment,
  logEnvironmentStatus,
  getEnv,
  getEnvInt,
  getEnvBool,
};
