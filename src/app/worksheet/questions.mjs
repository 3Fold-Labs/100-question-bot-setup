// The question cards: choices, notes, suggested and review markers, and moving to a question.
import {TRACKS, CHOICES, NOTES_MAX, trackGroups, stampAnswer, effectiveAnswer} from '../../core/questionnaire.mjs';
import {TOOL_TAG_TEXT, toolTag} from '../../core/compiler.mjs';
import {$, el, scrollToElement, setValue} from '../lib/dom.mjs';
import {CHOICE_TEXT, slugify} from '../lib/text.mjs';
import {saveChange} from '../store/answers.mjs';
import {track, currentState} from '../store/open-track.mjs';
import {barNote} from '../page/bar.mjs';
import {contentsLink} from '../page/contents.mjs';
import {groupQuestions, setGroupApplies} from './sections.mjs';

// The rendered controls for each question on the open track, by question id.
let questionViews = new Map();

export function renderQuestions() {
  questionViews = new Map();
  const container = $('questions');
  const nav = $('toc-nav');
  container.replaceChildren();
  nav.replaceChildren();
  for (const group of trackGroups(track)) {
    const section = el('section', 'q-section');
    section.id = 'section-' + slugify(group);
    section.dataset.group = group;
    const title = el('h2', 'q-section-title', group);
    title.tabIndex = -1;
    title.append(el('small'));
    const offRow = el('div', 'q-off-row');
    offRow.hidden = true;
    const count = groupQuestions(group).length;
    offRow.append(
      el('p', '', `Its ${count} questions read as Doesn’t apply in your policy. Your answers in it stay saved.`)
    );
    const turnOn = el('button', 'turn-on', 'Turn back on');
    turnOn.type = 'button';
    turnOn.addEventListener('click', () => {
      setGroupApplies(group, true);
      title.focus({preventScroll: true});
    });
    offRow.append(turnOn);
    const note = el('p', 'q-review-note');
    note.hidden = true;
    note.setAttribute('role', 'status');
    section.append(title, offRow, note);
    for (const q of groupQuestions(group)) section.append(renderQuestion(q));
    container.append(section);
    nav.append(contentsLink(group, section));
  }
}

function renderQuestion(q) {
  const fieldset = el('fieldset', 'q');
  fieldset.id = 'q-' + q.id;
  const titleId = 'q-title-' + q.id;
  fieldset.setAttribute('aria-labelledby', titleId);

  const head = el('div', 'q-head');
  head.append(el('span', 'q-num', String(q.id)));
  const title = el('h3', 'q-title', q.question);
  title.id = titleId;
  head.append(title);
  fieldset.append(head);

  // Builder questions say what a coding tool can do for them, from the tool rule mapping.
  const tag = toolTag(track, q.id);
  if (tag) {
    const tagLine = el('p', 'q-tool-tag', TOOL_TAG_TEXT[tag]);
    tagLine.dataset.tag = tag;
    fieldset.append(tagLine);
  }

  const meta = el('p', 'q-meta', 'Suggested: ');
  meta.append(el('strong', 'd-' + q.recommendation, q.recommendation));
  const marker = el('span', 'q-suggested', 'Suggested, not reviewed');
  marker.hidden = true;
  const review = el('span', 'q-review', 'Review this answer');
  review.hidden = true;
  meta.append(marker, review);
  fieldset.append(meta);

  if (q.hint) fieldset.append(el('p', 'q-hint', q.hint));
  if (q.overlap) fieldset.append(el('p', 'q-hint q-overlap', q.overlap));

  const choices = el('div', 'choices');
  const radios = [];
  for (const value of CHOICES) {
    const label = el('label', 'choice d-' + (value === 'N/A' ? 'NA' : value));
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'q' + q.id;
    input.value = value;
    // A click on any option, including the one already chosen, counts as a review.
    input.addEventListener('click', () => setChoice(q, value));
    label.append(input, document.createTextNode(CHOICE_TEXT[value]));
    choices.append(label);
    radios.push(input);
  }
  fieldset.append(choices);

  const notesLabel = el('label', 'notes-label', 'Scope or notes (optional)');
  const notes = document.createElement('textarea');
  notes.rows = 2;
  notes.maxLength = NOTES_MAX;
  notes.placeholder = q.example;
  notes.addEventListener('input', () => setNotes(q, notes.value));
  notesLabel.append(notes);
  fieldset.append(notesLabel);

  questionViews.set(q.id, {fieldset, radios, notes, marker, review});
  return fieldset;
}

export function syncQuestions() {
  const state = currentState();
  for (const q of TRACKS[track].questions) {
    const view = questionViews.get(q.id);
    const effective = effectiveAnswer(state, track, q);
    const saved = state.answers[q.id] || {choice: '', notes: ''};
    view.fieldset.classList.toggle('is-off', effective.off);
    for (const radio of view.radios) {
      radio.checked = effective.choice === radio.value;
      radio.disabled = effective.off;
    }
    setValue(view.notes, saved.notes || '');
    view.notes.disabled = effective.off;
    view.marker.hidden = !effective.suggested || effective.stale;
    view.review.hidden = !effective.stale;
  }
}

function setChoice(q, choice) {
  saveChange(track, state => {
    const existing = state.answers[q.id];
    state.answers[q.id] = stampAnswer(q, {choice, notes: existing ? existing.notes : ''});
  });
}

function setNotes(q, notes) {
  saveChange(track, state => {
    const existing = state.answers[q.id];
    const choice = existing ? existing.choice : '';
    if (!choice && !notes) {
      delete state.answers[q.id];
    } else {
      state.answers[q.id] = stampAnswer(q, {choice, notes});
    }
  });
}

// Scrolls to one question and focuses its chosen option, or its first option.
export function focusQuestion(id) {
  const view = questionViews.get(id);
  if (!view) return;
  const q = TRACKS[track].questions.find(q => q.id === id);
  if (effectiveAnswer(currentState(), track, q).off) {
    const section = view.fieldset.closest('.q-section');
    scrollToElement(section);
    section.querySelector('.turn-on').focus({preventScroll: true});
    return;
  }
  scrollToElement(view.fieldset);
  const radio = view.radios.find(r => r.checked) || view.radios[0];
  radio.focus({preventScroll: true});
}

export function nextUnanswered() {
  const state = currentState();
  const active = TRACKS[track].questions.filter(q => !effectiveAnswer(state, track, q).off);
  const target =
    active.find(q => !effectiveAnswer(state, track, q).choice) ||
    active.find(q => effectiveAnswer(state, track, q).unreviewed);
  if (!target) {
    barNote('All questions answered and reviewed');
    return;
  }
  barNote('');
  focusQuestion(target.id);
}
