const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, launchApp, openPanes, inPane, waitInPane } = require('./helpers');

let srv, app, page;
before(async () => {
  srv = await startServer();
  ({ app, page } = await launchApp());
});
after(async () => {
  await app?.close();
  srv?.server.close();
});

test('no default menu (Ctrl+R / Ctrl+W accelerators gone)', async () => {
  assert.strictEqual(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()), null);
});

test('sessions stay fresh even after the app page reloads', async () => {
  const url = `${srv.base}/session.html`;
  await openPanes(page, url, 1);
  await waitInPane(page, 0, "document.getElementById('state').textContent === 'new'");
  const first = await page.evaluate(() => window.CT.panes[0].partition);
  await page.reload();
  await page.waitForFunction(() => window.CT && window.CTLib);
  await openPanes(page, url, 1);
  assert.notStrictEqual(await page.evaluate(() => window.CT.panes[0].partition), first);
  await waitInPane(page, 0, "document.getElementById('state').textContent === 'new'");
});

test('pane permission requests are denied', async () => {
  await openPanes(page, `${srv.base}/session.html`, 1);
  assert.strictEqual(await inPane(page, 0, 'Notification.requestPermission()', true), 'denied');
});

test('selecting a pane gives it keyboard focus', async () => {
  await openPanes(page, `${srv.base}/session.html`, 3);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(1));
  assert.ok(await page.evaluate(() => document.activeElement === window.CT.panes[1].webview));
});

// Last: Playwright treats the blocked navigation as still pending.
test('the app page cannot be navigated away', async () => {
  await page.evaluate((u) => { location.href = u; }, `${srv.base}/session.html`);
  await new Promise((r) => setTimeout(r, 800));
  assert.ok(await page.evaluate(() => Boolean(window.CT)));
});
