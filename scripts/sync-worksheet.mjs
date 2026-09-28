import {readFileSync, writeFileSync} from 'node:fs';
const page = new URL('../index.html', import.meta.url);
// Import lines are dropped and exports become plain declarations, so the modules run as one classic script.
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export /gm, '');
// The standalone page runs one classic script: version.mjs, questionnaire.mjs, and compiler.mjs are inlined, in that order.
const sharedBlock = () => '// BEGIN SHARED POLICY\n' + source('version.mjs') + source('questionnaire.mjs') + source('compiler.mjs') + '// END SHARED POLICY';
const html = readFileSync(page, 'utf8');
const next = html.replace(/\/\/ BEGIN SHARED POLICY[\s\S]*?\/\/ END SHARED POLICY/, () => sharedBlock());
if (process.argv.includes('--check')) {
  if (next !== html) throw Error('Run npm run sync before shipping.');
} else writeFileSync(page, next);
