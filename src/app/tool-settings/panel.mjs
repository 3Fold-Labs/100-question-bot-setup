// The Builder coding tool panel: which answers tool rules back up, and the settings for the chosen tool.
import {TRACKS, effectiveAnswer} from '../../core/questionnaire.mjs';
import {
  TOOL_PATHS,
  TOOL_SHARED_FILES,
  compileToolSettings,
  coverageText,
  toolCheckCommand,
  ruleChanges,
  toolRulesText,
  codexCheckDecision
} from '../../core/compiler.mjs';
import {$, el} from '../lib/dom.mjs';
import {CHOICE_TEXT} from '../lib/text.mjs';
import {CODING_TOOL_KEY, readStorage, writeStorage} from '../store/browser-storage.mjs';
import {track, currentState} from '../store/open-track.mjs';
import {lastToolRules} from './installed-rules.mjs';

const CODING_TOOLS = ['claude', 'codex', 'gemini', 'cursor', 'none'];
const CODING_TOOL_NAMES = {claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', cursor: 'Cursor'};

function toolAnswerText(state, q) {
  const a = effectiveAnswer(state, track, q);
  if (!a.choice) return 'Unanswered, so the tools ask';
  if (a.choice === 'N/A') return 'Doesn’t apply, so the tools ask';
  if (a.decision !== a.choice) return 'ALLOW, not reviewed, so the tools ask';
  return CHOICE_TEXT[a.choice];
}

function toolNames(ids) {
  return ids.map(id => CODING_TOOL_NAMES[id]).join(', ');
}

function codingTool() {
  const saved = readStorage(CODING_TOOL_KEY);
  return CODING_TOOLS.includes(saved) ? saved : null;
}

export function chooseCodingTool(tool) {
  writeStorage(CODING_TOOL_KEY, tool);
  renderToolSettings();
}

export function renderToolSettings() {
  if (track !== 'builder') return;
  const state = currentState();
  const {coverage, snippets, rules} = compileToolSettings(state, {date: ''});
  const backed = coverage.backed.length,
    rest = coverage.instructionsOnly.length;
  $('tool-coverage').textContent = coverageText(coverage);
  $('tool-backed-summary').textContent = `Backed by tool rules (${backed})`;
  $('tool-instructions-summary').textContent = `Instructions only (${rest})`;
  const byId = new Map(TRACKS.builder.questions.map(q => [q.id, q]));
  const item = (id, extra) => {
    const q = byId.get(id);
    const li = el('li', '', `${id}. ${q.question}`);
    li.append(el('small', '', toolAnswerText(state, q) + extra(id)));
    return li;
  };
  const partial = new Set(coverage.partial),
    notes = new Set(coverage.notes);
  $('tool-backed-list').replaceChildren(
    ...coverage.backed.map(id => item(id, () => ' · Claude Code, Codex, Gemini CLI'))
  );
  $('tool-instructions-list').replaceChildren(
    ...coverage.instructionsOnly.map(id =>
      item(id, id => {
        const tools = coverage.tools[id];
        if (!tools.length) return '';
        if (partial.has(id)) return ` · Partial: a rule in ${toolNames(tools)} covers only some forms of this action`;
        if (notes.has(id)) return ` · A rule in ${toolNames(tools)}, and your notes stay as instructions`;
        return ` · Also a rule in ${toolNames(tools)}`;
      })
    )
  );
  const tool = codingTool();
  for (const input of document.querySelectorAll('input[name="coding-tool"]')) input.checked = input.value === tool;
  for (const panel of document.querySelectorAll('#tool-settings [data-tool]'))
    panel.hidden = panel.dataset.tool !== tool;
  $('tool-pick-hint').hidden = Boolean(tool);
  for (const [key, text] of Object.entries(snippets)) {
    const node = $('snippet-' + key);
    if (node && !TOOL_SHARED_FILES.includes(key)) node.textContent = text;
  }
  // Claude Code and Cursor files also hold other settings: after the first time, show what to remove and add.
  const changes = {};
  for (const t of ['claude', 'codex', 'gemini', 'cursor']) {
    const base = lastToolRules(t);
    changes[t] = base ? ruleChanges(base, rules[t]) : null;
  }
  for (const t of TOOL_SHARED_FILES) {
    const change = changes[t];
    const update = Boolean(change && (change.add.length || change.remove.length));
    const lead = document.querySelector(`[data-update-lead="${t}"]`);
    if (!lead.dataset.first) lead.dataset.first = lead.innerHTML;
    if (update) lead.textContent = 'To update, remove these rules from your file and add these.';
    else lead.innerHTML = lead.dataset.first;
    document.querySelector(`[data-remove="${t}"]`).hidden = !update || !change.remove.length;
    $('remove-' + t).textContent = update && change.remove.length ? toolRulesText(t, change.remove) : '';
    $('snippet-' + t).textContent = !update
      ? snippets[t]
      : change.add.length
        ? toolRulesText(t, change.add)
        : 'Nothing to add.';
    document.querySelector(`[data-same="${t}"]`).hidden = !change || update;
    const copy = document.querySelector(`.tool-copy[data-snippet="${t}"][data-part="add"]`);
    copy.textContent = update ? 'Copy rules to add' : 'Copy rules';
    copy.disabled = update && !change.add.length;
    // The confirm button is how the record of what is installed advances: "I've added these rules" the first
    // time, "My file is updated" once there is something to update, and hidden once the record matches.
    const confirm = document.querySelector(`[data-confirm="${t}"]`);
    confirm.textContent = change ? 'My file is updated' : "I've added these rules";
    confirm.hidden = Boolean(change && !update);
  }
  // Codex and Gemini CLI files hold only these rules, so their copy keeps saying to replace the whole file. They
  // still need their own confirm button: downloading or copying is not evidence the file was actually replaced, so
  // the record of what is installed, and the check step below, advances only once the user presses it.
  for (const t of ['codex', 'gemini']) {
    const change = changes[t];
    const update = Boolean(change && (change.add.length || change.remove.length));
    const confirm = document.querySelector(`[data-confirm="${t}"]`);
    confirm.textContent = "I've replaced the file";
    confirm.hidden = Boolean(change && !update);
  }
  const changedIds = t => (changes[t] ? [...new Set(changes[t].add.flatMap(e => e.ids))] : []);
  const changed = t => (changes[t] ? changes[t].add[0] || null : null);
  for (const node of document.querySelectorAll('.tool-covers[data-covers]')) {
    const t = node.dataset.covers;
    if (!coverage.byTool[t]) continue;
    const n = coverage.byTool[t].length;
    node.textContent = `In ${CODING_TOOL_NAMES[t]}, these settings back up ${n} of your 100 answers. The rest rely on the instructions in your policy.`;
  }
  // Checks use a rule that changed since the rules were last recorded as installed, when there is one.
  const ruleTool = ['claude', 'codex', 'gemini', 'cursor'].includes(tool) ? tool : null;
  const check = toolCheckCommand(state, ruleTool ? changedIds(ruleTool) : []);
  $('tool-check').hidden = !check || !['claude', 'codex', 'gemini'].includes(tool);
  $('tool-check-command').textContent = check || '';
  const codexRule = changed('codex');
  const codexCommand = codexRule ? codexRule.key : check || 'git push --force';
  $('tool-codex-check').textContent =
    `codex execpolicy check --pretty --rules ${TOOL_PATHS.codexRules} -- ${codexCommand}`;
  const codexExpect = codexRule || check ? codexCheckDecision(rules.codex, codexCommand) : null;
  $('tool-codex-expect').textContent = codexExpect ? `: it should be ${codexExpect}` : '';
  const geminiCheck = toolCheckCommand(state, changedIds('gemini'));
  if (geminiCheck)
    $('tool-gemini-check').replaceChildren(
      'Start Gemini CLI and ask it to run ',
      el('code', '', geminiCheck),
      '. It refuses with your policy’s reason.'
    );
  else
    $('tool-gemini-check').replaceChildren(
      'Gemini CLI reads every .toml file in ',
      el('code', '', '~/.gemini/policies/'),
      ' when it starts.'
    );
  const claudeRule = changed('claude');
  if (claudeRule)
    $('tool-claude-check').replaceChildren(
      'Run ',
      el('code', '', '/permissions'),
      ` in Claude Code. Your ${claudeRule.decision} rules there include `,
      el('code', '', claudeRule.key),
      '.'
    );
  else
    $('tool-claude-check').replaceChildren(
      'Run ',
      el('code', '', '/permissions'),
      ' in Claude Code. Your allow, ask, and deny rules are listed there.'
    );
  const cursorRule = changes.cursor ? changes.cursor.add.find(e => e.decision === 'allow') : null;
  $('tool-cursor-check').replaceChildren(
    'In Cursor Settings, choose Auto-review as the Run Mode. ',
    ...(cursorRule
      ? ['The terminal allowlist there shows ', el('code', '', cursorRule.key), '.']
      : ['The terminal allowlist there shows the file’s commands.'])
  );
  $('tool-compact').hidden = !tool || tool === 'none';
}
