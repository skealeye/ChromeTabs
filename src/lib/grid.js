(function (root) {
  const PAGE_SIZE = 25;
  const TARGET_ASPECT = 16 / 10;
  const EMPTY_CELL_PENALTY = 0.05;

  // Pick the column count whose tiles are closest to 16:10, lightly
  // penalising empty cells so 25 panes fill a 5x5 rather than a ragged 6x5.
  function gridDims(n, width, height) {
    if (!n || n < 1) return { cols: 1, rows: 1 };
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const aspect = (width / cols) / (height / rows);
      const score = Math.abs(Math.log(aspect / TARGET_ASPECT)) + EMPTY_CELL_PENALTY * (cols * rows - n);
      if (!best || score < best.score) best = { cols, rows, score };
    }
    return { cols: best.cols, rows: best.rows };
  }

  function pageCount(n, size = PAGE_SIZE) {
    return Math.max(1, Math.ceil(n / size));
  }

  function pageOf(i, size = PAGE_SIZE) {
    return Math.floor(i / size);
  }

  const api = { gridDims, pageCount, pageOf, PAGE_SIZE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CTLib = Object.assign(root.CTLib || {}, api);
})(this);
