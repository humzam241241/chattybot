/**
 * Industry-agnostic attachment (photo) analysis for service requests.
 * Runs vision on images and stores results in attachment_analysis for use in estimates.
 */

const OpenAI = require('openai');

const GENERIC_VISION_PROMPT =
  'Analyze this image in the context of a customer service or repair request. ' +
  'Describe any visible damage, issues, defects, or relevant details. ' +
  'Keep the assessment under 150 words. ' +
  'End with exactly two lines: "Severity: low" or "Severity: medium" or "Severity: high", and "Confidence: 0.0" to "Confidence: 1.0" (one number).';

function getOpenAiClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Run vision on a base64 image and return assessment text + parsed severity/confidence.
 */
async function analyzeImageBase64(base64Image, contentType) {
  const openai = getOpenAiClient();
  if (!openai) return null;

  const dataUrl = `data:${contentType || 'image/jpeg'};base64,${base64Image}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GENERIC_VISION_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    const text = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;

    let severity = null;
    let confidence = null;
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(-3)) {
      const sevMatch = /Severity:\s*(low|medium|high)/i.exec(line);
      if (sevMatch) severity = sevMatch[1].toLowerCase();
      const confMatch = /Confidence:\s*([\d.]+)/i.exec(line);
      if (confMatch) confidence = parseFloat(confMatch[1]);
    }
    if (confidence != null && (confidence < 0 || confidence > 1)) confidence = null;

    return {
      rawAnalysis: text,
      severityAssessment: severity || 'unknown',
      confidence: confidence != null ? confidence : 0.5,
      problemIndicators: [],
      detectedIssues: [],
    };
  } catch (err) {
    console.error('[attachmentAnalysis] Vision error:', err.message);
    return null;
  }
}

/**
 * Get all attachment_analysis rows for a service request (tenant-scoped).
 */
async function getAnalysesForRequest(pool, requestId, siteId) {
  const result = await pool.query(
    `SELECT id, request_id, file_url, file_type, file_name, analysis_status,
            problem_indicators, detected_issues, severity_assessment, confidence, raw_analysis, analyzed_at
     FROM attachment_analysis
     WHERE request_id = $1 AND site_id = $2
     ORDER BY created_at ASC`,
    [requestId, siteId]
  );
  return result.rows;
}

/**
 * Run photo analysis for a service request's attachments and store results.
 * Supports Twilio media URLs (uses mediaVisionService to download). Other URLs are skipped unless we add a safe fetcher.
 */
async function runAnalysisForRequest(pool, siteId, requestId) {
  const requestResult = await pool.query(
    'SELECT id, attachments FROM service_requests WHERE id = $1 AND site_id = $2',
    [requestId, siteId]
  );
  const request = requestResult.rows[0];
  if (!request || !request.attachments || !Array.isArray(request.attachments) || request.attachments.length === 0) {
    return { ok: true, analyzed: 0 };
  }

  let downloadMedia;
  try {
    const mediaVision = require('../mediaVisionService');
    downloadMedia = mediaVision.downloadTwilioMedia || (() => Promise.reject(new Error('No download')));
  } catch {
    downloadMedia = null;
  }

  let analyzed = 0;
  for (let i = 0; i < request.attachments.length; i++) {
    const att = request.attachments[i];
    const url = att?.url || att?.file_url;
    if (!url) continue;

    let base64 = null;
    let contentType = att?.content_type || att?.file_type || 'image/jpeg';

    try {
      if (downloadMedia && typeof url === 'string' && (url.includes('twilio.com') || url.includes('twiliocdn.com'))) {
        const downloaded = await downloadMedia(url, { requestId, siteId });
        if (downloaded?.data) {
          base64 = downloaded.data;
          contentType = downloaded.mimeType || contentType;
        }
      }
    } catch (e) {
      console.error('[attachmentAnalysis] Download failed for request', requestId, e.message);
      await pool.query(
        `INSERT INTO attachment_analysis (site_id, request_id, file_url, file_type, analysis_status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [siteId, requestId, url, contentType, e.message]
      );
      continue;
    }

    if (!base64) continue;

    const analysis = await analyzeImageBase64(base64, contentType);
    if (!analysis) continue;

    await pool.query(
      `INSERT INTO attachment_analysis (
        site_id, request_id, file_url, file_type, file_name,
        analysis_status, problem_indicators, detected_issues,
        severity_assessment, confidence, raw_analysis, analyzed_at
      ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10, NOW())`,
      [
        siteId,
        requestId,
        url,
        contentType,
        att?.filename || att?.name || null,
        JSON.stringify(analysis.problemIndicators || []),
        JSON.stringify(analysis.detectedIssues || []),
        analysis.severityAssessment || null,
        analysis.confidence != null ? analysis.confidence : null,
        analysis.rawAnalysis || null,
      ]
    );
    analyzed += 1;
  }

  return { ok: true, analyzed };
}

module.exports = {
  getAnalysesForRequest,
  runAnalysisForRequest,
  analyzeImageBase64,
};
