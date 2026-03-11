const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function extractPdf(buffer) {
  console.log('[FileExtract] Extracting PDF...');
  try {
    const data = await pdfParse(buffer);
    console.log('[FileExtract] PDF text length:', data.text.length);
    return data.text;
  } catch (err) {
    console.error('[FileExtract] PDF extraction failed:', err);
    throw err;
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalize(result.value);
}

function extractXlsx(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const parts = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    // Convert to CSV-like text (simple and robust)
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const lines = rows.map((r) => r.map((c) => String(c ?? '')).join(' | '));
    const body = lines.join('\n').trim();
    if (body) {
      parts.push(`Sheet: ${sheetName}\n${body}`);
    }
  }
  return normalize(parts.join('\n\n'));
}

async function extractTextFromFile({ buffer, mimeType, filename }) {
  const name = (filename || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mimeType === 'application/pdf') {
    return await extractPdf(buffer);
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) return await extractPdf(buffer);
  if (mime.includes('word') || name.endsWith('.docx')) return await extractDocx(buffer);
  if (mime.includes('spreadsheet') || name.endsWith('.xlsx')) return extractXlsx(buffer);

  throw new Error(`Unsupported file type: ${mimeType || filename || 'unknown'}`);
}

module.exports = { extractTextFromFile };

