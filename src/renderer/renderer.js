/* global CTLib */
(() => {
  const { normalizeUrl, clampCount, gridDims, pageCount, pageOf, PAGE_SIZE, staggerDelays } = CTLib;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const GAP = 4;

  let panes = [];
  let view = 'grid';
  let page = 0;
  let current = 0;
  let openId = 0;
  // Unique per app-page load, so a reload can never hand out an old session.
  const launchId = crypto.randomUUID().slice(0, 8);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function createPane(i, url) {
    const n = i + 1;
    const partition = `pane-${launchId}-${openId}-${n}`;
    const root = el('div', 'pane');
    const head = el('div', 'pane-head');
    const num = el('span', 'num', String(n));
    const back = el('button', 'icon', '←');
    back.title = 'Back';
    const reload = el('button', 'icon', '⟳');
    reload.title = 'Reload';
    const urlText = el('span', 'url', url);
    const max = el('button', 'icon max', '⤢');
    max.title = 'Maximize';
    head.append(num, back, reload, urlText, max);

    const webview = document.createElement('webview');
    webview.setAttribute('partition', partition);
    webview.setAttribute('useragent', window.app.userAgent);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('src', url);
    root.append(head, webview);

    const pane = { el: root, webview, n, partition, ready: false, attention: false, through: false, baseUrl: null, regions: [], assisting: false, urlText, max };
    webview.addEventListener('dom-ready', () => { pane.ready = true; });
    const onNav = (e) => { urlText.textContent = e.url; urlText.title = e.url; };
    webview.addEventListener('did-navigate', onNav);
    webview.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) onNav(e); });
    back.addEventListener('click', () => { if (webview.canGoBack()) webview.goBack(); });
    reload.addEventListener('click', () => webview.reload());
    // Toggle: maximize into Tabs view, or go back to the grid page this pane is on.
    max.addEventListener('click', () => { setView(view === 'tabs' ? 'grid' : 'tabs'); selectPane(i); });
    head.addEventListener('mousedown', () => { current = i; markCurrent(); if (window.CT.onSelect) window.CT.onSelect(pane); });
    webview.addEventListener('focus', () => { current = i; markCurrent(); });
    if (window.CT.onPaneCreated) window.CT.onPaneCreated(pane, i);
    return pane;
  }

  function openAll() {
    const url = normalizeUrl($('url').value);
    if (!url) { $('error').hidden = false; return; }
    $('error').hidden = true;
    $('url').value = url;
    const count = clampCount($('count').value);
    $('count').value = String(count);
    closeAll();
    openId += 1;
    for (let i = 0; i < count; i++) {
      const p = createPane(i, url);
      panes.push(p);
      stage.append(p.el);
    }
    layout();
  }

  function closeAll() {
    for (const p of panes) {
      p.el.remove();
      window.app.dropPartition(p.partition);
    }
    panes = [];
    current = 0;
    page = 0;
    layout();
    if (window.CT.onPanesChanged) window.CT.onPanesChanged();
  }

  function reloadAll() {
    const list = panes.slice();
    staggerDelays(list.length).forEach((d, i) => {
      setTimeout(() => { if (panes.includes(list[i])) list[i].webview.reload(); }, d);
    });
  }

  function place(p, x, y, w, h) {
    const s = p.el.style;
    s.left = `${x}px`; s.top = `${y}px`; s.width = `${w}px`; s.height = `${h}px`;
  }

  // Panes are never detached or display:none'd, so their pages keep running.
  function layout() {
    $('empty').hidden = panes.length > 0;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const shown = new Set();
    if (view === 'grid') {
      page = Math.min(page, pageCount(panes.length) - 1);
      const start = page * PAGE_SIZE;
      const onPage = panes.slice(start, start + PAGE_SIZE);
      const { cols, rows } = gridDims(onPage.length, W, H);
      const tw = (W - GAP * (cols - 1)) / cols;
      const th = (H - GAP * (rows - 1)) / rows;
      onPage.forEach((p, k) => {
        place(p, (k % cols) * (tw + GAP), Math.floor(k / cols) * (th + GAP), tw, th);
        shown.add(p);
      });
    } else if (panes[current]) {
      place(panes[current], 0, 0, W, H);
      shown.add(panes[current]);
    }
    for (const p of panes) {
      if (!shown.has(p)) place(p, 0, 0, W, H);
      p.el.classList.toggle('shown', shown.has(p));
      p.max.textContent = view === 'tabs' ? '⤡' : '⤢';
      p.max.title = view === 'tabs' ? 'Back to grid' : 'Maximize';
    }
    markCurrent();
    renderPager();
    renderTabstrip();
  }

  function markCurrent() {
    panes.forEach((p, i) => p.el.classList.toggle('current', i === current));
    document.querySelectorAll('#tabstrip button').forEach((b, i) => b.classList.toggle('on', i === current));
  }

  function renderPager() {
    const pc = pageCount(panes.length);
    $('pager').hidden = view !== 'grid' || pc <= 1;
    $('page-label').textContent = `Page ${page + 1}/${pc}`;
    const dots = $('page-dots');
    dots.replaceChildren();
    for (let k = 0; k < pc; k++) {
      const d = el('button', 'dot');
      d.title = `Page ${k + 1}`;
      d.classList.toggle('on', k === page);
      d.classList.toggle('attention', panes.slice(k * PAGE_SIZE, (k + 1) * PAGE_SIZE).some((p) => p.attention));
      d.classList.toggle('through', panes.slice(k * PAGE_SIZE, (k + 1) * PAGE_SIZE).some((p) => p.through));
      d.addEventListener('click', () => setPage(k));
      dots.append(d);
    }
  }

  function renderTabstrip() {
    const strip = $('tabstrip');
    strip.hidden = view !== 'tabs' || panes.length === 0;
    if (strip.hidden) return;
    strip.replaceChildren(...panes.map((p, i) => {
      const b = el('button', 'tab', String(p.n));
      b.classList.toggle('on', i === current);
      b.classList.toggle('attention', p.attention);
      b.classList.toggle('through', p.through);
      b.addEventListener('click', () => selectPane(i));
      return b;
    }));
  }

  function setView(v) {
    view = v === 'tabs' ? 'tabs' : 'grid';
    $('view-grid').classList.toggle('on', view === 'grid');
    $('view-tabs').classList.toggle('on', view === 'tabs');
    // The tab strip changes the stage height, so show/hide it before laying out.
    renderTabstrip();
    layout();
  }

  function setPage(p) {
    page = Math.max(0, Math.min(pageCount(panes.length) - 1, p));
    layout();
  }

  function selectPane(i) {
    if (!panes[i]) return;
    current = i;
    page = pageOf(i);
    layout();
    panes[i].webview.focus();
    if (window.CT.onSelect) window.CT.onSelect(panes[i]);
  }

  function handleHotkey(key) {
    if (!panes.length) return;
    if (key === 'f3' || key === 'f4' || key === 'escape') return window.CT.onKey && window.CT.onKey(key);
    const m = /^ctrl\+([1-9])$/.exec(key);
    if (m) return selectPane(Number(m[1]) - 1);
    if (key === 'ctrl+tab') return selectPane((current + 1) % panes.length);
    if (key === 'ctrl+shift+tab') return selectPane((current - 1 + panes.length) % panes.length);
    if (key === 'f2' && window.CT.onF2) return window.CT.onF2();
    if (window.CT.onKey) return window.CT.onKey(key);
  }

  window.CT = {
    get panes() { return panes; },
    selectPane, setView, setPage, layout, renderPager, renderTabstrip,
    currentPane: () => current,
    currentPage: () => page,
    view: () => view,
    handleHotkey,
    onPaneCreated: null,
    onPanesChanged: null,
    onF2: null,
    onSelect: null,
    onKey: null,
  };

  document.title = `ChromeTabs v${window.app.version}`;
  $('open').addEventListener('click', openAll);
  $('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') openAll(); });
  $('count').addEventListener('keydown', (e) => { if (e.key === 'Enter') openAll(); });
  $('reload-all').addEventListener('click', reloadAll);
  $('close-all').addEventListener('click', closeAll);
  $('view-grid').addEventListener('click', () => setView('grid'));
  $('view-tabs').addEventListener('click', () => setView('tabs'));
  $('prev').addEventListener('click', () => setPage(page - 1));
  $('next').addEventListener('click', () => setPage(page + 1));
  new ResizeObserver(() => layout()).observe(stage);

  // Keys pressed in the app chrome. Keys pressed inside a pane arrive via main.
  // PgUp/PgDn only page the grid from the chrome, so pages can still scroll.
  document.addEventListener('keydown', (e) => {
    if (view === 'grid' && !e.ctrlKey && !e.altKey && (e.key === 'PageDown' || e.key === 'PageUp')) {
      e.preventDefault();
      setPage(page + (e.key === 'PageDown' ? 1 : -1));
      return;
    }
    let key = null;
    if (e.ctrlKey && /^[1-9]$/.test(e.key)) key = 'ctrl+' + e.key;
    else if (e.ctrlKey && e.key === 'Tab') key = e.shiftKey ? 'ctrl+shift+tab' : 'ctrl+tab';
    else if (e.key === 'F2') key = 'f2';
    else if (e.key === 'F3') key = 'f3';
    else if (e.key === 'F4') key = 'f4';
    else if (e.key === 'Escape') key = 'escape';
    if (key) { e.preventDefault(); handleHotkey(key); }
  });
  window.app.onHotkey(handleHotkey);
  layout();
})();
