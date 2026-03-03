const axios = require('axios');
const cheerio = require('cheerio');

const MAX_PAGES = 30;       // Hard cap to prevent runaway crawls (Render free tier)
const CRAWL_DELAY_MS = 500; // Polite delay between requests
const REQUEST_TIMEOUT = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;      // 2MB per page
const MAX_TEXT_CHARS = 20_000;               // cap extracted text to avoid OOM
const MAX_LINKS_PER_PAGE = 200;              // cap link extraction per page
const MAX_SITEMAP_URLS = 2000;               // cap sitemap expansion
const JS_RENDER_ENABLED = (process.env.CRAWL_RENDER_JS || '').toLowerCase() === 'true';
const JS_RENDER_TIMEOUT_MS = Number(process.env.CRAWL_RENDER_TIMEOUT_MS || 15000);
const JS_RENDER_MAX_PAGES = Number(process.env.CRAWL_RENDER_MAX_PAGES || 5); // keep free tier safe

/**
 * Crawl a website starting from the given URL.
 * Stays within the same hostname. Extracts visible text only.
 * 
 * @param {string} startUrl - e.g. "https://example.com"
 * @returns {Promise<{ url: string, text: string }[]>}
 */
async function crawlSite(startUrl) {
  const baseUrl = new URL(startUrl);
  const visited = new Set();
  const queue = [startUrl];
  const results = [];
  let jsRenderedPages = 0;

  while (queue.length > 0 && results.length < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      await delay(CRAWL_DELAY_MS);

      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'ChattyBot/1.0 (AI assistant crawler; polite)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
        },
        maxRedirects: 5,
        maxContentLength: MAX_HTML_BYTES,
        maxBodyLength: MAX_HTML_BYTES,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = (response.headers['content-type'] || '').toLowerCase();
      const raw = typeof response.data === 'string' ? response.data : String(response.data);

      // Handle sitemap / XML formats (common for non-HTML sites)
      if (isLikelyXml(contentType, raw)) {
        const urls = extractSitemapUrls(raw, baseUrl).slice(0, MAX_SITEMAP_URLS);
        for (const u of urls) {
          if (!visited.has(u)) queue.push(u);
        }
        continue;
      }

      // Handle plain text endpoints (some sites serve text pages / markdown proxies)
      if (contentType.includes('text/plain')) {
        const text = normalizeText(raw).slice(0, MAX_TEXT_CHARS);
        if (text.length > 100) results.push({ url, text });
        continue;
      }

      // Default: HTML (or unknown type that looks like HTML)
      if (!isLikelyHtml(contentType, raw)) continue;

      const $ = cheerio.load(raw);
      let text = extractText($);
      if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

      // Some modern sites render content client-side (React/Vue/Next SPA).
      // Static HTML will look like an empty shell; optionally render with a headless browser.
      if (
        JS_RENDER_ENABLED &&
        jsRenderedPages < JS_RENDER_MAX_PAGES &&
        looksLikeSpaShell(raw, text)
      ) {
        const rendered = await tryRenderJsPage(url, JS_RENDER_TIMEOUT_MS);
        if (rendered && rendered.length > text.length) {
          text = rendered.slice(0, MAX_TEXT_CHARS);
          jsRenderedPages++;
        }
      }

      if (text.length > 100) {
        results.push({ url, text });
      }

      // Discover links on the same domain
      let linksAdded = 0;
      $('a[href]').each((_, el) => {
        if (linksAdded >= MAX_LINKS_PER_PAGE) return false;
        const href = $(el).attr('href');
        const resolved = resolveUrl(href, baseUrl);
        if (resolved && !visited.has(resolved)) {
          queue.push(resolved);
          linksAdded++;
        }
      });
    } catch (err) {
      // Log and continue — one bad page shouldn't stop the crawl
      console.warn(`Crawler skipped ${url}: ${err.message}`);
    }
  }

  return results;
}

/**
 * Extracts visible text from a Cheerio document.
 * Removes scripts, styles, nav, footer, ads.
 */
function extractText($) {
  // Remove noise elements
  $('script, style, noscript, nav, footer, header, iframe, svg, [aria-hidden="true"]').remove();
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [id*="ad"]').remove();

  // Get text from meaningful content areas first, fall back to body
  const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];

  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) return text;
    }
  }

  return $('body').text().replace(/\s+/g, ' ').trim();
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function looksLikeSpaShell(rawHtml, extractedText) {
  // Heuristic: very little visible text but lots of scripts / app root markers.
  if (extractedText && extractedText.length > 400) return false;
  const lower = rawHtml.slice(0, 50_000).toLowerCase();
  const hasAppRoot =
    lower.includes('id="__next"') ||
    lower.includes('id="root"') ||
    lower.includes('data-reactroot') ||
    lower.includes('ng-version=');
  const scriptCount = (lower.match(/<script\b/g) || []).length;
  return hasAppRoot || scriptCount >= 10;
}

async function tryRenderJsPage(url, timeoutMs) {
  // Optional dependency: this will only work if Playwright is installed and
  // the runtime has a Chromium binary available. We keep it optional so
  // production deployments can stay lightweight on free tiers.
  try {
    const playwright = await importPlaywright();
    if (!playwright) return null;

    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Give client JS a brief chance to render
      await page.waitForTimeout(1200);

      const text = await page.evaluate(() => {
        const t = document.body?.innerText || '';
        return t.replace(/\s+/g, ' ').trim();
      });

      return text || null;
    } finally {
      await browser.close();
    }
  } catch (err) {
    // Fail silently — fallback to static mode
    console.warn(`[Crawler] JS render skipped for ${url}: ${err.message}`);
    return null;
  }
}

async function importPlaywright() {
  // Works for both CJS/ESM environments when available
  try {
    // eslint-disable-next-line global-require
    return require('playwright');
  } catch {
    try {
      const mod = await import('playwright');
      return mod;
    } catch {
      return null;
    }
  }
}

function isLikelyHtml(contentType, raw) {
  if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) return true;
  const head = raw.slice(0, 300).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.includes('<head') || head.includes('<body');
}

function isLikelyXml(contentType, raw) {
  if (contentType.includes('application/xml') || contentType.includes('text/xml')) return true;
  const head = raw.slice(0, 300).toLowerCase();
  return head.includes('<?xml') || head.includes('<urlset') || head.includes('<sitemapindex');
}

function extractSitemapUrls(xml, baseUrl) {
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls = [];

    // urlset (normal sitemap)
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      const resolved = resolveAbsoluteUrl(loc, baseUrl);
      if (resolved) urls.push(resolved);
    });

    // sitemapindex (index of sitemaps)
    if (urls.length === 0) {
      $('sitemap > loc').each((_, el) => {
        const loc = $(el).text().trim();
        const resolved = resolveAbsoluteUrl(loc, baseUrl);
        if (resolved) urls.push(resolved);
      });
    }

    return urls;
  } catch {
    return [];
  }
}

function resolveAbsoluteUrl(loc, baseUrl) {
  if (!loc) return null;
  try {
    const u = new URL(loc, baseUrl.origin);
    if (u.hostname !== baseUrl.hostname) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl.origin);
    // Stay on same hostname, skip anchors/mailto/tel
    if (url.hostname !== baseUrl.hostname) return null;
    if (['#', 'mailto:', 'tel:', 'javascript:'].some((p) => href.startsWith(p))) return null;
    // Skip common non-content paths
    if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|json)$/i.test(url.pathname)) return null;
    // Allow sitemap XML explicitly; skip other XML by default
    if (/\.xml$/i.test(url.pathname) && !/sitemap/i.test(url.pathname)) return null;

    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { crawlSite };
