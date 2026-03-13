/**
 * Plugin Loader
 * Dynamically loads and registers industry plugins
 */

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname);
const loadedPlugins = new Map();

/**
 * Load all plugins from the plugins directory
 */
function loadPlugins() {
  const pluginFolders = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const folder of pluginFolders) {
    try {
      const pluginPath = path.join(PLUGINS_DIR, folder, 'index.js');
      if (fs.existsSync(pluginPath)) {
        const plugin = require(pluginPath);
        if (plugin.slug && plugin.name) {
          loadedPlugins.set(plugin.slug, plugin);
          console.log(`[pluginLoader] Loaded plugin: ${plugin.name} (${plugin.slug})`);
        }
      }
    } catch (err) {
      console.error(`[pluginLoader] Failed to load plugin ${folder}:`, err.message);
    }
  }

  return loadedPlugins;
}

/**
 * Get a loaded plugin by slug
 */
function getPlugin(slug) {
  return loadedPlugins.get(slug);
}

/**
 * Get all loaded plugins
 */
function getAllPlugins() {
  return Array.from(loadedPlugins.values());
}

/**
 * Check if a plugin is loaded
 */
function hasPlugin(slug) {
  return loadedPlugins.has(slug);
}

/**
 * Sync plugin protocols to the database
 */
async function syncPluginProtocols(pool) {
  const plugins = getAllPlugins();

  for (const plugin of plugins) {
    if (!plugin.protocols || !Array.isArray(plugin.protocols)) continue;

    // Get or create industry
    const industryResult = await pool.query(
      `INSERT INTO industries (slug, name, description, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [plugin.slug, plugin.name, plugin.description || '', plugin.icon || '🔧']
    );
    const industryId = industryResult.rows[0].id;

    // Sync protocols
    for (const protocol of plugin.protocols) {
      await pool.query(
        `INSERT INTO service_protocols (
          industry_id, job_type, description, diagnosis_signals,
          typical_labor_hours_min, typical_labor_hours_max,
          material_cost_min, material_cost_max,
          typical_price_min, typical_price_max,
          scope_of_work, risk_factors, requires_inspection,
          urgency_keywords, follow_up_questions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (industry_id, job_type) DO UPDATE SET
          description = EXCLUDED.description,
          diagnosis_signals = EXCLUDED.diagnosis_signals,
          typical_labor_hours_min = EXCLUDED.typical_labor_hours_min,
          typical_labor_hours_max = EXCLUDED.typical_labor_hours_max,
          material_cost_min = EXCLUDED.material_cost_min,
          material_cost_max = EXCLUDED.material_cost_max,
          typical_price_min = EXCLUDED.typical_price_min,
          typical_price_max = EXCLUDED.typical_price_max,
          scope_of_work = EXCLUDED.scope_of_work,
          risk_factors = EXCLUDED.risk_factors,
          requires_inspection = EXCLUDED.requires_inspection,
          urgency_keywords = EXCLUDED.urgency_keywords,
          follow_up_questions = EXCLUDED.follow_up_questions,
          updated_at = NOW()`,
        [
          industryId,
          protocol.job_type,
          protocol.description || '',
          JSON.stringify(protocol.diagnosis_signals || []),
          protocol.typical_labor_hours_min || null,
          protocol.typical_labor_hours_max || null,
          protocol.material_cost_min || null,
          protocol.material_cost_max || null,
          protocol.typical_price_min || null,
          protocol.typical_price_max || null,
          protocol.scope_of_work || '',
          JSON.stringify(protocol.risk_factors || []),
          protocol.requires_inspection !== false,
          JSON.stringify(protocol.urgency_keywords || []),
          JSON.stringify(protocol.follow_up_questions || []),
        ]
      );
    }

    console.log(`[pluginLoader] Synced ${plugin.protocols.length} protocols for ${plugin.name}`);
  }
}

/**
 * Get custom diagnostics for an industry
 */
function getDiagnostics(slug) {
  const plugin = getPlugin(slug);
  return plugin?.diagnostics || null;
}

/**
 * Get custom pricing logic for an industry
 */
function getPricing(slug) {
  const plugin = getPlugin(slug);
  return plugin?.pricing || null;
}

/**
 * Apply plugin-specific estimate adjustments
 */
function applyPluginAdjustments(slug, estimate, context) {
  const pricing = getPricing(slug);
  if (pricing?.adjustEstimate) {
    return pricing.adjustEstimate(estimate, context);
  }
  return estimate;
}

/**
 * Run plugin-specific diagnostics
 */
function runPluginDiagnostics(slug, description, attachments = []) {
  const diagnostics = getDiagnostics(slug);
  if (!diagnostics) return { signals: [], issues: [] };

  const signals = diagnostics.analyzeDescription?.(description) || [];
  const issues = [];

  for (const attachment of attachments) {
    const attachmentIssues = diagnostics.analyzeAttachment?.(attachment) || [];
    issues.push(...attachmentIssues);
  }

  return { signals, issues };
}

module.exports = {
  loadPlugins,
  getPlugin,
  getAllPlugins,
  hasPlugin,
  syncPluginProtocols,
  getDiagnostics,
  getPricing,
  applyPluginAdjustments,
  runPluginDiagnostics,
};
