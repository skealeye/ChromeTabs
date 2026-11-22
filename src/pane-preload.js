// Runs inside every pane. Detects a *visible* captcha challenge and tells the
// app so a human can solve it. It never touches the captcha itself.
const { ipcRenderer } = require('electron');

const MIN_SIZE = 50;
let last = null;

function isChallengeFrame(src) {
  if (/recaptcha/i.test(src) && /bframe/i.test(src)) return true; // reCAPTCHA v2 / enterprise challenge
  if (/hcaptcha/i.test(src) && /frame=challenge/i.test(src)) return true; // hCaptcha challenge
  return false;
}

function isShown(frame) {
  const r = frame.getBoundingClientRect();
  if (r.width <= MIN_SIZE || r.height <= MIN_SIZE) return false;
  if (r.bottom < -1000 || r.right < -1000) return false; // parked off-screen while idle
  for (let e = frame; e && e.nodeType === 1; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  }
  return true;
}

function check() {
  let visible = false;
  for (const f of document.querySelectorAll('iframe')) {
    if (isChallengeFrame(f.src || '') && isShown(f)) { visible = true; break; }
  }
  if (visible !== last) {
    last = visible;
    ipcRenderer.sendToHost('captcha', visible);
  }
}

let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; check(); }, 200);
}

window.addEventListener('DOMContentLoaded', () => {
  check();
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'hidden'],
  });
  setInterval(check, 1000);
});
