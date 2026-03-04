/**
 * Main ingestion orchestrator
 * Coordinates crawling, extraction, chunking, embedding, and storage
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { SiteCrawler } = require('./crawler');
const { processExtractedContent } = require('./extractor');
const { chunkTextWithStats } = require('./chunker');
const { embedChunks, vectorToSql, validateEmbedding } = require('./embedder');

// Configuration from environment
const MAX_PAGES = Number(process.env.INGEST_MAX_PAGES || 150);
const CONCURRENCY = Number(process.env.INGEST_CONCURRENCY || 3);
const MAX_CHUNKS_PER_SITE = 500; // Safety limit to prevent DB bloat

/**
 * Stores chunks with embeddings in the database
 */
async function storeChunksInDatabase(siteId, embeddedChunks) {
  console.log(`[Ingest] Storing ${embeddedChunks.length} chunks in database`);
  
  let stored = 0;
  let failed = 0;
  
  for (const { chunk, embedding } of embeddedChunks) {
    try {
      // Validate embedding before storing
      if (!validateEmbedding(embedding)) {
        console.warn(`[Ingest] Invalid embedding, skipping chunk`);
        failed++;
        continue;
      }
      
      await pool.query(
        `INSERT INTO documents (id, site_id, content, embedding, created_at)
         VALUES ($1, $2, $3, $4::vector, NOW())`,
        [uuidv4(), siteId, chunk, vectorToSql(embedding)]
      );
      
      stored++;
    } catch (error) {
      console.error(`[Ingest] Failed to store chunk: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`[Ingest] Storage complete: ${stored} stored, ${failed} failed`);
  return { stored, failed };
}

/**
 * Processes crawl results: extracts, chunks, embeds, and stores
 */
async function processCrawlResults(siteId, crawlResults) {
  console.log(`[Ingest] Processing ${crawlResults.length} crawled pages`);
  
  let totalChunks = 0;
  let totalStored = 0;
  const pageStats = [];
  
  for (const result of crawlResults) {
    // Skip if we've hit the chunk limit
    if (totalStored >= MAX_CHUNKS_PER_SITE) {
      console.warn(`[Ingest] Reached chunk limit (${MAX_CHUNKS_PER_SITE}), stopping processing`);
      break;
    }
    
    // Process extracted content
    const processed = processExtractedContent(result.text, result.url);
    if (!processed.success) {
      console.warn(`[Ingest] Skipping ${result.url}: ${processed.reason}`);
      continue;
    }
    
    // Chunk the text
    const { chunks, stats } = chunkTextWithStats(processed.text);
    totalChunks += chunks.length;
    
    if (chunks.length === 0) {
      console.warn(`[Ingest] No valid chunks for ${result.url}`);
      continue;
    }
    
    // Calculate how many chunks we can store
    const remaining = MAX_CHUNKS_PER_SITE - totalStored;
    const chunksToEmbed = chunks.slice(0, remaining);
    
    // Embed chunks
    const embeddedChunks = await embedChunks(chunksToEmbed);
    
    // Store in database
    const { stored, failed } = await storeChunksInDatabase(siteId, embeddedChunks);
    totalStored += stored;
    
    pageStats.push({
      url: result.url,
      textLength: result.textLength,
      chunksCreated: chunks.length,
      chunksStored: stored,
      chunksFailed: failed
    });
  }
  
  return {
    totalChunks,
    totalStored,
    pageStats
  };
}

/**
 * Main ingestion function
 * Orchestrates the entire ingestion pipeline for a site
 */
async function runIngestion(siteId, startUrl, options = {}) {
  const startTime = Date.now();
  
  console.log(`[Ingest] Starting ingestion for site ${siteId}`);
  console.log(`[Ingest] URL: ${startUrl}`);
  console.log(`[Ingest] Config: maxPages=${MAX_PAGES}, concurrency=${CONCURRENCY}`);
  
  try {
    // Step 1: Delete existing documents for this site
    console.log(`[Ingest] Clearing existing documents for site ${siteId}`);
    const deleteResult = await pool.query('DELETE FROM documents WHERE site_id = $1', [siteId]);
    console.log(`[Ingest] Deleted ${deleteResult.rowCount} existing documents`);
    
    // Step 2: Crawl the site
    const crawler = new SiteCrawler(startUrl, {
      maxPages: options.maxPages || MAX_PAGES,
      concurrency: options.concurrency || CONCURRENCY
    });
    
    const crawlResult = await crawler.crawl();
    
    if (!crawlResult.success || crawlResult.results.length === 0) {
      throw new Error('Crawling failed or no pages were successfully crawled');
    }
    
    // Step 3: Process results (extract, chunk, embed, store)
    const processResult = await processCrawlResults(siteId, crawlResult.results);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[Ingest] Ingestion complete in ${duration}s`);
    console.log(`[Ingest] Summary: ${crawlResult.pagesCrawled} pages, ${processResult.totalStored} chunks stored`);
    
    return {
      success: true,
      siteId,
      startUrl,
      pagesCrawled: crawlResult.pagesCrawled,
      linksDiscovered: crawlResult.linksDiscovered,
      chunksCreated: processResult.totalChunks,
      chunksStored: processResult.totalStored,
      duration,
      pageStats: processResult.pageStats
    };
    
  } catch (error) {
    console.error(`[Ingest] Ingestion failed for site ${siteId}:`, error);
    
    return {
      success: false,
      siteId,
      startUrl,
      error: error.message,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

module.exports = {
  runIngestion,
  processCrawlResults,
  storeChunksInDatabase,
  MAX_PAGES,
  CONCURRENCY,
  MAX_CHUNKS_PER_SITE
};
