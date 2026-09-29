import {VERSION} from './version.mjs';
import {TRACKS, WORKSHEET_URL, effectiveAnswer, shortQuestion, oneLine, ownerVoice} from './questionnaire.mjs';

// Tool settings for coding agents. Builder answers become permission files that Claude Code, Codex, Gemini CLI,
// and Cursor apply themselves. Only well-known, documented command and path patterns get a rule. Every answer
// also stays in the Markdown policy: tool settings add rules, they never replace instructions.
//
// Rules are keyed by a stable action id. TOOL_ACTION_QUESTIONS maps each action to the question that decides it,
// with that question's exact text, so a changed question never silently inherits a rule meant for another.
//
// Pattern kinds:
//   cmd: command prefix (space-separated tokens), for every tool
//   exact: one exact command; Claude Code matches it exactly, prefix-only tools get it for ask and deny only
//   claude: Claude Code pattern with * wildcards, ask and deny only
//   claudeExact: exact Claude Code command, ask and deny only
//   geminiRegex: Gemini CLI commandRegex, ask and deny only
//   edit / read: Claude Code path globs (read and noAllow edits are ask and deny only)
// Action flags:
//   partial: the rules match only some ways of doing this action, or more than the question covers. The rules are
//     still written for ask and deny, but the answer never counts as backed by tool rules.
//   noAllow: an ALLOW never becomes an allow rule, because the rule would cover more than the answer allows.
const cmds = list => list.map(text => ({kind: 'cmd', text}));
export const TOOL_ACTIONS = {
  'files.edit': {rules: [{kind: 'edit', text: './**'}]},
  'files.create': {rules: [{kind: 'edit', text: './**'}]},
  'code.checks': {
    rules: cmds([
      'npm test',
      'npm run test',
      'npm run lint',
      'npx prettier',
      'npx eslint',
      'pnpm test',
      'yarn test',
      'pytest',
      'ruff check',
      'ruff format'
    ])
  },
  'deps.install_listed': {
    rules: cmds([
      'npm ci',
      'pnpm install --frozen-lockfile',
      'yarn install --immutable',
      'pip install -r requirements.txt'
    ])
  },
  'deps.add': {rules: cmds(['npm install', 'npm i', 'npm add', 'pnpm add', 'yarn add', 'pip install'])},
  'files.delete_build_output': {
    rules: ['rm -rf node_modules', 'rm -rf dist', 'rm -rf build', 'rm -rf .next', 'rm -rf .turbo'].map(text => ({
      kind: 'exact',
      text
    }))
  },
  'git.commit': {rules: cmds(['git add', 'git commit'])},
  'git.push': {rules: cmds(['git push'])},
  'git.merge_main': {partial: true, rules: cmds(['git merge', 'gh pr merge'])},
  'git.force_push': {
    partial: true,
    rules: [
      ...cmds([
        'git push --force',
        'git push -f',
        'git push --force-with-lease',
        'git filter-branch',
        'git filter-repo'
      ]),
      {kind: 'claude', text: 'git push * --force*'},
      {kind: 'claude', text: 'git push * -f*'},
      {kind: 'geminiRegex', text: 'git\\s+push(?:\\s[^"]*)?\\s(?:--force(?:-with-lease)?|-f)(?:[\\s="]|$)'}
    ]
  },
  'repo.delete': {rules: cmds(['gh repo delete'])},
  'repo.make_public': {
    partial: true,
    rules: [
      {kind: 'claude', text: 'gh repo edit * --visibility public*'},
      {kind: 'cmd', text: 'gh repo edit --visibility public'}
    ]
  },
  'git.tag': {rules: cmds(['git tag'])},
  'db.migrate_live': {
    rules: cmds(['supabase db push', 'npx prisma migrate deploy', 'npx prisma db push', 'npx drizzle-kit push'])
  },
  'db.write_sql': {partial: true, rules: cmds(['psql'])},
  'db.reset': {partial: true, rules: cmds(['supabase db reset', 'npx prisma migrate reset', 'dropdb'])},
  'stripe.refund': {rules: cmds(['stripe refunds create'])},
  'stripe.live_mode': {
    partial: true,
    noAllow: true,
    rules: [
      {kind: 'cmd', text: 'stripe --live'},
      {kind: 'claude', text: 'stripe * --live*'},
      {kind: 'geminiRegex', text: 'stripe\\s[^"]*--live(?:[\\s="]|$)'}
    ]
  },
  'stripe.catalog': {
    rules: cmds(['stripe prices create', 'stripe prices update', 'stripe products create', 'stripe products update'])
  },
  'deploy.preview': {partial: true, noAllow: true, rules: cmds(['vercel deploy', 'netlify deploy'])},
  'deploy.preview_redeploy': {partial: true, noAllow: true, rules: cmds(['vercel deploy', 'netlify deploy'])},
  'deploy.production': {
    partial: true,
    rules: [
      ...cmds(['vercel --prod', 'vercel deploy --prod', 'netlify deploy --prod']),
      {kind: 'claude', text: 'vercel deploy * --prod*'},
      {kind: 'claude', text: 'netlify deploy * --prod*'}
    ]
  },
  'deploy.rollback': {rules: cmds(['vercel rollback'])},
  'hosting.env_change': {
    rules: cmds([
      'vercel env add',
      'vercel env rm',
      'vercel env update',
      'netlify env:set',
      'netlify env:unset',
      'netlify env:import',
      'supabase secrets set',
      'supabase secrets unset'
    ])
  },
  'dns.change': {
    rules: cmds([
      'vercel dns add',
      'vercel dns rm',
      'vercel dns import',
      'vercel domains add',
      'vercel domains rm',
      'vercel domains move',
      'vercel domains buy',
      'vercel domains transfer-in'
    ])
  },
  'cloud.delete': {
    rules: cmds(['aws s3 rb', 'aws ec2 terminate-instances', 'vercel remove', 'vercel rm', 'supabase projects delete'])
  },
  'secrets.commit': {
    partial: true,
    rules: [
      ...cmds(['git add .env', 'git add -f .env']),
      {kind: 'claude', text: 'git add .env*'},
      {kind: 'claude', text: 'git add -f .env*'}
    ]
  },
  'secrets.commit_env_file': {
    partial: true,
    rules: [
      ...cmds(['git add .env', 'git add -f .env']),
      {kind: 'claude', text: 'git add .env*'},
      {kind: 'claude', text: 'git add -f .env*'}
    ]
  },
  'secrets.browser_cookies': {
    noAllow: true,
    rules: [
      '~/Library/Application Support/Google/Chrome/**',
      '~/Library/Application Support/Firefox/**',
      '~/Library/Cookies/**',
      '~/.config/google-chrome/**',
      '~/.mozilla/**'
    ].map(text => ({kind: 'read', text}))
  },
  'secrets.keychain': {
    rules: cmds(['security find-generic-password', 'security find-internet-password', 'security dump-keychain'])
  },
  'system.install': {partial: true, rules: cmds(['brew install', 'npm install -g', 'npm i -g', 'pipx install'])},
  'system.sudo': {rules: cmds(['sudo'])},
  'system.pipe_to_shell': {
    noAllow: true,
    rules: [
      ...['bash', 'sh', 'zsh'].map(text => ({kind: 'claudeExact', text})),
      {kind: 'geminiRegex', text: '.*\\|\\s*(sudo\\s+)?(ba|z)?sh\\b'}
    ]
  },
  'tools.mcp_add': {
    rules: [
      ...cmds(['claude mcp add', 'codex mcp add', 'gemini mcp add']),
      {kind: 'edit', text: './.mcp.json', noAllow: true}
    ]
  },
  'system.settings': {rules: cmds(['defaults write', 'networksetup', 'pmset', 'scutil'])},
  'system.services': {rules: cmds(['launchctl', 'crontab', 'systemctl'])},
  'system.permissions': {rules: cmds(['tccutil'])},
  'system.security_off': {rules: cmds(['spctl', 'csrutil', 'ufw disable'])},
  'files.bulk_delete_home': {
    partial: true,
    noAllow: true,
    rules: [
      ...['rm -rf ~*', 'rm -rf $HOME*', 'rm -rf /*'].map(text => ({kind: 'claude', text})),
      ...cmds(['rm -rf ~', 'rm -rf /'])
    ]
  },
  'disk.wipe': {noAllow: true, rules: cmds(['diskutil eraseDisk', 'diskutil eraseVolume', 'mkfs', 'dd'])}
};

// The question that decides each action, per track, with its exact text. Personal answers stay as instructions.
export const TOOL_ACTION_QUESTIONS = {
  builder: {
    'files.edit': {id: 13, question: 'Can it edit files inside an approved project folder?'},
    'files.create': {id: 14, question: 'Can it create files inside an approved project folder?'},
    'code.checks': {id: 15, question: 'Can it run formatters / linters / tests locally?'},
    'deps.install_listed': {
      id: 16,
      question: 'Can it install the packages your project already lists (npm install, pip install -r)?'
    },
    'deps.add': {id: 17, question: 'Can it add a new package or library your project did not use before?'},
    'files.delete_build_output': {id: 21, question: 'Can it delete build artifacts / cache folders that regenerate?'},
    'git.commit': {id: 24, question: 'Can it make local git commits (save points) as it works?'},
    'git.push': {id: 25, question: 'Can it push commits to GitHub?'},
    'git.merge_main': {id: 28, question: 'Can it merge changes into your main branch?'},
    'git.force_push': {id: 29, question: 'Can it force-push or rewrite shared git history?'},
    'repo.delete': {id: 30, question: 'Can it delete a GitHub / GitLab repo?'},
    'repo.make_public': {id: 31, question: 'Can it change a repository from private to public?'},
    'git.tag': {id: 32, question: 'Can it tag a release?'},
    'db.migrate_live': {id: 35, question: 'Can it change your live database structure (tables, columns, migrations)?'},
    'db.write_sql': {id: 36, question: 'Can it run SQL or scripts that change data directly in your live database?'},
    'db.reset': {id: 37, question: 'Can it drop tables, or wipe or bulk-delete data, in your live database?'},
    'stripe.refund': {id: 43, question: 'Can it issue customer refunds?'},
    'stripe.live_mode': {
      id: 44,
      question: 'Can it switch payments from test mode to live mode (for example, in Stripe)?'
    },
    'stripe.catalog': {id: 45, question: 'Can it change prices, plans, or products in your payment provider?'},
    'deploy.preview': {id: 46, question: 'Can it deploy to a preview or staging site (not your live one)?'},
    'deploy.preview_redeploy': {id: 47, question: 'Can it redeploy a preview or staging site you already approved?'},
    'deploy.production': {id: 48, question: 'Can it deploy updates to your live site or app?'},
    'deploy.rollback': {
      id: 50,
      question: 'Can it roll your live site back to an earlier version when something breaks?'
    },
    'hosting.env_change': {
      id: 51,
      question: 'Can it change environment variables or secrets in your hosting dashboard (Vercel, Netlify, Supabase)?'
    },
    'dns.change': {id: 52, question: 'Can it change DNS or domain registration settings?'},
    'cloud.delete': {id: 56, question: 'Can it delete cloud VMs, buckets, or DNS records?'},
    'secrets.commit': {id: 60, question: 'Can it write secrets into the git repo?'},
    'secrets.commit_env_file': {id: 61, question: 'Can it create committed .env files with real values?'},
    'secrets.browser_cookies': {id: 64, question: 'Can it export browser cookies or session files?'},
    'secrets.keychain': {
      id: 65,
      question: "Can it pull passwords out of your computer's password store (Keychain, Credential Manager)?"
    },
    'system.install': {id: 72, question: 'Can it install apps or packages system-wide?'},
    'system.sudo': {id: 73, question: 'Can it run commands as administrator (sudo)?'},
    'system.pipe_to_shell': {
      id: 74,
      question: 'Can it run install scripts copied from a website (like curl ... | bash) before you have read them?'
    },
    'tools.mcp_add': {id: 75, question: 'Can it add MCP servers, plugins, or extensions to your AI coding tool?'},
    'system.settings': {
      id: 76,
      question: 'Can it change device settings such as power, appearance, or network settings?'
    },
    'system.services': {id: 77, question: 'Can it create or edit background services or scheduled jobs?'},
    'system.permissions': {
      id: 78,
      question: 'Can it approve new device permissions such as screen recording or access to files?'
    },
    'system.security_off': {
      id: 79,
      question: 'Can it disable security protections such as malware checks or firewall rules?'
    },
    'files.bulk_delete_home': {id: 80, question: 'Can it run bulk deletion commands in personal folders?'},
    'disk.wipe': {id: 81, question: 'Can it wipe a device or volume?'}
  },
  personal: {}
};

// Actions for one question, in table order.
export function actionsFor(track, id) {
  return Object.entries(TOOL_ACTION_QUESTIONS[track] || {})
    .filter(([, q]) => q.id === id)
    .map(([action]) => action);
}
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
// Updating a settings file. Codex and Gemini CLI files hold only these rules, so an update replaces the whole file.
// Claude Code and Cursor files also hold other settings, so an update removes the rules copied or downloaded last
// time that changed and adds the new ones. Appending would keep both: the stricter rule would still apply.
export const TOOL_REPLACE_NOTE =
  'To update, replace this whole file with a new download. Never append new rules to it.';
export const TOOL_SHARED_FILES = ['claude', 'cursor'];

// The tools that apply a rule themselves. An answer counts as backed by tool rules only when every one of them
// carries a rule for it, it has no notes, and none of its actions is partial. Cursor reads its file as guidance.
export const BACKING_TOOLS = ['claude', 'codex', 'gemini'];

const TOOL_RANK = {allow: 0, ask: 1, deny: 2};
const TOOL_CODEX_DECISION = {allow: 'allow', ask: 'prompt', deny: 'forbidden'};
const TOOL_GEMINI_DECISION = {allow: 'allow', ask: 'ask_user', deny: 'deny'};
const TOOL_GEMINI_PRIORITY = {allow: 100, ask: 200, deny: 300};

// ALLOW -> allow and DENY -> deny. ASK, unanswered, Doesn't apply, and turned-off sections -> ask.
// An ALLOW still suggested or needing review is ASK in every export (effectiveAnswer's decision). A reviewed ALLOW
// becomes ask when it has notes or when additional boundaries are written: a settings file cannot hold a limit,
// so it never grants more than the answer.
export function toolDecision(state, q) {
  const a = effectiveAnswer(state, 'builder', q);
  if (a.decision === 'DENY') return 'deny';
  if (a.decision !== 'ALLOW') return 'ask';
  const boundaries = typeof state?.exceptions === 'string' && state.exceptions.trim();
  return a.notes.trim() || boundaries ? 'ask' : 'allow';
}

function toolWords(text) {
  return text.split(' ').filter(Boolean);
}
// Whether this pattern may carry an allow in a tool that matches by prefix (Codex, Gemini CLI, Cursor).
function toolPrefixAllowOk(action, rule) {
  if (action.noAllow || rule.noAllow || rule.kind !== 'cmd') return false;
  return toolWords(rule.text).length >= 2 || TOOL_WHOLE_PROGRAM_ALLOW.includes(rule.text);
}
function toolClaudeAllowOk(action, rule) {
  if (action.noAllow || rule.noAllow) return false;
  if (rule.kind === 'cmd' || rule.kind === 'exact')
    return toolWords(rule.text).length >= 2 || TOOL_WHOLE_PROGRAM_ALLOW.includes(rule.text);
  return rule.kind === 'edit' && rule.text === './**';
}
function toolEscape(text) {
  return (
    '"' +
    String(text)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
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
// Cursor guidance for one ASK or DENY answer, with the owner's notes when there are any.
export function cursorSentence(decision, q, notes = '') {
  const text = oneLine(notes);
  return (
    (decision === 'deny' ? 'Never: ' : 'Ask me before: ') + toolAction(q) + '.' + (text ? ` My notes: ${text}` : '')
  );
}

// Merges patterns so the strictest decision wins. Keeps the question that set the winning decision.
function toolCollect(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const current = merged.get(entry.key);
    if (!current || TOOL_RANK[entry.decision] > TOOL_RANK[current.decision])
      merged.set(entry.key, {...entry, ids: new Set([...(current?.ids || []), entry.q.id])});
    else current.ids.add(entry.q.id);
  }
  return [...merged.values()];
}

export function compileToolSettings(state, {date = toolLocalDate()} = {}) {
  const questions = TRACKS.builder.questions;
  const header = `Generated by 100-Question AI Agent Setup ${VERSION}, Builder track, on ${date}. ${WORKSHEET_URL}`;
  const covered = {claude: new Set(), codex: new Set(), gemini: new Set()};
  const partialIds = new Set();
  const claude = [],
    codex = [],
    gemini = [],
    cursorPrefixes = [],
    cursorSentences = [],
    cursorSentenceIds = [];

  for (const q of questions) {
    const actions = actionsFor('builder', q.id);
    if (!actions.length) continue;
    const decision = toolDecision(state, q);
    for (const actionId of actions) {
      const action = TOOL_ACTIONS[actionId];
      if (action.partial) partialIds.add(q.id);
      if (decision === 'allow' && action.noAllow) continue;
      for (const rule of action.rules) {
        const word = rule.text;
        // Claude Code
        if (decision !== 'allow' || toolClaudeAllowOk(action, rule)) {
          const key =
            rule.kind === 'cmd'
              ? `Bash(${word} *)`
              : rule.kind === 'exact' || rule.kind === 'claude' || rule.kind === 'claudeExact'
                ? `Bash(${word})`
                : rule.kind === 'edit'
                  ? `Edit(${word})`
                  : rule.kind === 'read'
                    ? `Read(${word})`
                    : null;
          if (key) {
            claude.push({key, decision, q});
            covered.claude.add(q.id);
          }
        }
        // Codex: exact argv-token prefixes only
        if (
          (rule.kind === 'cmd' || rule.kind === 'exact') &&
          (decision !== 'allow' || toolPrefixAllowOk(action, rule))
        ) {
          codex.push({key: word, decision, q});
          covered.codex.add(q.id);
        }
        // Gemini CLI: prefixes, plus a regex where a prefix cannot express the rule
        if (
          (rule.kind === 'cmd' || rule.kind === 'exact') &&
          (decision !== 'allow' || toolPrefixAllowOk(action, rule))
        ) {
          gemini.push({key: 'cmd:' + word, word, decision, q});
          covered.gemini.add(q.id);
        } else if (rule.kind === 'geminiRegex' && decision !== 'allow') {
          gemini.push({key: 'regex:' + rule.text, field: 'commandRegex', value: rule.text, decision, q});
          covered.gemini.add(q.id);
        }
        // Cursor: allowlist prefixes for ALLOW
        if (rule.kind === 'cmd' && decision === 'allow' && toolPrefixAllowOk(action, rule))
          cursorPrefixes.push({key: word, decision, q});
      }
    }
    if (decision !== 'allow') {
      cursorSentences.push(cursorSentence(decision, q, effectiveAnswer(state, 'builder', q).notes));
      cursorSentenceIds.push(q.id);
    }
  }

  // Claude Code settings
  const lists = {allow: [], ask: [], deny: []};
  const claudeRules = toolCollect(claude);
  for (const e of claudeRules) lists[e.decision].push(e.key);
  for (const list of Object.values(lists)) list.sort();
  const claudeText =
    JSON.stringify({$schema: 'https://json.schemastore.org/claude-code-settings.json', permissions: lists}, null, 2) +
    '\n';

  // Codex rules and config
  const codexRules = toolCollect(codex).sort((a, b) => a.key.localeCompare(b.key));
  const codexRuleBlocks = codexRules.flatMap(e => [
    'prefix_rule(',
    `    pattern = [${toolWords(e.key).map(toolEscape).join(', ')}],`,
    `    decision = ${toolEscape(TOOL_CODEX_DECISION[e.decision])},`,
    `    justification = ${toolEscape(toolReason(e.decision, e.q))},`,
    ')',
    ''
  ]);
  const codexRulesText = [
    `# ${header}`,
    `# Save as ${TOOL_PATHS.codexRules} in your project (Codex loads it when the project is trusted), or in ~/.codex/rules/.`,
    `# ${TOOL_REPLACE_NOTE}`,
    `# Check: codex execpolicy check --pretty --rules ${TOOL_PATHS.codexRules} -- git push --force`,
    '',
    ...codexRuleBlocks
  ].join('\n');
  const writes = [13, 14].every(
    id =>
      toolDecision(
        state,
        questions.find(q => q.id === id)
      ) === 'allow'
  );
  const codexSettings = [
    writes
      ? '# workspace-write keeps file changes inside the project, with outbound network off.'
      : '# read-only asks before any file change, because editing or creating project files needs my approval.',
    `sandbox_mode = "${writes ? 'workspace-write' : 'read-only'}"`,
    '# on-request lets Codex ask me before it steps outside the sandbox.',
    'approval_policy = "on-request"'
  ];
  const codexConfigText = [
    `# ${header}`,
    `# Save as ${TOOL_PATHS.codexConfig} in your project. Codex reads it when the project is trusted.`,
    ...codexSettings,
    ''
  ].join('\n');

  // Gemini CLI policy
  // Ask and deny use commandPrefix. commandRegex is tested from the start of the command in the call's JSON,
  // so an allow ends at a space or the closing quote and never covers a longer command name.
  const geminiRules = toolCollect(gemini)
    .map(e =>
      e.word == null
        ? e
        : e.decision === 'allow'
          ? {...e, field: 'commandRegex', value: toolRegexEscape(e.word) + '(?:\\s|")'}
          : {...e, field: 'commandPrefix', value: e.word}
    )
    .sort((a, b) => TOOL_RANK[b.decision] - TOOL_RANK[a.decision] || a.value.localeCompare(b.value));
  const geminiBlocks = geminiRules.flatMap(e => [
    '[[rule]]',
    'toolName = "run_shell_command"',
    `${e.field} = ${toolEscape(e.value)}`,
    `decision = ${toolEscape(TOOL_GEMINI_DECISION[e.decision])}`,
    `priority = ${TOOL_GEMINI_PRIORITY[e.decision]}`,
    ...(e.decision === 'deny' ? [`denyMessage = ${toolEscape(toolReason('deny', e.q))}`] : []),
    ''
  ]);
  const geminiText = [
    `# ${header}`,
    `# Save as ${TOOL_PATHS.gemini}`,
    `# ${TOOL_REPLACE_NOTE}`,
    '',
    ...geminiBlocks
  ].join('\n');

  // Cursor: an allowed prefix that also starts a stricter pattern would run that stricter command too, so it stays off the list.
  const stricter = [...claude.filter(e => e.key.startsWith('Bash(')), ...codex]
    .filter(e => e.decision !== 'allow')
    .map(e =>
      e.key
        .replace(/^Bash\(|\)$/g, '')
        .split('*')[0]
        .trim()
    );
  const allowlist = [...new Set(cursorPrefixes.map(e => e.key))]
    .filter(word => !stricter.some(s => s === word || s.startsWith(word)))
    .sort();
  const cursorAllowIds = word => [...new Set(cursorPrefixes.filter(e => e.key === word).map(e => e.q.id))];
  const cursor = {};
  if (allowlist.length) cursor.terminalAllowlist = allowlist;
  cursor.autoRun = {block_instructions: cursorSentences};
  const cursorText = JSON.stringify(cursor, null, 2) + '\n';

  // Coverage: backed answers have a rule in every backing tool, no notes, and no partial action.
  const withNotes = new Set(questions.filter(q => effectiveAnswer(state, 'builder', q).notes.trim()).map(q => q.id));
  const counts = (tool, id) => covered[tool].has(id) && !withNotes.has(id) && !partialIds.has(id);
  const backed = questions.filter(q => BACKING_TOOLS.every(t => counts(t, q.id))).map(q => q.id);
  const instructionsOnly = questions.map(q => q.id).filter(id => !backed.includes(id));
  const tools = Object.fromEntries(questions.map(q => [q.id, BACKING_TOOLS.filter(t => covered[t].has(q.id))]));
  const byTool = Object.fromEntries(BACKING_TOOLS.map(t => [t, questions.filter(q => counts(t, q.id)).map(q => q.id)]));
  const partial = questions.map(q => q.id).filter(id => partialIds.has(id) && tools[id].length);
  const notes = questions.map(q => q.id).filter(id => withNotes.has(id) && tools[id].length && !partialIds.has(id));
  // Each tool's rules as {key, decision, ids}, for comparing with the rules copied or downloaded last time.
  const entry = (key, decision, ids) => ({key, decision, ids: [...ids].sort((a, b) => a - b)});
  const rules = {
    claude: claudeRules
      .map(e => entry(e.key, e.decision, e.ids))
      .sort((a, b) => TOOL_RANK[a.decision] - TOOL_RANK[b.decision] || a.key.localeCompare(b.key)),
    codex: codexRules.map(e => entry(e.key, e.decision, e.ids)),
    gemini: geminiRules.map(e => entry(`${e.field} ${e.value}`, e.decision, e.ids)),
    cursor: [
      ...allowlist.map(word => entry(word, 'allow', cursorAllowIds(word))),
      ...cursorSentences.map((text, i) => entry(text, 'instruction', [cursorSentenceIds[i]]))
    ]
  };
  return {
    rules,
    coverage: {backed, instructionsOnly, partial, notes, tools, byTool},
    files: {
      claude: claudeText,
      codexRules: codexRulesText,
      codexConfig: codexConfigText,
      gemini: geminiText,
      cursor: cursorText
    },
    // The rules alone, to add into a settings file that already exists.
    snippets: {
      claude: JSON.stringify({permissions: lists}, null, 2) + '\n',
      codexRules: codexRuleBlocks.join('\n'),
      codexConfig: codexSettings.filter(line => !line.startsWith('#')).join('\n') + '\n',
      gemini: geminiBlocks.join('\n'),
      cursor: cursorText
    }
  };
}

// What coding tools can do for each Builder question, from the rule mapping alone, never from the answer:
//   enforce: Claude Code, Codex, and Gemini CLI all carry a rule for it, and none of its rules is partial
//   partial: some tool carries a rule, but it is partial or not every one of those tools has one
//   own: no tool rule, so the agent follows the policy on its own
// Personal questions have no tag.
export const TOOL_TAG_TEXT = {
  enforce: 'Your coding tool has a setting for this',
  partial: 'Your coding tool has a setting for some forms of this',
  own: 'Your agent has to follow this on its own'
};
let toolTagCache = null;
export function toolTag(track, id) {
  if (track !== 'builder') return null;
  if (!toolTagCache) {
    // Every answer DENY with no notes, so each mapped question writes every rule it can.
    const state = {answers: Object.fromEntries(TRACKS.builder.questions.map(q => [q.id, {choice: 'DENY', notes: ''}]))};
    const {coverage} = compileToolSettings(state, {date: ''});
    toolTagCache = new Map(
      TRACKS.builder.questions.map(q => [
        q.id,
        coverage.backed.includes(q.id) ? 'enforce' : coverage.tools[q.id].length ? 'partial' : 'own'
      ])
    );
  }
  return toolTagCache.get(id) || null;
}

// Plain words for the share of answers backed by tool rules.
export function coverageShare(n, total = 100) {
  if (!n) return 'none';
  const shares = [
    [1 / 10, 'about one in ten'],
    [1 / 5, 'about one in five'],
    [1 / 4, 'about a quarter'],
    [1 / 3, 'about a third'],
    [1 / 2, 'about half'],
    [2 / 3, 'about two thirds'],
    [3 / 4, 'about three quarters'],
    [1, 'all']
  ];
  const r = n / total;
  if (r < 0.07) return 'a few';
  return shares.reduce((best, s) => (Math.abs(s[0] - r) < Math.abs(best[0] - r) ? s : best))[1];
}
export function coverageText(coverage, total = 100) {
  const n = coverage.backed.length;
  return `Tool settings back up ${coverageShare(n, total)} of your Builder answers (${n} of ${total}). The rest stay as instructions in your policy.`;
}

// About ceil(characters / 4) tokens, rounded to the nearest 50. A rough estimate, not a count from any model.
export function estimateTokens(text) {
  return Math.round(Math.ceil(String(text).length / 4) / 50) * 50;
}
export function tokenLabel(text) {
  return `Rough estimate: about ${estimateTokens(text).toLocaleString('en-US')} tokens.`;
}

// A harmless command the tool settings block, taken from the first matching DENY answer. A DENY whose question is in
// prefer (answers whose rules changed since the rules were last copied or downloaded) comes first.
const TOOL_CHECKS = [
  {id: 29, command: 'git push --force --dry-run'},
  {id: 30, command: 'gh repo delete --help'},
  {id: 73, command: 'sudo -n true'},
  {id: 79, command: 'spctl --status'}
];
export function toolCheckCommand(state, prefer = []) {
  const denied = TOOL_CHECKS.filter(
    c =>
      toolDecision(
        state,
        TRACKS.builder.questions.find(q => q.id === c.id)
      ) === 'deny'
  );
  const check = denied.find(c => prefer.includes(c.id)) || denied[0];
  return check ? check.command : null;
}

// The rules to remove from a file and the rules to add, comparing the rules copied or downloaded last time with
// the current ones. A rule whose decision changed is in both lists. Entries are {key, decision}.
export function ruleChanges(previous, current) {
  const id = e => e.decision + '\n' + e.key;
  const before = new Set(previous.map(id)),
    now = new Set(current.map(id));
  return {remove: previous.filter(e => !now.has(id(e))), add: current.filter(e => !before.has(id(e)))};
}
export function sameRules(a, b) {
  const {remove, add} = ruleChanges(a, b);
  return !remove.length && !add.length && a.length === b.length;
}
// Rules in the form a shared settings file uses, to copy into it or to find and delete from it.
export function toolRulesText(tool, entries) {
  if (tool === 'claude') {
    const permissions = {};
    for (const decision of ['allow', 'ask', 'deny']) {
      const keys = entries.filter(e => e.decision === decision).map(e => e.key);
      if (keys.length) permissions[decision] = keys;
    }
    return JSON.stringify({permissions}, null, 2) + '\n';
  }
  if (tool === 'cursor') {
    const out = {};
    const allow = entries.filter(e => e.decision === 'allow').map(e => e.key);
    const block = entries.filter(e => e.decision === 'instruction').map(e => e.key);
    if (allow.length) out.terminalAllowlist = allow;
    if (block.length) out.autoRun = {block_instructions: block};
    return JSON.stringify(out, null, 2) + '\n';
  }
  throw Error('Only Claude Code and Cursor settings are updated rule by rule.');
}
// What Codex decides for a command under these Codex rules: every rule whose tokens start the command matches, and
// the strictest decision wins. Returns allow, prompt, or forbidden, or null when no rule matches.
export function codexCheckDecision(codexRules, command) {
  const argv = toolWords(command);
  const hits = codexRules.filter(e => toolWords(e.key).every((t, i) => argv[i] === t)).map(e => e.decision);
  const strictest = ['deny', 'ask', 'allow'].find(d => hits.includes(d));
  return strictest ? TOOL_CODEX_DECISION[strictest] : null;
}
// The first rule that is new or has a different decision since last time, or null.
export function changedRule(previous, current) {
  return ruleChanges(previous, current).add[0] || null;
}
