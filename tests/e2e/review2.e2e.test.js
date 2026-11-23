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

const running = () => page.evaluate(() => window.CT.assist.running());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('spamming start/stop never clicks faster than 150 ms', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 1);
  await page.click('#view-tabs');
  await page.fill('#assist-ms', '150');
  await page.focus('#url');
  await page.evaluate(() => window.CT.assist.addRegion(0, { x: 500, y: 500, w: 60, h: 60 }));
  await page.evaluate(() => new Promise((done) => {
    let k = 0;
    const t = setInterval(() => {
      const a = window.CT.assist;
      if (a.running()) a.stop(); else a.start();
      if (++k >= 40) { clearInterval(t); a.stop(); done(); }
    }, 25);
  }));
  const times = await inPane(page, 0, 'window.__times');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 140, `gap ${times[i] - times[i - 1]}`);
});

test('a captcha on the assisted session pauses it, and start is refused while flagged', async () => {
  await openPanes(page, `${srv.base}/captcha.html`, 1);
  await page.evaluate(() => window.CT.assist.addRegion(0, { x: 500, y: 20, w: 50, h: 30 }));
  await page.click('#assist-toggle');
  assert.strictEqual(await running(), true);
  await inPane(page, 0, "document.getElementById('show').click()");
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 3000 });
  assert.ok((await page.textContent('#assist-status')).includes('captcha'));
  await page.evaluate(() => window.CT.assist.start());
  assert.strictEqual(await running(), false);
});

test('single-page-app navigation stops the run', async () => {
  await openPanes(page, `${srv.base}/spa.html`, 1);
  await page.evaluate(() => window.CT.assist.addRegion(0, { x: 40, y: 80, w: 160, h: 50 }));
  await page.click('#assist-toggle');
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 3000 });
  assert.ok((await page.textContent('#assist-status')).includes('through'));
});

test('switching view mid-run pauses it', async () => {
  await openPanes(page, `${srv.base}/clicker.html`, 2);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  await page.evaluate(() => window.CT.assist.addRegion(0, { x: 500, y: 500, w: 60, h: 60 }));
  await page.click('#assist-toggle');
  await page.click('#view-grid');
  await page.waitForFunction(() => !window.CT.assist.running(), null, { timeout: 2000 });
  assert.ok((await page.textContent('#assist-status')).includes('layout'));
});

test('a redirect right after opening is not "through"', async () => {
  await page.click('#view-grid');
  await openPanes(page, `${srv.base}/redirect.html`, 2);
  await page.waitForFunction(() => window.CT.panes.every((p) => p.webview.getURL().includes('next.html')));
  await sleep(400);
  assert.ok(!(await page.evaluate(() => window.CT.panes.some((p) => p.through))));
});

test('clicking into a flagged session clears it', async () => {
  await page.evaluate(() => { window.CT.throughSettleMs = 0; });
  await openPanes(page, `${srv.base}/session.html`, 2);
  await page.click('#view-tabs');
  await page.evaluate(() => window.CT.selectPane(0));
  await inPane(page, 1, "location.href = '/next.html'");
  await page.waitForFunction(() => window.CT.panes[1].through);
  await page.click('#view-grid'); // both visible; flag still set
  assert.ok(await page.evaluate(() => window.CT.panes[1].through));
  const b = await page.evaluate(() => { const r = window.CT.panes[1].webview.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction(() => !window.CT.panes[1].through, null, { timeout: 2000 });
});

test('Esc pressed inside the session cancels drawing', async () => {
  await openPanes(page, `${srv.base}/session.html`, 1);
  await page.click('#draw');
  assert.ok(await page.evaluate(() => Boolean(document.querySelector('.draw-layer'))));
  await page.evaluate(() => window.CT.panes[0].webview.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }));
  await page.waitForFunction(() => !document.querySelector('.draw-layer'), null, { timeout: 2000 });
});
