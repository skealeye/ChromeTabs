const test = require('node:test');
const assert = require('node:assert');
const { clampInterval, nextDelay, randomPoint, isThrough, MIN_MS, DEFAULT_MS, MAX_REGIONS, MAX_RUN_MS } = require('../../src/lib/clicker');

test('constants', () => {
  assert.deepStrictEqual([MIN_MS, DEFAULT_MS, MAX_REGIONS, MAX_RUN_MS], [150, 200, 3, 600000]);
});

test('clampInterval', () => {
  assert.strictEqual(clampInterval('50'), 150);
  assert.strictEqual(clampInterval(''), 200);
  assert.strictEqual(clampInterval('abc'), 200);
  assert.strictEqual(clampInterval(9999), 5000);
  assert.strictEqual(clampInterval('175'), 175);
});

test('nextDelay never goes below ms', () => {
  assert.strictEqual(nextDelay(200, () => 0), 200);
  assert.strictEqual(nextDelay(200, () => 1), 240);
  assert.strictEqual(nextDelay(200, () => 1, 0), 200);
  assert.strictEqual(nextDelay(200, () => 1, 50), 300);
});

test('randomPoint stays inside the region', () => {
  assert.deepStrictEqual(randomPoint({ x: 10, y: 20, w: 100, h: 50 }, () => 0), { x: 12, y: 22 });
  const p = randomPoint({ x: 10, y: 20, w: 100, h: 50 }, () => 0.9999);
  assert.ok(p.x <= 107 && p.y <= 67, JSON.stringify(p));
  const tiny = randomPoint({ x: 5, y: 5, w: 2, h: 2 }, () => 0.5);
  assert.ok(tiny.x >= 5 && tiny.x <= 7 && tiny.y >= 5 && tiny.y <= 7);
});

test('isThrough', () => {
  assert.strictEqual(isThrough('https://a.com/p?x=1', 'https://a.com/p?x=2'), false);
  assert.strictEqual(isThrough('https://a.com/p', 'https://a.com/p#h'), false);
  assert.strictEqual(isThrough('https://a.com/p', 'https://a.com/cart'), true);
  assert.strictEqual(isThrough('https://a.com/p', 'https://b.com/p'), true);
  assert.strictEqual(isThrough(null, 'https://b.com/p'), false);
});
