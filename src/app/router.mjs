// The start page and the two tracks: the address hash, opening and switching tracks, and the way home.
import {TRACK_IDS} from '../core/questionnaire.mjs';
import {$, message, reducedMotion} from './lib/dom.mjs';
import {TRACK_KEY, readStorage, writeStorage} from './store/browser-storage.mjs';
import {reloadTrack} from './store/answers.mjs';
import {track, setTrack, otherTrack} from './store/open-track.mjs';
import {renderHero, renderTrackText} from './page/hero.mjs';
import {barNote, syncBarHeight} from './page/bar.mjs';
import {updateScrollRing} from './page/scroll-ring.mjs';
import {renderGroups, reviewPrompts} from './worksheet/sections.mjs';
import {renderQuestions} from './worksheet/questions.mjs';
import {cancelBackup} from './export/answers-file.mjs';
import {cancelClear} from './export/clear-track.mjs';
import {renderTrack} from './render.mjs';

// A downloaded blank worksheet always opens on the start page.
const startAtPicker = document.documentElement.hasAttribute('data-blank');

function hashTrack() {
  const id = location.hash.replace(/^#/, '');
  return TRACK_IDS.includes(id) ? id : null;
}

export function initialTrack() {
  const fromHash = hashTrack();
  if (fromHash) return fromHash;
  if (location.hash === '#start') return null;
  if (startAtPicker) return null;
  const remembered = readStorage(TRACK_KEY);
  return TRACK_IDS.includes(remembered) ? remembered : null;
}

export function route() {
  const next = hashTrack();
  if (!next) {
    showPicker();
  } else if (next !== track) {
    openTrack(next);
  }
}

export function showPicker() {
  setTrack(null);
  $('picker').hidden = false;
  $('track-view').hidden = true;
  renderHero();
  cancelClear();
  cancelBackup();
  updateScrollRing();
}

export function openTrack(trackId) {
  setTrack(trackId);
  writeStorage(TRACK_KEY, trackId);
  reloadTrack(trackId);
  $('picker').hidden = true;
  $('track-view').hidden = false;
  cancelClear();
  cancelBackup();
  reviewPrompts.clear();
  for (const id of [
    'hero-status',
    'notice',
    'suggest-status',
    'share-status',
    'clear-status',
    'quick-start-status',
    'unreadable-status',
    'tool-status'
  ])
    message('', id);
  $('share-link-box').hidden = true;
  barNote('');
  renderHero();
  renderTrackText();
  renderGroups();
  renderQuestions();
  renderTrack();
  syncBarHeight();
  updateScrollRing();
}

// Opening a track returns to the top, where the header names the track.
export function chooseTrack(trackId) {
  openTrack(trackId);
  if (location.hash !== '#' + trackId) location.hash = trackId;
  window.scrollTo({top: 0, behavior: reducedMotion() ? 'auto' : 'smooth'});
}

// The logo always returns to the start page with both tracks.
export function goHome(event) {
  event.preventDefault();
  if (location.hash === '#start') showPicker();
  else location.hash = 'start';
  window.scrollTo({top: 0, behavior: reducedMotion() ? 'auto' : 'smooth'});
}

export function switchTrack() {
  chooseTrack(otherTrack());
  $('hero-title').focus({preventScroll: true});
}
