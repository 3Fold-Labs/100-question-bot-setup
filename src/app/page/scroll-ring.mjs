// The scroll ring: click for the top of the page, hold for the bottom.
import {$, reducedMotion} from '../lib/dom.mjs';

const scrollRing = $('scroll-ring');
let ringHoldTimer = null;
let ringHeld = false;
let ringPointer = null;

export function updateScrollRing() {
  const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const progress = limit ? Math.min(100, Math.max(0, (window.scrollY / limit) * 100)) : 0;
  $('scroll-ring-fill').style.strokeDashoffset = 100 - progress;
  scrollRing.hidden = limit === 0;
}

function stopRingHold() {
  clearTimeout(ringHoldTimer);
  ringHoldTimer = null;
}

function beginRingHold() {
  stopRingHold();
  ringHeld = false;
  ringHoldTimer = setTimeout(() => {
    ringHoldTimer = null;
    ringHeld = true;
    window.scrollTo({
      top: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      behavior: 'instant'
    });
  }, 600);
}

export function bindScrollRing() {
  scrollRing.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    ringPointer = event.pointerId;
    scrollRing.setPointerCapture(event.pointerId);
    beginRingHold();
  });
  scrollRing.addEventListener('pointerup', event => {
    if (event.pointerId !== ringPointer) return;
    stopRingHold();
    ringPointer = null;
  });
  scrollRing.addEventListener('pointercancel', () => {
    stopRingHold();
    ringPointer = null;
  });
  scrollRing.addEventListener('lostpointercapture', stopRingHold);
  scrollRing.addEventListener('keydown', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) beginRingHold();
  });
  scrollRing.addEventListener('keyup', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    stopRingHold();
    scrollRing.click();
  });
  scrollRing.addEventListener('blur', stopRingHold);
  window.addEventListener('blur', stopRingHold);
  scrollRing.addEventListener('contextmenu', event => event.preventDefault());
  scrollRing.addEventListener('click', () => {
    stopRingHold();
    if (ringHeld) {
      ringHeld = false;
      return;
    }
    window.scrollTo({top: 0, behavior: reducedMotion() ? 'instant' : 'smooth'});
  });
}
