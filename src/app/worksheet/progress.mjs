// The answered and reviewed count, the progress bar, and the policy preview with its sizes.
import {TRACKS, answeredCount, reviewedCount, instructionText} from '../../core/questionnaire.mjs';
import {tokenLabel} from '../../core/compiler.mjs';
import {$} from '../lib/dom.mjs';
import {track, currentState} from '../store/open-track.mjs';

export function renderProgress() {
  const state = currentState();
  const total = TRACKS[track].questions.length;
  const answered = answeredCount(state, track);
  $('count').textContent = `${answered} of ${total} answered · ${reviewedCount(state, track)} reviewed`;
  $('progress').max = total;
  $('progress').value = answered;
  const full = instructionText(state, track);
  const compact = instructionText(state, track, {compact: true});
  $('output').value = full;
  $('size-full').textContent = full.length.toLocaleString('en-US');
  $('size-compact').textContent = compact.length.toLocaleString('en-US');
  $('tokens-full').textContent = tokenLabel(full);
  $('tokens-compact').textContent = tokenLabel(compact);
}
