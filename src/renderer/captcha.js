/* global CTLib */
// Captcha assist: flags panes showing a challenge, alerts, and F2 jumps to them.
// It only helps the human find challenges; it never solves them.
(() => {
  const { nextAttention } = CTLib;
  const CT = window.CT;
  const counter = document.getElementById('attention');

  function updateCounter() {
    const n = CT.panes.filter((p) => p.attention).length;
    counter.hidden = n === 0;
    counter.textContent = `${n} need attention`;
  }

  let audio = null;
  function ding() {
    try {
      audio = audio || new AudioContext();
      const t = audio.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
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
    pane.attention = on;
    pane.el.classList.toggle('attention', on);
    updateCounter();
    CT.renderPager();
    CT.renderTabstrip();
    if (on && (!document.hasFocus() || !pane.el.classList.contains('shown'))) {
      ding();
      window.app.flash();
    }
  }

  function jumpToNext() {
    const i = nextAttention(CT.panes.map((p) => p.attention), CT.currentPane());
    if (i < 0) return;
    CT.setView('tabs');
    CT.selectPane(i);
  }

  CT.onPaneCreated = (pane) => {
    pane.webview.addEventListener('ipc-message', (e) => {
      if (e.channel === 'captcha') setAttention(pane, Boolean(e.args[0]));
    });
  };
  CT.onPanesChanged = updateCounter;
  CT.onF2 = jumpToNext;
  counter.addEventListener('click', jumpToNext);
})();
