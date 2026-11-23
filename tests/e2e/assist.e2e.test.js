const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, launchApp, openPanes, inPane } = require('./helpers');

let srv, app, page;
const errors = [];
before(async () => {
  srv = await startServer();
  ({ app, page } = await launchApp());
  page.on('pageerror', (e) => errors.push(e));
});
after(async () => {
  await app?.close();
  srv?.server.close();
});

const running = () => page.evaluate(() => window.CT.assist.running());

test('clicks regions (dismissing the error popup) until the page moves on', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.click('#view-tabs');
  await page.evaluate(() => {
    window.CT.assist.addRegion(0, { x: 40, y: 80, w: 160, h: 50 });
    window.CT.assist.addRegion(0, { x: 300, y: 300, w: 120, h: 40 });
  });
  await page.fill('#assist-ms', '150');
  await page.click('#assist-toggle');
  assert.strictEqual(await running(), true);
  await page.waitForFunction(() => window.CT.panes[0].webview.getURL().includes('next.html'), null, { timeout: 15000 });
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 3000 });
  assert.ok(await page.evaluate(() => window.CT.panes[0].el.classList.contains('through')));
  assert.ok((await page.textContent('#assist-status')).includes('through'));
});

test('clicks are real (trusted) and the error popup got dismissed', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.evaluate(() => {
    window.CT.assist.addRegion(0, { x: 40, y: 80, w: 160, h: 50 });
    window.CT.assist.addRegion(0, { x: 300, y: 300, w: 120, h: 40 });
  });
  await page.fill('#assist-ms', '150');
  await page.click('#assist-toggle');
  await page.waitForFunction(async () => Number(await window.CT.panes[0].webview.executeJavaScript('window.__ok')) >= 1, null, { timeout: 10000 });
  await page.click('#assist-toggle');
  assert.strictEqual(await running(), false);
  assert.strictEqual(await inPane(page, 0, 'window.__untrusted'), 0);
});

test('ms box clamps to the 150 ms floor', async () => {
  await page.fill('#assist-ms', '50');
  await page.focus('#url');
  assert.strictEqual(await page.inputValue('#assist-ms'), '150');
  await page.fill('#assist-ms', '');
  await page.focus('#url');
  assert.strictEqual(await page.inputValue('#assist-ms'), '200');
});

test('start is disabled without regions', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.evaluate(() => window.CT.assist.clear(0));
  await page.waitForFunction(() => document.getElementById('assist-toggle').disabled);
});

test('draw a region with the mouse', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.click('#draw');
  const r = await page.evaluate(() => {
    const b = window.CT.panes[0].webview.getBoundingClientRect();
    return { x: b.x, y: b.y };
  });
  await page.mouse.move(r.x + 50, r.y + 60);
  await page.mouse.down();
  await page.mouse.move(r.x + 100, r.y + 90);
  await page.mouse.move(r.x + 150, r.y + 120);
  await page.mouse.up();
  const regions = await page.evaluate(() => window.CT.panes[0].regions);
  assert.strictEqual(regions.length, 1);
  const g = regions[0];
  for (const [got, want] of [[g.x, 50], [g.y, 60], [g.w, 100], [g.h, 60]]) assert.ok(Math.abs(got - want) <= 4, JSON.stringify(g));
  assert.ok(!(await page.evaluate(() => document.querySelector('.draw-layer'))));
  assert.ok(!(await page.isDisabled('#assist-toggle')));
});

test('safety cap stops the run', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.evaluate(() => {
    window.CT.assist.setMaxRunMs(800);
    window.CT.assist.addRegion(0, { x: 600, y: 400, w: 50, h: 50 });
  });
  await page.click('#assist-toggle');
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 2500 });
  assert.ok((await page.textContent('#assist-status')).includes('stopped'));
  await page.evaluate(() => window.CT.assist.setMaxRunMs(600000));
});

test('closing sessions mid-run stops cleanly', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.evaluate(() => window.CT.assist.addRegion(0, { x: 600, y: 400, w: 50, h: 50 }));
  await page.click('#assist-toggle');
  await page.click('#close-all');
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 2000 });
  await new Promise((r) => setTimeout(r, 500));
  assert.deepStrictEqual(errors.map(String), []);
});
