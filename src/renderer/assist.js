/* global CTLib */
// Click assist: repeatedly clicks user-drawn regions in ONE session at a human pace
// (>= 150 ms), for people who can't click over and over. It stops when the page moves on.
(() => {
  const { clampInterval, nextDelay, randomPoint, isThrough, MAX_REGIONS, MAX_RUN_MS } = CTLib;
  const CT = window.CT;
  const $ = (id) => document.getElementById(id);
  const toggle = $('assist-toggle');
  const msBox = $('assist-ms');
  const status = $('assist-status');

  let runPane = null;
  let timer = null;
  let startedAt = 0;
  let startUrl = '';
  let clicks = 0;
  let next = 0;
  let maxRunMs = MAX_RUN_MS;
  let jitterPercent = 20;
  let lastMessage = '';
  let onNav = null;

  const currentPane = () => CT.panes[CT.currentPane()] || null;
  const running = () => runPane !== null;

  // From the user typing in the ms box: clamp and save to settings.json.
  function setMs(v) {
    const ms = clampInterval(v);
    const changed = String(ms) !== msBox.dataset.saved;
    msBox.value = String(ms);
    if (changed) {
      msBox.dataset.saved = String(ms);
      window.app.saveSettings({ clickIntervalMs: ms });
    }
  }

  // From settings.json (startup or an edit while running). Doesn't write back.
  let settingsError = '';
  function applySettings({ settings, error }) {
    settingsError = error || '';
    if (document.activeElement !== msBox) {
      msBox.value = String(settings.clickIntervalMs);
      msBox.dataset.saved = msBox.value;
    }
    jitterPercent = settings.jitterPercent;
    maxRunMs = settings.maxRunMinutes * 60000;
    refresh();
  }

  function renderRegions(pane) {
    let layer = pane.el.querySelector('.regions');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'regions';
      pane.el.append(layer);
    }
    layer.replaceChildren(...pane.regions.map((r, k) => {
      const d = document.createElement('div');
      d.className = 'region';
      d.style.left = `${r.x}px`;
      d.style.top = `${r.y}px`;
      d.style.width = `${r.w}px`;
      d.style.height = `${r.h}px`;
      d.textContent = String(k + 1);
      return d;
    }));
  }

  function addRegion(i, rect) {
    const pane = CT.panes[i];
    if (!pane) return;
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
    pane.regions.push(r);
    while (pane.regions.length > MAX_REGIONS) pane.regions.shift();
    const box = pane.webview.getBoundingClientRect();
    pane.regionSize = { w: Math.round(box.width), h: Math.round(box.height) };
    renderRegions(pane);
    refresh();
  }

  function clear(i) {
    const pane = CT.panes[i];
    if (!pane) return;
    if (runPane === pane) stop('stopped');
    pane.regions = [];
    renderRegions(pane);
    refresh();
  }

  // Draw mode: a transparent layer over the current session; drag a box, Esc cancels.
  let drawLayer = null;
  function cancelDraw() {
    if (drawLayer) drawLayer.remove();
    drawLayer = null;
  }
  function startDraw() {
    const pane = currentPane();
    if (!pane) return;
    cancelDraw();
    CT.selectPane(CT.currentPane());
    const wv = pane.webview;
    drawLayer = document.createElement('div');
    drawLayer.className = 'draw-layer';
    drawLayer.style.top = `${wv.offsetTop}px`;
    const hint = document.createElement('div');
    hint.className = 'draw-hint';
    hint.textContent = 'Drag a box over the button to click · Esc cancels';
    const box = document.createElement('div');
    box.className = 'region drawing';
    drawLayer.append(hint, box);
    let start = null;
    const rel = (e) => {
      const b = drawLayer.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
    drawLayer.addEventListener('mousedown', (e) => { start = rel(e); e.preventDefault(); });
    drawLayer.addEventListener('mousemove', (e) => {
      if (!start) return;
      const r = rectOf(start, rel(e));
      Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, display: 'block' });
    });
    drawLayer.addEventListener('mouseup', (e) => {
      if (!start) return;
      const r = rectOf(start, rel(e));
      cancelDraw();
      if (r.w >= 6 && r.h >= 6) addRegion(CT.panes.indexOf(pane), r);
    });
    pane.el.append(drawLayer);
  }

  function click(pane, region) {
    const { x, y } = randomPoint(region);
    const wv = pane.webview;
    wv.sendInputEvent({ type: 'mouseMove', x, y });
    wv.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    wv.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    clicks += 1;
  }

  function tick() {
    timer = null;
    if (!runPane) return;
    if (!CT.panes.includes(runPane)) return stop('stopped (session closed)');
    if (Date.now() - startedAt >= maxRunMs) return stop(`stopped after ${Math.round(maxRunMs / 60000) || '<1'} min limit`);
    if (!runPane.regions.length) return stop('stopped (no regions)');
    try {
      click(runPane, runPane.regions[next % runPane.regions.length]);
    } catch { /* pane mid-navigation */ }
    next += 1;
    timer = setTimeout(tick, nextDelay(clampInterval(msBox.value), Math.random, jitterPercent));
  }

  function start() {
    const pane = currentPane();
    if (!pane || !pane.regions.length || running()) return;
    runPane = pane;
    pane.assisting = true;
    pane.el.classList.add('assisting');
    startedAt = Date.now();
    startUrl = pane.webview.getURL();
    clicks = 0;
    next = 0;
    lastMessage = '';
    onNav = (e) => { if (isThrough(startUrl, e.url)) stop('through'); };
    pane.webview.addEventListener('did-navigate', onNav);
    window.app.setAssisting(true);
    tick();
    refresh();
  }

  function stop(reason = 'stopped') {
    if (!runPane) return;
    const pane = runPane;
    runPane = null;
    if (timer) clearTimeout(timer);
    timer = null;
    pane.assisting = false;
    pane.el.classList.remove('assisting');
    pane.webview.removeEventListener('did-navigate', onNav);
    onNav = null;
    window.app.setAssisting(false);
    lastMessage = reason === 'through'
      ? `#${pane.n} got through after ${clicks} clicks — stopped`
      : `#${pane.n} ${reason} · ${clicks} clicks`;
    if (reason === 'through' && CT.panes.includes(pane)) {
      // Bring it to the front, then flag it (selecting clears flags, so flag last).
      CT.setView('tabs');
      CT.selectPane(CT.panes.indexOf(pane));
      CT.setThrough(pane, false);
      CT.setThrough(pane, true);
    }
    refresh();
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function refresh() {
    const pane = currentPane();
    toggle.textContent = running() ? '■ Stop' : '▶ Auto-click';
    toggle.classList.toggle('on', running());
    toggle.disabled = !running() && !(pane && pane.regions.length);
    $('clear-regions').disabled = !(pane && pane.regions.length);
    $('draw').disabled = !pane;
    if (running()) {
      const box = runPane.webview.getBoundingClientRect();
      const moved = runPane.regionSize
        && (Math.abs(box.width - runPane.regionSize.w) > 2 || Math.abs(box.height - runPane.regionSize.h) > 2);
      status.textContent = `Assisting #${runPane.n} · ${clicks} clicks · ${fmt(Date.now() - startedAt)}`
        + (moved ? ' · layout changed, redraw regions?' : '');
    } else {
      status.textContent = settingsError || lastMessage;
    }
  }

  function onKey(key) {
    if (key === 'f3') return startDraw();
    if (key === 'f4') return running() ? stop('stopped') : start();
    if (key === 'escape') {
      if (drawLayer) return cancelDraw();
      if (running()) return stop('stopped');
    }
  }

  CT.assist = {
    addRegion, clear, start, stop, running,
    clicks: () => clicks,
    setMaxRunMs: (ms) => { maxRunMs = ms; },
    setJitterPercent: (p) => { jitterPercent = p; },
    setMs,
  };
  CT.onKey = onKey;

  $('draw').addEventListener('click', startDraw);
  $('clear-regions').addEventListener('click', () => clear(CT.currentPane()));
  toggle.addEventListener('click', () => (running() ? stop('stopped') : start()));
  msBox.addEventListener('change', () => setMs(msBox.value));
  msBox.addEventListener('blur', () => setMs(msBox.value));
  setInterval(refresh, 300);
  applySettings(window.app.getSettings());
  window.app.onSettings(applySettings);
})();
