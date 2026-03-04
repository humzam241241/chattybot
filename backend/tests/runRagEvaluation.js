/**
 * RAG Evaluation Runner
 * 
 * Automated validation system that tests chatbot responses against
 * knowledge base for any tenant site.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getKnowledgeChunks } = require('./loadKnowledgeChunks');
const { generateTestQuestions } = require('./generateTestQuestions');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const DEBUG_RAG = process.env.DEBUG_RAG === 'true';

/**
 * Call chatbot with a test question
 * @param {string} siteId - Site UUID
 * @param {string} question - Test question
 * @returns {Promise<{answer: string, intent: string, context_used: number}>}
 */
async function askChatbot(siteId, question) {
  try {
    const response = await axios.post(`${API_URL}/chat`, {
      site_id: siteId,
      user_message: question,
    }, {
      timeout: 15000,
    });

    return {
      answer: response.data.answer || '',
      intent: response.data.intent || 'unknown',
      context_used: response.data.context_used || 0,
    };
  } catch (err) {
    console.error(`[askChatbot] Error for question "${question}":`, err.message);
    return {
      answer: '',
      intent: 'error',
      context_used: 0,
      error: err.message,
    };
  }
}

/**
 * Score a chatbot response
 * @param {string} question - Test question
 * @param {Object} response - Chatbot response
 * @param {Array<{content: string}>} chunks - Knowledge chunks
 * @returns {Object} - Score breakdown
 */
function scoreResponse(question, response, chunks) {
  let score = 0;
  const breakdown = {
    keyword_match: false,
    depth_ok: false,
    intent_correct: false,
  };

  // Rule 1: Keyword match (check if response contains keywords from chunks)
  const chunkKeywords = chunks
    .flatMap((c) => {
      const words = (c.content || '')
        .toLowerCase()
        .match(/\b\w{4,}\b/g); // Words 4+ chars
      return words || [];
    })
    .filter((w, i, arr) => arr.indexOf(w) === i) // Unique
    .slice(0, 100); // Top 100

  const responseWords = (response.answer || '')
    .toLowerCase()
    .match(/\b\w{4,}\b/g) || [];

  const matchCount = chunkKeywords.filter((kw) => responseWords.includes(kw)).length;
  if (matchCount >= 2) {
    breakdown.keyword_match = true;
    score += 1;
  }

  // Rule 2: Response depth (at least 30 words)
  const wordCount = (response.answer || '').split(/\s+/).filter(Boolean).length;
  if (wordCount >= 30) {
    breakdown.depth_ok = true;
    score += 1;
  }

  // Rule 3: Intent should be 'kb' (knowledge base)
  if (response.intent === 'kb') {
    breakdown.intent_correct = true;
    score += 1;
  }

  return {
    score,
    max_score: 3,
    ...breakdown,
    word_count: wordCount,
    context_chunks: response.context_used,
  };
}

/**
 * Run full RAG evaluation
 * @param {string} siteId - Site UUID
 * @returns {Promise<Object>} - Evaluation report
 */
async function runRagEvaluation(siteId) {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`RAG EVALUATION STARTING`);
  console.log(`Site ID: ${siteId}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`DEBUG_RAG: ${DEBUG_RAG}`);
  console.log(`═══════════════════════════════════════\n`);

  // Step 1: Load knowledge chunks
  console.log('[1/4] Loading knowledge chunks...');
  const chunks = await getKnowledgeChunks(siteId, 200);
  if (chunks.length === 0) {
    console.error('❌ No knowledge chunks found for this site. Run ingestion first.');
    process.exit(1);
  }
  console.log(`✓ Loaded ${chunks.length} chunks\n`);

  // Step 2: Generate test questions
  console.log('[2/4] Generating test questions...');
  const questionsPath = path.join(__dirname, 'generatedQuestions.json');
  const questions = generateTestQuestions(chunks, questionsPath);
  if (questions.length === 0) {
    console.error('❌ Failed to generate test questions');
    process.exit(1);
  }
  console.log(`✓ Generated ${questions.length} questions\n`);

  // Step 3: Run chatbot evaluation
  console.log('[3/4] Evaluating chatbot responses...');
  const results = [];
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    process.stdout.write(`  Testing ${i + 1}/${questions.length}: "${question.slice(0, 50)}..." `);
    
    const response = await askChatbot(siteId, question);
    const scoring = scoreResponse(question, response, chunks);

    if (DEBUG_RAG) {
      console.log('\n[DEBUG]', {
        question,
        answer: response.answer?.slice(0, 100),
        intent: response.intent,
        context_used: response.context_used,
        score: scoring.score,
      });
    } else {
      console.log(`[Score: ${scoring.score}/3]`);
    }

    results.push({
      question,
      response: response.answer,
      intent: response.intent,
      context_used: response.context_used,
      ...scoring,
      error: response.error,
    });

    // Rate limit (avoid overwhelming server)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log('');

  // Step 4: Calculate summary stats
  console.log('[4/4] Generating report...');
  const totalQuestions = results.length;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = totalQuestions * 3;
  const avgScore = (totalScore / totalQuestions).toFixed(2);
  const accuracy = ((totalScore / maxScore) * 100).toFixed(1);

  const summary = {
    site_id: siteId,
    timestamp: new Date().toISOString(),
    total_questions: totalQuestions,
    total_score: totalScore,
    max_score: maxScore,
    average_score: parseFloat(avgScore),
    accuracy_percent: parseFloat(accuracy),
    chunks_loaded: chunks.length,
  };

  const report = {
    summary,
    results,
  };

  // Save report
  const reportPath = path.join(__dirname, 'ragEvaluationReport.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✓ Report saved to ${reportPath}\n`);

  // Print summary
  console.log(`\n═══════════════════════════════════════`);
  console.log(`RAG EVALUATION SUMMARY`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Total Questions:  ${totalQuestions}`);
  console.log(`Average Score:    ${avgScore}/3`);
  console.log(`Accuracy:         ${accuracy}%`);
  console.log(`Chunks Loaded:    ${chunks.length}`);
  console.log(`═══════════════════════════════════════\n`);

  // Accuracy threshold check
  if (parseFloat(accuracy) < 75) {
    console.warn(`⚠️  WARNING: Accuracy is below 75%`);
    console.warn(`    RAG retrieval may be failing.`);
    console.warn(`    Check ingestion, chunking, or embedding quality.\n`);
  } else {
    console.log(`✅ Accuracy is above 75% threshold\n`);
  }

  return report;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  let siteId = null;

  // Parse --site_id argument
  for (const arg of args) {
    if (arg.startsWith('--site_id=')) {
      siteId = arg.split('=')[1];
    }
  }

  if (!siteId) {
    console.error('Usage: npm run test:rag -- --site_id=YOUR_SITE_UUID');
    process.exit(1);
  }

  runRagEvaluation(siteId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Evaluation failed:', err);
      process.exit(1);
    });
}

module.exports = { runRagEvaluation, askChatbot, scoreResponse };
