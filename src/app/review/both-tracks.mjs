// Both tracks: questions asked in both tracks that have a different answer or different notes.
import {TRACK_IDS, crossTrackDifferences} from '../../core/questionnaire.mjs';
import {$, el} from '../lib/dom.mjs';
import {CHOICE_TEXT, plural} from '../lib/text.mjs';
import {states, hasAnswers} from '../store/answers.mjs';
import {track, trackLabel} from '../store/open-track.mjs';
import {focusQuestion} from '../worksheet/questions.mjs';

export function renderBothTracks() {
  const show = TRACK_IDS.every(t => states[t] && hasAnswers(states[t]));
  $('both-tracks').hidden = !show;
  if (!show) {
    $('both-tracks-list').replaceChildren();
    return;
  }
  const diffs = crossTrackDifferences(states);
  $('both-tracks-summary').textContent = diffs.length
    ? `${diffs.length} ${plural(diffs.length, 'question appears', 'questions appear')} in both tracks with a different answer or different notes. Check which limit applies to which work.`
    : 'Questions asked in both tracks have the same choice and notes in each. Each track also has questions of its own, so give each agent the policy for its work.';
  const items = diffs.map(d => {
    const id = d.ids[track];
    const item = el('li');
    const link = el('a');
    link.href = '#q-' + id;
    link.append(
      el('span', '', `${id}. ${d.question}`),
      el(
        'small',
        '',
        TRACK_IDS.map(
          t => `${trackLabel(t)}: ${CHOICE_TEXT[d.choices[t]]}${d.notes[t] ? ` (${d.notes[t]})` : ''}`
        ).join(' · ')
      )
    );
    link.addEventListener('click', event => {
      event.preventDefault();
      focusQuestion(id);
    });
    item.append(link);
    return item;
  });
  $('both-tracks-list').replaceChildren(...items);
}
