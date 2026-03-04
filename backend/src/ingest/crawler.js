/**
 * Crawler module for multi-tenant site ingestion.
 * Handles Playwright-based crawling with full React/SPA support.
 *
 * Key design decisions:
 *   - Links are discovered BEFORE any DOM mutation (noise removal).
 *   - Only <script>, <style>, <noscript>, <iframe> are stripped; nav/header/footer
 *     are kept because small-business sites embed critical info there.
 *   - For SPAs with client-side routing, when direct navigation to a sub-page
 *     fails (blank/404), the crawler falls back to navigating from the home page
 *     and clicking the link so React Router renders the content.
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

async function navigatePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  } catch {
    console.warn(`[Ingest] networkidle timeout for ${url}, trying domcontentloaded`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    } catch (e) {
      throw new Error(`Navigation failed: ${e.message}`);
    }
  }
  await page.waitForTimeout(RENDER_SETTLE_MS);
}

/**
 * Returns the visible text length on the page (quick check).
 */
async function getVisibleTextLength(page) {
  return page.evaluate(() => (document.body?.innerText || '').trim().length);
}

/**
 * Checks if the page has enough real content (not a 404 / blank shell).
 */
async function isContentPage(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').trim();
    if (text.length < 80) return false;
    const lower = text.toLowerCase();
    if (text.length < 600) {
      const errorPhrases = ['page not found', '404', 'not found', 'this page could not be found', 'page unavailable'];
      if (errorPhrases.some(p => lower.includes(p))) return false;
    }
    return true;
  });
}

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

async function extractText(page) {
  return page.evaluate(() => {
    document.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());
    const text = document.body?.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  });
}

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

// ──────────────────── SPA client-side navigation ────────────────────────

/**
 * For SPAs (React, Vue, etc.) sub-pages often 404 on direct navigation
 * because the server doesn't have a catch-all rewrite. The content only
 * renders when you navigate from within the app via React Router.
 *
 * This function navigates to the home page, finds the <a> link that
 * matches the target path, clicks it, and waits for content to appear.
 */
async function spaNavigate(page, startUrl, targetUrl) {
  const targetPath = new URL(targetUrl).pathname;
  console.log(`[Ingest] SPA fallback: navigating to ${targetPath} via client-side routing`);

  // Go to the home page first
  await page.goto(startUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(RENDER_SETTLE_MS);

  // Find and click the link that points to our target path
  const clicked = await page.evaluate((path) => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      try {
        const href = new URL(a.href, window.location.origin);
        if (href.pathname === path || href.pathname === path + '/') {
          a.click();
          return true;
        }
      } catch { /* skip malformed hrefs */ }
    }
    return false;
  }, targetPath);

  if (!clicked) {
    // Fallback: use History API to push the route
    console.log(`[Ingest] No matching link found, trying pushState for ${targetPath}`);
    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetPath);
  }

  // Wait for React Router to render the new content
  await page.waitForTimeout(RENDER_SETTLE_MS);

  // Also try waiting for visible text to grow
  try {
    await page.waitForFunction(
      () => (document.body?.innerText || '').trim().length > 200,
      { timeout: 5000 }
    );
  } catch {
    // Content might genuinely be short
  }

  return true;
}

// ────────────────────────── SiteCrawler ─────────────────────────────────

class SiteCrawler {
  constructor(startUrl, opts = {}) {
    this.startUrl = startUrl;
    this.baseHost = new URL(startUrl).hostname;
    this.maxPages = opts.maxPages || 150;
    this.concurrency = opts.concurrency || 3;
    this.isSpa = false; // detected at runtime

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
      let hasContent = await isContentPage(page);

      // ③ SPA fallback: if sub-page is empty, try client-side navigation
      if (!hasContent && url !== this.startUrl && url !== this.startUrl + '/') {
        this.isSpa = true;
        console.log(`[Ingest] Direct navigation failed for ${url}, trying SPA navigation`);

        try {
          await spaNavigate(page, this.startUrl, url);
          hasContent = await isContentPage(page);

          if (hasContent) {
            // Also discover links from the SPA-rendered page
            const spaLinks = await discoverLinks(page, this.baseHost);
            this.totalLinks += spaLinks.length;
            this.enqueue(spaLinks);
          }
        } catch (err) {
          console.warn(`[Ingest] SPA navigation failed for ${url}: ${err.message}`);
        }
      }

      if (!hasContent) {
        console.warn(`[Ingest] Skipping ${url} — no content after all attempts`);
        return null;
      }

      // ④ Extract text (strips only script/style/svg)
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

  /**
   * Sequential worker — processes one URL at a time.
   * For SPAs we use concurrency=1 to avoid race conditions
   * with client-side routing.
   */
  async worker(context, id) {
    while (this.queue.length > 0 && this.pagesCrawled < this.maxPages) {
      const url = this.queue.shift();
      if (!url) break;
      const result = await this.processUrl(context, url);
      if (result) this.results.push(result);
    }
  }

  async crawl() {
    console.log(`[Ingest] Starting crawl: ${this.startUrl} (max ${this.maxPages} pages, concurrency ${this.concurrency})`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext({
        userAgent: CRAWL_UA,
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
      });

      // Start with configured concurrency; if SPA mode is detected
      // during crawl, subsequent pages will use SPA fallback per-page.
      const workers = Array.from({ length: this.concurrency }, (_, i) => this.worker(context, i));
      await Promise.all(workers);

      console.log(`[Ingest] Crawl done — pages: ${this.pagesCrawled}, results: ${this.results.length}, links: ${this.totalLinks}, spa: ${this.isSpa}`);

      return {
        success: true,
        pagesCrawled: this.pagesCrawled,
        linksDiscovered: this.totalLinks,
        results: this.results,
        isSpa: this.isSpa,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = { SiteCrawler, cleanUrl, isSameDomain };
