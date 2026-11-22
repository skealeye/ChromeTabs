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

const flashes = () => app.evaluate(() => global.__flashes);
const show = (i) => inPane(page, i, "document.getElementById('show').click()");
const hide = (i) => inPane(page, i, "document.getElementById('hide').click()");

test('captcha in a hidden pane is flagged, notified, and F2 jumps to it', async () => {
  await openPanes(page, `${srv.base}/captcha.html`, 3);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  const before = await flashes();

  await show(2);
  await page.waitForFunction(() => window.CT.panes[2].el.classList.contains('attention'), null, { timeout: 3000 });
  assert.strictEqual((await page.textContent('#attention')).trim(), '1 need attention');
  assert.ok(await page.isVisible('#attention'));
  assert.ok((await flashes()) > before, 'flash requested');
  assert.ok(!(await page.evaluate(() => window.CT.panes[0].el.classList.contains('attention'))));

  // F2 pressed while focus is inside pane 1 (routed through main's before-input-event).
  await page.evaluate(() => window.CT.panes[0].webview.sendInputEvent({ type: 'keyDown', keyCode: 'F2' }));
  await page.waitForFunction(() => window.CT.currentPane() === 2, null, { timeout: 3000 });
  assert.strictEqual(await page.evaluate(() => window.CT.view()), 'tabs');

  await hide(2);
  await page.waitForFunction(() => !window.CT.panes[2].el.classList.contains('attention'), null, { timeout: 3000 });
  assert.ok(!(await page.isVisible('#attention')));
});

test('captcha on another grid page marks that page and F2 crosses pages', async () => {
  await page.click('#view-grid');
  await openPanes(page, `${srv.base}/captcha.html`, 30);
  assert.strictEqual(await page.evaluate(() => window.CT.currentPage()), 0);

  await show(27);
  await page.waitForFunction(() => document.querySelectorAll('#page-dots .dot')[1].classList.contains('attention'), null, { timeout: 3000 });
  assert.ok(!(await page.evaluate(() => document.querySelectorAll('#page-dots .dot')[0].classList.contains('attention'))));

  await page.keyboard.press('F2');
  assert.strictEqual(await page.evaluate(() => window.CT.currentPane()), 27);
  assert.strictEqual(await page.evaluate(() => window.CT.view()), 'tabs');
});

test('re-open clears attention', async () => {
  await openPanes(page, `${srv.base}/captcha.html`, 2);
  assert.ok(!(await page.isVisible('#attention')));
});
