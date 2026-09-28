# Product contract

- This is a **100-question AI agent permissions worksheet with two tracks**: **Builder** ("I build with AI") and **Personal** ("I use AI in my everyday life"). Each track has exactly 100 user-facing questions, numbered 1 to 100, with no duplicates within a track. This is a release requirement. Integrate added topics by consolidating overlap; never append questions beyond 100 in either track.
- The primary workflow is: choose a track, answer the worksheet, download the Markdown policy, give it to any assistant or agent, and say "Follow this policy." It requires no MCP connection, server, account, or API key.
- Write for personal and team use across AI providers. An anecdote or social post supplies examples of missing boundaries; it does not replace the product's scope or become the release description.
- **No user-facing text references past versions, what changed, what was merged, moved, or removed, old question numbers, earlier answers, or why anything changed.** This covers the page, exported Markdown, notices and error strings, tool descriptions, README, release notes, and docs. The product shows only what it is now. Internal code identifiers may name stored formats where unavoidable.
- **No em dashes (U+2014) in any file.** Use periods, commas, colons, or parentheses. A test enforces this.
- Preserve saved answers silently. A stored answer carries into a track only where its question text is identical to a question in that track. Never reuse a stored permission for a different action.
- Downloading a blank worksheet must preserve the current browser's answers and remove personal data from the downloaded HTML.
- Keep optional developer integrations separate from normal setup. Text instructions express the user's policy; do not promise that they guarantee compliance.
- Keep personal answers, private recovery notes, and filled exports out of Git and release assets.
- The release version lives only in `version.mjs` (`package.json` mirrors it without the leading `v`).
- Run `npm test`. Run `npm run sync` after changing `questionnaire.mjs` or `version.mjs`. Exercise both tracks in a browser (save and reload, full and short Markdown, JSON backup and import, sections marked as not applying, blank download) before claiming release readiness. Report any verification blocker plainly.
- Public product documentation and release descriptions explain the current product and user workflow. Keep repair audits, implementation history, and private repository references in ignored local review notes.
