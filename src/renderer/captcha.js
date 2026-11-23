/* global CTLib */
// Attention flags: captcha challenges (red) and sessions that got through to a new page (green).
// Alerts, counters, F2 to jump to them, and auto-advance to the next captcha once the
// one on screen is solved. It never solves captchas.
(() => {
  const { nextAttention, isThrough } = CTLib;
  const CT = window.CT;
  const counter = document.getElementById('attention');
  const throughPill = document.getElementById('through');

  function updateCounter() {
    const n = CT.panes.filter((p) => p.attention).length;
    counter.hidden = n === 0;
    counter.textContent = `${n} need attention`;
    const t = CT.panes.filter((p) => p.through).length;
    throughPill.hidden = t === 0;
    throughPill.textContent = `${t} through`;
  }

  let audio = null;
  function ding(freq = 880) {
    try {
      audio = audio || new AudioContext();
      const t = audio.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, t + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.15);
        osc.connect(gain).connect(audio.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.16);
      });
    } catch { /* no audio device */ }
  }

  function setAttention(pane, on) {
    if (pane.attention === on || !CT.panes.includes(pane)) return;
    const wasOnScreen = CT.panes[CT.currentPane()] === pane && pane.el.classList.contains('shown');
    pane.attention = on;
    pane.el.classList.toggle('attention', on);
    // Never click over a captcha: pause assist so the person can solve it.
    if (on && pane.assisting && CT.assist) CT.assist.stop('paused: captcha. Solve it, then press F4');
    updateCounter();
    CT.renderPager();
    CT.renderTabstrip();
    if (on && (!document.hasFocus() || !pane.el.classList.contains('shown'))) {
      ding();
      window.app.flash();
    }
    // Solved the captcha you were looking at: go straight to the next one, if any.
    if (!on && wasOnScreen) {
      const i = nextAttention(CT.panes.map((p) => p.attention), CT.panes.indexOf(pane));
      if (i >= 0) { CT.setView('tabs'); CT.selectPane(i); }
    }
  }

  const isWatching = (pane) => document.hasFocus() && pane.el.classList.contains('shown') && CT.panes[CT.currentPane()] === pane;

  function setThrough(pane, on) {
    if (pane.through === on || !CT.panes.includes(pane)) return;
    pane.through = on;
    pane.el.classList.toggle('through', on);
    updateCounter();
    CT.renderPager();
    CT.renderTabstrip();
    if (on) {
      ding(1320);
      window.app.flash();
    }
  }

  function onNavigate(pane, url) {
    const now = Date.now();
    const settling = now - (pane.lastNavAt || 0) < CT.throughSettleMs;
    pane.lastNavAt = now;
    if (!pane.baseUrl) { pane.baseUrl = url; return; }
    if (!isThrough(pane.baseUrl, url)) return;
    // Redirects right after loading (e.g. into a waiting room) set the baseline, not a flag.
    if (settling && !pane.assisting) { pane.baseUrl = url; return; }
    // The session you're looking at moving on is your own doing; just re-baseline.
    if (isWatching(pane) && !pane.assisting) { pane.baseUrl = url; return; }
    pane.baseUrl = url;
    setThrough(pane, true);
  }

  function jumpToNext() {
    let i = nextAttention(CT.panes.map((p) => p.attention), CT.currentPane());
    if (i < 0) i = nextAttention(CT.panes.map((p) => p.through), CT.currentPane());
    if (i < 0) return;
    CT.setView('tabs');
    CT.selectPane(i);
  }

  CT.onPaneCreated = (pane) => {
    pane.webview.addEventListener('ipc-message', (e) => {
      if (e.channel === 'captcha') setAttention(pane, Boolean(e.args[0]));
      // A click inside the session acknowledges it, but not assist's own clicks, and
      // not for a moment after assist brought it forward (late clicks from the old page).
      if (e.channel === 'touch' && !pane.assisting && Date.now() - (pane.surfacedAt || 0) > 1500) setThrough(pane, false);
    });
    pane.webview.addEventListener('did-navigate', (e) => onNavigate(pane, e.url));
    pane.webview.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) onNavigate(pane, e.url); });
  };
  // Looking at a session acknowledges its through flag.
  CT.onSelect = (pane) => setThrough(pane, false);
  CT.setThrough = setThrough;
  CT.throughSettleMs = 8000;
  CT.onPanesChanged = updateCounter;
  CT.onF2 = jumpToNext;
  counter.addEventListener('click', jumpToNext);
  throughPill.addEventListener('click', jumpToNext);
})();
