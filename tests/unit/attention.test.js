const test = require('node:test');
const assert = require('node:assert');
const { nextAttention } = require('../../src/lib/attention');

test('nextAttention', () => {
  assert.strictEqual(nextAttention([false, true, false, true], 1), 3);
  assert.strictEqual(nextAttention([false, true, false, false], 3), 1);
  assert.strictEqual(nextAttention([false, false], 0), -1);
  assert.strictEqual(nextAttention([true, false], 0), 0);
  assert.strictEqual(nextAttention([], 0), -1);
});
