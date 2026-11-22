(function (root) {
  const MIN_GAP = 150;
  const GAP_RANGE = 250;

  function staggerDelays(n, rand = Math.random) {
    const out = [];
    let t = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) t += MIN_GAP + rand() * GAP_RANGE;
      out.push(Math.round(t));
    }
    return out;
  }

  const api = { staggerDelays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
