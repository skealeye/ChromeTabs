const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchApp } = require('./helpers');

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-settings-')), 'settings.json');
let app, page;
before(async () => {
  fs.writeFileSync(file, JSON.stringify({ clickIntervalMs: 175, jitterPercent: 20, maxRunMinutes: 10 }));
  ({ app, page } = await launchApp({ CHROMETABS_SETTINGS: file }));
});
after(async () => { await app?.close(); });

const readFile = () => JSON.parse(fs.readFileSync(file, 'utf8'));

test('ms box starts from settings.json', async () => {
  assert.strictEqual(await page.inputValue('#assist-ms'), '175');
});

test('editing the file updates the app', async () => {
  fs.writeFileSync(file, JSON.stringify({ clickIntervalMs: 300, jitterPercent: 20, maxRunMinutes: 10 }, null, 2));
  await page.waitForFunction(() => document.getElementById('assist-ms').value === '300', null, { timeout: 4000 });
});

test('changing the ms box saves to the file', async () => {
  await page.fill('#assist-ms', '250');
  await page.focus('#url');
  const end = Date.now() + 3000;
  while (readFile().clickIntervalMs !== 250 && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(readFile().clickIntervalMs, 250);
  assert.strictEqual(readFile().maxRunMinutes, 10);
});

test('a broken file keeps working on defaults and is not overwritten', async () => {
  fs.writeFileSync(file, '{ not json');
  await page.waitForFunction(() => document.getElementById('assist-status').textContent.includes('settings.json'), null, { timeout: 4000 });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ not json');
});
