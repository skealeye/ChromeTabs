# ChromeTabs v0.2.0 Click Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Region-based, human-paced auto-click on one session, plus a "you're through" alert on every session.

**Architecture:** Pure logic lives in `src/lib/clicker.js`. `src/renderer/assist.js` owns draw mode, the region overlays, the click loop (`webview.sendInputEvent` mouseDown/mouseUp) and the top-bar controls. Through detection lives with the attention code in `src/renderer/captcha.js`, which is renamed in place to cover both flags. `main.js` forwards F3/F4 (and Esc while assisting) from panes.

**Tech Stack:** As in v0.1.x: Electron, node:test, playwright `_electron`.

**Spec:** `docs/superpowers/specs/2026-11-23-click-assist-design.md`

## Global Constraints
- Interval 150–5000 ms, default 200. Each gap is uniformly random in [ms, ms×1.2] and is never below ms.
- Max 3 regions per session (a 4th replaces the oldest). Clicks land only inside regions. One session runs at a time.
- Auto-stop: main-frame navigation to a different path or host, 10 min (`MAX_RUN_MS = 600000`), F4/Esc/■, Close all, Open, or the pane being removed.
- Through = main-frame `did-navigate` whose path or host differs from the pane's baseline. Hash/query-only changes and reloads don't count. Selecting a pane clears its flag and resets its baseline.
- Version 0.2.0 (package.json and the title test).

## Review Focus
- The user switches Grid⇄Tabs while assisting: the regions are in webview px, so they keep their px position. Clicks continue, but they may now land elsewhere on the reflowed page. Show a warning in the status text.
- The assisted pane is removed (Open / Close all) mid-run: the loop must stop with no errors. Test: e2e.
- The ms box gets typed `50`, blank or `abc`: it clamps to 150 / 200 / 200. Test: unit + e2e.
- An error popup covers the button between clicks: the second region dismisses it and clicking continues. Test: e2e fixture.
- A user logging in on some session flags it through: one click on that session clears it. Test: e2e.

---

### Task 1: Pure click logic
**Files:** Create `src/lib/clicker.js`, `tests/unit/clicker.test.js`. Modify `src/renderer/index.html` (script tag).
**Produces:** `clampInterval(v) -> number` (150..5000, NaN gives 200); `nextDelay(ms, rand=Math.random) -> number`; `randomPoint(r:{x,y,w,h}, rand) -> {x,y}` (integers inside r, inset 2px when the region is big enough); `isThrough(baseUrl, newUrl) -> boolean`; constants `MIN_MS=150`, `DEFAULT_MS=200`, `MAX_REGIONS=3`, `MAX_RUN_MS=600000`.
- [x] Failing tests:
  - `clampInterval('50')===150`, `('')===200`, `('abc')===200`, `(9999)===5000`, `('175')===175`.
  - `nextDelay(200,()=>0)===200`, `nextDelay(200,()=>1)===240`.
  - `randomPoint({x:10,y:20,w:100,h:50},()=>0)` → `{x:12,y:22}`, and with `()=>1` it gives a point ≤ (107,67).
  - `isThrough('https://a.com/p?x=1','https://a.com/p?x=2')===false`, `('https://a.com/p','https://a.com/p#h')===false`, `('https://a.com/p','https://a.com/cart')===true`, `('https://a.com/p','https://b.com/p')===true`.
- [x] `npm test` → FAIL. Implement (UMD like the other libs). `npm test` → pass. Commit `v0.2.0: click-assist pure logic`.

### Task 2: Through alert
**Files:** Modify `src/renderer/captcha.js`, `src/renderer/renderer.js` (`selectPane` clears through; pane `baseUrl` set on the first `did-navigate`), `index.html` (`#through` pill), `styles.css` (`.through` green). Create `tests/e2e/fixtures/next.html`, `tests/e2e/through.e2e.test.js`.
**Produces:** pane fields `baseUrl: string|null` and `through: boolean`; `CT.setThrough(pane, on)`; F2 order is attention first, then through.
- [x] Failing e2e: open 3 on `session.html`. In pane 2 run `location.href='/next.html'` → pane 2 gets class `through`, `#through` reads `1 through`, and a flash IPC fires (window unfocused not required; the pane is hidden in Tabs view on pane 0). `location.href='session.html?x=2'` in pane 1 → not through. F2 → current 2 and the flag clears.
- [x] Implement, run e2e + unit → pass. Commit `v0.2.0: you're-through alert`.

### Task 3: Click assist
**Files:** Create `src/renderer/assist.js`, `tests/e2e/fixtures/clicker.html`, `tests/e2e/assist.e2e.test.js`. Modify `index.html` (controls: `#draw`, `#clear-regions`, `#assist-toggle`, `#assist-ms`, `#assist-status`), `styles.css`, `main.js` (pane hotkeys `f3`, `f4`, plus `escape` only while assisting; IPC `assist-state` boolean from the renderer), `src/preload.js` (`setAssisting(bool)`), `README.md`.
**Produces:** `CT.assist = { addRegion(i, rect), clear(i), start(), stop(reason), running(): boolean, clicks(): number, setMaxRunMs(ms) }`. Pane field `regions: Array<{x,y,w,h}>` in webview CSS px.
- `clicker.html`: a `#buy` button at fixed position (left 40, top 80, 160×50) counting trusted clicks into `#count`. Every 3rd click it shows a `#err` overlay covering `#buy`, with an `#ok` button at (left 300, top 300, 120×40) that hides it. After 6 buy clicks it does `location.href='/next.html'`.
- [x] Failing e2e:
  - **runs and stops on through:** open 1 on `clicker.html`, Tabs view, `addRegion(0,{x:40,y:80,w:160,h:50})`, `addRegion(0,{x:300,y:300,w:120,h:40})`, set `#assist-ms` to 150, click `#assist-toggle`. The pane reaches `/next.html` within 15 s, `running()===false`, the pane has `through`, and every click was `isTrusted` (the fixture records `window.__untrusted===0`).
  - **ms clamp:** fill `#assist-ms` with `50` and blur → value `150`.
  - **toggle disabled with no regions:** after `clear(0)`, `#assist-toggle` is disabled.
  - **draw region:** click `#draw`, drag with the mouse on the host page across the pane area → `panes[0].regions.length===1` and its w,h are about the drag size (±4).
  - **cap:** `setMaxRunMs(800)`, regions only on a blank area, start → stops within 2 s with status containing `stopped`.
  - **pane removed mid-run:** start, then Close all → `running()===false` and no page errors.
- [x] Implement:
  - Draw mode: an overlay over the current pane's webview, drag → region; Esc cancels.
  - Outlines are `pointer-events:none`.
  - Loop: a `setTimeout` chain using `nextDelay(clampInterval(input))`, cycling regions, `randomPoint`, and `sendInputEvent` mouseDown+mouseUp `{button:'left', clickCount:1}`.
  - Status updates every second ("Assisting #n · N clicks · m:ss"). Show a "layout changed" note if the webview size differs from when the regions were drawn.
- [x] Run e2e + unit → pass. Manually check the real app with Draw region on example.com. Commit `v0.2.0: click assist`, bump the version, update the README (controls, F3/F4, limits).

### Task 4: settings.json
**Files:** Create `src/lib/settings.js` (pure: `normalizeSettings(obj) -> {clickIntervalMs, jitterPercent, maxRunMinutes}`), `tests/unit/settings.test.js`, `tests/e2e/settings.e2e.test.js`. Modify `src/main.js` (read/create/watch the file, IPC), `src/preload.js` (`getSettings()`, `saveSettings(partial)`, `onSettings(cb)`), `src/renderer/assist.js`, `.gitignore` (`settings.json`), `README.md`.
- The file is `settings.json` in the app folder, next to `ChromeTabs.bat`. It's created with defaults if missing, and an env var `CHROMETABS_SETTINGS` overrides the path (for tests).
- Defaults `{ "clickIntervalMs": 200, "jitterPercent": 20, "maxRunMinutes": 10 }`. Clamps: ms 150–5000, jitter 0–50, minutes 1–60. Invalid JSON → defaults plus a status warning; the file is not overwritten.
- `nextDelay(ms, rand, jitterPercent=20)` gains its jitter argument (Task 1's signature is extended).
- An edit to the file while the app runs updates the ms box within about 1 s. Changing the ms box writes `clickIntervalMs` back.
- [x] Failing tests:
  - unit: `normalizeSettings({clickIntervalMs:50})` → 150 with the other defaults; `normalizeSettings(null)` → defaults; `{jitterPercent:90}` → 50; `{maxRunMinutes:0}` → 1.
  - e2e: launch with a temp `CHROMETABS_SETTINGS` holding `clickIntervalMs: 175` → `#assist-ms` is `175`. Write 300 to the file → the box shows 300 within 2 s. Fill the box with 250 and blur → the file holds 250.
- [x] Implement, run all tests → pass. Commit `v0.2.0: settings.json for click timing`.
