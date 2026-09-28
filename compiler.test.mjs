import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {TRACKS, emptyPolicy, trackGroups, instructionText, CORE_RULES} from './questionnaire.mjs';
import {TOOL_RULES, TOOL_NO_ALLOW, TOOL_FILE_NAMES, TOOL_PATHS, LEAN_FILE_NAME, LEAN_CLOSING, compileToolSettings, leanPolicyText, estimateTokens, tokenLabel, toolCheckCommand, toolAction} from './compiler.mjs';
import {VERSION} from './version.mjs';

const EM_DASH = '\u2014';
const DATE = '2026-09-28';
const QUESTIONS = TRACKS.builder.questions;
const MAPPED = Object.keys(TOOL_RULES).map(Number);
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

function builder(answers = {}, extra = {}) {
  return {...emptyPolicy('builder'), answers, ...extra};
}
function every(choice) {
  return Object.fromEntries(QUESTIONS.map(q => [q.id, {choice, notes: ''}]));
}
function suggested() {
  return builder(Object.fromEntries(QUESTIONS.map(q => [q.id, {choice: q.recommendation, notes: '', suggested: true}])));
}

// A basic TOML or Starlark string: "..." with \\ \" \n \r \t escapes only.
const STRING = /^"((?:[^"\\]|\\["\\nrt])*)"$/;
function unquote(text) {
  const m = text.match(STRING);
  assert(m, `not a valid string: ${text}`);
  return m[1].replace(/\\(["\\nrt])/g, (_, c) => ({n: '\n', r: '\r', t: '\t'})[c] || c);
}

// Minimal line grammar for the Gemini CLI policy: comments, blank lines, [[rule]] tables, and key = string | integer.
function parseGemini(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('# ')) continue;
    if (line === '[[rule]]') { rules.push({}); continue; }
    const m = line.match(/^(toolName|commandPrefix|commandRegex|decision|priority|denyMessage) = (.+)$/);
    assert(m, `unexpected Gemini line: ${line}`);
    assert(rules.length, 'key before [[rule]]');
    assert(!(m[1] in rules.at(-1)), `duplicate key ${m[1]}`);
    rules.at(-1)[m[1]] = m[1] === 'priority' ? (assert.match(m[2], /^\d+$/), Number(m[2])) : unquote(m[2]);
  }
  for (const r of rules) {
    assert.equal(r.toolName, 'run_shell_command');
    assert.equal(Number('commandPrefix' in r) + Number('commandRegex' in r), 1);
    assert(['allow', 'ask_user', 'deny'].includes(r.decision));
    assert.equal(r.priority, {allow: 100, ask_user: 200, deny: 300}[r.decision]);
    assert.equal('denyMessage' in r, r.decision === 'deny');
    if (r.commandRegex) new RegExp(r.commandRegex);
  }
  return rules;
}

// Minimal line grammar for Codex .rules: comments, blank lines, and prefix_rule( pattern, decision, justification ) blocks.
function parseCodex(text) {
  const rules = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (!open && (line === '' || line.startsWith('# '))) continue;
    if (!open && line === 'prefix_rule(') { open = {}; continue; }
    if (open && line === ')') {
      assert.deepEqual(Object.keys(open), ['pattern', 'decision', 'justification']);
      rules.push(open); open = null; continue;
    }
    assert(open, `unexpected Codex line: ${line}`);
    let m = line.match(/^ {4}pattern = \[(.+)\],$/);
    if (m) { open.pattern = m[1].split(', ').map(unquote); assert(open.pattern.every(t => t && !/\s/.test(t))); continue; }
    m = line.match(/^ {4}(decision|justification) = (.+),$/);
    assert(m, `unexpected Codex line: ${line}`);
    open[m[1]] = unquote(m[2]);
  }
  assert.equal(open, null);
  for (const r of rules) assert(['allow', 'prompt', 'forbidden'].includes(r.decision));
  return rules;
}

function parseAll(files) {
  const claude = JSON.parse(files.claude);
  const cursor = JSON.parse(files.cursor);
  return {claude, codex: parseCodex(files.codexRules), gemini: parseGemini(files.gemini), cursor, config: files.codexConfig};
}
function claudeDecision(p, entry) {
  return ['allow', 'ask', 'deny'].filter(d => p.claude.permissions[d].includes(entry));
}
function codexDecision(p, text) {
  return p.codex.filter(r => r.pattern.join(' ') === text).map(r => ({allow: 'allow', prompt: 'ask', forbidden: 'deny'})[r.decision]);
}
function geminiDecision(p, text) {
  return p.gemini.filter(r => r.commandPrefix === text || r.commandRegex?.startsWith(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:'))
    .map(r => ({allow: 'allow', ask_user: 'ask', deny: 'deny'})[r.decision]);
}
function allowable(id, rule) {
  if (TOOL_NO_ALLOW.includes(id) || rule.noAllow) return false;
  return rule.text.split(' ').length >= 2 || rule.text === 'pytest';
}

test('every mapped question produces the expected entries in every tool for DENY, ASK, and ALLOW', () => {
  for (const id of MAPPED) {
    const q = QUESTIONS.find(q => q.id === id);
    for (const [choice, decision] of [['DENY', 'deny'], ['ASK', 'ask'], ['ALLOW', 'allow']]) {
      // Every other answer is ALLOW, so a shared pattern never turns this answer stricter.
      const out = compileToolSettings(builder({...every('ALLOW'), [id]: {choice, notes: ''}}), {date: DATE});
      const p = parseAll(out.files);
      const label = `#${id} ${choice}`;
      for (const rule of TOOL_RULES[id]) {
        const expectAllowOk = decision !== 'allow' || allowable(id, rule);
        if (rule.kind === 'cmd') {
          assert.deepEqual(claudeDecision(p, `Bash(${rule.text} *)`), expectAllowOk ? [decision] : [], label + ' claude ' + rule.text);
          assert.deepEqual(codexDecision(p, rule.text), expectAllowOk ? [decision] : [], label + ' codex ' + rule.text);
          assert.deepEqual(geminiDecision(p, rule.text), expectAllowOk ? [decision] : [], label + ' gemini ' + rule.text);
        } else if (rule.kind === 'exact') {
          assert.deepEqual(claudeDecision(p, `Bash(${rule.text})`), [decision], label);
          assert.deepEqual(codexDecision(p, rule.text), decision === 'allow' ? [] : [decision], label);
          assert.deepEqual(geminiDecision(p, rule.text), decision === 'allow' ? [] : [decision], label);
        } else if (rule.kind === 'claude' || rule.kind === 'claudeExact') {
          assert.deepEqual(claudeDecision(p, `Bash(${rule.text})`), decision === 'allow' ? [] : [decision], label);
        } else if (rule.kind === 'edit') {
          assert.deepEqual(claudeDecision(p, `Edit(${rule.text})`), decision === 'allow' && rule.noAllow ? [] : [decision], label);
        } else if (rule.kind === 'read') {
          assert.deepEqual(claudeDecision(p, `Read(${rule.text})`), decision === 'allow' ? [] : [decision], label);
        } else if (rule.kind === 'geminiRegex') {
          assert.deepEqual(p.gemini.filter(r => r.commandRegex === rule.text).map(r => r.decision), decision === 'allow' ? [] : [decision === 'ask' ? 'ask_user' : 'deny'], label);
        }
      }
      // Cursor: ASK and DENY become one plain sentence each.
      const sentence = (decision === 'deny' ? 'Never: ' : 'Ask me before: ') + toolAction(q) + '.';
      assert.equal(p.cursor.autoRun.block_instructions.includes(sentence), decision !== 'allow', label + ' cursor');
    }
  }
  // Examples, written out.
  const p = parseAll(compileToolSettings(builder({29: {choice: 'DENY', notes: ''}, 25: {choice: 'ASK', notes: ''}}), {date: DATE}).files);
  for (const entry of ['Bash(git push --force *)', 'Bash(git push * --force*)', 'Bash(git push -f *)', 'Bash(git filter-repo *)']) assert(p.claude.permissions.deny.includes(entry), entry);
  assert(p.claude.permissions.ask.includes('Bash(git push *)'));
  assert(p.codex.some(r => r.pattern.join(' ') === 'git push --force' && r.decision === 'forbidden' && r.justification === 'My policy does not allow this: force-push or rewrite shared git history (#29).'));
  assert(p.gemini.some(r => r.commandPrefix === 'git push --force' && r.decision === 'deny' && r.priority === 300 && r.denyMessage.includes('force-push')));
  assert(p.cursor.autoRun.block_instructions.includes('Never: force-push or rewrite shared git history.'));
  assert(p.cursor.autoRun.block_instructions.includes('Ask me before: push commits to GitHub.'));
});

test('the strictest decision wins when one pattern comes from several questions', () => {
  for (const [a, b] of [['ALLOW', 'DENY'], ['DENY', 'ALLOW'], ['ASK', 'ALLOW'], ['DENY', 'ASK']]) {
    const want = [a, b].includes('DENY') ? 'deny' : 'ask';
    const p = parseAll(compileToolSettings(builder({...every('ALLOW'), 46: {choice: a, notes: ''}, 47: {choice: b, notes: ''}}), {date: DATE}).files);
    assert.deepEqual(claudeDecision(p, 'Bash(vercel deploy *)'), [want]);
    assert.deepEqual(codexDecision(p, 'vercel deploy'), [want]);
    assert.deepEqual(geminiDecision(p, 'vercel deploy'), [want]);
    assert(!p.cursor.terminalAllowlist.includes('vercel deploy'));
  }
  const p = parseAll(compileToolSettings(builder({...every('ALLOW'), 14: {choice: 'ASK', notes: ''}}), {date: DATE}).files);
  assert.deepEqual(claudeDecision(p, 'Edit(./**)'), ['ask']);
  assert.match(p.config, /^sandbox_mode = "read-only"$/m);
  // Each pattern appears once per tool.
  const out = parseAll(compileToolSettings(suggested(), {date: DATE}).files);
  const all = [...out.claude.permissions.allow, ...out.claude.permissions.ask, ...out.claude.permissions.deny];
  assert.equal(new Set(all).size, all.length);
  assert.equal(new Set(out.codex.map(r => r.pattern.join(' '))).size, out.codex.length);
  assert.equal(new Set(out.gemini.map(r => r.commandPrefix || r.commandRegex.replace(/\(\?:\\s\|"\)$/, '').replace(/\\/g, ''))).size, out.gemini.length);
  for (const list of Object.values(out.claude.permissions)) assert.deepEqual(list, [...list].sort());
});

test('unanswered, Doesn\'t apply, and turned-off sections produce ask, never allow', () => {
  const groups = trackGroups('builder');
  const states = [builder(), builder(every('N/A')), builder(every('ALLOW'), {off: groups})];
  for (const state of states) {
    const p = parseAll(compileToolSettings(state, {date: DATE}).files);
    assert.deepEqual(p.claude.permissions.allow, []);
    assert.deepEqual(p.claude.permissions.deny, []);
    assert(p.claude.permissions.ask.includes('Bash(git push --force *)'));
    assert(p.claude.permissions.ask.includes('Edit(./**)'));
    assert(p.codex.every(r => r.decision === 'prompt'));
    assert(p.gemini.every(r => r.decision === 'ask_user'));
    assert.equal(p.cursor.terminalAllowlist, undefined);
    assert(p.cursor.autoRun.block_instructions.every(s => s.startsWith('Ask me before: ')));
    assert.equal(p.cursor.autoRun.block_instructions.length, MAPPED.length);
    assert.match(p.config, /^sandbox_mode = "read-only"$/m);
  }
  assert.match(compileToolSettings(builder(every('ALLOW'))).files.codexConfig, /^sandbox_mode = "workspace-write"$/m);
});

test('no broad allows in any tool, for every answer set', () => {
  const forbidden = ['Bash', 'Bash(*)', 'Edit', 'Read', 'WebFetch', 'mcp__*', 'Bash(gh *)', 'Bash(vercel *)', 'Bash(supabase *)', 'Bash(netlify *)', 'Bash(git *)', 'Bash(npm *)', 'Bash(npx *)', 'Bash(aws *)', 'Bash(rm *)', 'Bash(sudo *)'];
  for (const state of [builder(every('ALLOW')), suggested(), builder()]) {
    const p = parseAll(compileToolSettings(state, {date: DATE}).files);
    for (const entry of p.claude.permissions.allow) {
      assert(!forbidden.includes(entry), entry);
      assert(!/^(Read|WebFetch|mcp__)/.test(entry), entry);
      if (entry.startsWith('Edit(')) assert.equal(entry, 'Edit(./**)');
      else {
        const m = entry.match(/^Bash\((.+?)(?: \*)?\)$/);
        assert(m, entry);
        assert(!m[1].includes('*'), `wildcard allow ${entry}`);
        assert(m[1].split(' ').length >= 2 || m[1] === 'pytest', `whole program allow ${entry}`);
      }
    }
    for (const r of p.codex.filter(r => r.decision === 'allow')) assert(r.pattern.length >= 2 || r.pattern[0] === 'pytest', r.pattern.join(' '));
    for (const r of p.gemini.filter(r => r.decision === 'allow')) {
      assert(r.commandRegex && !r.commandPrefix);
      assert.match(r.commandRegex, /\(\?:\\s\|"\)$/);
      assert(r.commandRegex.includes(' ') || r.commandRegex.startsWith('pytest'), r.commandRegex);
    }
    for (const word of p.cursor.terminalAllowlist || []) assert(word.split(' ').length >= 2 || word === 'pytest', word);
    // An allowed Cursor prefix never also starts a stricter command.
    const strict = [...p.claude.permissions.ask, ...p.claude.permissions.deny].filter(e => e.startsWith('Bash(')).map(e => e.slice(5, -1).split('*')[0].trim());
    for (const word of p.cursor.terminalAllowlist || []) assert(!strict.some(s => s.startsWith(word)), word);
  }
});

test('ALLOW on 64, 74, 80, and 81 never produces an allow, and keeps the answer in the instructions', () => {
  for (const id of TOOL_NO_ALLOW) {
    const out = compileToolSettings(builder({[id]: {choice: 'ALLOW', notes: ''}}), {date: DATE});
    const p = parseAll(out.files);
    const claudeAll = Object.values(p.claude.permissions).flat();
    for (const rule of TOOL_RULES[id]) {
      for (const entry of [`Bash(${rule.text} *)`, `Bash(${rule.text})`, `Edit(${rule.text})`, `Read(${rule.text})`]) assert(!claudeAll.includes(entry), `#${id} ${entry}`);
      assert(!p.codex.some(r => r.pattern.join(' ') === rule.text), `#${id} ${rule.text}`);
      assert(!p.gemini.some(r => r.commandPrefix === rule.text || r.commandRegex === rule.text), `#${id} ${rule.text}`);
    }
    const q = QUESTIONS.find(q => q.id === id);
    assert(!p.cursor.autoRun.block_instructions.some(s => s.endsWith(toolAction(q) + '.')));
    assert(out.coverage.instructionsOnly.includes(id));
    assert(leanPolicyText(builder({[id]: {choice: 'ALLOW', notes: ''}})).includes(`(#${id})`));
  }
  const p = parseAll(compileToolSettings(builder(every('ALLOW')), {date: DATE}).files);
  for (const entry of ['Bash(bash)', 'Bash(sh)', 'Bash(zsh)', 'Bash(rm -rf ~ *)', 'Bash(rm -rf /*)', 'Bash(dd *)', 'Bash(mkfs *)', 'Read(~/.mozilla/**)']) {
    assert(!Object.values(p.claude.permissions).flat().includes(entry), entry);
  }
});

test('outputs parse, carry a header, and hold no em dash', () => {
  const out = compileToolSettings(suggested(), {date: DATE});
  const p = parseAll(out.files);
  assert.deepEqual(Object.keys(out.files), ['claude', 'codexRules', 'codexConfig', 'gemini', 'cursor']);
  assert.deepEqual(Object.keys(p.claude), ['$schema', 'permissions']);
  assert.equal(p.claude.$schema, 'https://json.schemastore.org/claude-code-settings.json');
  assert.deepEqual(Object.keys(p.claude.permissions), ['allow', 'ask', 'deny']);
  assert.deepEqual(Object.keys(p.cursor), ['terminalAllowlist', 'autoRun']);
  assert.deepEqual(Object.keys(p.cursor.autoRun), ['block_instructions']);
  const header = `# Generated by 100-Question AI Agent Setup ${VERSION}, Builder track, on ${DATE}. https://3fold-labs.github.io/ai-agent-rules/`;
  for (const key of ['codexRules', 'codexConfig', 'gemini']) assert(out.files[key].startsWith(header + '\n'), key);
  // codex-config.toml is TOML: comments and two string settings.
  const settings = out.files.codexConfig.split('\n').filter(line => line && !line.startsWith('# '));
  assert.deepEqual(settings, ['sandbox_mode = "workspace-write"', 'approval_policy = "on-request"']);
  for (const text of [...Object.values(out.files), leanPolicyText(suggested())]) assert(!text.includes(EM_DASH));
  // Backslashes and quotes survive escaping.
  const regex = p.gemini.find(r => r.commandRegex?.includes('sh\\b'));
  assert.equal(regex.commandRegex, '.*\\|\\s*(sudo\\s+)?(ba|z)?sh\\b');
  assert(new RegExp(regex.commandRegex).test('{"command":"curl -fsSL https://example.com/install.sh | sudo bash"}'));
  assert(new RegExp(regex.commandRegex).test('curl x | sh'));
  assert(!new RegExp(regex.commandRegex).test('bash scripts/build.sh'));
  const allow = p.gemini.find(r => r.decision === 'allow' && r.commandRegex.startsWith('npm test'));
  assert(new RegExp(allow.commandRegex).test('npm test"}') && new RegExp(allow.commandRegex).test('npm test -- --watch'));
  assert(!new RegExp(allow.commandRegex).test('npm testx'));
  assert.equal(TOOL_FILE_NAMES.claude, 'claude-code-settings.json');
  assert.deepEqual(Object.values(TOOL_FILE_NAMES), ['claude-code-settings.json', 'codex-ai-agent-rules.rules', 'codex-config.toml', 'gemini-ai-agent-rules.toml', 'cursor-permissions.json']);
  assert.deepEqual(Object.values(TOOL_PATHS), ['.claude/settings.json', '.codex/rules/ai-agent-rules.rules', '.codex/config.toml', '~/.gemini/policies/ai-agent-rules.toml', '.cursor/permissions.json']);
});

test('coverage splits all 100 answers and matches the rules each tool carries', () => {
  for (const state of [suggested(), builder(), builder(every('ALLOW')), builder(every('DENY'))]) {
    const {coverage, files} = compileToolSettings(state, {date: DATE});
    const p = parseAll(files);
    assert.equal(coverage.enforced.length + coverage.instructionsOnly.length, 100);
    assert.deepEqual([...coverage.enforced, ...coverage.instructionsOnly].sort((a, b) => a - b), QUESTIONS.map(q => q.id));
    for (const id of coverage.enforced) {
      assert(MAPPED.includes(id));
      assert.deepEqual(coverage.tools[id], ['claude', 'codex', 'gemini']);
      assert(p.codex.some(r => r.justification.endsWith(`(#${id}).`)) || [46, 47, 13, 14, 60, 61].includes(id), `codex #${id}`);
    }
    for (const id of QUESTIONS.map(q => q.id).filter(id => !MAPPED.includes(id))) assert(coverage.instructionsOnly.includes(id));
  }
  // Every mapped question is enforced by all three tools on DENY, except those a tool cannot express.
  const partial = [13, 14, 64, 74];
  assert.deepEqual(compileToolSettings(builder(every('DENY'))).coverage.enforced, MAPPED.filter(id => !partial.includes(id)));
  assert.equal(compileToolSettings(builder(every('DENY'))).coverage.enforced.length, 33);
  const s = compileToolSettings(suggested()).coverage;
  assert.equal(s.enforced.length, 32);
  assert.equal(s.instructionsOnly.length, 68);
  // With suggested answers, #21 is ALLOW on exact commands: only Claude Code can allow an exact command, so it stays in the instructions.
  assert(s.instructionsOnly.includes(21));
  assert.deepEqual(s.tools[21], ['claude']);
});

test('the lean policy holds only the instructions-only answers and ends with the tool line', () => {
  const state = {...suggested(), owner: 'Sam', exceptions: 'Weekdays only.'};
  state.answers[20] = {choice: 'DENY', notes: 'LEAN_NOTE'};
  const lean = leanPolicyText(state);
  const {coverage} = compileToolSettings(state);
  assert(lean.startsWith('# My AI agent rules: Builder track (lean)\n\nTrack: Builder\nOwner: Sam\n'));
  assert(lean.includes(CORE_RULES[0]) && lean.includes(CORE_RULES[1]));
  for (const id of coverage.enforced) assert(!lean.includes(`(#${id})`), `#${id}`);
  for (const id of coverage.instructionsOnly) assert(lean.includes(`(#${id})`), `#${id}`);
  assert(lean.includes('(#20) (LEAN_NOTE)'));
  assert(lean.trimEnd().endsWith('## Additional boundaries\nWeekdays only.\n\n' + LEAN_CLOSING));
  assert.equal(LEAN_CLOSING, 'My tool settings enforce the rest of my rules. If a tool blocks or asks, follow it.');
  assert.equal(LEAN_FILE_NAME, 'my-agent-policy-builder-lean.md');
  assert(lean.length < instructionText(state, 'builder', {compact: true}).length);
  const blank = leanPolicyText(builder());
  assert(blank.includes(`Unanswered here: ${compileToolSettings(builder()).coverage.instructionsOnly.length}.`));
  assert(!blank.includes(EM_DASH));
});

test('token estimates are ceil(characters / 4) rounded to the nearest 50', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('x'.repeat(4000)), 1000);
  assert.equal(estimateTokens('x'.repeat(4099)), 1050);
  assert.equal(estimateTokens('x'.repeat(4096)), 1000);
  assert.equal(estimateTokens('x'.repeat(9700)), 2450);
  assert.equal(tokenLabel('x'.repeat(9700)), 'About 2,450 tokens, sent with every message while it is in your agent\'s instructions.');
});

test('the generated check uses a harmless command the tool settings block', () => {
  assert.equal(toolCheckCommand(builder({29: {choice: 'DENY', notes: ''}})), 'git push --force --dry-run');
  assert.equal(toolCheckCommand(builder({30: {choice: 'DENY', notes: ''}})), 'gh repo delete --help');
  assert.equal(toolCheckCommand(builder({73: {choice: 'DENY', notes: ''}})), 'sudo -n true');
  assert.equal(toolCheckCommand(builder()), null);
  assert.equal(toolCheckCommand(suggested()), 'git push --force --dry-run');
  // Each check command falls under a deny rule for its question in every tool.
  for (const [id, command] of [[29, 'git push --force --dry-run'], [30, 'gh repo delete --help'], [73, 'sudo -n true'], [79, 'spctl --status']]) {
    const p = parseAll(compileToolSettings(builder({[id]: {choice: 'DENY', notes: ''}})).files);
    assert(p.claude.permissions.deny.some(e => e.endsWith(' *)') && command.startsWith(e.slice(5, -3))), command);
    assert(p.codex.some(r => r.decision === 'forbidden' && command.split(' ').slice(0, r.pattern.length).join(' ') === r.pattern.join(' ')), command);
    assert(p.gemini.some(r => r.decision === 'deny' && r.commandPrefix && command.startsWith(r.commandPrefix)), command);
  }
});

test('the standalone page compiles the same tool settings as the module', () => {
  const ctx = vm.createContext({});
  vm.runInContext(html.match(/\/\/ BEGIN SHARED POLICY[\s\S]*?\/\/ END SHARED POLICY/)[0], ctx);
  ctx.state = suggested();
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(compileToolSettings(state, {date: '2026-09-28'}))", ctx)), JSON.parse(JSON.stringify(compileToolSettings(ctx.state, {date: DATE}))));
  assert.equal(vm.runInContext('leanPolicyText(state)', ctx), leanPolicyText(ctx.state));
});
