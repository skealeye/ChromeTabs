(function (root) {
  // Next flagged index after `current`, wrapping; `current` itself is checked last.
  function nextAttention(flags, current) {
    const n = flags.length;
    for (let k = 1; k <= n; k++) {
      const i = (((current + k) % n) + n) % n;
      if (flags[i]) return i;
    }
    return -1;
  }

  const api = { nextAttention };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
