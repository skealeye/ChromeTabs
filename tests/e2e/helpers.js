const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures');

function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const file = path.join(FIXTURES, rel || 'index.html');
    if (!file.startsWith(FIXTURES) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
  }));
}

const os = require('node:os');
// Each test app gets its own settings file unless one is given.
async function launchApp(env = {}) {
  const settings = env.CHROMETABS_SETTINGS
    || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-')), 'settings.json');
  const app = await _electron.launch({ args: ['.'], cwd: ROOT, env: { ...process.env, ...env, CHROMETABS_SETTINGS: settings } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.CT && window.CTLib);
  return { app, page };
}

async function openPanes(page, url, count) {
  await page.fill('#url', url);
  await page.fill('#count', String(count));
  await page.click('#open');
  await page.waitForFunction((n) => window.CT.panes.length === n && window.CT.panes.every((p) => p.ready), count, { timeout: 60000 });
}

// Run JS inside pane i's page and return the result.
function inPane(page, i, code, gesture = false) {
  return page.evaluate(([i, code, gesture]) => window.CT.panes[i].webview.executeJavaScript(code, gesture), [i, code, gesture]);
}

async function waitInPane(page, i, code, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    try { if (await inPane(page, i, code)) return true; } catch { /* navigating */ }
    if (Date.now() > end) throw new Error(`timeout waiting in pane ${i}: ${code}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

module.exports = { startServer, launchApp, openPanes, inPane, waitInPane };
