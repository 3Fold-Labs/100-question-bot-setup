// Finding, creating, and updating page elements.

export const $ = id => document.getElementById(id);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function message(text, id = 'notice') {
  $(id).textContent = text;
}

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToElement(el, block = 'start') {
  el.scrollIntoView({behavior: reducedMotion() ? 'auto' : 'smooth', block});
}

// Leaves a field alone while someone is typing in it.
export function setValue(input, value) {
  if (input.value !== value && document.activeElement !== input) input.value = value;
}

export function selectText(node) {
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
    node.focus();
    node.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  node.focus();
}
