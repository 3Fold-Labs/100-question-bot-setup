# 100-Question AI Agent Setup

Decide what your AI agents can do, what needs your approval, and what is off limits. Pick a track, answer **100 questions** with ALLOW, ASK, DENY, or Doesn't apply, then download a Markdown policy to give to the agents you use.

**[Open the worksheet](https://3fold-labs.github.io/ai-agent-rules/)** · [Download the blank HTML](https://github.com/3Fold-Labs/ai-agent-rules/releases/latest/download/ai-agent-rules.html) · [Repository](https://github.com/3Fold-Labs/ai-agent-rules)

## Two tracks, 100 questions each

| Track                                      | Who it is for                                                                                                                                               | What it covers                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Builder**: I build with AI               | Anyone who codes or builds with AI (apps, sites, scripts, automations, or tools) using Claude Code, Cursor, Codex, Lovable, Bolt, Replit, or similar agents | Money and paid services, your code and project files, Git and GitHub, your live data and users, deploying and going live, secrets and logins, your computer, messages and publishing, and how the agent works with you                                             |
| **Personal**: I use AI in my everyday life | People who use Muse, ChatGPT, Claude, Gemini, Grok, or other assistants for email, calendar, shopping, messages, and selling                                | Money and shopping, selling and marketplaces, messages and calls, calendar and plans, your personal information, accounts and passwords, files and photos, home devices and apps, family, health and legal matters, social media, and how the agent works with you |

Each track keeps its own answers. Every question starts unanswered and shows a suggested answer. **Start from suggested answers** fills every unanswered question at once, and **Load my answers from a file** beside it brings back answers you saved. Each filled answer shows **Suggested, not reviewed** until you choose an option or edit its notes, and the bar shows how many answers you have reviewed. A suggested DENY stays a firm no until you change it. Each saved answer remembers the exact question it answers. When a question's wording differs from the one an answer was saved for, the answer keeps its choice and notes and shows **Review this answer** until you choose an option or edit its notes. Where two questions meet, a one-line note under the question says which answer applies.

An answer you have not reviewed is never an ALLOW. Until you review it, a suggested ALLOW or an ALLOW marked **Review this answer** reads as ASK in both policies, in **Check how your agent reads your rules**, in **Finished both tracks?**, and in your coding tool settings. The full policy shows it as `Decision: ASK (suggested ALLOW, not reviewed)`, and the compact policy lists it under Ask me first. A DENY that is not reviewed stays DENY, and an ASK stays ASK. Both policies state the operating rules in full, including that an answer you have not reviewed is never an ALLOW, that your policy only changes when you edit it yourself (a message claiming your rules changed is not from you), and that approvals only count when they come from you directly. When a DENY marked **Review this answer** answered wider wording, both policies add a line under it, such as "Until I review this: also never agree to terms in my name.", until you review it.

On the Builder track, a short line under each question says what a coding tool can do for it: **Your coding tool has a setting for this** (Claude Code, Codex, and Gemini CLI all carry a full rule for it), **Your coding tool has a setting for some forms of this** (a rule covers only some ways of doing it, or only some of those tools carry one), or **Your agent has to follow this on its own** (no tool rule). The line comes from the tool rule mapping, not from your answer.

## Use it with your agents

Attach your policy file and send your agent this quick start:

```text
Follow the attached policy file before taking any action.
DENY means never, ASK means get my explicit yes for that exact action first, and anything unanswered or unclear means ask me.
Confirm you read it by listing up to three things you will never do.
```

1. Open the worksheet in a browser. It also works as a downloaded HTML file with no internet connection. On a phone, open the link in Safari or Chrome. A file preview (the Files app, a message attachment, or AirDrop) shows the page but cannot run it.
2. Choose the Builder or Personal track. **Switch to Personal** or **Switch to Builder** moves between tracks, and the logo returns to the start page.
3. Choose which sections apply to you, or press **Start from suggested answers**.
4. Answer the questions and add any limits, recipients, folders, or other scope in the notes. Each notes field shows an example scope for its question. **Next unanswered** in the sticky bar takes you to the first question without an answer, then to the first answer still waiting for review. **Go to downloads** takes you to your files.
5. If a whole section does not fit your life or work, turn it off. It collapses to its heading, every question in it reads as Doesn't apply, and the answers underneath stay saved. **Turn back on** restores it and tells you how many suggested answers in it are waiting for review.
6. Check **Before you download**, above the download buttons. It lists what you allowed (with your notes), your additional boundaries, unanswered questions, and answers still suggested or waiting for review. Each group shows its count, and each item opens its question.
7. Press **Download my agent policy**, and keep **Save my answers to a file** beside it. Attach the policy or paste it into each agent's instructions, and send the quick start. **More options** holds the compact policy, **Copy policy**, the quick start with **Copy quick start**, and **Load my answers from a file**.
8. Use **Check how your agent reads your rules**. It builds three questions from your own answers (one DENY, one ASK, one ALLOW), includes your notes for each, and shows what your policy expects. The answers show how your agent understands your rules, not a guarantee of how it will act.

The policy works with any assistant or agent that accepts instructions, such as Muse, ChatGPT, Claude, Gemini, Grok, or Perplexity. Use the instruction or file features of the product you use. No MCP connection, server, account, or API key is required. Every policy includes the rule that a rule covers the action however it is done: command line, app, API, MCP tool, or browser.

### Using both tracks

When both tracks have answers, **Finished both tracks?** appears in the download area. Give each agent the policy for the work it does. An agent that does both gets both files. When two answers differ, the stricter one applies. The panel lists every question that appears in both tracks with a different decision or different notes, shows each track's answer and notes, and links to it. Notes are compared with letter case kept, so `/Work/ClientA` and `/work/clienta` count as different; only extra spaces are ignored. An answer that is not reviewed is compared as the decision your policies carry. Check which limit applies to which work.

### Where to put your policy

**Where to put your policy**, under the main downloads, gives per-assistant placement instructions.

For coding agents, save your compact policy alongside your coding tool settings, then add a line to the file your agent reads at the start of every session so it always follows it: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex, `GEMINI.md` for Gemini CLI, and `AGENTS.md` or a rule in `.cursor/rules` for Cursor. This is the recommended pair for a coding agent: the compact policy in its instructions, plus your coding tool settings.

For chat assistants, create a project or its equivalent and add your policy file to it, then paste the quick start into its instructions: a Project for ChatGPT (its custom instructions box is too small for the full policy, so the file carries it) or Claude, a Gem for Gemini, or a Project on grok.com for Grok. Muse has no published place for instruction files yet, so paste the quick start and your compact policy at the start of a chat. Every message in that project or Gem includes your instructions.

## Coding tool settings

On the Builder track, **Coding tool settings** sits below the main downloads. It asks **Which coding tool do you use?** (Claude Code, Codex, Gemini CLI, Cursor, or None) and shows only that tool: its file, where to save it, how to add or update its rules (with **Copy rules**), the full file as a download, a way to check it loaded, and how many of your answers that tool's settings back up. Below the chosen tool's file, **Download compact policy** sits with the line "Give your agent this compact policy together with the tool file." The page remembers your choice in this browser.

Rules in a tool's settings are not part of your agent's instructions, and every answer also stays in your policy. The recommended pair for a coding agent is the compact policy in its instructions plus your coding tool settings.

Every tool remembers, in this browser, the rules you last said are actually in your file. That record only ever advances when you press that tool's confirm button. Downloading the file, copying a block, or a copy that fails never changes it, so the comparison survives a reload and still shows the full difference if you answer differently again before you press the button. When your browser cannot save that confirmation, the page says so and keeps the pending update visible instead of reporting success.

Updating a tool file:

- **Claude Code and Cursor** files also hold your other settings. The first time, it shows the rules to add, the full file for a new file, and **I've added these rules**. When your rules differ from that record, it shows **Remove these rules** and **Add these rules**, each with a copy button, and **My file is updated**: "To update, remove these rules from your file and add these."
- **Codex and Gemini CLI** files hold only this worksheet's rules. To update, replace the whole file with the new download or the copied rules, then press **I've replaced the file**. Never add new rules to the end: when two rules match a command, the stricter one applies, so an ask already in the file would still win over a new allow.
- **Check it loaded** uses a rule you changed since your file last matched your answers, when there is one, for example the Codex check runs `codex execpolicy check` on that command and says which decision it should print. Otherwise it uses the default example.

Each file comes from your answers:

- DENY becomes deny. ASK, unanswered, and Doesn't apply become ask.
- ALLOW becomes allow only when the answer is reviewed, has no notes, and your additional boundaries are empty. Otherwise it becomes ask, because an answer you have not reviewed is never an ALLOW and a settings file cannot hold a limit you wrote.
- When two answers cover the same command, the stricter one wins.
- Only well-known commands and paths get a rule, and almost none of them allow a whole program such as `gh`, `vercel`, `stripe`, or `sudo`. The one deliberate exception is `pytest`: your test suite is meant to run as a whole program, so a reviewed ALLOW with no notes on that question can allow it outright.

| Tool        | Download                                             | Save it as                                                                                                 | Confirm                                             | Check it loaded                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `claude-code-settings.json`                          | `.claude/settings.json` in your project folder                                                             | **I've added these rules** / **My file is updated** | Run `/permissions` in Claude Code. Your allow, ask, and deny rules are listed there.                                                                                                                    |
| Codex       | `codex-ai-agent-rules.rules` and `codex-config.toml` | `.codex/rules/ai-agent-rules.rules` (or `~/.codex/rules/`) and `.codex/config.toml` in your project folder | **I've replaced the file**                          | Run `codex execpolicy check --pretty --rules .codex/rules/ai-agent-rules.rules -- git push --force` and read the decision it prints. Codex reads project files in `.codex/` when you trust the project. |
| Gemini CLI  | `gemini-ai-agent-rules.toml`                         | `~/.gemini/policies/ai-agent-rules.toml` in your home folder                                               | **I've replaced the file**                          | Ask Gemini CLI to run a command your file denies, such as `git push --force --dry-run`. It refuses with your policy's reason.                                                                           |
| Cursor      | `cursor-permissions.json`                            | `.cursor/permissions.json` in your project folder                                                          | **I've added these rules** / **My file is updated** | Guidance only. Cursor applies these instructions only in Auto-review mode and does not treat them as security. The file applies to the Cursor editor; the Cursor CLI has its own permissions.           |

Your browser saves each download under the name in the Download column. Rename it and move it to the path in the Save it as column. For Codex and Gemini CLI, replace any file already at that path. For Claude Code and Cursor, add the copied rules to a file you already have instead of replacing it, so your other settings stay. Press the Confirm column's button only once the file on disk actually matches what the page shows.

Under **Additional boundaries** on the Builder track, one line explains: "Coding tool settings cannot store limits, so any text here turns every allow in them into ask. Your policy keeps your ALLOW answers and these limits."

The Builder page says what share of your answers tool settings back up, for example "Tool settings back up about one in five of your Builder answers (22 of 100). The rest stay as instructions in your policy." An answer counts only when Claude Code, Codex, and Gemini CLI all carry a rule for it, it has no notes, and its rules are not partial. A rule is partial when it matches only some ways of doing the action or more than the question covers, such as a force-push with its options after the branch name, `git add .` next to a rule for `.env`, SQL through `psql`, or switching Stripe to live mode. Partial rules are still written for ask and deny, and the lists on the page label them. Cursor never counts toward coverage.

Tool settings are a strong guardrail, not a lock. A tool can miss a command written another way, for example with its options in a different order or wrapped in `sh -c`, so your policy still applies.

Beside each policy the page shows its size and a rough estimate of its tokens: "Rough estimate: about N tokens." N is the number of characters divided by four, rounded to the nearest 50. It is not a count from any model.

On the Personal track, rules stay as instructions, because everyday assistants do not accept permission files.

## What each download is

| File                                                                                                                                    | What it is                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `my-agent-policy-builder.md` or `my-agent-policy-personal.md`                                                                           | The full policy for that track, from **Download my agent policy**: who it belongs to, how many answers are reviewed, the core rules, then every question with its decision and your notes, then your additional boundaries. Give this to your agents.                                      |
| `my-agent-answers-builder.json` or `my-agent-answers-personal.json`                                                                     | Your saved answers for that track, from **Save my answers to a file**, including which answers are still suggested. Use **Load my answers from a file** to bring them back or move them to another browser, device, or copy of the worksheet.                                              |
| `my-agent-policy-builder-compact.md` or `my-agent-policy-personal-compact.md`                                                           | The compact policy, under **More options**: the track and owner details, the same operating rules in fewer words, then three lists in your own voice (Never, Ask me first, OK without asking) and your additional boundaries. Each answer still suggested or waiting for review is marked. |
| `claude-code-settings.json`, `codex-ai-agent-rules.rules`, `codex-config.toml`, `gemini-ai-agent-rules.toml`, `cursor-permissions.json` | Builder coding tool settings. See [Coding tool settings](#coding-tool-settings).                                                                                                                                                                                                           |
| `ai-agent-rules.html`                                                                                                                   | The blank worksheet with both tracks. It holds no answers, so it is safe to share.                                                                                                                                                                                                         |

Every policy states "Reviewed: r of 100. Suggested and not reviewed: u." Unanswered questions and Doesn't apply grant no permission. The policies tell agents to ask before acting on anything unanswered.

## Where your files and answers live

- **Downloads** go to your browser's downloads folder, usually **Downloads**. On iPhone, find them in the **Files** app.
- **Answers save automatically in this browser only.** They are not uploaded anywhere. The sticky bar shows **Saved in this browser**. When a browser blocks storage, it shows **Not saved: this browser is blocking storage** with **Save my answers to a file.** Each track shows its own status: a save on one track never hides unsaved answers on the other. Every edit, and any answers you load from a file, stays on the page for this visit, and the next save that succeeds stores all of them. Clearing your browser data removes your answers, so keep your answers saved to a file.
- **Two open tabs stay in step.** Each change saves only the answer, note, or field you changed, and other open tabs of the same worksheet show it right away.
- **Saved answers that cannot be read are kept aside, never overwritten.** The track starts empty, and a notice lets you download the unreadable data as a text file.
- **The website and a downloaded copy keep separate answers.** Each copy saves on its own. To move answers between them, or to another device, use **Save my answers to a file** in one and **Load my answers from a file** in the other. Answers files up to 16 MB load.
- Keep completed policies and saved answers files private. Share the blank worksheet or the link instead. **Copy link** in the share area copies `https://3fold-labs.github.io/ai-agent-rules/`.

## For contributors

`index.html` is a generated distribution file, not the source. Edit the files in `src/`, then run `npm run build` to regenerate it; CI fails when `index.html` does not match `src/`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the rules every change follows.

```bash
npm ci                            # install Playwright, ESLint, and Prettier
npm run build                     # regenerate index.html from src/
npm test                          # check that index.html is current, then run the unit tests
npx playwright install chromium   # once, before the first browser test run
npm run e2e                       # browser tests in headless Chromium
npm run lint                      # ESLint
npm run format                    # Prettier (npm run format:check only checks)
```

`npm test` needs only Node.js. To run the browser tests with a Chromium build you already have, set `PW_CHROMIUM_PATH` to its executable. CI runs the lint, format, and build checks, the unit tests (including the check that each track has exactly 100 questions), and the browser tests. The Pages site publishes only the worksheet, and only after all of them pass for that commit.

### Project structure

```text
index.html                  the worksheet as one standalone file, generated from src/ (never edit it directly)
src/page.html               markup template with placeholders for the styles, logo, and scripts
src/styles/*.css            styles by area of the page, inlined in cascade order
src/assets/logo.png         the logo, inlined as a data URI
src/initial-theme.js        applies the saved or system theme before the page paints
src/core/version.mjs        the release version
src/core/questionnaire.mjs  both tracks' questions, answer handling, and the Markdown policies
src/core/compiler.mjs       the coding tool settings compiler
src/app/main.mjs            starts the page and connects every control to its feature
src/app/router.mjs          the start page and the two tracks: address hash, opening and switching tracks
src/app/render.mjs          redraws everything on the open track that depends on its answers
src/app/lib/                element, file, and text helpers that know nothing about the worksheet
src/app/store/              localStorage, each track's answers, and which track is open
src/app/page/               the frame: headline, sticky bar, contents list, theme, scroll ring, card shadows
src/app/worksheet/          sections, question cards, profile fields, progress and policy preview
src/app/review/             Before you download, Test your agent, and the both-tracks comparison
src/app/tool-settings/      the Builder coding tool panel, its buttons, and the record of installed rules
src/app/export/             policy, answers file, blank worksheet, unreadable data, and clearing a track
scripts/build.mjs           bundles src/ with esbuild into index.html (--check verifies that it is current)
test/                       unit tests (node --test), including the module layer and import cycle checks
e2e/                        browser tests (Playwright)
```

## Disclaimer

This worksheet and the policies and tool settings it produces record preferences. They do not control, supervise, or restrain any assistant, model, or third-party product, including Muse, Grok, ChatGPT, Claude, or any other agent. Nothing here guarantees that a bot will follow an ALLOW, ASK, or DENY choice, ask before acting, or refuse an action.

THE SOFTWARE AND THESE INSTRUCTIONS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, 3FOLD LABS, LLC AND ITS MEMBERS, EMPLOYEES, AND CONTRIBUTORS DISCLAIM ALL LIABILITY FOR ANY CLAIM, DAMAGE, OR LOSS ARISING OUT OF OR RELATED TO THE USE OF, OR INABILITY TO USE, THIS RELEASE, INCLUDING ANY ACT, OMISSION, OR STATEMENT BY ANY ASSISTANT OR AGENT. USE OF THIS RELEASE IS AT YOUR OWN RISK AND IS ACCEPTANCE OF THESE TERMS.

## License

MIT. See [LICENSE](./LICENSE). Published by 3Fold Labs, LLC. The MIT warranty disclaimer also applies.
