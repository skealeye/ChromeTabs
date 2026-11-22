# ChromeTabs

Opens many browser sessions of one web address inside a single window. Each session has its own
cookies, logins and storage, so a site sees them as separate visitors. Sessions are temporary and
disappear when you close the app.

## Run

```
npm install
npm start
```

Enter an address and how many sessions you want (1–100), then press **Open**. Pressing Open again
replaces the current set with fresh sessions.

## Views

- **Grid** shows up to 25 sessions per page. Use ◀ ▶, the page dots, or PgUp/PgDn (from the top bar) to change page.
- **Tabs** shows one session at a time. Click a number, or use the ⤢ button on any pane; its ⤡ button takes you back to the grid.

## Keys

| Key | Does |
|-----|------|
| Ctrl+1 … Ctrl+9 | Go to session 1–9 |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous session |
| PgDn / PgUp | Next / previous grid page (when the top bar has focus) |
| F2 | Jump to the next session showing a captcha |

## Captchas

When a session shows a reCAPTCHA (or hCaptcha) challenge, its border turns red and the top bar shows
"N need attention". If you can't see that session, the app also dings and flashes in the taskbar.
F2 takes you to each one in turn.

The app alerts you to captchas; it never solves them.

## Tests

```
npm test       # unit tests
npm run e2e    # launches the real app against local test pages
```

`open_guest_tabs.py` is the old script this app replaces. It still works, but all its tabs share one Guest session.
