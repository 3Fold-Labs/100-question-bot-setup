import {VERSION} from './version.mjs';
import {TRACKS, CORE_RULES, WORKSHEET_URL, effectiveAnswer, answeredCount, shortQuestion, oneLine, ownerVoice} from './questionnaire.mjs';

// Tool settings for coding agents. Builder answers become permission files that Claude Code, Codex, Gemini CLI,
// and Cursor apply themselves. Only well-known, documented command and path patterns get a rule; every other
// question stays as instructions in the Markdown policy.
//
// Pattern kinds:
//   cmd: command prefix (space-separated tokens), for every tool
//   exact: one exact command; Claude Code matches it exactly, prefix-only tools get it for ask and deny only
//   claude: Claude Code pattern with * wildcards, ask and deny only
//   claudeExact: exact Claude Code command, ask and deny only
//   geminiRegex: Gemini CLI commandRegex, ask and deny only
//   edit / read: Claude Code path globs (read and noAllow edits are ask and deny only)
export const TOOL_RULES = {
  13: [{kind: 'edit', text: './**'}],
  14: [{kind: 'edit', text: './**'}],
  15: ['npm test', 'npm run test', 'npm run lint', 'npx prettier', 'npx eslint', 'pnpm test', 'yarn test', 'pytest', 'ruff check', 'ruff format'].map(text => ({kind: 'cmd', text})),
  16: ['npm ci', 'pnpm install --frozen-lockfile', 'yarn install --immutable', 'pip install -r requirements.txt'].map(text => ({kind: 'cmd', text})),
  17: ['npm install', 'npm i', 'npm add', 'pnpm add', 'yarn add', 'pip install'].map(text => ({kind: 'cmd', text})),
  21: ['rm -rf node_modules', 'rm -rf dist', 'rm -rf build', 'rm -rf .next', 'rm -rf .turbo'].map(text => ({kind: 'exact', text})),
  24: ['git add', 'git commit'].map(text => ({kind: 'cmd', text})),
  25: [{kind: 'cmd', text: 'git push'}],
  28: ['git merge', 'gh pr merge'].map(text => ({kind: 'cmd', text})),
  29: [...['git push --force', 'git push -f', 'git push --force-with-lease', 'git filter-branch', 'git filter-repo'].map(text => ({kind: 'cmd', text})),
    {kind: 'claude', text: 'git push * --force*'}, {kind: 'claude', text: 'git push * -f*'}],
  30: [{kind: 'cmd', text: 'gh repo delete'}],
  31: [{kind: 'claude', text: 'gh repo edit * --visibility public*'}, {kind: 'cmd', text: 'gh repo edit --visibility public'}],
  32: ['git tag', 'gh release create'].map(text => ({kind: 'cmd', text})),
  35: ['supabase db push', 'npx prisma migrate deploy', 'npx prisma db push', 'npx drizzle-kit push'].map(text => ({kind: 'cmd', text})),
  36: [{kind: 'cmd', text: 'psql'}],
  37: ['supabase db reset', 'npx prisma migrate reset', 'dropdb'].map(text => ({kind: 'cmd', text})),
  46: ['vercel deploy', 'netlify deploy'].map(text => ({kind: 'cmd', text})),
  47: ['vercel deploy', 'netlify deploy'].map(text => ({kind: 'cmd', text})),
  48: [...['vercel --prod', 'vercel deploy --prod', 'netlify deploy --prod'].map(text => ({kind: 'cmd', text})),
    {kind: 'claude', text: 'vercel deploy * --prod*'}, {kind: 'claude', text: 'netlify deploy * --prod*'}],
  50: [{kind: 'cmd', text: 'vercel rollback'}],
  51: ['vercel env', 'netlify env:set', 'netlify env:unset', 'supabase secrets set', 'supabase secrets unset'].map(text => ({kind: 'cmd', text})),
  52: ['vercel dns', 'vercel domains'].map(text => ({kind: 'cmd', text})),
  56: ['aws s3 rb', 'aws ec2 terminate-instances', 'vercel remove', 'vercel rm', 'supabase projects delete'].map(text => ({kind: 'cmd', text})),
  60: [...['git add .env', 'git add -f .env'].map(text => ({kind: 'cmd', text})), {kind: 'claude', text: 'git add .env*'}, {kind: 'claude', text: 'git add -f .env*'}],
  61: [...['git add .env', 'git add -f .env'].map(text => ({kind: 'cmd', text})), {kind: 'claude', text: 'git add .env*'}, {kind: 'claude', text: 'git add -f .env*'}],
  64: ['~/Library/Application Support/Google/Chrome/**', '~/Library/Application Support/Firefox/**', '~/Library/Cookies/**', '~/.config/google-chrome/**', '~/.mozilla/**'].map(text => ({kind: 'read', text})),
  65: ['security find-generic-password', 'security find-internet-password', 'security dump-keychain'].map(text => ({kind: 'cmd', text})),
  72: ['brew install', 'npm install -g', 'npm i -g', 'pipx install'].map(text => ({kind: 'cmd', text})),
  73: [{kind: 'cmd', text: 'sudo'}],
  74: [...['bash', 'sh', 'zsh'].map(text => ({kind: 'claudeExact', text})), {kind: 'geminiRegex', text: '.*\\|\\s*(sudo\\s+)?(ba|z)?sh\\b'}],
  75: [...['claude mcp add', 'codex mcp add', 'gemini mcp add'].map(text => ({kind: 'cmd', text})), {kind: 'edit', text: './.mcp.json', noAllow: true}],
  76: ['defaults write', 'networksetup', 'pmset', 'scutil'].map(text => ({kind: 'cmd', text})),
  77: ['launchctl', 'crontab', 'systemctl'].map(text => ({kind: 'cmd', text})),
  78: [{kind: 'cmd', text: 'tccutil'}],
  79: ['spctl', 'csrutil', 'ufw disable'].map(text => ({kind: 'cmd', text})),
  80: [...['rm -rf ~*', 'rm -rf $HOME*', 'rm -rf /*'].map(text => ({kind: 'claude', text})), ...['rm -rf ~', 'rm -rf /'].map(text => ({kind: 'cmd', text}))],
  81: ['diskutil eraseDisk', 'diskutil eraseVolume', 'mkfs', 'dd'].map(text => ({kind: 'cmd', text}))
};
// An ALLOW on these questions never becomes an allow rule. The answer stays in the instructions instead.
export const TOOL_NO_ALLOW = [64, 74, 80, 81];
// A single-word command is a whole program. Only these whole programs can be allowed.
const TOOL_WHOLE_PROGRAM_ALLOW = ['pytest'];

export const TOOL_FILE_NAMES = {
  claude: 'claude-code-settings.json',
  codexRules: 'codex-ai-agent-rules.rules',
  codexConfig: 'codex-config.toml',
  gemini: 'gemini-ai-agent-rules.toml',
  cursor: 'cursor-permissions.json'
};
export const TOOL_PATHS = {
  claude: '.claude/settings.json',
  codexRules: '.codex/rules/ai-agent-rules.rules',
  codexConfig: '.codex/config.toml',
  gemini: '~/.gemini/policies/ai-agent-rules.toml',
  cursor: '.cursor/permissions.json'
};
export const LEAN_FILE_NAME = 'my-agent-policy-builder-lean.md';
export const LEAN_CLOSING = 'My tool settings enforce the rest of my rules. If a tool blocks or asks, follow it.';
// The tools that apply a rule themselves. A question counts as enforced only when every one of them carries a rule for it.
export const ENFORCING_TOOLS = ['claude', 'codex', 'gemini'];

const TOOL_RANK = {allow: 0, ask: 1, deny: 2};
const TOOL_CODEX_DECISION = {allow: 'allow', ask: 'prompt', deny: 'forbidden'};
const TOOL_GEMINI_DECISION = {allow: 'allow', ask: 'ask_user', deny: 'deny'};
const TOOL_GEMINI_PRIORITY = {allow: 100, ask: 200, deny: 300};

// ALLOW -> allow, DENY -> deny. ASK, unanswered, Doesn't apply, and turned-off sections -> ask.
export function toolDecision(state, q) {
  const choice = effectiveAnswer(state, 'builder', q).choice;
  return choice === 'ALLOW' ? 'allow' : choice === 'DENY' ? 'deny' : 'ask';
}

function toolWords(text) {
  return text.split(' ').filter(Boolean);
}
// Whether this pattern may carry an allow in a tool that matches by prefix (Codex, Gemini CLI, Cursor).
function toolPrefixAllowOk(id, rule) {
  if (TOOL_NO_ALLOW.includes(Number(id)) || rule.noAllow || rule.kind !== 'cmd') return false;
  return toolWords(rule.text).length >= 2 || TOOL_WHOLE_PROGRAM_ALLOW.includes(rule.text);
}
function toolClaudeAllowOk(id, rule) {
  if (TOOL_NO_ALLOW.includes(Number(id)) || rule.noAllow) return false;
  if (rule.kind === 'cmd' || rule.kind === 'exact') return toolWords(rule.text).length >= 2 || TOOL_WHOLE_PROGRAM_ALLOW.includes(rule.text);
  return rule.kind === 'edit' && rule.text === './**';
}
function toolEscape(text) {
  return '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
}
function toolRegexEscape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function toolLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Plain-language action for a question, in the owner's voice: "push commits to GitHub".
export function toolAction(q) {
  return ownerVoice(shortQuestion(q.question));
}
function toolReason(decision, q) {
  const action = toolAction(q);
  if (decision === 'deny') return `My policy does not allow this: ${action} (#${q.id}).`;
  if (decision === 'ask') return `My policy asks me first: ${action} (#${q.id}).`;
  return `My policy allows this: ${action} (#${q.id}).`;
}

// Merges patterns so the strictest decision wins. Keeps the question that set the winning decision.
function toolCollect(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const current = merged.get(entry.key);
    if (!current || TOOL_RANK[entry.decision] > TOOL_RANK[current.decision]) merged.set(entry.key, {...entry, ids: new Set([...(current?.ids || []), entry.q.id])});
    else current.ids.add(entry.q.id);
  }
  return [...merged.values()];
}

export function compileToolSettings(state, {date = toolLocalDate()} = {}) {
  const questions = TRACKS.builder.questions;
  const header = `Generated by 100-Question AI Agent Setup ${VERSION}, Builder track, on ${date}. ${WORKSHEET_URL}`;
  const covered = {claude: new Set(), codex: new Set(), gemini: new Set()};
  const claude = [], codex = [], gemini = [], cursorPrefixes = [], cursorSentences = [];

  for (const q of questions) {
    const rules = TOOL_RULES[q.id];
    if (!rules) continue;
    const decision = toolDecision(state, q);
    if (decision === 'allow' && TOOL_NO_ALLOW.includes(q.id)) continue;
    for (const rule of rules) {
      const word = rule.text;
      // Claude Code
      if (decision !== 'allow' || toolClaudeAllowOk(q.id, rule)) {
        const key = rule.kind === 'cmd' ? `Bash(${word} *)`
          : rule.kind === 'exact' || rule.kind === 'claude' || rule.kind === 'claudeExact' ? `Bash(${word})`
          : rule.kind === 'edit' ? `Edit(${word})`
          : rule.kind === 'read' ? `Read(${word})` : null;
        if (key) { claude.push({key, decision, q}); covered.claude.add(q.id); }
      }
      // Codex: exact argv-token prefixes only
      if ((rule.kind === 'cmd' || rule.kind === 'exact') && (decision !== 'allow' || toolPrefixAllowOk(q.id, rule))) {
        codex.push({key: word, decision, q});
        covered.codex.add(q.id);
      }
      // Gemini CLI: prefixes, plus a regex where a prefix cannot express the rule
      if ((rule.kind === 'cmd' || rule.kind === 'exact') && (decision !== 'allow' || toolPrefixAllowOk(q.id, rule))) {
        gemini.push({key: 'cmd:' + word, word, decision, q});
        covered.gemini.add(q.id);
      } else if (rule.kind === 'geminiRegex' && decision !== 'allow') {
        gemini.push({key: 'regex:' + rule.text, field: 'commandRegex', value: rule.text, decision, q});
        covered.gemini.add(q.id);
      }
      // Cursor: allowlist prefixes for ALLOW
      if (rule.kind === 'cmd' && decision === 'allow' && toolPrefixAllowOk(q.id, rule)) cursorPrefixes.push({key: word, decision, q});
    }
    if (decision !== 'allow') cursorSentences.push((decision === 'deny' ? 'Never: ' : 'Ask me before: ') + toolAction(q) + '.');
  }

  // Claude Code settings
  const lists = {allow: [], ask: [], deny: []};
  for (const e of toolCollect(claude)) lists[e.decision].push(e.key);
  for (const list of Object.values(lists)) list.sort();
  const claudeText = JSON.stringify({$schema: 'https://json.schemastore.org/claude-code-settings.json', permissions: lists}, null, 2) + '\n';

  // Codex rules and config
  const codexRules = toolCollect(codex).sort((a, b) => a.key.localeCompare(b.key));
  const codexRulesText = [`# ${header}`,
    `# Save as ${TOOL_PATHS.codexRules} in your project (Codex loads it when the project is trusted), or in ~/.codex/rules/.`,
    `# Check: codex execpolicy check --pretty --rules ${TOOL_PATHS.codexRules} -- git push --force`, '',
    ...codexRules.flatMap(e => ['prefix_rule(',
      `    pattern = [${toolWords(e.key).map(toolEscape).join(', ')}],`,
      `    decision = ${toolEscape(TOOL_CODEX_DECISION[e.decision])},`,
      `    justification = ${toolEscape(toolReason(e.decision, e.q))},`,
      ')', ''])].join('\n');
  const writes = [13, 14].every(id => toolDecision(state, questions.find(q => q.id === id)) === 'allow');
  const codexConfigText = [`# ${header}`,
    `# Save as ${TOOL_PATHS.codexConfig} in your project. Codex reads it when the project is trusted.`,
    writes ? '# workspace-write keeps file changes inside the project, with outbound network off.' : '# read-only asks before any file change, because editing or creating project files needs my approval.',
    `sandbox_mode = "${writes ? 'workspace-write' : 'read-only'}"`,
    '# on-request lets Codex ask me before it steps outside the sandbox.',
    'approval_policy = "on-request"', ''].join('\n');

  // Gemini CLI policy
  // Ask and deny use commandPrefix. commandRegex is tested from the start of the command in the call's JSON,
  // so an allow ends at a space or the closing quote and never covers a longer command name.
  const geminiRules = toolCollect(gemini).map(e => e.word == null ? e : e.decision === 'allow'
    ? {...e, field: 'commandRegex', value: toolRegexEscape(e.word) + '(?:\\s|")'}
    : {...e, field: 'commandPrefix', value: e.word}).sort((a, b) => TOOL_RANK[b.decision] - TOOL_RANK[a.decision] || a.value.localeCompare(b.value));
  const geminiText = [`# ${header}`, `# Save as ${TOOL_PATHS.gemini}`, '',
    ...geminiRules.flatMap(e => ['[[rule]]', 'toolName = "run_shell_command"', `${e.field} = ${toolEscape(e.value)}`,
      `decision = ${toolEscape(TOOL_GEMINI_DECISION[e.decision])}`, `priority = ${TOOL_GEMINI_PRIORITY[e.decision]}`,
      ...(e.decision === 'deny' ? [`denyMessage = ${toolEscape(toolReason('deny', e.q))}`] : []), ''])].join('\n');

  // Cursor: an allowed prefix that also starts a stricter pattern would run that stricter command too, so it stays off the list.
  const stricter = [...claude.filter(e => e.key.startsWith('Bash(')), ...codex].filter(e => e.decision !== 'allow').map(e => e.key.replace(/^Bash\(|\)$/g, '').split('*')[0].trim());
  const allowlist = [...new Set(cursorPrefixes.map(e => e.key))]
    .filter(word => !stricter.some(s => s === word || s.startsWith(word)))
    .sort();
  const cursor = {};
  if (allowlist.length) cursor.terminalAllowlist = allowlist;
  cursor.autoRun = {block_instructions: cursorSentences};
  const cursorText = JSON.stringify(cursor, null, 2) + '\n';

  const enforced = questions.filter(q => ENFORCING_TOOLS.every(t => covered[t].has(q.id))).map(q => q.id);
  const instructionsOnly = questions.map(q => q.id).filter(id => !enforced.includes(id));
  const tools = Object.fromEntries(questions.map(q => [q.id, ['claude', 'codex', 'gemini'].filter(t => covered[t].has(q.id))]));
  return {
    coverage: {enforced, instructionsOnly, tools},
    files: {claude: claudeText, codexRules: codexRulesText, codexConfig: codexConfigText, gemini: geminiText, cursor: cursorText}
  };
}

// The Builder policy without the questions the tool settings enforce.
export function leanPolicyText(state) {
  const spec = TRACKS.builder;
  const keep = new Set(compileToolSettings(state, {date: ''}).coverage.instructionsOnly);
  const field = key => oneLine(state?.[key] || '') || '(not specified)';
  const exceptions = typeof state?.exceptions === 'string' ? state.exceptions.trim() : '';
  const lists = {DENY: [], ASK: [], ALLOW: []};
  let unanswered = 0;
  for (const q of spec.questions.filter(q => keep.has(q.id))) {
    const a = effectiveAnswer(state, 'builder', q);
    if (!a.choice) { unanswered++; continue; }
    if (!lists[a.choice]) continue;
    const notes = oneLine(a.notes);
    lists[a.choice].push(`- ${shortQuestion(q.question)} (#${q.id})${notes ? ` (${notes})` : ''}`);
  }
  const section = (title, items) => [`## ${title}`, ...(items.length ? items : ['- (none)']), ''];
  return [`# My AI agent rules: Builder track (lean)`, '',
    'Track: Builder', `Owner: ${field('owner')}`, `Project or team: ${field('company')}`, `Where to ask me: ${field('channel')}`,
    `Policy version or date: ${field('version')}`, `Answered: ${answeredCount(state, 'builder')}/${spec.questions.length}`, '',
    '## Core rules', CORE_RULES[0], '', CORE_RULES[1], '',
    ...section('Never', lists.DENY),
    ...section('Ask me first', lists.ASK),
    ...section('OK without asking (stay in the scope I gave you)', lists.ALLOW),
    `Unanswered here: ${unanswered}. Treat every unanswered question as ask me first.`, '',
    '## Additional boundaries', exceptions || '(none specified)', '',
    LEAN_CLOSING].join('\n') + '\n';
}

// About ceil(characters / 4) tokens, rounded to the nearest 50. An estimate, not a count from any model.
export function estimateTokens(text) {
  return Math.round(Math.ceil(String(text).length / 4) / 50) * 50;
}
export function tokenLabel(text) {
  return `About ${estimateTokens(text).toLocaleString('en-US')} tokens, sent with every message while it is in your agent's instructions.`;
}

// A harmless command the tool settings block, taken from the first matching DENY answer.
const TOOL_CHECKS = [
  {id: 29, command: 'git push --force --dry-run'},
  {id: 30, command: 'gh repo delete --help'},
  {id: 73, command: 'sudo -n true'},
  {id: 79, command: 'spctl --status'}
];
export function toolCheckCommand(state) {
  const check = TOOL_CHECKS.find(c => toolDecision(state, TRACKS.builder.questions.find(q => q.id === c.id)) === 'deny');
  return check ? check.command : null;
}
