// Card shadows that drift gently with scrolling.
import {reducedMotion} from '../lib/dom.mjs';

let shadowTicking = false;
export function updateShadow() {
  shadowTicking = false;
  const root = document.documentElement;
  const y = reducedMotion() ? 0 : window.scrollY || 0;
  const max = Math.max(1, root.scrollHeight - window.innerHeight);
  const p = Math.min(1, y / max);
  root.style.setProperty('--sx', (Math.sin(y / 220) * 8).toFixed(2) + 'px');
  root.style.setProperty('--sy', (14 + p * 16 + Math.cos(y / 180) * 3).toFixed(2) + 'px');
  root.style.setProperty('--sb', (26 + p * 18).toFixed(2) + 'px');
}

export function queueShadow() {
  if (shadowTicking) return;
  shadowTicking = true;
  requestAnimationFrame(updateShadow);
}
