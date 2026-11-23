(function (root) {
  const DEFAULT_SETTINGS = Object.freeze({ clickIntervalMs: 200, jitterPercent: 20, maxRunMinutes: 10 });
  const LIMITS = { clickIntervalMs: [150, 5000], jitterPercent: [0, 50], maxRunMinutes: [1, 60] };

  function normalizeSettings(obj) {
    const src = obj && typeof obj === 'object' ? obj : {};
    const out = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const n = parseInt(src[key], 10);
      const [lo, hi] = LIMITS[key];
      out[key] = Number.isNaN(n) ? DEFAULT_SETTINGS[key] : Math.min(hi, Math.max(lo, n));
    }
    return out;
  }

  const api = { normalizeSettings, DEFAULT_SETTINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
