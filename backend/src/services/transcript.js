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
 * @param {string} botName - Optional bot name (defaults to 'ASSISTANT')
 * @returns {string} Formatted transcript text
 */
function buildTranscript(conversation, botName = 'ASSISTANT') {
  if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0) {
    return '(No messages in conversation)';
  }

  const lines = [];
  const assistantLabel = String(botName || 'ASSISTANT').toUpperCase();

  for (const msg of conversation.messages) {
    const role = String(msg.role || 'unknown').toUpperCase();
    const content = String(msg.content || '').trim();
    
    // Format: "USER: message text" or "[BOT NAME]: response text"
    const speaker = role === 'USER' ? 'USER' : role === 'ASSISTANT' ? assistantLabel : role;
    
    if (content) {
      lines.push(`${speaker}: ${content}`);
      lines.push(''); // Blank line for readability
    }
  }

  return lines.join('\n').trim();
}

module.exports = { buildTranscript };
