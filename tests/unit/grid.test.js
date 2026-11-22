const test = require('node:test');
const assert = require('node:assert');
const { gridDims, pageCount, pageOf } = require('../../src/lib/grid');

test('gridDims', () => {
  assert.deepStrictEqual(gridDims(1, 1000, 1000), { cols: 1, rows: 1 });
  assert.deepStrictEqual(gridDims(4, 1600, 1000), { cols: 2, rows: 2 });
  assert.deepStrictEqual(gridDims(20, 1920, 1000), { cols: 5, rows: 4 });
  assert.deepStrictEqual(gridDims(25, 1920, 1000), { cols: 5, rows: 5 });
  assert.deepStrictEqual(gridDims(0, 1920, 1000), { cols: 1, rows: 1 });
});

test('paging', () => {
  assert.strictEqual(pageCount(0), 1);
  assert.strictEqual(pageCount(25), 1);
  assert.strictEqual(pageCount(26), 2);
  assert.strictEqual(pageCount(100), 4);
  assert.strictEqual(pageOf(24), 0);
  assert.strictEqual(pageOf(25), 1);
});
