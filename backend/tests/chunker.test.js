const { chunkText } = require('../src/services/chunker');

describe('chunkText', () => {
  test('returns empty for very short text', () => {
    expect(chunkText('hi')).toEqual([]);
  });

  test('returns one chunk for medium text', () => {
    const t = 'A'.repeat(300);
    const chunks = chunkText(t);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBeGreaterThan(100);
  });

  test('returns multiple overlapping chunks for long text', () => {
    const t = Array.from({ length: 5000 }, () => 'word').join(' ');
    const chunks = chunkText(t);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

