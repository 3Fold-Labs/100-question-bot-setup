// The notice for saved answers that could not be read, and the download of that data.
import {$, message} from '../lib/dom.mjs';
import {downloadFile} from '../lib/files.mjs';
import {keptAside, hideUnreadableNotice, unreadableNoticeHidden} from '../store/answers.mjs';
import {track} from '../store/open-track.mjs';

export function renderUnreadable() {
  $('unreadable').hidden = !track || unreadableNoticeHidden(track) || !keptAside(track).length;
}

export function downloadUnreadable() {
  const items = keptAside(track);
  if (!items.length) return;
  const name = `unreadable-answers-${track}.txt`;
  const text = items.length === 1 ? items[0].raw : items.map(item => `${item.key}\n${item.raw}`).join('\n\n');
  downloadFile(name, text, 'text/plain');
  message(`Downloaded ${name}.`, 'unreadable-status');
}

export function hideUnreadable() {
  hideUnreadableNotice(track);
  renderUnreadable();
}
