// Text formatting shared across the page.

// How each answer choice reads on the page.
export const CHOICE_TEXT = {ALLOW: 'ALLOW', ASK: 'ASK', DENY: 'DENY', 'N/A': 'Doesn’t apply'};

export function plural(n, one, many) {
  return n === 1 ? one : many;
}

export function joinOr(items) {
  if (items.length < 2) return items.join('');
  return items.slice(0, -1).join(', ') + (items.length > 2 ? ',' : '') + ' or ' + items.at(-1);
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
