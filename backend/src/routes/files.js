const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const adminAuth = require('../middleware/adminAuth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getSupabaseClient, getUploadsBucket } = require('../services/supabaseStorage');
const { extractTextFromFile } = require('../services/fileExtract');
const { chunkText } = require('../services/chunker');
const { embedBatch, vectorToSql } = require('../services/embeddings');

const router = express.Router();
router.use(adminAuth);
router.use(apiLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file (MVP safety)
    files: 5,
  },
});

function safeFilename(name) {
  return String(name || 'upload')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

async function ensureSite(siteId) {
  const siteCheck = await pool.query('SELECT id FROM sites WHERE id = $1', [siteId]);
  return siteCheck.rows.length > 0;
}

async function embedAndStoreFileChunks({ siteId, fileId, text }) {
  const chunks = chunkText(text);
  const MAX_CHUNKS_PER_FILE = 300;
  const EMBED_BATCH_SIZE = 10;
  const limited = chunks.slice(0, MAX_CHUNKS_PER_FILE);

  for (let i = 0; i < limited.length; i += EMBED_BATCH_SIZE) {
    const batch = limited.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      await pool.query(
        `INSERT INTO documents (id, site_id, content, embedding, source_type, source_id, created_at)
         VALUES ($1, $2, $3, $4::vector, 'file', $5, NOW())`,
        [uuidv4(), siteId, batch[j], vectorToSql(embeddings[j]), fileId]
      );
    }

    // help GC on small instances
    batch.length = 0;
  }

  return limited.length;
}

// POST /api/admin/files/upload (multipart)
router.post('/upload', upload.array('files', 5), async (req, res) => {
  const siteId = req.body.site_id;
  if (!siteId) return res.status(400).json({ error: 'site_id required' });

  const files = req.files || [];
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded. Use form field name "files".' });
  }

  if (!(await ensureSite(siteId))) {
    return res.status(404).json({ error: 'Site not found' });
  }

  const supabase = getSupabaseClient();
  const bucket = getUploadsBucket();

  const results = [];

  for (const f of files) {
    const fileId = uuidv4();
    const originalName = f.originalname || 'upload';
    const path = `${siteId}/${fileId}/${safeFilename(originalName)}`;

    try {
      // 1) Upload raw file to Supabase Storage
      const up = await supabase.storage.from(bucket).upload(path, f.buffer, {
        contentType: f.mimetype,
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      // 2) Create DB record (processing)
      await pool.query(
        `INSERT INTO files (id, site_id, storage_path, original_name, mime_type, size_bytes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'processing', NOW())`,
        [fileId, siteId, path, originalName, f.mimetype, f.size]
      );

      // 3) Extract text
      const text = await extractTextFromFile({
        buffer: f.buffer,
        mimeType: f.mimetype,
        filename: originalName,
      });
      if (!text || text.length < 50) throw new Error('No extractable text found');

      // 4) Embed + store chunks immediately
      const chunksStored = await embedAndStoreFileChunks({ siteId, fileId, text });

      // 5) Mark ready
      await pool.query(`UPDATE files SET status='ready', error=NULL WHERE id=$1`, [fileId]);

      results.push({ file_id: fileId, original_name: originalName, status: 'ready', chunks_stored: chunksStored });
    } catch (err) {
      console.error('File upload ingest error:', err);
      await pool.query(`UPDATE files SET status='failed', error=$2 WHERE id=$1`, [fileId, err.message]).catch(() => {});
      results.push({ file_id: fileId, original_name: originalName, status: 'failed', error: err.message });
    }
  }

  return res.json({ results });
});

// GET /api/admin/files/:site_id
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, original_name, mime_type, size_bytes, status, error, created_at
       FROM files
       WHERE site_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [site_id]
    );
    return res.json({ files: result.rows });
  } catch (err) {
    console.error('List files error:', err);
    return res.status(500).json({ error: 'Failed to list files' });
  }
});

// POST /api/admin/files/reprocess/:file_id
router.post('/reprocess/:file_id', async (req, res) => {
  const { file_id } = req.params;
  try {
    const fileRes = await pool.query('SELECT * FROM files WHERE id = $1', [file_id]);
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = fileRes.rows[0];

    const supabase = getSupabaseClient();
    const bucket = getUploadsBucket();

    await pool.query(`UPDATE files SET status='processing', error=NULL WHERE id=$1`, [file_id]);
    await pool.query(`DELETE FROM documents WHERE site_id=$1 AND source_type='file' AND source_id=$2`, [file.site_id, file_id]);

    const dl = await supabase.storage.from(bucket).download(file.storage_path);
    if (dl.error) throw new Error(dl.error.message);
    const arrayBuffer = await dl.data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractTextFromFile({ buffer, mimeType: file.mime_type, filename: file.original_name });
    const chunksStored = await embedAndStoreFileChunks({ siteId: file.site_id, fileId: file_id, text });

    await pool.query(`UPDATE files SET status='ready', error=NULL WHERE id=$1`, [file_id]);
    return res.json({ success: true, chunks_stored: chunksStored });
  } catch (err) {
    console.error('Reprocess file error:', err);
    await pool.query(`UPDATE files SET status='failed', error=$2 WHERE id=$1`, [file_id, err.message]).catch(() => {});
    return res.status(500).json({ error: 'Failed to reprocess file' });
  }
});

// DELETE /api/admin/files/:file_id
router.delete('/file/:file_id', async (req, res) => {
  const { file_id } = req.params;
  try {
    const fileRes = await pool.query('SELECT * FROM files WHERE id = $1', [file_id]);
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = fileRes.rows[0];

    const supabase = getSupabaseClient();
    const bucket = getUploadsBucket();

    await pool.query(`DELETE FROM documents WHERE site_id=$1 AND source_type='file' AND source_id=$2`, [file.site_id, file_id]);
    await pool.query(`DELETE FROM files WHERE id=$1`, [file_id]);

    // Best-effort remove from storage
    await supabase.storage.from(bucket).remove([file.storage_path]).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete file error:', err);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;

