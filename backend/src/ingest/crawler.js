/**
 * Crawler module for multi-tenant site ingestion
 * Handles Playwright-based crawling with React/SPA support
 */

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
const { chromium } = require('playwright');

const CRAWL_UA = 'Mozilla/5.0 (compatible; ChattyBotCrawler/1.0)';
const MAX_RETRIES = 3;
const PAGE_TIMEOUT = 15000;
const HYDRATION_DELAY = 1000;

/**
 * Normalizes URLs by removing hashes and standardizing format
 */
function cleanUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Remove common query params that don't change content
    const queryParams = new URLSearchParams(u.search);
    queryParams.delete('utm_source');
    queryParams.delete('utm_medium');
    queryParams.delete('utm_campaign');
    queryParams.delete('fbclid');
    u.search = queryParams.toString();
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Checks if URL belongs to the same domain
 */
function isSameDomain(url, baseHost) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname === baseHost;
  } catch {
    return false;
  }
}

/**
 * Crawls a page with retry logic and exponential backoff
 */
async function crawlPageWithRetry(page, url, retries = 0) {
  try {
    console.log(`[Ingest] Crawling: ${url}`);
    
    // Navigate and wait for network to be idle
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: PAGE_TIMEOUT 
    });
    
    // Wait for body selector
    await page.waitForSelector('body', { timeout: 10000 }).catch(() => {
      console.warn(`[Ingest] Body selector timeout for ${url}`);
    });
    
    // Allow React/Vue/Angular to hydrate
    await page.waitForTimeout(HYDRATION_DELAY);
    
    return true;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const backoffMs = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
      console.warn(`[Ingest] Retry ${retries + 1}/${MAX_RETRIES} for ${url} after ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return crawlPageWithRetry(page, url, retries + 1);
    }
    console.error(`[Ingest] Failed to crawl ${url} after ${MAX_RETRIES} retries: ${error.message}`);
    return false;
  }
}

/**
 * Extracts clean text content from a page
 * Removes nav, footer, header elements for better quality
 */
async function extractPageContent(page) {
  return await page.evaluate(() => {
    // Remove UI noise elements
    document.querySelectorAll('nav, footer, header, script, style, iframe, noscript').forEach(el => {
      el.remove();
    });
    
    // Extract visible text
    const text = document.body?.innerText || '';
    
    // Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  });
}

/**
 * Discovers internal links from the current page
 */
async function discoverLinks(page, baseHost) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map(a => a.href)
  );
  
  // Normalize, deduplicate, and filter to same domain
  const cleanedLinks = Array.from(
    new Set(
      links
        .map(l => cleanUrl(l))
        .filter(Boolean)
        .filter(l => isSameDomain(l, baseHost))
    )
  );
  
  console.log(`[Ingest] Links discovered: ${cleanedLinks.length}`);
  return cleanedLinks;
}

/**
 * Main crawler class implementing BFS crawling with concurrency
 */
class SiteCrawler {
  constructor(startUrl, options = {}) {
    this.startUrl = startUrl;
    this.baseHost = new URL(startUrl).hostname;
    this.maxPages = options.maxPages || 150;
    this.concurrency = options.concurrency || 3;
    
    this.visited = new Set();
    this.queue = [startUrl];
    this.pagesCrawled = 0;
    this.linksDiscovered = 0;
    this.results = [];
  }
  
  /**
   * Processes a single URL from the queue
   */
  async processUrl(browser, url) {
    if (this.visited.has(url)) return null;
    if (!isSameDomain(url, this.baseHost)) return null;
    
    this.visited.add(url);
    this.pagesCrawled++;
    
    const page = await browser.newPage();
    
    try {
      const success = await crawlPageWithRetry(page, url);
      if (!success) return null;
      
      // Extract content
      const text = await extractPageContent(page);
      console.log(`[Ingest] Text length: ${text.length}`);
      
      // Quality filter: skip pages with minimal content
      if (text.length < 300) {
        console.warn(`[Ingest] Skipping ${url} - insufficient content (${text.length} chars)`);
        return null;
      }
      
      // Quality filter: skip error pages
      const textLower = text.toLowerCase();
      const errorPatterns = ['404', 'not found', 'page not found', 'error', 'page unavailable'];
      if (errorPatterns.some(pattern => textLower.includes(pattern) && text.length < 1000)) {
        console.warn(`[Ingest] Skipping ${url} - appears to be error page`);
        return null;
      }
      
      // Discover new links
      const links = await discoverLinks(page, this.baseHost);
      this.linksDiscovered += links.length;
      
      // Add new links to queue
      for (const link of links) {
        if (!this.visited.has(link) && !this.queue.includes(link)) {
          if (this.queue.length + this.visited.size < this.maxPages * 2) {
            this.queue.push(link);
          }
        }
      }
      
      return {
        url,
        text,
        textLength: text.length,
        linksFound: links.length
      };
      
    } finally {
      await page.close().catch(() => {});
    }
  }
  
  /**
   * Worker that processes URLs from the queue
   */
  async worker(browser, workerId) {
    while (this.queue.length > 0 && this.pagesCrawled < this.maxPages) {
      const url = this.queue.shift();
      if (!url) continue;
      
      const result = await this.processUrl(browser, url);
      if (result) {
        this.results.push(result);
      }
    }
  }
  
  /**
   * Starts crawling with concurrent workers
   */
  async crawl() {
    console.log(`[Ingest] Starting crawl for ${this.startUrl} (max ${this.maxPages} pages, ${this.concurrency} workers)`);
    
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    try {
      const context = await browser.newContext({ 
        userAgent: CRAWL_UA,
        viewport: { width: 1280, height: 720 }
      });
      
      // Create worker pool
      const workers = [];
      for (let i = 0; i < this.concurrency; i++) {
        workers.push(this.worker(context, i));
      }
      
      // Wait for all workers to complete
      await Promise.all(workers);
      
      console.log(`[Ingest] Crawl complete. Pages: ${this.pagesCrawled}, Links discovered: ${this.linksDiscovered}`);
      
      return {
        success: true,
        pagesCrawled: this.pagesCrawled,
        linksDiscovered: this.linksDiscovered,
        results: this.results
      };
      
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = {
  SiteCrawler,
  cleanUrl,
  isSameDomain,
  crawlPageWithRetry,
  extractPageContent,
  discoverLinks
};
