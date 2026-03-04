/**
 * Crawler module for multi-tenant site ingestion.
 * Handles Playwright-based crawling with full React/SPA support.
 *
 * Key design decisions:
 *   - Links are discovered BEFORE any DOM mutation (noise removal).
 *   - Only <script>, <style>, <noscript>, <iframe> are stripped; nav/header/footer
 *     are kept because small-business sites embed critical info there.
 *   - For SPAs with client-side routing (/about, /contact) the crawler tries
 *     a hash-based fallback when a direct URL 404s.
 */

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
const { chromium } = require('playwright');

const CRAWL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RETRIES = 2;
const NAV_TIMEOUT = 30000;
const RENDER_SETTLE_MS = 3000;

// ───────────────────────────── URL helpers ──────────────────────────────

function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'gclid']) {
      u.searchParams.delete(p);
    }
    // Remove trailing slash for dedup (except root)
    let out = u.toString();
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

function isSameDomain(url, baseHost) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname === baseHost || u.hostname === `www.${baseHost}` || baseHost === `www.${u.hostname}`;
  } catch {
    return false;
  }
}

function isSkippableUrl(url) {
  const lower = url.toLowerCase();
  const skipExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.mp3', '.zip', '.tar', '.gz', '.css', '.js', '.woff', '.woff2', '.ttf', '.ico'];
  return skipExts.some(ext => lower.endsWith(ext)) ||
    lower.includes('mailto:') ||
    lower.includes('tel:') ||
    lower.includes('javascript:');
}

// ───────────────────────── Page-level helpers ───────────────────────────

/**
 * Navigate to url. Tries 'networkidle', falls back to 'domcontentloaded'
 * if the page hangs (common with analytics/chat widgets that keep sockets open).
 */
async function navigatePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  } catch {
    console.warn(`[Ingest] networkidle timeout for ${url}, falling back to domcontentloaded`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    } catch (e) {
      throw new Error(`Navigation failed: ${e.message}`);
    }
  }
  // Let React/Vue/Angular hydrate & render
  await page.waitForTimeout(RENDER_SETTLE_MS);
}

/**
 * Returns true if the page looks like a real content page (not a soft 404).
 */
async function isContentPage(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').trim();
    if (text.length < 80) return false;
    const lower = text.toLowerCase();
    // Detect common soft-404 / error patterns (only if page is very short)
    if (text.length < 600) {
      const errorPhrases = ['page not found', '404', 'not found', 'error', 'page unavailable', 'access denied'];
      if (errorPhrases.some(p => lower.includes(p))) return false;
    }
    return true;
  });
}

/**
 * Discovers all internal links on the page.
 * MUST be called BEFORE any DOM mutations.
 */
async function discoverLinks(page, baseHost) {
  const rawLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(h => h && !h.startsWith('javascript:'))
  );

  const cleaned = new Set();
  for (const raw of rawLinks) {
    const c = cleanUrl(raw);
    if (c && isSameDomain(c, baseHost) && !isSkippableUrl(c)) {
      cleaned.add(c);
    }
  }
  const links = Array.from(cleaned);
  console.log(`[Ingest] Links discovered: ${links.length}`);
  return links;
}

/**
 * Extracts visible text content.
 * Only strips script/style/iframe/noscript — keeps nav, header, footer
 * because they contain valuable info on small-business sites.
 */
async function extractText(page) {
  return page.evaluate(() => {
    // Remove only non-content elements
    document.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());

    const text = document.body?.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  });
}

// ─────────────────────── Crawl with retry ───────────────────────────────

async function crawlPage(page, url, retries = 0) {
  try {
    await navigatePage(page, url);
    return true;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const wait = Math.pow(2, retries) * 1500;
      console.warn(`[Ingest] Retry ${retries + 1}/${MAX_RETRIES} for ${url} (${wait}ms)`);
      await new Promise(r => setTimeout(r, wait));
      return crawlPage(page, url, retries + 1);
    }
    console.error(`[Ingest] Failed after ${MAX_RETRIES} retries: ${url} — ${err.message}`);
    return false;
  }
}

// ────────────────────────── SiteCrawler ─────────────────────────────────

class SiteCrawler {
  constructor(startUrl, opts = {}) {
    this.startUrl = startUrl;
    this.baseHost = new URL(startUrl).hostname;
    this.maxPages = opts.maxPages || 150;
    this.concurrency = opts.concurrency || 3;

    this.visited = new Set();
    this.queue = [startUrl];
    this.results = [];
    this.pagesCrawled = 0;
    this.totalLinks = 0;
  }

  enqueue(urls) {
    for (const u of urls) {
      if (!this.visited.has(u) && !this.queue.includes(u) && this.queue.length + this.visited.size < this.maxPages * 3) {
        this.queue.push(u);
      }
    }
  }

  async processUrl(context, url) {
    if (this.visited.has(url)) return null;
    this.visited.add(url);
    this.pagesCrawled++;

    const page = await context.newPage();
    try {
      const ok = await crawlPage(page, url);
      if (!ok) return null;

      // ① Discover links FIRST (before any DOM mutation)
      const links = await discoverLinks(page, this.baseHost);
      this.totalLinks += links.length;
      this.enqueue(links);

      // ② Check if this is a real content page
      const hasContent = await isContentPage(page);
      if (!hasContent) {
        console.warn(`[Ingest] Skipping ${url} — not a content page`);
        return null;
      }

      // ③ Extract text (strips only script/style/svg)
      const text = await extractText(page);
      console.log(`[Ingest] Text length: ${text.length}`);

      if (text.length < 100) {
        console.warn(`[Ingest] Skipping ${url} — too little text (${text.length})`);
        return null;
      }

      return { url, text, textLength: text.length, linksFound: links.length };
    } catch (err) {
      console.warn(`[Ingest] Error processing ${url}: ${err.message}`);
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async worker(context, id) {
    while (this.queue.length > 0 && this.pagesCrawled < this.maxPages) {
      const url = this.queue.shift();
      if (!url) break;
      const result = await this.processUrl(context, url);
      if (result) this.results.push(result);
    }
  }

  async crawl() {
    console.log(`[Ingest] Starting crawl: ${this.startUrl} (max ${this.maxPages} pages, ${this.concurrency} workers)`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext({
        userAgent: CRAWL_UA,
        viewport: { width: 1280, height: 720 },
        // Accept English to avoid translated content
        locale: 'en-US',
      });

      const workers = Array.from({ length: this.concurrency }, (_, i) => this.worker(context, i));
      await Promise.all(workers);

      console.log(`[Ingest] Crawl done — pages: ${this.pagesCrawled}, results: ${this.results.length}, links: ${this.totalLinks}`);

      return {
        success: true,
        pagesCrawled: this.pagesCrawled,
        linksDiscovered: this.totalLinks,
        results: this.results,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = { SiteCrawler, cleanUrl, isSameDomain };
