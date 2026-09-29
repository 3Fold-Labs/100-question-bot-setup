// Test your agent: prompts that check each kind of answer.
import {agentTestPrompts} from '../../core/questionnaire.mjs';
import {$, el} from '../lib/dom.mjs';
import {joinOr} from '../lib/text.mjs';
import {track, currentState} from '../store/open-track.mjs';

export function renderTestPrompts() {
  const prompts = agentTestPrompts(currentState(), track);
  const items = prompts.map(p => {
    const item = el('li');
    item.dataset.choice = p.choice;
    item.append(el('p', 'prompt', p.prompt));
    const expect = el('p', 'expect');
    expect.append(el('strong', 'd-' + p.choice, `${p.choice} (#${p.id})`), document.createTextNode(p.expected));
    item.append(expect);
    return item;
  });
  $('test-list').replaceChildren(...items);
  const missing = ['DENY', 'ASK', 'ALLOW'].filter(choice => !prompts.some(p => p.choice === choice));
  $('test-empty').hidden = !missing.length;
  $('test-empty').textContent = missing.length
    ? `Choose ${joinOr(missing)} on any question in a section that applies to add a test for it.`
    : '';
}
