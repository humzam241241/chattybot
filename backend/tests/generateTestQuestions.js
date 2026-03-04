/**
 * Generate test questions from knowledge chunks
 * 
 * This module extracts topics from ingested content and generates
 * natural test questions to validate RAG performance.
 */

/**
 * Extract potential topics/services from text chunks
 * @param {Array<{content: string}>} chunks - Knowledge chunks
 * @returns {Array<string>} - Extracted topics
 */
function extractTopics(chunks) {
  const topics = new Set();
  
  // Common service/product patterns
  const patterns = [
    /\b(services?|products?|solutions?|offerings?)\s+(include|are|such as):\s*([^.]+)/gi,
    /\bwe (offer|provide|specialize in|deliver)\s+([^,.]+)/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(service|product|solution|repair|installation|maintenance|consultation)/gi,
  ];

  for (const chunk of chunks) {
    const text = chunk.content || '';
    
    // Extract from patterns
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const topic = match[match.length - 1];
        if (topic && topic.length > 3 && topic.length < 80) {
          topics.add(topic.trim().toLowerCase());
        }
      }
    }

    // Extract capitalized phrases (likely proper nouns/services)
    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g);
    if (capitalizedPhrases) {
      for (const phrase of capitalizedPhrases) {
        if (phrase.length > 5 && phrase.length < 50) {
          topics.add(phrase.trim().toLowerCase());
        }
      }
    }
  }

  return Array.from(topics).slice(0, 50); // Cap at 50 topics
}

/**
 * Generate test questions from extracted topics
 * @param {Array<string>} topics - Extracted topics
 * @returns {Array<string>} - Generated questions
 */
function generateQuestions(topics) {
  const questions = [];
  
  const templates = [
    (topic) => `What services do you offer?`,
    (topic) => `Tell me about ${topic}`,
    (topic) => `Do you provide ${topic}?`,
    (topic) => `How does ${topic} work?`,
    (topic) => `Where can I learn about ${topic}?`,
    (topic) => `What is ${topic}?`,
    (topic) => `Can you explain ${topic}?`,
    (topic) => `How much does ${topic} cost?`,
    (topic) => `Do you have information about ${topic}?`,
    (topic) => `What's your pricing for ${topic}?`,
  ];

  // Always add generic questions
  questions.push('What services do you offer?');
  questions.push('What do you do?');
  questions.push('Tell me about your company');
  questions.push('How can you help me?');
  questions.push('What are your main offerings?');

  // Generate topic-specific questions
  for (const topic of topics) {
    for (const template of templates) {
      const question = template(topic);
      if (!questions.includes(question)) {
        questions.push(question);
      }
      
      // Limit total questions
      if (questions.length >= 50) {
        return questions;
      }
    }
  }

  return questions;
}

/**
 * Main function: generate test questions from chunks and save to JSON
 * @param {Array<{content: string}>} chunks - Knowledge chunks
 * @param {string} outputPath - Path to save generated questions
 * @returns {Array<string>} - Generated questions
 */
function generateTestQuestions(chunks, outputPath = null) {
  if (!chunks || chunks.length === 0) {
    console.warn('[generateTestQuestions] No chunks provided');
    return [];
  }

  console.log(`[generateTestQuestions] Extracting topics from ${chunks.length} chunks...`);
  const topics = extractTopics(chunks);
  console.log(`[generateTestQuestions] Extracted ${topics.length} topics`);

  const questions = generateQuestions(topics);
  console.log(`[generateTestQuestions] Generated ${questions.length} test questions`);

  if (outputPath) {
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));
    console.log(`[generateTestQuestions] Saved to ${outputPath}`);
  }

  return questions;
}

module.exports = { generateTestQuestions, extractTopics, generateQuestions };
