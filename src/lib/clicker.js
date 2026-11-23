(function (root) {
  const MIN_MS = 150;
  const MAX_MS = 5000;
  const DEFAULT_MS = 200;
  const MAX_REGIONS = 3;
  const MAX_RUN_MS = 600000;
  const INSET = 2;

  function clampInterval(v) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return DEFAULT_MS;
    return Math.min(MAX_MS, Math.max(MIN_MS, n));
  }

  // Jitter only ever adds time, so clicks are never faster than `ms`.
  function nextDelay(ms, rand = Math.random, jitterPercent = 20) {
    return Math.round(ms * (1 + (rand() * jitterPercent) / 100));
  }

  function randomPoint(r, rand = Math.random) {
    const ix = r.w > INSET * 2 + 1 ? INSET : 0;
    const iy = r.h > INSET * 2 + 1 ? INSET : 0;
    return {
      x: Math.floor(r.x + ix + rand() * (r.w - ix * 2)),
      y: Math.floor(r.y + iy + rand() * (r.h - iy * 2)),
    };
  }

  // A different host or path means the page moved on; query/hash changes don't count.
  function isThrough(baseUrl, newUrl) {
    if (!baseUrl || !newUrl) return false;
    let a, b;
    try { a = new URL(baseUrl); b = new URL(newUrl); } catch { return false; }
    return a.host !== b.host || a.pathname !== b.pathname;
  }

  const api = { clampInterval, nextDelay, randomPoint, isThrough, MIN_MS, MAX_MS, DEFAULT_MS, MAX_REGIONS, MAX_RUN_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
