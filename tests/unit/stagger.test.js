const test = require('node:test');
const assert = require('node:assert');
const { staggerDelays } = require('../../src/lib/stagger');

test('staggerDelays', () => {
  assert.deepStrictEqual(staggerDelays(3, () => 0), [0, 150, 300]);
  assert.deepStrictEqual(staggerDelays(3, () => 1), [0, 400, 800]);
  assert.deepStrictEqual(staggerDelays(0), []);
  const d = staggerDelays(10);
  for (let i = 1; i < d.length; i++) {
    const gap = d[i] - d[i - 1];
    assert.ok(gap >= 150 && gap <= 400, `gap ${gap}`);
  }
});
