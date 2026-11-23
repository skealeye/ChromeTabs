const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, launchApp, openPanes, inPane } = require('./helpers');

let srv, app, page;
before(async () => {
  srv = await startServer();
  ({ app, page } = await launchApp());
  await app.evaluate(({ ipcMain }) => {
    global.__flashes = 0;
    ipcMain.on('flash-frame', () => { global.__flashes += 1; });
  });
});
after(async () => {
  await app?.close();
  srv?.server.close();
});

const isThrough = (i) => page.evaluate((i) => window.CT.panes[i].el.classList.contains('through'), i);

test('a hidden session that moves to a new page is flagged through', async () => {
  await openPanes(page, `${srv.base}/session.html`, 3);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  const before = await app.evaluate(() => global.__flashes);

  await inPane(page, 1, "location.href = '/session.html?x=2'");
  await inPane(page, 2, "location.href = '/next.html'");
  await page.waitForFunction(() => window.CT.panes[2].el.classList.contains('through'), null, { timeout: 5000 });
  assert.strictEqual((await page.textContent('#through')).trim(), '1 through');
  assert.ok((await app.evaluate(() => global.__flashes)) > before);
  assert.strictEqual(await isThrough(1), false, 'query-only change is not through');

  await page.focus('#url');
  await page.keyboard.press('F2');
  assert.strictEqual(await page.evaluate(() => window.CT.currentPane()), 2);
  assert.strictEqual(await isThrough(2), false, 'selecting clears the flag');
  assert.ok(!(await page.isVisible('#through')));
});

test('navigating in the session you are looking at is not flagged', async () => {
  await openPanes(page, `${srv.base}/session.html`, 2);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  await inPane(page, 0, "location.href = '/next.html'");
  await page.waitForFunction(() => window.CT.panes[0].webview.getURL().includes('next.html'));
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(await isThrough(0), false);
});
