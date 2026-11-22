const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, clampCount } = require('../../src/lib/url');

test('normalizeUrl', () => {
  assert.strictEqual(normalizeUrl(' costco.com/x '), 'https://costco.com/x');
  assert.strictEqual(normalizeUrl('abc def'), null);
  assert.strictEqual(normalizeUrl('abc'), null);
  assert.strictEqual(normalizeUrl('ftp://x.com'), null);
  assert.strictEqual(normalizeUrl(''), null);
  assert.strictEqual(normalizeUrl('http://127.0.0.1:5000/a'), 'http://127.0.0.1:5000/a');
  assert.strictEqual(normalizeUrl('localhost:3000'), 'https://localhost:3000/');
});

test('clampCount', () => {
  assert.strictEqual(clampCount(''), 20);
  assert.strictEqual(clampCount('0'), 1);
  assert.strictEqual(clampCount('99'), 99);
  assert.strictEqual(clampCount('500'), 100);
  assert.strictEqual(clampCount('abc'), 20);
  assert.strictEqual(clampCount(5), 5);
});
