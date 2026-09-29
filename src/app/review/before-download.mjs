// Before you download: what agents may do without asking, additional boundaries, and what is left to answer or review.
import {TRACKS, effectiveAnswer, oneLine} from '../../core/questionnaire.mjs';
import {$, el, scrollToElement} from '../lib/dom.mjs';
import {CHOICE_TEXT} from '../lib/text.mjs';
import {track, currentState} from '../store/open-track.mjs';
import {focusQuestion} from '../worksheet/questions.mjs';

function questionLink(q, detail) {
  const item = el('li');
  const link = el('a');
  link.href = '#q-' + q.id;
  link.append(el('span', '', `${q.id}. ${q.question}`));
  if (detail) link.append(el('small', '', detail));
  link.addEventListener('click', event => {
    event.preventDefault();
    focusQuestion(q.id);
  });
  item.append(link);
  return item;
}

export function renderReviewPanel() {
  const state = currentState();
  const questions = TRACKS[track].questions
    .map(q => ({q, a: effectiveAnswer(state, track, q)}))
    .filter(({a}) => !a.off);
  // What agents may do without asking: an ALLOW that is not reviewed reads as ASK and waits in the review list.
  const allowed = questions.filter(({a}) => a.decision === 'ALLOW');
  const unanswered = questions.filter(({a}) => !a.choice);
  const review = questions.filter(({a}) => a.unreviewed);
  const boundaries = (state.exceptions || '').trim();
  const boundaryCount = boundaries ? boundaries.split('\n').filter(line => line.trim()).length : 0;
  $('review-allowed-summary').textContent = `What you allowed (${allowed.length})`;
  $('review-boundaries-summary').textContent = `Your additional boundaries (${boundaryCount})`;
  $('review-unanswered-summary').textContent = `Unanswered (${unanswered.length})`;
  $('review-review-summary').textContent = `Suggested or needing review (${review.length})`;
  $('review-boundaries-text').textContent =
    boundaries || 'None written. Add limits that apply to every answer in Additional boundaries.';
  // Long lists are built only while their group is open.
  const open = name => document.querySelector(`.review-group[data-review="${name}"]`).open;
  const fill = (name, list, items) => $(list).replaceChildren(...(open(name) ? items() : []));
  fill('allowed', 'review-allowed-list', () =>
    allowed.map(({q, a}) => questionLink(q, a.notes.trim() ? 'Notes: ' + oneLine(a.notes) : 'No notes'))
  );
  fill('unanswered', 'review-unanswered-list', () => unanswered.map(({q}) => questionLink(q, 'Unanswered')));
  fill('review', 'review-review-list', () =>
    review.map(({q, a}) =>
      questionLink(q, `${CHOICE_TEXT[a.choice]} · ${a.stale ? 'Review this answer' : 'Suggested, not reviewed'}`)
    )
  );
}

export function goToBoundaries(event) {
  event.preventDefault();
  scrollToElement($('exceptions'), 'center');
  $('exceptions').focus({preventScroll: true});
}
