// Sections that apply: the on/off tiles, suggested answers, and each section's counts and review note.
import {TRACKS, trackGroups, stampAnswer, effectiveAnswer} from '../../core/questionnaire.mjs';
import {$, el, message} from '../lib/dom.mjs';
import {plural} from '../lib/text.mjs';
import {saveChange} from '../store/answers.mjs';
import {track, currentState} from '../store/open-track.mjs';

// Sections turned back on during this visit, which point out suggested answers waiting for review.
export const reviewPrompts = new Set();

export function groupQuestions(group) {
  return TRACKS[track].questions.filter(q => q.group === group);
}

export function renderGroups() {
  const tiles = trackGroups(track).map(group => {
    const tile = el('label', 'group-tile');
    tile.dataset.group = group;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => setGroupApplies(group, box.checked));
    const text = el('span', '', group);
    text.append(el('small'));
    tile.append(box, text);
    return tile;
  });
  $('groups').replaceChildren(...tiles);
}

export function updateGroupTiles() {
  const off = currentState().off;
  for (const tile of $('groups').children) {
    const group = tile.dataset.group;
    const isOff = off.includes(group);
    const count = groupQuestions(group).length;
    tile.classList.toggle('is-off', isOff);
    tile.querySelector('input').checked = !isOff;
    tile.querySelector('small').textContent = isOff ? `${count} questions · Turned off` : `${count} questions`;
  }
}

export function setGroupApplies(group, applies) {
  if (applies) reviewPrompts.add(group);
  else reviewPrompts.delete(group);
  const trackId = track;
  saveChange(trackId, state => {
    const off = new Set(state.off);
    if (applies) off.delete(group);
    else off.add(group);
    state.off = trackGroups(trackId).filter(g => off.has(g));
  });
}

export function fillSuggestions() {
  const trackId = track;
  const filled = saveChange(trackId, state => {
    let count = 0;
    for (const q of TRACKS[trackId].questions) {
      const existing = state.answers[q.id];
      if (existing && existing.choice) continue;
      state.answers[q.id] = stampAnswer(q, {
        choice: q.recommendation,
        notes: existing ? existing.notes : '',
        suggested: true
      });
      count++;
    }
    return count;
  });
  const text = filled
    ? `Filled ${filled} unanswered ${plural(filled, 'question', 'questions')} with suggested answers. Each one shows as suggested until you choose an answer or edit its notes.`
    : 'Every question already has an answer, so nothing changed.';
  message(text, 'suggest-status');
}

export function updateSectionCounts() {
  const state = currentState();
  for (const group of trackGroups(track)) {
    const questions = groupQuestions(group);
    const isOff = state.off.includes(group);
    const done = questions.filter(q => effectiveAnswer(state, track, q).choice).length;
    const waiting = questions.filter(q => effectiveAnswer(state, track, q).suggested).length;
    const link = $('toc-nav').querySelector(`a[data-group="${CSS.escape(group)}"]`);
    link.classList.toggle('is-off', isOff);
    link.querySelector('small').textContent = isOff ? 'Turned off' : `${done}/${questions.length}`;
    const section = document.querySelector(`.q-section[data-group="${CSS.escape(group)}"]`);
    section.classList.toggle('is-off', isOff);
    section.querySelector('.q-section-title small').textContent = isOff
      ? 'Turned off'
      : `${done} of ${questions.length} answered`;
    section.querySelector('.q-off-row').hidden = !isOff;
    const note = section.querySelector('.q-review-note');
    const showNote = !isOff && waiting > 0 && reviewPrompts.has(group);
    note.hidden = !showNote;
    note.textContent = showNote
      ? `${waiting} suggested ${plural(waiting, 'answer', 'answers')} in this section ${plural(waiting, 'is', 'are')} waiting for review.`
      : '';
  }
}
