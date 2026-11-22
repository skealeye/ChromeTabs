# ChromeTabs v0.1.0 — multi-session browser (design)

## Intent
Replace `open_guest_tabs.py`. That script opens N Guest tabs on a Costco product page, but they all share
one session. The new app opens N browser instances of a URL, **each with its own isolated, temporary
session**, all inside one window, where you can watch them all at once or switch between them.

## Goals
- Enter a URL and a count, hit Open, and get N independent sessions (separate cookies, storage and logins).
- Two views: **Grid** (all visible, auto-tiled) and **Tabs** (one at a time, numbered tab strip).
- Sessions are in-memory only and gone when the app closes.

## Non-goals
- Using real Chrome profiles, extensions or bookmarks. No persistence between launches.
- Bot automation (auto-clicking, auto-checkout).
- Solving or bypassing CAPTCHAs (no auto-solvers or solving services). The human solves every challenge.

## Anti-goals
- A site sees the instances as one visitor, which is the same failure as the old script.
- Tiling glitches, focus fights or windows escaping the app.

## Approaches
1. **Electron (chosen).** Bundled Chromium, one in-memory session partition per instance. Clean tiling. Cost: about 150 MB.
2. C#/WebView2: native and smaller, but needs per-instance temp folders, plus cleanup, and runs on the Edge engine.
3. Real chrome.exe windows reparented into a host window: truly Chrome, but fragile (resize/focus/redraw bugs). Rejected.

The user picked Electron.

## Design
- **Top bar:** URL field, count (1–100, default 20), **Open**, **Reload all**, **Close all**, Grid/Tabs toggle.
  - *My call:* Open replaces the current set rather than adding to it.
  - *My call:* "https://" is added if missing.
- **Isolation:** each instance gets a unique non-`persist:` partition, which is in-memory and discarded on exit.
  - *My call:* the user agent is a normal Chrome UA with the Electron token removed, so sites treat instances as Chrome.
- **Each pane:** a small header with its number, back, reload, current URL, and maximize (jumps to that pane in Tabs view).
- **Grid pages:** the grid shows at most 25 panes per page (5x5). More panes go onto further pages, with a `◀ Page 2/4 ▶` control and PgUp/PgDn.
  - Panes on other pages stay loaded and keep running; switching pages never reloads them.
  - *My call:* the count max is 100. Each pane is a live browser, roughly 100–200 MB RAM, so 100 panes is heavy.
- **Tabs view:** Ctrl+1..9 and Ctrl+Tab cycle through panes.
- **Version** shown in the window title, starting at v0.1.0.
- `open_guest_tabs.py` is left in place.

## Captcha assist (helps the human solve, never solves)
- **Detection:** each pane watches for a visible reCAPTCHA challenge (challenge iframe/bframe) and reports it.
- **Alert:** the pane header turns red and gets a badge, and the top bar shows "N need attention".
- **Pages:** a page with a captcha shows a red dot on the page control.
- **Jump:** F2 opens the next pane (on any page) that needs attention, full-size in Tabs view. The flag clears when the challenge disappears.
- **Notify:** a short sound and a taskbar flash when a new challenge appears, while the app is unfocused or the pane is hidden.
- **Fewer triggers:** Reload all staggers reloads (*my call:* about 150–400 ms random spacing), and panes use a normal Chrome UA.

## Left to the builder
- Embedding mechanism (`<webview>` vs `WebContentsView`), and keeping panes alive (not reloaded) when switching views.
- Exact captcha detection selectors.
- Grid column math, and unit tests for pure logic (URL normalisation, grid layout).
