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

test('title shows version', async () => {
  assert.strictEqual(await page.title(), 'ChromeTabs v0.1.0');
});

test('bad input shows error and opens nothing', async () => {
  await page.fill('#url', 'abc def');
  await page.click('#open');
  assert.ok(await page.isVisible('#error'));
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('webview').length), 0);
});

test('count is clamped', async () => {
  await page.fill('#url', `${srv.base}/session.html`);
  await page.fill('#count', '0');
  await page.click('#open');
  await page.waitForFunction(() => window.CT.panes.length === 1);
  assert.strictEqual(await page.inputValue('#count'), '1');
});

test('panes are isolated, and re-open gives fresh sessions', async () => {
  const url = `${srv.base}/session.html`;
  await openPanes(page, url, 3);
  for (let i = 0; i < 3; i++) await waitInPane(page, i, "document.getElementById('state').textContent === 'new'");
  await inPane(page, 0, "localStorage.setItem('only0','x'); document.cookie='only0=x; path=/'");
  assert.strictEqual(await inPane(page, 1, "localStorage.getItem('only0')"), null);
  assert.ok(!(await inPane(page, 2, 'document.cookie')).includes('only0'));

  await page.click('#reload-all');
  for (let i = 0; i < 3; i++) await waitInPane(page, i, "document.getElementById('state').textContent === 'seen'");

  await openPanes(page, url, 3);
  for (let i = 0; i < 3; i++) await waitInPane(page, i, "document.getElementById('state').textContent === 'new'");
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('webview').length), 3);
});

test('switching views does not reload panes', async () => {
  await openPanes(page, `${srv.base}/session.html`, 3);
  await inPane(page, 1, 'window.__mark = 1');
  await page.click('#view-tabs');
  await page.click('#view-grid');
  await page.click('#view-tabs');
  assert.strictEqual(await inPane(page, 1, 'window.__mark'), 1);
});

test('popups load inside the same pane', async () => {
  await page.click('#view-grid');
  await openPanes(page, `${srv.base}/popup.html`, 2);
  await inPane(page, 0, "document.getElementById('blank').click()", true);
  await page.waitForFunction(() => window.CT.panes[0].webview.getURL().includes('from=blank'));
  await inPane(page, 1, "document.getElementById('open').click()", true);
  await page.waitForFunction(() => window.CT.panes[1].webview.getURL().includes('from=open'));
  await new Promise((r) => setTimeout(r, 500));
  assert.strictEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
});

test('grid pages of 25 without reloading', async () => {
  await page.click('#view-grid');
  await openPanes(page, `${srv.base}/session.html`, 30);
  assert.strictEqual(await page.textContent('#page-label'), 'Page 1/2');
  const visible = () => page.evaluate(() => window.CT.panes.filter((p) => p.el.classList.contains('shown')).length);
  assert.strictEqual(await visible(), 25);
  await inPane(page, 25, 'window.__mark = 26');
  await page.keyboard.press('PageDown');
  assert.strictEqual(await page.textContent('#page-label'), 'Page 2/2');
  assert.strictEqual(await visible(), 5);
  assert.strictEqual(await inPane(page, 25, 'window.__mark'), 26);
  await page.keyboard.press('PageUp');
  assert.strictEqual(await page.textContent('#page-label'), 'Page 1/2');
});
