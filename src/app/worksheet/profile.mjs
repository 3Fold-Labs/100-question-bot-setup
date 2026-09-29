// Profile fields and additional boundaries.
import {PROFILE_FIELDS} from '../../core/questionnaire.mjs';
import {$, setValue} from '../lib/dom.mjs';
import {saveChange} from '../store/answers.mjs';
import {track, currentState} from '../store/open-track.mjs';

export function fillFields() {
  const state = currentState();
  for (const {key} of PROFILE_FIELDS) setValue($(key), state[key] || '');
  setValue($('exceptions'), state.exceptions || '');
}

export function bindFields() {
  for (const {key} of PROFILE_FIELDS) {
    $(key).addEventListener('input', () => {
      const value = $(key).value;
      saveChange(track, state => {
        state[key] = value;
      });
    });
  }
  $('exceptions').addEventListener('input', () => {
    const value = $('exceptions').value;
    saveChange(track, state => {
      state.exceptions = value;
    });
  });
}
