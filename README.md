# 100-Question AI Agent Setup

Decide what your AI agents can do, what needs your approval, and what is off limits. Pick a track, answer **100 questions** with ALLOW, ASK, DENY, or Doesn't apply, then download a Markdown policy to give to the agents you use.

**[Open the worksheet](https://3fold-labs.github.io/ai-agent-rules/)** · [Download the blank HTML](./index.html) · [Repository](https://github.com/3Fold-Labs/ai-agent-rules)

## Two tracks, 100 questions each

| Track | Who it is for | What it covers |
| --- | --- | --- |
| **Builder**: I build with AI | Anyone who codes or builds with AI (apps, sites, scripts, automations, or tools) using Claude Code, Cursor, Codex, Lovable, Bolt, Replit, or similar agents | Money and paid services, your code and project files, Git and GitHub, your live data and users, deploying and going live, secrets and logins, your computer, messages and publishing, and how the agent works with you |
| **Personal**: I use AI in my everyday life | People who use Muse, ChatGPT, Claude, Gemini, Grok, or other assistants for email, calendar, shopping, messages, and selling | Money and shopping, selling and marketplaces, messages and calls, calendar and plans, your personal information, accounts and passwords, files and photos, home devices and apps, family, health and legal matters, social media, and how the agent works with you |

Each track keeps its own answers. Every question starts unanswered and shows a suggested answer. **Start from suggested answers** fills every unanswered question at once. Each filled answer shows **Suggested, not reviewed** until you choose an option or edit its notes, and the bar shows how many answers you have reviewed.

## Use it with your agents

Attach your policy file and send your agent this quick start:

```text
Follow the attached policy file before taking any action.
DENY means never, ASK means get my explicit yes for that exact action first, and anything unanswered or unclear means ask me.
Confirm you read it by listing three things you will never do.
```

1. Open the worksheet in a browser. It also works as a downloaded HTML file with no internet connection. On a phone, open the link in Safari or Chrome. A file preview (the Files app, a message attachment, or AirDrop) shows the page but cannot run it.
2. Choose the Builder or Personal track. **Switch to Personal** or **Switch to Builder** moves between tracks, and the logo returns to the start page.
3. Choose which sections apply to you, or press **Start from suggested answers**.
4. Answer the questions and add any limits, recipients, folders, or other scope in the notes. Each notes field shows an example scope for its section. **Next unanswered** in the sticky bar takes you to the first question without an answer, then to the first suggested answer you have not reviewed. **Go to downloads** takes you to your files.
5. If a whole section does not fit your life or work, turn it off. It collapses to its heading, every question in it reads as Doesn't apply, and the answers underneath stay saved. **Turn back on** restores it and tells you how many suggested answers in it are waiting for review.
6. Download your policy, attach it or paste it into each agent's instructions, and send the quick start. **Copy quick start** copies it for you.
7. Check your agent with **Test your agent**. It builds three questions from your own answers (one DENY, one ASK, one ALLOW) and shows the behavior your policy expects for each.

The policy works with any assistant or agent that accepts instructions, such as Muse, ChatGPT, Claude, Gemini, Grok, or Perplexity. Use the instruction or file features of the product you use. No MCP connection, server, account, or API key is required. Every policy includes the rule that a rule covers the action however it is done: command line, app, API, MCP tool, or browser.

### Using both tracks

When both tracks have answers, **Finished both tracks?** appears in the download area. Give each agent the policy for the work it does. An agent that does both gets both files. When two answers differ, the stricter one applies. The panel lists every question that appears in both tracks with different answers and links to it.

## Tool settings for coding agents

On the Builder track, the download area also builds settings files that coding tools apply themselves. Rules in a tool's settings cost no tokens, because they are not part of your agent's instructions. Each file comes from your answers: ALLOW becomes allow, ASK becomes ask, DENY becomes deny, and anything unanswered or Doesn't apply becomes ask. When two answers cover the same command, the stricter one wins. Only well-known commands and paths get a rule, and no rule allows a whole program such as `gh`, `vercel`, or `sudo`. If a settings file with that name already exists, copy the rules into it instead of replacing it, so your other settings stay.

| Tool | Download | Save it as | Check it loaded |
| --- | --- | --- | --- |
| Claude Code | `claude-code-settings.json` | `.claude/settings.json` in your project folder | Run `/permissions` in Claude Code. Your allow, ask, and deny rules are listed there. |
| Codex CLI | `codex-ai-agent-rules.rules` | `.codex/rules/ai-agent-rules.rules` in your project folder, or in `~/.codex/rules/` | Run `codex execpolicy check --pretty --rules .codex/rules/ai-agent-rules.rules -- git push --force` and read the decision it prints. |
| Codex CLI | `codex-config.toml` | `.codex/config.toml` in your project folder | Codex reads project files in `.codex/` when you trust the project. |
| Gemini CLI | `gemini-ai-agent-rules.toml` | `~/.gemini/policies/ai-agent-rules.toml` in your home folder | Ask Gemini CLI to run a command your file denies, such as `git push --force --dry-run`. It refuses with your policy's reason. |
| Cursor | `cursor-permissions.json` | `.cursor/permissions.json` in your project folder | Turn on a Run Mode (Auto-review, Allowlist, or Run Everything) in Cursor Settings. The terminal allowlist there shows the file's commands and cannot be edited. Cursor treats these settings as best effort, not a security guarantee. |

Your browser saves each download under the name in the Download column. Rename it and move it to the path in the Save it as column.

The page shows how many of your 100 answers the tool settings enforce. An answer counts when Claude Code, Codex, and Gemini CLI all carry a rule for it. The rest stay as instructions in your policy, and the page lists both groups. When your answers include a DENY for force-pushing, the page also gives a harmless command to try, `git push --force --dry-run`, that the tool should block.

The lean policy (`my-agent-policy-builder-lean.md`) holds only the answers that stay as instructions, so it is shorter to send. Use it only together with your tool settings. Put the lean or compact policy in your agent's instructions and keep the full policy as your reference.

Tool settings are a strong guardrail, not a lock. A tool can miss a command written another way, for example wrapped in `sh -c`, so your policy still applies.

Beside each policy download, the page shows about how many tokens it costs: "About N tokens, sent with every message while it is in your agent's instructions." N is an estimate, the number of characters divided by four and rounded to the nearest 50.

On the Personal track, rules stay as instructions, because everyday assistants do not accept permission files.

## What each download is

| File | What it is |
| --- | --- |
| `my-agent-policy-builder.md` or `my-agent-policy-personal.md` | The full policy for that track: who it belongs to, the core rules, then every question with its decision and your notes, then your additional boundaries. Give this to your agents. |
| `my-agent-policy-builder-compact.md` or `my-agent-policy-personal-compact.md` | The compact policy: the track and owner details, the same operating rules in fewer words, then three lists (Never, Ask me first, OK without asking) and your additional boundaries. Use it where an agent accepts only brief instructions. |
| `my-agent-policy-builder-lean.md` | The lean Builder policy: the same identity block and core rules, then only the answers your tool settings do not enforce. Use it only together with your tool settings. |
| `claude-code-settings.json`, `codex-ai-agent-rules.rules`, `codex-config.toml`, `gemini-ai-agent-rules.toml`, `cursor-permissions.json` | Builder tool settings for Claude Code, Codex CLI, Gemini CLI, and Cursor. See [Tool settings for coding agents](#tool-settings-for-coding-agents) for where each one goes. |
| `my-agent-answers-builder.json` or `my-agent-answers-personal.json` | Your answer backup for that track, including which answers are still suggested. Load it into the worksheet to restore your answers or move them to another browser, device, or copy of the worksheet. |
| `ai-agent-rules.html` | The blank worksheet with both tracks. It holds no answers, so it is safe to share. |

Unanswered questions and Doesn't apply grant no permission. The policies tell agents to ask before acting on anything unanswered.

## Where your files and answers live

- **Downloads** go to your browser's downloads folder, usually **Downloads**. On iPhone, find them in the **Files** app.
- **Answers save automatically in this browser only.** They are not uploaded anywhere. The sticky bar shows **Saved in this browser**. When a browser blocks storage, it shows **Not saved: this browser is blocking storage** with a link to download an answer backup. Clearing your browser data removes your answers, so keep an answer backup.
- **Two open tabs stay in step.** Each change saves only the answer, note, or field you changed, and other open tabs of the same worksheet show it right away.
- **Saved answers that cannot be read are kept aside, never overwritten.** The track starts empty, and a notice lets you download the unreadable data as a text file.
- **The website and a downloaded copy keep separate answers.** Each copy saves on its own. To move answers between them, or to another device, download the answer backup from one and load it into the other. Answer backups up to 16 MB load.
- Keep completed policies and answer backups private. Share the blank worksheet or the link instead. **Copy link** in the share area copies `https://3fold-labs.github.io/ai-agent-rules/`.

## For contributors

Run `npm test`. It needs no installed packages. The questions for both tracks live in `questionnaire.mjs`, and the release version lives in `version.mjs`. After changing either file, run `npm run sync` to update the standalone HTML. CI checks that each track has exactly 100 questions.

Browser tests live in `e2e/` and run with Playwright in headless Chromium:

```bash
npm install
npx playwright install chromium
npm run e2e
```

To use a Chromium build you already have, set `PW_CHROMIUM_PATH` to its executable. CI runs both `npm test` and `npm run e2e`. The Pages site publishes only the worksheet.

## Disclaimer

This worksheet and the policies and tool settings it produces record preferences. They do not control, supervise, or restrain any assistant, model, or third-party product, including Muse, Grok, ChatGPT, Claude, or any other agent. Nothing here guarantees that a bot will follow an ALLOW, ASK, or DENY choice, ask before acting, or refuse an action.

THE SOFTWARE AND THESE INSTRUCTIONS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, 3FOLD LABS, LLC AND ITS MEMBERS, EMPLOYEES, AND CONTRIBUTORS DISCLAIM ALL LIABILITY FOR ANY CLAIM, DAMAGE, OR LOSS ARISING OUT OF OR RELATED TO THE USE OF, OR INABILITY TO USE, THIS RELEASE, INCLUDING ANY ACT, OMISSION, OR STATEMENT BY ANY ASSISTANT OR AGENT. USE OF THIS RELEASE IS AT YOUR OWN RISK AND IS ACCEPTANCE OF THESE TERMS.

## License

MIT. See [LICENSE](./LICENSE). Published by 3Fold Labs, LLC. The MIT warranty disclaimer also applies.
