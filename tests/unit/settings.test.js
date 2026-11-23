const test = require('node:test');
const assert = require('node:assert');
const { normalizeSettings, DEFAULT_SETTINGS } = require('../../src/lib/settings');

test('defaults', () => {
  assert.deepStrictEqual(DEFAULT_SETTINGS, { clickIntervalMs: 200, jitterPercent: 20, maxRunMinutes: 10 });
  assert.deepStrictEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepStrictEqual(normalizeSettings('junk'), DEFAULT_SETTINGS);
});

test('clamps', () => {
  assert.deepStrictEqual(normalizeSettings({ clickIntervalMs: 50 }), { ...DEFAULT_SETTINGS, clickIntervalMs: 150 });
  assert.strictEqual(normalizeSettings({ jitterPercent: 90 }).jitterPercent, 50);
  assert.strictEqual(normalizeSettings({ jitterPercent: -5 }).jitterPercent, 0);
  assert.strictEqual(normalizeSettings({ maxRunMinutes: 0 }).maxRunMinutes, 1);
  assert.strictEqual(normalizeSettings({ maxRunMinutes: 999 }).maxRunMinutes, 60);
  assert.strictEqual(normalizeSettings({ clickIntervalMs: '175' }).clickIntervalMs, 175);
});
