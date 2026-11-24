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

// Tell the app when the person clicks inside this session (acknowledges its flags).
window.addEventListener('mousedown', (e) => { if (e.isTrusted) ipcRenderer.sendToHost('touch'); }, true);

// Left/Right arrows: offer them to the app (Tabs view uses them to switch sessions),
// unless you're typing in a field or the page itself already used the key.
function isEditable(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (isEditable(document.activeElement)) return;
  ipcRenderer.sendToHost('arrow', e.key === 'ArrowRight' ? 1 : -1);
});

window.addEventListener('DOMContentLoaded', () => {
  check();
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'hidden'],
  });
  setInterval(check, 1000);
});
