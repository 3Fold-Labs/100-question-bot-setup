# 100-Question AI Agent Setup

Decide what your AI agents can do, what needs your approval, and what is off limits. Pick a track, answer **100 questions** with ALLOW, ASK, DENY, or Doesn't apply, then download a Markdown policy to give to the agents you use.

**[Open the worksheet](https://3fold-labs.github.io/100-question-bot-setup/)** · [Download the blank HTML](./index.html)

## Two tracks, 100 questions each

| Track | Who it is for | What it covers |
| --- | --- | --- |
| **Builder**: I build with AI | Anyone who codes or builds with AI (apps, sites, scripts, automations, or tools) using Claude Code, Cursor, Codex, Lovable, Bolt, Replit, or similar agents | Money and paid services, your code and project files, Git and GitHub, your live data and users, deploying and going live, secrets and logins, your computer, messages and publishing, and how the agent works with you |
| **Personal**: I use AI in my everyday life | People who use Muse, ChatGPT, Claude, Gemini, Grok, or other assistants for email, calendar, shopping, messages, and selling | Money and shopping, selling and marketplaces, messages and calls, calendar and plans, your personal information, accounts and passwords, files and photos, home devices and apps, family, health and legal matters, social media, and how the agent works with you |

Each track keeps its own answers. Every question starts unanswered and shows a suggested answer. **Start from suggested answers** fills every unanswered question at once, and you can change any of them.

## Use it with your agents

1. Open the worksheet in a browser. It also works as a downloaded HTML file with no internet connection. On a phone, open the link in Safari or Chrome. A file preview (the Files app, a message attachment, or AirDrop) shows the page but cannot run it.
2. Choose the Builder or Personal track. **Switch to Personal** or **Switch to Builder** moves between tracks, and the logo returns to the start page.
3. Choose which sections apply to you, or press **Start from suggested answers**.
4. Answer the questions and add any limits, recipients, folders, or other scope in the notes. If a whole section does not fit your life or work, mark it as not applying. The answers underneath stay saved, and while the section is off, every question in it reads as Doesn't apply.
5. Download your policy and attach or paste it into each agent's instructions. Then say: **"Follow this policy. Apply it before taking actions, and ask me about anything unclear."**

The policy works with any assistant or agent that accepts instructions, such as Muse, ChatGPT, Claude, Gemini, Grok, or Perplexity. Use the instruction or file features of the product you use. No MCP connection, server, account, or API key is required.

## What each download is

| File | What it is |
| --- | --- |
| `my-agent-policy-builder.md` or `my-agent-policy-personal.md` | The full policy for that track: the core rules, then every question with its decision and your notes, then your additional boundaries. Give this to your agents. |
| `my-agent-policy-builder-short.md` or `my-agent-policy-personal-short.md` | A short version: the core rules and three lists (Never, Ask me first, OK without asking). Use it where an agent only accepts short instructions. |
| `my-agent-answers-builder.json` or `my-agent-answers-personal.json` | Your answer backup for that track. Load it into the worksheet to restore your answers or move them to another browser, device, or copy of the worksheet. |
| `100-question-bot-setup.html` | The blank worksheet with both tracks. It holds no answers, so it is safe to share. |

Unanswered questions and Doesn't apply grant no permission. The policies tell agents to ask before acting on anything unanswered.

## Where your files and answers live

- **Downloads** go to your browser's downloads folder, usually **Downloads**. On iPhone, find them in the **Files** app.
- **Answers save automatically in this browser only.** They are not uploaded anywhere. Clearing your browser data removes them, so keep an answer backup.
- **The website and a downloaded copy keep separate answers.** Each copy saves on its own. To move answers between them, or to another device, download the answer backup from one and load it into the other.
- Keep completed policies and answer backups private. Share the blank worksheet or the link instead.

## For contributors

Run `npm test`. The questions for both tracks live in `questionnaire.mjs`, and the release version lives in `version.mjs`. After changing either file, run `npm run sync` to update the standalone HTML. CI checks that each track has exactly 100 questions.

An optional developer checker reads a Personal track answer backup and evaluates six action types. It is separate from the Markdown workflow. [Developer integration details](docs/optional-checker.md).

## Disclaimer

This worksheet, checker, and any instructions they produce record preferences. They do not control, supervise, or restrain any assistant, model, or third-party product, including Muse, Grok, ChatGPT, Claude, or any other agent. Nothing here guarantees that a bot will follow an ALLOW, ASK, or DENY choice, ask before acting, or refuse an action.

THE SOFTWARE AND THESE INSTRUCTIONS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, 3FOLD LABS, LLC AND ITS MEMBERS, EMPLOYEES, AND CONTRIBUTORS DISCLAIM ALL LIABILITY FOR ANY CLAIM, DAMAGE, OR LOSS ARISING OUT OF OR RELATED TO THE USE OF, OR INABILITY TO USE, THIS RELEASE, INCLUDING ANY ACT, OMISSION, OR STATEMENT BY ANY ASSISTANT OR AGENT. USE OF THIS RELEASE IS AT YOUR OWN RISK AND IS ACCEPTANCE OF THESE TERMS.

## License

MIT. See [LICENSE](./LICENSE). Published by 3Fold Labs, LLC. The MIT warranty disclaimer also applies.
