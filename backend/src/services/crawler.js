const axios = require('axios');
const cheerio = require('cheerio');

const MAX_PAGES = 30;       // Hard cap to prevent runaway crawls (Render free tier)
const CRAWL_DELAY_MS = 500; // Polite delay between requests
const REQUEST_TIMEOUT = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;      // 2MB per page
const MAX_TEXT_CHARS = 20_000;               // cap extracted text to avoid OOM

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
          Accept: 'text/html',
        },
        maxRedirects: 5,
        maxContentLength: MAX_HTML_BYTES,
        maxBodyLength: MAX_HTML_BYTES,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) continue;

      const $ = cheerio.load(response.data);
      let text = extractText($);
      if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

      if (text.length > 100) {
        results.push({ url, text });
      }

      // Discover links on the same domain
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const resolved = resolveUrl(href, baseUrl);
        if (resolved && !visited.has(resolved)) {
          queue.push(resolved);
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

function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl.origin);
    // Stay on same hostname, skip anchors/mailto/tel
    if (url.hostname !== baseUrl.hostname) return null;
    if (['#', 'mailto:', 'tel:', 'javascript:'].some((p) => href.startsWith(p))) return null;
    // Skip common non-content paths
    if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|xml|json)$/i.test(url.pathname)) return null;

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
