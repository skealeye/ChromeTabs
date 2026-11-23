# ChromeTabs v0.2.0 — click assist + "you're through" alert (design)

## Intent
The user can't click repeatedly. Drops such as Target's need someone clicking a button over and over
until the site lets them through, and an error popup sometimes needs dismissing. Click assist does
that repetitive clicking at a human pace while the user is present. The user does the checkout.

## Goals
- The user draws up to 3 click regions on a session (e.g. "Add to cart", plus where the error's OK/✕ appears).
- Top-bar controls start/stop auto-click and set the click interval in ms.
- Auto-click stops on its own when the session moves to a new page, then alerts.
- **"You're through" alert** on every session: when a session navigates away from where it started
  (a new URL path, or a different host), flag it green, ding and flash.

## Non-goals / limits (kept so this is a stand-in for a hand, not a bot)
- One session at a time: the session the regions were drawn on. Never across all sessions at once.
- Clicks only inside the drawn regions. No form filling, no checkout automation, no captcha interaction.
- **Interval floor of 150 ms** (the user's normal setting is 150–200 ms, within fast human clicking), default 200 ms.
  Jitter only adds time: each gap is a random value between ms and ms×1.2. Each click hits a random point inside the region.
- Safety stop after 10 minutes, or on F4/Esc/Stop/Close all/Open.

## Approaches
1. **Real input events into the webview (chosen).** `webview.sendInputEvent` sends mouseDown/mouseUp
   at coordinates, so the page sees a normal mouse click and whatever is under the region gets clicked,
   including the error popup.
2. Clicking DOM elements via injected JS. Rejected: it targets elements, not regions; it misses popups
   in iframes or shadow DOM; and the clicks are distinguishable from real ones.
3. OS-level mouse automation. Rejected: it moves the real cursor and breaks if the window moves.

## Design
- **Top bar (new group):**
  - **Draw region** (F3): enters draw mode on the current session; drag to make a box; Esc cancels.
  - **Clear regions** (removes all regions on the current session).
  - **Auto-click ▶ / ■** (F4): toggles; disabled until the current session has a region.
  - **ms** number input: interval, 150–5000, default 200, clamped. Changes apply while running.
  - A status text such as "Assisting #7 · 342 clicks · 1:12".
- Regions are drawn as dashed outlines over that session and stored relative to the webview (CSS px).
  Outlines never block the page's own clicks. A 4th region replaces the oldest.
- While running, the session shows a green "Assisting" badge. Each tick clicks the next region in
  turn, at a random point inside it.
- **Auto-stop:** the session's main frame navigates to a different path or host (in-page hash changes
  don't count), 10 min pass, or the user stops it. On a navigation stop, the session is flagged through.
- **Through flag:** green border/badge, a ding, a taskbar flash, and a "N through" pill. F2 jumps to
  attention (captcha) first, then through. Reloading the same URL doesn't count. Selecting the session clears its through flag and re-baselines it.
- Version 0.2.0.

## Left to the builder
- How the draw overlay sits over the webview (an overlay div that captures the mouse only in draw mode).
- The tone of the "through" ding (different from the captcha ding).
