async function loadSiteAccessRow(pool, siteId) {
  const r = await pool.query(`SELECT id, owner_id FROM sites WHERE id = $1`, [siteId]);
  return r.rows?.[0] || null;
}

function authorizeSiteAccess(user, site) {
  if (!user || !site) return false;
  if (user.is_admin) return true;
  return Boolean(site.owner_id) && site.owner_id === user.id;
}

/**
 * Returns { ok, status, error, site }
 * - 404 if site does not exist
 * - 403 if site exists but user doesn't have access
 */
async function checkSiteAccess(pool, user, siteId) {
  const site = await loadSiteAccessRow(pool, siteId);
  if (!site) return { ok: false, status: 404, error: 'Site not found', site: null };
  if (!authorizeSiteAccess(user, site)) return { ok: false, status: 403, error: 'Forbidden', site };
  return { ok: true, status: 200, error: null, site };
}

module.exports = {
  authorizeSiteAccess,
  checkSiteAccess,
};

