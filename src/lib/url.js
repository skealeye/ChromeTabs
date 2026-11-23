(function (root) {
  const DEFAULT_COUNT = 20;
  const MIN_COUNT = 1;
  const WARN_COUNT = 100; // above this, ask before opening (each pane ~100-200 MB RAM)

  function normalizeUrl(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw || /\s/.test(raw)) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    let u;
    try { u = new URL(withScheme); } catch { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
    if (!(host === 'localhost' || isIp || /\.[a-z0-9-]{2,}$/i.test(host))) return null;
    return u.href;
  }

  function clampCount(input) {
    const n = parseInt(input, 10);
    if (Number.isNaN(n)) return DEFAULT_COUNT;
    return Math.max(MIN_COUNT, n);
  }

  const api = { normalizeUrl, clampCount, DEFAULT_COUNT, MIN_COUNT, WARN_COUNT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
