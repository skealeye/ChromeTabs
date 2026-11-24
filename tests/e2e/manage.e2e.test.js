const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, launchApp, openPanes, inPane } = require('./helpers');

let srv, app, page;
before(async () => {
  srv = await startServer();
  ({ app, page } = await launchApp());
});
after(async () => {
  await app?.close();
  srv?.server.close();
});

const nums = () => page.evaluate(() => window.CT.panes.map((p) => p.n));
const allReady = (n) => page.waitForFunction((n) => window.CT.panes.length === n && window.CT.panes.every((p) => p.ready), n, { timeout: 60000 });

test('+ Add keeps existing sessions and appends more, numbering on', async () => {
  await openPanes(page, `${srv.base}/session.html`, 3);
  const firstPartition = await page.evaluate(() => window.CT.panes[0].partition);
  await page.fill('#count', '2');
  await page.click('#add');
  await allReady(5);
  assert.deepStrictEqual(await nums(), [1, 2, 3, 4, 5]);
  assert.strictEqual(await page.evaluate(() => window.CT.panes[0].partition), firstPartition, 'old sessions untouched');
  const parts = await page.evaluate(() => window.CT.panes.map((p) => p.partition));
  assert.strictEqual(new Set(parts).size, 5, 'every session has its own partition');
});

test('× closes one session; the rest keep working', async () => {
  await openPanes(page, `${srv.base}/session.html`, 4);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(2));
  await page.locator('.pane.shown .icon.close').click();
  assert.deepStrictEqual(await nums(), [1, 2, 4]);
  assert.strictEqual(await page.evaluate(() => window.CT.currentPane()), 2);
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#stage .pane').length), 3);

  // Clicking session 4's max button still targets session 4 after indexes shifted.
  await page.click('#view-grid');
  await page.locator('.pane').nth(2).locator('.icon.max').click();
  assert.strictEqual(await page.evaluate(() => window.CT.panes[window.CT.currentPane()].n), 4);
  assert.strictEqual(await page.evaluate(() => window.CT.view()), 'tabs');
});

test('Ctrl+W from inside a session and middle-click on a tab close sessions', async () => {
  await openPanes(page, `${srv.base}/session.html`, 4);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  await page.evaluate(() => window.CT.panes[0].webview.sendInputEvent({ type: 'keyDown', keyCode: 'W', modifiers: ['control'] }));
  await page.waitForFunction(() => window.CT.panes.length === 3, null, { timeout: 3000 });
  assert.deepStrictEqual(await nums(), [2, 3, 4]);

  await page.locator('#tabstrip .tab').nth(1).click({ button: 'middle' });
  assert.deepStrictEqual(await nums(), [2, 4]);

  // Closing the last ones leaves the empty state; Add then starts afresh at 1.
  await page.evaluate(() => { window.CT.closePane(window.CT.panes[0]); window.CT.closePane(window.CT.panes[0]); });
  assert.ok(await page.isVisible('#empty'));
  await page.fill('#count', '2');
  await page.click('#add');
  await allReady(2);
  assert.deepStrictEqual(await nums(), [1, 2]);
  assert.ok(await inPane(page, 1, 'document.readyState === "complete"'));
});

test('in Tabs view, Left/Right arrows step through sessions with wrap-around', async () => {
  await openPanes(page, `${srv.base}/session.html`, 3);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(2));
  const key = (k) => page.evaluate(([k]) => {
    const wv = window.CT.panes[window.CT.currentPane()].webview;
    wv.sendInputEvent({ type: 'keyDown', keyCode: k });
    wv.sendInputEvent({ type: 'keyUp', keyCode: k });
  }, [k]);
  const cur = () => page.evaluate(() => window.CT.currentPane());

  await key('Right'); // from inside the session
  await page.waitForFunction(() => window.CT.currentPane() === 0, null, { timeout: 3000 });
  await key('Left');
  await page.waitForFunction(() => window.CT.currentPane() === 2, null, { timeout: 3000 });

  // From the app chrome (tab strip focused).
  await page.locator('#tabstrip .tab').nth(1).focus();
  await page.keyboard.press('ArrowRight');
  assert.strictEqual(await cur(), 0); // 3 of 3 wraps to 1

  // Typing in a field inside the page keeps its arrows.
  await inPane(page, 0, "(() => { const i = document.createElement('input'); i.id = 'ti'; document.body.append(i); i.focus(); })()");
  await key('Left');
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(await cur(), 0);

  // Grid view ignores arrows.
  await page.click('#view-grid');
  await page.keyboard.press('ArrowRight');
  assert.strictEqual(await cur(), 0);
});
