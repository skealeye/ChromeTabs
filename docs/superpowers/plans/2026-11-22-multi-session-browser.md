# ChromeTabs v0.1.0 Multi-Session Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Electron app that opens N isolated, in-memory browser sessions of one URL in a single window, with Grid/Tabs views and captcha-attention assist.

**Architecture:** The main process creates one BrowserWindow (`webviewTag: true`) and sets a de-Electroned Chrome UA. The renderer builds one `<webview>` per pane, each with a unique non-`persist:` partition. A webview preload detects visible reCAPTCHA challenges and reports to the host with `sendToHost`. Pure logic lives in `src/lib/` and is unit-tested with `node --test`. Playwright `_electron` drives the e2e checks against local fixture pages.

**Tech Stack:** Node 24, Electron (latest stable), node:test, playwright (dev only, `_electron`).

**Spec:** `docs/superpowers/specs/2026-11-22-multi-session-browser-design.md`

## Global Constraints
- Version `0.1.0` in package.json, and the window title is `ChromeTabs v0.1.0`.
- Count is 1–100, default 20. Grid pages hold at most 25 panes (`PAGE_SIZE = 25`); PgUp/PgDn change page. Open **replaces** the current set.
- Partitions never start with `persist:`, and each is unique per pane per Open (`pane-<openId>-<n>`).
- UA = Electron's default UA with the `Electron/x` and `chrometabs/x` tokens removed.
- No CAPTCHA solving or bypass code of any kind. Detection and alerting only.
- Reload all staggers reloads by a random 150–400 ms per pane.
- Hotkeys: Ctrl+1..9 selects a pane, Ctrl+Tab / Ctrl+Shift+Tab cycles, PgUp/PgDn change grid page, and F2 jumps to the next pane that needs attention.
- `open_guest_tabs.py` and `Readme.txt` are untouched.

## Review Focus
- Re-Open after logging in: the new panes must not carry over the old cookies or storage. Test: e2e, Task 2.
- Switching Grid⇄Tabs must not reload panes (an in-progress captcha must survive). Test: e2e, Task 2.
- `target=_blank` / `window.open` must load in the same pane, never in a new OS window. Test: e2e, Task 2.
- A captcha in a hidden pane (Tabs view, not the active one) must still be flagged and notified. Test: e2e, Task 3.
- Junk count/URL input (blank, `0`, `99`, `abc`, ` costco.com `) must clamp/normalise or show an inline error. It must never silently open zero panes. Test: unit, Task 1, plus e2e, Task 2.

---

### Task 1: Scaffold + pure logic

**Files:** Create `package.json`, `src/lib/url.js`, `src/lib/grid.js`, `src/lib/stagger.js`, `src/lib/attention.js`, `tests/unit/*.test.js`

**Interfaces (Produces, CommonJS, also attached to `window.CTLib` when loaded via `<script>`):**
- `normalizeUrl(input: string) -> string | null`: trims, adds `https://` if there's no scheme, returns null unless the result is a valid http(s) URL with a dotted host or `localhost`/IP.
- `clampCount(input: string|number) -> number`: parseInt; NaN gives 20; clamps to 1..100.
- `gridDims(n, width, height) -> {cols, rows}`: picks the cols whose tile aspect ratio is closest to 16:10, with rows = ceil(n/cols).
- `staggerDelays(n, rand = Math.random) -> number[]`: cumulative ms; the first is 0, and each gap is `150 + rand()*250`.
- `pageCount(n, size = 25) -> number` (min 1) and `pageOf(i, size = 25) -> number` (0-based), in `src/lib/grid.js`.
- `nextAttention(flags: boolean[], current: number) -> number`: the next index after `current` (wrapping, and including `current` last) whose flag is true, or -1.

- [ ] Write the failing tests:
  - `normalizeUrl(' costco.com/x ')==='https://costco.com/x'`; `normalizeUrl('abc def')===null`; `normalizeUrl('abc')===null`; `normalizeUrl('ftp://x.com')===null`; `normalizeUrl('')===null`; `normalizeUrl('http://127.0.0.1:5000/a')` is unchanged.
  - `clampCount('')===20`, `clampCount('0')===1`, `clampCount('99')===99`, `clampCount('500')===100`, `clampCount('abc')===20`, `clampCount(5)===5`.
  - `gridDims(1,1000,1000)` → `{cols:1,rows:1}`; `gridDims(4,1600,1000)` → `{cols:2,rows:2}`; `gridDims(20,1920,1000)` → `{cols:5,rows:4}`; `gridDims(25,1920,1000)` → `{cols:5,rows:5}`.
  - `pageCount(0)===1`, `pageCount(25)===1`, `pageCount(26)===2`, `pageCount(100)===4`; `pageOf(24)===0`, `pageOf(25)===1`.
  - `staggerDelays(3,()=>0)` → `[0,150,300]`; `staggerDelays(3,()=>1)` → `[0,400,800]`; `staggerDelays(0)` → `[]`.
  - `nextAttention([false,true,false,true],1)===3`; `nextAttention([false,true,false,false],3)===1`; `nextAttention([false,false],0)===-1`.
- [ ] `npm test` (= `node --test tests/unit`) → FAIL.
- [ ] Implement:
  - Write the libs.
  - Add `package.json` with `"name":"chrometabs"`, `"version":"0.1.0"`, `"main":"src/main.js"`, scripts `start`/`test`/`e2e` (`node --test tests/e2e`), and devDeps `electron` and `playwright`.
  - Run `npm install`.
- [ ] `npm test` → all pass.
- [ ] Commit `v0.1.0: scaffold and pure logic`.

### Task 2: App shell, isolated panes, views

**Files:** Create `src/main.js`, `src/preload.js`, `src/renderer/index.html`, `src/renderer/renderer.js`, `src/renderer/styles.css`, `tests/e2e/server.js` (a static fixture server on 127.0.0.1, random port), `tests/e2e/fixtures/session.html`, `tests/e2e/fixtures/popup.html`, `tests/e2e/app.e2e.test.js`

**Interfaces:**
- Consumes the Task 1 functions (via `<script>` → `window.CTLib`). `contextIsolation` stays on, and `nodeIntegration` stays off.
- Produces these renderer globals for Task 3: `panes: Array<{el: HTMLElement, webview: Electron.WebviewTag, n: number, attention: boolean}>`, `selectPane(i: number)`, `setView(v: 'grid'|'tabs')`, `currentPane(): number`, `setPage(p: number)`, `currentPage(): number`, plus a `renderPager()` hook that Task 3 extends with attention dots.
- `preload.js` exposes `window.app = {version: string, flash(): void, onHotkey(cb: (key: string) => void)}`. `flash` → IPC `flash-frame` → `win.flashFrame(true)`, cleared on window focus.

- [ ] Write `app.e2e.test.js`. It launches with `_electron.launch({args:['.']})` and drives the top bar through `page.fill`/`click`.
  - **isolation**: open 3 on `session.html`, which shows `localStorage.seen ? 'seen' : 'new'` and then sets `seen` plus a cookie. All 3 show `new`. Reload all, and all show `seen`. Open 3 again, and all show `new`.
  - **title**: `await page.title()` === `ChromeTabs v0.1.0`.
  - **no reload on view switch**: set `window.__mark=1` in pane 2 via `webview.executeJavaScript`. Toggle to Tabs and back. `__mark` is still 1.
  - **popup stays in pane**: `popup.html` has a `target=_blank` link and a `window.open` button. After each click, pane 1's URL changes to the target and `electronApp.windows().length===1`.
  - **paging**: open 30 on `session.html` → `#pager` reads `Page 1/2` and 25 panes are visible. Set `__mark` in pane 26. PgDn → `Page 2/2`, 5 visible, and pane 26's `__mark` is still 1 (no reload). PgUp → back to page 1.
  - **bad input**: URL `abc def` → `#error` is visible and `document.querySelectorAll('webview').length===0`.
- [ ] `npm run e2e` → FAIL.
- [ ] Implement:
  - main: UA via `app.userAgentFallback`, and the window title. On `web-contents-created` for `getType()==='webview'`, deny window opens with `setWindowOpenHandler` and `loadURL` the target in that same webview. Forward `before-input-event` for the hotkeys (from the host and from webviews) to the renderer.
  - Renderer top bar: URL, count, Open, Reload all, Close all, a Grid/Tabs toggle, `#error`, and a hidden `#attention` counter.
  - Pane header: number, back, reload, URL text (updated on `did-navigate`/`did-navigate-in-page`), and maximize (→ Tabs view on that pane).
  - Grid shows only the current page's panes (others sized 0 / `visibility:hidden`, still attached) and uses `gridDims(panesOnPage)`, recomputed on resize. `#pager` (◀ Page x/y ▶) is hidden when there's 1 page. Tabs shows a numbered strip with the active pane filling the area.
  - **View switching changes only CSS on the existing elements (size/position/`visibility`, never `display:none`, removal or re-parenting), so webviews never reload.**
  - Open/Close all removes the old webviews before adding new ones.
- [ ] `npm run e2e` and `npm test` → pass.
- [ ] Run `npm start`, open 20 on `https://www.costco.com`, and confirm the grid renders and the pages load. Screenshot to the scratchpad; don't commit it.
- [ ] Commit `v0.1.0: app shell with isolated panes and grid/tabs views`.

### Task 3: Captcha assist

**Files:** Create `src/pane-preload.js`, `tests/e2e/fixtures/captcha.html`, `tests/e2e/fixtures/recaptcha/api2/bframe` (a tiny HTML body), `tests/e2e/captcha.e2e.test.js`. Modify `src/renderer/renderer.js`, `src/renderer/styles.css`, `src/main.js`.

**Interfaces:**
- Consumes `panes`, `selectPane`, `setView`, `currentPane`, and `window.app.flash`/`onHotkey` from Task 2, plus `nextAttention` and `staggerDelays` from Task 1.
- `pane-preload.js` → `ipcRenderer.sendToHost('captcha', visible: boolean)`, sent only on change. Detection runs every 1 s plus on a MutationObserver. It's true when some `iframe` whose src contains `recaptcha` and `bframe` (api2 or enterprise) has a bounding box >50x50 and no ancestor with computed `visibility:hidden` or `opacity:0`.

- [ ] Write `captcha.e2e.test.js`. `captcha.html` mimics Google's markup: a `visibility:hidden` div holding an iframe whose src is `/recaptcha/api2/bframe?k=test` (served locally), plus `#show`/`#hide` buttons that toggle its visibility.
  - Open 3, and set Tabs view on pane 1. Click `#show` in pane 3 (hidden) via `executeJavaScript`.
  - Within 3 s: pane 3's header has class `attention`, `#attention` reads `1 need attention`, and the flash IPC fired (spy via `electronApp.evaluate` on `BrowserWindow.prototype.flashFrame`).
  - Press F2, and pane 3 is the active pane in Tabs view.
  - `#hide` → the flag clears within 3 s and `#attention` is hidden.
- [ ] `npm run e2e` → FAIL.
- [ ] Implement:
  - Set the webview `preload` attribute to the `file://` URL of `pane-preload.js`, passed via `window.app`.
  - On false→true, add the badge and update the counter. If the window is unfocused or the pane isn't the visible one, also play a short WebAudio tone (no asset file) and call `flash()`.
  - F2 calls `nextAttention(flags, currentPane())`; if that's ≥0, then calls `setView('tabs')` then `selectPane` (which also calls `setPage(pageOf(i))`).
  - Pager: page buttons get a red dot when any pane on that page has `attention`. E2e: open 30, show the challenge in pane 28 while on page 1 → the page-2 dot appears; F2 lands on pane 28.
  - Reload all schedules per-pane reloads with `staggerDelays`.
- [ ] `npm run e2e` and `npm test` → pass.
- [ ] Add `README.md`: `npm install`, `npm start`, the hotkeys, and the line "Alerts you to captchas; it never solves them."
- [ ] Commit `v0.1.0: captcha attention assist` and push `origin main`.
