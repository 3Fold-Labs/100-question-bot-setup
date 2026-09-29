// Clearing one track's answers, after a confirmation.
import {emptyPolicy} from '../../core/questionnaire.mjs';
import {$, message} from '../lib/dom.mjs';
import {saveChange, replaceState} from '../store/answers.mjs';
import {track, trackLabel} from '../store/open-track.mjs';
import {reviewPrompts} from '../worksheet/sections.mjs';

export function askToClear() {
  const label = trackLabel();
  $('clear-confirm-text').textContent =
    `Clear all ${label} track answers in this browser? Save your answers to a file first if you want to keep them.`;
  $('clear-yes').textContent = `Yes, clear ${label} answers`;
  $('clear-confirm').hidden = false;
  message('', 'clear-status');
  $('clear-no').focus();
}

export function cancelClear() {
  $('clear-confirm').hidden = true;
}

export function declineClear() {
  cancelClear();
  message('Nothing was cleared.', 'clear-status');
}

export function clearTrack() {
  const label = trackLabel();
  cancelClear();
  reviewPrompts.clear();
  const trackId = track;
  saveChange(trackId, state => replaceState(state, emptyPolicy(trackId)));
  message(`${label} track answers cleared. Your other track and downloaded files are unchanged.`, 'clear-status');
}
