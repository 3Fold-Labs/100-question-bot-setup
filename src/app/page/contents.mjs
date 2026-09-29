// The contents list: one link per section, opening and closing on small screens, and the section in view.
import {$, el, scrollToElement} from '../lib/dom.mjs';
import {track} from '../store/open-track.mjs';

export function contentsLink(group, section) {
  const link = el('a', '', group);
  link.href = '#' + section.id;
  link.dataset.group = group;
  link.append(el('small'));
  link.addEventListener('click', event => {
    event.preventDefault();
    scrollToElement(section);
    setActiveToc(section.id);
    closeToc();
  });
  return link;
}

export function setActiveToc(sectionId) {
  for (const link of $('toc-nav').querySelectorAll('a')) {
    if (link.getAttribute('href') === '#' + sectionId) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

export function closeToc() {
  $('toc').classList.remove('is-open');
  $('toc-toggle').setAttribute('aria-expanded', 'false');
}

export function toggleToc() {
  const open = $('toc').classList.toggle('is-open');
  $('toc-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}

let tocTicking = false;
export function trackActiveSection() {
  if (tocTicking || !track) return;
  tocTicking = true;
  requestAnimationFrame(() => {
    tocTicking = false;
    const sections = [...document.querySelectorAll('.q-section')];
    if (!sections.length) return;
    const line = window.scrollY + $('bar').offsetHeight + 40;
    let current = sections[0].id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top + window.scrollY <= line) current = section.id;
    }
    setActiveToc(current);
  });
}
