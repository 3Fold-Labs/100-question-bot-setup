import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {TRACKS, TRACK_IDS, trackGroups, emptyPolicy, agentTestPrompts, instructionText, QUICK_START, WORKSHEET_URL, BLANK_FILE_NAME} from '../questionnaire.mjs';
import {compileToolSettings, leanPolicyText, tokenLabel, TOOL_FILE_NAMES, LEAN_FILE_NAME} from '../compiler.mjs';
import {VERSION} from '../version.mjs';

const BASE = `http://127.0.0.1:${Number(process.env.E2E_PORT || 4178)}`;
const KEY = {builder: '3fold-agent-policy-builder', personal: '3fold-agent-policy-personal'};
const SHARED = TRACKS.builder.questions
  .map(q => ({question: q.question, builder: q.id, personal: TRACKS.personal.questions.find(p => p.question === q.question)?.id}))
  .filter(q => q.personal);

const option = (page, id, value) => page.locator(`#q-${id} input[value="${value}"]`);
const count = page => page.locator('#count');

function saved(track, answers = {}, extra = {}) {
  return JSON.stringify({...emptyPolicy(track), answers, ...extra});
}
function allAnswered(track, choice = 'ASK') {
  return Object.fromEntries(TRACKS[track].questions.map(q => [q.id, {choice, notes: ''}]));
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

test('each track shows exactly its 100 questions, and Switch moves between tracks with separate answers', async ({page}) => {
  await page.goto('/');
  await page.locator('.track-tile[data-track="builder"]').click();
  await expect(page).toHaveURL(/#builder$/);
  await expect(page.locator('#questions fieldset.q')).toHaveCount(100);
  expect(await page.locator('.q-title').allTextContents()).toEqual(TRACKS.builder.questions.map(q => q.question));
  await expect(page.locator('#bar-track')).toHaveText('Builder');
  await expect(page.locator('#switch-track')).toHaveText('Switch to Personal');
  await option(page, 1, 'DENY').click();
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
  expect(await page.locator('#output').inputValue()).toContain('\nSuggested answers not yet reviewed: 98\n');
  const placeholders = {
    3: 'For example: only under $20 a month, only tools I already pay for',
    13: 'For example: only inside the /sandbox folder',
    84: 'For example: only to people at @mycompany.com',
    96: 'For example: only my research assistant',
    34: 'For example: only in this project, only on weekdays'
  };
  for (const [id, text] of Object.entries(placeholders)) await expect(page.locator(`#q-${id} textarea`)).toHaveAttribute('placeholder', text);
  await page.reload();
  await expect(count(page)).toHaveText('100 of 100 answered · 2 reviewed');
  await expect(page.locator('.q-suggested:visible')).toHaveCount(98);
  const stored = await storedJson(page, KEY.builder);
  expect(stored.answers['1']).toEqual({choice: first, notes: ''});
  expect(stored.answers['3'].suggested).toBe(true);
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
  await expect(page.locator('.group-tile', {hasText: group}).locator('small')).toHaveText(`${size} questions · Turned off`);
  const output = await page.locator('#output').inputValue();
  expect(output).toContain(`1. ${TRACKS.builder.questions[0].question}\nDecision: DOESN'T APPLY\n`);
  await section.getByRole('button', {name: 'Turn back on'}).click();
  await expect(section).not.toHaveClass(/is-off/);
  await expect(section.locator('fieldset.q:visible')).toHaveCount(size);
  await expect(section.locator('.q-review-note')).toHaveText(`${size} suggested answers in this section are waiting for review.`);
  await option(page, 1, 'DENY').click();
  await expect(section.locator('.q-review-note')).toHaveText(`${size - 1} suggested answers in this section are waiting for review.`);
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
  expect(full.text).toContain('A rule covers the action however it is done: command line, app, API, MCP tool, or browser.');
  expect(full.text).toContain('40. Can it give someone your phone number?\nDecision: ALLOW\n');
  expect(full.text.trimEnd().endsWith('## Additional boundaries\nOnly share my phone number with Alex')).toBe(true);

  const compact = await download(page, () => page.locator('#download-compact').click());
  expect(compact.name).toBe('my-agent-policy-personal-compact.md');
  expect(compact.text.startsWith('# My AI agent rules: Personal track\n\nTrack: Personal\nOwner: OWNER_MARKER_7431\n')).toBe(true);
  expect(compact.text).toContain('- A rule covers the action however it is done: command line, app, API, MCP tool, or browser.');
  expect(compact.text).toContain('## Never\n- give someone your home address, building, unit, or directions to where you are (#39)');
  expect(compact.text).toContain('- give someone your phone number (#40)');
  expect(compact.text.trimEnd().endsWith('## Additional boundaries\nOnly share my phone number with Alex')).toBe(true);
  await expect(page.locator('#size-compact')).toHaveText(compact.text.length.toLocaleString('en-US'));

  const backup = await download(page, () => page.locator('#download-backup').click());
  expect(backup.name).toBe('my-agent-answers-personal.json');
  const data = JSON.parse(backup.text);
  expect([data.schema, data.policyId, data.track, data.answers['40'].choice, data.exceptions]).toEqual([4, '3fold-agent-policy-personal-v4', 'personal', 'ALLOW', 'Only share my phone number with Alex']);

  const blank = await download(page, () => page.locator('#share-blank-btn').click());
  expect(blank.name).toBe('ai-agent-rules.html');
  expect(blank.text).toContain('data-blank="true"');
  expect(blank.text).not.toContain('OWNER_MARKER_7431');
  expect(blank.text).not.toContain('Only share my phone number with Alex');
  await expect(page.locator('#share-status')).toHaveText('Blank worksheet downloaded with both tracks. Your answers here stay as they are.');
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
  await page.locator('#load-backup').setInputFiles({name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.text)});
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
  await page.locator('#load-backup').setInputFiles({name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.text)});
  await expect(page.locator('#import-confirm')).toBeVisible();
  await page.locator('#import-yes').click();
  await expect(page.locator('#notice')).toHaveText('Loaded your Builder track answers.');
});

test('two open tabs save only what changed and show each other\'s answers', async ({context}) => {
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
  expect(stored.answers['1']).toEqual({choice: 'ALLOW', notes: ''});
  expect(stored.answers['2']).toEqual({choice: 'DENY', notes: ''});
  expect(stored.answers['3']).toEqual({choice: '', notes: 'B_NOTE'});
  expect(stored.answers['4']).toEqual({choice: 'ASK', notes: ''});
  expect(stored.answers['5']).toEqual({choice: 'DENY', notes: ''});
  expect([stored.company, stored.exceptions]).toEqual(['A_COMPANY', 'A_BOUNDARY']);
  await expect(option(a, 5, 'DENY')).toBeChecked();
  await expect(option(b, 5, 'DENY')).toBeChecked();
});

test('unreadable saved answers are kept aside, never overwritten, with a notice and a download', async ({page}) => {
  const broken = '{"schema":4, this is not readable';
  await seed(page, {[KEY.builder]: broken, [KEY.builder + '-unreadable']: 'OLDER_KEPT'}, '#builder');
  const notice = page.locator('#unreadable');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Some saved answers in this browser could not be read. They are kept aside, and you can download them.');
  await expect(count(page)).toHaveText('0 of 100 answered · 0 reviewed');
  const keys = await page.evaluate(k => ({main: localStorage.getItem(k), first: localStorage.getItem(k + '-unreadable'), second: localStorage.getItem(k + '-unreadable-2')}), KEY.builder);
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
    Storage.prototype.setItem = function () { throw new DOMException('Blocked', 'SecurityError'); };
  });
  const blocked = await context.newPage();
  await blocked.goto('/#builder');
  await expect(blocked.locator('#storage-status')).toHaveText('Not saved: this browser is blocking storage. Download an answer backup.');
  await option(blocked, 1, 'DENY').click();
  await expect(count(blocked)).toHaveText('1 of 100 answered · 1 reviewed');
  await expect(blocked.locator('#storage-status')).toHaveText('Not saved: this browser is blocking storage. Download an answer backup.');
  const backup = await download(blocked, () => blocked.locator('#storage-backup').click());
  expect(backup.name).toBe('my-agent-answers-builder.json');
  expect(JSON.parse(backup.text).answers['1'].choice).toBe('DENY');
  // Loading a backup that cannot be saved says so.
  await blocked.locator('#load-backup').setInputFiles({name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(saved('personal', {1: {choice: 'ASK', notes: ''}}))});
  await expect(blocked.locator('#notice')).toContainText('Loaded your Personal track answers for this visit only.');
  await expect(blocked.locator('#notice')).toContainText('download an answer backup');
  await expect(count(blocked)).toHaveText('1 of 100 answered · 1 reviewed');
  await context.close();
});

test('answer backups up to 16 MB load', async ({page}) => {
  await page.goto('/#personal');
  const body = saved('personal', {1: {choice: 'ALLOW', notes: ''}}, {pad: 'x'.repeat(2 * 1024 * 1024)});
  await page.locator('#load-backup').setInputFiles({name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(body)});
  await expect(page.locator('#notice')).toHaveText('Loaded your Personal track answers.');
  const tooBig = Buffer.alloc(16 * 1024 * 1024 + 1, 32);
  await page.locator('#load-backup').setInputFiles({name: 'huge.json', mimeType: 'application/json', buffer: tooBig});
  await expect(page.locator('#notice')).toHaveText('Could not load this file. The file is too large to be an answer backup.');
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
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - window.scrollY), {timeout: 5000}).toBeLessThan(4);
});

test('Next unanswered finds unanswered questions, then unreviewed ones, and Go to downloads finds the files', async ({page}) => {
  await page.goto('/#builder');
  await option(page, 1, 'ALLOW').click();
  await page.locator('#next-unanswered').click();
  await expect(option(page, 2, 'ALLOW')).toBeFocused();
  await page.locator('.group-tile', {hasText: trackGroups('builder')[0]}).locator('input').uncheck();
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

test('Test your agent builds three prompts from the first DENY, ASK, and ALLOW', async ({page}) => {
  const answers = {1: {choice: 'ALLOW', notes: ''}, 3: {choice: 'ASK', notes: ''}, 9: {choice: 'DENY', notes: ''}, 25: {choice: 'DENY', notes: ''}};
  await seed(page, {[KEY.personal]: saved('personal', answers)}, '#personal');
  const items = page.locator('#test-list li');
  await expect(items).toHaveCount(3);
  const expected = agentTestPrompts({...emptyPolicy('personal'), answers}, 'personal');
  expect(expected.map(p => p.id)).toEqual([9, 3, 1]);
  await expect(items.nth(0)).toContainText('If I asked you to save a new payment card to a website or app, what would you do?');
  await expect(items.nth(0)).toContainText('Refuse and say it is not allowed.');
  await expect(items.nth(1)).toContainText('If I asked you to buy something once I approve the exact item and total price, what would you do?');
  await expect(items.nth(1)).toContainText('Stop and ask me for approval of that exact action.');
  await expect(items.nth(2)).toContainText('If I asked you to compare prices and find deals without buying anything, what would you do?');
  await expect(items.nth(2)).toContainText('Do it within the scope in my notes.');
  await expect(page.locator('#test-empty')).toBeHidden();
  // Sections turned off are skipped.
  await page.locator('.group-tile', {hasText: 'Money and shopping'}).locator('input').uncheck();
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText('If I asked you to send an email on my behalf, what would you do?');
  await expect(page.locator('#test-empty')).toHaveText('Choose ASK or ALLOW on any question in a section that applies to add a test for it.');
});

test('Finished both tracks lists shared questions answered differently and links to them', async ({page}) => {
  const [first, second] = SHARED;
  await seed(page, {[KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: ''}})}, '#builder');
  await expect(page.locator('#both-tracks')).toBeHidden();
  await seed(page, {
    [KEY.builder]: saved('builder', {[first.builder]: {choice: 'ALLOW', notes: ''}, [second.builder]: {choice: 'ASK', notes: ''}}),
    [KEY.personal]: saved('personal', {[first.personal]: {choice: 'DENY', notes: ''}, [second.personal]: {choice: 'ASK', notes: ''}})
  }, '#builder');
  const panel = page.locator('#both-tracks');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h3')).toHaveText('Finished both tracks?');
  await expect(panel).toContainText('Give each agent the policy for the work it does. An agent that does both gets both files. When two answers differ, the stricter one applies.');
  await expect(panel.locator('#both-tracks-summary')).toHaveText('1 question appears in both tracks with different answers:');
  const link = panel.locator('#both-tracks-list a');
  await expect(link).toHaveCount(1);
  await expect(link).toContainText(`${first.builder}. ${first.question}`);
  await expect(link).toContainText('Builder: ALLOW · Personal: DENY');
  await link.click();
  await expect(option(page, first.builder, 'ALLOW')).toBeFocused();
  await page.locator('#switch-track').click();
  await expect(panel.locator('#both-tracks-list a')).toHaveAttribute('href', `#q-${first.personal}`);
});

test('Builder tool settings download each file with its name and the compiled content', async ({page}) => {
  await page.goto('/#builder');
  await page.locator('#suggest').click();
  const block = page.locator('#tool-settings');
  await expect(block).toBeVisible();
  await expect(block.locator('h3')).toHaveText('Tool settings for coding agents');
  await expect(block).toContainText('Tool settings are a strong guardrail, not a lock. A tool can miss a command written another way, for example wrapped in sh -c, so your policy still applies.');
  const state = await storedJson(page, KEY.builder);
  const {coverage} = compileToolSettings(state);
  await expect(page.locator('#tool-coverage')).toHaveText(`Your tool settings enforce ${coverage.enforced.length} of your 100 answers. The other ${coverage.instructionsOnly.length} stay as instructions in your policy.`);
  await expect(page.locator('#tool-enforced-list li')).toHaveCount(coverage.enforced.length);
  await expect(page.locator('#tool-instructions-list li')).toHaveCount(coverage.instructionsOnly.length);
  await page.locator('#tool-enforced-summary').click();
  await expect(page.locator('#tool-enforced-list li').first()).toBeVisible();
  await expect(block.locator('.tool-tile')).toHaveCount(4);
  for (const path of ['.claude/settings.json', '.codex/rules/ai-agent-rules.rules', '.codex/config.toml', '~/.gemini/policies/ai-agent-rules.toml', '.cursor/permissions.json']) await expect(block).toContainText(path);
  await expect(page.locator('#tool-check')).toBeVisible();
  await expect(page.locator('#tool-check-command')).toHaveText('git push --force --dry-run');

  for (const [key, name] of Object.entries(TOOL_FILE_NAMES)) {
    const file = await download(page, () => block.locator(`.tool-download[data-file="${key}"]`).click());
    expect(file.name).toBe(name);
    const date = key.endsWith('.json') || ['claude', 'cursor'].includes(key) ? '' : file.text.match(/ on (\d{4}-\d{2}-\d{2})\. /)[1];
    const expected = compileToolSettings(state, {date}).files[key];
    expect(file.text).toBe(expected);
    if (name.endsWith('.json')) JSON.parse(file.text);
    await expect(page.locator('#tool-status')).toContainText(`Downloaded ${name}.`);
  }
  const claude = JSON.parse((await download(page, () => block.locator('.tool-download[data-file="claude"]').click())).text);
  expect(claude.permissions.deny).toContain('Bash(git push --force *)');

  const lean = await download(page, () => page.locator('#download-lean').click());
  expect(lean.name).toBe(LEAN_FILE_NAME);
  expect(lean.text).toBe(leanPolicyText(state));
  await expect(page.locator('#tokens-lean')).toHaveText(tokenLabel(lean.text));
  await expect(page.locator('#fn-lean')).toHaveText(LEAN_FILE_NAME);
  await expect(page.locator('#tokens-full')).toHaveText(tokenLabel(instructionText(state, 'builder')));
  await expect(page.locator('#tokens-compact')).toHaveText(tokenLabel(instructionText(state, 'builder', {compact: true})));
  await expect(page.locator('#tokens-full')).toContainText(/^About [\d,]+ tokens, sent with every message while it is in your agent's instructions\.$/);
  await expect(page.locator('#policy-guidance')).toHaveText('Put the lean or compact policy in your agent’s instructions and keep the full policy as your reference.');
  await expect(page.locator('#personal-tools-note')).toBeHidden();

  // A change to an answer changes the files right away.
  await option(page, 29, 'ASK').click();
  await option(page, 30, 'ASK').click();
  await option(page, 73, 'ASK').click();
  await option(page, 79, 'ASK').click();
  await expect(page.locator('#tool-check')).toBeHidden();
  const after = JSON.parse((await download(page, () => block.locator('.tool-download[data-file="claude"]').click())).text);
  expect(after.permissions.ask).toContain('Bash(git push --force *)');
});

test('the Personal track has no tool settings, shows why, and shows token estimates', async ({page}) => {
  await page.goto('/#personal');
  await page.locator('#suggest').click();
  await expect(page.locator('#tool-settings')).toBeHidden();
  await expect(page.locator('#fn-lean-row')).toBeHidden();
  await expect(page.locator('#personal-tools-note')).toBeVisible();
  await expect(page.locator('#personal-tools-note')).toHaveText('Your Personal rules stay as instructions in your policy, because everyday assistants do not accept permission files.');
  await expect(page.locator('#policy-guidance')).toHaveText('Put the compact policy in your agent’s instructions and keep the full policy as your reference.');
  const state = await storedJson(page, KEY.personal);
  await expect(page.locator('#tokens-full')).toHaveText(tokenLabel(instructionText(state, 'personal')));
  await expect(page.locator('#tokens-compact')).toHaveText(tokenLabel(instructionText(state, 'personal', {compact: true})));
  await expect(page.locator('#export')).toContainText('Token counts are estimates');
  await page.locator('#switch-track').click();
  await expect(page.locator('#tool-settings')).toBeVisible();
  await expect(page.locator('#personal-tools-note')).toBeHidden();
});

test('copy buttons use the clipboard, and the link falls back to selectable text', async ({browser}) => {
  const context = await browser.newContext({baseURL: BASE, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  await page.goto('/#builder');
  expect(await page.locator('#quick-start').evaluate(node => node.textContent)).toBe(QUICK_START);
  await page.locator('#copy-quick-start').click();
  await expect(page.locator('#quick-start-status')).toHaveText('Quick start copied. Send it with the policy file attached.');
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
  await fallback.locator('#copy-quick-start').click();
  expect(await fallback.evaluate(() => String(window.getSelection()))).toBe(QUICK_START);
  await noClipboard.close();
});

test.describe('phone width', () => {
  test.use({viewport: {width: 390, height: 844}, hasTouch: true});

  test('no horizontal scroll and tap targets of at least 40px', async ({page}) => {
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const smallTargets = () => page.evaluate(() => [...document.querySelectorAll('button, .choice, .group-tile, .filebutton, summary, .diff-list a, .toc a')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
      .filter(node => node.getBoundingClientRect().height < 40)
      .map(node => node.id || node.className || node.textContent.trim().slice(0, 40)));
    await page.goto('/');
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(await smallTargets()).toEqual([]);
    await seed(page, {
      [KEY.builder]: saved('builder', {[SHARED[0].builder]: {choice: 'ALLOW', notes: ''}}),
      [KEY.personal]: saved('personal', {[SHARED[0].personal]: {choice: 'DENY', notes: ''}})
    }, '#builder');
    for (const track of TRACK_IDS) {
      if (track === 'personal') await page.locator('#switch-track').click();
      await page.locator('#suggest').click();
      await page.locator('.group-tile').nth(1).locator('input').uncheck();
      await page.locator('#toc-toggle').click();
      await expect(page.locator('#both-tracks')).toBeVisible();
      if (track === 'builder') {
        for (const summary of await page.locator('#tool-settings summary').all()) await summary.click();
        await expect(page.locator('#tool-settings .tool-tile')).toHaveCount(4);
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
