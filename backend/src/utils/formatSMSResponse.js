function stripMarkdown(input) {
  let s = String(input || '');

  // Normalize newlines
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove fenced code blocks but keep inner text
  s = s.replace(/```[\s\S]*?```/g, (block) => {
    return block
      .replace(/^```[^\n]*\n?/m, '')
      .replace(/```$/m, '')
      .trim();
  });

  // Inline code
  s = s.replace(/`([^`]+)`/g, '$1');

  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');

  // Bold/italic/underline
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');

  // Headings / blockquotes
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  s = s.replace(/^\s{0,3}>\s?/gm, '');

  // List markers
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');

  // Horizontal rules
  s = s.replace(/^\s*([-*_])\1\1+\s*$/gm, '');

  // HTML tags
  s = s.replace(/<\/?[^>]+>/g, '');

  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function truncateToLimit(text, limit) {
  const s = String(text || '').trim();
  if (!limit || s.length <= limit) return s;

  const hard = Math.max(0, limit - 3);
  const slice = s.slice(0, hard);

  // Try to end at a reasonable boundary
  const lastBoundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf(' ')
  );
  const cut = lastBoundary > 120 ? slice.slice(0, lastBoundary + 1).trim() : slice.trim();
  return `${cut}...`;
}

/**
 * formatSMSResponse(text)
 * - plain text
 * - max ~480 characters
 * - remove markdown
 * - friendly tone (light touch; avoids robotic/markdown-y output)
 */
function formatSMSResponse(text) {
  const cleaned = stripMarkdown(text);
  const friendly = cleaned || "Thanks for reaching out — how can we help?";
  return truncateToLimit(friendly, 480);
}

module.exports = { formatSMSResponse };

