/**
 * Conversation transcript builder
 * 
 * Formats conversation messages into a human-readable text transcript
 * for email notifications and lead intelligence.
 */

/**
 * Build a formatted transcript from conversation messages
 * @param {Object} conversation - Conversation object with messages array
 * @param {Array<{role: string, content: string}>} conversation.messages - Messages array
 * @returns {string} Formatted transcript text
 */
function buildTranscript(conversation) {
  if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0) {
    return '(No messages in conversation)';
  }

  const lines = [];

  for (const msg of conversation.messages) {
    const role = String(msg.role || 'unknown').toUpperCase();
    const content = String(msg.content || '').trim();
    
    // Format: "USER: message text" or "RAFFY: response text"
    const speaker = role === 'USER' ? 'USER' : role === 'ASSISTANT' ? 'RAFFY' : role;
    
    if (content) {
      lines.push(`${speaker}: ${content}`);
      lines.push(''); // Blank line for readability
    }
  }

  return lines.join('\n').trim();
}

module.exports = { buildTranscript };
