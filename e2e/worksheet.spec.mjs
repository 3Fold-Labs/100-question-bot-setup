import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {
  TRACKS,
  TRACK_IDS,
  trackGroups,
  emptyPolicy,
  agentTestPrompts,
  instructionText,
  questionHash,
  QUICK_START,
  WORKSHEET_URL,
  BLANK_FILE_NAME
} from '../src/core/questionnaire.mjs';
import {
  compileToolSettings,
  coverageText,
  tokenLabel,
  TOOL_FILE_NAMES,
  TOOL_TAG_TEXT,
  toolTag
} from '../src/core/compiler.mjs';
import {VERSION} from '../src/core/version.mjs';

const BASE = `http://127.0.0.1:${Number(process.env.E2E_PORT || 4178)}`;
const KEY = {builder: '3fold-agent-policy-builder', personal: '3fold-agent-policy-personal'};
const SHARED = TRACKS.builder.questions
  .map(q => ({
    question: q.question,
    builder: q.id,
    personal: TRACKS.personal.questions.find(p => p.question === q.question)?.id
  }))
  .filter(q => q.personal);

const option = (page, id, value) => page.locator(`#q-${id} input[value="${value}"]`);
const count = page => page.locator('#count');

function saved(track, answers = {}, extra = {}) {
  return JSON.stringify({...emptyPolicy(track), answers, ...extra});
}
function allAnswered(track, choice = 'ASK') {
  return Object.fromEntries(
    TRACKS[track].questions.map(q => [q.id, {choice, notes: '', qh: questionHash(q.question)}])
  );
}

// Puts saved data in this browser, then loads the page fresh at the given hash.
async function seed(page, entries, hash = '#start') {
  await page.goto('/#start');
  await page.evaluate(values => {
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, entries);
  await page.goto(`/?load=${Date.now()}${hash}`);
}

async function download(page, action) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()]);
  return {name: file.suggestedFilename(), text: await readFile(await file.path(), 'utf8')};
}

async function storedJson(page, key) {
  return JSON.parse(await page.evaluate(k => localStorage.getItem(k), key));
}

const qh = (track, id) => questionHash(TRACKS[track].questions.find(q => q.id === id).question);
const moreOptions = async page => {
  if (!(await page.locator('#more-options').evaluate(node => node.open)))
    await page.locator('#more-options-summary').click();
};

test('opens to the track picker with both tracks, the version, and the title', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/100-Question AI Agent Setup/);
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#track-view')).toBeHidden();
  await expect(page.locator('#js-needed')).toBeHidden();
  await expect(page.locator('.track-tile')).toHaveCount(2);
  await expect(page.locator('.track-tile[data-track="builder"]')).toContainText('I build with AI');
  await expect(page.locator('.track-tile[data-track="personal"]')).toContainText('I use AI in my everyday life');
  await expect(page.locator('#footer-name')).toHaveText(`100-Question AI Agent Setup · ${VERSION} · 3Fold Labs`);
});

test('each track shows exactly its 100 questions, and Switch moves between tracks with separate answers', async ({
  page
}) => {
  await page.goto('/');
  await page.locator('.track-tile[data-track="builder"]').click();
  await expect(page).toHaveURL(/#builder$/);
  await expect(page.locator('#questions fieldset.q')).toHaveCount(100);
  expect(await page.locator('.q-title').allTextContents()).toEqual(TRACKS.builder.questions.map(q => q.question));
  await expect(page.locator('#bar-track')).toHaveText('Builder');
  await expect(page.locator('#switch-track')).toHaveText('Switch to Personal');
  await option(page, 1, 'DENY').click();
  await expect(option(page, 1, 'DENY')).toBeChecked();
  await expect(count(page)).toHaveText('1 of 100 answered · 1 reviewed');
  await page.locator('#switch-track').click();
  await expect(page).toHaveURL(/#personal$/);
  await expect(page.locator('#bar-track')).toHaveText('Personal');
  await expect(page.locator('#switch-track')).toHaveText('Switch to Builder');
  await expect(page.locator('#questions fieldset.q')).toHaveCount(100);
  expect(await page.locator('.q-title').allTextContents()).toEqual(TRACKS.personal.questions.map(q => q.question));
  await expect(count(page)).toHaveText('0 of 100 answered · 0 reviewed');
  await page.locator('#switch-track').click();
  await expect(option(page, 1, 'DENY')).toBeChecked();
});

test('suggested answers stay marked until reviewed, with reviewed counts and example scopes', async ({page}) => {
  await page.goto('/#builder');
  await expect(count(page)).toHaveText('0 of 100 answered · 0 reviewed');
  await page.locator('#suggest').click();
  await expect(count(page)).toHaveText('100 of 100 answered · 0 reviewed');
  await expect(page.locator('.q-suggested:visible')).toHaveCount(100);
  await expect(page.locator('#q-1 .q-suggested')).toHaveText('Suggested, not reviewed');
  // Choosing the option that is already selected counts as a review.
  const first = TRACKS.builder.questions[0].recommendation;
  await expect(option(page, 1, first)).toBeChecked();
  await option(page, 1, first).click();
  await expect(count(page)).toHaveText('100 of 100 answered · 1 reviewed');
  await expect(page.locator('#q-1 .q-suggested')).toBeHidden();
  // Editing notes counts as a review too.
  await page.locator('#q-2 textarea').fill('only under $20');
  await expect(count(page)).toHaveText('100 of 100 answered · 2 reviewed');
  await expect(page.locator('#q-2 .q-suggested')).toBeHidden();
  expect(await page.locator('#output').inputValue()).toContain(
    '\nReviewed: 2 of 100. Suggested and not reviewed: 98.\n'
  );
  const placeholders = {
    3: 'For example: only if I can cancel before the first charge, and remind me 2 days before',
    13: 'For example: only in src/ and tests/, not config files',
    25: 'For example: feature branches only, never directly to main',
    84: 'For example: status updates to my team channel only',
    96: 'For example: only to my coding agent, with the same rules'
  };
  for (const [id, text] of Object.entries(placeholders))
    await expect(page.locator(`#q-${id} textarea`)).toHaveAttribute('placeholder', text);
  await page.reload();
  await expect(count(page)).toHaveText('100 of 100 answered · 2 reviewed');
  await expect(page.locator('.q-suggested:visible')).toHaveCount(98);
  const stored = await storedJson(page, KEY.builder);
  expect(stored.answers['1']).toEqual({choice: first, notes: '', qh: qh('builder', 1)});
  expect(stored.answers['3'].suggested).toBe(true);
  expect(stored.answers['3'].qh).toBe(qh('builder', 3));
});

test('a turned-off section collapses to its heading and turns back on with a review reminder', async ({page}) => {
  await page.goto('/#builder');
  await page.locator('#suggest').click();
  const group = trackGroups('builder')[0];
  const size = TRACKS.builder.questions.filter(q => q.group === group).length;
  const section = page.locator(`.q-section[data-group="${group}"]`);
  await page.locator('.group-tile', {hasText: group}).locator('input').uncheck();
  await expect(section).toHaveClass(/is-off/);
  await expect(section.locator('fieldset.q:visible')).toHaveCount(0);
  await expect(section.locator('.q-section-title small')).toHaveText('Turned off');
  await expect(page.locator('.group-tile', {hasText: group}).locator('small')).toHaveText(
    `${size} questions · Turned off`
  );
  const output = await page.locator('#output').inputValue();
  expect(output).toContain(`1. ${TRACKS.builder.questions[0].question}\nDecision: DOESN'T APPLY\n`);
  await section.getByRole('button', {name: 'Turn back on'}).click();
  await expect(section).not.toHaveClass(/is-off/);
  await expect(section.locator('fieldset.q:visible')).toHaveCount(size);
  await expect(section.locator('.q-review-note')).toHaveText(
    `${size} suggested answers in this section are waiting for review.`
  );
  await option(page, 1, 'DENY').click();
  await expect(section.locator('.q-review-note')).toHaveText(
    `${size - 1} suggested answers in this section are waiting for review.`
  );
});

test('every download has its file name and key content', async ({page}) => {
  await page.goto('/#personal');
  await page.locator('#owner').fill('OWNER_MARKER_7431');
  await page.locator('#exceptions').fill('Only share my phone number with Alex');
  await option(page, 40, 'ALLOW').click();
  await option(page, 39, 'DENY').click();
  await expect(page.locator('#fn-policy')).toHaveText('my-agent-policy-personal.md');
  await expect(page.locator('#fn-compact')).toHaveText('my-agent-policy-personal-compact.md');
  await expect(page.locator('#fn-backup')).toHaveText('my-agent-answers-personal.json');
  await expect(page.locator('#fn-blank')).toHaveText(BLANK_FILE_NAME);

  const full = await download(page, () => page.locator('#download-policy').click());
  expect(full.name).toBe('my-agent-policy-personal.md');
  expect(full.text.startsWith('# AI agent operating instructions\nTrack: Personal\nAnswered: 2/100\n')).toBe(true);
  expect(full.text).toContain('Owner: OWNER_MARKER_7431');
  expect(full.text).toContain(
    'A rule covers the action however it is done: command line, app, API, MCP tool, or browser.'
  );
  expect(full.text).toContain('40. Can it give someone your phone number?\nDecision: ALLOW\n');
  expect(full.text.trimEnd().endsWith('## Additional boundaries\nOnly share my phone number with Alex')).toBe(true);

  expect(full.text).toContain('\nReviewed: 2 of 100. Suggested and not reviewed: 0.\n');

  // Everything except the policy and the backup sits under More options.
  await expect(page.locator('#download-compact')).toBeHidden();
  await moreOptions(page);
  const compact = await download(page, () => page.locator('#download-compact').click());
  expect(compact.name).toBe('my-agent-policy-personal-compact.md');
  expect(
    compact.text.startsWith('# My AI agent rules: Personal track\n\nTrack: Personal\nOwner: OWNER_MARKER_7431\n')
  ).toBe(true);
  expect(compact.text).toContain(
    '- A rule covers the action however it is done: command line, app, API, MCP tool, or browser.'
  );
  expect(compact.text).toContain(
    '## Never\n- give someone my home address, building, unit, or directions to where I am (#39)'
  );
  expect(compact.text).toContain('- give someone my phone number (#40)');
  expect(compact.text.trimEnd().endsWith('## Additional boundaries\nOnly share my phone number with Alex')).toBe(true);
  await expect(page.locator('#size-compact')).toHaveText(compact.text.length.toLocaleString('en-US'));

  const backup = await download(page, () => page.locator('#download-backup').click());
  expect(backup.name).toBe('my-agent-answers-personal.json');
  const data = JSON.parse(backup.text);
  expect([data.schema, data.policyId, data.track, data.answers['40'].choice, data.exceptions]).toEqual([
    4,
    '3fold-agent-policy-personal-v4',
    'personal',
    'ALLOW',
    'Only share my phone number with Alex'
  ]);

  const blank = await download(page, () => page.locator('#share-blank-btn').click());
  expect(blank.name).toBe('ai-agent-rules.html');
  expect(blank.text).toContain('data-blank="true"');
  expect(blank.text).not.toContain('OWNER_MARKER_7431');
  expect(blank.text).not.toContain('Only share my phone number with Alex');
  await expect(page.locator('#share-status')).toHaveText(
    'Blank worksheet downloaded with both tracks. Your answers here stay as they are.'
  );
});

test('the blank copy opens to the picker with no answers', async ({page, browser}) => {
  await page.goto('/#builder');
  await page.locator('#company').fill('COMPANY_MARKER_5520');
  await page.locator('#suggest').click();
  const blank = await download(page, () => page.locator('#cta-blank').click());
  expect(blank.name).toBe(BLANK_FILE_NAME);
  // Even where this browser remembers a track, the blank copy starts at the picker.
  await page.route('**/ai-agent-rules.html', route => route.fulfill({body: blank.text, contentType: 'text/html'}));
  await page.goto('/ai-agent-rules.html');
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#track-view')).toBeHidden();
  // A new browser that opens it has no answers in either track.
  const context = await browser.newContext({baseURL: BASE});
  const fresh = await context.newPage();
  await fresh.route('**/ai-agent-rules.html', route => route.fulfill({body: blank.text, contentType: 'text/html'}));
  await fresh.goto('/ai-agent-rules.html');
  await expect(fresh.locator('#picker')).toBeVisible();
  for (const track of TRACK_IDS) {
    await fresh.locator(`.track-tile[data-track="${track}"]`).click();
    await expect(count(fresh)).toHaveText('0 of 100 answered · 0 reviewed');
    await expect(fresh.locator('#company')).toHaveValue('');
    await fresh.locator('#home-link').click();
  }
  await context.close();
});

test('an answer backup round-trips answers, notes, fields, sections, and suggested marks', async ({page}) => {
  await page.goto('/#builder');
  await page.locator('#suggest').click();
  await option(page, 1, 'DENY').click();
  await page.locator('#q-1 textarea').fill('ROUNDTRIP_NOTE');
  await page.locator('#company').fill('Acme');
  await page.locator('.group-tile', {hasText: 'Git and GitHub'}).locator('input').uncheck();
  const before = await count(page).textContent();
  const backup = await download(page, () => page.locator('#download-backup').click());
  await page.locator('#clear-answers').click();
  await page.locator('#clear-yes').click();
  await expect(count(page)).toHaveText('0 of 100 answered · 0 reviewed');
  await page
    .locator('#load-backup')
    .setInputFiles({name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.text)});
  await expect(page.locator('#notice')).toHaveText('Loaded your Builder track answers.');
  await expect(count(page)).toHaveText(before);
  await expect(option(page, 1, 'DENY')).toBeChecked();
  await expect(page.locator('#q-1 textarea')).toHaveValue('ROUNDTRIP_NOTE');
  await expect(page.locator('#company')).toHaveValue('Acme');
  await expect(page.locator('.q-section[data-group="Git and GitHub"]')).toHaveClass(/is-off/);
  await expect(page.locator('#q-2 .q-suggested')).toBeVisible();
  await expect(page.locator('#q-1 .q-suggested')).toBeHidden();
  const again = await download(page, () => page.locator('#download-backup').click());
  expect(JSON.parse(again.text)).toEqual(JSON.parse(backup.text));
  // With answers present, loading asks first.
  await page
    .locator('#load-backup')
    .setInputFiles({name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.text)});
  await expect(page.locator('#import-confirm')).toBeVisible();
  await page.locator('#import-yes').click();
  await expect(page.locator('#notice')).toHaveText('Loaded your Builder track answers.');
});

test("two open tabs save only what changed and show each other's answers", async ({context}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/#builder');
  await b.goto('/#builder');
  await option(a, 1, 'ALLOW').click();
  await option(b, 2, 'DENY').click();
  await b.locator('#q-3 textarea').fill('B_NOTE');
  await a.locator('#company').fill('A_COMPANY');
  await expect(option(b, 1, 'ALLOW')).toBeChecked();
  await expect(option(a, 2, 'DENY')).toBeChecked();
  await expect(a.locator('#q-3 textarea')).toHaveValue('B_NOTE');
  await expect(b.locator('#company')).toHaveValue('A_COMPANY');
  await expect(count(a)).toHaveText('2 of 100 answered · 2 reviewed');
  await expect(count(b)).toHaveText('2 of 100 answered · 2 reviewed');

  // A tab that never hears about other tabs still writes only its own change.
  const deaf = await context.newPage();
  await deaf.addInitScript(() => window.addEventListener('storage', event => event.stopImmediatePropagation(), true));
  await deaf.goto('/#builder');
  await option(a, 4, 'ASK').click();
  await a.locator('#exceptions').fill('A_BOUNDARY');
  await expect(option(deaf, 4, 'ASK')).not.toBeChecked();
  await option(deaf, 5, 'DENY').click();
  const stored = await storedJson(a, KEY.builder);
  expect(stored.answers['1']).toEqual({choice: 'ALLOW', notes: '', qh: qh('builder', 1)});
  expect(stored.answers['2']).toEqual({choice: 'DENY', notes: '', qh: qh('builder', 2)});
  expect(stored.answers['3']).toEqual({choice: '', notes: 'B_NOTE', qh: qh('builder', 3)});
  expect(stored.answers['4']).toEqual({choice: 'ASK', notes: '', qh: qh('builder', 4)});
  expect(stored.answers['5']).toEqual({choice: 'DENY', notes: '', qh: qh('builder', 5)});
  expect([stored.company, stored.exceptions]).toEqual(['A_COMPANY', 'A_BOUNDARY']);
  await expect(option(a, 5, 'DENY')).toBeChecked();
  await expect(option(b, 5, 'DENY')).toBeChecked();
});

test('unreadable saved answers are kept aside, never overwritten, with a notice and a download', async ({page}) => {
  const broken = '{"schema":4, this is not readable';
  await seed(page, {[KEY.builder]: broken, [KEY.builder + '-unreadable']: 'OLDER_KEPT'}, '#builder');
  const notice = page.locator('#unreadable');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    'Some saved answers in this browser could not be read. They are kept aside, and you can download them.'
  );
  await expect(count(page)).toHaveText('0 of 100 answered · 0 reviewed');
  const keys = await page.evaluate(
    k => ({
      main: localStorage.getItem(k),
      first: localStorage.getItem(k + '-unreadable'),
      second: localStorage.getItem(k + '-unreadable-2')
    }),
    KEY.builder
  );
  expect(keys).toEqual({main: null, first: 'OLDER_KEPT', second: broken});
  const file = await download(page, () => page.locator('#unreadable-download').click());
  expect(file.name).toBe('unreadable-answers-builder.txt');
  expect(file.text).toContain(broken);
  expect(file.text).toContain('OLDER_KEPT');
  await option(page, 1, 'ALLOW').click();
  expect((await storedJson(page, KEY.builder)).answers['1'].choice).toBe('ALLOW');
  expect(await page.evaluate(k => localStorage.getItem(k + '-unreadable-2'), KEY.builder)).toBe(broken);
  await page.locator('#unreadable-hide').click();
  await expect(notice).toBeHidden();
  // The other track is unaffected.
  await page.locator('#switch-track').click();
  await expect(page.locator('#unreadable')).toBeHidden();
});

test('the sticky bar shows whether answers are saved', async ({page, browser}) => {
  await page.goto('/#builder');
  await option(page, 1, 'ALLOW').click();
  await expect(page.locator('#storage-text')).toHaveText('Saved in this browser');
  await expect(page.locator('#storage-backup')).toBeHidden();
  await expect(page.locator('#storage-status')).not.toHaveClass(/is-bad/);

  const context = await browser.newContext({baseURL: BASE});
  await context.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  const blocked = await context.newPage();
  await blocked.goto('/#builder');
  await expect(blocked.locator('#storage-status')).toHaveText(
    'Not saved: this browser is blocking storage. Save my answers to a file.'
  );
  await option(blocked, 1, 'DENY').click();
  await expect(count(blocked)).toHaveText('1 of 100 answered · 1 reviewed');
  await expect(blocked.locator('#storage-status')).toHaveText(
    'Not saved: this browser is blocking storage. Save my answers to a file.'
  );
  const backup = await download(blocked, () => blocked.locator('#storage-backup').click());
  expect(backup.name).toBe('my-agent-answers-builder.json');
  expect(JSON.parse(backup.text).answers['1'].choice).toBe('DENY');
  // Loading a backup that cannot be saved says so.
  await blocked.locator('#load-backup').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved('personal', {1: {choice: 'ASK', notes: ''}}))
  });
  await expect(blocked.locator('#notice')).toContainText('Loaded your Personal track answers for this visit only.');
  await expect(blocked.locator('#notice')).toContainText('save your answers to a file');
  await expect(count(blocked)).toHaveText('1 of 100 answered · 1 reviewed');
  await context.close();
});

test('answer backups up to 16 MB load', async ({page}) => {
  await page.goto('/#personal');
  const body = saved('personal', {1: {choice: 'ALLOW', notes: ''}}, {pad: 'x'.repeat(2 * 1024 * 1024)});
  await page
    .locator('#load-backup')
    .setInputFiles({name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(body)});
  await expect(page.locator('#notice')).toHaveText('Loaded your Personal track answers.');
  const tooBig = Buffer.alloc(16 * 1024 * 1024 + 1, 32);
  await page.locator('#load-backup').setInputFiles({name: 'huge.json', mimeType: 'application/json', buffer: tooBig});
  await expect(page.locator('#notice')).toHaveText(
    'Could not load this file. The file is too large to be an answers file.'
  );
});

test('the logo returns to the start page', async ({page}) => {
  await page.goto('/#builder');
  await expect(page.locator('#track-view')).toBeVisible();
  await page.locator('#home-link').click();
  await expect(page).toHaveURL(/#start$/);
  await expect(page.locator('#picker')).toBeVisible();
  await expect(page.locator('#track-view')).toBeHidden();
  await page.reload();
  await expect(page.locator('#picker')).toBeVisible();
});

test('the scroll ring goes to the top on click and to the bottom on hold', async ({page}) => {
  await page.goto('/#builder');
  const ring = page.locator('#scroll-ring');
  await expect(ring).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await ring.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), {timeout: 5000}).toBe(0);
  const box = await ring.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - window.scrollY), {
      timeout: 5000
    })
    .toBeLessThan(4);
});

test('Next unanswered finds unanswered questions, then unreviewed ones, and Go to downloads finds the files', async ({
  page
}) => {
  await page.goto('/#builder');
  await option(page, 1, 'ALLOW').click();
  await page.locator('#next-unanswered').click();
  await expect(option(page, 2, 'ALLOW')).toBeFocused();
  await page
    .locator('.group-tile', {hasText: trackGroups('builder')[0]})
    .locator('input')
    .uncheck();
  const firstActive = TRACKS.builder.questions.find(q => q.group !== trackGroups('builder')[0]);
  await page.locator('#next-unanswered').click();
  await expect(option(page, firstActive.id, 'ALLOW')).toBeFocused();
  await page.locator('#suggest').click();
  await page.locator('#next-unanswered').click();
  await expect(option(page, firstActive.id, firstActive.recommendation)).toBeFocused();
  await page.locator('#go-downloads').click();
  await expect(page.locator('#download-policy')).toBeFocused();
  await expect(page.locator('#export')).toBeInViewport();
  await seed(page, {[KEY.builder]: saved('builder', allAnswered('builder'))}, '#builder');
  await page.locator('#next-unanswered').click();
  await expect(page.locator('#bar-note')).toHaveText('All questions answered and reviewed');
});

test('Check how your agent reads your rules builds three questions from the first DENY, ASK, and ALLOW, with notes', async ({
  page
}) => {
  const answers = {
    1: {choice: 'ALLOW', notes: ''},
    3: {choice: 'ASK', notes: 'only under $30'},
    9: {choice: 'DENY', notes: ''},
    25: {choice: 'DENY', notes: ''}
  };
  await seed(page, {[KEY.personal]: saved('personal', answers)}, '#personal');
  await expect(page.locator('#test-agent h3')).toHaveText('Check how your agent reads your rules');
  await expect(page.locator('#test-agent')).toContainText('not a guarantee of how it will act');
  const items = page.locator('#test-list li');
  await expect(items).toHaveCount(3);
  const expected = agentTestPrompts({...emptyPolicy('personal'), answers}, 'personal');
  expect(expected.map(p => p.id)).toEqual([9, 3, 1]);
  await expect(items.nth(0)).toContainText(
    'If I asked you to save a new payment card to a website or app, what would you do?'
  );
  await expect(items.nth(0)).toContainText('Refuse and say it is not allowed.');
  await expect(items.nth(1)).toContainText(
    'If I asked you to buy something once I approve the exact item and total price, what would you do? My notes for this rule: "only under $30".'
  );
  await expect(items.nth(1)).toContainText('Stop and ask me for approval of that exact action.');
  await expect(items.nth(2)).toContainText(
    'If I asked you to compare prices and find deals without buying anything, what would you do?'
  );
  await expect(items.nth(2)).toContainText('Do it within the scope in my notes.');
  await expect(page.locator('#test-empty')).toBeHidden();
  // Sections turned off are skipped.
  await page.locator('.group-tile', {hasText: 'Money and shopping'}).locator('input').uncheck();
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText('If I asked you to send an email on my behalf, what would you do?');
  await expect(page.locator('#test-empty')).toHaveText(
    'Choose ASK or ALLOW on any question in a section that applies to add a test for it.'
  );
});

test('Finished both tracks lists shared questions answered differently and links to them', async ({page}) => {
  const [first, second] = SHARED;
  await seed(page, {[KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: ''}})}, '#builder');
  await expect(page.locator('#both-tracks')).toBeHidden();
  await seed(
    page,
    {
      [KEY.builder]: saved('builder', {
        [first.builder]: {choice: 'ALLOW', notes: ''},
        [second.builder]: {choice: 'ASK', notes: ''}
      }),
      [KEY.personal]: saved('personal', {
        [first.personal]: {choice: 'DENY', notes: ''},
        [second.personal]: {choice: 'ASK', notes: ''}
      })
    },
    '#builder'
  );
  const panel = page.locator('#both-tracks');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h3')).toHaveText('Finished both tracks?');
  await expect(panel).toContainText(
    'Give each agent the policy for the work it does. An agent that does both gets both files. When two answers differ, the stricter one applies.'
  );
  await expect(panel.locator('#both-tracks-summary')).toHaveText(
    '1 question appears in both tracks with a different answer or different notes. Check which limit applies to which work.'
  );
  const link = panel.locator('#both-tracks-list a');
  await expect(link).toHaveCount(1);
  await expect(link).toContainText(`${first.builder}. ${first.question}`);
  await expect(link).toContainText('Builder: ALLOW · Personal: DENY');
  await link.click();
  await expect(option(page, first.builder, 'ALLOW')).toBeFocused();
  await page.locator('#switch-track').click();
  await expect(panel.locator('#both-tracks-list a')).toHaveAttribute('href', `#q-${first.personal}`);
  // The same choice with different limits is listed too, with each track's notes.
  await seed(
    page,
    {
      [KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: 'Up to $20 on business tools'}}),
      [KEY.personal]: saved('personal', {[first.personal]: {choice: 'ALLOW', notes: 'Up to $5 on personal tools'}})
    },
    '#builder'
  );
  await expect(link).toHaveCount(1);
  await expect(link).toContainText(
    'Builder: ALLOW (Up to $20 on business tools) · Personal: ALLOW (Up to $5 on personal tools)'
  );
  // Letter case counts: different case is a different limit.
  await seed(
    page,
    {
      [KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: 'Only files under /Work/ClientA'}}),
      [KEY.personal]: saved('personal', {[first.personal]: {choice: 'ALLOW', notes: 'Only files under /work/clienta'}})
    },
    '#builder'
  );
  await expect(link).toHaveCount(1);
  await expect(link).toContainText(
    'Builder: ALLOW (Only files under /Work/ClientA) · Personal: ALLOW (Only files under /work/clienta)'
  );
  // With no differences (extra spaces aside), the panel never says the two policies agree.
  await seed(
    page,
    {
      [KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: 'Same  limit '}}),
      [KEY.personal]: saved('personal', {[first.personal]: {choice: 'ALLOW', notes: ' Same limit'}})
    },
    '#builder'
  );
  await expect(link).toHaveCount(0);
  await expect(panel.locator('#both-tracks-summary')).toHaveText(
    'Questions asked in both tracks have the same choice and notes in each. Each track also has questions of its own, so give each agent the policy for its work.'
  );
});

test('Builder coding tool settings: pick a tool, see only its files, rules, check, and coverage', async ({page}) => {
  // Every suggested answer, reviewed, so ALLOW answers can become allow rules. Seeding clears the remembered tool.
  const reviewedAnswers = Object.fromEntries(
    TRACKS.builder.questions.map(q => [q.id, {choice: q.recommendation, notes: ''}])
  );
  await seed(page, {[KEY.builder]: saved('builder', reviewedAnswers)}, '#builder');
  const block = page.locator('#tool-settings');
  await expect(block).toBeVisible();
  await expect(block.locator('h3')).toHaveText('Coding tool settings');
  await expect(block).toContainText('Tool settings are a strong guardrail, not a lock.');
  await expect(block).toContainText('Rules in a tool’s settings are not part of your agent’s instructions');
  const state = await storedJson(page, KEY.builder);
  const {coverage, snippets} = compileToolSettings(state, {date: ''});
  await expect(page.locator('#tool-coverage')).toHaveText(coverageText(coverage));
  await expect(page.locator('#tool-coverage')).toHaveText(
    'Tool settings back up about one in five of your Builder answers (22 of 100). The rest stay as instructions in your policy.'
  );
  await expect(page.locator('#tool-backed-list li')).toHaveCount(coverage.backed.length);
  await expect(page.locator('#tool-instructions-list li')).toHaveCount(coverage.instructionsOnly.length);
  // Partial rules are labeled and never listed as backed.
  const backedText = await page.locator('#tool-backed-list').textContent();
  for (const id of [29, 60, 80]) expect(backedText).not.toContain(`${id}. `);
  await page.locator('#tool-instructions-summary').click();
  await expect(page.locator('#tool-instructions-list li', {hasText: '29. Can it force-push'})).toContainText(
    'Partial: a rule in Claude Code, Codex, Gemini CLI covers only some forms of this action'
  );
  await expect(page.locator('#tool-instructions-list li', {hasText: '60. Can it write secrets'})).toContainText(
    'Partial'
  );
  await expect(block).not.toContainText(/\benforce/i);

  // Equal tiles, nothing chosen yet, no panel shown.
  const tiles = block.locator('.tool-choice');
  await expect(tiles).toHaveText(['Claude Code', 'Codex', 'Gemini CLI', 'Cursor', 'None']);
  const widths = await tiles.evaluateAll(nodes => nodes.map(n => Math.round(n.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);
  await expect(block.locator('.tool-tile:visible')).toHaveCount(0);
  await expect(page.locator('#tool-pick-hint')).toBeVisible();

  const expectOnly = async tool => {
    await expect(block.locator('.tool-tile:visible')).toHaveCount(1);
    await expect(block.locator(`.tool-tile[data-tool="${tool}"]`)).toBeVisible();
  };
  // Claude Code
  await tiles.filter({hasText: 'Claude Code'}).click();
  await expectOnly('claude');
  expect(await page.locator('#snippet-claude').textContent()).toBe(snippets.claude);
  await expect(page.locator('.tool-covers[data-covers="claude"]')).toHaveText(
    `In Claude Code, these settings back up ${coverage.byTool.claude.length} of your 100 answers. The rest rely on the instructions in your policy.`
  );
  await expect(page.locator('#tool-check')).toBeVisible();
  await expect(page.locator('#tool-check-command')).toHaveText('git push --force --dry-run');
  const claudeFile = await download(page, () => block.locator('.tool-download[data-file="claude"]').click());
  expect(claudeFile.name).toBe(TOOL_FILE_NAMES.claude);
  expect(claudeFile.text).toBe(compileToolSettings(state).files.claude);
  await expect(page.locator('#tool-status')).toHaveText(
    'Downloaded claude-code-settings.json. Save it as .claude/settings.json.'
  );
  await expect(block.locator('.tool-download[data-file="claude"]')).toHaveText(
    'Download claude-code-settings.json (new file)'
  );
  // Codex
  await tiles.filter({hasText: 'Codex'}).click();
  await expectOnly('codex');
  expect(await page.locator('#snippet-codexRules').textContent()).toBe(snippets.codexRules);
  expect(await page.locator('#snippet-codexConfig').textContent()).toBe(snippets.codexConfig);
  await expect(page.locator('#tool-codex-check')).toHaveText(
    'codex execpolicy check --pretty --rules .codex/rules/ai-agent-rules.rules -- git push --force --dry-run'
  );
  for (const key of ['codexRules', 'codexConfig']) {
    const file = await download(page, () => block.locator(`.tool-download[data-file="${key}"]`).click());
    expect(file.name).toBe(TOOL_FILE_NAMES[key]);
    const date = file.text.match(/ on (\d{4}-\d{2}-\d{2})\. /)[1];
    expect(file.text).toBe(compileToolSettings(state, {date}).files[key]);
  }
  // Gemini CLI
  await tiles.filter({hasText: 'Gemini CLI'}).click();
  await expectOnly('gemini');
  expect(await page.locator('#snippet-gemini').textContent()).toBe(snippets.gemini);
  await expect(page.locator('#tool-gemini-check')).toContainText('git push --force --dry-run');
  // Cursor is guidance only and has no coverage count or check.
  await tiles.filter({hasText: 'Cursor'}).click();
  await expectOnly('cursor');
  await expect(page.locator('#tool-cursor-guidance')).toHaveText(
    'Guidance only. Cursor applies these instructions only in Auto-review mode and does not treat them as security.'
  );
  await expect(page.locator('.tool-covers[data-covers="cursor"]')).toHaveText(
    'Cursor reads these rules as guidance, so they do not count as backing any answer.'
  );
  await expect(page.locator('#tool-check')).toBeHidden();
  expect(await page.locator('#snippet-cursor').textContent()).toBe(snippets.cursor);
  const cursorFile = await download(page, () => block.locator('.tool-download[data-file="cursor"]').click());
  expect(cursorFile.name).toBe(TOOL_FILE_NAMES.cursor);
  // None
  await tiles.filter({hasText: 'None'}).click();
  await expectOnly('none');
  // The choice is remembered in this browser.
  await tiles.filter({hasText: 'Codex'}).click();
  await page.reload();
  await expect(block.locator('input[value="codex"]')).toBeChecked();
  await expectOnly('codex');

  // A change to an answer changes the files right away; notes turn an ALLOW into ask.
  await page.locator('#q-25 textarea').fill('Only feature branches');
  await tiles.filter({hasText: 'Claude Code'}).click();
  await expect(page.locator('#snippet-claude')).toContainText('"Bash(git push *)"');
  const after = JSON.parse(
    (await download(page, () => block.locator('.tool-download[data-file="claude"]').click())).text
  );
  expect(after.permissions.ask).toContain('Bash(git push *)');
  expect(after.permissions.allow).not.toContain('Bash(git push *)');
  await option(page, 29, 'ASK').click();
  await option(page, 30, 'ASK').click();
  await option(page, 73, 'ASK').click();
  await option(page, 79, 'ASK').click();
  await expect(page.locator('#tool-check')).toBeHidden();
});

test('copying tool rules uses the clipboard', async ({browser}) => {
  const context = await browser.newContext({baseURL: BASE, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  await page.goto('/#builder');
  await page.locator('#tool-choices .tool-choice', {hasText: 'Gemini CLI'}).click();
  await page.locator('.tool-copy[data-snippet="gemini"]').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Rules copied. Replace everything in your rules file with them.'
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    compileToolSettings(emptyPolicy('builder'), {date: ''}).snippets.gemini
  );
  await page.locator('#tool-choices .tool-choice', {hasText: 'Claude Code'}).click();
  await page.locator('.tool-copy[data-snippet="claude"][data-part="add"]').click();
  await expect(page.locator('#tool-status')).toHaveText('Rules copied. Add them to your existing settings file.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    compileToolSettings(emptyPolicy('builder'), {date: ''}).snippets.claude
  );
  await context.close();
});

test('the Personal track has no tool settings, shows why, and shows rough token estimates', async ({page}) => {
  await page.goto('/#personal');
  await page.locator('#suggest').click();
  await expect(page.locator('#tool-settings')).toBeHidden();
  await expect(page.locator('#personal-tools-note')).toBeVisible();
  await expect(page.locator('#personal-tools-note')).toHaveText(
    'Your Personal rules stay as instructions in your policy, because everyday assistants do not accept permission files.'
  );
  await moreOptions(page);
  await expect(page.locator('#policy-guidance')).toHaveText(
    'Use the compact policy where an agent accepts only brief instructions.'
  );
  const state = await storedJson(page, KEY.personal);
  await expect(page.locator('#tokens-full')).toHaveText(tokenLabel(instructionText(state, 'personal')));
  await expect(page.locator('#tokens-compact')).toHaveText(
    tokenLabel(instructionText(state, 'personal', {compact: true}))
  );
  await expect(page.locator('#tokens-full')).toHaveText(/^Rough estimate: about [\d,]+ tokens\.$/);
  await expect(page.locator('#size-compact')).toHaveText(
    instructionText(state, 'personal', {compact: true}).length.toLocaleString('en-US')
  );
  await expect(page.locator('#export')).toContainText('Token counts are rough estimates');
  await expect(page.locator('#export')).not.toContainText(/every message|cost no tokens|zero tokens/);
  await page.locator('#switch-track').click();
  await expect(page.locator('#tool-settings')).toBeVisible();
  await expect(page.locator('#personal-tools-note')).toBeHidden();
  await expect(page.locator('#policy-guidance')).toHaveText(
    'For a coding agent, the recommended pair is the compact policy in its instructions plus your coding tool settings.'
  );
});

test('the export area has one main download with the backup beside it, and everything else under More options', async ({
  page
}) => {
  await page.goto('/#builder');
  const main = page.locator('.export-main button');
  await expect(main).toHaveText(['Download my agent policy', 'Save my answers to a file']);
  await expect(page.locator('#download-policy')).toHaveClass(/primary/);
  await expect(page.locator('#more-options-summary')).toHaveText('More options');
  for (const id of ['download-compact', 'copy-policy', 'copy-quick-start', 'size-compact'])
    await expect(page.locator('#' + id)).toBeHidden();
  await moreOptions(page);
  for (const id of ['download-compact', 'copy-policy', 'copy-quick-start', 'size-compact', 'tokens-compact'])
    await expect(page.locator('#' + id)).toBeVisible();
  await expect(page.locator('#more-options .filebutton')).toHaveText('Load my answers from a file');
});

test('Before you download lists what you allowed, your boundaries, unanswered questions, and answers to review, each linked to its question', async ({
  page
}) => {
  const answers = {
    1: {choice: 'ALLOW', notes: 'compare two options'},
    2: {choice: 'ALLOW', notes: ''},
    3: {choice: 'ASK', notes: '', suggested: true},
    4: {choice: 'DENY', notes: ''}
  };
  await seed(
    page,
    {[KEY.builder]: saved('builder', answers, {exceptions: 'Weekdays only.\nNever touch billing.'})},
    '#builder'
  );
  const panel = page.locator('#review-panel');
  await expect(panel.locator('h3')).toHaveText('Before you download');
  expect(await panel.boundingBox().then(b => b.y)).toBeLessThan(
    await page
      .locator('#download-policy')
      .boundingBox()
      .then(b => b.y)
  );
  await expect(page.locator('#review-allowed-summary')).toHaveText('What you allowed (2)');
  await expect(page.locator('#review-boundaries-summary')).toHaveText('Your additional boundaries (2)');
  await expect(page.locator('#review-unanswered-summary')).toHaveText('Unanswered (96)');
  await expect(page.locator('#review-review-summary')).toHaveText('Suggested or needing review (1)');
  await page.locator('#review-allowed-summary').click();
  const allowed = page.locator('#review-allowed-list a');
  await expect(allowed).toHaveCount(2);
  await expect(allowed.nth(0)).toContainText('1. Can it draft a purchase recommendation with a named cost?');
  await expect(allowed.nth(0)).toContainText('Notes: compare two options');
  await expect(allowed.nth(1)).toContainText('No notes');
  await page.locator('#review-boundaries-summary').click();
  await expect(page.locator('#review-boundaries-text')).toHaveText('Weekdays only.\nNever touch billing.');
  await page.locator('#review-review-summary').click();
  await expect(page.locator('#review-review-list a')).toContainText('ASK · Suggested, not reviewed');
  await page.locator('#review-review-list a').click();
  await expect(option(page, 3, 'ASK')).toBeFocused();
  await option(page, 3, 'ASK').click();
  await expect(page.locator('#review-review-summary')).toHaveText('Suggested or needing review (0)');
  await page.locator('#review-unanswered-summary').click();
  await page.locator('#review-unanswered-list a').first().click();
  await expect(option(page, 5, 'ALLOW')).toBeFocused();
});

test('an answer saved for different question wording keeps its choice and notes and shows Review this answer until reviewed', async ({
  page
}) => {
  // Answers saved without a fingerprint for the three reworded questions need review; others load silently.
  const stored = saved('personal', {
    30: {choice: 'DENY', notes: 'no group texts'},
    87: {choice: 'DENY', notes: ''},
    1: {choice: 'ALLOW', notes: ''}
  });
  await seed(page, {[KEY.personal]: stored}, '#personal');
  await expect(count(page)).toHaveText('3 of 100 answered · 1 reviewed');
  for (const id of [30, 87]) {
    await expect(page.locator(`#q-${id} .q-review`)).toBeVisible();
    await expect(page.locator(`#q-${id} .q-review`)).toHaveText('Review this answer');
  }
  await expect(page.locator('#q-1 .q-review')).toBeHidden();
  await expect(option(page, 30, 'DENY')).toBeChecked();
  await expect(page.locator('#q-30 textarea')).toHaveValue('no group texts');
  expect(await page.locator('#output').inputValue()).toContain(
    '\nReviewed: 1 of 100. Suggested and not reviewed: 0. Needs review: 2.\n'
  );
  await expect(page.locator('#review-review-summary')).toHaveText('Suggested or needing review (2)');
  // Choosing clears the mark; editing notes clears it too.
  await option(page, 30, 'DENY').click();
  await expect(page.locator('#q-30 .q-review')).toBeHidden();
  await page.locator('#q-87 textarea').fill('no contracts');
  await expect(page.locator('#q-87 .q-review')).toBeHidden();
  await expect(count(page)).toHaveText('3 of 100 answered · 3 reviewed');
  const after = await storedJson(page, KEY.personal);
  expect(after.answers['30'].qh).toBe(qh('personal', 30));
  expect(after.answers['87'].qh).toBe(qh('personal', 87));
  expect(after.answers['1'].qh).toBe(qh('personal', 1));
  await page.reload();
  await expect(page.locator('.q-review:visible')).toHaveCount(0);
});

test('overlap hints explain where two questions meet', async ({page}) => {
  await page.goto('/#personal');
  await expect(page.locator('#q-47 .q-overlap')).toHaveText(
    'Filling in a form never overrides your answer about sharing your home address (#39).'
  );
  await page.locator('#switch-track').click();
  await expect(page.locator('#q-25 .q-overlap')).toHaveCount(0);
  await expect(page.locator('#q-29 .q-overlap')).toHaveCount(0);
});

test('failed saves keep every edit in this visit, and the next successful save stores them all', async ({browser}) => {
  const context = await browser.newContext({baseURL: BASE});
  await context.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__blockWrites && key.startsWith('3fold-agent-policy-builder'))
        throw new DOMException('Full', 'QuotaExceededError');
      return real.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const existing = saved('builder', {10: {choice: 'DENY', notes: 'EXISTING'}});
  await seed(page, {[KEY.builder]: existing}, '#builder');
  await expect(option(page, 10, 'DENY')).toBeChecked();
  await page.evaluate(() => {
    window.__blockWrites = true;
  });
  await option(page, 1, 'ALLOW').click();
  await expect(page.locator('#storage-text')).toHaveText('Not saved: this browser is blocking storage.');
  await option(page, 2, 'DENY').click();
  // Both edits stay on the page and in the policy, and the saved answers are untouched.
  await expect(option(page, 1, 'ALLOW')).toBeChecked();
  await expect(option(page, 2, 'DENY')).toBeChecked();
  await expect(count(page)).toHaveText('3 of 100 answered · 3 reviewed');
  const output = await page.locator('#output').inputValue();
  expect(output).toContain(`1. ${TRACKS.builder.questions[0].question}\nDecision: ALLOW\n`);
  expect(output).toContain(`2. ${TRACKS.builder.questions[1].question}\nDecision: DENY\n`);
  expect(await page.evaluate(k => localStorage.getItem(k), KEY.builder)).toBe(existing);
  const backup = JSON.parse((await download(page, () => page.locator('#storage-backup').click())).text);
  expect([backup.answers['1'].choice, backup.answers['2'].choice, backup.answers['10'].notes]).toEqual([
    'ALLOW',
    'DENY',
    'EXISTING'
  ]);
  // Storage works again: the next edit saves all three.
  await page.evaluate(() => {
    window.__blockWrites = false;
  });
  await option(page, 3, 'ASK').click();
  await expect(page.locator('#storage-text')).toHaveText('Saved in this browser');
  const stored = await storedJson(page, KEY.builder);
  expect([
    stored.answers['1'].choice,
    stored.answers['2'].choice,
    stored.answers['3'].choice,
    stored.answers['10'].notes
  ]).toEqual(['ALLOW', 'DENY', 'ASK', 'EXISTING']);

  // A backup loaded while saves fail stays for this visit, and later edits build on it.
  await page.evaluate(() => {
    window.__blockWrites = true;
  });
  const incoming = saved('builder', {50: {choice: 'DENY', notes: 'IMPORTED'}});
  await page
    .locator('#load-backup')
    .setInputFiles({name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(incoming)});
  await page.locator('#import-yes').click();
  await expect(page.locator('#notice')).toContainText('Loaded your Builder track answers for this visit only.');
  await option(page, 51, 'ASK').click();
  await expect(option(page, 50, 'DENY')).toBeChecked();
  await expect(page.locator('#q-50 textarea')).toHaveValue('IMPORTED');
  await expect(option(page, 1, 'ALLOW')).not.toBeChecked();
  await page.evaluate(() => {
    window.__blockWrites = false;
  });
  await option(page, 52, 'DENY').click();
  const recovered = await storedJson(page, KEY.builder);
  expect([
    recovered.answers['50']?.notes,
    recovered.answers['51']?.choice,
    recovered.answers['52']?.choice,
    recovered.answers['1']
  ]).toEqual(['IMPORTED', 'ASK', 'DENY', undefined]);
  await context.close();
});

test("another tab's save keeps this tab's unsaved edits on top", async ({context}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__blockWrites && key.startsWith('3fold-agent-policy-builder'))
        throw new DOMException('Full', 'QuotaExceededError');
      return real.call(this, key, value);
    };
  });
  await a.goto('/#builder');
  await b.goto('/#builder');
  await a.evaluate(() => {
    window.__blockWrites = true;
  });
  await option(a, 1, 'DENY').click();
  await option(b, 2, 'ALLOW').click();
  await expect(option(a, 2, 'ALLOW')).toBeChecked();
  await expect(option(a, 1, 'DENY')).toBeChecked();
  await a.evaluate(() => {
    window.__blockWrites = false;
  });
  await option(b, 3, 'ASK').click();
  // The storage event lets tab A save its pending edit.
  await expect.poll(async () => (await storedJson(b, KEY.builder)).answers['1']?.choice).toBe('DENY');
  await expect(option(b, 1, 'DENY')).toBeChecked();
});

test('copy buttons use the clipboard, and the link falls back to selectable text', async ({browser}) => {
  const context = await browser.newContext({baseURL: BASE, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  await page.goto('/#builder');
  expect(await page.locator('#quick-start').evaluate(node => node.textContent)).toBe(QUICK_START);
  await moreOptions(page);
  await page.locator('#copy-quick-start').click();
  await expect(page.locator('#quick-start-status')).toHaveText(
    'Quick start copied. Send it with the policy file attached.'
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(QUICK_START);
  await page.locator('#copy-link').click();
  await expect(page.locator('#share-status')).toHaveText(`Link copied: ${WORKSHEET_URL}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(WORKSHEET_URL);
  await context.close();

  const noClipboard = await browser.newContext({baseURL: BASE});
  await noClipboard.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {get: () => undefined}));
  const fallback = await noClipboard.newPage();
  await fallback.goto('/#builder');
  await fallback.locator('#copy-link').click();
  const box = fallback.locator('#share-link-text');
  await expect(box).toBeVisible();
  await expect(box).toHaveValue(WORKSHEET_URL);
  await expect(box).toBeFocused();
  expect(await box.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([0, WORKSHEET_URL.length]);
  await moreOptions(fallback);
  await fallback.locator('#copy-quick-start').click();
  expect(await fallback.evaluate(() => String(window.getSelection()))).toBe(QUICK_START);
  await noClipboard.close();
});

test.describe('phone width', () => {
  test.use({viewport: {width: 390, height: 844}, hasTouch: true});

  test('no horizontal scroll and tap targets of at least 40px', async ({page}) => {
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const smallTargets = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            'button, .choice, .tool-choice, .group-tile, .filebutton, summary, .diff-list a, .toc a'
          )
        ]
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
          .filter(node => node.getBoundingClientRect().height < 40)
          .map(node => node.id || node.className || node.textContent.trim().slice(0, 40))
      );
    await page.goto('/');
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(await smallTargets()).toEqual([]);
    await seed(
      page,
      {
        [KEY.builder]: saved('builder', {[SHARED[0].builder]: {choice: 'ALLOW', notes: ''}}),
        [KEY.personal]: saved('personal', {[SHARED[0].personal]: {choice: 'DENY', notes: ''}})
      },
      '#builder'
    );
    for (const track of TRACK_IDS) {
      if (track === 'personal') await page.locator('#switch-track').click();
      await page.locator('#suggest').click();
      await page.locator('.group-tile').nth(1).locator('input').uncheck();
      await page.locator('#toc-toggle').click();
      await expect(page.locator('#both-tracks')).toBeVisible();
      await moreOptions(page);
      for (const summary of await page.locator('#review-panel summary').all()) await summary.click();
      if (track === 'builder') {
        // Rules copied earlier that differ from the current ones, so Claude Code and Cursor show the update blocks.
        await page.evaluate(() =>
          localStorage.setItem(
            '3fold-agent-policy-tool-rules-builder',
            JSON.stringify({
              claude: [{key: 'Bash(git push *)', decision: 'allow'}],
              cursor: [{key: 'npm test', decision: 'allow'}]
            })
          )
        );
        for (const summary of await page.locator('#tool-settings summary').all()) await summary.click();
        for (const tool of ['Claude Code', 'Codex', 'Gemini CLI', 'Cursor']) {
          await page.locator('#tool-choices .tool-choice', {hasText: tool}).click();
          if (tool === 'Claude Code' || tool === 'Cursor')
            await expect(page.locator('.tool-tile:visible [data-remove]')).toBeVisible();
          expect(await overflow()).toBeLessThanOrEqual(0);
          expect(await smallTargets()).toEqual([]);
        }
      }
      await page.locator('#copy-link').click();
      expect(await overflow()).toBeLessThanOrEqual(0);
      expect(await smallTargets()).toEqual([]);
      await page.locator('#toc-toggle').click();
    }
    const bar = await page.locator('#bar').boundingBox();
    expect(bar.width).toBeLessThanOrEqual(390);
  });
});

test('save status is per track: a save on one track never hides unsaved answers on the other', async ({browser}) => {
  const context = await browser.newContext({baseURL: BASE});
  await context.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__blockWrites && key.startsWith('3fold-agent-policy-builder'))
        throw new DOMException('Full', 'QuotaExceededError');
      return real.call(this, key, value);
    };
  });
  const page = await context.newPage();
  await seed(page, {[KEY.builder]: saved('builder', {10: {choice: 'DENY', notes: ''}})}, '#builder');
  await page.evaluate(() => {
    window.__blockWrites = true;
  });
  await option(page, 1, 'ALLOW').click();
  await option(page, 2, 'DENY').click();
  const notSaved = 'Not saved: this browser is blocking storage. Save my answers to a file.';
  await expect(page.locator('#storage-status')).toHaveText(notSaved);
  // Personal saves successfully.
  await page.locator('#switch-track').click();
  await expect(page.locator('#bar-track')).toHaveText('Personal');
  await option(page, 1, 'ASK').click();
  await expect(page.locator('#storage-text')).toHaveText('Saved in this browser');
  await expect(page.locator('#storage-backup')).toBeHidden();
  expect((await storedJson(page, KEY.personal)).answers['1'].choice).toBe('ASK');
  // Builder still shows its two unsaved answers.
  await page.locator('#switch-track').click();
  await expect(page.locator('#bar-track')).toHaveText('Builder');
  await expect(page.locator('#storage-status')).toHaveText(notSaved);
  await expect(page.locator('#storage-status')).toHaveClass(/is-bad/);
  await expect(page.locator('#storage-backup')).toBeVisible();
  const file = JSON.parse((await download(page, () => page.locator('#storage-backup').click())).text);
  expect([file.answers['1'].choice, file.answers['2'].choice, file.answers['10'].choice]).toEqual([
    'ALLOW',
    'DENY',
    'DENY'
  ]);
  // Once Builder saves again, its warning clears and every pending edit is stored.
  await page.evaluate(() => {
    window.__blockWrites = false;
  });
  await option(page, 3, 'ASK').click();
  await expect(page.locator('#storage-text')).toHaveText('Saved in this browser');
  const stored = await storedJson(page, KEY.builder);
  expect([stored.answers['1'].choice, stored.answers['2'].choice, stored.answers['3'].choice]).toEqual([
    'ALLOW',
    'DENY',
    'ASK'
  ]);
  await context.close();
});

test('an ALLOW that is not reviewed reads as ASK in the policy, the review panel, the agent check, and tool settings', async ({
  page
}) => {
  const q25 = TRACKS.builder.questions.find(q => q.id === 25);
  await seed(
    page,
    {[KEY.builder]: saved('builder', {25: {choice: 'ALLOW', notes: '', suggested: true, qh: qh('builder', 25)}})},
    '#builder'
  );
  await expect(option(page, 25, 'ALLOW')).toBeChecked();
  const output = await page.locator('#output').inputValue();
  expect(output).toContain(`25. ${q25.question}\nDecision: ASK (suggested ALLOW, not reviewed)\n`);
  expect(output).toContain('An answer I have not reviewed is never an ALLOW.');
  await expect(page.locator('#review-allowed-summary')).toHaveText('What you allowed (0)');
  await expect(page.locator('#review-review-summary')).toHaveText('Suggested or needing review (1)');
  await expect(page.locator('#test-list li')).toHaveCount(1);
  await expect(page.locator('#test-list li').first()).toHaveAttribute('data-choice', 'ASK');
  await page.locator('#tool-choices .tool-choice', {hasText: 'Claude Code'}).click();
  let rules = JSON.parse(await page.locator('#snippet-claude').textContent());
  expect(rules.permissions.ask).toContain('Bash(git push *)');
  expect(rules.permissions.allow).not.toContain('Bash(git push *)');
  // Reviewing it makes it an ALLOW everywhere.
  await option(page, 25, 'ALLOW').click();
  expect(await page.locator('#output').inputValue()).toContain(`25. ${q25.question}\nDecision: ALLOW\n`);
  await expect(page.locator('#review-allowed-summary')).toHaveText('What you allowed (1)');
  await expect(page.locator('#test-list li').first()).toHaveAttribute('data-choice', 'ALLOW');
  rules = JSON.parse(await page.locator('#snippet-claude').textContent());
  expect(rules.permissions.allow).toContain('Bash(git push *)');
});

test('updating tool files: Claude Code shows rules to remove and add, Codex and Gemini CLI replace the whole file, and the check uses a changed rule', async ({
  browser
}) => {
  const context = await browser.newContext({baseURL: BASE, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  await seed(
    page,
    {
      [KEY.builder]: saved('builder', {
        25: {choice: 'ASK', notes: '', qh: qh('builder', 25)},
        29: {choice: 'DENY', notes: '', qh: qh('builder', 29)}
      })
    },
    '#builder'
  );
  const block = page.locator('#tool-settings');
  await block.locator('.tool-choice', {hasText: 'Claude Code'}).click();
  const claude = block.locator('.tool-tile[data-tool="claude"]');
  // First time: only the rules to add, the full file for a new file, and a way to record it as installed.
  await expect(claude.locator('[data-remove="claude"]')).toBeHidden();
  await expect(claude.locator('[data-update-lead="claude"]')).toContainText('Already have that file?');
  await expect(claude).toContainText('Add these rules');
  await expect(claude.locator('.tool-download')).toHaveText('Download claude-code-settings.json (new file)');
  await expect(claude.locator('.tool-confirm')).toHaveText("I've added these rules");
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  // Downloading the file is not a confirmation: nothing is recorded, so the button to record it stays.
  await download(page, () => claude.locator('.tool-download').click());
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  await expect(claude.locator('.tool-confirm')).toBeVisible();
  // Pressing "I've added these rules" records the file as matching, for the first time.
  await claude.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as added to your file.');
  await expect(claude.locator('[data-same="claude"]')).toBeVisible();
  await expect(claude.locator('.tool-confirm')).toBeHidden();
  // A changed answer: remove the old rule and add the new one.
  await option(page, 25, 'ALLOW').click();
  await expect(claude.locator('[data-update-lead="claude"]')).toHaveText(
    'To update, remove these rules from your file and add these.'
  );
  await expect(claude.locator('[data-remove="claude"]')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  await expect(claude.locator('.tool-confirm')).toHaveText('My file is updated');
  expect(JSON.parse(await page.locator('#remove-claude').textContent())).toEqual({
    permissions: {ask: ['Bash(git push *)']}
  });
  expect(JSON.parse(await page.locator('#snippet-claude').textContent())).toEqual({
    permissions: {allow: ['Bash(git push *)']}
  });
  await expect(page.locator('#tool-claude-check')).toHaveText(
    'Run /permissions in Claude Code. Your allow rules there include Bash(git push *).'
  );
  // Copying the rules to remove never confirms the update, so a reload still shows both blocks.
  await claude.locator('.tool-copy[data-part="remove"]').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Rules to remove copied. Find and delete them in your settings file.'
  );
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual({
    permissions: {ask: ['Bash(git push *)']}
  });
  await page.reload();
  await expect(claude.locator('[data-remove="claude"]')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  expect(JSON.parse(await page.locator('#remove-claude').textContent())).toEqual({
    permissions: {ask: ['Bash(git push *)']}
  });
  expect(JSON.parse(await page.locator('#snippet-claude').textContent())).toEqual({
    permissions: {allow: ['Bash(git push *)']}
  });
  // Copying the rules to add does not confirm it either.
  await claude.locator('.tool-copy[data-part="add"]').click();
  await expect(page.locator('#tool-status')).toHaveText('Rules to add copied. Add them to your settings file.');
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual({
    permissions: {allow: ['Bash(git push *)']}
  });
  await page.reload();
  await expect(claude.locator('[data-remove="claude"]')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  // A clipboard copy that fails does not confirm the update either.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  });
  await claude.locator('.tool-copy[data-part="add"]').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Automatic copy is unavailable here. The rules are selected; copy them with your keyboard.'
  );
  await page.reload();
  await expect(claude.locator('[data-remove="claude"]')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  // Pressing "My file is updated" hides both blocks and records the current rules as installed.
  await claude.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as updated in your file.');
  await expect(claude.locator('[data-remove="claude"]')).toBeHidden();
  await expect(claude.locator('[data-same="claude"]')).toBeVisible();
  await expect(claude.locator('.tool-confirm')).toBeHidden();
  // A later answer change compares against that same recorded set and shows the new difference.
  await option(page, 25, 'ASK').click();
  await expect(claude.locator('[data-remove="claude"]')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  await expect(claude.locator('.tool-confirm')).toHaveText('My file is updated');
  expect(JSON.parse(await page.locator('#remove-claude').textContent())).toEqual({
    permissions: {allow: ['Bash(git push *)']}
  });
  expect(JSON.parse(await page.locator('#snippet-claude').textContent())).toEqual({
    permissions: {ask: ['Bash(git push *)']}
  });
  // Recording the update again leaves the file matching, with nothing pending.
  await claude.locator('.tool-confirm').click();
  await expect(claude.locator('[data-remove="claude"]')).toBeHidden();
  await expect(claude.locator('[data-same="claude"]')).toBeVisible();
  // Restore #25 to ALLOW: the Codex check below relies on it being reviewed ALLOW when Codex's file is downloaded.
  await option(page, 25, 'ALLOW').click();

  // Codex: the rules file is always replaced whole. Downloading or copying it is not a confirmation, only pressing
  // "I've replaced the file" is, and the check step then compares against that confirmed record.
  await block.locator('.tool-choice', {hasText: 'Codex'}).click();
  const codex = block.locator('.tool-tile[data-tool="codex"]');
  await expect(codex).toContainText(
    'Replace the whole file with the new download or with these rules. Never add them to the end of the file'
  );
  await expect(codex).not.toContainText('Add these rules to it');
  await expect(codex.locator('.tool-confirm')).toHaveText("I've replaced the file");
  const rulesFile = await download(page, () => codex.locator('.tool-download[data-file="codexRules"]').click());
  expect(rulesFile.text).toContain(
    '# To update, replace this whole file with a new download. Never append new rules to it.'
  );
  await expect(page.locator('#tool-status')).toHaveText(
    'Downloaded codex-ai-agent-rules.rules. Save it as .codex/rules/ai-agent-rules.rules, replacing the whole file if you already have one.'
  );
  // Downloading never records it: the confirm button stays, and the check still falls back to the default.
  await expect(codex.locator('.tool-confirm')).toBeVisible();
  await expect(page.locator('#tool-codex-check')).toHaveText(
    'codex execpolicy check --pretty --rules .codex/rules/ai-agent-rules.rules -- git push --force --dry-run'
  );
  // A clipboard copy that fails does not record it either.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  });
  await codex.locator('.tool-copy[data-snippet="codexRules"][data-part="add"]').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Automatic copy is unavailable here. The rules are selected; copy them with your keyboard.'
  );
  await expect(codex.locator('.tool-confirm')).toBeVisible();
  // Pressing "I've replaced the file" records the current rules as installed.
  await codex.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as replaced.');
  await expect(codex.locator('.tool-confirm')).toBeHidden();
  // A later answer change compares against that confirmed record, and the check uses the rule that changed.
  await option(page, 25, 'ASK').click();
  await expect(codex.locator('.tool-confirm')).toBeVisible();
  await expect(page.locator('#tool-codex-check')).toHaveText(
    'codex execpolicy check --pretty --rules .codex/rules/ai-agent-rules.rules -- git push'
  );
  await expect(codex).toContainText('read the decision it prints: it should be prompt.');
  await codex.locator('.tool-confirm').click();
  await expect(codex.locator('.tool-confirm')).toBeHidden();
  await option(page, 25, 'ALLOW').click();

  // Gemini CLI works the same way: the whole file is replaced, and it needs its own confirmation too.
  await block.locator('.tool-choice', {hasText: 'Gemini CLI'}).click();
  const gemini = block.locator('.tool-tile[data-tool="gemini"]');
  await expect(gemini).toContainText('Replace the whole file with the new download or with these rules.');
  await expect(gemini.locator('.tool-confirm')).toHaveText("I've replaced the file");
  await download(page, () => gemini.locator('.tool-download').click());
  await expect(gemini.locator('.tool-confirm')).toBeVisible();
  await gemini.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as replaced.');
  await expect(gemini.locator('.tool-confirm')).toBeHidden();
  // The compact policy sits beside the chosen tool's file.
  await expect(page.locator('#tool-compact')).toBeVisible();
  await expect(page.locator('#tool-compact p')).toHaveText(
    'Give your agent this compact policy together with the tool file.'
  );
  await expect(page.locator('#tool-download-compact')).toHaveText('Download compact policy');
  const compact = await download(page, () => page.locator('#tool-download-compact').click());
  expect(compact.name).toBe('my-agent-policy-builder-compact.md');
  expect(compact.text).toBe(instructionText(await storedJson(page, KEY.builder), 'builder', {compact: true}));
  await block.locator('.tool-choice', {hasText: 'None'}).click();
  await expect(page.locator('#tool-compact')).toBeHidden();
  await expect(page.locator('.export-main button')).toHaveText([
    'Download my agent policy',
    'Save my answers to a file'
  ]);
  await context.close();
});

test('Cursor updates work the same way: first-time confirm, then remove/add blocks until confirmed again', async ({
  page
}) => {
  await seed(
    page,
    {[KEY.builder]: saved('builder', {24: {choice: 'ALLOW', notes: '', qh: qh('builder', 24)}})},
    '#builder'
  );
  await page.locator('#tool-choices .tool-choice', {hasText: 'Cursor'}).click();
  const cursor = page.locator('.tool-tile[data-tool="cursor"]');
  await expect(cursor.locator('[data-remove="cursor"]')).toBeHidden();
  await expect(cursor.locator('.tool-confirm')).toHaveText("I've added these rules");
  await cursor.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as added to your file.');
  await expect(cursor.locator('[data-same="cursor"]')).toBeVisible();
  await expect(cursor.locator('.tool-confirm')).toBeHidden();
  // Copying never confirms the update for Cursor either.
  await cursor.locator('.tool-copy[data-part="add"]').click();
  await option(page, 24, 'ASK').click();
  await expect(cursor.locator('[data-same="cursor"]')).toBeHidden();
  await expect(cursor.locator('.tool-confirm')).toHaveText('My file is updated');
  await page.reload();
  await expect(cursor.locator('.tool-confirm')).toHaveText('My file is updated');
  await cursor.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as updated in your file.');
  await expect(cursor.locator('[data-same="cursor"]')).toBeVisible();
});

test('when this browser cannot save it, confirming a tool file reports the failure and keeps the pending update visible', async ({
  browser
}) => {
  const context = await browser.newContext({baseURL: BASE});
  await context.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__blockWrites && key.startsWith('3fold-agent-policy-tool-rules-'))
        throw new DOMException('Full', 'QuotaExceededError');
      return real.call(this, key, value);
    };
  });
  const page = await context.newPage();
  await seed(
    page,
    {[KEY.builder]: saved('builder', {24: {choice: 'ALLOW', notes: '', qh: qh('builder', 24)}})},
    '#builder'
  );
  await page.locator('#tool-choices .tool-choice', {hasText: 'Claude Code'}).click();
  const claude = page.locator('.tool-tile[data-tool="claude"]');
  await page.evaluate(() => {
    window.__blockWrites = true;
  });
  // The confirm button never reports success, and never hides the rules to add, when the record could not be saved.
  await claude.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Your browser could not save this. Save my answers to a file to keep your work.'
  );
  await expect(claude.locator('.tool-confirm')).toBeVisible();
  await expect(claude.locator('[data-same="claude"]')).toBeHidden();
  // Storage works again: the same button now records it and reports success.
  await page.evaluate(() => {
    window.__blockWrites = false;
  });
  await claude.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as added to your file.');
  await expect(claude.locator('[data-same="claude"]')).toBeVisible();
  await expect(claude.locator('.tool-confirm')).toBeHidden();
  // The same is true for Codex, which only advances its own record when the confirmation is pressed.
  await page.locator('#tool-choices .tool-choice', {hasText: 'Codex'}).click();
  const codex = page.locator('.tool-tile[data-tool="codex"]');
  await page.evaluate(() => {
    window.__blockWrites = true;
  });
  await codex.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText(
    'Your browser could not save this. Save my answers to a file to keep your work.'
  );
  await expect(codex.locator('.tool-confirm')).toBeVisible();
  await page.evaluate(() => {
    window.__blockWrites = false;
  });
  await codex.locator('.tool-confirm').click();
  await expect(page.locator('#tool-status')).toHaveText('Marked as replaced.');
  await expect(codex.locator('.tool-confirm')).toBeHidden();
  await context.close();
});

test('Load my answers from a file also sits beside Start from suggested answers, with its messages there', async ({
  page
}) => {
  await page.goto('/#personal');
  await expect(page.locator('.suggest-row .filebutton')).toHaveText('Load my answers from a file');
  await expect(page.locator('#suggest-deny')).toHaveText('A suggested DENY stays a firm no until you change it.');
  await page.locator('#load-backup-top').setInputFiles({
    name: 'a.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved('personal', {1: {choice: 'DENY', notes: 'TOP_LOAD'}}))
  });
  await expect(page.locator('#suggest-status')).toHaveText('Loaded your Personal track answers.');
  await expect(option(page, 1, 'DENY')).toBeChecked();
  await expect(page.locator('#q-1 textarea')).toHaveValue('TOP_LOAD');
  // With answers present, the question to replace them appears beside it.
  await page.locator('#load-backup-top').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved('personal', {1: {choice: 'ASK', notes: ''}}))
  });
  const confirm = page.locator('#import-confirm');
  await expect(confirm).toBeVisible();
  expect(await confirm.evaluate(node => node.parentElement.id)).toBe('import-slot-top');
  await confirm.locator('#import-no').click();
  await expect(page.locator('#suggest-status')).toHaveText('Nothing loaded. Your answers are unchanged.');
  await expect(option(page, 1, 'DENY')).toBeChecked();
  // The same action in More options asks there.
  await moreOptions(page);
  await page.locator('#load-backup').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved('personal', {1: {choice: 'ASK', notes: ''}}))
  });
  await expect(confirm).toBeVisible();
  expect(await confirm.evaluate(node => node.parentElement.id)).toBe('import-slot-bottom');
  await page.locator('#import-yes').click();
  await expect(page.locator('#notice')).toHaveText('Loaded your Personal track answers.');
  await expect(option(page, 1, 'ASK')).toBeChecked();
});

test('each Builder question shows one quiet tool tag from the rule mapping, Personal shows none, and the boundaries line is Builder only', async ({
  page
}) => {
  await page.goto('/#builder');
  await expect(page.locator('#questions .q-tool-tag')).toHaveCount(100);
  const texts = await page
    .locator('#questions fieldset.q')
    .evaluateAll(nodes => nodes.map(n => [...n.querySelectorAll('.q-tool-tag')].map(t => t.textContent)));
  expect(texts).toEqual(TRACKS.builder.questions.map(q => [TOOL_TAG_TEXT[toolTag('builder', q.id)]]));
  expect(await page.locator('#q-25').evaluate(n => [...n.children].slice(0, 3).map(c => c.className))).toEqual([
    'q-head',
    'q-tool-tag',
    'q-meta'
  ]);
  await expect(page.locator('#q-25 .q-tool-tag')).toHaveText('Your coding tool has a setting for this');
  await expect(page.locator('#q-29 .q-tool-tag')).toHaveText('Your coding tool has a setting for some forms of this');
  await expect(page.locator('#q-1 .q-tool-tag')).toHaveText('Your agent has to follow this on its own');
  // One equal style for all three, squared corners, readable in both themes.
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    const styles = await page.locator('#questions .q-tool-tag').evaluateAll(nodes => [
      ...new Set(
        nodes.map(n => {
          const c = getComputedStyle(n);
          return JSON.stringify([c.fontSize, c.color, c.backgroundColor, c.borderTopLeftRadius, c.borderTopColor]);
        })
      )
    ]);
    expect(styles.length).toBe(1);
    const [, color, background, radius] = JSON.parse(styles[0]);
    expect(radius).toBe('4px');
    const rgb = text =>
      text
        .match(/\d+(\.\d+)?/g)
        .slice(0, 3)
        .map(Number);
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map(v => v / 255)
        .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(rgb(color)), lum(rgb(background))].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(page.locator('#exceptions-tools-note')).toBeVisible();
  await expect(page.locator('#exceptions-tools-note')).toHaveText(
    'Coding tool settings cannot store limits, so any text here turns every allow in them into ask. Your policy keeps your ALLOW answers and these limits.'
  );
  await page.locator('#switch-track').click();
  await expect(page.locator('#questions fieldset.q')).toHaveCount(100);
  await expect(page.locator('#questions .q-tool-tag')).toHaveCount(0);
  await expect(page.locator('#exceptions-tools-note')).toBeHidden();
});

test('where to put your policy lists chat assistants on both tracks and coding agents on Builder only', async ({
  page
}) => {
  await page.goto('/#builder');
  const where = page.locator('#where-to');
  await where.locator('summary').click();
  for (const name of [
    'ChatGPT:',
    'Claude:',
    'Gemini:',
    'Grok:',
    'Muse:',
    'Claude Code:',
    'Codex:',
    'Gemini CLI:',
    'Cursor:'
  ])
    await expect(where).toContainText(name);
  await expect(page.locator('#where-coding')).toBeVisible();
  await page.locator('#switch-track').click();
  await expect(page).toHaveURL(/#personal$/);
  await expect(page.locator('#where-coding')).toBeHidden();
  await expect(page.locator('#where-to')).toContainText('ChatGPT:');
});
