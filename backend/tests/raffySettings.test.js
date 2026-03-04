const { deepMerge } = require('../src/services/raffySettings');

describe('deepMerge', () => {
  test('overrides primitives', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  test('deep merges nested objects', () => {
    const base = { a: { b: 1, c: 2 } };
    const over = { a: { c: 3, d: 4 } };
    expect(deepMerge(base, over)).toEqual({ a: { b: 1, c: 3, d: 4 } });
  });
});

