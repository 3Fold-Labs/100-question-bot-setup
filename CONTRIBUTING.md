# Contributing

This repository builds the 100-Question AI Agent Setup worksheet: one standalone HTML file that runs in any browser with no server, account, or network access.

## Set up

Use Node.js 24, the version CI runs.

```bash
npm ci
npx playwright install chromium   # for the browser tests; or set PW_CHROMIUM_PATH to a Chromium you already have
```

## Where the code lives

- `src/core/`: the release version (`version.mjs`), both tracks' questions, answer handling, and the Markdown policies (`questionnaire.mjs`), and the coding tool settings compiler (`compiler.mjs`). The tests import these modules directly.
- `src/app/`: the page itself, one module per job, grouped by area of the page. `main.mjs` starts the page and connects every control to its feature, `router.mjs` opens the start page or a track, and `render.mjs` redraws the open track when its answers change. The folders hold the helpers (`lib/`), saved data (`store/`), the frame around the worksheet (`page/`), answering (`worksheet/`), checking before download (`review/`), the Builder tool panel (`tool-settings/`), and downloads and clearing (`export/`).
- `src/page.html`, `src/styles/`, `src/assets/`, `src/initial-theme.js`: the markup template, styles, logo, and the script that applies the theme before the page paints.
- `scripts/build.mjs`: bundles `src/` with esbuild into `index.html`.
- `test/`: unit tests. `e2e/`: browser tests.

The README's [Project structure](./README.md#project-structure) lists every path.

## index.html is generated

Never edit `index.html` directly. Change the files in `src/`, run `npm run build`, and commit the regenerated `index.html` with your change. `npm run build:check` and CI fail when it does not match `src/`.

The build inlines everything into one file, and the page's security policy blocks network requests, so never add external scripts, styles, fonts, or images. esbuild bundles `src/app/main.mjs` and everything it imports into one script, so a new module needs only an `import` where it is used. The style sheets are joined in the cascade order listed in `scripts/build.mjs`; add a new style sheet to that list.

## Module layers

Page code only imports downward. Each module imports from its own layer or the layers below it:

1. `src/core/`: the rules engine, with no page code.
2. `src/app/lib/`: helpers that know nothing about the worksheet.
3. `src/app/store/`: saved data and the open track.
4. `src/app/page/`, `worksheet/`, `review/`, `tool-settings/`, `export/`: the features.
5. `src/app/router.mjs` and `src/app/render.mjs`.
6. `src/app/main.mjs`, which nothing imports.

When a lower layer needs something above it, it offers a hook instead: `store/answers.mjs` announces changed answers through `onAnswersChange`, and `store/open-track.mjs` opens or redraws a track through the functions the router registers. `test/structure.test.mjs` fails on an upward import, an import cycle, or a file in `src/app` that nothing imports.

## Exactly 100 questions per track

The Builder and Personal tracks each have exactly 100 questions, numbered 1 to 100, with no duplicates in a track. This is a release requirement. Add a topic by consolidating it with overlapping questions; never add a question beyond 100. The unit tests check the count, the numbering, and a hash of each track's exact content, so changing question text means updating the expected hash in `test/worksheet.test.mjs` in the same change.

## Tests that must pass

Every change passes all of these before it merges. CI runs them on every push and pull request, and the Pages site publishes only after they pass.

```bash
npm run lint
npm run format:check
npm run build:check
npm test
npm run e2e
```

`npm run format` applies Prettier.

## Copy rules

- No em dashes (U+2014) in any file. Use periods, commas, colons, or parentheses. A unit test enforces this.
- Write in the present tense and describe the product as it is now. User-facing text (the page, exported policies, notices, README, release notes, and docs) never mentions earlier versions, what changed, or old question numbers.
- Policies and tool settings record the user's preferences. Never promise that an assistant or tool will follow them.
- Keep personal answers and filled exports out of Git.
