// The sticky bar: its height, its note, the save status, and the jump to downloads.
import {$, scrollToElement} from '../lib/dom.mjs';
import {trackSaved} from '../store/answers.mjs';
import {track} from '../store/open-track.mjs';

export function barNote(text) {
  $('bar-note').textContent = text;
  $('bar-note').hidden = !text;
}

export function syncBarHeight() {
  const bar = $('bar');
  if (bar.offsetHeight) document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
}

export function renderStorageStatus() {
  const ok = !track || trackSaved(track);
  $('storage-text').textContent = ok ? 'Saved in this browser' : 'Not saved: this browser is blocking storage.';
  $('storage-backup').hidden = ok;
  $('storage-status').classList.toggle('is-bad', !ok);
}

export function goToDownloads() {
  scrollToElement($('export'));
  $('download-policy').focus({preventScroll: true});
}
