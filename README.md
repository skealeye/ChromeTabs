# ChromeTabs

Opens many browser sessions of one web address inside a single window. Each session has its own
cookies, logins and storage, so a site sees them as separate visitors. Sessions are temporary and
disappear when you close the app.

## Run

Double-click **ChromeTabs.bat**. The first run installs dependencies. Or from a terminal:

```
npm install
npm start
```

Enter an address and how many sessions you want (over 100 asks you to confirm first), then press **Open**. Pressing Open again
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
| F2 | Jump to the next captcha, then the next session that got through |
| F3 | Draw a click region |
| F4 | Start / stop auto-click |
| Esc | Stop auto-click, or cancel drawing |

## Click assist

For people who can't click over and over. It clicks for you, at a human pace, in one session.

1. Go to the session (Tabs view is easiest) and press **✚ Region** (F3). Drag a box over the button.
   Draw up to 3 regions, for example "Add to cart" plus where an error popup's OK button appears.
2. Set the time between clicks in the **ms** box (150–5000).
3. Press **▶ Auto-click** (F4). Clicks cycle through your regions at a random spot inside each one.
4. It stops on its own when the session moves to a new page. The session turns green, dings, and
   comes to the front so you can check out. It also stops on F4, Esc, ■ Stop, Close all, or after the time limit.

Clicks are tied to the page position you drew on. If you switch views or resize, redraw the regions.

### settings.json

`settings.json` sits next to `ChromeTabs.bat` and is created on first run. Edit it while the app is
running and the changes apply within a second. Changing the ms box saves back to it.

```json
{
  "clickIntervalMs": 200,
  "jitterPercent": 20,
  "maxRunMinutes": 10
}
```

| Setting | Range | Meaning |
|---------|-------|---------|
| `clickIntervalMs` | 150–5000 | Time between clicks |
| `jitterPercent` | 0–50 | Random extra time added to each gap (never faster than `clickIntervalMs`) |
| `maxRunMinutes` | 1–60 | Safety stop |

## Through alert

Any session that moves to a new page on its own (for example, out of a waiting room) turns green,
dings, and shows in the "N through" counter. F2 jumps to it. Looking at it clears the flag.

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
